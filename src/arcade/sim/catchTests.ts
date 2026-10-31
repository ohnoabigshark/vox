/**
 * The catch tests (docs/TIP.md): SNAG IT! and the tip drill, the tap tests
 * on a contested ball. What they share is written once here: when they
 * start, how many dots or pops a situation gives, and how much quicker they
 * get past drive 10.
 */
import { arcadeTuning } from '../content/tuning';
import { rngFor } from './random';
import { driveNumber } from './run';
import type { Contest } from './ball';
import type { Player, RunState, Vec } from './types';
import { add, clamp, len, norm, scale, sub } from './vec';

const ct = arcadeTuning.catchTests;

/** The catch tests: SNAG IT! and the tip drill. */
export type CatchTest = 'snag' | 'tip';

/** Whether a contested ball goes to a catch test on this drive. */
export function catchTestsOn(state: RunState): boolean {
  return state.snagAlways || state.tipAlways || driveNumber(state.drive) >= ct.fromDrive;
}

/**
 * Which catch test a contested ball goes to (docs/TIP.md, t2): the one
 * ?snag=1 or ?tip=1 forces, or else either, half and half, from the run's
 * seed.
 */
export function whichCatchTest(state: RunState): CatchTest {
  if (state.snagAlways !== state.tipAlways) return state.snagAlways ? 'snag' : 'tip';
  return rngFor(state.seed, 'catch', state.step).next() < 0.5 ? 'snag' : 'tip';
}

/** The freeze: the ball hangs a yard short of the receiver's hands, on its way from `from`. */
export function freezeContested(state: RunState, receiver: Player, from: Vec): void {
  const toward = sub(from, receiver.pos);
  state.field.ball = {
    at: 'contested',
    pos: add(receiver.pos, scale(norm(toward), Math.min(1, len(toward)))),
  };
}

/** What sets a catch test's count: the drive, the defenders reaching for the ball, and the Hands gap. */
export interface CatchSituation {
  readonly drive: number;
  readonly crowd: number;
  /** The receiver's Hands less the best of theirs. */
  readonly handsGap: number;
}

/** The situation a contested ball is played in, on this drive. */
export function contestSituation(state: RunState, contest: Contest): CatchSituation {
  const best = Math.max(...contest.defenders.map((d) => d.stats.hands));
  return {
    drive: driveNumber(state.drive),
    crowd: contest.defenders.length,
    handsGap: contest.receiver.stats.hands - best,
  };
}

/**
 * How many dots (or pops): `minCount` from drive 5, one more every
 * `moreEvery` drives; one more for each defender after the first reaching
 * for the ball; one fewer when the receiver's Hands beat the best defender's
 * by `handsGap`, one more the other way; and `more` (the tip drill's extra
 * pop). Held to `minCount`–`maxCount`.
 */
export function catchCount(c: CatchSituation, more = 0): number {
  // The level (docs/SNAG.md) is the drive's number in the run.
  const byLevel = ct.minCount + Math.floor(Math.max(0, c.drive - ct.fromDrive) / ct.moreEvery);
  const hands = c.handsGap >= ct.handsGap ? -1 : c.handsGap <= -ct.handsGap ? 1 : 0;
  return clamp(byLevel + Math.max(0, c.crowd - 1) + hands + more, ct.minCount, ct.maxCount);
}

/** The share of their usual length a catch test's times take on this drive: 1, then less past drive 10. */
export function paceShare(drive: number): number {
  const past = Math.max(0, drive - ct.fasterAfter);
  return Math.max(ct.floor, 1 - ct.perDrive * past);
}
