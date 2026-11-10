/**
 * Field events (docs/FIELD_EVENTS.md): things that happen on the field
 * during a down, each four parts: an area, when and how it goes off (a
 * burst or a spell), a warning before it does, and an effect on whoever is
 * in it. These are the
 * defaults; the event editor's Save lays its own over them.
 *
 * Times are sim seconds (the screen's times 0.8); distances are yards, from
 * the line of scrimmage upfield.
 */
import { assertNever } from '../../assertNever';
import type { BossName } from '../sim/types';
import saved from './saved-events.json' with { type: 'json' };
import { checkSavedEvents, layerEvents } from './savedEvents';
import {
  kindOf,
  statusPolarity,
  type Polarity,
  type SourceKind,
  type EventStatus,
  type Who,
} from './statuses';
import { arcadeTuning, TIME_SCALE } from './tuning';

/**
 * Where across the field an area sits: against a sideline, in the middle,
 * either side picked each down, or any of the three picked each down
 * (`field-places`, p2's puddle).
 */
export type Across = 'left' | 'middle' | 'right' | 'either' | 'any';

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

/** How near and far an event's near edge may land each down, in yards past the line (`field-places`, p1). */
export interface EventReach {
  readonly nearest: number;
  readonly farthest: number;
}

/**
 * How much smaller or bigger an event may be each down (`field-places`, z1):
 * times its area's depth (a lane's or band's `to − from`) or a circle's
 * radius. The width across never scales.
 */
export interface EventSize {
  readonly smallest: number;
  readonly largest: number;
}

/** Who an effect hits (`content/statuses.ts`). */
export type { Who } from './statuses';

/** Flatten: knocked down for the event's `lasts`; a carrier is tackled there. */
export interface FlattenEffect {
  readonly kind: 'flatten';
  readonly on: Who;
}

/** A status (docs/STATUSES.md) given to whoever it catches: for the event's `lasts` from a burst, while they're in it from a spell. */
export interface StatusEffect {
  readonly kind: 'status';
  readonly status: EventStatus;
  readonly on: Who;
}

export type EventEffect = FlattenEffect | StatusEffect;

/**
 * How it goes off: a burst hits whoever is in the area at that moment; a
 * spell holds whoever is in it for its `lasts`, letting go as they leave. A
 * spell gives a status (a knockdown is a moment's, so it's a burst's:
 * `content/spells.ts`).
 */
export type GoesOffAs = 'burst' | 'spell';

/** The warning: shown faintly before the snap, then the event's own build-up for this long before it goes off. */
export interface EventWarning {
  readonly buildUp: number;
}

/** Each event's own art (render/), or the plain look an event made on the editor has until it gets some. */
export type EventLook = 'frogRain' | 'taffyFlood' | 'wisps' | 'plain';

export interface FieldEvent {
  readonly id: string;
  readonly name: string;
  /** The Boss whose gimmick it is, or null for a generic event. */
  readonly boss: BossName | null;
  /** The shapes it may take, one picked each down, each as likely (most events have one). */
  readonly areas: readonly [EventArea, ...EventArea[]];
  /** Where its near edge may land each down, or null: where its area says. */
  readonly reach: EventReach | null;
  /** How its size may vary each down, or null: as its area is. */
  readonly size: EventSize | null;
  /** It goes off this long after the snap… */
  readonly goesOff: number;
  /** …as a burst (whoever is in it then) or a spell (whoever is in it while it lasts)… */
  readonly goesOffAs: GoesOffAs;
  /** …and its effect lasts this long. */
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
  areas: [
    {
      shape: 'lane',
      across: 'either',
      width: 0.4 * 2 * arcadeTuning.field.halfWidth,
      from: -1,
      to: 16,
    },
  ],
  reach: null,
  size: null,
  goesOff: 1.6,
  goesOffAs: 'burst',
  lasts: 1.2,
  warning: { buildUp: 0.7 },
  effect: { kind: 'flatten', on: 'everyone' },
  call: 'FROGGED!',
  look: 'frogRain',
};

/**
 * The taffy flood (FIELD_EVENTS.md round 5, t1, and `field-places`):
 * mischief. Pink candy, bubbling up after the snap; 1 s after it, it floods,
 * and for 2.5 s everyone in it is Slowed. Each down the seed picks its shape
 * (a band across the whole field, a half band against either sideline, or a
 * puddle in the middle or toward either side), its near edge 2 to 12 yards
 * past the line, and its size, 0.75x to 1.5x (bands 3 to 6 yards deep,
 * puddles 4.5 to 9 across). A full band has no way round, so the carrier
 * runs straight at it; he steers round the others (ai.ts).
 */
export const TAFFY_FLOOD: FieldEvent = {
  id: 'taffyFlood',
  name: 'Taffy Flood',
  boss: null,
  areas: [
    { shape: 'band', across: 'middle', width: 2 * arcadeTuning.field.halfWidth, from: 3, to: 7 },
    { shape: 'band', across: 'either', width: arcadeTuning.field.halfWidth, from: 3, to: 7 },
    { shape: 'circle', across: 'any', out: 4, at: 6, radius: 3 },
  ],
  reach: { nearest: 2, farthest: 12 },
  size: { smallest: 0.75, largest: 1.5 },
  goesOff: 1 * TIME_SCALE,
  goesOffAs: 'spell',
  lasts: 2.5 * TIME_SCALE,
  warning: { buildUp: 0.6 },
  effect: { kind: 'status', status: 'slowed', on: 'everyone' },
  call: null,
  look: 'taffyFlood',
};

/**
 * The will-o'-wisps (FIELD_EVENTS.md, w1, and `field-places` z2): a
 * blessing. A circle 6 yards across, 6 yards past the line (3 to 9) on
 * either side (picked each down, as Frog Rain's lane is); each down its size
 * too, 0.75x to 1.25x (4.5 to 7.5 across), its near edge staying at 3
 * yards. Pale green lights hover in it from before the snap;
 * 1 s after it, they flare, and for 3 s your players in it are Ethereal:
 * no defender can grab or tackle them, and they pass through each other.
 */
export const WILL_O_WISPS: FieldEvent = {
  id: 'willOWisps',
  name: 'Will-o’-Wisps',
  boss: null,
  areas: [{ shape: 'circle', across: 'either', out: 5, at: 6, radius: 3 }],
  reach: null,
  size: { smallest: 0.75, largest: 1.25 },
  goesOff: 1 * TIME_SCALE,
  goesOffAs: 'spell',
  lasts: 3 * TIME_SCALE,
  warning: { buildUp: 0.6 },
  effect: { kind: 'status', status: 'ethereal', on: 'yours' },
  call: null,
  look: 'wisps',
};

/** An event's area `i`, or its first if it has none such: the one place that fallback is decided. */
export function areaAt(event: FieldEvent, i: number): EventArea {
  return event.areas[i] ?? event.areas[0];
}

/** Whether the event has an area `i`. */
export function hasArea(event: FieldEvent, i: number): boolean {
  return Number.isInteger(i) && i >= 0 && i < event.areas.length;
}

/** The event with its area `i` replaced (still at least one area). */
export function withAreaAt(event: FieldEvent, i: number, area: EventArea): FieldEvent {
  const [first, ...rest] = event.areas.map((a, j) => (j === i ? area : a));
  return { ...event, areas: [first ?? area, ...rest] };
}

/**
 * An event's kind, from its effect and who it hits (docs/STATUSES.md, s4):
 * a knockdown hurts, so flattening yours is a hex, theirs a blessing,
 * everyone mischief; a status helps or hurts as that status does.
 */
export function eventKind(event: FieldEvent): SourceKind {
  return kindOf(effectPolarity(event.effect), event.effect.on);
}

/** Whether an effect helps the bodies it lands on or hurts them. */
export function effectPolarity(effect: EventEffect): Polarity {
  switch (effect.kind) {
    case 'flatten':
      return 'hurts';
    case 'status':
      return statusPolarity(effect.status);
    default:
      return assertNever(effect);
  }
}

/** The ids of the events in the code: what a series may name, so a wrong one won't compile. */
export type DefaultEventId = 'frogRain' | 'taffyFlood' | 'willOWisps';

const DEFAULTS: Readonly<Record<DefaultEventId, FieldEvent>> = {
  frogRain: FROG_RAIN,
  taffyFlood: TAFFY_FLOOD,
  willOWisps: WILL_O_WISPS,
};

/**
 * Halloween's generic events (a2): what a stretch the seed picks may get,
 * in any of its three areas (sim/run.ts, `genericEventFor`). Another set
 * gets its own.
 */
export const GENERIC_EVENTS: readonly DefaultEventId[] = ['taffyFlood', 'willOWisps'];

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
