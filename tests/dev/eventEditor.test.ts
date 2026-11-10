import { describe, expect, it } from 'vitest';
import {
  FROG_RAIN,
  TAFFY_FLOOD,
  WILL_O_WISPS,
  type FieldEvent,
} from '../../src/arcade/content/fieldEvents';
import { arcadeTuning, TIME_SCALE } from '../../src/arcade/content/tuning';
import {
  areaReadout,
  dragNumber,
  FARTHEST,
  eventNumbers,
  eventTimeline,
  numberText,
  timelineText,
  handlesOf,
  moveArea,
  newEvent,
  replaceEvent,
  savedWith,
  savedWithout,
  setCall,
  setEffect,
  setGoesOffAs,
  effectChoice,
  EFFECT_CHIPS,
  setNumber,
  pickArea,
  pickedArea,
  SIDE_CHIPS,
  startingValues,
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
  areas: [{ shape: 'lane', across: 'right', width: 6, from: -1, to: 16 }],
};

describe('the editor (test 7)', () => {
  it('dragging the area moves it upfield by the drag, snapped to the half yard; a lane keeps its side', () => {
    const s = startEditing(lane);
    const moved = moveArea(s, { x: 3, y: 2.3 });
    expect(moved.event.areas[0]).toEqual({
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
      areas: [{ shape: 'circle', across: 'right', out: 4, at: 12, radius: 2 }],
    });
    expect(moveArea(s, { x: 1.2, y: -2.2 }).event.areas[0]).toEqual({
      shape: 'circle',
      across: 'right',
      out: 5,
      at: 10,
      radius: 2,
    });
    // Never past the sideline.
    expect(moveArea(s, { x: 20, y: 0 }).event.areas[0]).toEqual({
      shape: 'circle',
      across: 'right',
      out: hw,
      at: 12,
      radius: 2,
    });
  });

  it('handles size it: a lane’s near and far edges and its width; a circle’s edge', () => {
    const s = startEditing(lane);
    const handles = handlesOf(lane.areas[0]);
    expect(handles.map((h) => h.handle)).toEqual(['near', 'far', 'width']);
    const sized = (area: object): object => ({ ...lane.areas[0], ...area });
    expect(sizeArea(s, 'far', { x: 0, y: 10.2 }).event.areas[0]).toEqual(sized({ to: 10 }));
    expect(sizeArea(s, 'near', { x: 0, y: 2.6 }).event.areas[0]).toEqual(sized({ from: 2.5 }));
    // The width handle is the lane's inner edge: dragged toward the middle, it widens.
    expect(sizeArea(s, 'width', { x: hw - 8.2, y: 5 }).event.areas[0]).toEqual(sized({ width: 8 }));
    // Never inside out: the near edge stops half a yard short of the far one.
    expect(sizeArea(s, 'near', { x: 0, y: 30 }).event.areas[0]).toEqual(sized({ from: 15.5 }));
    const c = startEditing({
      ...lane,
      areas: [{ shape: 'circle', across: 'right', out: 4, at: 12, radius: 2 }],
    });
    expect(handlesOf(c.event.areas[0]).map((h) => h.handle)).toEqual(['edge']);
    expect(sizeArea(c, 'edge', { x: 7.1, y: 12 }).event.areas[0]).toEqual({
      ...c.event.areas[0],
      radius: 3,
    });
  });

  it('the bar under the field says where it is, in yards', () => {
    expect(areaReadout(lane.areas[0])).toBe('−1 to +16 yd from the line · 6 yd wide');
    expect(areaReadout(FROG_RAIN.areas[0])).toBe('−1 to +16 yd from the line · 7.3 yd wide');
    expect(areaReadout({ shape: 'circle', across: 'either', out: 4, at: 12, radius: 2 })).toBe(
      '+12 yd ahead · 4 yd out · 4 yd across',
    );
  });

  it('changing the shape keeps the area where it was', () => {
    const s = startEditing(lane);
    const circle = setShape(s, 'circle').event.areas[0];
    // Centred where the lane was: 7.5 yd ahead, 6.1 out (the lane's middle), as wide as the lane.
    expect(circle).toEqual({ shape: 'circle', across: 'right', out: hw - 3, at: 7.5, radius: 3 });
    const back = setShape(startEditing({ ...lane, areas: [circle] }), 'band').event.areas[0];
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
    expect(eventNumbers(FROG_RAIN, 0).map((n) => [n.key, n.value])).toEqual(
      [
        ['goesOff', 2],
        ['buildUp', 0.875],
        ['lasts', 1.5],
        ['from', -1],
        ['to', 16],
        ['width', 7.28],
      ].map(([k, v]) => [k, expect.closeTo(v as number, 9)]),
    );
    const circle = {
      ...lane,
      areas: [{ shape: 'circle', across: 'right', out: 4, at: 12, radius: 2 }],
    } as const;
    expect(eventNumbers(circle, 0).map((n) => n.key)).toEqual([
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
    expect(setNumber(startEditing(lane), 'to', 10).event.areas[0]).toEqual({
      ...lane.areas[0],
      to: 10,
    });
    // Never inside out: the far edge stops half a yard past the near one.
    expect(setNumber(startEditing(lane), 'to', -5).event.areas[0]).toEqual({
      ...lane.areas[0],
      to: -0.5,
    });
    expect(setNumber(startEditing(lane), 'width', 40).event.areas[0]).toEqual({
      ...lane.areas[0],
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

  it('b4: dragging and the sliders hold a number alike: never past 30 yards upfield', () => {
    expect(FARTHEST).toBe(30);
    // A lane dragged far upfield stops with its far edge at 30, keeping its length.
    expect(moveArea(startEditing(lane), { x: 0, y: 20 }).event.areas[0]).toEqual({
      ...lane.areas[0],
      from: 13,
      to: 30,
    });
    expect(sizeArea(startEditing(lane), 'far', { x: 0, y: 34 }).event.areas[0]).toEqual({
      ...lane.areas[0],
      to: 30,
    });
    const c = startEditing({
      ...lane,
      areas: [{ shape: 'circle', across: 'right', out: 4, at: 12, radius: 2 }],
    });
    expect(moveArea(c, { x: 0, y: 30 }).event.areas[0]).toMatchObject({ at: 30 });
    expect(setNumber(c, 'at', 40).event.areas[0]).toEqual({ ...c.event.areas[0], at: 30 });
  });

  it('b4: a circle in the middle has no way out to set: not offered, and held at 0', () => {
    const middle = {
      ...lane,
      areas: [{ shape: 'circle', across: 'middle', out: 0, at: 12, radius: 2 }],
    } as const;
    expect(eventNumbers(middle, 0).map((n) => n.key)).not.toContain('out');
    expect(setNumber(startEditing(middle), 'out', 3).event.areas[0]).toEqual(middle.areas[0]);
    // Set on a side, it moves out again.
    expect(
      eventNumbers({ ...middle, areas: [{ ...middle.areas[0], across: 'left' }] }, 0).map(
        (n) => n.key,
      ),
    ).toContain('out');
  });

  it('m1, d2: how a number reads, from the rules: signed from the line, times to the thousandth only when needed', () => {
    const text = (e: FieldEvent): string[] => eventNumbers(e, 0).map(numberText);
    expect(text(FROG_RAIN)).toEqual(['2.00 s', '0.875 s', '1.50 s', '−1 yd', '+16 yd', '7.3 yd']);
    const c = {
      ...lane,
      areas: [{ shape: 'circle', across: 'right', out: 4, at: 12, radius: 2 }],
    } as const;
    expect(text(c).slice(3)).toEqual(['+12 yd', '4 yd', '2 yd']);
    // The timeline reads as the sliders do: Frog Rain's warning starts at 1.125 s, not "1.13".
    expect(timelineText(eventTimeline(FROG_RAIN))).toEqual([
      'snap',
      'warning 1.125 s',
      'goes off 2.00 s',
      'ends 3.50 s',
    ]);
  });

  it('d3: an event of yours never saved goes back to New event’s starting values, under its own name', () => {
    const made = newEvent('Fog', ['frogRain']);
    const tried = setOn(setNumber(startEditing(made), 'goesOff', 3), 'theirs').event;
    expect(startingValues(tried)).toEqual(made);
    expect(startingValues({ ...tried, name: 'Thick fog' })).toEqual({ ...made, name: 'Thick fog' });
  });
});

describe('spells and Slowed on the editor (round 5, test 4)', () => {
  it('Spell and Slowed can be picked, each a step for Undo', () => {
    const slowed = setEffect(startEditing(lane), 'slowed');
    expect(slowed.event.effect).toEqual({ kind: 'status', status: 'slowed', on: 'everyone' });
    expect(effectChoice(slowed.event.effect)).toBe('slowed');
    const spell = setGoesOffAs(slowed, 'spell');
    expect(spell.event.goesOffAs).toBe('spell');
    expect(undo(spell).event.goesOffAs).toBe('burst');
    expect(undo(undo(spell)).event).toEqual(lane);
  });

  it('who it lands on is kept as the effect changes', () => {
    const s = setEffect(setOn(startEditing(lane), 'theirs'), 'slowed');
    expect(s.event.effect.on).toBe('theirs');
    expect(effectChoice(setEffect(s, 'flatten').event.effect)).toBe('flatten');
    expect(setEffect(s, 'flatten').event.effect.on).toBe('theirs');
  });

  it('a spell gives a status: picking Spell over Flatten makes it Slowed, and Flatten makes it a burst', () => {
    const spell = setGoesOffAs(startEditing(lane), 'spell');
    expect(spell.event.goesOffAs).toBe('spell');
    expect(spell.event.effect).toEqual({ kind: 'status', status: 'slowed', on: 'everyone' });
    const flat = setEffect(startEditing(TAFFY_FLOOD), 'flatten');
    expect(flat.event.goesOffAs).toBe('burst');
    expect(flat.event.effect).toEqual({ kind: 'flatten', on: 'everyone' });
  });

  it('a new event starts as a burst', () => {
    expect(newEvent('Graveyard rain', []).goesOffAs).toBe('burst');
  });
});

describe('Ethereal on the editor (round 5, test 8)', () => {
  it('the effects offered are Flatten, Slowed and Ethereal, none greyed', () => {
    expect(EFFECT_CHIPS).toEqual([
      { value: 'flatten', text: 'Flatten' },
      { value: 'slowed', text: 'Slowed' },
      { value: 'ethereal', text: 'Ethereal' },
    ]);
  });

  it('Ethereal can be picked, on whoever it was on, a step for Undo; a spell of it is the wisps’ kind', () => {
    const s = setEffect(setOn(startEditing(lane), 'yours'), 'ethereal');
    expect(s.event.effect).toEqual({ kind: 'status', status: 'ethereal', on: 'yours' });
    expect(effectChoice(s.event.effect)).toBe('ethereal');
    expect(undo(s).event.effect).toEqual({ kind: 'flatten', on: 'yours' });
    const spell = setGoesOffAs(s, 'spell');
    expect(spell.event.effect).toEqual({ kind: 'status', status: 'ethereal', on: 'yours' });
  });

  it('the wisps open on it as they are', () => {
    expect(effectChoice(startEditing(WILL_O_WISPS).event.effect)).toBe('ethereal');
  });
});

describe('places and sizes on the editor (field-places, test 7)', () => {
  it('a chip per area: picking one makes the handles and the area’s sliders edit it, and only it', () => {
    const s = pickArea(startEditing(TAFFY_FLOOD), 2);
    expect(pickedArea(s)).toEqual(TAFFY_FLOOD.areas[2]);
    // Picking isn't a change: nothing for Undo.
    expect(s.history).toEqual([]);
    const sized = setNumber(s, 'radius', 4);
    expect(sized.event.areas).toEqual([
      TAFFY_FLOOD.areas[0],
      TAFFY_FLOOD.areas[1],
      { ...TAFFY_FLOOD.areas[2], radius: 4 },
    ]);
    const moved = moveArea(s, { x: 0, y: 2 });
    expect(moved.event.areas[0]).toEqual(TAFFY_FLOOD.areas[0]);
    expect(pickedArea(moved)).toMatchObject({ at: 8 });
    // The sliders are the picked area's: a circle's.
    expect(eventNumbers(s.event, s.picked).map((n) => n.key)).toContain('radius');
    // No such area: the pick stays.
    expect(pickArea(s, 5)).toBe(s);
  });

  it('the reach and size sliders, when the event has them; Frog Rain has neither', () => {
    const keys = (e: FieldEvent) => eventNumbers(e, 0).map((n) => n.key);
    const of = (e: FieldEvent, key: string) => eventNumbers(e, 0).find((n) => n.key === key);
    expect(keys(TAFFY_FLOOD)).toEqual(
      expect.arrayContaining(['nearest', 'farthest', 'smallest', 'largest']),
    );
    expect(of(TAFFY_FLOOD, 'nearest')).toMatchObject({ value: 2, unit: 'yd', fromLine: true });
    expect(of(TAFFY_FLOOD, 'farthest')).toMatchObject({ value: 12, unit: 'yd', fromLine: true });
    expect(of(TAFFY_FLOOD, 'smallest')).toMatchObject({ value: 0.75, unit: '×' });
    expect(of(TAFFY_FLOOD, 'largest')).toMatchObject({ value: 1.5, unit: '×' });
    expect(numberText(of(TAFFY_FLOOD, 'largest')!)).toBe('1.5×');
    expect(keys(WILL_O_WISPS)).toEqual(expect.arrayContaining(['smallest', 'largest']));
    expect(keys(WILL_O_WISPS)).not.toContain('nearest');
    for (const k of ['nearest', 'farthest', 'smallest', 'largest']) {
      expect(keys(FROG_RAIN)).not.toContain(k);
    }
  });

  it('setting them: each a step for Undo, and never backwards or nothing', () => {
    const s = startEditing(TAFFY_FLOOD);
    expect(setNumber(s, 'nearest', 4).event.reach).toEqual({ nearest: 4, farthest: 12 });
    expect(setNumber(s, 'nearest', 20).event.reach).toEqual({ nearest: 12, farthest: 12 });
    expect(setNumber(s, 'farthest', 1).event.reach).toEqual({ nearest: 2, farthest: 2 });
    expect(setNumber(s, 'largest', 2).event.size).toEqual({ smallest: 0.75, largest: 2 });
    expect(setNumber(s, 'largest', 0.5).event.size).toEqual({ smallest: 0.75, largest: 0.75 });
    expect(setNumber(s, 'smallest', 0).event.size).toEqual({ smallest: 0.25, largest: 1.5 });
    expect(undo(setNumber(s, 'nearest', 4)).event).toEqual(TAFFY_FLOOD);
  });

  it('Save keeps every area, its reach and its size', () => {
    const edited = setNumber(pickArea(startEditing(TAFFY_FLOOD), 1), 'width', 6).event;
    const saved = savedWith({}, edited);
    expect(saved.taffyFlood?.areas).toHaveLength(3);
    expect(saved.taffyFlood?.areas[1]).toMatchObject({ width: 6 });
    expect(saved.taffyFlood?.reach).toEqual(TAFFY_FLOOD.reach);
    expect(saved.taffyFlood?.size).toEqual(TAFFY_FLOOD.size);
  });

  it('with a reach, the area’s own place gives way to it: a band has a depth, a circle no place ahead (spec review)', () => {
    const keys = (e: FieldEvent, i: number) => eventNumbers(e, i).map((n) => n.key);
    // The band: its depth, not its near and far edges, which the reach decides in play.
    expect(keys(TAFFY_FLOOD, 0)).toContain('depth');
    expect(keys(TAFFY_FLOOD, 0)).not.toContain('from');
    expect(keys(TAFFY_FLOOD, 0)).not.toContain('to');
    expect(eventNumbers(TAFFY_FLOOD, 0).find((n) => n.key === 'depth')).toMatchObject({
      value: 4,
      unit: 'yd',
      fromLine: false,
    });
    // The puddle: its radius and its way out, but no place ahead.
    expect(keys(TAFFY_FLOOD, 2)).not.toContain('at');
    expect(keys(TAFFY_FLOOD, 2)).toContain('radius');
    // Setting the depth keeps the near edge where it is.
    const deeper = setNumber(startEditing(TAFFY_FLOOD), 'depth', 5).event.areas[0];
    expect(deeper).toMatchObject({ from: 3, to: 8 });
    // With no reach (Frog Rain), the edges as before.
    expect(keys(FROG_RAIN, 0)).toEqual(expect.arrayContaining(['from', 'to']));
    expect(keys(FROG_RAIN, 0)).not.toContain('depth');
  });

  it('the side chips offer Any side, for the puddle', () => {
    expect(SIDE_CHIPS.map((c) => c.value)).toEqual(['left', 'middle', 'right', 'either', 'any']);
  });
});
