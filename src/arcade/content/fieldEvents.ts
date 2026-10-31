/**
 * Field events (docs/FIELD_EVENTS.md): things that happen on the field
 * during a down, each four parts: an area, when it goes off, a warning
 * before it does, and an effect on whoever is in it. These are the
 * defaults; the event editor's Save lays its own over them.
 *
 * Times are sim seconds (the screen's times 0.8); distances are yards, from
 * the line of scrimmage upfield.
 */
import type { BossName } from '../sim/types';
import { arcadeTuning } from './tuning';

/** Where across the field an area sits: against a sideline, in the middle, or either side picked each down. */
export type Across = 'left' | 'middle' | 'right' | 'either';

/** A lane: down the field, `width` yards wide, from `from` to `to` yards past the line. */
export interface LaneArea {
  readonly shape: 'lane';
  readonly across: Across;
  readonly width: number;
  readonly from: number;
  readonly to: number;
}

export type EventArea = LaneArea;

/** Who an effect hits: your players, the defenders, or everyone. */
export type Who = 'everyone';

/** Flatten: knocked down for the event's `lasts`; a carrier is tackled there. */
export interface FlattenEffect {
  readonly kind: 'flatten';
  readonly on: Who;
}

export type EventEffect = FlattenEffect;

/** The warning: shown faintly before the snap, then the event's own build-up for this long before it goes off. */
export interface EventWarning {
  readonly buildUp: number;
}

/** Each event's own art (render/), or the plain look an event made on the editor has until it gets some. */
export type EventLook = 'frogRain' | 'plain';

export interface FieldEvent {
  readonly id: string;
  readonly name: string;
  /** The Boss whose gimmick it is, or null for a generic event. */
  readonly boss: BossName | null;
  readonly area: EventArea;
  /** It goes off this long after the snap, as a burst: whoever is in it then… */
  readonly goesOff: number;
  /** …has its effect for this long. */
  readonly lasts: number;
  readonly warning: EventWarning;
  readonly effect: EventEffect;
  /** Called when it tackles a carrier, or null. */
  readonly call: string | null;
  readonly look: EventLook;
}

/**
 * Mister Frog's Frog Rain: a lane shown before the snap, in from a sideline
 * (either, at random) and never over the pumpkin, so Flip matters; then the
 * frogs all come down at once.
 */
export const FROG_RAIN: FieldEvent = {
  id: 'frogRain',
  name: 'Frog Rain',
  boss: 'misterFrog',
  area: {
    shape: 'lane',
    across: 'either',
    width: 0.4 * 2 * arcadeTuning.field.halfWidth,
    from: -1,
    to: 16,
  },
  goesOff: 1.6,
  lasts: 1.2,
  warning: { buildUp: 0.7 },
  effect: { kind: 'flatten', on: 'everyone' },
  call: 'FROGGED!',
  look: 'frogRain',
};

/** Every field event as the code has it. */
export const fieldEventDefaults: readonly FieldEvent[] = [FROG_RAIN];

/** The field event with this id. */
export function fieldEventById(id: string): FieldEvent {
  const e = fieldEventDefaults.find((x) => x.id === id);
  if (!e) throw new Error(`no field event ${id}`);
  return e;
}
