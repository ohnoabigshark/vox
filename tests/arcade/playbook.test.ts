import { describe, expect, it } from 'vitest';
import type { Assignment, Play } from '../../src/arcade/content/plays';
import { playSlot } from '../../src/arcade/content/team';
import { createRun, dispatch, endDown, nextDown, setUpDrive } from '../../src/arcade/sim/run';
import type { ArcadeEvent, RunState } from '../../src/arcade/sim/types';

const block: Assignment = { kind: 'block' };
const route = (...to: [number, number][]): Assignment => ({
  kind: 'route',
  to: to.map(([x, y]) => ({ x, y })),
});
const slots = (): Assignment[] => [
  block,
  block,
  route([-2, 6]),
  route([2, 6]),
  route([0, 10]),
  route([0, 10]),
  route([0, 8]),
];
const passPlay = (id: string): Play => ({ id, name: id, slots: slots() });

/** The ids of the cards in the hand. */
const handIds = (s: RunState): (string | undefined)[] => s.hand.map((i) => s.playbook[i]?.id);

/** The hands of a run's first four downs, each down ending incomplete. */
const firstHands = (s: RunState): (string | undefined)[][] => {
  const hands = [handIds(s)];
  for (let d = 0; d < 3; d++) {
    endDown(s, 'incomplete', 0, []);
    nextDown(s, []);
    hands.push(handIds(s));
  }
  return hands;
};

describe("a run's playbook", () => {
  it('with the play pool, a seeded run deals exactly what it did before playbooks', () => {
    // Recorded from the game before runs carried a playbook (2026-10-29).
    expect(firstHands(createRun(1))).toEqual([
      ['slants', 'deepShot', 'sweep'],
      ['deepShot', 'sweep', 'curlFlat'],
      ['deepShot', 'slants', 'sweep'],
      ['slants', 'dive', 'sweep'],
    ]);
    expect(firstHands(createRun(7))).toEqual([
      ['curlFlat', 'dive', 'sweep'],
      ['curlFlat', 'dive', 'sweep'],
      ['curlFlat', 'sweep', 'dive'],
      ['curlFlat', 'deepShot', 'dive'],
    ]);
  });

  it('deals only from its own playbook', () => {
    const s = createRun(3, undefined, 0, { playbook: [passPlay('a'), passPlay('b')] });
    for (const hand of firstHands(s)) expect([...hand].sort()).toEqual(['a', 'b']);
  });

  it('runs its own plays: a handoff in the playbook hands off at the hike', () => {
    const run: Play = { ...passPlay('run'), handoff: 2 };
    let s = createRun(3, undefined, 0, { playbook: [run] });
    s = dispatch(s, { type: 'call', hand: 0 }).state;
    const { events } = dispatch(s, { type: 'hike' });
    expect(events.map((e: ArcadeEvent) => e.type)).toContain('handoff');
  });
});

describe('trying a play (Try it)', () => {
  it('deals the tried play in every hand, flipped or not, beside two from the pool', () => {
    for (const seed of [1, 2, 3, 7]) {
      const s = createRun(seed, undefined, 0, { trial: passPlay('mine') });
      // Flipped from the first down on, Flip stays on as the downs go by.
      const flipped = dispatch(s, { type: 'flip' }).state;
      expect(flipped.flipped).toBe(true);
      for (const hand of [...firstHands(s), ...firstHands(flipped)]) {
        expect(
          hand.filter((id) => id === 'mine'),
          `seed ${seed}`,
        ).toHaveLength(1);
        expect(hand, `seed ${seed}`).toHaveLength(3);
      }
    }
  });

  it('a tried handoff hands off to its Runner, and flipped, to the other Runner', () => {
    const mine: Play = { ...passPlay('mine'), handoff: 2 };
    for (const flipped of [false, true]) {
      let s = createRun(3, undefined, 0, { trial: mine });
      const card = s.hand.findIndex((i) => s.playbook[i]?.id === 'mine');
      s = dispatch(s, { type: 'call', hand: card }).state;
      if (flipped) s = dispatch(s, { type: 'flip' }).state;
      const { state, events } = dispatch(s, { type: 'hike' });
      const handoff = events.find((e: ArcadeEvent) => e.type === 'handoff');
      const runner = state.field.players.find(
        (p) => p.id === (handoff?.type === 'handoff' ? handoff.id : -1),
      );
      expect(runner?.slot, `flipped ${flipped}`).toBe(playSlot(2, flipped));
    }
  });

  it("the Queen's Royal Decree never bans the tried play", () => {
    for (let seed = 1; seed <= 12; seed++) {
      const s = createRun(seed, undefined, 0, { trial: passPlay('mine') });
      setUpDrive(s, 1, 3, [], true);
      expect(handIds(s), `seed ${seed}`).toContain('mine');
      expect(s.banned, `seed ${seed}`).not.toBeNull();
      expect(s.playbook[s.hand[s.banned ?? 0] ?? -1]?.id, `seed ${seed}`).not.toBe('mine');
    }
  });
});
