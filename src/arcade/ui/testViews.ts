/**
 * What the tap tests' controls show, read from the run: the Break it! panel,
 * the SNAG IT! box, the tip drill's box and SHOO!. The game and the test bench (docs/BENCH.md)
 * both draw from these, so the bench shows exactly what the game does.
 */
import { arcadeTuning, TIME_SCALE } from '../content/tuning';
import { breakMarker, countdownLeft, jukeGrade, jukeShowing, mashLeft } from '../sim/breakit';
import { ringClosed, snagCountdownLeft } from '../sim/snag';
import { popInAir, tipCountdownLeft } from '../sim/tip';
import type { RunState, TipDrill } from '../sim/types';
import type { BreakView, SnagView, TipView } from './controls';

/** Sim seconds as seconds on screen (sim time runs slower than real time), for the countdowns. */
const onScreen = (sim: number | null): number | null => (sim === null ? null : sim / TIME_SCALE);

/** What the Break it! panel shows right now, or null. */
export function breakView(state: RunState): BreakView | null {
  const t = state.tackle;
  if (!t || state.phase !== 'breakit') return null;
  const ready = onScreen(countdownLeft(state));
  switch (t.kind) {
    case 'bar':
      return {
        kind: 'bar',
        ready,
        sweet: t.sweet,
        near: t.near,
        marker: breakMarker(state) ?? 0,
        dir: t.dir,
      };
    case 'mash':
      return { kind: 'mash', ready, fill: t.fill, left: mashLeft(state) ?? 0 };
    case 'juke':
      return {
        kind: 'juke',
        ready,
        side: jukeShowing(state) ? t.side : null,
        grade: jukeGrade(state),
      };
  }
}

/**
 * A catch test's box shows the test on now, or the one just finished for a
 * moment (`catchTests.linger`), so its last dot's or pop's result is seen.
 */
function onOrLingering<T>(
  state: RunState,
  live: T | null,
  done: T | undefined,
  endedAt: number | undefined,
): T | null {
  if (live) return live;
  const lingers = endedAt !== undefined && state.time - endedAt < arcadeTuning.catchTests.linger;
  return lingers && done !== undefined ? done : null;
}

/** What the SNAG IT! box shows right now, or null. */
export function snagView(state: RunState): SnagView | null {
  const done = state.snagDone;
  const t = onOrLingering(
    state,
    state.phase === 'snag' ? state.snag : null,
    done?.snag,
    done?.endedAt,
  );
  if (!t) return null;
  return {
    id: t.startedAt,
    ready: onScreen(snagCountdownLeft(state)),
    dots: t.dots.map((d) => ({ x: d.x, y: d.y, ring: ringClosed(state, d), result: d.result })),
  };
}

/** How long a pop's result flashes on the hands (sim seconds). */
const FLASH = 0.2;
/** Where a dropped ball lies, under the hands (as the ball's height in `TipView`). */
const DROPPED = -0.35;

/** What the tip drill's box shows right now, or null (docs/TIP.md). */
export function tipView(state: RunState): TipView | null {
  const live = state.phase === 'tip' ? state.tip : null;
  const done = state.tipDone;
  const t = onOrLingering(state, live, done?.tip, done?.endedAt);
  if (!t) return null;
  const last = t.results[t.results.length - 1] ?? null;
  const ball = last === 'drop' ? DROPPED : live ? ballHeight(t, state.time) : 0;
  return {
    id: t.startedAt,
    ready: onScreen(tipCountdownLeft(state)),
    ball,
    shadow: Math.max(0, Math.min(1, 1 - Math.abs(ball))),
    pips: t.pops.map((_, i) => t.results[i] ?? null),
    flash: last !== null && state.time - t.poppedAt < FLASH ? last : null,
  };
}

/**
 * The ball's height above the hands at `time`, as a share of the first
 * pop's: up and back down in a parabola over its time in the air, so a
 * shorter pop goes lower (by the square of its time); on the hands before
 * it leaves them, and under them if it's late.
 */
function ballHeight(t: TipDrill, time: number): number {
  const air = popInAir(t);
  const first = t.pops[0];
  if (air === undefined || first === undefined || time <= t.poppedAt) return 0;
  const s = (time - t.poppedAt) / air;
  return Math.max(DROPPED, 4 * s * (1 - s) * (air / first) ** 2);
}

/** Whether SHOO! shows: the King's crows are on the ball's holder, in live play. */
export function shooShowing(state: RunState): boolean {
  return state.phase === 'play' && !!state.field.crows?.some((f) => f.phase === 'shoo');
}
