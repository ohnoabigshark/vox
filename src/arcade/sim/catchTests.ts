/**
 * The catch tests (docs/TIP.md): SNAG IT! and the tip drill, the tap tests
 * on a contested ball. What they share is written once here: when they
 * start, how many dots or pops a situation gives, and how much quicker they
 * get past stretch 10.
 */
import type { CatchSetting } from '../content/runOptions';
import { arcadeTuning } from '../content/tuning';
import { rngFor } from './random';
import { stretchNumber } from './run';
import type { Contest } from './ball';
import type { Player, RunState, Vec } from './types';
import { add, clamp, len, norm, scale, sub } from './vec';

const ct = arcadeTuning.catchTests;

/** The catch tests: SNAG IT! and the tip drill. */
export type CatchTest = 'snag' | 'tip';

/** Each catch test's setting in this run (the run options' `snagIt` and `tipDrill`). */
const settings = (state: RunState): Readonly<Record<CatchTest, CatchSetting>> => ({
  snag: state.snagIt,
  tip: state.tipDrill,
});

/** Whether one is set to always (`?snag=1`, `?tip=1`): every contested ball a catch test, from the first stretch. */
const forced = (state: RunState): boolean =>
  state.snagIt === 'always' || state.tipDrill === 'always';

/** The catch tests a contested ball can go to: those set to always, if any; else those set to normal. */
function candidates(state: RunState): CatchTest[] {
  const set = settings(state);
  const tests: CatchTest[] = ['snag', 'tip'];
  const always = tests.filter((t) => set[t] === 'always');
  return always.length > 0 ? always : tests.filter((t) => set[t] === 'normal');
}

/** Whether a contested ball can go to a catch test on this down's stretch. */
export function catchTestsOn(state: RunState): boolean {
  if (forced(state)) return true;
  return candidates(state).length > 0 && stretchNumber(state.series) >= ct.fromStretch;
}

/**
 * Which catch test a contested ball goes to (docs/TIP.md, t2): the only one
 * it can, or else either, half and half, from the run's seed.
 */
function whichCatchTest(state: RunState): CatchTest {
  const from = candidates(state);
  const only = from.length === 1 ? from[0] : undefined;
  if (only) return only;
  return rngFor(state.seed, 'catch', state.step).next() < 0.5 ? 'snag' : 'tip';
}

/**
 * The catch test this contested ball goes to, or null for today's rule:
 * none before `fromStretch`; from then on `chance` of them, from the run's
 * seed; every one when one is set to always; never one set to off. The roll
 * has its own label, so it draws a number apart from the pick's.
 */
export function catchTestFor(state: RunState): CatchTest | null {
  if (!catchTestsOn(state)) return null;
  const rolled = rngFor(state.seed, 'catchChance', state.step).next() < ct.chance;
  return forced(state) || rolled ? whichCatchTest(state) : null;
}

/** The freeze: the ball hangs a yard short of the receiver's hands, on its way from `from`. */
export function freezeContested(state: RunState, receiver: Player, from: Vec): void {
  const toward = sub(from, receiver.pos);
  state.field.ball = {
    at: 'contested',
    pos: add(receiver.pos, scale(norm(toward), Math.min(1, len(toward)))),
  };
}

/** What sets a catch test's count: the series, the defenders reaching for the ball, and the Hands gap. */
export interface CatchSituation {
  readonly series: number;
  readonly crowd: number;
  /** The receiver's Hands less the best of theirs. */
  readonly handsGap: number;
}

/** The situation a contested ball is played in, on this down's stretch. */
export function contestSituation(state: RunState, contest: Contest): CatchSituation {
  const best = Math.max(...contest.defenders.map((d) => d.stats.hands));
  return {
    series: stretchNumber(state.series),
    crowd: contest.defenders.length,
    handsGap: contest.receiver.stats.hands - best,
  };
}

/**
 * How many dots (or pops): `minCount` from stretch 5, one more every
 * `moreEvery` stretches; one more for each defender after the first reaching
 * for the ball; one fewer when the receiver's Hands beat the best defender's
 * by `handsGap`, one more the other way; and `more` (the tip drill's extra
 * pop). Held to `minCount`–`maxCount`.
 */
export function catchCount(c: CatchSituation, more = 0): number {
  // By the stretch number (docs/SNAG.md), the stretch's count in the run; `series` is its old name.
  const bySeries = ct.minCount + Math.floor(Math.max(0, c.series - ct.fromStretch) / ct.moreEvery);
  const hands = c.handsGap >= ct.handsGap ? -1 : c.handsGap <= -ct.handsGap ? 1 : 0;
  return clamp(bySeries + Math.max(0, c.crowd - 1) + hands + more, ct.minCount, ct.maxCount);
}

/** The share of their usual length a catch test's times take on this down's stretch: 1, then less past stretch 10. */
export function paceShare(series: number): number {
  const past = Math.max(0, series - ct.fasterAfter);
  return Math.max(ct.floor, 1 - ct.perSeries * past);
}
