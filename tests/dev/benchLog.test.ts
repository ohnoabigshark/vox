import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { httpLog, isLogLine, repLine, saveLine } from '../../src/dev/bench/log';
import type { RepResult, Situation } from '../../src/dev/bench/reps';
import { fileAppender, handleBenchLog } from '../../tools/benchLog';

const isLine = async (x: unknown): Promise<boolean> => isLogLine(x);

/** docs/BENCH.md, tests 12-14 and the rework's test M. */

const situation: Situation = { drive: 7, tacklers: 1, crowd: 1, handsGap: 0 };
const NOW = Date.UTC(2026, 9, 31, 15, 2, 11);

describe('the log', () => {
  const result: RepResult = {
    test: 'snag',
    situation,
    grade: 'ok',
    timing: {
      test: 'snag',
      dots: [
        { off: 0.0312345, hit: true },
        { off: null, hit: false },
      ],
    },
  };

  it("M: a rep line has the test, the situation, the timing, the grade, and the tab's settings off default", () => {
    const settings = {
      'snag.close': 0.56,
      'snag.window': 0.12, // the default: left out
      'crows.window': 0.7, // another tab's
    };
    expect(repLine(result, settings, NOW)).toEqual({
      at: '2026-10-31T15:02:11.000Z',
      kind: 'rep',
      test: 'snag',
      situation,
      grade: 'ok',
      timing: {
        test: 'snag',
        dots: [
          { off: 0.0312, hit: true },
          { off: null, hit: false },
        ],
      },
      settings: { 'snag.close': 0.56 },
    });
  });

  it("M: a save line has what the tab saved; the Break it! tabs' shared values with each", () => {
    const file = { 'snag.close': 0.56, 'countdown.ready': 2, 'crows.window': 0.7 };
    expect(saveLine('snag', file, NOW)).toEqual({
      at: '2026-10-31T15:02:11.000Z',
      kind: 'save',
      test: 'snag',
      // The shared countdown saves with SNAG IT! too (docs/SNAG.md, cd-c8).
      saved: { 'snag.close': 0.56, 'countdown.ready': 2 },
    });
    const mash = saveLine('mash', file, NOW);
    if (mash.kind !== 'save') throw new Error('not a save line');
    expect(mash.saved).toEqual({ 'countdown.ready': 2 });
    // Saving the defaults is a line too: nothing saved for that tab.
    expect(saveLine('juke', {}, NOW)).toEqual({
      at: '2026-10-31T15:02:11.000Z',
      kind: 'save',
      test: 'juke',
      saved: {},
    });
  });

  it('M: a slider move is no line at all: the old settings lines are turned away', () => {
    expect(isLogLine(repLine(result, {}, NOW))).toBe(true);
    expect(isLogLine(saveLine('snag', {}, NOW))).toBe(true);
    expect(
      isLogLine({
        at: '2026-10-31T15:02:11.000Z',
        kind: 'settings',
        test: 'snag',
        situation,
        changed: { 'snag.close': 0.56 },
        settings: { 'snag.close': 0.56 },
      }),
    ).toBe(false);
    expect(isLogLine({ ...saveLine('snag', {}, NOW), saved: { 'snag.close': 'x' } })).toBe(false);
    expect(isLogLine({ ...repLine(result, {}, NOW), settings: null })).toBe(false);
  });

  it('13: the endpoint appends each log line as one line, and turns away anything else', async () => {
    const lines: string[] = [];
    const append = async (s: string): Promise<void> => void lines.push(s);
    const line = repLine(result, {}, NOW);
    expect(await handleBenchLog('POST', JSON.stringify(line), append, isLine)).toMatchObject({
      status: 204,
    });
    expect(lines).toEqual([`${JSON.stringify(line)}\n`]);
    for (const bad of [
      'not json',
      '{"kind":"rep"}',
      '[]',
      JSON.stringify({ ...line, kind: 'x' }),
    ]) {
      expect((await handleBenchLog('POST', bad, append, isLine)).status, bad).toBe(400);
    }
    expect(lines).toHaveLength(1);
    expect(await handleBenchLog('GET', '', append, isLine)).toMatchObject({ status: 200 });
    expect((await handleBenchLog('PUT', '', append, isLine)).status).toBe(405);
    const broken = async (): Promise<void> => {
      throw new Error('disk full');
    };
    expect(await handleBenchLog('POST', JSON.stringify(line), broken, isLine)).toEqual({
      status: 500,
      body: 'disk full',
    });
  });

  it('13: the file gets one line per entry, in a folder it makes', async () => {
    const file = join(await mkdtemp(join(tmpdir(), 'bench-')), 'new', 'bench.jsonl');
    const append = fileAppender(file);
    await append('{"a":1}\n');
    await append('{"b":2}\n');
    expect(await readFile(file, 'utf8')).toBe('{"a":1}\n{"b":2}\n');
  });

  it("14: with no endpoint, or a failing one, it says it isn't recording", async () => {
    const answering = (status: number): typeof fetch =>
      (async () => new Response(null, { status })) as typeof fetch;
    const down = (async () => {
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;
    const line = saveLine('shoo', {}, NOW);
    expect(await httpLog('/x', answering(200)).probe()).toBe(true);
    expect(await httpLog('/x', answering(404)).probe()).toBe(false);
    expect(await httpLog('/x', down).probe()).toBe(false);
    expect(await httpLog('/x', answering(204)).record(line)).toBe(true);
    expect(await httpLog('/x', answering(500)).record(line)).toBe(false);
    expect(await httpLog('/x', down).record(line)).toBe(false);
  });
});
