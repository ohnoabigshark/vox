/**
 * The event editor's rules (docs/FIELD_EVENTS.md, f2, p1), kept apart from
 * the page so they're tested: dragging and sizing an event's area on the
 * field, its other parts, Undo, a new event, and what Save keeps.
 *
 * The field is in yards from the line of scrimmage (x across, y upfield), as
 * the play editor's is. An area on "either" side is drawn on the right.
 */
import { assertNever } from '../../assertNever';
import {
  fieldEventDefaults,
  type EventArea,
  type FieldEvent,
  type Who,
} from '../../arcade/content/fieldEvents';
import { arcadeTuning, TIME_SCALE } from '../../arcade/content/tuning';
import { circleX, rectXs, sideOf } from '../../arcade/sim/fieldEvents';
import { clamp } from '../../arcade/sim/vec';
import type { Yards } from '../fieldSvg';
import { idFromName } from '../playEditor/sketches';

export interface EditorState {
  readonly event: FieldEvent;
  /** The event before each change, latest last: Undo steps back through them. */
  readonly history: readonly FieldEvent[];
}

/** What a handle on the area sizes: a lane's or band's near edge, far edge or width; a circle's edge. */
export type Handle = 'near' | 'far' | 'width' | 'edge';

const HW = arcadeTuning.field.halfWidth;
/** Places snap to the half yard, as the play editor's do. */
const snap = (n: number): number => Math.round(n * 2) / 2;
/** The least a lane or band runs, and the smallest circle: half a yard. */
const LEAST = 0.5;
/** How far behind the line an area may start (Jack's deepest drop)… */
const BEHIND = -6;
/** …and how far upfield it may reach. */
export const FARTHEST = 30;

/** An area's number with a slider, and that dragging or a handle sets. */
type AreaKey = 'from' | 'to' | 'width' | 'at' | 'out' | 'radius';

/**
 * One area number set, held to what the game can play (review b4): the
 * one rule for dragging, the handles and the sliders. Never past 30 yards
 * upfield or 6 behind; a lane or band never inside out; a circle in the
 * middle stays there.
 */
function holdArea(a: EventArea, key: AreaKey, v: number): EventArea {
  if (a.shape === 'circle') {
    switch (key) {
      case 'at':
        return { ...a, at: clamp(v, BEHIND, FARTHEST) };
      case 'out':
        return { ...a, out: drawnSide(a) === 0 ? 0 : clamp(v, 0, HW) };
      case 'radius':
        return { ...a, radius: clamp(v, LEAST, HW) };
      default:
        return a;
    }
  }
  switch (key) {
    case 'from':
      return { ...a, from: clamp(v, BEHIND, a.to - LEAST) };
    case 'to':
      return { ...a, to: clamp(v, a.from + LEAST, FARTHEST) };
    case 'width':
      return { ...a, width: clamp(v, LEAST, 2 * HW) };
    default:
      return a;
  }
}

export function startEditing(event: FieldEvent): EditorState {
  return { event, history: [] };
}

/** A change: the event as it now is, the one before kept for Undo. */
function changed(s: EditorState, event: FieldEvent): EditorState {
  return { event, history: [...s.history, s.event] };
}

export function undo(s: EditorState): EditorState {
  const before = s.history.at(-1);
  return before ? { event: before, history: s.history.slice(0, -1) } : s;
}

/** Which side an area is drawn on: where the sim places it, "either" on the right. */
export function drawnSide(area: EventArea): -1 | 0 | 1 {
  return sideOf(area.across, () => 1);
}

/**
 * The area moved by a drag of `by` yards from where it was when the drag
 * began (`start`): upfield for any shape, and across too for a circle on a
 * side (a lane's or band's side is a chip). One step for Undo.
 */
export function moveArea(start: EditorState, by: Yards): EditorState {
  const a = start.event.area;
  const moved = (area: EventArea): EditorState => changed(start, { ...start.event, area });
  if (a.shape === 'circle') {
    const out = holdArea(a, 'out', snap(a.out + drawnSide(a) * by.x));
    return moved(holdArea(out, 'at', snap(a.at + by.y)));
  }
  // Both edges move together, the area keeping its length, within the field's reach.
  const length = a.to - a.from;
  const from = clamp(snap(a.from + by.y), BEHIND, FARTHEST - length);
  return moved({ ...a, from, to: from + length });
}

/** Where each of the area's handles is drawn, in field yards. */
export function handlesOf(area: EventArea): { handle: Handle; at: Yards }[] {
  const sign = drawnSide(area);
  if (area.shape === 'circle') {
    return [{ handle: 'edge', at: { x: circleAcross(area) + area.radius, y: area.at } }];
  }
  const { x0, x1 } = rectAcross(area);
  const mid = (x0 + x1) / 2;
  // The width handle sits on the edge nearer the middle (for a middle one, its right edge).
  const inner = sign < 0 ? x1 : sign > 0 ? x0 : x1;
  return [
    { handle: 'near', at: { x: mid, y: area.from } },
    { handle: 'far', at: { x: mid, y: area.to } },
    { handle: 'width', at: { x: inner, y: (area.from + area.to) / 2 } },
  ];
}

/** A lane's or band's left and right edges, as the sim places it ("either" on the right). */
export function rectAcross(area: Extract<EventArea, { width: number }>): {
  x0: number;
  x1: number;
} {
  return rectXs(area.width, drawnSide(area));
}

/** A circle's middle across, as the sim places it ("either" on the right). */
export function circleAcross(area: Extract<EventArea, { out: number }>): number {
  return circleX(area.out, drawnSide(area));
}

/** The area with `handle` dragged to `to` (field yards), snapped and never inside out. One step for Undo. */
export function sizeArea(start: EditorState, handle: Handle, to: Yards): EditorState {
  const a = start.event.area;
  const set = (key: AreaKey, v: number): EditorState =>
    changed(start, { ...start.event, area: holdArea(a, key, snap(v)) });
  if (a.shape === 'circle') return set('radius', Math.hypot(to.x - circleAcross(a), to.y - a.at));
  switch (handle) {
    case 'near':
      return set('from', to.y);
    case 'far':
      return set('to', to.y);
    case 'width': {
      const sign = drawnSide(a);
      return set('width', sign === 0 ? 2 * Math.abs(to.x) : sign * (sign * HW - to.x));
    }
    case 'edge':
      return start;
    default:
      return assertNever(handle);
  }
}

/** A distance in yards as the bar shows it: whole, or to a tenth. */
const yd = (n: number): string => String(Math.round(n * 10) / 10);
/** A place past the line, signed: "+16", "−1". */
const signed = (n: number): string => `${n < 0 ? '−' : '+'}${yd(Math.abs(n))}`;

/** Where the area is, in yards, for the bar under the field. */
export function areaReadout(area: EventArea): string {
  if (area.shape === 'circle') {
    return `${signed(area.at)} yd ahead · ${yd(area.out)} yd out · ${yd(2 * area.radius)} yd across`;
  }
  return `${signed(area.from)} to ${signed(area.to)} yd from the line · ${yd(area.width)} yd wide`;
}

/** The area as another shape, where it was: a circle in the middle of the old box, as wide as its narrower side, or a box around the old circle. */
export function setShape(s: EditorState, shape: EventArea['shape']): EditorState {
  const a = s.event.area;
  if (a.shape === shape) return s;
  let area: EventArea;
  if (shape === 'circle') {
    if (a.shape === 'circle') return s;
    const { x0, x1 } = rectAcross(a);
    const radius = Math.min(a.width, a.to - a.from) / 2;
    area = {
      shape,
      across: a.across,
      out: Math.abs((x0 + x1) / 2),
      at: (a.from + a.to) / 2,
      radius,
    };
  } else if (a.shape === 'circle') {
    area = {
      shape,
      across: a.across,
      width: 2 * a.radius,
      from: a.at - a.radius,
      to: a.at + a.radius,
    };
  } else {
    area = { ...a, shape };
  }
  return changed(s, { ...s.event, area });
}

export function setAcross(s: EditorState, across: EventArea['across']): EditorState {
  return changed(s, { ...s.event, area: { ...s.event.area, across } });
}

/** Times are set as the screen shows them and kept as the sim counts them. */
const sim = (screen: number): number => screen * TIME_SCALE;

export function setOn(s: EditorState, on: Who): EditorState {
  return changed(s, { ...s.event, effect: { ...s.event.effect, on } });
}

export function setName(s: EditorState, name: string): EditorState {
  return changed(s, { ...s.event, name });
}

/** A number on the editor that has a slider (round 4, e1, e2): a time on screen, or a place in yards. */
export type NumberKey =
  'goesOff' | 'buildUp' | 'lasts' | 'from' | 'to' | 'width' | 'at' | 'out' | 'radius';

export interface EventNumber {
  readonly key: NumberKey;
  readonly label: string;
  /** As shown: seconds on screen, or yards. */
  readonly value: number;
  readonly unit: 's' | 'yd';
  /** A place measured from the line of scrimmage, so read with its sign: "+16 yd", "−1 yd". */
  readonly fromLine: boolean;
  readonly range: { readonly min: number; readonly max: number; readonly step: number };
}

/** Seconds as the editor reads them: to the hundredth, or the thousandth when it's needed ("0.875 s"). */
export function secondsText(s: number): string {
  return `${s.toFixed(3).replace(/(\.\d\d)0$/, '$1')} s`;
}

/** A slider's number as it reads (m1): seconds, or yards to a tenth, signed when from the line. */
export function numberText(n: EventNumber): string {
  if (n.unit === 's') return secondsText(n.value);
  const yd = Math.round(n.value * 10) / 10;
  if (!n.fromLine) return `${yd} yd`;
  return `${yd < 0 ? '−' : '+'}${Math.abs(yd)} yd`;
}

/** A sim time as the screen shows it, free of float dust. */
const onScreen = (sim: number): number => Math.round((sim / TIME_SCALE) * 1e6) / 1e6;

/** The sliders an event has: its three times, then its area's numbers (a lane's or band's edges and width, or a circle's place and size). */
export function eventNumbers(e: FieldEvent): EventNumber[] {
  const time = (
    key: NumberKey,
    label: string,
    sim: number,
    min: number,
    max: number,
    step = 0.05,
  ): EventNumber => ({
    key,
    label,
    value: onScreen(sim),
    unit: 's',
    fromLine: false,
    range: { min, max, step },
  });
  const yards = (
    key: NumberKey,
    label: string,
    value: number,
    min: number,
    max: number,
    step = 0.5,
  ): EventNumber => ({
    key,
    label,
    value,
    unit: 'yd',
    fromLine: key === 'from' || key === 'to' || key === 'at',
    range: { min, max, step },
  });
  const times = [
    time('goesOff', 'Goes off after the snap', e.goesOff, 0.25, 5),
    time('buildUp', 'Warning before it goes off', e.warning.buildUp, 0, 3, 0.025),
    time('lasts', 'Its effect lasts', e.lasts, 0.2, 4),
  ];
  const a = e.area;
  if (a.shape === 'circle') {
    return [
      ...times,
      yards('at', 'Ahead of the line', a.at, BEHIND, FARTHEST),
      // A circle in the middle has no way out to set (review b4).
      ...(drawnSide(a) === 0 ? [] : [yards('out', 'Out from the middle', a.out, 0, HW, 0.1)]),
      yards('radius', 'Radius', a.radius, LEAST, HW),
    ];
  }
  return [
    ...times,
    yards('from', 'Near edge, from the line', a.from, BEHIND, FARTHEST - LEAST),
    yards('to', 'Far edge, from the line', a.to, BEHIND + LEAST, FARTHEST),
    yards('width', 'Width', a.width, LEAST, 2 * HW, 0.1),
  ];
}

/** One number set exactly (a slider moved, or ↺), held to what the game can play. One step for Undo. */
export function setNumber(s: EditorState, key: NumberKey, value: number): EditorState {
  const e = s.event;
  const a = e.area;
  const area = (next: EventArea): EditorState => changed(s, { ...e, area: next });
  switch (key) {
    case 'goesOff':
      return changed(s, { ...e, goesOff: sim(value) });
    case 'buildUp':
      return changed(s, { ...e, warning: { ...e.warning, buildUp: sim(value) } });
    case 'lasts':
      return changed(s, { ...e, lasts: sim(value) });
    case 'from':
    case 'to':
    case 'width':
    case 'at':
    case 'out':
    case 'radius':
      return area(holdArea(a, key, value));
    default:
      return assertNever(key);
  }
}

/** A slider being dragged: which, and the editor as it was when the knob was grabbed. */
export interface SliderDrag {
  readonly key: NumberKey;
  readonly from: EditorState;
}

/**
 * A slider moved (review b1): within one drag (until the knob is let go,
 * when the page drops `drag`), each move replaces the last, so the drag is
 * one step for Undo; a move of another slider starts its own.
 */
export function dragNumber(
  s: EditorState,
  drag: SliderDrag | null,
  key: NumberKey,
  value: number,
): { state: EditorState; drag: SliderDrag } {
  const d = drag?.key === key ? drag : { key, from: s };
  return { state: setNumber(d.from, key, value), drag: d };
}

/** The whole event replaced (Restore defaults, or Revert to saved): one step for Undo. */
export function replaceEvent(s: EditorState, event: FieldEvent): EditorState {
  return sameEvent(s.event, event) ? s : changed(s, event);
}

/** An event's down in seconds on screen from the snap: its warning starting, going off, and its effect ending. */
export interface EventTimeline {
  readonly warning: number;
  readonly goesOff: number;
  readonly ends: number;
}

/**
 * The event's down as a timeline, in seconds on screen from the snap (e4):
 * the warning starts its length before it goes off (never before the
 * snap), and its effect ends `lasts` after.
 */
export function eventTimeline(e: FieldEvent): EventTimeline {
  return {
    warning: Math.max(0, onScreen(e.goesOff - e.warning.buildUp)),
    goesOff: onScreen(e.goesOff),
    ends: onScreen(e.goesOff + e.lasts),
  };
}

/** The timeline's words, left to right, read as the sliders read (review d2). */
export function timelineText(t: EventTimeline): string[] {
  return [
    'snap',
    `warning ${secondsText(t.warning)}`,
    `goes off ${secondsText(t.goesOff)}`,
    `ends ${secondsText(t.ends)}`,
  ];
}

/** A new event: generic, with the plain look, its id from its name and never one already taken. */
export function newEvent(name: string, taken: readonly string[]): FieldEvent {
  const base = idFromName(name);
  let id = base;
  for (let n = 2; taken.includes(id); n++) id = `${base}${n}`;
  return {
    id,
    name,
    boss: null,
    area: { shape: 'circle', across: 'right', out: 4, at: 10, radius: 2 },
    goesOff: 1.6,
    lasts: 1.2,
    warning: { buildUp: 0.7 },
    effect: { kind: 'flatten', on: 'everyone' },
    call: 'TACKLED!',
    look: 'plain',
  };
}

/** The word called when it tackles a carrier; a blank one means it says nothing. */
export function setCall(s: EditorState, call: string): EditorState {
  const words = call.trim();
  return changed(s, { ...s.event, call: words === '' ? null : words });
}

/** Saved events by id, as saved-events.json holds them. */
export type SavedEvents = Readonly<Record<string, FieldEvent>>;

/** Whether two events are the same in every part (Save's question, and the Save button's). */
export const sameEvent = (a: FieldEvent, b: FieldEvent): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

/** The saved file with this event kept, or dropped if it's back at its default. */
export function savedWith(saved: SavedEvents, event: FieldEvent): SavedEvents {
  const def = fieldEventDefaults.find((d) => d.id === event.id);
  if (def && sameEvent(def, event)) return savedWithout(saved, event.id);
  return { ...saved, [event.id]: event };
}

/** The saved file without this event (Restore defaults, or deleting one you made). */
export function savedWithout(saved: SavedEvents, id: string): SavedEvents {
  return Object.fromEntries(Object.entries(saved).filter(([k]) => k !== id));
}
