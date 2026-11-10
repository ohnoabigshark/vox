import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ORIGINAL_GAME } from './helpers';
import { createRun, dispatch, startingRoster } from '../../src/arcade/sim/run';
import { canThrow, step } from '../../src/arcade/sim/step';
import type { ArcadeEvent, RunState } from '../../src/arcade/sim/types';

/**
 * Statuses' test 1 (docs/STATUSES.md, s2): moving the lightning bolt onto
 * the Fast status changes nothing in play. Seeded runs, driven the same
 * way every time, give the same events and the same positions, step for
 * step, as `main` did before statuses (the digests below were taken there).
 * The status events themselves are new, so they're left out. Since
 * field-taffy, a run that reaches a taffy stretch plays differently, as it
 * should; see EXPECTED.
 */

/** The events the bolt's move must leave alone: all but the new status reports. */
const STATUS_EVENTS: readonly ArcadeEvent['type'][] = ['statusGained', 'statusEnded'];

/** A run driven by its seed alone, as the long-runs invariant test drives one; its digest and the bolts taken. */
function digestOf(
  seed: number,
  steps: number,
): { digest: string; bolts: { team: number; defense: number } } {
  const hash = createHash('sha256');
  const bolts = { team: 0, defense: 0 };
  let s: RunState = createRun(seed, startingRoster(), 0, { ...ORIGINAL_GAME, hard: true });
  const note = (events: readonly ArcadeEvent[]): void => {
    for (const e of events) {
      if (STATUS_EVENTS.includes(e.type)) continue;
      if (e.type === 'pickupTaken' && e.kind === 'bolt') bolts[e.side] += 1;
      hash.update(JSON.stringify(e));
    }
  };
  for (let i = 0; i < steps && s.phase !== 'over' && s.phase !== 'won'; i++) {
    if (s.phase === 'setup') {
      const called = dispatch(s, { type: 'call', hand: i % 3 });
      note(called.events);
      const hiked = dispatch(called.state, { type: 'hike' });
      note(hiked.events);
      s = hiked.state;
    }
    if (s.phase === 'draft') {
      const skipped = dispatch(s, { type: 'skipDraft' });
      note(skipped.events);
      s = skipped.state;
    }
    const input =
      s.phase === 'breakit'
        ? { breakTap: i % 7 === 0, ...(i % 11 === 0 ? { juke: 1 as const } : {}) }
        : canThrow(s) && i % 50 === 0
          ? { throw: true }
          : {};
    const result = step(s, input);
    note(result.events);
    s = result.state;
    for (const b of [...s.field.players, ...s.field.defenders]) {
      hash.update(`${b.id}:${b.pos.x},${b.pos.y};`);
    }
  }
  return { digest: hash.digest('hex').slice(0, 16), bolts };
}

describe('statuses: the bolt as Fast plays exactly as before', () => {
  it('1: seeded runs give the same events and positions, step for step, as main did', () => {
    const runs = [11, 12, 13, 14].map((seed) => digestOf(seed, 6000));
    expect(runs.map((r) => r.digest)).toEqual(EXPECTED);
    // The runs must take bolts, on both sides, or they prove nothing about the bolt.
    const total = runs.reduce(
      (t, r) => ({ team: t.team + r.bolts.team, defense: t.defense + r.bolts.defense }),
      { team: 0, defense: 0 },
    );
    expect(total.team).toBeGreaterThan(0);
    expect(total.defense).toBeGreaterThan(0);
  }, 120_000);
});

/**
 * Taken on main (adb458b) before statuses. Seed 14 re-pinned on
 * field-taffy (2026-11-07): its run reaches a stretch the seed gives the
 * taffy flood (and again when the taffy grew to 2.5 s and Slowed to 0.375,
 * and when it moved to 3 to 7 yards), and on field-wisps, where its generic
 * stretch draws the wisps (and again when they moved to 10 yards, then 6),
 * and on field-places, where the taffy and the wisps vary in place and size.
 * With generic events off (`genericShare: 0`), it gives
 * 06fe520adac8ca51 again, as main did: the generic events are the only change.
 * Seeds 12 and 14 re-pinned on gravestones (2026-11-10): the gravestone
 * reaches a yard where the slick reached ¾ (next-job map g1), which moves
 * where some lie and who trips. With its radius back at 0.75 and the old
 * names hashed, all four give main's digests again: the size is the only change.
 */
const EXPECTED: readonly string[] = [
  'bee0a1cd9e41aeda',
  '4a24c80f4c0afb0c',
  'f1489c668244d302',
  '83df61431d59efc9',
];
