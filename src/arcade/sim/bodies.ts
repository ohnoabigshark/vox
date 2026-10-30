/**
 * Stats into physics (GAMEPLAY.md, Your Team): Heft is weight, Hustle is
 * speed, Hands is reach. And lining both teams up for a down.
 */
import { DEFENDERS, type DefenseSpec } from '../content/defense';
import { arcadeTuning } from '../content/tuning';
import {
  BASE_STATS,
  GOLEM_RADIUS,
  QB_DEPTH,
  ROLE_RADIUS,
  ROSTER_ROLES,
  lineUpSpot,
  playSlot,
} from '../content/team';
import { even, plus } from './stats';
import { playerStats } from './team';
import type { Play } from '../content/plays';
import type { Defender, Drive, Player, RunState, Stats } from './types';
import { add, v } from './vec';

/** A stat in steps away from ordinary (50 is 0, 60 is 1, 30 is -2). */
export function steps(stat: number): number {
  return (stat - arcadeTuning.body.statBase) / arcadeTuning.body.statStep;
}

/** The physics a set of stats gives a body. */
export function physicsOf(stats: Stats): { mass: number; speed: number; reach: number } {
  const b = arcadeTuning.body;
  return {
    mass: b.mass.perHeft ** steps(stats.heft),
    speed: Math.max(b.speed.min, b.speed.base + b.speed.perHustle * steps(stats.hustle)),
    reach: Math.max(b.reach.min, b.reach.base + b.reach.perHands * steps(stats.hands)),
  };
}

/** A defender's physics: like anyone's, plus its kind's extra reach for the ball. */
export function defenderPhysics(stats: Stats, reachBonus: number): ReturnType<typeof physicsOf> {
  const p = physicsOf(stats);
  return { ...p, reach: p.reach + reachBonus };
}

/**
 * Your team for a down: the QB behind the line of scrimmage, and the seven
 * where the play lines them up (its own line-up, or the standard one) with
 * its assignments. If `flipped`, all of it is mirrored and mirror partners
 * swap spots and jobs, so the standard line-up still reads left to right.
 * Route waypoints become field positions.
 */
export function lineUpTeam(
  state: RunState,
  play: Play,
  flipped: boolean,
  los: number,
  firstId: number,
): Player[] {
  const mirror = flipped ? -1 : 1;
  const qbStats = BASE_STATS;
  const qb: Player = {
    id: firstId,
    side: 'team',
    role: 'qb',
    slot: -1,
    form: 'human',
    pos: v(0, los - QB_DEPTH),
    vel: v(0, 0),
    radius: ROLE_RADIUS.qb,
    stats: qbStats,
    ...physicsOf(qbStats),
    down: 0,
    fast: 0,
    job: { kind: 'qb' },
  };
  const seven = state.roster.map((p, slot): Player => {
    // The slot decides the position it plays; its stats come with it (and the perks).
    const role = ROSTER_ROLES[slot] ?? p.preferred;
    const k = playSlot(slot, flipped);
    const spot = lineUpSpot(play, k);
    const start = v(spot.x * mirror, los + spot.y);
    const a = play.slots[k] ?? { kind: 'block' };
    const stats = playerStats(state, slot);
    return {
      id: firstId + 1 + slot,
      side: 'team',
      role,
      slot,
      form: p.kind,
      pos: start,
      vel: v(0, 0),
      radius: p.kind === 'golem' ? Math.max(GOLEM_RADIUS, ROLE_RADIUS[role]) : ROLE_RADIUS[role],
      stats,
      ...physicsOf(stats),
      down: 0,
      fast: 0,
      job:
        a.kind === 'route'
          ? { kind: 'route', to: a.to.map((w) => add(start, v(w.x * mirror, w.y))), index: 0 }
          : { kind: 'block' },
    };
  });
  return [qb, ...seven];
}

/**
 * A drive's defense against the line of scrimmage, `boost` added to every
 * defender's stats. The Owl hangs past the first-down line; on the Boss
 * drive nobody lines up past the back of the end zone.
 */
export function lineUpDefense(
  spec: DefenseSpec,
  drive: Drive,
  boost: number,
  firstId: number,
): Defender[] {
  const { los, firstDown, kind } = drive;
  const loop = arcadeTuning.defense.batLoop;
  return spec.defenders.map((spot, i): Defender => {
    const def = DEFENDERS[spot.kind];
    const deep = spot.kind === 'safety';
    let y = deep ? Math.max(los + arcadeTuning.defense.safetyDepth, firstDown + 1) : los + spot.y;
    if (kind === 'boss') y = Math.min(y, firstDown + 9);
    const home = v(spot.x, y);
    const stats = plus(def.stats, even(boost));
    // A Bat loops a square; a Crow flies a lane up and down the field.
    const patrol =
      spot.kind === 'bat'
        ? [
            home,
            v(home.x + loop, home.y),
            v(home.x + loop, home.y + loop),
            v(home.x, home.y + loop),
          ]
        : spot.kind === 'crow'
          ? [home, v(home.x, home.y + arcadeTuning.defense.crowLane)]
          : null;
    return {
      id: firstId + i,
      side: 'defense',
      kind: spot.kind,
      planted: def.planted,
      pos: home,
      vel: v(0, 0),
      radius: def.radius,
      stats,
      ...defenderPhysics(stats, def.reachBonus),
      down: 0,
      home,
      mark: null,
      latch: null,
      patrol,
      patrolIndex: 1,
    };
  });
}
