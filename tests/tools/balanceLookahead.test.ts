import { describe, expect, it } from 'vitest';
import { ORIGINAL_GAME } from '../arcade/helpers';
import { createRun } from '../../src/arcade/sim/run';
import { canThrow, step } from '../../src/arcade/sim/step';
import type { RunState } from '../../src/arcade/sim/types';
import { predictsCatch, wantedDepth } from '../../tools/balanceLookahead';
import { betweenDowns } from '../arcade/helpers';

/**
 * The passing bot's lookahead (tools/arcade-balance.ts): "if I threw now,
 * would it be caught deep enough?", played forward in a copy. Since it steps
 * that copy in place (docs/PLAN.md, "Faster balance runs", change 1), it must
 * answer as the copy-every-step version did and leave the real run alone.
 */

/**
 * The lookahead as it was before stepping in place: a copy of the run, then
 * step() up to 120 times. A characterization of the change: when the
 * lookahead itself is meant to change (its horizon, the depth it wants),
 * delete this test rather than keep the two in step.
 */
function asItWas(state: RunState, left: number): boolean {
  let s = structuredClone(state);
  for (let i = 0; i < 120; i++) {
    const r = step(s, i === 0 ? { throw: true } : {});
    s = r.state;
    for (const e of r.events) {
      if (e.type === 'caught' || e.type === 'snagStarted' || e.type === 'tipStarted') {
        const id = e.type === 'caught' ? e.id : e.receiver;
        const by = s.field.players.find((p) => p.id === id);
        return (by?.pos.y ?? -Infinity) >= wantedDepth(state, left);
      }
      if (e.type === 'batted' || e.type === 'incomplete' || e.type === 'downEnded') return false;
    }
  }
  return false;
}

/** Moments in the pocket from a few seeded runs, every 5th step the QB could throw. */
function pocketMoments(): RunState[] {
  const moments: RunState[] = [];
  for (const seed of [1, 2, 3]) {
    let s = createRun(seed, undefined, 0, ORIGINAL_GAME);
    for (let i = 0; i < 3000 && moments.length < 40 * seed; i++) {
      if (s.phase === 'over' || s.phase === 'won') break;
      const next = betweenDowns(s, i);
      if (next) {
        s = next;
        continue;
      }
      if (canThrow(s) && s.step % 5 === 0) moments.push(structuredClone(s));
      // Never throws, so the pocket runs out (a sack) and the next down comes.
      s = step(s, s.phase === 'breakit' && s.step % 7 === 0 ? { breakTap: true } : {}).state;
    }
  }
  return moments;
}

describe('the lookahead', () => {
  const moments = pocketMoments();

  it('answers as it did when it copied every step', () => {
    const answers = moments.flatMap((s) =>
      [0.9, 0.3].map((left) => {
        expect(predictsCatch(s, left), `step ${s.step}, ${left} of the pocket left`).toBe(
          asItWas(s, left),
        );
        return predictsCatch(s, left);
      }),
    );
    // Both answers come up, or this proves little.
    expect(new Set(answers)).toEqual(new Set([true, false]));
  });

  it('leaves the real run as it was', () => {
    for (const s of moments.slice(0, 20)) {
      const seen = structuredClone(s);
      predictsCatch(s, 0.5);
      expect(s).toEqual(seen);
    }
  });
});
