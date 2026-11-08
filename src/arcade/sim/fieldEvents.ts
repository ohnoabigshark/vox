/**
 * Field events in the sim (docs/FIELD_EVENTS.md): placed on the field each
 * down from the run's seed, counting down from the snap, and going off as a
 * burst (whoever is in the area then has the effect) or a spell (whoever is
 * in it while it lasts).
 */
import { arcadeTuning, DT } from '../content/tuning';
import { assertNever } from '../../assertNever';
import {
  effectPolarity,
  type Across,
  type EventArea,
  type FieldEvent,
  type Who,
} from '../content/fieldEvents';
import { spellStatus } from '../content/spells';
import { allBodies } from './physics';
import { rngFor } from './random';
import { sameSource, statusOf } from './status';
import type { Body, FieldEventOn, PlacedArea, RunState, StatusSource } from './types';
import { dist, v } from './vec';

/**
 * Where the event's area lies this down, in field yards. "Either" side is
 * picked from the seed (the stream Frog Rain's lane has always used, so a
 * seeded run places it where it always did).
 */
export function placeArea(state: RunState, area: EventArea): PlacedArea {
  const { los } = state.series;
  const rng = () =>
    rngFor(state.seed, 'frogLane', state.seriesWon, state.series.down, state.nextId);
  const side = sideOf(
    area.across,
    () => (rng().next() < 0.5 ? -1 : 1),
    () => SIDES[rng().int(0, SIDES.length - 1)] ?? 0,
  );
  if (area.shape === 'circle') {
    return { shape: 'circle', x: circleX(area.out, side), y: los + area.at, r: area.radius };
  }
  return { shape: 'rect', ...rectXs(area.width, side), y0: los + area.from, y1: los + area.to };
}

const SIDES = [-1, 0, 1] as const;

/** Which side an area sits on: −1 left, 0 the middle, 1 right; "either" as `either` picks it, "any" as `any` does. */
export function sideOf(across: Across, either: () => -1 | 1, any: () => -1 | 0 | 1): -1 | 0 | 1 {
  switch (across) {
    case 'left':
      return -1;
    case 'middle':
      return 0;
    case 'right':
      return 1;
    case 'either':
      return either();
    case 'any':
      return any();
    default:
      return assertNever(across);
  }
}

/** A lane's or band's edges across: on a side it runs in from that sideline; in the middle, centred. */
export function rectXs(width: number, side: -1 | 0 | 1): { x0: number; x1: number } {
  const half = width / 2;
  const x = side * (arcadeTuning.field.halfWidth - half);
  return { x0: x - half, x1: x + half };
}

/** A circle's middle across: `out` yards from the field's middle, toward its side. */
export function circleX(out: number, side: -1 | 0 | 1): number {
  return side * out;
}

/**
 * The event's area for this down (docs/FIELD_EVENTS.md, `field-places`):
 * one of its areas, each as likely; its near edge within its reach (or the
 * area's own); its depth or radius scaled within its size. From the seed,
 * on a stream of its own, so the cards dealt, the pickups and the side an
 * area is on stay as they were. An event with one area, no reach and no
 * size draws nothing: its area as it is (Frog Rain).
 */
export function shapeFor(state: RunState, event: FieldEvent): EventArea {
  const { areas, reach, size } = event;
  if (areas.length === 1 && reach === null && size === null) return areas[0];
  const rng = rngFor(state.seed, 'eventPlace', state.seriesWon, state.series.down, state.nextId);
  const area = areas[rng.int(0, areas.length - 1)] ?? areas[0];
  const scale = size ? between(size.smallest, size.largest, rng.next()) : 1;
  const near = reach ? between(reach.nearest, reach.farthest, rng.next()) : nearEdge(area);
  if (area.shape === 'circle') {
    const radius = area.radius * scale;
    return { ...area, at: near + radius, radius };
  }
  return { ...area, from: near, to: near + (area.to - area.from) * scale };
}

/** An area's near edge, in yards past the line: a lane's or band's `from`, a circle's nearest point. */
export function nearEdge(area: EventArea): number {
  return area.shape === 'circle' ? area.at - area.radius : area.from;
}

/** The number a share `t` (0 to 1) of the way from `a` to `b`. */
const between = (a: number, b: number, t: number): number => a + (b - a) * t;

/** The event placed for this down, not yet counting (it starts at the hike). */
export function placeEvent(state: RunState, event: FieldEvent): FieldEventOn {
  return { event, area: placeArea(state, shapeFor(state, event)), left: null };
}

/** Whether a body is in the area (any part of it). */
export function inArea(area: PlacedArea, b: Pick<Body, 'pos' | 'radius'>): boolean {
  if (area.shape === 'circle') return dist(b.pos, v(area.x, area.y)) <= area.r + b.radius;
  return (
    b.pos.x >= area.x0 - b.radius &&
    b.pos.x <= area.x1 + b.radius &&
    b.pos.y >= area.y0 - b.radius &&
    b.pos.y <= area.y1 + b.radius
  );
}

/** The area's box: its left and right edges and its far edge upfield. */
export function areaBox(area: PlacedArea): { x0: number; x1: number; y1: number } {
  if (area.shape === 'rect') return area;
  return { x0: area.x - area.r, x1: area.x + area.r, y1: area.y + area.r };
}

/** Whether an effect on `who` reaches a body of this side. */
function hits(who: Who, side: Body['side']): boolean {
  switch (who) {
    case 'everyone':
      return true;
    case 'yours':
      return side === 'team';
    case 'theirs':
      return side === 'defense';
    default:
      return assertNever(who);
  }
}

/**
 * Who the event catches as it goes off: everyone in the area on their feet
 * and on the side it hits, but never Jack before he runs, nor a defender
 * locked up with one of your players (a Rhino Beetle, planted).
 */
export function caughtBy(state: RunState, on: FieldEventOn): Body[] {
  return allBodies(state).filter(
    (b) =>
      b.down <= 0 &&
      hits(on.event.effect.on, b.side) &&
      !(b.side === 'team' && b.role === 'qb') &&
      !(b.side === 'defense' && b.planted) &&
      inArea(on.area, b),
  );
}

/** How long after going off an event stays on the field for the show: a second, or a spell's whole time. */
function showsFor(event: FieldEvent): number {
  return Math.max(1, spellStatus(event) === null ? 0 : event.lasts);
}

/**
 * Count the event down one step of live play: true on the step it goes
 * off. Past zero it counts on (a second for the show, or a spell's time),
 * then stops.
 */
export function countDown(on: FieldEventOn): boolean {
  const left = on.left;
  if (left === null) return false;
  const next = left - DT;
  on.left = next < -showsFor(on.event) ? null : next;
  return left > 0 && next <= 0;
}

/** Whether a spell is on: gone off, and its `lasts` not yet over. False for a burst. */
export function spellOn(on: FieldEventOn): boolean {
  return (
    spellStatus(on.event) !== null && on.left !== null && on.left <= 0 && on.left > -on.event.lasts
  );
}

/**
 * Whether the spell holds this body: it has the spell's status, from this
 * event (the one place it's decided, for the sim and the look alike; the
 * review's r1). A status of the same name from elsewhere isn't held.
 */
export function heldBy(b: Pick<Body, 'statuses'>, on: FieldEventOn): boolean {
  const status = spellStatus(on.event);
  if (status === null) return false;
  const s = statusOf(b, status);
  return s !== undefined && sameSource(s.from, fromEvent(on.event));
}

/** The time a spell has left, once it's gone off. */
export function spellLeft(on: FieldEventOn): number {
  return on.left === null ? 0 : Math.max(0, on.left + on.event.lasts);
}

/** A field event as the source of the statuses it gives (docs/STATUSES.md, s5). */
export function fromEvent(event: FieldEvent): StatusSource {
  return { kind: 'fieldEvent', event: event.id };
}

/**
 * Whether the carrier (one of yours) should steer clear of the event: it
 * would catch him to his harm, and it's still to go off, or it's a spell
 * that's on (`field-places`, p4). A blessing (the wisps) isn't one.
 */
export function steerClearOf(on: FieldEventOn | null): on is FieldEventOn {
  return (
    on !== null &&
    on.left !== null &&
    (on.left > 0 || spellOn(on)) &&
    hits(on.event.effect.on, 'team') &&
    effectPolarity(on.event.effect) === 'hurts'
  );
}
