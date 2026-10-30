/**
 * Props on the field (GAMEPLAY.md, The Defense): trees, stumps and
 * toadstools in the Forest, candy in the Candy Kingdom. They're solid,
 * immovable circles that everyone has to go around (the ball flies over
 * them). They're laid per 10-yard stretch of the long field from the run's
 * seed, so they line up from one drive to the next and match each stretch's
 * area; never in the middle lane (the pumpkin's and the handoffs'), never
 * against a sideline, and far enough apart to always leave a gap.
 *
 * Nobody gets stuck on one: a body heading into a prop steers round it, a
 * target inside one is moved to its edge, and anyone pushed into one (a
 * shove, a line-up) is pushed back out.
 */
import { areaAt } from '../content/defense';
import { arcadeTuning } from '../content/tuning';
import { rngFor } from './random';
import type { Body, BossName, FieldProp, PropKind, RunState, Vec } from './types';
import { add, dist, len, norm, scale, sub, v } from './vec';

const { fieldProps: tuning, field, drive: driveTuning } = arcadeTuning;

/** How many drives (10-yard stretches) each area has. */
const DRIVES_PER_AREA = 4;

/**
 * The props around a drive, in its own coordinates (its start line at 0):
 * the stretch behind it, its own, and two ahead, so the field beyond the
 * first-down line is already dressed.
 */
export function propsForDrive(seed: number, area: number, index: number): FieldProp[] {
  const here = area * DRIVES_PER_AREA + index;
  const out: FieldProp[] = [];
  for (let k = here - 1; k <= here + 2; k++) {
    if (k < 0) continue;
    for (const p of stretchProps(seed, k)) {
      out.push({ ...p, y: p.y + (k - here) * driveTuning.distance });
    }
  }
  return out;
}

/**
 * The Bosses: each stands guard in the middle of its drive's end zone, just
 * past the first-down line, drawn twice its model's size
 * (render/fieldProps.ts). In play each is only a prop: it never moves,
 * tackles or defends; its ability is the whole fight.
 */
export const BOSSES: Readonly<Record<BossName, PropKind>> = {
  misterFrog: { model: 'bosses/misterFrog', radius: 1.45, scale: 1, facing: true },
  queen: { model: 'bosses/queen', radius: 1.45, scale: 1, facing: true },
  king: { model: 'bosses/king', radius: 1.45, scale: 1, facing: true },
};
export const KING = BOSSES.king;

/** Where a Boss stands on its drive (the drive's own coordinates): in the middle, just past the first-down line. */
export const BOSS_SPOT: Vec = v(0, driveTuning.distance + tuning.bossBeyond);

/** The props of a drive, its Boss among them on a Boss drive. */
export function drivePropsWithBoss(
  seed: number,
  area: number,
  index: number,
  boss: BossName | undefined,
): FieldProp[] {
  const props = propsForDrive(seed, area, index);
  if (!boss) return props;
  const kind = BOSSES[boss];
  const { x, y } = BOSS_SPOT;
  // Make room: no other prop where the Boss stands.
  const clear = props.filter(
    (p) => dist(v(p.x, p.y), BOSS_SPOT) > p.radius + kind.radius + tuning.gap,
  );
  return [...clear, { id: -1, x, y, ...kind }];
}

/** One 10-yard stretch's props (y from 0 to 10 within it), the same every time for this seed. */
export function stretchProps(seed: number, k: number): FieldProp[] {
  const kinds = areaAt(Math.floor(k / DRIVES_PER_AREA)).fieldProps;
  const rng = rngFor(seed, 'fieldProps', k);
  const want = tuning.min + rng.int(0, tuning.max - tuning.min);
  const out: FieldProp[] = [];
  for (let tries = 0; out.length < want && tries < 40; tries++) {
    const kind = rng.pick(kinds);
    if (!kind) break;
    const side = rng.next() < 0.5 ? -1 : 1;
    const inner = tuning.center + kind.radius;
    const outer = field.halfWidth - tuning.edge - kind.radius;
    const x = side * (inner + rng.next() * Math.max(0, outer - inner));
    const y = rng.next() * driveTuning.distance;
    if (out.some((o) => dist(v(o.x, o.y), v(x, y)) < o.radius + kind.radius + tuning.gap)) continue;
    out.push({ id: k * 100 + out.length, x, y, ...kind });
  }
  return out;
}

/** A point moved out of any prop it's inside, far enough for a body this size to stand there. */
export function clearOfProps(props: readonly FieldProp[], at: Vec, radius: number): Vec {
  let p = at;
  for (const prop of props) {
    const c = v(prop.x, prop.y);
    const need = prop.radius + radius + 0.05;
    const d = dist(p, c);
    if (d >= need) continue;
    const away = d < 1e-6 ? v(p.x >= c.x ? 1 : -1, 0) : norm(sub(p, c));
    p = add(c, scale(away, need));
  }
  return p;
}

/**
 * Steer round the nearest prop in the way: if one sits across the path
 * just ahead, turn away from it, harder the more squarely it's in the way.
 * The side is the one the prop isn't on (straight on: toward the target).
 */
export function steerAround(props: readonly FieldProp[], b: Body, desired: Vec, target: Vec): Vec {
  const speed = len(desired);
  if (speed < 1e-6 || props.length === 0) return desired;
  const d = scale(desired, 1 / speed);
  const left = v(-d.y, d.x);
  const reach = Math.min(dist(b.pos, target) + 0.5, tuning.lookAhead);
  let best: { t: number; lateral: number; clearance: number } | null = null;
  for (const prop of props) {
    const rel = sub(v(prop.x, prop.y), b.pos);
    const t = rel.x * d.x + rel.y * d.y;
    const clearance = prop.radius + b.radius + tuning.margin;
    if (t < -clearance * 0.5 || t > reach + prop.radius) continue;
    const lateral = rel.x * left.x + rel.y * left.y;
    if (Math.abs(lateral) >= clearance) continue;
    if (!best || t < best.t) best = { t, lateral, clearance };
  }
  if (!best) return desired;
  // Away from the prop's side; dead ahead, toward the side the target is on (or by id).
  const toTarget = sub(target, b.pos);
  const targetSide = toTarget.x * left.x + toTarget.y * left.y;
  const side =
    Math.abs(best.lateral) > 0.05
      ? -Math.sign(best.lateral)
      : targetSide !== 0
        ? Math.sign(targetSide)
        : b.id % 2 === 0
          ? 1
          : -1;
  const push = (best.clearance - Math.abs(best.lateral)) / best.clearance;
  const dir = norm(add(d, scale(left, side * (0.6 + 1.6 * push))));
  return scale(dir, speed);
}

/** Push anyone standing in a prop back out to its edge (props never move). */
export function pushOutOfProps(state: RunState): void {
  const props = state.field.props;
  if (props.length === 0) return;
  for (const b of [...state.field.players, ...state.field.defenders]) {
    if (b.side === 'defense' && b.latch) continue;
    b.pos = clearOfProps(props, b.pos, b.radius);
  }
}
