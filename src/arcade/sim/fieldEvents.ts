/**
 * Field events in the sim (docs/FIELD_EVENTS.md): placed on the field each
 * down from the run's seed, counting down from the snap, and going off as a
 * burst: whoever is in the area then has the effect.
 */
import { arcadeTuning, DT } from '../content/tuning';
import type { EventArea, FieldEvent } from '../content/fieldEvents';
import { rngFor } from './random';
import type { Body, FieldEventOn, PlacedArea, RunState } from './types';

/**
 * Where the event's area lies this down, in field yards. "Either" side is
 * picked from the seed (the stream Frog Rain's lane has always used, so a
 * seeded run places it where it always did).
 */
export function placeArea(state: RunState, area: EventArea): PlacedArea {
  const hw = arcadeTuning.field.halfWidth;
  const { los } = state.drive;
  const rng = rngFor(state.seed, 'frogLane', state.drivesWon, state.drive.down, state.nextId);
  const half = area.width / 2;
  const side =
    area.across === 'left'
      ? -1
      : area.across === 'right'
        ? 1
        : area.across === 'middle'
          ? 0
          : rng.next() < 0.5
            ? -1
            : 1;
  const x = side * (hw - half);
  return { shape: 'rect', x0: x - half, x1: x + half, y0: los + area.from, y1: los + area.to };
}

/** The event placed for this down, not yet counting (it starts at the hike). */
export function placeEvent(state: RunState, event: FieldEvent): FieldEventOn {
  return { event, area: placeArea(state, event.area), left: null };
}

/** Whether a body is in the area (any part of it). */
export function inArea(area: PlacedArea, b: Body): boolean {
  return (
    b.pos.x >= area.x0 - b.radius &&
    b.pos.x <= area.x1 + b.radius &&
    b.pos.y >= area.y0 - b.radius &&
    b.pos.y <= area.y1 + b.radius
  );
}

/**
 * Who the event catches as it goes off: everyone in the area on their feet,
 * but never Jack before he runs, nor a defender locked up with one of your
 * players (a Rhino Beetle, planted).
 */
export function caughtBy(state: RunState, on: FieldEventOn): Body[] {
  return [...state.field.players, ...state.field.defenders].filter(
    (b) =>
      b.down <= 0 &&
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

/** Whether the event is still to go off this down, with its area a danger to the carrier. */
export function comingFor(on: FieldEventOn | null): on is FieldEventOn {
  return on !== null && on.left !== null && on.left > 0;
}
