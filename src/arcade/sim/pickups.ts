/**
 * Tricks and treats (docs/PICKUPS.md): a lightning bolt and an oil slick on
 * every 10-yard stretch of the long field, laid from the run's seed the way
 * props are (sim/props.ts), so they line up from one drive to the next and
 * show before the snap. Never in the middle lane, against a sideline or on a
 * prop. A Boss stands in the middle lane, so it's never in the way either.
 */
import { arcadeTuning } from '../content/tuning';
import { stretchProps } from './props';
import { rngFor } from './random';
import type { FieldProp, Pickup, PickupKind } from './types';
import { dist, v } from './vec';

const { pickups: tuning, field, drive: driveTuning } = arcadeTuning;

/** How many drives (10-yard stretches) each area has (as sim/props.ts). */
const DRIVES_PER_AREA = 4;
const KINDS: readonly PickupKind[] = ['bolt', 'slick'];

/**
 * The pickups around a drive, in its own coordinates (its start line at 0):
 * the stretch behind it, its own and two ahead, as with props.
 */
export function pickupsForDrive(seed: number, area: number, index: number): Pickup[] {
  const here = area * DRIVES_PER_AREA + index;
  const out: Pickup[] = [];
  for (let k = here - 1; k <= here + 2; k++) {
    if (k < 0) continue;
    const shift = (k - here) * driveTuning.distance;
    out.push(...stretchPickups(seed, k).map((p) => ({ ...p, y: p.y + shift })));
  }
  return out;
}

/**
 * One stretch's bolt and slick (y from 0 to 10 within it), clear of its own
 * props and its neighbours', so it lies in the same place whichever drive is
 * showing it. Ids are unique in the run.
 */
function stretchPickups(seed: number, k: number): Pickup[] {
  const props: FieldProp[] = [];
  for (const n of [k - 1, k, k + 1]) {
    if (n < 0) continue;
    const shift = (n - k) * driveTuning.distance;
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
        rng.next() * driveTuning.distance,
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
