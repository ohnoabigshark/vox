/**
 * The achievements (docs/STATS.md, h1–h3), each defined once here as a
 * check over a run's record. A `down` one can be earned mid-run (it pops
 * in the pause after the down that earned it); a `run` one is about the
 * whole run (it shows on the run's card). A drive is an area's march: its
 * four series (series 1–4 are the first drive, 5–8 the second).
 */
import { SERIES_PER_AREA } from '../sim/props';
import type { PlayResult, RunRecord } from './types';

export type AchievementId =
  | 'airMail'
  | 'unbreakable'
  | 'doOrDie'
  | 'pancakeBreakfast'
  | 'perfectDrive'
  | 'spreadTheLove'
  | 'cleanSheet'
  | 'stoneHands'
  | 'sweetTooth'
  | 'downOnTheFarm'
  | 'jacksBack'
  | 'homeGrown'
  | 'flawlessRun'
  | 'rockSteady';

export interface Achievement {
  readonly id: AchievementId;
  readonly name: string;
  /** What earns it, for the stats section. */
  readonly earns: string;
  /** Earned mid-run, after a down, or only as the run ends. */
  readonly when: 'down' | 'run';
  /** Only normal mode wins (e2's note). */
  readonly normalOnly: boolean;
  readonly check: (record: RunRecord) => boolean;
}

/** The run's downs by drive: an area's four series, so 1–4 are the first drive. */
function drives(record: RunRecord): PlayResult[][] {
  const by = new Map<number, PlayResult[]>();
  for (const d of record.downs) {
    const drive = Math.floor((d.seriesNumber - 1) / SERIES_PER_AREA);
    by.set(drive, [...(by.get(drive) ?? []), d]);
  }
  return [...by.values()];
}

/** A drive won: it ended in a touchdown. */
const wonDrive = (downs: readonly PlayResult[]): boolean =>
  downs.some((d) => d.outcome === 'touchdown');
const won = (r: RunRecord): boolean => r.end === 'won';
const tapTests = (downs: readonly PlayResult[]) => downs.flatMap((d) => d.tapTests);
const allGreat = (downs: readonly PlayResult[], least: number): boolean => {
  const tests = tapTests(downs);
  return tests.length >= least && tests.every((t) => t.grade === 'great');
};
const isGolem = (r: RunRecord, id: number | null): boolean =>
  id !== null && r.team.find((p) => p.id === id)?.kind === 'golem';
const passes = (r: RunRecord) => r.downs.filter((d) => d.kind === 'pass');
/** Reached the area with this index (0 the Forest): a snap in its first series. */
const reached = (r: RunRecord, area: number): boolean =>
  r.downs.some((d) => d.seriesNumber > area * SERIES_PER_AREA);

export const ACHIEVEMENTS: readonly Achievement[] = [
  {
    id: 'airMail',
    name: 'Air Mail',
    earns: 'Complete a pass of more than 20 air yards',
    when: 'down',
    normalOnly: false,
    check: (r) => r.downs.some((d) => d.catcher !== null && (d.airYards ?? 0) > 20),
  },
  {
    id: 'unbreakable',
    name: 'Unbreakable',
    earns: 'Break two tackles on one play',
    when: 'down',
    normalOnly: false,
    check: (r) => r.downs.some((d) => d.tacklesBroken >= 2),
  },
  {
    id: 'doOrDie',
    name: 'Do or Die',
    earns: 'Make a first down or a touchdown on fourth down',
    when: 'down',
    normalOnly: false,
    check: (r) =>
      r.downs.some((d) => d.down === 4 && (d.outcome === 'firstDown' || d.outcome === 'touchdown')),
  },
  {
    id: 'pancakeBreakfast',
    name: 'Pancake Breakfast',
    earns: 'Five pancakes in one drive',
    when: 'down',
    normalOnly: false,
    check: (r) => drives(r).some((downs) => downs.reduce((n, d) => n + d.pancakes.length, 0) >= 5),
  },
  {
    id: 'perfectDrive',
    name: 'Perfect Drive',
    earns: 'GREAT on every tap test in a drive you win, at least three',
    when: 'down',
    normalOnly: false,
    check: (r) => drives(r).some((downs) => wonDrive(downs) && allGreat(downs, 3)),
  },
  {
    id: 'spreadTheLove',
    name: 'Spread the Love',
    earns: 'A catch or a rush by five different players in one drive',
    when: 'down',
    normalOnly: false,
    check: (r) =>
      drives(r).some(
        (downs) =>
          new Set(
            downs.flatMap((d) => [
              ...(d.catcher === null ? [] : [d.catcher]),
              ...(d.kind === 'rush' && d.carrier !== null ? [d.carrier] : []),
            ]),
          ).size >= 5,
      ),
  },
  {
    id: 'cleanSheet',
    name: 'Clean Sheet',
    earns: 'Win a drive without an incomplete, a sack or a tackle for loss',
    when: 'down',
    normalOnly: false,
    check: (r) =>
      drives(r).some(
        (downs) =>
          wonDrive(downs) &&
          !downs.some((d) => d.outcome === 'incomplete' || d.kind === 'sack' || d.tackleForLoss),
      ),
  },
  {
    id: 'stoneHands',
    name: 'Stone Hands',
    earns: 'Catch every pass thrown to a Golem in a run, at least five',
    when: 'run',
    normalOnly: false,
    check: (r) => {
      const toGolem = passes(r).filter((d) => isGolem(r, d.target));
      return toGolem.length >= 5 && toGolem.every((d) => d.catcher === d.target);
    },
  },
  {
    id: 'sweetTooth',
    name: 'Sweet Tooth',
    earns: 'Reach the Candy Queendom',
    when: 'down',
    normalOnly: false,
    check: (r) => reached(r, 1),
  },
  {
    id: 'downOnTheFarm',
    name: 'Down on the Farm',
    earns: "Reach Frederick's Farm",
    when: 'down',
    normalOnly: false,
    check: (r) => reached(r, 2),
  },
  {
    id: 'jacksBack',
    name: "Jack's Back",
    earns: 'Win a run',
    when: 'run',
    normalOnly: true,
    check: won,
  },
  {
    id: 'homeGrown',
    name: 'Home Grown',
    earns: 'Win a run without taking a TRICK OR TREAT! player',
    when: 'run',
    normalOnly: true,
    check: (r) => won(r) && r.team.every((p) => p.joinedAt === 0),
  },
  {
    id: 'flawlessRun',
    name: 'Flawless Run',
    earns: 'GREAT on every tap test in a run you win',
    when: 'run',
    normalOnly: true,
    check: (r) => won(r) && allGreat(r.downs, 1),
  },
  {
    id: 'rockSteady',
    name: 'Rock Steady',
    earns: 'Win a run where every pass is thrown to a Golem',
    when: 'run',
    normalOnly: true,
    check: (r) => won(r) && passes(r).length > 0 && passes(r).every((d) => isGolem(r, d.target)),
  },
];

/** The achievements a run earns: mid-run (`down`: the ones that can be, so far) or as it ends (`end`: all of them). */
export function earnedBy(record: RunRecord, when: 'down' | 'end'): AchievementId[] {
  return ACHIEVEMENTS.filter(
    (a) =>
      (when === 'end' || a.when === 'down') &&
      !(a.normalOnly && record.modes.hard) &&
      a.check(record),
  ).map((a) => a.id);
}
