import { describe, expect, it } from 'vitest';
import { FROG_RAIN, type FieldEvent } from '../../src/arcade/content/fieldEvents';
import { arcadeTuning, TIME_SCALE } from '../../src/arcade/content/tuning';
import {
  areaReadout,
  dragNumber,
  eventNumbers,
  eventTimeline,
  handlesOf,
  moveArea,
  newEvent,
  replaceEvent,
  savedWith,
  savedWithout,
  setCall,
  setNumber,
  setOn,
  setShape,
  sizeArea,
  startEditing,
  undo,
  type SliderDrag,
} from '../../src/dev/eventEditor/editor';

/** docs/FIELD_EVENTS.md, test 7: the event editor's rules (f2, p1). */

const hw = arcadeTuning.field.halfWidth;
const lane: FieldEvent = {
  ...FROG_RAIN,
  area: { shape: 'lane', across: 'right', width: 6, from: -1, to: 16 },
};

describe('the editor (test 7)', () => {
  it('dragging the area moves it upfield by the drag, snapped to the half yard; a lane keeps its side', () => {
    const s = startEditing(lane);
    const moved = moveArea(s, { x: 3, y: 2.3 });
    expect(moved.event.area).toEqual({
      shape: 'lane',
      across: 'right',
      width: 6,
      from: 1.5,
      to: 18.5,
    });
    // A drag is one step for Undo.
    expect(undo(moved).event).toEqual(lane);
  });

  it('a circle moves across as well, its way out from the middle', () => {
    const s = startEditing({
      ...lane,
      area: { shape: 'circle', across: 'right', out: 4, at: 12, radius: 2 },
    });
    expect(moveArea(s, { x: 1.2, y: -2.2 }).event.area).toEqual({
      shape: 'circle',
      across: 'right',
      out: 5,
      at: 10,
      radius: 2,
    });
    // Never past the sideline.
    expect(moveArea(s, { x: 20, y: 0 }).event.area).toEqual({
      shape: 'circle',
      across: 'right',
      out: hw,
      at: 12,
      radius: 2,
    });
  });

  it('handles size it: a lane’s near and far edges and its width; a circle’s edge', () => {
    const s = startEditing(lane);
    const handles = handlesOf(lane.area);
    expect(handles.map((h) => h.handle)).toEqual(['near', 'far', 'width']);
    const sized = (area: object): object => ({ ...lane.area, ...area });
    expect(sizeArea(s, 'far', { x: 0, y: 10.2 }).event.area).toEqual(sized({ to: 10 }));
    expect(sizeArea(s, 'near', { x: 0, y: 2.6 }).event.area).toEqual(sized({ from: 2.5 }));
    // The width handle is the lane's inner edge: dragged toward the middle, it widens.
    expect(sizeArea(s, 'width', { x: hw - 8.2, y: 5 }).event.area).toEqual(sized({ width: 8 }));
    // Never inside out: the near edge stops half a yard short of the far one.
    expect(sizeArea(s, 'near', { x: 0, y: 30 }).event.area).toEqual(sized({ from: 15.5 }));
    const c = startEditing({
      ...lane,
      area: { shape: 'circle', across: 'right', out: 4, at: 12, radius: 2 },
    });
    expect(handlesOf(c.event.area).map((h) => h.handle)).toEqual(['edge']);
    expect(sizeArea(c, 'edge', { x: 7.1, y: 12 }).event.area).toEqual({
      ...c.event.area,
      radius: 3,
    });
  });

  it('the bar under the field says where it is, in yards', () => {
    expect(areaReadout(lane.area)).toBe('−1 to +16 yd from the line · 6 yd wide');
    expect(areaReadout(FROG_RAIN.area)).toBe('−1 to +16 yd from the line · 7.3 yd wide');
    expect(areaReadout({ shape: 'circle', across: 'either', out: 4, at: 12, radius: 2 })).toBe(
      '+12 yd ahead · 4 yd out · 4 yd across',
    );
  });

  it('changing the shape keeps the area where it was', () => {
    const s = startEditing(lane);
    const circle = setShape(s, 'circle').event.area;
    // Centred where the lane was: 7.5 yd ahead, 6.1 out (the lane's middle), as wide as the lane.
    expect(circle).toEqual({ shape: 'circle', across: 'right', out: hw - 3, at: 7.5, radius: 3 });
    const back = setShape(startEditing({ ...lane, area: circle }), 'band').event.area;
    expect(back).toEqual({ shape: 'band', across: 'right', width: 6, from: 4.5, to: 10.5 });
  });

  it('each change is a step for Undo; times are set on screen and kept as sim time', () => {
    const s = setOn(setNumber(startEditing(lane), 'goesOff', 1.0), 'theirs');
    expect(s.event.goesOff).toBeCloseTo(1.0 * TIME_SCALE, 9);
    expect(s.event.effect.on).toBe('theirs');
    expect(undo(s).event.effect.on).toBe('everyone');
    expect(undo(undo(s)).event).toEqual(lane);
    expect(undo(startEditing(lane)).event).toEqual(lane);
  });

  it('a new event is generic and plain, its id from its name, never one already taken', () => {
    const e = newEvent('Graveyard rain', ['frogRain', 'graveyardRain']);
    expect(e.id).toBe('graveyardRain2');
    expect(e.boss).toBeNull();
    expect(e.look).toBe('plain');
    // A call to show when it tackles a carrier (review r1), changed on the editor.
    expect(e.call).toBe('TACKLED!');
    const s = setCall(startEditing(e), 'SPOOKED!');
    expect(s.event.call).toBe('SPOOKED!');
    expect(setCall(s, '  ').event.call).toBeNull();
  });

  it('Save keeps an event off its default; one back at its default, or Restore, leaves the file', () => {
    const tuned = { ...FROG_RAIN, goesOff: 2 };
    expect(savedWith({}, tuned)).toEqual({ frogRain: tuned });
    expect(savedWith({ frogRain: tuned }, FROG_RAIN)).toEqual({});
    const made = newEvent('Fog', ['frogRain']);
    expect(savedWith({}, made)).toEqual({ fog: made });
    expect(savedWithout({ frogRain: tuned, fog: made }, 'frogRain')).toEqual({ fog: made });
  });
});

describe('the editor, bench style (round 4: e1–e4)', () => {
  it('e1, e2: each event shows its times and its area’s numbers as sliders, on screen and in yards', () => {
    expect(eventNumbers(FROG_RAIN).map((n) => [n.key, n.value])).toEqual([
      ['goesOff', 2],
      ['buildUp', 0.875],
      ['lasts', 1.5],
      ['from', -1],
      ['to', 16],
      ['width', FROG_RAIN.area.shape === 'lane' ? FROG_RAIN.area.width : 0],
    ]);
    const circle = {
      ...lane,
      area: { shape: 'circle', across: 'right', out: 4, at: 12, radius: 2 },
    } as const;
    expect(eventNumbers(circle).map((n) => n.key)).toEqual([
      'goesOff',
      'buildUp',
      'lasts',
      'at',
      'out',
      'radius',
    ]);
  });

  it('e1, e2: setting one exactly is one step for Undo, held to what the game can play', () => {
    const s = setNumber(startEditing(lane), 'goesOff', 1);
    expect(s.event.goesOff).toBeCloseTo(0.8, 9);
    expect(undo(s).event).toEqual(lane);
    expect(setNumber(startEditing(lane), 'to', 10).event.area).toEqual({ ...lane.area, to: 10 });
    // Never inside out: the far edge stops half a yard past the near one.
    expect(setNumber(startEditing(lane), 'to', -5).event.area).toEqual({ ...lane.area, to: -0.5 });
    expect(setNumber(startEditing(lane), 'width', 40).event.area).toEqual({
      ...lane.area,
      width: 2 * hw,
    });
  });

  it('e3: Restore defaults (or Revert to saved) puts every setting back, as one step for Undo', () => {
    const changed = setNumber(setOn(startEditing(FROG_RAIN), 'theirs'), 'goesOff', 1);
    const back = replaceEvent(changed, FROG_RAIN);
    expect(back.event).toEqual(FROG_RAIN);
    expect(undo(back).event).toEqual(changed.event);
  });

  it('e4: the timeline: the warning starts goes-off minus its length after the snap, never before it', () => {
    expect(eventTimeline(FROG_RAIN)).toEqual({ warning: 1.125, goesOff: 2, ends: 3.5 });
    const early = { ...FROG_RAIN, warning: { buildUp: 4 * TIME_SCALE } };
    expect(eventTimeline(early).warning).toBe(0);
  });
});

describe('review of the bench-style editor', () => {
  it('b1: one drag of a slider is one step for Undo; a second drag, after letting go, is another', () => {
    let s = startEditing(lane);
    let drag: SliderDrag | null = null;
    for (const v of [1.2, 1.4, 1.6]) ({ state: s, drag } = dragNumber(s, drag, 'goesOff', v));
    drag = null; // let go
    for (const v of [2.2, 2.4]) ({ state: s, drag } = dragNumber(s, drag, 'goesOff', v));
    expect(s.event.goesOff).toBeCloseTo(2.4 * TIME_SCALE, 9);
    expect(undo(s).event.goesOff).toBeCloseTo(1.6 * TIME_SCALE, 9);
    expect(undo(undo(s)).event).toEqual(lane);
    // Moving another slider mid-drag starts that slider's own step.
    ({ state: s, drag } = dragNumber(startEditing(lane), null, 'goesOff', 1));
    s = dragNumber(s, drag, 'lasts', 1).state;
    expect(undo(s).event.goesOff).toBeCloseTo(0.8, 9);
  });
});
