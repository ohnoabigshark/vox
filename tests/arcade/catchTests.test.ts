import { describe, expect, it } from 'vitest';
import { arcadeTuning, tuningDefaults } from '../../src/arcade/content/tuning';
import { catchCount, catchTestsOn, paceShare } from '../../src/arcade/sim/catchTests';
import { snagPace } from '../../src/arcade/sim/snag';
import { playState } from './helpers';
import type { RunState } from '../../src/arcade/sim/types';

/**
 * docs/TIP.md, order of work step 2: what SNAG IT! and the tip drill share
 * (when they start, the count, the pace) written once, in `catchTests`,
 * with no change in how SNAG IT! plays.
 */

function onDrive(state: RunState, drive: number): RunState {
  state.drive = { ...state.drive, area: Math.floor((drive - 1) / 4), index: (drive - 1) % 4 };
  return state;
}

describe('the catch tests’ shared settings (TIP.md, step 2)', () => {
  it('live in catchTests, and SNAG IT!’s own block no longer has them', () => {
    const c = tuningDefaults.catchTests;
    expect(c.fromDrive).toBe(5);
    expect([c.minCount, c.maxCount, c.moreEvery, c.handsGap]).toEqual([2, 5, 4, 20]);
    expect([c.fasterAfter, c.perDrive, c.floor]).toEqual([10, 0.05, 0.625]);
    // 0.3 s on screen, at the game's 0.8 time scale.
    expect(c.linger / 0.8).toBeCloseTo(0.3, 9);
    for (const gone of ['fromDrive', 'minDots', 'maxDots', 'moreEvery', 'handsGap']) {
      expect(Object.keys(tuningDefaults.snag)).not.toContain(gone);
    }
    for (const gone of ['fasterAfter', 'perDrive', 'closeFloor', 'linger']) {
      expect(Object.keys(tuningDefaults.snag)).not.toContain(gone);
    }
  });

  it('they start at drive 5, or at once with ?snag=1', () => {
    const s = playState([], []);
    expect(catchTestsOn(onDrive(s, 4))).toBe(false);
    expect(catchTestsOn(onDrive(s, 5))).toBe(true);
    expect(catchTestsOn(onDrive({ ...s, snagAlways: true }, 1))).toBe(true);
  });

  it('the pace: the usual up to drive 10, 5% quicker a drive after, down to 62.5% from drive 18', () => {
    expect(paceShare(5)).toBe(1);
    expect(paceShare(10)).toBe(1);
    expect(paceShare(11)).toBeCloseTo(0.95, 9);
    expect(paceShare(12)).toBeCloseTo(0.9, 9);
    expect(paceShare(18)).toBeCloseTo(0.625, 9);
    expect(paceShare(40)).toBeCloseTo(0.625, 9);
  });

  it('the count: the level, the crowd and the Hands gap, 2 to 5', () => {
    expect(catchCount({ drive: 5, crowd: 1, handsGap: 0 })).toBe(2);
    expect(catchCount({ drive: 9, crowd: 1, handsGap: 0 })).toBe(3);
    expect(catchCount({ drive: 5, crowd: 2, handsGap: 0 })).toBe(3);
    expect(catchCount({ drive: 5, crowd: 1, handsGap: -20 })).toBe(3);
    expect(catchCount({ drive: 5, crowd: 1, handsGap: 20 })).toBe(2);
    expect(catchCount({ drive: 17, crowd: 4, handsGap: -40 })).toBe(5);
  });
});

describe('SNAG IT! plays exactly as before the move (TIP.md, test 3)', () => {
  it('its rings: 0.64 sim s to drive 10, 0.032 quicker a drive, 0.4 from drive 18', () => {
    expect(snagPace(5).close).toBeCloseTo(0.64, 9);
    expect(snagPace(10).close).toBeCloseTo(0.64, 9);
    expect(snagPace(11).close).toBeCloseTo(0.608, 9);
    expect(snagPace(12).close).toBeCloseTo(0.576, 9);
    expect(snagPace(18).close).toBeCloseTo(0.4, 9);
    expect(snagPace(40).close).toBeCloseTo(0.4, 9);
    expect(snagPace(11).gap).toBeCloseTo(0.608 * arcadeTuning.snag.gapShare, 9);
  });
});
