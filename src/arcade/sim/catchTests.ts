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

const CATCH_TESTS: readonly CatchTest[] = ['snag', 'tip'];

/** Whether a contested ball can go to a catch test on this down's stretch. */
export function catchTestsOn(state: RunState): boolean {
  if (forced(state)) return true;
  const set = settings(state);
  const anyOn = CATCH_TESTS.some((t) => set[t] !== 'off');
  return anyOn && stretchNumber(state.series) >= ct.fromStretch;
}

/** Half and half, from the run's seed (docs/TIP.md, t2). */
const eitherBySeed = (state: RunState): CatchTest =>
  rngFor(state.seed, 'catch', state.step).next() < 0.5 ? 'snag' : 'tip';

/**
 * The catch test this contested ball goes to, or null for today's rule.
 * With one set to always, every contested ball goes to it (with both, half
 * and half). Otherwise none before `fromStretch`; from then on `chance` of
 * them, each half and half, from the run's seed; a ball whose pick is set to
 * off goes to today's rule, so Off on one leaves the other as it was. The
 * roll has its own label, so it draws a number apart from the pick's.
 */
export function catchTestFor(state: RunState): CatchTest | null {
  if (!catchTestsOn(state)) return null;
  const set = settings(state);
  if (forced(state)) {
    const always = CATCH_TESTS.filter((t) => set[t] === 'always');
    return always.length === 1 && always[0] ? always[0] : eitherBySeed(state);
  }
  if (rngFor(state.seed, 'catchChance', state.step).next() >= ct.chance) return null;
  const pick = eitherBySeed(state);
  return set[pick] === 'off' ? null : pick;
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
