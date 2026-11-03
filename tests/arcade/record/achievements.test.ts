import { describe, expect, it } from 'vitest';
import {
  ACHIEVEMENTS,
  catchUp,
  earn,
  earnedBy,
  newlyEarned,
  type AchievementId,
} from '../../../src/arcade/record/achievements';
import { emptyAllTime, summaryOf } from '../../../src/arcade/record/allTime';
import type { Saved } from '../../../src/arcade/record/store';
import type { PlayResult, RunRecord } from '../../../src/arcade/record/types';
import { blankDown, catchBy, NORMAL, runOf, rushBy, STARTERS } from './fixtures';

/**
 * docs/STATS.md, Achievements, and the branch's scenarios (stats map u4):
 * each earned by a record that meets it and not by one just short. A drive
 * is an area's four series: series 1–4 are the first drive, 5–8 the second.
 */

/** Whether the run so far (after its last down) earns `id`. */
const midRun = (id: AchievementId, downs: PlayResult[], more: Partial<RunRecord> = {}) =>
  earnedBy(runOf(downs, more), 'down').includes(id);
/** Whether the run, ended, earns `id`. */
const atEnd = (id: AchievementId, downs: PlayResult[], more: Partial<RunRecord> = {}) =>
  earnedBy(runOf(downs, more), 'end').includes(id);

const at = (seriesNumber: number, d: PlayResult, down = 1): PlayResult => ({
  ...d,
  seriesNumber,
  down,
});
const td = (seriesNumber: number, d: PlayResult): PlayResult => ({
  ...at(seriesNumber, d),
  outcome: 'touchdown',
});
const great = (player = 1) => ({ test: 'bar' as const, player, grade: 'great' as const, taps: [] });
const ok = (player = 1) => ({ test: 'mash' as const, player, grade: 'ok' as const, taps: [] });
const GOLEM = 8;
const withGolem = {
  team: [
    ...STARTERS,
    { id: GOLEM, name: 'Slab', kind: 'golem' as const, preferred: 'catcher' as const, joinedAt: 0 },
  ],
};
const won = { end: 'won' as const, modes: NORMAL };

describe('the fourteen', () => {
  it('there are fourteen, each with a name and what earns it', () => {
    expect(ACHIEVEMENTS).toHaveLength(14);
    for (const a of ACHIEVEMENTS) {
      expect(a.name).not.toBe('');
      expect(a.earns).not.toBe('');
    }
  });

  it('Air Mail: a completed pass of more than 20 air yards', () => {
    expect(midRun('airMail', [catchBy(1, 25, 21)])).toBe(true);
    expect(midRun('airMail', [catchBy(1, 25, 20)])).toBe(false);
    expect(midRun('airMail', [{ ...blankDown, outcome: 'batted', target: 1 }])).toBe(false);
  });

  it('Unbreakable: two tackles broken on one play', () => {
    expect(midRun('unbreakable', [rushBy(2, 9, { tacklesBroken: 2 })])).toBe(true);
    expect(
      midRun('unbreakable', [
        rushBy(2, 9, { tacklesBroken: 1 }),
        rushBy(2, 9, { tacklesBroken: 1 }),
      ]),
    ).toBe(false);
  });

  it('Do or Die: a first down or a touchdown on fourth down (u5)', () => {
    expect(midRun('doOrDie', [at(1, rushBy(2, 4, { outcome: 'firstDown' }), 4)])).toBe(true);
    expect(midRun('doOrDie', [{ ...td(4, rushBy(2, 4)), down: 4 }])).toBe(true);
    expect(midRun('doOrDie', [at(1, rushBy(2, 4, { outcome: 'firstDown' }), 3)])).toBe(false);
    expect(midRun('doOrDie', [at(1, rushBy(2, 4), 4)])).toBe(false);
  });

  it('Pancake Breakfast: five pancakes in one drive', () => {
    const cakes = (n: number) => Array.from({ length: n }, () => 3);
    expect(
      midRun('pancakeBreakfast', [
        at(1, rushBy(2, 1, { pancakes: cakes(3) })),
        at(4, rushBy(2, 1, { pancakes: cakes(2) })),
      ]),
    ).toBe(true);
    expect(
      midRun('pancakeBreakfast', [
        at(4, rushBy(2, 1, { pancakes: cakes(4) })),
        at(5, rushBy(2, 1, { pancakes: cakes(1) })),
      ]),
    ).toBe(false);
  });

  it('Perfect Drive: GREAT on every tap test in a drive won, at least three', () => {
    const tests = (...t: PlayResult['tapTests'][number][]) => rushBy(2, 3, { tapTests: t });
    expect(midRun('perfectDrive', [at(1, tests(great(), great())), td(4, tests(great()))])).toBe(
      true,
    );
    expect(midRun('perfectDrive', [at(1, tests(great())), td(4, tests(great()))])).toBe(false);
    expect(midRun('perfectDrive', [at(1, tests(great(), ok())), td(4, tests(great()))])).toBe(
      false,
    );
    expect(midRun('perfectDrive', [at(1, tests(great(), great())), at(4, tests(great()))])).toBe(
      false,
    );
  });

  it('a drive is one area’s march, its own each lap round in hard mode', () => {
    // Series 13 is the Forest again (area 3), a drive of its own, not the first one's.
    const cakes = [3, 3, 3];
    expect(
      midRun('pancakeBreakfast', [
        at(1, rushBy(2, 1, { pancakes: cakes })),
        at(13, rushBy(2, 1, { pancakes: cakes })),
      ]),
    ).toBe(false);
    expect(
      midRun('pancakeBreakfast', [
        at(13, rushBy(2, 1, { pancakes: cakes })),
        at(16, rushBy(2, 1, { pancakes: cakes })),
      ]),
    ).toBe(true);
  });

  it('Spread the Love: a catch or a rush by five different players in one drive, won or not (u6)', () => {
    const five = [catchBy(1, 3), catchBy(2, 3), rushBy(3, 3), rushBy(4, 3), at(4, catchBy(5, 3))];
    expect(midRun('spreadTheLove', five)).toBe(true);
    expect(midRun('spreadTheLove', [...five.slice(0, 4), at(5, catchBy(5, 3))])).toBe(false);
    // A target who didn't catch it didn't touch it.
    expect(midRun('spreadTheLove', [...five.slice(0, 4), { ...blankDown, target: 5 }])).toBe(false);
  });

  it('Clean Sheet: a drive won without an incomplete, a sack or a tackle for loss', () => {
    const clean = [at(1, catchBy(1, 6)), at(2, rushBy(2, 4)), td(4, catchBy(1, 10))];
    expect(midRun('cleanSheet', clean)).toBe(true);
    expect(midRun('cleanSheet', [...clean.slice(0, 2), at(3, blankDown), clean[2]!])).toBe(false);
    expect(
      midRun('cleanSheet', [
        ...clean.slice(0, 2),
        at(3, { ...blankDown, kind: 'sack', outcome: 'sacked' }),
        clean[2]!,
      ]),
    ).toBe(false);
    expect(
      midRun('cleanSheet', [
        ...clean.slice(0, 2),
        at(3, rushBy(2, 0, { tackleForLoss: true })),
        clean[2]!,
      ]),
    ).toBe(false);
    expect(midRun('cleanSheet', clean.slice(0, 2))).toBe(false);
    // A pass batted down is an incomplete pass.
    expect(
      midRun('cleanSheet', [
        ...clean.slice(0, 2),
        at(3, { ...blankDown, outcome: 'batted', target: 1 }),
        clean[2]!,
      ]),
    ).toBe(false);
  });

  it('Sweet Tooth and Down on the Farm: the first snap in the Candy Queendom, and on the Farm (u7)', () => {
    expect(midRun('sweetTooth', [at(5, rushBy(2, 1))])).toBe(true);
    expect(midRun('sweetTooth', [at(4, rushBy(2, 1))])).toBe(false);
    expect(midRun('downOnTheFarm', [at(9, rushBy(2, 1))])).toBe(true);
    expect(midRun('downOnTheFarm', [at(8, rushBy(2, 1))])).toBe(false);
  });

  it('Stone Hands: every pass to a Golem in a run caught, at least five', () => {
    const five = Array.from({ length: 5 }, () => catchBy(GOLEM, 4));
    expect(atEnd('stoneHands', five, withGolem)).toBe(true);
    expect(atEnd('stoneHands', five.slice(1), withGolem)).toBe(false);
    expect(
      atEnd('stoneHands', [...five, { ...blankDown, outcome: 'batted', target: GOLEM }], withGolem),
    ).toBe(false);
    // It's about the whole run: not checked mid-run, where a drop could still come.
    expect(midRun('stoneHands', five, withGolem)).toBe(false);
  });
});

describe('the four for a win, normal mode only', () => {
  it('Jack’s Back: a run won', () => {
    expect(atEnd('jacksBack', [rushBy(2, 1)], won)).toBe(true);
    expect(atEnd('jacksBack', [rushBy(2, 1)], { end: 'over', modes: NORMAL })).toBe(false);
    expect(atEnd('jacksBack', [rushBy(2, 1)], { end: 'won' })).toBe(false);
  });

  it('Home Grown: won without taking a TRICK OR TREAT! player', () => {
    expect(atEnd('homeGrown', [rushBy(2, 1)], won)).toBe(true);
    const recruit = {
      id: 8,
      name: 'Boo',
      kind: 'ghost' as const,
      preferred: 'catcher' as const,
      joinedAt: 2,
    };
    expect(atEnd('homeGrown', [rushBy(2, 1)], { ...won, team: [...STARTERS, recruit] })).toBe(
      false,
    );
  });

  it('Flawless Run: won with GREAT on every tap test', () => {
    expect(atEnd('flawlessRun', [rushBy(2, 1, { tapTests: [great(2), great(2)] })], won)).toBe(
      true,
    );
    expect(atEnd('flawlessRun', [rushBy(2, 1, { tapTests: [great(2), ok(2)] })], won)).toBe(false);
    expect(atEnd('flawlessRun', [rushBy(2, 1)], won)).toBe(false);
  });

  it('Rock Steady: won with every pass thrown to a Golem; a throwaway breaks it', () => {
    const toGolem = [
      catchBy(GOLEM, 5),
      { ...blankDown, outcome: 'batted' as const, target: GOLEM },
      rushBy(2, 3),
    ];
    expect(atEnd('rockSteady', toGolem, { ...won, ...withGolem })).toBe(true);
    expect(atEnd('rockSteady', [...toGolem, blankDown], { ...won, ...withGolem })).toBe(false);
    expect(atEnd('rockSteady', [...toGolem, catchBy(1, 4)], { ...won, ...withGolem })).toBe(false);
    expect(atEnd('rockSteady', [rushBy(2, 3)], { ...won, ...withGolem })).toBe(false);
  });

  it('none of the four in hard mode, which never wins', () => {
    const ids = earnedBy(
      runOf([catchBy(1, 3), rushBy(2, 1, { tapTests: [great(2)] })], { end: 'won' }),
      'end',
    );
    expect(
      ids.filter((id) => ['jacksBack', 'homeGrown', 'flawlessRun', 'rockSteady'].includes(id)),
    ).toEqual([]);
  });

  it('none of the four mid-run', () => {
    const ids = earnedBy(runOf([rushBy(2, 1, { tapTests: [great(2)] })], won), 'down');
    expect(
      ids.filter((id) => ['jacksBack', 'homeGrown', 'flawlessRun', 'rockSteady'].includes(id)),
    ).toEqual([]);
  });
});

describe('kept once a phone, for good (h1)', () => {
  const airMail = (id: string, more: Partial<RunRecord> = {}) =>
    runOf([catchBy(1, 25, 22)], { id, ...more });

  it('the first run to earn one keeps it, with its date; a later run doesn’t take it', () => {
    const once = earn({}, airMail('a', { modes: NORMAL }));
    expect(once.airMail).toEqual({ run: 'a', at: '2026-11-03T12:10:00.000Z', hard: false });
    expect(earn(once, airMail('b', { modes: NORMAL }))).toEqual(once);
  });

  it('earned again in hard mode, it gains the hard mark', () => {
    const once = earn({}, airMail('a', { modes: NORMAL }));
    expect(earn(once, airMail('b')).airMail).toEqual({
      run: 'a',
      at: '2026-11-03T12:10:00.000Z',
      hard: true,
    });
    expect(earn({}, airMail('c')).airMail?.hard).toBe(true);
  });

  it('what a run newly earned, for its card: new ones, and a hard mark added', () => {
    const once = earn({}, airMail('a', { modes: NORMAL }));
    expect(newlyEarned({}, airMail('a', { modes: NORMAL }))).toEqual(['airMail']);
    expect(newlyEarned(once, airMail('b', { modes: NORMAL }))).toEqual([]);
    expect(newlyEarned(once, airMail('b'))).toEqual(['airMail']);
  });
});

describe('a new achievement checks the saved runs once (h3)', () => {
  const saved = (runs: RunRecord[], checked: AchievementId[]): Saved => ({
    runs: runs.map((r) => ({ summary: summaryOf(r), record: r })),
    allTime: { hard: emptyAllTime(), normal: emptyAllTime() },
    achievements: {},
    checked,
  });

  it('one not yet checked is looked for in the saved runs, oldest first; then it’s checked', () => {
    const older = runOf([catchBy(1, 25, 22)], { id: 'older', endedAt: '2026-11-01T12:00:00.000Z' });
    const newer = runOf([catchBy(1, 25, 22)], { id: 'newer' });
    const after = catchUp(saved([newer, older], []));
    expect(after.achievements.airMail).toEqual({
      run: 'older',
      at: '2026-11-01T12:00:00.000Z',
      hard: true,
    });
    expect(after.checked).toEqual(ACHIEVEMENTS.map((a) => a.id));
  });

  it('one already checked isn’t looked for again', () => {
    const run = runOf([catchBy(1, 25, 22)]);
    expect(catchUp(saved([run], ['airMail'])).achievements.airMail).toBeUndefined();
  });

  it('a run kept only as its summary can’t earn one: it has no plays', () => {
    const run = runOf([catchBy(1, 25, 22)]);
    const s = saved([run], []);
    const summaryOnly: Saved = { ...s, runs: [{ summary: summaryOf(run), record: null }] };
    expect(catchUp(summaryOnly).achievements.airMail).toBeUndefined();
  });
});
