import { describe, expect, it } from 'vitest';
import type { Assignment, Play } from '../../src/arcade/content/plays';
import { createRun, dispatch, endDown, nextDown } from '../../src/arcade/sim/run';
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
