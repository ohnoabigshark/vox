/**
 * Tricks and treats (docs/PICKUPS.md): a lightning bolt and an oil slick on
 * every 10-yard stretch of the long field, laid from the run's seed the way
 * props are (sim/props.ts), so they line up from one series to the next and
 * show before the snap. Anywhere in from the sidelines, the middle included,
 * but never on a prop, or on the Boss who stands just past an area's goal line.
 */
import { arcadeTuning } from '../content/tuning';
import {
  AREA_YARDS,
  BOSSES,
  BOSS_SPOT,
  SERIES_PER_AREA,
  areaStretches,
  stretchProps,
} from './props';
import { rngFor } from './random';
import type { FieldProp, Pickup, PickupKind } from './types';
import { dist, v } from './vec';

const { pickups: tuning, field, series: seriesTuning } = arcadeTuning;

const KINDS: readonly PickupKind[] = ['bolt', 'slick'];

/** Where any area's Boss stands, in the yards of the stretch past its goal line, as big as the biggest. */
const BOSS_IN_STRETCH: FieldProp = {
  ...BOSSES.misterFrog,
  id: -1,
  x: BOSS_SPOT.x,
  y: BOSS_SPOT.y - AREA_YARDS,
  radius: Math.max(...Object.values(BOSSES).map((b) => b.radius)),
};

/** The pickups of an area's whole field, in its own yards, on the same stretches as its props. */
export function pickupsForArea(seed: number, area: number): Pickup[] {
  return areaStretches(area).flatMap(({ stretch, shift }) =>
    stretchPickups(seed, stretch).map((p) => ({ ...p, y: p.y + shift })),
  );
}

/**
 * One stretch's bolt and slick (y from 0 to 10 within it), clear of its own
 * props and its neighbours', so it lies in the same place whichever area's field is
 * showing it. Ids are unique in the run.
 */
function stretchPickups(seed: number, k: number): Pickup[] {
  const props: FieldProp[] = [];
  for (const n of [k - 1, k, k + 1]) {
    if (n < 0) continue;
    const shift = (n - k) * seriesTuning.distance;
    props.push(...stretchProps(seed, n).map((p) => ({ ...p, y: p.y + shift })));
  }
  // An area's first stretch lies just past the last area's goal line, where that area's Boss stands.
  if (k > 0 && k % SERIES_PER_AREA === 0) props.push(BOSS_IN_STRETCH);
  const rng = rngFor(seed, 'pickups', k);
  const outer = field.halfWidth - tuning.edge - tuning.radius;
  const out: Pickup[] = [];
  for (const [i, kind] of KINDS.entries()) {
    // Somewhere clear of props and of the other pickup (or, rarely, none of this kind).
    for (let tries = 0; tries < 40; tries++) {
      const at = v((2 * rng.next() - 1) * outer, rng.next() * seriesTuning.distance);
      const onProp = props.some(
        (p) => dist(at, v(p.x, p.y)) < p.radius + tuning.radius + tuning.gap,
      );
      const onPickup = out.some((p) => dist(at, v(p.x, p.y)) < 2 * tuning.radius + tuning.gap);
      if (onProp || onPickup) continue;
      out.push({ id: k * 10 + i, kind, x: at.x, y: at.y });
      break;
    }
  }
  return out;
}
