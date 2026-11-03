/**
 * All-time stats (docs/STATS.md, s3), one set for hard mode and one for
 * normal: runs played, won and the furthest reached; the totals of every
 * run's stats; and the records, each kept with the run it came from. A
 * run is added once, as it closes, from its full record (store.ts).
 */
import { playerStats, runStats, type PlayerStats, type RunStats } from './stats';
import { JACK, type RunRecord } from './types';

/** What every run keeps, past the last 20 too (k3): how far, its stats, its team, and when. */
export interface RunSummary {
  readonly id: string;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly end: RunRecord['end'];
  readonly modes: RunRecord['modes'];
  readonly reached: RunRecord['reached'];
  readonly stats: RunStats;
  readonly team: RunRecord['team'];
}

/** The run's stats added up: everything but how far it got and the longests (which are records). */
export interface Totals {
  readonly downs: number;
  readonly yards: number;
  readonly firstDowns: number;
  readonly touchdowns: number;
  readonly passing: Omit<RunStats['passing'], 'longest'>;
  readonly rushing: Omit<RunStats['rushing'], 'longest'>;
  readonly contact: RunStats['contact'];
  readonly against: RunStats['against'];
  readonly pancakes: number;
  readonly tapTests: RunStats['tapTests'];
  readonly rest: RunStats['rest'];
}

/** A record, with the run it came from and when that run ended. */
export interface Best {
  readonly value: number;
  readonly run: string;
  readonly at: string;
}

/** A single player's best run: the record, and the player's name. */
export interface PlayerBest extends Best {
  readonly name: string;
}

export interface Records {
  readonly longestPass: Best | null;
  readonly longestRush: Best | null;
  readonly mostYards: Best | null;
  readonly mostFirstDowns: Best | null;
  readonly mostTacklesBroken: Best | null;
  /** Completions a pass, in a run of at least 10 passes. */
  readonly bestCompletion: Best | null;
  readonly bestReceiving: PlayerBest | null;
  readonly bestRushing: PlayerBest | null;
  readonly bestPancakes: PlayerBest | null;
}

export interface AllTime {
  readonly runs: number;
  readonly won: number;
  readonly furthest: RunRecord['reached'] | null;
  readonly totals: Totals;
  readonly records: Records;
}

export function summaryOf(record: RunRecord): RunSummary {
  return {
    id: record.id,
    startedAt: record.startedAt,
    endedAt: record.endedAt,
    end: record.end,
    modes: record.modes,
    reached: record.reached,
    stats: runStats(record),
    team: record.team,
  };
}

const grades = () => ({ great: 0, ok: 0, bad: 0 });

export function emptyAllTime(): AllTime {
  return {
    runs: 0,
    won: 0,
    furthest: null,
    totals: {
      downs: 0,
      yards: 0,
      firstDowns: 0,
      touchdowns: 0,
      passing: { passes: 0, completions: 0, yards: 0, airYards: 0 },
      rushing: { rushes: 0, yards: 0 },
      contact: { tacklesBroken: 0, afterContact: 0 },
      against: { sacks: 0, lossTackles: 0, incompletes: 0, batted: 0 },
      pancakes: 0,
      tapTests: { bar: grades(), mash: grades(), juke: grades(), snag: grades(), tip: grades() },
      rest: { pickups: 0, fieldEvents: 0, crowsShooed: 0 },
    },
    records: {
      longestPass: null,
      longestRush: null,
      mostYards: null,
      mostFirstDowns: null,
      mostTacklesBroken: null,
      bestCompletion: null,
      bestReceiving: null,
      bestRushing: null,
      bestPancakes: null,
    },
  };
}

/** The totals' numbers added up, key by key: `b` has every key `a` has. */
function added<T>(a: T, b: T): T {
  if (typeof a === 'number') return (a + (b as number)) as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(a as Record<string, unknown>)) {
    out[k] = added(v, (b as Record<string, unknown>)[k]);
  }
  return out as T;
}

/** The run's stats as totals: the longests left out. */
function totalsOf(s: RunStats): Totals {
  const { passes, completions, yards, airYards } = s.passing;
  return {
    downs: s.downs,
    yards: s.yards,
    firstDowns: s.firstDowns,
    touchdowns: s.touchdowns,
    passing: { passes, completions, yards, airYards },
    rushing: { rushes: s.rushing.rushes, yards: s.rushing.yards },
    contact: s.contact,
    against: s.against,
    pancakes: s.pancakes,
    tapTests: s.tapTests,
    rest: s.rest,
  };
}

/** The better of the record so far and this run's value: only a value past it, and above 0, beats it. */
function better<B extends Best>(was: B | null, now: B): B | null {
  if (now.value <= 0) return was;
  return was === null || now.value > was.value ? now : was;
}

/** The completion rate's minimum passes (s3). */
export const COMPLETION_PASSES = 10;

/** The run added: counted, its stats added up, and any record it broke kept with it. */
export function addRun(all: AllTime, record: RunRecord): AllTime {
  const s = runStats(record);
  const at = record.endedAt ?? record.startedAt;
  const best = (value: number): Best => ({ value, run: record.id, at });
  const players = playerStats(record);
  const bestPlayer = (
    was: PlayerBest | null,
    of: (p: PlayerStats) => number,
  ): PlayerBest | null => {
    let out = was;
    for (const [id, p] of players) {
      if (id === JACK) continue;
      const name = record.team.find((t) => t.id === id)?.name ?? '';
      out = better(out, { ...best(of(p)), name });
    }
    return out;
  };
  const r = all.records;
  return {
    runs: all.runs + 1,
    won: all.won + (record.end === 'won' ? 1 : 0),
    furthest:
      all.furthest === null || record.reached.seriesNumber > all.furthest.seriesNumber
        ? record.reached
        : all.furthest,
    totals: added(all.totals, totalsOf(s)),
    records: {
      longestPass: better(r.longestPass, best(s.passing.longest)),
      longestRush: better(r.longestRush, best(s.rushing.longest)),
      mostYards: better(r.mostYards, best(s.yards)),
      mostFirstDowns: better(r.mostFirstDowns, best(s.firstDowns)),
      mostTacklesBroken: better(r.mostTacklesBroken, best(s.contact.tacklesBroken)),
      bestCompletion:
        s.passing.passes >= COMPLETION_PASSES
          ? better(r.bestCompletion, best(s.passing.completions / s.passing.passes))
          : r.bestCompletion,
      bestReceiving: bestPlayer(r.bestReceiving, (p) => p.catching.yards),
      bestRushing: bestPlayer(r.bestRushing, (p) => p.rushing.yards),
      bestPancakes: bestPlayer(r.bestPancakes, (p) => p.pancakes),
    },
  };
}
