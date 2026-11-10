/**
 * Tricks and treats (docs/PICKUPS.md): a lightning bolt and a gravestone on
 * every 10-yard stretch of the long field, laid from the run's seed the way
 * props are (sim/props.ts), so they line up from one series to the next and
 * show before the snap. Anywhere in from the sidelines, the middle included,
 * but never on a prop, or on the Boss who stands just past an area's goal line.
 */
import { areaAt } from '../content/defense';
import { arcadeTuning } from '../content/tuning';
import {
  AREA_YARDS,
  BOSS_SPOT,
  SERIES_PER_AREA,
  areaStretches,
  bossProp,
  stretchProps,
} from './props';
import { rngFor } from './random';
import type { FieldProp, Pickup, PickupKind, StatusSource } from './types';
import { dist, v } from './vec';

const { pickups: tuning, field, series: seriesTuning } = arcadeTuning;

const KINDS: readonly PickupKind[] = ['bolt', 'gravestone'];

/** How far a pickup reaches (yards from its middle): each kind its own (next-job map g1). */
export function pickupRadius(kind: PickupKind): number {
  return tuning[kind].radius;
}

/**
 * The Boss standing in stretch `n`, in its own yards, if any: an area's first
 * stretch lies just past the last area's goal line, where that area's Boss stands.
 */
function bossIn(n: number): FieldProp | null {
  if (n <= 0 || n % SERIES_PER_AREA !== 0) return null;
  const boss = areaAt(n / SERIES_PER_AREA - 1).boss.boss;
  return boss ? bossProp(boss, v(BOSS_SPOT.x, BOSS_SPOT.y - AREA_YARDS)) : null;
}

/** The pickups of an area's whole field, in its own yards, on the same stretches as its props. */
export function pickupsForArea(seed: number, area: number): Pickup[] {
  return areaStretches(area).flatMap(({ stretch, shift }) =>
    stretchPickups(seed, stretch).map((p) => ({ ...p, y: p.y + shift })),
  );
}

/**
 * One stretch's bolt and gravestone (y from 0 to 10 within it), clear of its own
 * props and Boss and its neighbours', so it lies in the same place whichever area's field is
 * showing it. Ids are unique in the run.
 */
function stretchPickups(seed: number, k: number): Pickup[] {
  const props: FieldProp[] = [];
  for (const n of [k - 1, k, k + 1]) {
    if (n < 0) continue;
    const shift = (n - k) * seriesTuning.distance;
    props.push(...stretchProps(seed, n).map((p) => ({ ...p, y: p.y + shift })));
    const boss = bossIn(n);
    if (boss) props.push({ ...boss, y: boss.y + shift });
  }
  const rng = rngFor(seed, 'pickups', k);
  const out: Pickup[] = [];
  for (const [i, kind] of KINDS.entries()) {
    const r = pickupRadius(kind);
    const outer = field.halfWidth - tuning.edge - r;
    // Somewhere clear of props and of the other pickup (or, rarely, none of this kind).
    for (let tries = 0; tries < 40; tries++) {
      const at = v((2 * rng.next() - 1) * outer, rng.next() * seriesTuning.distance);
      const onProp = props.some((p) => dist(at, v(p.x, p.y)) < p.radius + r + tuning.gap);
      const onPickup = out.some(
        (p) => dist(at, v(p.x, p.y)) < pickupRadius(p.kind) + r + tuning.gap,
      );
      if (onProp || onPickup) continue;
      out.push({ id: k * 10 + i, kind, x: at.x, y: at.y });
      break;
    }
  }
  return out;
}

/** What a lightning bolt's Fast says gave it (docs/STATUSES.md). */
export const FROM_BOLT: StatusSource = { kind: 'pickup', pickup: 'bolt' };
