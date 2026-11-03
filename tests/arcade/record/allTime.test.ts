import { describe, expect, it } from 'vitest';
import { addRun, emptyAllTime, summaryOf } from '../../../src/arcade/record/allTime';
import { runStats } from '../../../src/arcade/record/stats';
import { JACK, type PlayResult, type RunRecord } from '../../../src/arcade/record/types';

/** docs/STATS.md, all time (s3): runs, totals, records kept with their run, best single-player runs. */

const blank: PlayResult = {
  seriesNumber: 1,
  down: 1,
  toGo: 10,
  los: 0,
  play: 'slants',
  flipped: false,
  kind: 'pass',
  outcome: 'incomplete',
  gained: 0,
  passer: JACK,
  target: null,
  catcher: null,
  carrier: null,
  airYards: null,
  afterCatch: null,
  afterContact: null,
  lossTackle: false,
  tacklesBroken: 0,
  drags: 0,
  pancakes: [],
  fieldEvents: [],
  pickups: [],
  crowsShooed: 0,
  tapTests: [],
};
const catchBy = (id: number, gained: number): PlayResult => ({
  ...blank,
  outcome: 'tackled',
  gained,
  target: id,
  catcher: id,
  carrier: id,
  airYards: gained,
  afterCatch: 0,
});
const rushBy = (id: number, gained: number): PlayResult => ({
  ...blank,
  kind: 'rush',
  outcome: 'tackled',
  gained,
  passer: null,
  carrier: id,
});

const TEAM: RunRecord['team'] = [
  { id: JACK, name: 'Jack', kind: 'jack', preferred: null, joinedAt: 0 },
  { id: 1, name: 'Gourdon', kind: 'human', preferred: 'catcher', joinedAt: 0 },
  { id: 2, name: 'Mags', kind: 'human', preferred: 'runner', joinedAt: 0 },
  { id: 3, name: 'Slab', kind: 'human', preferred: 'blocker', joinedAt: 0 },
];

const record = (id: string, downs: PlayResult[], more: Partial<RunRecord> = {}): RunRecord => ({
  format: 1,
  id,
  build: 'b',
  link: '',
  modes: { hard: true, twoTap: true, snag: false, tip: false },
  startedAt: '2026-11-03T12:00:00.000Z',
  endedAt: '2026-11-03T12:06:00.000Z',
  end: 'over',
  reached: { area: 0, index: 2, seriesNumber: 3 },
  team: TEAM,
  plays: {},
  downs,
  ...more,
});

const after = (...records: RunRecord[]) =>
  records.reduce((all, r) => addRun(all, r), emptyAllTime());

describe('all time', () => {
  it('a run’s net yards are every down’s gain, sacks too', () => {
    expect(
      runStats(
        record('a', [
          catchBy(1, 12),
          rushBy(2, 5),
          { ...blank, kind: 'sack', outcome: 'sacked', gained: -2 },
        ]),
      ).yards,
    ).toBe(15);
  });

  it('runs played, won and the furthest reached; an unfinished run counts', () => {
    const all = after(
      record('a', []),
      record('b', [], { end: 'won', reached: { area: 2, index: 3, seriesNumber: 12 } }),
      record('c', [], { end: 'unfinished', reached: { area: 1, index: 0, seriesNumber: 5 } }),
    );
    expect(all.runs).toBe(3);
    expect(all.won).toBe(1);
    expect(all.furthest).toEqual({ area: 2, index: 3, seriesNumber: 12 });
  });

  it('totals add up the runs’ stats', () => {
    const all = after(record('a', [catchBy(1, 12), rushBy(2, 5)]), record('b', [catchBy(1, 4)]));
    expect(all.totals.passing).toEqual({ passes: 2, completions: 2, yards: 16, airYards: 16 });
    expect(all.totals.rushing).toEqual({ rushes: 1, yards: 5 });
    expect(all.totals.yards).toBe(21);
    expect(all.totals.downs).toBe(3);
  });

  it('a record keeps the run it came from; a tie keeps the first', () => {
    const all = after(
      record('a', [catchBy(1, 30)], { endedAt: '2026-11-01T10:00:00.000Z' }),
      record('b', [catchBy(1, 30), rushBy(2, 9)], { endedAt: '2026-11-02T10:00:00.000Z' }),
    );
    expect(all.records.longestPass).toEqual({
      value: 30,
      run: 'a',
      at: '2026-11-01T10:00:00.000Z',
    });
    expect(all.records.longestRush).toEqual({ value: 9, run: 'b', at: '2026-11-02T10:00:00.000Z' });
    expect(all.records.mostYards).toEqual({ value: 39, run: 'b', at: '2026-11-02T10:00:00.000Z' });
  });

  it('the best completion rate needs at least 10 passes', () => {
    const nine = Array.from({ length: 9 }, () => catchBy(1, 5));
    const ten = [...Array.from({ length: 8 }, () => catchBy(1, 5)), blank, blank];
    expect(after(record('a', nine)).records.bestCompletion).toBeNull();
    expect(after(record('a', nine), record('b', ten)).records.bestCompletion).toEqual({
      value: 0.8,
      run: 'b',
      at: '2026-11-03T12:06:00.000Z',
    });
  });

  it('the best single-player runs, with their names', () => {
    const all = after(
      record('a', [
        catchBy(1, 20),
        catchBy(1, 7),
        rushBy(2, 11),
        { ...rushBy(2, 1), pancakes: [3, 3] },
      ]),
    );
    expect(all.records.bestReceiving).toEqual({
      value: 27,
      run: 'a',
      at: '2026-11-03T12:06:00.000Z',
      name: 'Gourdon',
    });
    expect(all.records.bestRushing).toEqual({
      value: 12,
      run: 'a',
      at: '2026-11-03T12:06:00.000Z',
      name: 'Mags',
    });
    expect(all.records.bestPancakes).toEqual({
      value: 2,
      run: 'a',
      at: '2026-11-03T12:06:00.000Z',
      name: 'Slab',
    });
  });

  it('a run’s summary: how far, its stats, its team, and when', () => {
    const r = record('a', [catchBy(1, 12)]);
    expect(summaryOf(r)).toEqual({
      id: 'a',
      startedAt: r.startedAt,
      endedAt: r.endedAt,
      end: 'over',
      modes: r.modes,
      reached: r.reached,
      stats: runStats(r),
      team: TEAM,
    });
  });
});
