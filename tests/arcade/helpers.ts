import { DEFENDERS } from '../../src/arcade/content/defense';
import { DT, arcadeTuning } from '../../src/arcade/content/tuning';
import { BASE_STATS, ROLE_RADIUS } from '../../src/arcade/content/team';
import { defenderPhysics, physicsOf } from '../../src/arcade/sim/bodies';
import { scanTime } from '../../src/arcade/sim/ball';
import { createRun } from '../../src/arcade/sim/run';
import { breakMarker } from '../../src/arcade/sim/breakit';
import { step } from '../../src/arcade/sim/step';
import type {
  ArcadeEvent,
  Defender,
  DefenderKind,
  Job,
  Player,
  Role,
  RunState,
  Stats,
  StepInput,
  Vec,
} from '../../src/arcade/sim/types';
import { v } from '../../src/arcade/sim/vec';

export interface PlayerSpec {
  role?: Role;
  pos: Vec;
  stats?: Partial<Stats>;
  job?: Job;
}

export interface DefenderSpec {
  kind: DefenderKind;
  pos: Vec;
  stats?: Partial<Stats>;
  mark?: number;
}

/**
 * A down already snapped, with exactly these bodies: the QB on (0, -4) with
 * the ball, then the given players (ids 2 up) and defenders (ids 100 up).
 * Line of scrimmage 0, first-down line 10. Players' stats default to
 * 50 / 50 / 50, defenders' to their kind's.
 */
export function playState(players: PlayerSpec[], defenders: DefenderSpec[] = []): RunState {
  const state = createRun(1);
  const qbStats = BASE_STATS;
  const qb: Player = {
    id: 1,
    side: 'team',
    role: 'qb',
    slot: -1,
    form: 'human',
    pos: v(0, -4),
    vel: v(0, 0),
    radius: ROLE_RADIUS.qb,
    stats: qbStats,
    ...physicsOf(qbStats),
    down: 0,
    fast: 0,
    job: { kind: 'qb' },
  };
  const team = players.map((spec, i): Player => {
    const role = spec.role ?? 'catcher';
    const stats = { ...BASE_STATS, ...spec.stats };
    return {
      id: 2 + i,
      side: 'team',
      role,
      slot: i,
      form: 'human',
      pos: spec.pos,
      vel: v(0, 0),
      radius: ROLE_RADIUS[role],
      stats,
      ...physicsOf(stats),
      down: 0,
      fast: 0,
      job: spec.job ?? { kind: 'route', to: [v(spec.pos.x, spec.pos.y + 30)], index: 0 },
    };
  });
  const defs = defenders.map((spec, i): Defender => {
    const def = DEFENDERS[spec.kind];
    const stats = { ...def.stats, ...spec.stats };
    return {
      id: 100 + i,
      side: 'defense',
      kind: spec.kind,
      planted: def.planted,
      pos: spec.pos,
      vel: v(0, 0),
      radius: def.radius,
      stats,
      ...defenderPhysics(stats, def.reachBonus),
      down: 0,
      home: spec.pos,
      mark: spec.mark ?? null,
      latch: null,
      patrol: null,
      patrolIndex: 0,
    };
  });
  state.drive = { ...state.drive, los: 0, start: 0, firstDown: 10, down: 1 };
  state.field = {
    players: [qb, ...team],
    defenders: defs,
    props: [],
    pickups: [],
    frogLane: null,
    frogDump: null,
    crows: null,
    ball: { at: 'qb' },
    runPath: null,
    aim: null,
    lane: 0,
    breakaway: 0,
    lastBreak: null,
    breaks: 0,
    drag: null,
  };
  state.phase = 'play';
  state.snappedAt = state.time;
  return state;
}

/** Step `seconds` of sim time (60 steps a second), feeding `input` on the first step only. */
export function run(
  state: RunState,
  seconds: number,
  input: StepInput = {},
): { state: RunState; events: ArcadeEvent[] } {
  const events: ArcadeEvent[] = [];
  let s = state;
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) {
    const r = step(s, i === 0 ? input : {});
    s = r.state;
    events.push(...r.events);
    if (s.phase !== 'play' && state.phase === 'play') break;
  }
  return { state: s, events };
}

export const body = (state: RunState, id: number) => {
  const b = [...state.field.players, ...state.field.defenders].find((u) => u.id === id);
  if (!b) throw new Error(`no body ${id}`);
  return b;
};

export const ofType = <T extends ArcadeEvent['type']>(events: ArcadeEvent[], type: T) =>
  events.filter((e): e is Extract<ArcadeEvent, { type: T }> => e.type === type);

/** Give the ball to a player, as if it had just caught it. */
export function carry(state: RunState, id: number): RunState {
  const p = state.field.players.find((u) => u.id === id);
  if (!p) throw new Error(`no player ${id}`);
  p.job = { kind: 'carry' };
  state.field.ball = { at: 'carried', by: id };
  state.field.lane = p.pos.x;
  state.field.drag = null;
  return state;
}

/** A job that holds its spot (a one-waypoint route to where it stands). */
export const stand = (at: Vec): Job => ({ kind: 'route', to: [at], index: 0 });

/**
 * Time the sweep so that a THROW on the next step goes straight at `target`
 * (it moves the snap back to when the line would be pointing there on its
 * first pass), and return that input.
 */
export function throwAt(state: RunState, target: Vec): StepInput {
  const qb = state.field.players.find((p) => p.role === 'qb');
  if (!qb) throw new Error('no QB');
  const h = (arcadeTuning.sweep.halfAngle * Math.PI) / 180;
  const angle = Math.atan2(target.x - qb.pos.x, target.y - qb.pos.y);
  const share = (angle + h) / (2 * h);
  state.snappedAt = state.time + DT - share * scanTime(state);
  return { throw: true };
}

/** In Break it!, step until the marker reaches `at`, then tap. */
export function tapAt(state: RunState, at: number): { state: RunState; events: ArcadeEvent[] } {
  let s = state;
  const events: ArcadeEvent[] = [];
  for (let i = 0; i < 200; i++) {
    const next = structuredClone(s);
    next.time += DT;
    const m = breakMarker(next) ?? 0;
    const r = step(s, m >= at ? { breakTap: true } : {});
    s = r.state;
    events.push(...r.events);
    if (m >= at || s.phase !== 'breakit') break;
  }
  return { state: s, events };
}

/** Step until Break it! starts (or `seconds` pass). */
export function untilGrabbed(
  state: RunState,
  seconds = 3,
): { state: RunState; events: ArcadeEvent[] } {
  let s = state;
  const events: ArcadeEvent[] = [];
  for (let i = 0; i < seconds * 60 && s.phase === 'play'; i++) {
    const r = step(s);
    s = r.state;
    events.push(...r.events);
  }
  return { state: s, events };
}
