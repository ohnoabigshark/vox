/**
 * What the tap tests' controls show, read from the run: the Break it! panel,
 * the SNAG IT! box and SHOO!. The game and the test bench (docs/BENCH.md)
 * both draw from these, so the bench shows exactly what the game does.
 */
import { arcadeTuning, TIME_SCALE } from '../content/tuning';
import { breakMarker, countdown, jukeGrade, jukeShowing, mashLeft } from '../sim/breakit';
import { ringClosed } from '../sim/snag';
import type { RunState } from '../sim/types';
import type { BreakView, SnagView } from './controls';

/** What the Break it! panel shows right now, or null. */
export function breakView(state: RunState): BreakView | null {
  const t = state.tackle;
  if (!t || state.phase !== 'breakit') return null;
  // The countdown's seconds left, on screen (sim time runs slower than real time).
  const cd = countdown(state);
  const ready = cd === null ? null : ((1 - cd) * t.ready) / TIME_SCALE;
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

/** What the SNAG IT! box shows right now, or null. */
export function snagView(state: RunState): SnagView | null {
  const live = state.phase === 'snag' ? state.snag : null;
  // Just finished: the box stays a moment, so the last dot's pop or crack is seen.
  const done = state.snagDone;
  const t =
    live ?? (done && state.time - done.endedAt < arcadeTuning.snag.linger ? done.snag : null);
  if (!t) return null;
  return {
    id: t.startedAt,
    calling: state.time < (t.dots[0]?.appearsAt ?? 0),
    dots: t.dots.map((d) => ({ x: d.x, y: d.y, ring: ringClosed(state, d), result: d.result })),
  };
}

/** Whether SHOO! shows: the King's crows are on the ball's holder, in live play. */
export function shooShowing(state: RunState): boolean {
  return state.phase === 'play' && !!state.field.crows?.some((f) => f.phase === 'shoo');
}
