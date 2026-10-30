/**
 * The fixed step: advance a run by one step of 1/60 s. Pure: the input
 * state is never modified, and the same state plus the same input always
 * gives the same result. See GAMEPLAY.md, A Down and Break it!.
 *
 * Order within a step in play:
 *   1. THROW fires a bullet along the sweeping line.
 *   2. The carrier picks its lane (the emptiest), every so often.
 *   3. Everyone moves toward their target (ai.ts, physics.ts); overlaps are
 *      pushed apart by weight.
 *   4. Contact: a player blocking, much heavier than the defender it's on,
 *      flattens it (a pancake); a defender grabbing the carrier starts
 *      Break it! (running into a planted Scarecrow, or a Safety, just stops
 *      it; so does a third grab in a down).
 *   5. A carrier dragging tacklers goes down when the drag runs out.
 *   6. The pocket: once its sweeps are done with the QB still holding the
 *      ball, it's a sack.
 *   7. The bullet in the air (ball.ts).
 *   8. The carrier over the first-down line wins the drive; over the
 *      sideline, it's down there.
 * In Break it! the play is frozen until it's decided (sim/breakit.ts).
 * Before the snap and between drives only the Bats move.
 */
import { arcadeTuning, DT } from '../content/tuning';
import { carrierOf, chooseLane, handedOff, qbOf } from './ai';
import { bulletEnd, flightTime, lobTarget, pocketTime, resolveFlight, sweepAngle } from './ball';
import { moveBodies, separate, touching } from './physics';
import { pushOutOfProps } from './props';
import { judgeBreakIt, startBreakIt } from './breakit';
import { cloneRun, endDown, nextDown } from './run';
import type {
  ArcadeEvent,
  ArcadeResult,
  Body,
  BreakKind,
  Player,
  RunState,
  StepInput,
} from './types';
import { add, dist, len, norm, scale, sub, v } from './vec';

const { contact, field } = arcadeTuning;

/**
 * Tests can force which Break it! comes up (it's random otherwise). Not part
 * of the game: set and cleared only around a test.
 */
let forcedBreak: BreakKind | undefined;
export function forceBreakKind(kind: BreakKind | undefined): void {
  forcedBreak = kind;
}

export function step(prev: RunState, input: StepInput = {}): ArcadeResult {
  const state = cloneRun(prev);
  const events: ArcadeEvent[] = [];
  state.step += 1;
  state.time = state.step * DT;

  if (state.phase === 'downOver') {
    moveBodies(state);
    state.pause -= DT;
    if (state.pause <= 0) nextDown(state, events);
    return { state, events };
  }
  if (state.phase === 'breakit') {
    breakIt(state, input, events);
    return { state, events };
  }
  if (state.phase !== 'play') {
    moveBodies(state);
    separate(state);
    pushOutOfProps(state);
    return { state, events };
  }

  if (input.throw) throwBullet(state, events);
  const carrier = carrierOf(state);
  if (carrier && state.step % Math.max(1, Math.round(arcadeTuning.carrier.laneEvery / DT)) === 0) {
    state.field.lane = chooseLane(state, carrier);
  }
  moveBodies(state);
  separate(state);
  pushOutOfProps(state);
  if (takePickups(state, events)) return { state, events };
  if (frogRain(state, events)) return { state, events };
  if (royalCrows(state, input, events)) return { state, events };
  if (resolveContact(state, events)) return { state, events };
  if (dragDone(state, events)) return { state, events };
  if (pocket(state, events)) return { state, events };
  if (flight(state, events)) return { state, events };
  checkCarrier(state, events);
  return { state, events };
}

/** Whether the QB can throw right now: in play, with the ball. */
export function canThrow(state: RunState): boolean {
  return state.phase === 'play' && state.field.ball.at === 'qb' && qbOf(state) !== null;
}

// ── THROW ───────────────────────────────────────────────────────────────────

/**
 * THROW: a bullet along the line, as far as its range (or the sideline).
 * Two-tap throwing (?aim=2): the first tap stops the line; the second lobs
 * the ball to where the marker is along it.
 */
function throwBullet(state: RunState, events: ArcadeEvent[]): void {
  const qb = qbOf(state);
  if (!qb || !canThrow(state)) return;
  if (state.twoTapAim) {
    if (!state.field.aim) {
      state.field.aim = { angle: sweepAngle(state), since: state.time };
      return;
    }
    const target = lobTarget(state, qb.pos);
    if (!target) return;
    const flight = dist(qb.pos, target) / (arcadeTuning.twoTap.lobSpeed * state.perks.throwScale);
    const landsAt = state.time + Math.max(0.15, flight);
    state.field.ball = {
      at: 'flight',
      from: qb.pos,
      target,
      thrownAt: state.time,
      landsAt,
      lob: true,
    };
    state.field.aim = null;
    events.push({ type: 'thrown', target, landsAt });
    return;
  }
  const target = bulletEnd(state, qb.pos, sweepAngle(state));
  const landsAt = state.time + flightTime(qb.pos, target, state.perks.throwScale);
  state.field.ball = { at: 'flight', from: qb.pos, target, thrownAt: state.time, landsAt };
  events.push({ type: 'thrown', target, landsAt });
}

/** Someone has the ball now: it runs, and picks its lane. */
export function giveBall(state: RunState, p: Player): void {
  p.job = { kind: 'carry' };
  state.field.ball = { at: 'carried', by: p.id };
  state.field.lane = chooseLane(state, p);
  state.field.drag = null;
}

// ── Contact and Break it! ────────────────────────────────────────────────────

/** Pancakes, and a defender grabbing the carrier. Returns whether play stopped. */
function resolveContact(state: RunState, events: ArcadeEvent[]): boolean {
  const { players, defenders } = state.field;
  const upDefenders = defenders.filter((d) => d.down <= 0).sort((a, b) => a.id - b.id);
  const carrier = carrierOf(state);

  // A player blocking, much heavier than the defender it's on, flattens it.
  for (const p of players) {
    const blocking =
      p.job.kind === 'block' || (carrier !== null && p !== carrier && p.role !== 'qb');
    if (p.down > 0 || !blocking) continue;
    for (const d of upDefenders) {
      if (d.planted || d.down > 0 || !touching(p, d)) continue;
      const ratio = handedOff(state) ? contact.runPancakeRatio : contact.pancakeRatio;
      if (p.mass < ratio * d.mass) continue;
      d.down = contact.pancakeTime;
      d.vel = scale(norm(sub(d.pos, p.pos)), 4);
      events.push({ type: 'pancake', blocker: p.id, defender: d.id });
    }
  }

  // Already dragging tacklers: it's going down, nobody new needs to grab it.
  if (!carrier || state.field.drag) return false;
  // Just broken free (a GREAT): only a planted Scarecrow can stop it for a moment.
  const free = state.field.breakaway > 0;
  if (free) state.field.breakaway = Math.max(0, state.field.breakaway - DT);
  const grabbing = upDefenders.filter(
    (d) => d.down <= 0 && !d.latch && touching(carrier, d) && (!free || d.planted),
  );
  if (grabbing.length === 0) return false;
  // Running into a planted Scarecrow stops you dead, and a Safety's tackle is sure.
  const sure = grabbing.find((d) => d.planted) ?? grabbing.find((d) => d.kind === 'safety');
  if (sure) {
    tackle(state, carrier, sure.id, events);
    return true;
  }
  // Two Break it!s a down at most: the next grab just brings it down.
  const first = grabbing[0];
  if (first && state.field.breaks >= arcadeTuning.breakit.perDown) {
    tackle(state, carrier, first.id, events);
    return true;
  }
  state.field.breaks++;
  startBreakIt(
    state,
    carrier,
    grabbing.map((d) => d.id),
    forcedBreak,
  );
  events.push({ type: 'grabbed', id: carrier.id, by: grabbing.map((d) => d.id) });
  return true;
}

/** Break it!: judge the input (sim/breakit.ts), and carry out a break, a drag or a tackle. */
function breakIt(state: RunState, input: StepInput, events: ArcadeEvent[]): void {
  const t = state.tackle;
  const carrier = carrierOf(state);
  if (!t || !carrier) {
    state.phase = 'play';
    state.tackle = null;
    return;
  }
  let outcome = judgeBreakIt(state, input);
  if (!outcome) return;
  // Second Wind (a perk): once a drive, a BAD one counts as OK.
  if (outcome === 'tackle' && state.perks.secondWind && !state.perks.secondWindUsed) {
    state.perks.secondWindUsed = true;
    outcome = 'drag';
  }
  events.push({ type: 'breakResult', outcome });
  state.field.lastBreak = state.time;
  const tacklers = state.field.defenders.filter((d) => t.tacklers.includes(d.id));
  state.tackle = null;
  state.phase = 'play';
  if (outcome === 'break') {
    // BREAK: they go flying, and the carrier keeps going.
    for (const d of tacklers) {
      d.down = contact.brokenTime;
      d.vel = scale(norm(sub(d.pos, carrier.pos)), 5);
      events.push({ type: 'brokeTackle', id: carrier.id, defender: d.id });
    }
    // The rest of the pile is knocked back too, and nobody can grab it for a moment: it breaks free.
    const b = arcadeTuning.breakit;
    for (const d of state.field.defenders) {
      if (tacklers.includes(d) || d.planted || d.down > 0) continue;
      if (dist(d.pos, carrier.pos) > carrier.radius + d.radius + b.scatter) continue;
      d.down = b.scatterDown;
      d.vel = scale(norm(sub(d.pos, carrier.pos)), 4);
    }
    state.field.breakaway = b.breakaway;
    return;
  }
  if (outcome === 'drag') {
    // DRAG: it hauls them a few yards, then goes down.
    for (const d of tacklers) {
      d.latch = scale(norm(sub(d.pos, carrier.pos)), carrier.radius + d.radius);
    }
    state.field.drag = { to: carrier.pos.y + t.dragYards };
    events.push({ type: 'dragged', id: carrier.id, yards: t.dragYards });
    return;
  }
  tackle(state, carrier, t.tacklers[0] ?? -1, events);
}

/**
 * Frog Rain (Mister Frog): the frogs all come down in the lane at once, a
 * moment into the down (the countdown runs only while the play is live).
 * Everyone in the lane is flattened, and a carrier in it is tackled there:
 * FROGGED! Once a down.
 */
function frogRain(state: RunState, events: ArcadeEvent[]): boolean {
  const lane = state.field.frogLane;
  const dump = state.field.frogDump;
  if (!lane || dump === null) return false;
  const next = dump - DT;
  // Keep counting past it (to −1 s) for the show, then stop.
  state.field.frogDump = next < -1 ? null : next;
  if (dump <= 0 || next > 0) return false;
  const inLane = (b: Body): boolean =>
    Math.abs(b.pos.x - lane.x) <= lane.half + b.radius &&
    b.pos.y >= lane.from - b.radius &&
    b.pos.y <= lane.to + b.radius;
  const under = [...state.field.players, ...state.field.defenders].filter(
    (b) =>
      b.down <= 0 &&
      !(b.side === 'team' && b.role === 'qb') &&
      !(b.side === 'defense' && b.planted) &&
      inLane(b),
  );
  const flat = arcadeTuning.frogRain.flatTime;
  for (const b of under) {
    b.down = flat;
    b.vel = v(0, 0);
    if (b.side === 'defense') b.latch = null;
  }
  events.push({ type: 'frogRain', flattened: under.map((b) => b.id) });
  const carrier = carrierOf(state);
  if (carrier && under.includes(carrier)) {
    events.push({ type: 'frogged', id: carrier.id });
    tackle(state, carrier, -1, events);
    return true;
  }
  return false;
}

/**
 * Tricks and treats (docs/PICKUPS.md): one of your players on its feet who
 * runs through a pickup takes it, and it's gone for good. A bolt speeds it up
 * for a while; a slick trips it, and a carrier who slips is tackled there:
 * SLIPPED! Defenders run over them and leave them be (only offense, for now).
 */
function takePickups(state: RunState, events: ArcadeEvent[]): boolean {
  if (state.field.pickups.length === 0) return false;
  const r = arcadeTuning.pickups.radius;
  let slipped: Player | null = null;
  for (const p of state.field.players) {
    if (p.down > 0) continue;
    const pickup = state.field.pickups.find((q) => dist(p.pos, v(q.x, q.y)) <= p.radius + r);
    if (!pickup) continue;
    state.field.pickups = state.field.pickups.filter((q) => q.id !== pickup.id);
    state.taken.push(pickup.id);
    events.push({ type: 'pickupTaken', id: p.id, kind: pickup.kind, pickup: pickup.id });
    switch (pickup.kind) {
      case 'bolt':
        p.fast = arcadeTuning.pickups.bolt.time;
        break;
      case 'slick':
        p.down = arcadeTuning.pickups.slick.time;
        p.vel = v(0, 0);
        if (p === carrierOf(state)) slipped = p;
        break;
    }
  }
  if (!slipped) return false;
  events.push({ type: 'slipped', id: slipped.id });
  tackle(state, slipped, -1, events);
  return true;
}

/** A carrier dragging tacklers goes down once it reaches the end of the drag. */
function dragDone(state: RunState, events: ArcadeEvent[]): boolean {
  const carrier = carrierOf(state);
  const drag = state.field.drag;
  if (!carrier || !drag || carrier.pos.y < drag.to) return false;
  const by = state.field.defenders.find((d) => d.latch)?.id ?? -1;
  tackle(state, carrier, by, events);
  return true;
}

function tackle(state: RunState, carrier: Player, by: number, events: ArcadeEvent[]): void {
  events.push({ type: 'tackled', id: carrier.id, by });
  carrier.down = 1;
  for (const d of state.field.defenders) d.latch = null;
  state.field.drag = null;
  state.field.ball = { at: 'dead', pos: carrier.pos, how: 'tackled' };
  endDown(state, 'tackled', carrier.pos.y, events);
}

// ── The pocket, the bullet, and the carrier ──────────────────────────────────

/** The pocket holds for its sweeps; after that, with the QB still holding the ball, it's a sack. */
function pocket(state: RunState, events: ArcadeEvent[]): boolean {
  const qb = qbOf(state);
  if (!qb || state.field.ball.at !== 'qb') return false;
  if (state.time - state.snappedAt < pocketTime(state)) return false;
  sack(state, qb, events);
  return true;
}

/** The QB goes down with the ball: a sack, the line of scrimmage pushed back. */
function sack(state: RunState, qb: Player, events: ArcadeEvent[]): void {
  events.push({ type: 'sacked' });
  qb.down = 1;
  state.field.ball = { at: 'dead', pos: qb.pos, how: 'sacked' };
  endDown(state, 'sacked', state.drive.los - arcadeTuning.drive.sackLoss, events);
}

/**
 * The King's crows (his drive): shortly after the snap they leave his arms
 * and fly at whoever has the ball (while a pass is in the air, at where it's
 * going); when they reach the holder they land on it, and SHOO! has a moment
 * to drive them off. Too late, and they knock it down: a sack if the QB
 * still has it, a tackle if a carrier does. If the ball leaves the holder
 * first (a throw), they miss. Two pairs a down: the second takes off a
 * moment after the first is done. SHOO! isn't a Break it! (it doesn't count
 * toward the two a down).
 */
function royalCrows(state: RunState, input: StepInput, events: ArcadeEvent[]): boolean {
  const flocks = state.field.crows;
  if (!flocks) return false;
  const i = flocks.findIndex((f) => f.phase !== 'gone');
  const c = flocks[i];
  if (!c) return false;
  const t = arcadeTuning.crows;
  const gone = (): void => {
    c.phase = 'gone';
    c.goneAt = state.time;
  };
  if (c.phase === 'perched') {
    const prev = flocks[i - 1];
    const leaves = prev ? (prev.goneAt ?? Infinity) + t.nextFlock : state.snappedAt + t.takeoff;
    if (state.time < leaves) return false;
    c.phase = 'flying';
  }
  const ball = state.field.ball;
  const holder = ball.at === 'qb' ? qbOf(state) : ball.at === 'carried' ? carrierOf(state) : null;
  if (c.phase === 'flying') {
    const goal = holder ? holder.pos : ball.at === 'flight' ? ball.target : null;
    if (!goal) {
      gone();
      return false;
    }
    const to = sub(goal, c.pos);
    const step = t.speed * DT;
    c.pos = len(to) <= step ? goal : add(c.pos, scale(norm(to), step));
    if (holder && dist(c.pos, holder.pos) <= t.reach) {
      c.phase = 'shoo';
      c.on = holder.id;
      c.left = t.window;
      events.push({ type: 'crowsLanded', on: holder.id });
    }
    return false;
  }
  // SHOO!: on the holder until shooed, or until they strike.
  const on = holder && holder.id === c.on ? holder : null;
  if (!on) {
    gone();
    return false;
  }
  c.pos = on.pos;
  if (input.shoo) {
    gone();
    events.push({ type: 'crowsShooed' });
    return false;
  }
  c.left -= DT;
  if (c.left > 0) return false;
  gone();
  events.push({ type: 'crowsStruck', on: on.id });
  if (ball.at === 'qb') sack(state, on, events);
  else tackle(state, on, -1, events);
  return true;
}

function flight(state: RunState, events: ArcadeEvent[]): boolean {
  const outcome = resolveFlight(state);
  if (!outcome) return false;
  if (outcome.kind === 'caught') {
    giveBall(state, outcome.by);
    events.push({ type: 'caught', id: outcome.by.id, contested: outcome.contested });
    return checkCarrier(state, events);
  }
  if (outcome.kind === 'batted') {
    events.push({ type: 'batted', by: outcome.by, at: outcome.at, contested: outcome.contested });
    state.field.ball = { at: 'dead', pos: outcome.at, how: 'batted' };
    endDown(state, 'batted', state.drive.los, events);
    return true;
  }
  events.push({ type: 'incomplete', at: outcome.at });
  state.field.ball = { at: 'dead', pos: outcome.at, how: 'incomplete' };
  endDown(state, 'incomplete', state.drive.los, events);
  return true;
}

/** The carrier over the first-down line wins the drive; over the sideline, it's down there. */
function checkCarrier(state: RunState, events: ArcadeEvent[]): boolean {
  const carrier = carrierOf(state);
  if (!carrier) return false;
  if (carrier.pos.y >= state.drive.firstDown) {
    for (const d of state.field.defenders) d.latch = null;
    state.field.drag = null;
    endDown(state, 'firstDown', carrier.pos.y, events);
    return true;
  }
  if (Math.abs(carrier.pos.x) > field.halfWidth) {
    events.push({ type: 'outOfBounds', id: carrier.id });
    state.field.ball = { at: 'dead', pos: carrier.pos, how: 'tackled' };
    endDown(state, 'outOfBounds', carrier.pos.y, events);
    return true;
  }
  return false;
}
