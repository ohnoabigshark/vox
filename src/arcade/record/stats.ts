/**
 * A run's stats, read from its record (docs/STATS.md): the run's (s1), each
 * player's (s2), and the plays called (p7). Pure, and computed when wanted,
 * so a stat is defined here once and every screen and total reads it.
 */
import type { Grade } from '../sim/types';
import type { PlayResult, RunRecord, TapTestKind } from './types';

export type Grades = Record<Grade, number>;

export interface RunStats {
  readonly reached: RunRecord['reached'];
  readonly won: boolean;
  readonly downs: number;
  /** Net yards: every down's gain, sacks' losses too. */
  readonly yards: number;
  readonly firstDowns: number;
  readonly touchdowns: number;
  /** A pass is a play Jack threw (a sack isn't one); its yards are a completion's. */
  readonly passing: {
    readonly passes: number;
    readonly completions: number;
    readonly yards: number;
    readonly airYards: number;
    readonly longest: number;
  };
  readonly rushing: { readonly rushes: number; readonly yards: number; readonly longest: number };
  readonly contact: { readonly tacklesBroken: number; readonly afterContact: number };
  readonly against: {
    readonly sacks: number;
    readonly tacklesForLoss: number;
    readonly incompletes: number;
    readonly batted: number;
  };
  readonly pancakes: number;
  readonly tapTests: Record<TapTestKind, Grades>;
  readonly rest: {
    readonly pickups: number;
    readonly fieldEvents: number;
    readonly crowsShooed: number;
  };
}

export interface PlayerStats {
  /** Jack's: a player who isn't Jack never throws. */
  readonly passing: RunStats['passing'] & { readonly sacks: number };
  readonly catching: {
    readonly targets: number;
    readonly catches: number;
    readonly yards: number;
    readonly afterCatch: number;
    readonly longest: number;
  };
  readonly rushing: RunStats['rushing'];
  readonly contact: {
    readonly tacklesBroken: number;
    readonly afterContact: number;
    readonly tacklesForLoss: number;
  };
  readonly pancakes: number;
  readonly tapTests: Grades;
  readonly firstDowns: number;
  readonly touchdowns: number;
}

export interface PlaysStats {
  /** Each play called, by id: its calls and the yards they gained. */
  readonly byPlay: ReadonlyMap<string, { readonly calls: number; readonly yards: number }>;
  readonly mostUsed: string | null;
  readonly mostSuccessful: string | null;
}

export const noGrades = (): Grades => ({ great: 0, ok: 0, bad: 0 });

/** Completions a pass, or null with no passes. */
export const completionRate = (p: RunStats['passing']): number | null =>
  p.passes === 0 ? null : p.completions / p.passes;

/** A pass is a play Jack threw: not a sack, not a rush. */
const isPass = (d: PlayResult): boolean => d.kind === 'pass';
const completed = (d: PlayResult): boolean => isPass(d) && d.catcher !== null;
const isRush = (d: PlayResult): boolean => d.kind === 'rush';
const sum = (downs: readonly PlayResult[], f: (d: PlayResult) => number): number =>
  downs.reduce((n, d) => n + f(d), 0);
const most = (downs: readonly PlayResult[], f: (d: PlayResult) => number): number =>
  downs.reduce((n, d) => Math.max(n, f(d)), 0);

function passing(downs: readonly PlayResult[]): RunStats['passing'] {
  const caught = downs.filter(completed);
  return {
    passes: downs.filter(isPass).length,
    completions: caught.length,
    yards: sum(caught, (d) => d.gained),
    airYards: sum(caught, (d) => d.airYards ?? 0),
    longest: most(caught, (d) => d.gained),
  };
}

function rushing(downs: readonly PlayResult[]): RunStats['rushing'] {
  const rushes = downs.filter(isRush);
  return {
    rushes: rushes.length,
    yards: sum(rushes, (d) => d.gained),
    longest: most(rushes, (d) => d.gained),
  };
}

export function runStats(record: RunRecord): RunStats {
  const { downs } = record;
  const tapTests: Record<TapTestKind, Grades> = {
    bar: noGrades(),
    mash: noGrades(),
    juke: noGrades(),
    snag: noGrades(),
    tip: noGrades(),
  };
  for (const t of downs.flatMap((d) => d.tapTests)) tapTests[t.test][t.grade]++;
  return {
    reached: record.reached,
    won: record.end === 'won',
    downs: downs.length,
    yards: sum(downs, (d) => d.gained),
    firstDowns: downs.filter((d) => d.outcome === 'firstDown').length,
    touchdowns: downs.filter((d) => d.outcome === 'touchdown').length,
    passing: passing(downs),
    rushing: rushing(downs),
    contact: {
      tacklesBroken: sum(downs, (d) => d.tacklesBroken),
      afterContact: sum(downs, (d) => d.afterContact ?? 0),
    },
    against: {
      sacks: downs.filter((d) => d.kind === 'sack').length,
      tacklesForLoss: downs.filter((d) => d.tackleForLoss).length,
      incompletes: downs.filter((d) => d.outcome === 'incomplete').length,
      batted: downs.filter((d) => d.outcome === 'batted').length,
    },
    pancakes: sum(downs, (d) => d.pancakes.length),
    tapTests,
    rest: {
      pickups: sum(downs, (d) => d.pickups.length),
      fieldEvents: sum(downs, (d) => d.fieldEvents.length),
      crowsShooed: sum(downs, (d) => d.crowsShooed),
    },
  };
}

/** Each player who did anything this run, by record id; counted for whoever did it, whatever its position (s2). */
export function playerStats(record: RunRecord): ReadonlyMap<number, PlayerStats> {
  const { downs } = record;
  const ids = new Set<number>();
  for (const d of downs) {
    for (const id of [d.passer, d.target, d.catcher, d.carrier, ...d.pancakes]) {
      if (id !== null) ids.add(id);
    }
    for (const t of d.tapTests) ids.add(t.player);
  }
  const stats = new Map<number, PlayerStats>();
  for (const id of ids) {
    const thrown = downs.filter((d) => d.passer === id);
    const caught = downs.filter((d) => d.catcher === id);
    const carried = downs.filter((d) => d.carrier === id);
    const tapTests = noGrades();
    for (const t of downs.flatMap((d) => d.tapTests)) if (t.player === id) tapTests[t.grade]++;
    stats.set(id, {
      passing: { ...passing(thrown), sacks: thrown.filter((d) => d.kind === 'sack').length },
      catching: {
        targets: downs.filter((d) => isPass(d) && d.target === id).length,
        catches: caught.length,
        yards: sum(caught, (d) => d.gained),
        afterCatch: sum(caught, (d) => d.afterCatch ?? 0),
        longest: most(caught, (d) => d.gained),
      },
      rushing: rushing(carried),
      contact: {
        tacklesBroken: sum(carried, (d) => d.tacklesBroken),
        afterContact: sum(carried, (d) => d.afterContact ?? 0),
        tacklesForLoss: carried.filter((d) => d.tackleForLoss).length,
      },
      pancakes: sum(downs, (d) => d.pancakes.filter((p) => p === id).length),
      tapTests,
      firstDowns: carried.filter((d) => d.outcome === 'firstDown').length,
      touchdowns: carried.filter((d) => d.outcome === 'touchdown').length,
    });
  }
  return stats;
}

/** The minimum calls for the most successful play (p7). */
export const MOST_SUCCESSFUL_CALLS = 3;

/** Each play called, the most used, and the most successful: most yards a call, from 3 calls, a tie to the one called more (p7). */
export function playsStats(record: RunRecord): PlaysStats {
  const byPlay = new Map<string, { calls: number; yards: number }>();
  for (const d of record.downs) {
    if (d.play === null) continue;
    const p = byPlay.get(d.play) ?? { calls: 0, yards: 0 };
    byPlay.set(d.play, { calls: p.calls + 1, yards: p.yards + d.gained });
  }
  // Map order is the order first called, which settles any tie left.
  const plays = [...byPlay];
  const byCalls = [...plays].sort(([, a], [, b]) => b.calls - a.calls);
  const eligible = plays.filter(([, p]) => p.calls >= MOST_SUCCESSFUL_CALLS);
  const bySuccess = [...eligible].sort(
    ([, a], [, b]) => b.yards / b.calls - a.yards / a.calls || b.calls - a.calls,
  );
  return {
    byPlay,
    mostUsed: byCalls[0]?.[0] ?? null,
    mostSuccessful: bySuccess[0]?.[0] ?? null,
  };
}
