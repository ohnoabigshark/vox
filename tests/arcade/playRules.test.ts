import { describe, expect, it } from 'vitest';
import { playProblems } from '../../src/arcade/content/playRules';
import { PLAYS, type Assignment, type Play } from '../../src/arcade/content/plays';

const block: Assignment = { kind: 'block' };
const route = (...to: [number, number][]): Assignment => ({
  kind: 'route',
  to: to.map(([x, y]) => ({ x, y })),
});

/** A legal play to break one slot at a time: every route ends upfield. */
const legal = (): Assignment[] => [
  block,
  block,
  route([-2, 6]),
  route([2, 6]),
  route([0, 10]),
  route([0, 10]),
  route([0, 8]),
];
const play = (slots: Assignment[], handoff?: number): Play => ({
  id: 'test',
  name: 'Test',
  slots,
  ...(handoff === undefined ? {} : { handoff }),
});
const withSlot = (slot: number, a: Assignment): Play => {
  const slots = legal();
  slots[slot] = a;
  return play(slots);
};

describe('play rules', () => {
  it('a legal play breaks none of them', () => {
    expect(playProblems(play(legal()))).toEqual([]);
  });

  it('every play in the pool keeps them', () => {
    for (const p of PLAYS) expect(playProblems(p), p.id).toEqual([]);
  });

  it('a route that ends going sideways breaks the first rule, for its slot', () => {
    expect(playProblems(withSlot(6, route([0, 6], [-3, 6])))).toEqual([
      {
        slot: 6,
        rule: 'ends',
        message:
          "C3's route ends going sideways. End it going upfield, or curl it back at an angle.",
      },
    ]);
  });

  it('a curl has to come back at an angle, not straight down its own route', () => {
    expect(playProblems(withSlot(5, route([0, 7], [0.5, 5.5])))).toEqual([
      {
        slot: 5,
        rule: 'ends',
        message: "C2's route comes straight back. Curl it back at an angle of at least a yard.",
      },
    ]);
    expect(playProblems(withSlot(5, route([0, 7], [-1.5, 5.5])))).toEqual([]);
  });

  it('a player with a route but no points yet is told to add one', () => {
    expect(playProblems(withSlot(4, route()))).toEqual([
      { slot: 4, rule: 'ends', message: 'C1 has no route yet. Tap the field to add a point.' },
    ]);
  });

  it('every Runner gets more than a yard past the line of scrimmage', () => {
    // R1 lines up 4.5 yards back, so +5.5 ends exactly a yard past the line: not enough.
    expect(playProblems(withSlot(2, route([-2, 5.5])))).toEqual([
      {
        slot: 2,
        rule: 'pastLine',
        message:
          "R1 doesn't get past the line. Take its route more than a yard past the line of scrimmage.",
      },
    ]);
    expect(playProblems(withSlot(2, route([-2, 6])))).toEqual([]);
  });

  it('only Blockers block: a Runner or Catcher left blocking is told to run', () => {
    expect(playProblems(withSlot(6, block))).toEqual([
      {
        slot: 6,
        rule: 'pastLine',
        message: 'C3 is blocking. Only Blockers block: give it a route.',
      },
    ]);
  });

  it('no route goes deeper than a throw can reach: 28 yards past the line', () => {
    // C1 lines up 0.7 yards back: +28.7 ends exactly at 28, +29 goes past it.
    expect(playProblems(withSlot(4, route([0, 28.7])))).toEqual([]);
    expect(playProblems(withSlot(4, route([0, 29])))).toEqual([
      {
        slot: 4,
        rule: 'inRange',
        message: "C1's route goes past a throw's reach. Keep it within 28 yards of the line.",
      },
    ]);
  });

  it('no route goes off the field, at any point on the way', () => {
    // C2 lines up at x 7; the sideline is at 9.1.
    expect(playProblems(withSlot(5, route([2.5, 3], [0, 10])))).toEqual([
      {
        slot: 5,
        rule: 'inRange',
        message: "C2's route goes off the field. Keep it inside the sidelines.",
      },
    ]);
  });
});
