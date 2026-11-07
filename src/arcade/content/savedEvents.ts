/**
 * Saved events (docs/FIELD_EVENTS.md, k1): the events the Coach saved on the
 * event editor, laid over the defaults in fieldEvents.ts. A saved file is an
 * object of events by id; one that can't be read is left out with a warning
 * (never silently), and the rest are kept. One saved before spells
 * (2026-11-07) has no `goesOffAs`, and is read as the burst it was.
 *
 * It imports only types and the spell rule (spells.ts), so the hot-reload
 * server's config can check saves with it without reaching the saved file
 * (tools/savedFile.ts).
 */
import type { BossName } from '../sim/types';
import type { Across, EventLook, FieldEvent, GoesOffAs, Who } from './fieldEvents';
import { keepsSpellRule } from './spells';
import type { EventStatus } from './statuses';

type Tree = Record<string, unknown>;

// Every value each part may take; as Records, the compiler keeps them whole.
const ACROSS: Readonly<Record<Across, true>> = {
  left: true,
  middle: true,
  right: true,
  either: true,
};
const WHO: Readonly<Record<Who, true>> = { yours: true, theirs: true, everyone: true };
const LOOKS: Readonly<Record<EventLook, true>> = { frogRain: true, taffyFlood: true, plain: true };
const GOES_OFF_AS: Readonly<Record<GoesOffAs, true>> = { burst: true, spell: true };
const EVENT_STATUSES: Readonly<Record<EventStatus, true>> = { slowed: true };
const BOSSES: Readonly<Record<BossName, true>> = { misterFrog: true, queen: true, king: true };

const isTree = (x: unknown): x is Tree => typeof x === 'object' && x !== null && !Array.isArray(x);
const oneOf = <K extends string>(set: Readonly<Record<K, true>>, x: unknown): x is K =>
  typeof x === 'string' && Object.hasOwn(set, x);

/** Why `x` isn't a field event called `id`, or null if it is one (a saved file's, or a Try it link's). */
export function eventProblem(id: string, x: unknown): string | null {
  if (!isTree(x)) return 'it is not an event';
  if (x.id !== id) return `its id is ${String(x.id)}`;
  if (typeof x.name !== 'string' || x.name === '') return 'it has no name';
  if (x.boss !== null && !oneOf(BOSSES, x.boss)) return 'its boss is not one of the Bosses';
  const area = areaProblem(x.area);
  if (area) return area;
  // An event that never goes off, or has no effect, would fail without a word (review r2).
  for (const key of ['goesOff', 'lasts'] as const) {
    if (typeof x[key] !== 'number') return `${key} is not a number`;
    if (!(x[key] > 0 && Number.isFinite(x[key]))) return `${key} must be more than 0`;
  }
  const buildUp = isTree(x.warning) ? x.warning.buildUp : undefined;
  if (typeof buildUp !== 'number' || !(buildUp >= 0 && Number.isFinite(buildUp))) {
    return 'its build-up is not a number';
  }
  if (x.goesOffAs !== undefined && !oneOf(GOES_OFF_AS, x.goesOffAs)) {
    return 'it goes off as neither a burst nor a spell';
  }
  const effect = x.effect;
  const flattens = isTree(effect) && effect.kind === 'flatten';
  const gives = isTree(effect) && effect.kind === 'status' && oneOf(EVENT_STATUSES, effect.status);
  if (!isTree(effect) || !(flattens || gives)) return 'its effect is not one the game plays';
  if (!keepsSpellRule(readEvent(x))) return 'a spell must give a status';
  if (!oneOf(WHO, effect.on)) return 'its effect is not on yours, theirs or everyone';
  if (x.call !== null && typeof x.call !== 'string') return 'its call is not words';
  if (!oneOf(LOOKS, x.look)) return 'its look is not one the game draws';
  return null;
}

function areaProblem(a: unknown): string | null {
  if (!isTree(a) || (a.shape !== 'lane' && a.shape !== 'band' && a.shape !== 'circle')) {
    return 'its area is not a lane, band or circle';
  }
  if (!oneOf(ACROSS, a.across)) return 'its area is not on the left, middle, right or either side';
  const keys: readonly string[] =
    a.shape === 'circle' ? ['out', 'at', 'radius'] : ['width', 'from', 'to'];
  for (const key of keys) {
    if (typeof a[key] !== 'number' || !Number.isFinite(a[key])) {
      return `its area's ${key} is not a number`;
    }
  }
  // An area with no size catches nobody.
  const size = a.shape === 'circle' ? 'radius' : 'width';
  if (!((a[size] as number) > 0)) return `its area's ${size} must be more than 0`;
  if (a.shape !== 'circle' && !((a.to as number) > (a.from as number))) {
    return "its area's far edge must be past its near edge";
  }
  return null;
}

/** An event `eventProblem` passed, as the game plays it: one saved before spells is a burst. */
export function readEvent(x: unknown): FieldEvent {
  // Checked field by field by eventProblem.
  const e = x as Omit<FieldEvent, 'goesOffAs'> & { goesOffAs?: GoesOffAs };
  return { ...e, goesOffAs: e.goesOffAs ?? 'burst' };
}

/** The saved file's events that can be read, and a warning for each that can't. */
export function checkSavedEvents(saved: unknown): {
  events: FieldEvent[];
  warnings: string[];
} {
  if (!isTree(saved)) {
    return {
      events: [],
      warnings: ['saved-events.json is not an object of events, so none were read'],
    };
  }
  const events: FieldEvent[] = [];
  const warnings: string[] = [];
  for (const [id, x] of Object.entries(saved)) {
    const why = eventProblem(id, x);
    if (why) warnings.push(`saved-events.json: ${id} can’t be read (${why}), so it was left out`);
    else events.push(readEvent(x));
  }
  return { events, warnings };
}

/** The defaults with each saved event in its default's place, and new ones after. */
export function layerEvents(
  defaults: readonly FieldEvent[],
  saved: readonly FieldEvent[],
): FieldEvent[] {
  const byId = new Map(saved.map((e) => [e.id, e]));
  const kept = defaults.map((e) => byId.get(e.id) ?? e);
  return [...kept, ...saved.filter((e) => !defaults.some((d) => d.id === e.id))];
}
