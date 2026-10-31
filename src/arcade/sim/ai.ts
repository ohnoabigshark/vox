/**
 * Where everyone is heading this step (GAMEPLAY.md, A Down and The Defense).
 * Each body gets a target point (or null to stand); physics.ts moves it
 * there at its own speed. Nobody but Bats moves before the snap.
 *
 * - **Blockers** (and anyone on a block assignment) get between a rusher and
 *   the QB; after a catch or handoff, between the nearest defender and the carrier.
 * - **Route runners** run their waypoints (a bullet comes to them).
 * - **The carrier** charges upfield in its lane, picking the emptiest lane
 *   itself (chooseLane).
 * - **Rushers** charge the QB. **Covers** trail their mark. **Scarecrows** are
 *   planted. **The Owl** hangs deep, level with your deepest player, and
 *   comes down to meet the carrier. **Bats** loop their square, diving at a
 *   carrier that comes close; **Crows** fly their lane. After the
 *   catch, everyone who moves chases the carrier; after a handoff, once the
 *   play fake wears off (fooled).
 */
import { arcadeTuning } from '../content/tuning';
import { lobReceivers } from './ball';
import { areaBox, comingFor } from './fieldEvents';
import type { Defender, Player, RunState, Vec } from './types';
import { clearOfProps } from './props';
import { add, dist, norm, scale, sub, v } from './vec';

const { defense, carrier: carrierTuning } = arcadeTuning;

export function carrierOf(state: RunState): Player | null {
  const ball = state.field.ball;
  if (ball.at !== 'carried') return null;
  return state.field.players.find((p) => p.id === ball.by) ?? null;
}

export function qbOf(state: RunState): Player | null {
  return state.field.players.find((p) => p.role === 'qb') ?? null;
}

const up = (b: { down: number }): boolean => b.down <= 0;

export function playerTarget(state: RunState, p: Player): Vec | null {
  if (state.phase !== 'play') return null;
  const carrier = carrierOf(state);
  switch (p.job.kind) {
    case 'qb':
      return null;
    case 'carry':
      return v(state.field.lane, p.pos.y + carrierTuning.lookAhead);
    case 'block':
      return blockTarget(state, p, carrier);
    case 'route': {
      // A lob in the air (two-tap throwing): your player nearest where it's coming down,
      // within the catch circle, runs to meet it.
      const ball = state.field.ball;
      if (
        ball.at === 'flight' &&
        ball.lob &&
        lobReceivers(state, ball.from, ball.target)[0]?.id === p.id
      ) {
        return ball.target;
      }
      // After a catch everyone blocks for the carrier; on a handoff the Catchers keep running
      // their routes as decoys, pulling their Covers away (only the Runners and Blockers block).
      if (carrier && (p.role !== 'catcher' || !handedOff(state))) {
        return blockTarget(state, p, carrier);
      }
      const job = p.job;
      const to = job.to[job.index];
      if (!to) return null;
      // A waypoint inside a prop counts as reached at its edge.
      const goal = clearOfProps(state.field.props, to, p.radius);
      if (dist(p.pos, goal) < 0.5 && job.index < job.to.length - 1) job.index++;
      return job.to[job.index] ?? null;
    }
  }
}

/** Get between a defender and the one you protect: the QB before the catch, the carrier after. */
function blockTarget(state: RunState, p: Player, carrier: Player | null): Vec | null {
  const defenders = state.field.defenders.filter((d) => up(d) && !d.planted);
  if (carrier) {
    if (carrier.id === p.id) return null;
    const threat = carryBlocks(state, carrier, defenders).get(p.id);
    return threat ? between(threat, carrier.pos, p) : null;
  }
  const qb = qbOf(state);
  if (!qb) return null;
  const rushers = defenders
    .filter((d) => d.kind === 'rusher')
    .sort((a, b) => a.pos.x - b.pos.x || a.id - b.id);
  const blockers = state.field.players
    .filter((q) => q.job.kind === 'block')
    .sort((a, b) => a.pos.x - b.pos.x || a.id - b.id);
  const rusher = rushers[blockers.indexOf(p) % Math.max(1, rushers.length)];
  // Nobody to block: hold a spot just in front of the QB.
  if (!rusher) return add(qb.pos, v(p.pos.x > qb.pos.x ? 1.2 : -1.2, 2.5));
  return between(rusher, qb.pos, p);
}

/**
 * After a catch or handoff, who blocks whom: the defenders nearest the
 * carrier are the threats, and each of your players takes its own, the
 * closest pairs first, so they spread out instead of piling onto one. Spare
 * players double up on the nearest threat to them. Worked out once a step.
 */
function carryBlocks(
  state: RunState,
  carrier: Player,
  defenders: readonly Defender[],
): Map<number, Defender> {
  if (blockCache.state === state && blockCache.step === state.step) return blockCache.blocks;
  const run = handedOff(state);
  const helpers = state.field.players.filter(
    (q) => up(q) && q.role !== 'qb' && q.id !== carrier.id && !(run && q.role === 'catcher'),
  );
  const threats = [...defenders]
    .sort((a, b) => dist(a.pos, carrier.pos) - dist(b.pos, carrier.pos) || a.id - b.id)
    .slice(0, helpers.length);
  const pairs = helpers
    .flatMap((q) => threats.map((d) => ({ q, d, at: dist(q.pos, d.pos) })))
    .sort((a, b) => a.at - b.at || a.q.id - b.q.id || a.d.id - b.d.id);
  const blocks = new Map<number, Defender>();
  const taken = new Set<number>();
  for (const { q, d } of pairs) {
    if (blocks.has(q.id) || taken.has(d.id)) continue;
    blocks.set(q.id, d);
    taken.add(d.id);
  }
  for (const { q, d } of pairs) if (!blocks.has(q.id)) blocks.set(q.id, d);
  blockCache = { state, step: state.step, blocks };
  return blocks;
}
let blockCache: { state: RunState | null; step: number; blocks: Map<number, Defender> } = {
  state: null,
  step: -1,
  blocks: new Map(),
};

/** The point touching `d` on the side facing `guard`: stepping there shoves `d` away from it. */
function between(d: Defender, guard: Vec, p: Player): Vec {
  return add(d.pos, scale(norm(sub(guard, d.pos)), d.radius + p.radius * 0.5));
}

export function defenderTarget(state: RunState, d: Defender): Vec | null {
  if (d.planted) return null;
  // A Bat guards its patch of air, a Crow its lane: each keeps to it, but dives at a
  // carrier that comes within reach (a Crow from further off), and goes back if it gets away.
  if ((d.kind === 'bat' || d.kind === 'crow') && state.phase === 'play') {
    const carrier = carrierOf(state);
    const reach = d.kind === 'bat' ? defense.batDive : defense.crowDive;
    if (carrier && dist(d.pos, carrier.pos) <= reach) {
      return add(carrier.pos, scale(carrier.vel, defense.chaseLead));
    }
  }
  if (d.kind === 'bat' || d.kind === 'crow') {
    const corner = d.patrol?.[d.patrolIndex];
    if (!corner || !d.patrol) return null;
    if (dist(d.pos, corner) < 0.3) d.patrolIndex = (d.patrolIndex + 1) % d.patrol.length;
    return d.patrol[d.patrolIndex] ?? null;
  }
  if (state.phase !== 'play') return null;
  const carrier = carrierOf(state);
  // A Safety is the last line: it gets between the carrier and the end zone, meeting
  // it head on a little upfield of it (unless the carrier's already past it: then it chases).
  if (carrier && d.kind === 'safety' && d.pos.y > carrier.pos.y) {
    const ahead = add(carrier.pos, scale(carrier.vel, defense.chaseLead));
    return v(ahead.x, Math.min(d.pos.y, ahead.y + defense.safetyFront));
  }
  if (carrier && !fooled(state, d, carrier)) {
    return add(carrier.pos, scale(carrier.vel, defense.chaseLead));
  }
  const qb = qbOf(state);
  switch (d.kind) {
    case 'rusher':
      return qb ? qb.pos : null;
    case 'cover': {
      const mark = state.field.players.find((p) => p.id === d.mark);
      if (!mark) return null;
      // Trail the mark: aim a little behind where it's going.
      const heading = norm(mark.vel);
      const behind = heading.x === 0 && heading.y === 0 ? v(0, -1) : scale(heading, -1);
      return add(mark.pos, scale(behind, defense.coverTrail));
    }
    case 'safety': {
      // A lone Safety (in the middle) shadows your deepest player; with two, each
      // takes its own half of the field, shadowing the deepest one there.
      const side = Math.sign(d.home.x);
      const deepest = state.field.players
        .filter((p) => p.role !== 'qb' && (side === 0 || Math.sign(p.pos.x) !== -side))
        .sort((a, b) => b.pos.y - a.pos.y || a.id - b.id)[0];
      return v(deepest ? deepest.pos.x : d.home.x, d.home.y);
    }
    default:
      return null;
  }
}

/**
 * The play fake: for a moment after a handoff the defense still plays the
 * pass (Rushers go for the pumpkin, Covers stay on their Catchers), except
 * a defender right next to the carrier, who sees it.
 */
/** The ball was handed off (not thrown) this down. */
export function handedOff(state: RunState): boolean {
  return state.playbook[state.play.index]?.handoff !== undefined;
}

function fooled(state: RunState, d: Defender, carrier: Player): boolean {
  return (
    handedOff(state) &&
    state.time - state.snappedAt < defense.playFake &&
    dist(d.pos, carrier.pos) > defense.fakeSees
  );
}

/** At the snap: each Cover marks the nearest route runner nobody's marking yet (Covers choose in id order). */
export function assignMarks(state: RunState): void {
  const taken = new Set<number>();
  const runners = state.field.players.filter((p) => p.job.kind === 'route');
  for (const d of [...state.field.defenders].sort((a, b) => a.id - b.id)) {
    if (d.kind !== 'cover') continue;
    const mark = runners
      .filter((p) => !taken.has(p.id))
      .sort((a, b) => dist(a.pos, d.pos) - dist(b.pos, d.pos) || a.id - b.id)[0];
    d.mark = mark?.id ?? null;
    if (mark) taken.add(mark.id);
  }
}

/**
 * The lane a carrier runs for (GAMEPLAY.md: no steering), keeping out of
 * any Frog Rain lane: of the lanes
 * across the field, the one with the most room ahead of it, counting the
 * defenders still up in front, preferring to stay near where it is. The QB
 * running it does the same: it drifts to the open side.
 */
/** Where a route is across the field at this far upfield (its first or last x beyond its ends). */
export function pathXAt(path: readonly Vec[], y: number): number {
  let x = path[0]?.x ?? 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    if (!a || !b) continue;
    const lo = Math.min(a.y, b.y);
    const hi = Math.max(a.y, b.y);
    if (y >= hi) x = b.x;
    else if (y >= lo && hi > lo) x = a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y);
  }
  return x;
}

export function chooseLane(state: RunState, carrier: Player): number {
  const hw = arcadeTuning.field.halfWidth - 0.8;
  // Defenders still up in front, and props in the way, all take room.
  const ahead = [
    ...state.field.defenders.filter((d) => up(d)).map((d) => d.pos),
    ...state.field.props.map((p) => v(p.x, p.y)),
  ].filter((pos) => pos.y > carrier.pos.y - 0.5 && pos.y < carrier.pos.y + 9);
  const path = state.field.runPath;
  const planned = path ? pathXAt(path, carrier.pos.y + carrierTuning.lookAhead) : null;
  let best = carrier.pos.x;
  let bestScore = -Infinity;
  for (let x = -hw; x <= hw + 1e-6; x += 0.5) {
    // Room: the nearest defender to this lane, counting the ones closer up the field as nearer.
    const room = Math.min(
      ...ahead.map((pos) => Math.abs(pos.x - x) + 0.35 * (pos.y - carrier.pos.y)),
      6,
    );
    // A field event still to go off (Frog Rain): keep out of its area, if it's still ahead.
    const coming = state.field.fieldEvent;
    const box = comingFor(coming) ? areaBox(coming.area) : null;
    const inRain =
      box !== null &&
      carrier.pos.y < box.y1 &&
      x > box.x0 - carrier.radius &&
      x < box.x1 + carrier.radius;
    // A handoff runs its play: lean toward where the planned route goes, a little way ahead.
    const pull = planned === null ? 0 : carrierTuning.pathPull * Math.abs(x - planned);
    const score = room - 0.15 * Math.abs(x - carrier.pos.x) - pull - (inRain ? 4 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = x;
    }
  }
  return best;
}
