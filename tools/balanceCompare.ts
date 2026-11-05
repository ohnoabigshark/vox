import { createHash } from 'node:crypto';
import { existsSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Comparing a branch's balance with main's (docs/DIFFICULTY.md, "Balance
 * runs"): the same six scenarios run on both, and main's results are kept,
 * reused until main's commit, the balance tool's code or the run count
 * changes (docs/PLAN.md, "Faster balance runs", change 2). The command is
 * `tools/balance-compare.ts`.
 */

/** One scenario of the six: its report's file name, and the tool's BALANCE_SCENARIO and BOT. */
export interface Scenario {
  readonly file: string;
  readonly scenario: object;
  readonly bot: object;
}

const normal = { name: 'A new player every time', perks: true };
const hard = { name: 'Hard, a new player every time', hard: true, perks: true };
const bots = { pass: {}, mixed: { passOnly: false }, run: { runOnly: true } };

/** Normal and hard mode, each with the passing bot, the one that calls handoffs too, and the one that always does. */
export const SIX: readonly Scenario[] = (
  [
    ['normal', normal],
    ['hard', hard],
  ] as const
).flatMap(([mode, scenario]) =>
  Object.entries(bots).map(([name, bot]) => ({ file: `${mode}-${name}.txt`, scenario, bot })),
);

/**
 * The files whose code makes the report. A baseline runs main's game with the
 * branch's copies of these, so a change to what the report counts runs main
 * again, once.
 */
export const TOOL_FILES = [
  'tools/arcade-balance.ts',
  'tools/balanceCount.ts',
  'tools/balanceCompare.ts',
] as const;

/**
 * What a baseline was made from, as a folder name: main's commit (12
 * characters), a hash of the tool's code, and the run count.
 */
export function baselineKey(from: {
  readonly main: string;
  readonly tools: Readonly<Record<string, string>>;
  readonly runs: number;
}): string {
  const hash = createHash('sha256');
  for (const path of Object.keys(from.tools).sort()) {
    hash.update(`${path}\0${from.tools[path]}\0`);
  }
  return `${from.main.slice(0, 12)}-${hash.digest('hex').slice(0, 12)}-${from.runs}`;
}

/** Where a baseline under this key is written while it runs. */
export const partialBaseline = (store: string, key: string): string =>
  join(store, 'main', `${key}.partial`);

/** The kept baseline under this key, or null when there is none (a run that didn't finish isn't one). */
export function keptBaseline(store: string, key: string): string | null {
  const dir = join(store, 'main', key);
  return existsSync(dir) ? dir : null;
}

/**
 * Keep a finished baseline under its key. Throws, keeping nothing, if a
 * scenario's report is missing.
 */
export function keepBaseline(store: string, key: string, from: string): string {
  const missing = SIX.filter((s) => !existsSync(join(from, s.file))).map((s) => s.file);
  if (missing.length > 0) {
    throw new Error(`The baseline in ${from} is missing ${missing.join(', ')}; not kept.`);
  }
  const dir = join(store, 'main', key);
  rmSync(dir, { recursive: true, force: true });
  renameSync(from, dir);
  return dir;
}
