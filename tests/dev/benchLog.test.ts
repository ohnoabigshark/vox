import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { copyText, knobsFor, pathOf } from '../../src/dev/bench/knobs';
import { httpLog, repLine, settingsLine } from '../../src/dev/bench/log';
import type { RepResult, Situation } from '../../src/dev/bench/reps';
import { fileAppender, handleBenchLog } from '../../tools/benchLog';

/** docs/BENCH.md, tests 12-14. */

const situation: Situation = { drive: 7, tacklers: 1, crowd: 1, handsGap: 0 };
const NOW = Date.UTC(2026, 9, 31, 15, 2, 11);

describe('the log', () => {
  it("12: a settings line has the change, the test's whole settings as tuning.ts numbers, and the situation", () => {
    const line = settingsLine('snag', situation, { 'snag.close': 0.56 }, 'snag.close', NOW);
    if (line.kind !== 'settings') throw new Error('not a settings line');
    expect(line.at).toBe('2026-10-31T15:02:11.000Z');
    expect(line.test).toBe('snag');
    expect(line.changed).toEqual({ 'snag.close': 0.56 });
    expect(line.situation).toEqual(situation);
    expect(Object.keys(line.settings)).toEqual(knobsFor('snag').map((k) => pathOf(k, 7)));
    expect(line.settings['snag.close']).toBe(0.56);
    expect(line.settings['snag.window']).toBe(0.12);
    // A by-area value is the picked drive's.
    const bar = settingsLine('bar', situation, {}, 'breakit.near', NOW);
    if (bar.kind !== 'settings') throw new Error('not a settings line');
    expect(bar.settings['breakit.byArea.1.sweet']).toBe(0.075);
  });

  it('12: a rep line has the test, the situation, the timing and the grade', () => {
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
    expect(repLine(result, NOW)).toEqual({
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
    });
  });

  it('13: the endpoint appends each log line as one line, and turns away anything else', async () => {
    const lines: string[] = [];
    const append = async (s: string): Promise<void> => void lines.push(s);
    const line = settingsLine('shoo', situation, {}, 'crows.window', NOW);
    expect(await handleBenchLog('POST', JSON.stringify(line), append)).toMatchObject({
      status: 204,
    });
    expect(lines).toEqual([`${JSON.stringify(line)}\n`]);
    for (const bad of [
      'not json',
      '{"kind":"settings"}',
      '[]',
      JSON.stringify({ ...line, kind: 'x' }),
    ]) {
      expect((await handleBenchLog('POST', bad, append)).status, bad).toBe(400);
    }
    expect(lines).toHaveLength(1);
    expect(await handleBenchLog('GET', '', append)).toMatchObject({ status: 200 });
    expect((await handleBenchLog('PUT', '', append)).status).toBe(405);
    const broken = async (): Promise<void> => {
      throw new Error('disk full');
    };
    expect(await handleBenchLog('POST', JSON.stringify(line), broken)).toEqual({
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
    const line = settingsLine('shoo', situation, {}, 'crows.window', NOW);
    expect(await httpLog('/x', answering(200)).probe()).toBe(true);
    expect(await httpLog('/x', answering(404)).probe()).toBe(false);
    expect(await httpLog('/x', down).probe()).toBe(false);
    expect(await httpLog('/x', answering(204)).record(line)).toBe(true);
    expect(await httpLog('/x', answering(500)).record(line)).toBe(false);
    expect(await httpLog('/x', down).record(line)).toBe(false);
  });

  it("14: Copy settings gives the open tab's values as tuning.ts lines", () => {
    expect(copyText('juke', 7, { 'breakit.jukeLinger': 0.5 })).toBe(
      [
        '// Test bench: juke, drive 7 (src/arcade/content/tuning.ts)',
        'breakit.ready: 1.6,',
        'breakit.perExtraTackler: 0.6,',
        'breakit.byArea.1.jukeWindow: 0.48,',
        'breakit.jukeBreakShare: 0.5,',
        'breakit.jukeLinger: 0.5,  // was 0.4',
      ].join('\n'),
    );
  });
});
