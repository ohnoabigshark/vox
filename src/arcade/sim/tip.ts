/**
 * The tip drill (docs/TIP.md): the other catch test, picked at random with
 * SNAG IT! (sim/catchTests.ts). After the countdown the ball pops straight
 * up off the receiver's hands and falls back; the Coach taps as it lands.
 * A tap close to the landing is clean, a little off a bobble, and any other
 * tap, or none, a drop, which ends the drill. The next pop leaves the hands
 * at the tap, each in the air a share of the one before. Every pop clean is
 * a GREAT, a bobble an OK, a drop a BAD; step.ts carries out the grade, as
 * for SNAG IT!.
 */
import { arcadeTuning } from '../content/tuning';
import type { Contest } from './ball';
import {
  catchCount,
  contestSituation,
  freezeContested,
  paceShare,
  type CatchSituation,
} from './catchTests';
import type { ArcadeEvent, Grade, RunState, StepInput, TipDrill, TipResult, Vec } from './types';

const tp = arcadeTuning.tip;

/** How many pops: SNAG IT!'s count in the same spot, and `morePops` more (g3). */
export function tipPops(c: CatchSituation): number {
  return catchCount(c, tp.morePops);
}

/** How long each of `count` pops is in the air on this drive (sim seconds): each a share of the last. */
export function tipTimes(drive: number, count: number): number[] {
  const first = tp.firstPop * paceShare(drive);
  return Array.from({ length: count }, (_, i) => first * tp.shrink ** i);
}

/**
 * Start the tip drill on a contested ball: the play freezes with the ball a
 * yard short of the receiver's hands (on its way from `from`), and the first
 * pop leaves the hands as the shared countdown ends.
 */
export function startTip(
  state: RunState,
  contest: Contest,
  from: Vec,
  events: ArcadeEvent[],
): void {
  const { receiver, defenders } = contest;
  const situation = contestSituation(state, contest);
  const count = tipPops(situation);
  state.tip = {
    startedAt: state.time,
    receiver: receiver.id,
    defenders: defenders.map((d) => d.id),
    pops: tipTimes(situation.drive, count),
    poppedAt: state.time + arcadeTuning.countdown.ready,
    results: [],
  };
  freezeContested(state, receiver, from);
  state.phase = 'tip';
  events.push({ type: 'tipStarted', receiver: receiver.id, pops: count });
}

/** How long the pop being played is in the air (sim seconds), or undefined once every pop is played. */
export function popInAir(t: TipDrill): number | undefined {
  return t.pops[t.results.length];
}

/** When the pop being played lands back on the hands (sim time), or null once every pop is played. */
export function tipLanding(t: TipDrill): number | null {
  const air = popInAir(t);
  return air === undefined ? null : t.poppedAt + air;
}

/** How a tap at `time` plays a pop landing at `landing`. */
function tapResult(time: number, landing: number): TipResult {
  const off = Math.abs(time - landing);
  return off <= tp.clean ? 'clean' : off <= tp.bobble ? 'bobble' : 'drop';
}

/**
 * Judge this step: a tap (once the countdown is over) plays the pop in the
 * air, and the next pop leaves the hands then; a pop nobody tapped by the
 * end of its bobble window is dropped. Returns the grade once the drill is
 * over: at a drop, or once every pop is played.
 */
export function judgeTip(state: RunState, input: StepInput, events: ArcadeEvent[]): Grade | null {
  const t = state.tip;
  // The phase and the drill are set and cleared together; one without the other is a bug.
  if (!t) throw new Error('tip drill phase with no tip drill running');
  const now = state.time;
  const landing = tipLanding(t);
  if (landing === null) return grade(t.results);
  let result: TipResult | null = null;
  if (input.tip && now >= t.poppedAt) result = tapResult(now, landing);
  else if (now > landing + tp.bobble) result = 'drop';
  if (result === null) return null;
  events.push({ type: 'tipPop', index: t.results.length, result });
  t.results.push(result);
  t.poppedAt = now;
  return result === 'drop' || t.results.length === t.pops.length ? grade(t.results) : null;
}

/** All clean is GREAT, a bobble OK, a drop BAD. */
function grade(results: readonly TipResult[]): Grade {
  if (results.includes('drop')) return 'bad';
  return results.includes('bobble') ? 'ok' : 'great';
}

/** Sim seconds left in the tip drill's countdown, until the first pop; null once it's up (or with no drill). */
export function tipCountdownLeft(state: RunState): number | null {
  const t = state.tip;
  return !t || state.time >= t.poppedAt ? null : t.poppedAt - state.time;
}
