import { afterEach, describe, expect, it, vi } from 'vitest';
import { layerSaved } from '../../src/arcade/content/savedTuning';
import { arcadeTuning, TIME_SCALE, tuningDefaults } from '../../src/arcade/content/tuning';
import { startRep } from '../../src/dev/bench/reps';

/** docs/BENCH.md, the rework's tests A–C: saved settings over the defaults. */

const ringSeconds = (): number => {
  const dot = startRep('snag', { drive: 5, tacklers: 1, crowd: 1, handsGap: 0 }, 1).state.snag!
    .dots[0]!;
  return (dot.closesAt - dot.appearsAt) / TIME_SCALE;
};

afterEach(() => {
  layerSaved(arcadeTuning, tuningDefaults, {});
  vi.doUnmock('../../src/arcade/content/saved-tuning.json');
  vi.resetModules();
});

describe('saved settings in the game', () => {
  it('A: nothing saved plays tuning.ts exactly; a saved value replaces just its default', () => {
    expect(layerSaved(arcadeTuning, tuningDefaults, {})).toEqual([]);
    expect(arcadeTuning).toEqual(tuningDefaults);
    expect(ringSeconds()).toBeCloseTo(0.8, 9);

    expect(layerSaved(arcadeTuning, tuningDefaults, { 'snag.close': 0.56 })).toEqual([]);
    expect(arcadeTuning.snag.close).toBe(0.56);
    expect(ringSeconds()).toBeCloseTo(0.7, 9);
    // Every other value is its default.
    expect({ ...arcadeTuning.snag, close: 0.64 }).toEqual(tuningDefaults.snag);
    expect(arcadeTuning.breakit).toEqual(tuningDefaults.breakit);

    // Laying a different save starts again from the defaults.
    layerSaved(arcadeTuning, tuningDefaults, { 'snag.window': 0.2 });
    expect(arcadeTuning.snag.close).toBe(0.64);
    expect(arcadeTuning.snag.window).toBe(0.2);
  });

  it('A: the defaults themselves never change', () => {
    layerSaved(arcadeTuning, tuningDefaults, { 'snag.close': 0.56 });
    expect(tuningDefaults.snag.close).toBe(0.64);
    expect(arcadeTuning).not.toBe(tuningDefaults);
  });

  it("B: a saved setting that doesn't exist, or isn't a number, is left out and named", () => {
    const warnings = layerSaved(arcadeTuning, tuningDefaults, {
      'snag.nope': 1,
      'snag.close': 'fast',
      snag: 3,
      'breakit.byArea.9.sweet': 0.1,
      'snag.window': 0.2,
    });
    expect(warnings).toEqual([
      'saved-tuning.json: snag.nope is not a setting in tuning.ts, so it was left out',
      'saved-tuning.json: snag.close is not a number ("fast"), so it was left out',
      'saved-tuning.json: snag is not a setting in tuning.ts, so it was left out',
      'saved-tuning.json: breakit.byArea.9.sweet is not a setting in tuning.ts, so it was left out',
    ]);
    expect(arcadeTuning.snag.close).toBe(0.64);
    expect(arcadeTuning.snag.window).toBe(0.2);
  });

  it('B: a saved file that is not an object of settings is left out whole, and named', () => {
    expect(layerSaved(arcadeTuning, tuningDefaults, [1, 2])).toEqual([
      'saved-tuning.json is not an object of settings, so nothing saved was played',
    ]);
    expect(arcadeTuning).toEqual(tuningDefaults);
  });

  it('C: tuning.ts lays saved-tuning.json over the defaults as it loads, so whatever loads it plays the save', async () => {
    vi.resetModules();
    vi.doMock('../../src/arcade/content/saved-tuning.json', () => ({
      default: { 'snag.close': 0.56 },
    }));
    const fresh = await import('../../src/arcade/content/tuning');
    expect(fresh.arcadeTuning.snag.close).toBe(0.56);
    expect(fresh.tuningDefaults.snag.close).toBe(0.64);
    expect(fresh.savedTuningWarnings).toEqual([]);
    // The sim (which the game and the balance bot both run) reads that same object.
    const sim = await import('../../src/dev/bench/reps');
    const dot = sim.startRep('snag', { drive: 5, tacklers: 1, crowd: 1, handsGap: 0 }, 1).state
      .snag!.dots[0]!;
    expect(dot.closesAt - dot.appearsAt).toBe(0.56);
  });
});
