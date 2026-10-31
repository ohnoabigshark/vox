/**
 * Moving and colliding (GAMEPLAY.md, Your Team: stats are physics). Every
 * body accelerates toward its target at its own top speed; overlapping
 * bodies are pushed apart in proportion to their weight, so the heavier one
 * moves the lighter one. Bodies lying on the turf get nudged aside by anyone
 * standing; Scarecrows can't be moved at all. On a handoff, blockers drive
 * the defenders they're on back, faster the more Heft they have over them. Your
 * players bump each other too; they always give way to the carrier, so
 * nobody slows its run (the QB, the pumpkin, isn't a body on the turf).
 */
import { arcadeTuning, DT } from '../content/tuning';
import { defenderTarget, handedOff, playerTarget } from './ai';
import { steps } from './bodies';
import { clearOfProps, steerAround } from './props';
import type { Body, RunState } from './types';
import { add, clampLen, dist, len, norm, scale, sub, v } from './vec';

const { body: bodyTuning, field, pickups: pickupTuning } = arcadeTuning;

export function allBodies(state: RunState): Body[] {
  return [...state.field.players, ...state.field.defenders];
}

/**
 * Everyone but the carrier stays on the field: the carrier can run out of
 * bounds, nobody else can walk, slide or be shoved there.
 */
function keepInBounds(b: Body, carrierId: number | null): void {
  if (b.id === carrierId) return;
  b.pos = v(Math.max(-field.halfWidth, Math.min(field.halfWidth, b.pos.x)), b.pos.y);
}

/** Everyone moves one step toward their target. */
export function moveBodies(state: RunState): void {
  const carrierId = state.field.ball.at === 'carried' ? state.field.ball.by : null;
  const carrier = state.field.players.find((p) => p.id === carrierId);
  const hanging = state.field.defenders.filter((d) => d.latch !== null);
  for (const b of allBodies(state)) {
    // A lightning bolt wears off (docs/PICKUPS.md).
    if (b.side === 'team' && b.boltLeft > 0) b.boltLeft = Math.max(0, b.boltLeft - DT);
    // Tacklers hanging on ride along with the carrier (below).
    if (b.side === 'defense' && b.latch) continue;
    if (b.down > 0) {
      b.down = Math.max(0, b.down - DT);
      const slow = Math.max(0, 1 - bodyTuning.friction * DT);
      b.vel = scale(b.vel, slow);
      b.pos = add(b.pos, scale(b.vel, DT));
      keepInBounds(b, carrierId);
      continue;
    }
    if (b.side === 'defense' && b.planted) {
      b.vel = v(0, 0);
      continue;
    }
    const aim = b.side === 'team' ? playerTarget(state, b) : defenderTarget(state, b);
    // Never aim inside a prop: aim for its edge instead.
    const target = aim ? clearOfProps(state.field.props, aim, b.radius) : null;
    let desired = v(0, 0);
    if (target) {
      const to = sub(target, b.pos);
      const top =
        b.side === 'team' && b.boltLeft > 0 ? b.speed * (1 + pickupTuning.bolt.faster) : b.speed;
      const speed =
        b.side === 'defense'
          ? b.speed * blockedShare(state, b, carrierId)
          : b.id === carrierId
            ? top * (b.mass / (b.mass + hanging.reduce((m, d) => m + d.mass, 0)))
            : top;
      // Arrive: ease off over the last stretch so nobody orbits its target.
      desired = scale(norm(to), speed * Math.min(1, len(to) / 0.6));
      // And go round any prop in the way.
      desired = steerAround(state.field.props, b, desired, target);
    }
    b.vel = add(b.vel, clampLen(sub(desired, b.vel), bodyTuning.accel * DT));
    b.pos = add(b.pos, scale(b.vel, DT));
    keepInBounds(b, carrierId);
  }
  if (carrier && handedOff(state)) driveBlocks(state, carrier.id);
  for (const d of hanging) {
    if (!carrier || !d.latch) continue;
    d.pos = add(carrier.pos, d.latch);
    d.vel = carrier.vel;
  }
}

/**
 * A defender being blocked: touched by one of your players who isn't the
 * carrier or the QB. It moves at a share of its speed, held by a Blocker at
 * least as heavy, slowed by a lighter one.
 */
function blockedShare(state: RunState, d: Body, carrierId: number | null): number {
  let share = 1;
  for (const p of state.field.players) {
    if (p.down > 0 || p.role === 'qb' || p.id === carrierId || !touching(p, d)) continue;
    const s = p.mass >= d.mass ? arcadeTuning.contact.held : arcadeTuning.contact.slowed;
    share = Math.min(share, s);
  }
  return share;
}

/**
 * The drive block: on a handoff, each of your players blocking (not the
 * carrier, the QB or a decoy Catcher) shoves the defender it's touching
 * straight away from itself, and steps after it. The heaviest shove on a
 * defender wins.
 */
function driveBlocks(state: RunState, carrierId: number): void {
  const drive = arcadeTuning.contact.drive;
  for (const d of state.field.defenders) {
    if (d.down > 0 || d.planted || d.latch) continue;
    let best = 0;
    let by: Body | null = null;
    for (const p of state.field.players) {
      if (p.down > 0 || p.role === 'qb' || p.role === 'catcher' || p.id === carrierId) continue;
      if (!touching(p, d)) continue;
      const gap = steps(p.stats.heft) - steps(d.stats.heft);
      const rate = Math.max(drive.min, Math.min(drive.max, drive.base + drive.perHeft * gap));
      if (rate > best) {
        best = rate;
        by = p;
      }
    }
    if (!by) continue;
    const shove = scale(norm(sub(d.pos, by.pos)), best * DT);
    d.pos = add(d.pos, shove);
    by.pos = add(by.pos, shove);
    // After the whistle nothing else keeps them on the field (step.ts, downOver).
    keepInBounds(d, carrierId);
    keepInBounds(by, carrierId);
  }
}

/** Whether two bodies collide with each other at all. */
function collides(state: RunState, a: Body, b: Body): boolean {
  if ((a.side === 'defense' && a.latch) || (b.side === 'defense' && b.latch)) return false;
  if (a.side === 'team' && b.side === 'team') {
    return a.role !== 'qb' && b.role !== 'qb';
  }
  return true;
}

/**
 * How hard a body is to move: a planted Scarecrow, or the carrier against
 * its own team, not at all; one lying on the turf, by anyone standing, easily
 * (it's nudged aside and never slows them).
 */
function weight(state: RunState, b: Body, other: Body): number {
  if (b.side === 'defense' && b.planted) return Infinity;
  if (b.down > 0 && other.down <= 0) return 0;
  const carrier = state.field.ball.at === 'carried' ? state.field.ball.by : null;
  if (b.id === carrier && other.side === 'team') return Infinity;
  return b.mass;
}

/** Push every overlapping pair apart, the lighter one further. A few passes settle crowds. */
export function separate(state: RunState): void {
  const bodies = allBodies(state);
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i];
        const b = bodies[j];
        if (!a || !b || !collides(state, a, b)) continue;
        const d = dist(a.pos, b.pos);
        const overlap = a.radius + b.radius - d;
        if (overlap <= 0) continue;
        const n = d === 0 ? v(a.id < b.id ? -1 : 1, 0) : norm(sub(b.pos, a.pos));
        const wa = weight(state, a, b);
        const wb = weight(state, b, a);
        // How much of the overlap each one gives: in proportion to the other's weight.
        const shareA = wa === Infinity ? 0 : wb === Infinity ? 1 : wb / (wa + wb);
        a.pos = sub(a.pos, scale(n, overlap * shareA));
        b.pos = add(b.pos, scale(n, overlap * (1 - shareA)));
      }
    }
  }
  // A shove never pushes anyone but the carrier out of bounds.
  const carrier = state.field.ball.at === 'carried' ? state.field.ball.by : null;
  for (const b of bodies) keepInBounds(b, carrier);
}

/** Whether two bodies are touching (for tackles, sacks and pancakes). */
export function touching(a: Body, b: Body): boolean {
  return dist(a.pos, b.pos) <= a.radius + b.radius + arcadeTuning.contact.slop;
}
