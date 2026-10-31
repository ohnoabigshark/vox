/**
 * The catch tests (docs/TIP.md): SNAG IT! and the tip drill, the tap tests
 * on a contested ball. What they share is written once here: when they
 * start, how many dots or pops a situation gives, and how much quicker they
 * get past drive 10.
 */
import { arcadeTuning } from '../content/tuning';
import { driveNumber } from './run';
import type { RunState } from './types';

const ct = arcadeTuning.catchTests;

const clamp = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, x));

/** Whether a contested ball goes to a catch test on this drive. */
export function catchTestsOn(state: RunState): boolean {
  return state.snagAlways || driveNumber(state.drive) >= ct.fromDrive;
}

/**
 * How many dots (or pops): `minCount` from drive 5, one more every
 * `moreEvery` drives; one more for each defender after the first reaching
 * for the ball; one fewer when the receiver's Hands beat the best defender's
 * by `handsGap`, one more the other way. Held to `minCount`–`maxCount`.
 */
export function catchCount(c: { drive: number; crowd: number; handsGap: number }): number {
  // The level (docs/SNAG.md) is the drive's number in the run.
  const byLevel = ct.minCount + Math.floor(Math.max(0, c.drive - ct.fromDrive) / ct.moreEvery);
  const hands = c.handsGap >= ct.handsGap ? -1 : c.handsGap <= -ct.handsGap ? 1 : 0;
  return clamp(byLevel + Math.max(0, c.crowd - 1) + hands, ct.minCount, ct.maxCount);
}

/** The share of their usual length a catch test's times take on this drive: 1, then less past drive 10. */
export function paceShare(drive: number): number {
  const past = Math.max(0, drive - ct.fasterAfter);
  return Math.max(ct.floor, 1 - ct.perDrive * past);
}
