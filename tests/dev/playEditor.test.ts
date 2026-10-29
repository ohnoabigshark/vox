import { describe, expect, it } from 'vitest';
import {
  addPoint,
  fieldView,
  movePoint,
  removePoint,
  select,
  selectPoint,
  setHandoff,
  setName,
  startEditing,
  toggleFlip,
  undo,
} from '../../src/dev/playEditor/editor';
import type { Assignment, Play } from '../../src/arcade/content/plays';

const block: Assignment = { kind: 'block' };
const route = (...to: [number, number][]): Assignment => ({
  kind: 'route',
  to: to.map(([x, y]) => ({ x, y })),
});
/** A copy of Curl & Flat, as the editor would start one. */
const curlFlat: Play = {
  id: 'curlFlat2',
  name: 'Curl & Flat 2',
  slots: [
    block,
    block,
    route([-3.5, 1], [-6.3, 2], [-6.3, 12]),
    route([3.5, 1], [6.3, 2], [6.3, 12]),
    route([0, 7], [1.5, 5.5]),
    route([0, 7], [-1.5, 5.5]),
    route([0, 6], [-1.5, 4.5]),
  ],
};
const routeOf = (p: Play, slot: number): { x: number; y: number }[] => {
  const a = p.slots[slot];
  return a?.kind === 'route' ? [...a.to] : [];
};

describe('the play editor: drawing a route', () => {
  it('a tap on the field adds the next waypoint to the picked player, snapped to the half yard, from where it lines up', () => {
    // C1 lines up at (-7, -0.7). A tap at (-4.1, 12.4) on the field is (+2.9, +13.1) from there: snapped, (+3, +13).
    const s = addPoint(select(startEditing(curlFlat), 4), { x: -4.1, y: 12.4 });
    expect(routeOf(s.play, 4)).toEqual([
      { x: 0, y: 7 },
      { x: 1.5, y: 5.5 },
      { x: 3, y: 13 },
    ]);
    expect(s.point).toBe(2);
  });

  it('with nobody picked, or a Blocker tapped, a tap adds nothing', () => {
    const s = startEditing(curlFlat);
    expect(addPoint(s, { x: 0, y: 5 }).play).toEqual(curlFlat);
    expect(select(s, 0).selected).toBeNull();
  });
});

describe('the play editor: changing a route', () => {
  it('dragging a waypoint moves it, snapped, and picks it', () => {
    // C2 lines up at (7, -0.7); its first waypoint is (0, +7). Dragged to (5.2, 9.9) on the field: (-1.8, +10.6), snapped (-2, +10.5).
    const s = movePoint(select(startEditing(curlFlat), 5), 0, { x: 5.2, y: 9.9 });
    expect(routeOf(s.play, 5)).toEqual([
      { x: -2, y: 10.5 },
      { x: -1.5, y: 5.5 },
    ]);
    expect(s.point).toBe(0);
  });

  it('Remove takes out the picked waypoint', () => {
    const s = removePoint(selectPoint(select(startEditing(curlFlat), 2), 1));
    expect(routeOf(s.play, 2)).toEqual([
      { x: -3.5, y: 1 },
      { x: -6.3, y: 12 },
    ]);
    expect(s.point).toBeNull();
  });

  it('Undo steps back through every change, and a whole drag is one step', () => {
    const start = select(startEditing(curlFlat), 6);
    const added = addPoint(start, { x: 5, y: 10 });
    // A drag: the page works out every move from the state where the drag began.
    movePoint(added, 0, { x: 3, y: 6 });
    const dragged = movePoint(added, 0, { x: 2, y: 7 });
    const removed = removePoint(selectPoint(dragged, 1));
    expect(undo(removed).play).toEqual(dragged.play);
    expect(undo(undo(removed)).play).toEqual(added.play);
    expect(undo(undo(undo(removed))).play).toEqual(curlFlat);
    expect(undo(start).play).toEqual(curlFlat);
  });
});

describe('the play editor: the rest of the play', () => {
  it('the handoff goes to R1, R2 or nobody, and Undo takes it back', () => {
    const s = setHandoff(startEditing(curlFlat), 3);
    expect(s.play.handoff).toBe(3);
    expect(setHandoff(s, null).play.handoff).toBeUndefined();
    expect(setHandoff(s, 5).play.handoff).toBe(3); // a Catcher can't take a handoff
    expect(undo(s).play.handoff).toBeUndefined();
  });

  it('renames the play', () => {
    expect(setName(startEditing(curlFlat), 'Flood Left').play.name).toBe('Flood Left');
  });

  it('shows each route on the field, the handoff Runner carrying, broken routes marked', () => {
    const broken = movePoint(select(startEditing(curlFlat), 6), 1, { x: 1.2, y: 4.8 }); // C3 now ends going sideways
    const view = fieldView(setHandoff(broken, 2));
    expect(view.find((r) => r.slot === 4)).toEqual({
      slot: 4,
      kind: 'route',
      path: [
        { x: -7, y: -0.7 },
        { x: -7, y: 6.3 },
        { x: -5.5, y: 4.8 },
      ],
      broken: false,
    });
    expect(view.find((r) => r.slot === 2)?.kind).toBe('carry');
    expect(view.find((r) => r.slot === 6)?.broken).toBe(true);
    expect(view.find((r) => r.slot === 0)).toEqual({
      slot: 0,
      kind: 'block',
      path: [{ x: -0.9, y: -0.7 }],
      broken: false,
    });
  });

  it('Flip shows the play mirrored as the game runs it, and editing waits until it is off', () => {
    const flipped = toggleFlip(select(startEditing(curlFlat), 4));
    // C1's route, mirrored, is run by C2, its mirror partner, from C2's side.
    expect(fieldView(flipped).find((r) => r.slot === 5)?.path).toEqual([
      { x: 7, y: -0.7 },
      { x: 7, y: 6.3 },
      { x: 5.5, y: 4.8 },
    ]);
    expect(addPoint(flipped, { x: 0, y: 10 }).play).toEqual(curlFlat);
    expect(setHandoff(flipped, 2).play).toEqual(curlFlat);
    expect(toggleFlip(flipped).flipped).toBe(false);
  });
});

describe('the play editor: what Undo leaves alone', () => {
  it('Undo keeps the name: renaming is not a step', () => {
    const s = setName(addPoint(select(startEditing(curlFlat), 4), { x: -4, y: 12 }), 'Flood Left');
    expect(undo(s).play).toEqual({ ...curlFlat, name: 'Flood Left' });
  });

  it('Undo waits while Flip is on, like every other edit', () => {
    const s = toggleFlip(addPoint(select(startEditing(curlFlat), 4), { x: -4, y: 12 }));
    expect(undo(s).play).toEqual(s.play);
  });

  it('picking the handoff it already has is not a step for Undo', () => {
    const s = setHandoff(startEditing(curlFlat), 2);
    expect(setHandoff(s, 2).history).toHaveLength(1);
    expect(setHandoff(startEditing(curlFlat), null).history).toHaveLength(0);
  });
});
