import { beforeAll, describe, expect, it } from 'vitest';
import {
  playerStats,
  playsStats,
  runStats,
  type PlayerStats,
  type RunStats,
} from '../../../src/arcade/record/stats';
import { JACK, type PlayResult, type RunRecord } from '../../../src/arcade/record/types';

/** docs/STATS.md: the run's stats (s1), each player's (s2), and the plays (p7), read from a record. */

const blank: PlayResult = {
  seriesNumber: 1,
  down: 1,
  toGo: 10,
  los: 0,
  play: 'slants',
  flipped: false,
  hotRoutes: [],
  kind: 'pass',
  outcome: 'incomplete',
  gained: 0,
  passer: JACK,
  target: null,
  catcher: null,
  carrier: null,
  tackledBy: null,
  airYards: null,
  afterCatch: null,
  afterContact: null,
  tackleForLoss: false,
  tacklesBroken: 0,
  drags: 0,
  pancakes: [],
  fieldEvents: [],
  pickups: [],
  crowsShooed: 0,
  tapTests: [],
};

const catchBy = (
  id: number,
  gained: number,
  air: number,
  more: Partial<PlayResult> = {},
): PlayResult => ({
  ...blank,
  outcome: 'tackled',
  gained,
  target: id,
  catcher: id,
  carrier: id,
  airYards: air,
  afterCatch: gained - air,
  ...more,
});
const rushBy = (id: number, gained: number, more: Partial<PlayResult> = {}): PlayResult => ({
  ...blank,
  play: 'dive',
  kind: 'rush',
  outcome: 'tackled',
  gained,
  passer: null,
  carrier: id,
  ...more,
});
const sack: PlayResult = { ...blank, kind: 'sack', outcome: 'sacked', gained: -2 };

const record = (downs: PlayResult[], more: Partial<RunRecord> = {}): RunRecord => ({
  format: 1,
  id: 'r',
  build: 'b',
  link: '',
  setup: '',
  modes: { hard: true, twoTap: true, snag: false, tip: false },
  startedAt: '2026-11-03T12:00:00.000Z',
  endedAt: null,
  end: 'over',
  reached: { area: 1, index: 2, seriesNumber: 7 },
  team: [],
  plays: {},
  downs,
  ...more,
});

describe('the run’s stats (s1)', () => {
  const downs = [
    catchBy(1, 12, 8, { outcome: 'firstDown' }),
    { ...blank, target: 2 },
    catchBy(2, 4, 4, {
      afterContact: 1,
      tacklesBroken: 1,
      tapTests: [{ test: 'bar', player: 2, grade: 'great', taps: [] }],
    }),
    rushBy(3, 6, { afterContact: 2, pancakes: [4, 4, 5] }),
    rushBy(3, 0, { tackleForLoss: true }),
    sack,
    { ...blank, outcome: 'batted' as const, target: 1 },
    catchBy(1, 10, 3, {
      outcome: 'touchdown',
      pickups: ['bolt'],
      fieldEvents: ['frogRain'],
      crowsShooed: 1,
    }),
  ];
  let s: RunStats;
  beforeAll(() => {
    s = runStats(record(downs));
  });

  it('how far: the drive and series reached, downs, first downs and touchdowns', () => {
    expect(s.reached).toEqual({ area: 1, index: 2, seriesNumber: 7 });
    expect(s.won).toBe(false);
    expect(s.downs).toBe(8);
    expect(s.firstDowns).toBe(1);
    expect(s.touchdowns).toBe(1);
  });

  it('passing: passes and completions, yards, air yards, the longest pass play; a sack isn’t a pass', () => {
    expect(s.passing).toEqual({ passes: 5, completions: 3, yards: 26, airYards: 15, longest: 12 });
  });

  it('rushing: rushes, yards, the longest', () => {
    expect(s.rushing).toEqual({ rushes: 2, yards: 6, longest: 6 });
  });

  it('contact, against you, blocking', () => {
    expect(s.contact).toEqual({ tacklesBroken: 1, afterContact: 3 });
    expect(s.against).toEqual({ sacks: 1, tacklesForLoss: 1, incompletes: 1, batted: 1 });
    expect(s.pancakes).toBe(3);
  });

  it('tap tests by grade, for each test', () => {
    expect(s.tapTests.bar).toEqual({ great: 1, ok: 0, bad: 0 });
    expect(s.tapTests.snag).toEqual({ great: 0, ok: 0, bad: 0 });
  });

  it('the rest: pickups, field events, crows shooed', () => {
    expect(s.rest).toEqual({ pickups: 1, fieldEvents: 1, crowsShooed: 1 });
  });

  it('a run won says so', () => {
    expect(runStats(record([], { end: 'won' })).won).toBe(true);
  });
});

describe('each player’s stats (s2)', () => {
  const downs = [
    catchBy(1, 12, 8, {
      outcome: 'firstDown',
      afterContact: 2,
      tacklesBroken: 1,
      tapTests: [{ test: 'mash', player: 1, grade: 'great', taps: [] }],
    }),
    { ...blank, target: 1 },
    catchBy(1, -1, 0, { tackleForLoss: true }),
    rushBy(2, 9, { pancakes: [3] }),
    sack,
  ];
  let p: ReadonlyMap<number, PlayerStats>;
  beforeAll(() => {
    p = playerStats(record(downs));
  });

  it('Jack: passes and completions, yards, air yards, the longest, sacks taken', () => {
    expect(p.get(JACK)?.passing).toEqual({
      passes: 3,
      completions: 2,
      yards: 11,
      airYards: 8,
      longest: 12,
      sacks: 1,
    });
  });

  it('a catcher: targets, catches, yards, after the catch, the longest; first downs; a loss taken', () => {
    const c = p.get(1)!;
    expect(c.catching).toEqual({ targets: 3, catches: 2, yards: 11, afterCatch: 3, longest: 12 });
    expect(c.firstDowns).toBe(1);
    expect(c.contact).toEqual({ tacklesBroken: 1, afterContact: 2, tacklesForLoss: 1 });
    expect(c.tapTests).toEqual({ great: 1, ok: 0, bad: 0 });
  });

  it('a Runner’s rushing, and a Blocker’s pancakes', () => {
    expect(p.get(2)?.rushing).toEqual({ rushes: 1, yards: 9, longest: 9 });
    expect(p.get(3)?.pancakes).toBe(1);
  });

  it('a player who did nothing has no stats', () => {
    expect(p.has(7)).toBe(false);
  });
});

describe('the plays (p7)', () => {
  const call = (play: string, gained: number): PlayResult => ({ ...blank, play, gained });
  it('most used is called most; most successful gains most a call, from 3 calls, a tie to the one called more', () => {
    const r = record([
      ...[4, 4, 4].map((g) => call('slants', g)),
      ...[4, 4, 4, 4].map((g) => call('dive', g)),
      ...[20, 20].map((g) => call('deepShot', g)),
    ]);
    const plays = playsStats(r);
    expect(plays.mostUsed).toBe('dive');
    expect(plays.mostSuccessful).toBe('dive');
    expect(plays.byPlay.get('deepShot')).toEqual({ calls: 2, yards: 40 });
  });

  it('no play called three times: no most successful', () => {
    expect(playsStats(record([call('slants', 9)])).mostSuccessful).toBeNull();
  });
});
