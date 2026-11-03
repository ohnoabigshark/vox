/**
 * The achievements (docs/STATS.md, h1–h3), each defined once here as a
 * check over a run's record. A `down` one can be earned mid-run (it pops
 * in the pause after the down that earned it); a `run` one is about the
 * whole run (it shows on the run's card). A drive is an area's march: its
 * four series (series 1–4 are the first drive, 5–8 the second).
 */
import { SERIES_PER_AREA } from '../sim/props';
import type { Saved } from './store';
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

/** An achievement earned on this phone (h1): the run that first earned it and when, and whether hard mode has. */
export interface Earned {
  readonly run: string;
  readonly at: string;
  readonly hard: boolean;
}

export type EarnedSet = Readonly<Partial<Record<AchievementId, Earned>>>;

/** What `record` adds to what's earned: each it earns, kept from the first run; earned in hard mode, the mark. */
export function earn(
  earned: EarnedSet,
  record: RunRecord,
  when: 'down' | 'end' = 'end',
): EarnedSet {
  return earnFrom(earned, record, earnedBy(record, when));
}

function earnFrom(earned: EarnedSet, record: RunRecord, ids: readonly AchievementId[]): EarnedSet {
  const out: Partial<Record<AchievementId, Earned>> = { ...earned };
  const hard = record.modes.hard;
  for (const id of ids) {
    const had = out[id];
    if (!had) out[id] = { run: record.id, at: record.endedAt ?? record.startedAt, hard };
    else if (hard && !had.hard) out[id] = { ...had, hard: true };
  }
  return out;
}

/**
 * What a run newly earned: achievements new to this phone, or newly marked
 * hard. As it ends, for its card; mid-run (`down`), for the pop.
 */
export function newlyEarned(
  earned: EarnedSet,
  record: RunRecord,
  when: 'down' | 'end' = 'end',
): AchievementId[] {
  const after = earn(earned, record, when);
  return ACHIEVEMENTS.map((a) => a.id).filter((id) => after[id] !== earned[id]);
}

/**
 * Achievements not yet looked for in the saved runs (new in this build),
 * looked for once, oldest run first (h3). Only runs that kept their plays
 * (the last 20) can earn one. The same `saved` back if there's nothing new.
 */
export function catchUp(saved: Saved): Saved {
  const fresh = ACHIEVEMENTS.map((a) => a.id).filter((id) => !saved.checked.includes(id));
  if (fresh.length === 0) return saved;
  let achievements = saved.achievements;
  for (const { record } of [...saved.runs].reverse()) {
    if (!record) continue;
    achievements = earnFrom(
      achievements,
      record,
      earnedBy(record, 'end').filter((id) => fresh.includes(id)),
    );
  }
  return { ...saved, achievements, checked: ACHIEVEMENTS.map((a) => a.id) };
}
