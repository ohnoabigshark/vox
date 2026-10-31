/**
 * Field events in the sim (docs/FIELD_EVENTS.md): placed on the field each
 * down from the run's seed, counting down from the snap, and going off as a
 * burst: whoever is in the area then has the effect.
 */
import { arcadeTuning, DT } from '../content/tuning';
import { assertNever } from '../../assertNever';
import type { Across, EventArea, FieldEvent, Who } from '../content/fieldEvents';
import { rngFor } from './random';
import type { Body, FieldEventOn, PlacedArea, RunState } from './types';
import { dist, v } from './vec';

/**
 * Where the event's area lies this down, in field yards. "Either" side is
 * picked from the seed (the stream Frog Rain's lane has always used, so a
 * seeded run places it where it always did).
 */
export function placeArea(state: RunState, area: EventArea): PlacedArea {
  const hw = arcadeTuning.field.halfWidth;
  const { los } = state.drive;
  const side = sideOf(state, area.across);
  if (area.shape === 'circle') {
    return { shape: 'circle', x: side * area.out, y: los + area.at, r: area.radius };
  }
  // A lane or band on a side runs in from that sideline.
  const half = area.width / 2;
  const x = side * (hw - half);
  return { shape: 'rect', x0: x - half, x1: x + half, y0: los + area.from, y1: los + area.to };
}

/** Which side an area sits on this down: −1 left, 0 the middle, 1 right; either from the seed. */
function sideOf(state: RunState, across: Across): -1 | 0 | 1 {
  switch (across) {
    case 'left':
      return -1;
    case 'middle':
      return 0;
    case 'right':
      return 1;
    case 'either': {
      const rng = rngFor(state.seed, 'frogLane', state.drivesWon, state.drive.down, state.nextId);
      return rng.next() < 0.5 ? -1 : 1;
    }
    default:
      return assertNever(across);
  }
}

/** The event placed for this down, not yet counting (it starts at the hike). */
export function placeEvent(state: RunState, event: FieldEvent): FieldEventOn {
  return { event, area: placeArea(state, event.area), left: null };
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
  return [...state.field.players, ...state.field.defenders].filter(
    (b) =>
      b.down <= 0 &&
      hits(on.event.effect.on, b.side) &&
      !(b.side === 'team' && b.role === 'qb') &&
      !(b.side === 'defense' && b.planted) &&
      inArea(on.area, b),
  );
}

/**
 * Count the event down one step of live play: true on the step it goes
 * off. Past zero it counts on to −1 for the show, then stops.
 */
export function countDown(on: FieldEventOn): boolean {
  const left = on.left;
  if (left === null) return false;
  const next = left - DT;
  on.left = next < -1 ? null : next;
  return left > 0 && next <= 0;
}

/** Whether the event is still to go off this down and would catch the carrier (one of yours): one to steer clear of. */
export function comingFor(on: FieldEventOn | null): on is FieldEventOn {
  return on !== null && on.left !== null && on.left > 0 && hits(on.event.effect.on, 'team');
}
