import { describe, expect, it } from 'vitest';
import { createRun, dispatch } from '../../src/arcade/sim/run';
import { canThrow, step, stepInPlace } from '../../src/arcade/sim/step';
import type { ArcadeEvent, RunState, StepInput } from '../../src/arcade/sim/types';

/**
 * Stepping in place (docs/PLAN.md, "Faster balance runs", change 1): the
 * balance tool steps one run without copying it every step; the game keeps
 * step(), a copy and then the same work.
 */

/** Taps for whatever is up: throws now and then, taps through Break it! and the catch tests. */
function input(s: RunState): StepInput {
  if (s.phase === 'play') return canThrow(s) && s.step % 50 === 0 ? { throw: true } : {};
  if (s.phase === 'breakit') return s.step % 7 === 0 ? { breakTap: true } : {};
  if (s.phase === 'snag') return s.step % 20 === 0 ? { snag: 0 } : {};
  if (s.phase === 'tip') return s.step % 20 === 0 ? { tip: true } : {};
  return {};
}

/** A seeded run played `n` times through, calling and hiking the cards in turn, stepping one way or the other. */
function play(seed: number, n: number, how: typeof step): { s: RunState; events: ArcadeEvent[] } {
  let s = createRun(seed);
  const events: ArcadeEvent[] = [];
  for (let i = 0; i < n && s.phase !== 'over' && s.phase !== 'won'; i++) {
    if (s.phase === 'draft') {
      s = dispatch(s, { type: 'skipDraft' }).state;
    } else if (s.phase === 'setup') {
      s = dispatch(dispatch(s, { type: 'call', hand: i % 3 }).state, { type: 'hike' }).state;
    } else {
      const r = how(s, input(s));
      events.push(...r.events);
      s = r.state;
    }
  }
  return { s, events };
}

describe('stepping in place', () => {
  it('plays a seeded run to the same state, with the same events in the same order, as step()', () => {
    for (const seed of [1, 2, 3]) {
      const copied = play(seed, 4000, step);
      const inPlace = play(seed, 4000, stepInPlace);
      expect(copied.events.filter((e) => e.type === 'downEnded').length).toBeGreaterThanOrEqual(3);
      expect(inPlace.events).toEqual(copied.events);
      expect(inPlace.s).toEqual(copied.s);
    }
  });

  it('changes the state it’s handed, and hands the same one back', () => {
    const s = play(1, 40, step).s;
    const before = s.step;
    expect(stepInPlace(s).state).toBe(s);
    expect(s.step).toBe(before + 1);
  });

  it('step() still leaves the state it’s given alone', () => {
    const s = play(2, 40, step).s;
    expect(s.phase).toBe('play');
    const seen = structuredClone(s);
    const r = step(s, { throw: true });
    expect(r.state).not.toBe(s);
    expect(s).toEqual(seen);
  });
});
