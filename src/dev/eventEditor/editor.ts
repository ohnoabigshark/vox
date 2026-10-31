/**
 * The event editor's rules (docs/FIELD_EVENTS.md, f2, p1), kept apart from
 * the page so they're tested: dragging and sizing an event's area on the
 * field, its other parts, Undo, a new event, and what Save keeps.
 *
 * The field is in yards from the line of scrimmage (x across, y upfield), as
 * the play editor's is. An area on "either" side is drawn on the right.
 */
import {
  fieldEventDefaults,
  type EventArea,
  type FieldEvent,
  type Who,
} from '../../arcade/content/fieldEvents';
import { arcadeTuning, TIME_SCALE } from '../../arcade/content/tuning';
import { clamp } from '../../arcade/sim/vec';
import { idFromName } from '../playEditor/sketches';

export interface Yards {
  readonly x: number;
  readonly y: number;
}

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
/** How far behind the line an area may start (Jack's deepest drop). */
const BEHIND = -6;

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

/** Which way across the field an area's side lies: −1 left, 0 the middle, 1 right ("either" is drawn right). */
function sideSign(area: EventArea): -1 | 0 | 1 {
  return area.across === 'left' ? -1 : area.across === 'middle' ? 0 : 1;
}

/**
 * The area moved by a drag of `by` yards from where it was when the drag
 * began (`start`): upfield for any shape, and across too for a circle on a
 * side (a lane's or band's side is a chip). One step for Undo.
 */
export function moveArea(start: EditorState, by: Yards): EditorState {
  const a = start.event.area;
  if (a.shape === 'circle') {
    const sign = sideSign(a);
    const out = sign === 0 ? 0 : clamp(snap(a.out + sign * by.x), 0, HW);
    return changed(start, { ...start.event, area: { ...a, out, at: snap(a.at + by.y) } });
  }
  const length = a.to - a.from;
  const from = Math.max(BEHIND, snap(a.from + by.y));
  return changed(start, { ...start.event, area: { ...a, from, to: from + length } });
}

/** Where each of the area's handles is drawn, in field yards. */
export function handlesOf(area: EventArea): { handle: Handle; at: Yards }[] {
  const sign = sideSign(area);
  if (area.shape === 'circle') {
    const x = sign * area.out;
    return [{ handle: 'edge', at: { x: x + area.radius, y: area.at } }];
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
  const sign = sideSign(area);
  const half = area.width / 2;
  const x = sign * (HW - half);
  return { x0: x - half, x1: x + half };
}

/** The area with `handle` dragged to `to` (field yards), snapped and never inside out. One step for Undo. */
export function sizeArea(start: EditorState, handle: Handle, to: Yards): EditorState {
  const a = start.event.area;
  const set = (area: EventArea): EditorState => changed(start, { ...start.event, area });
  if (a.shape === 'circle') {
    const r = Math.hypot(to.x - sideSign(a) * a.out, to.y - a.at);
    return set({ ...a, radius: clamp(snap(r), LEAST, HW) });
  }
  switch (handle) {
    case 'near':
      return set({ ...a, from: clamp(snap(to.y), BEHIND, a.to - LEAST) });
    case 'far':
      return set({ ...a, to: Math.max(a.from + LEAST, snap(to.y)) });
    case 'width': {
      const sign = sideSign(a);
      const width = sign === 0 ? 2 * Math.abs(to.x) : sign * (sign * HW - to.x);
      return set({ ...a, width: clamp(snap(width), LEAST, 2 * HW) });
    }
    case 'edge':
      return start;
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

export function setGoesOff(s: EditorState, screen: number): EditorState {
  return changed(s, { ...s.event, goesOff: sim(screen) });
}

export function setLasts(s: EditorState, screen: number): EditorState {
  return changed(s, { ...s.event, lasts: sim(screen) });
}

export function setBuildUp(s: EditorState, screen: number): EditorState {
  return changed(s, { ...s.event, warning: { ...s.event.warning, buildUp: sim(screen) } });
}

export function setOn(s: EditorState, on: Who): EditorState {
  return changed(s, { ...s.event, effect: { ...s.event.effect, on } });
}

export function setName(s: EditorState, name: string): EditorState {
  return changed(s, { ...s.event, name });
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
    call: null,
    look: 'plain',
  };
}

/** Saved events by id, as saved-events.json holds them. */
export type SavedEvents = Readonly<Record<string, FieldEvent>>;

const same = (a: FieldEvent, b: FieldEvent): boolean => JSON.stringify(a) === JSON.stringify(b);

/** The saved file with this event kept, or dropped if it's back at its default. */
export function savedWith(saved: SavedEvents, event: FieldEvent): SavedEvents {
  const def = fieldEventDefaults.find((d) => d.id === event.id);
  if (def && same(def, event)) return savedWithout(saved, event.id);
  return { ...saved, [event.id]: event };
}

/** The saved file without this event (Restore defaults, or deleting one you made). */
export function savedWithout(saved: SavedEvents, id: string): SavedEvents {
  return Object.fromEntries(Object.entries(saved).filter(([k]) => k !== id));
}
