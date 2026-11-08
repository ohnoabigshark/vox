import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { arcadeTuning, TIME_SCALE } from '../../src/arcade/content/tuning';
import { forceBreakKind } from '../../src/arcade/sim/step';
import type { RunState } from '../../src/arcade/sim/types';
import { v } from '../../src/arcade/sim/vec';
import { body, carry, ofType, playState, run, tapAt, untilGrabbed } from './helpers';

/**
 * B9 (docs/BUGS.md), forward progress map f1-f3 (2026-11-08): a drag ends
 * when the carrier reaches its yard, or once he's gone 1.5 s on screen
 * without gaining ground, and he's down where he stands. (f1 said 1.5 s
 * from the drag's start; an ordinary drag takes about 2 s on screen to make
 * its yards, so the clock counts only time not gaining ground.) Before, a carrier held up or
 * shoved back never reached the yard, nobody else could grab him, and the
 * down never ended (three flagged downs, docs/play-logs/).
 */

/** How long a drag may go without gaining ground, in sim seconds (1.5 s on screen). */
const LIMIT = 1.5 * TIME_SCALE;

/** A Runner carrying on (0, 2), grabbed by a Cover from (0, 4), and a close tap: a drag. */
function dragging(): RunState {
  const s = carry(
    playState(
      [{ role: 'runner', pos: v(0, 2), stats: { hustle: 60, heft: 50 } }],
      [{ kind: 'cover', pos: v(0, 4), stats: { heft: 50 } }],
    ),
    2,
  );
  s.field.lane = 0;
  const g = untilGrabbed(s).state;
  const t = g.tackle;
  if (t?.kind !== 'bar') throw new Error('not a bar');
  const close = t.sweet.from > t.near ? t.sweet.from - t.near / 2 : t.sweet.to + t.near / 2;
  const r = tapAt(g, close);
  expect(ofType(r.events, 'dragged')).toHaveLength(1);
  if (!r.state.field.drag) throw new Error('no drag');
  return r.state;
}

/** Steps until the down is over (or the limit), counting them. */
function untilDown(s: RunState, seconds: number) {
  let steps = 0;
  let state = s;
  const tackled = [];
  while (steps < seconds * arcadeTuning.stepsPerSecond && state.phase === 'play') {
    const r = run(state, 1 / arcadeTuning.stepsPerSecond);
    state = r.state;
    tackled.push(...ofType(r.events, 'tackled'));
    steps++;
  }
  return { state, tackled, seconds: steps / arcadeTuning.stepsPerSecond };
}

describe('forward progress: a drag ends on a timer (B9)', () => {
  beforeEach(() => forceBreakKind('bar'));
  afterEach(() => forceBreakKind(undefined));

  it('a drag whose carrier is held still ends in a tackle after 1.5 s on screen, not before', () => {
    const s = dragging();
    // Held up: he can't move at all, so he never reaches the drag's yard.
    // (speed is fixed for a down; a test may still stop him dead.)
    Object.assign(body(s, 2), { speed: 0, vel: v(0, 0) });
    const at = body(s, 2).pos.y;
    const end = untilDown(s, 10);
    expect(end.tackled).toHaveLength(1);
    expect(end.seconds).toBeGreaterThan(LIMIT - 0.05);
    expect(end.seconds).toBeLessThan(LIMIT + 0.05);
    // Down where he stands.
    expect(end.state.series.los).toBeCloseTo(at, 1);
  });

  it('a drag whose carrier is shoved back is down where he stands when the time runs out: a little back, not 20 yards', () => {
    const s = dragging();
    const grabbedAt = body(s, 2).pos.y;
    // Three heavy defenders who can't grab him (he's in a drag) pile in from ahead and shove him back.
    for (const [i, x] of [-0.6, 0, 0.6].entries()) {
      const d = s.field.defenders[0]!;
      s.field.defenders.push({
        ...structuredClone(d),
        id: 200 + i,
        latch: null,
        pos: v(x, grabbedAt + 1.2),
        mass: d.mass * 3,
      });
    }
    const end = untilDown(s, 10);
    expect(end.tackled).toHaveLength(1);
    // The limit, plus the moment he still gains before the pile turns him back.
    expect(end.seconds).toBeLessThan(LIMIT + 0.3);
    const spot = end.state.series.los;
    expect(spot).toBeLessThan(grabbedAt + 0.5);
    expect(spot).toBeGreaterThan(grabbedAt - 3);
  });

  it('a drag that keeps gaining ground goes down at its yard, as before, however long it takes', () => {
    const s = dragging();
    const to = s.field.drag!.to;
    const end = untilDown(s, 10);
    expect(end.tackled).toHaveLength(1);
    // It takes longer than the limit, and isn't cut short: the clock runs only while it's stuck.
    expect(end.seconds).toBeGreaterThan(LIMIT);
    expect(end.state.series.los).toBeGreaterThanOrEqual(to - 0.05);
  });
});
