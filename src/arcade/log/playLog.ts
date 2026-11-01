/**
 * The play log's lines (docs/PLAY_LOG.md, l2): one per sim event, each with
 * the time, the run and the down it happened in, so a moment the user names
 * ("around 11:20", or a ⚑) can be read back. Pure: the sender
 * (playLogSender.ts) posts them.
 */
import { carrierOf } from '../sim/ai';
import type { ArcadeEvent, DriveKind, Phase, RunState } from '../sim/types';

/** What's the same for every line from one page: set once by the game. */
export interface LogMeta {
  /** One per page load. */
  readonly session: string;
  /** The commit the game was built from. */
  readonly build: string;
  /** The link's query string, e.g. `aim=2&hard=1&snag=1`. */
  readonly flags: string;
}

export interface PlayLogLine {
  /** UTC, ISO 8601. */
  readonly at: string;
  /** A sim event, a ⚑, or the page opening (a session's first line). */
  readonly kind: 'event' | 'flag' | 'start';
  readonly session: string;
  readonly seed: number;
  readonly build: string;
  readonly flags: string;
  readonly practice: boolean;
  /** The down as it was played. */
  readonly drive: { readonly area: number; readonly index: number; readonly kind: DriveKind };
  readonly down: number;
  readonly los: number;
  readonly firstDown: number;
  readonly play: string | null;
  readonly phase: Phase;
  /** Where the ball is, and the carrier's spot, just after the event. */
  readonly ball: string;
  readonly carrier: { readonly id: number; readonly x: number; readonly y: number } | null;
  readonly event?: ArcadeEvent;
  /**
   * On a down's end: where the line of scrimmage moved to. Not the next down:
   * that is settled after the pause (nextDown), and the next down's own lines carry it.
   */
  readonly next?: { readonly los: number };
  /** Lines the page had to drop before this one (its queue was full). */
  readonly dropped?: number;
}

/** The lines for one step's (or one action's) events: the down from `prev`, the spots from `next`. */
export function eventLines(
  prev: RunState,
  next: RunState,
  events: readonly ArcadeEvent[],
  meta: LogMeta,
  now: number,
): PlayLogLine[] {
  return events.map((e) => ({
    ...context(prev, next, meta, now, 'event'),
    event: rounded(e),
    ...(e.type === 'downEnded' ? { next: { los: round(next.drive.los) } } : {}),
  }));
}

/** The page opened: a session's first line, sent at once so ⚑ learns early if the log is there. */
export function startLine(state: RunState, meta: LogMeta, now: number): PlayLogLine {
  return context(state, state, meta, now, 'start');
}

/** ⚑ (l4): a line marking this moment, with no event. */
export function flagLine(state: RunState, meta: LogMeta, now: number): PlayLogLine {
  return context(state, state, meta, now, 'flag');
}

function context(
  prev: RunState,
  next: RunState,
  meta: LogMeta,
  now: number,
  kind: PlayLogLine['kind'],
): PlayLogLine {
  const { drive } = prev;
  const carrier = carrierOf(next);
  return {
    at: new Date(now).toISOString(),
    kind,
    session: meta.session,
    seed: prev.seed,
    build: meta.build,
    flags: meta.flags,
    practice: prev.practice,
    drive: { area: drive.area, index: drive.index, kind: drive.kind },
    down: drive.down,
    los: round(drive.los),
    firstDown: round(drive.firstDown),
    play: prev.playbook[prev.play.index]?.name ?? null,
    phase: next.phase,
    ball: next.field.ball.at,
    carrier: carrier ? { id: carrier.id, x: round(carrier.pos.x), y: round(carrier.pos.y) } : null,
  };
}

const round = (n: number): number => Math.round(n * 100) / 100;

/** Every number in it to hundredths (a yard's or a second's), as the log needs no more. */
function rounded<T>(x: T): T {
  if (typeof x === 'number') return round(x) as T;
  if (Array.isArray(x)) return x.map(rounded) as T;
  if (x && typeof x === 'object') {
    return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, rounded(v)])) as T;
  }
  return x;
}
