/**
 * Field events (docs/FIELD_EVENTS.md): things that happen on the field
 * during a down, each four parts: an area, when it goes off, a warning
 * before it does, and an effect on whoever is in it. These are the
 * defaults; the event editor's Save lays its own over them.
 *
 * Times are sim seconds (the screen's times 0.8); distances are yards, from
 * the line of scrimmage upfield.
 */
import { assertNever } from '../../assertNever';
import type { BossName } from '../sim/types';
import saved from './saved-events.json' with { type: 'json' };
import { checkSavedEvents, layerEvents } from './savedEvents';
import { arcadeTuning } from './tuning';

/** Where across the field an area sits: against a sideline, in the middle, or either side picked each down. */
export type Across = 'left' | 'middle' | 'right' | 'either';

/**
 * A lane (down the field) or a band (across it): `width` yards across, from
 * `from` to `to` yards past the line. Laid out alike; the names say which
 * way it runs.
 */
export interface RectArea {
  readonly shape: 'lane' | 'band';
  readonly across: Across;
  readonly width: number;
  readonly from: number;
  readonly to: number;
}

/** A circle: its middle `out` yards from the field's middle (toward its side) and `at` yards past the line. */
export interface CircleArea {
  readonly shape: 'circle';
  readonly across: Across;
  readonly out: number;
  readonly at: number;
  readonly radius: number;
}

export type EventArea = RectArea | CircleArea;

/** Who an effect hits: your players, the defenders, or everyone. */
export type Who = 'yours' | 'theirs' | 'everyone';

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

/** Blessing, hex or mischief: an event that can only help you, only hurt you, or do both. */
export type EventKind = 'blessing' | 'hex' | 'mischief';

/** An event's kind, from its effect and who it hits: flattening yours hurts you, theirs helps you, everyone both. */
export function eventKind(event: FieldEvent): EventKind {
  switch (event.effect.on) {
    case 'yours':
      return 'hex';
    case 'theirs':
      return 'blessing';
    case 'everyone':
      return 'mischief';
    default:
      return assertNever(event.effect.on);
  }
}

/** The ids of the events in the code: what a drive may name, so a wrong one won't compile. */
export type DefaultEventId = 'frogRain';

const DEFAULTS: Readonly<Record<DefaultEventId, FieldEvent>> = { frogRain: FROG_RAIN };

/** Every field event as the code has it. */
export const fieldEventDefaults: readonly FieldEvent[] = Object.values(DEFAULTS);

const savedEvents = checkSavedEvents(saved);

/** What the game plays: the defaults, with `saved-events.json` laid over them. */
export const fieldEvents: readonly FieldEvent[] = layerEvents(
  fieldEventDefaults,
  savedEvents.events,
);

/** Saved events left out as `fieldEvents` was made (none, normally); the game shows them. */
export const savedEventWarnings: readonly string[] = savedEvents.warnings;

/** The field event with this id, as the game plays it. */
export function fieldEventById(id: DefaultEventId): FieldEvent {
  const e = fieldEvents.find((x) => x.id === id);
  if (!e) throw new Error(`no field event ${id}`);
  return e;
}
