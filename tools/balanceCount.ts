/**
 * The balance tool's counts for long plays (docs/DIFFICULTY.md, "The long
 * field"): each down summed up as it ends, from the sim's events and the
 * states around them, for tools/arcade-balance.ts to report.
 */
import type {
  ArcadeEvent,
  BreakKind,
  DefenderKind,
  DownResult,
  RunState,
} from '../src/arcade/sim/types';

/**
 * What the counts read from the state a step started from, noted before the
 * step: the balance tool steps the run in place (`stepInPlace`), so after the
 * step the state it started from is gone.
 */
export interface Before {
  readonly series: { readonly area: number; readonly stretch: number; readonly los: number };
  readonly time: number;
  readonly snappedAt: number;
  /** The Break it! under way, if any. */
  readonly tackleKind: BreakKind | null;
  /** Every defender on the field, so one who tackled and left in the step can still be named. */
  readonly defenders: readonly { readonly id: number; readonly kind: DefenderKind }[];
  /** Where each of your players stood (yards upfield). */
  readonly players: readonly { readonly id: number; readonly y: number }[];
}

export function noteBefore(state: RunState): Before {
  const { area, stretch, los } = state.series;
  return {
    series: { area, stretch, los },
    time: state.time,
    snappedAt: state.snappedAt,
    tackleKind: state.tackle?.kind ?? null,
    defenders: state.field.defenders.map(({ id, kind }) => ({ id, kind })),
    players: state.field.players.map(({ id, pos }) => ({ id, y: pos.y })),
  };
}

/** A down gaining this many yards or more is a long play. */
export const LONG_PLAY = 20;

/** What stopped a down's ball: a defender's tackle (by kind), or something else. */
export type Stop = DefenderKind | 'sack' | 'outOfBounds' | 'event' | 'slipped' | 'crows';

export interface DownSummary {
  /** A handoff that was never thrown is a rush (CONTEXT.md); everything else a pass. */
  readonly kind: 'rush' | 'pass';
  readonly area: number;
  /** The stretch of the down's line of scrimmage. */
  readonly stretch: number;
  readonly result: DownResult;
  readonly gained: number;
  /** Null when nothing stopped it: a touchdown, an incompletion, or a pass batted down. */
  readonly stoppedBy: Stop | null;
  /** Yards the carrier ran after the last defender in front of them was passed; null if never clear. */
  readonly pastLast: number | null;
}

export const isLong = (d: DownSummary): boolean => d.gained >= LONG_PLAY;

/** Sums up each down as it's played: feed it every step's events with what was noted before it and the state after. */
export class DownWatch {
  readonly downs: DownSummary[] = [];
  private handedOff = false;
  private thrown = false;
  private stoppedBy: Stop | null = null;
  private clearAt: number | null = null;

  step(before: Before, after: RunState, events: readonly ArcadeEvent[]): void {
    // Where the carrier stands after this step, before a down that ends in it is summed up and forgotten.
    this.clearAt ??= clearOf(after);
    for (const e of events) this.event(before, after, e);
  }

  private event(before: Before, after: RunState, e: ArcadeEvent): void {
    switch (e.type) {
      case 'handoff':
        this.handedOff = true;
        return;
      case 'thrown':
        this.thrown = true;
        return;
      case 'tackled': {
        const by = [...before.defenders, ...after.field.defenders].find((d) => d.id === e.by);
        this.stoppedBy = by?.kind ?? null;
        return;
      }
      case 'sacked':
        this.stoppedBy = 'sack';
        return;
      case 'outOfBounds':
        this.stoppedBy = 'outOfBounds';
        return;
      case 'eventTackled':
        this.stoppedBy = 'event';
        return;
      case 'slipped':
        this.stoppedBy = 'slipped';
        return;
      case 'crowsStruck':
        this.stoppedBy = 'crows';
        return;
      case 'downEnded': {
        const { area, stretch, los } = before.series;
        this.downs.push({
          kind: this.handedOff && !this.thrown ? 'rush' : 'pass',
          area,
          stretch,
          result: e.result,
          gained: e.gained,
          stoppedBy: this.stoppedBy,
          pastLast: this.clearAt === null ? null : los + e.gained - this.clearAt,
        });
        this.handedOff = false;
        this.thrown = false;
        this.stoppedBy = null;
        this.clearAt = null;
        return;
      }
      default:
        return;
    }
  }
}

/**
 * Where the ball's carrier is, if they have no defender in front of them, while
 * the ball is in play: after a down, its carrier stays on the field until the
 * next lines up, and must not count toward it.
 */
function clearOf(state: RunState): number | null {
  const ball = state.field.ball;
  if (state.phase !== 'play' || ball.at !== 'carried') return null;
  const carrier = state.field.players.find((p) => p.id === ball.by);
  if (!carrier) return null;
  return state.field.defenders.some((d) => d.pos.y > carrier.pos.y) ? null : carrier.pos.y;
}

/**
 * Draft picks (TRICK OR TREAT!; difficulty map n1): how many a run has taken
 * when it first snaps the ball in each area, among the runs that get there.
 * A defense that stops long plays means more series won, and so more picks,
 * before the later areas. Feed it every step's events, then `endRun`.
 */
export class PickWatch {
  /** For each area, one count a run that reached it: the picks it had taken by its first snap there. */
  readonly onEntering = new Map<number, number[]>();
  private taken = 0;
  private reached = -1;

  /** `before` is noted from the state the step started from (its series is the one being drafted for or snapped). */
  step(before: Before, events: readonly ArcadeEvent[]): void {
    const { area } = before.series;
    for (const e of events) {
      if (e.type === 'perk') this.taken++;
      if (e.type === 'snapped' && area > this.reached) {
        this.reached = area;
        this.onEntering.set(area, [...(this.onEntering.get(area) ?? []), this.taken]);
      }
    }
  }

  endRun(): void {
    this.taken = 0;
    this.reached = -1;
  }
}

/** Bolts taken by each side (the mischief bolt, difficulty map b4): feed it every step's events. */
export class BoltWatch {
  readonly bySide = { team: 0, defense: 0 };

  step(events: readonly ArcadeEvent[]): void {
    for (const e of events) {
      if (e.type === 'pickupTaken' && e.kind === 'bolt') this.bySide[e.side]++;
    }
  }
}

/** How many downs each thing stopped. */
export function stops(downs: readonly DownSummary[]): Map<Stop, number> {
  return countBy(downs, (d) => d.stoppedBy);
}

/** How many downs came from each stretch. */
export function byStretch(downs: readonly DownSummary[]): Map<number, number> {
  return countBy(downs, (d) => d.stretch);
}

function countBy<K>(
  downs: readonly DownSummary[],
  key: (d: DownSummary) => K | null,
): Map<K, number> {
  const m = new Map<K, number>();
  for (const d of downs) {
    const k = key(d);
    if (k !== null) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

/** Series won a run, spread: the worst tenth, the median, the top tenth and the best. */
export function seriesSpread(perRun: readonly number[]): {
  p10: number;
  median: number;
  p90: number;
  best: number;
} {
  const sorted = [...perRun].sort((a, b) => a - b);
  const at = (q: number): number => quantile(sorted, q);
  return { p10: at(0.1), median: at(0.5), p90: at(0.9), best: at(1) };
}

/** The value a share `q` of the way up numbers sorted low to high (0 when there are none). */
export function quantile(sorted: readonly number[], q: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
}
