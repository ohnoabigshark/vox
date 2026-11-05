import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  SIX,
  TOOL_FILES,
  baselineKey,
  keepBaseline,
  keptBaseline,
  partialBaseline,
} from '../../tools/balanceCompare';

/**
 * Keeping main's balance results (docs/PLAN.md, "Faster balance runs", change
 * 2): a baseline is kept under a key of main's commit, the tool's code and
 * the run count, and reused until one of them changes.
 */

const tools = { 'tools/arcade-balance.ts': 'the bot', 'tools/balanceCount.ts': 'the counts' };
const key = (over: Partial<Parameters<typeof baselineKey>[0]> = {}): string =>
  baselineKey({ main: 'a'.repeat(40), tools, runs: 40, ...over });

let store: string;
beforeEach(() => {
  store = mkdtempSync(join(tmpdir(), 'balance-store-'));
});
afterEach(() => {
  rmSync(store, { recursive: true, force: true });
});

/** A baseline run that wrote every scenario's report. */
function ranAll(k: string): string {
  const dir = partialBaseline(store, k);
  mkdirSync(dir, { recursive: true });
  for (const s of SIX) writeFileSync(join(dir, s.file), `report for ${s.file}`);
  return dir;
}

describe('the kept baseline', () => {
  it('the same main, tool code and run count give the same key', () => {
    expect(key()).toBe(key({ tools: { ...tools } }));
  });

  it('a change to main’s commit, the tool’s code or the run count makes a new key', () => {
    const keys = [
      key(),
      key({ main: 'b'.repeat(40) }),
      key({ tools: { ...tools, 'tools/balanceCount.ts': 'the counts, and bolts' } }),
      key({ tools: { ...tools, 'tools/new.ts': '' } }),
      key({ runs: 4 }),
    ];
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('a key names main’s commit and the run count, so a folder of them can be read', () => {
    expect(key()).toMatch(/^aaaaaaaaaaaa-[0-9a-f]{12}-40$/);
  });

  it('a kept baseline is found again under the same key, and only that key', () => {
    keepBaseline(store, key(), ranAll(key()));
    const kept = keptBaseline(store, key());
    expect(kept).not.toBeNull();
    for (const s of SIX) expect(existsSync(join(kept ?? '', s.file))).toBe(true);
    expect(keptBaseline(store, key({ runs: 4 }))).toBeNull();
  });

  it('a baseline that didn’t finish is never reused', () => {
    ranAll(key());
    expect(keptBaseline(store, key())).toBeNull();
  });

  it('keeping refuses a baseline missing a scenario’s report', () => {
    const dir = ranAll(key());
    rmSync(join(dir, SIX[0]?.file ?? ''));
    expect(() => keepBaseline(store, key(), dir)).toThrow(SIX[0]?.file);
    expect(keptBaseline(store, key())).toBeNull();
  });
});

describe('the six scenarios', () => {
  it('are normal and hard mode, each with the passing, mixed and running bot', () => {
    expect(SIX.map((s) => [s.file, s.scenario, s.bot])).toEqual([
      ['normal-pass.txt', { name: 'A new player every time', perks: true }, {}],
      ['normal-mixed.txt', { name: 'A new player every time', perks: true }, { passOnly: false }],
      ['normal-run.txt', { name: 'A new player every time', perks: true }, { runOnly: true }],
      ['hard-pass.txt', { name: 'Hard, a new player every time', hard: true, perks: true }, {}],
      [
        'hard-mixed.txt',
        { name: 'Hard, a new player every time', hard: true, perks: true },
        { passOnly: false },
      ],
      [
        'hard-run.txt',
        { name: 'Hard, a new player every time', hard: true, perks: true },
        { runOnly: true },
      ],
    ]);
  });
});

describe('the tool’s code', () => {
  it('is every file of tools/ the balance tool imports, so a change to any of them runs main again', () => {
    const imported = (path: string): string[] =>
      [...readFileSync(path, 'utf8').matchAll(/from '\.\/([\w-]+)'/g)].map(
        (m) => `tools/${m[1]}.ts`,
      );
    const seen = new Set<string>();
    const walk = (path: string): void => {
      if (seen.has(path)) return;
      seen.add(path);
      imported(path).forEach(walk);
    };
    walk('tools/arcade-balance.ts');
    walk('tools/balance-compare.ts');
    // The command itself runs only here, never on main's side.
    seen.delete('tools/balance-compare.ts');
    expect([...TOOL_FILES].sort()).toEqual([...seen].sort());
  });
});
