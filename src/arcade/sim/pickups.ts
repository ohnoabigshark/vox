/**
 * Tricks and treats (docs/PICKUPS.md): a lightning bolt and an oil slick on
 * every 10-yard stretch of the long field, laid from the run's seed the way
 * props are (sim/props.ts), so they line up from one series to the next and
 * show before the snap. Never in the middle lane, against a sideline or on a
 * prop. A Boss stands in the middle lane, so it's never in the way either.
 */
import { arcadeTuning } from '../content/tuning';
import { areaStretches, stretchProps } from './props';
import { rngFor } from './random';
import type { FieldProp, Pickup, PickupKind } from './types';
import { dist, v } from './vec';

const { pickups: tuning, field, series: seriesTuning } = arcadeTuning;

const KINDS: readonly PickupKind[] = ['bolt', 'slick'];

/** The pickups of an area's whole field, in its own yards, on the same stretches as its props. */
export function pickupsForArea(seed: number, area: number): Pickup[] {
  return areaStretches(area).flatMap(({ k, shift }) =>
    stretchPickups(seed, k).map((p) => ({ ...p, y: p.y + shift })),
  );
}

/**
 * One stretch's bolt and slick (y from 0 to 10 within it), clear of its own
 * props and its neighbours', so it lies in the same place whichever series is
 * showing it. Ids are unique in the run.
 */
function stretchPickups(seed: number, k: number): Pickup[] {
  const props: FieldProp[] = [];
  for (const n of [k - 1, k, k + 1]) {
    if (n < 0) continue;
    const shift = (n - k) * seriesTuning.distance;
    props.push(...stretchProps(seed, n).map((p) => ({ ...p, y: p.y + shift })));
  }
  const rng = rngFor(seed, 'pickups', k);
  const inner = tuning.center + tuning.radius;
  const outer = field.halfWidth - tuning.edge - tuning.radius;
  const out: Pickup[] = [];
  for (const [i, kind] of KINDS.entries()) {
    // Somewhere clear of props and of the other pickup (or, rarely, none of this kind).
    for (let tries = 0; tries < 40; tries++) {
      const side = rng.next() < 0.5 ? -1 : 1;
      const at = v(
        side * (inner + rng.next() * (outer - inner)),
        rng.next() * seriesTuning.distance,
      );
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
