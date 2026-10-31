import { describe, expect, it } from 'vitest';
import { Grab, fractionOf, rowView, snap } from '../../src/dev/bench/row';
import { KNOBS, withValue, type Knob } from '../../src/dev/bench/knobs';

/** docs/BENCH.md, the rework's tests J–L: sliders that move only by their knob. */

const knob = (key: string): Knob => KNOBS.find((x) => x.key === key)!;

describe('grabbing a slider', () => {
  // A 0–1 slider in hundredths, 200 px wide, at 0.5.
  const range = { min: 0, max: 1, step: 0.01 };
  const grab = (): Grab => new Grab(range, () => 200);

  it('J: a touch on the track, away from the knob, changes nothing, and nor does a swipe from there', () => {
    const g = grab();
    expect(g.down('track', 20)).toBe(false);
    expect(g.move(180)).toBeNull();
    expect(g.move(10)).toBeNull();
    g.up();
    expect(g.dragging).toBe(false);
  });

  it('J: dragging the knob changes the value as it moves, from where it was grabbed', () => {
    const g = grab();
    expect(g.down('knob', 103, 0.5)).toBe(true);
    // 20 px right of the grab is a tenth of the track: no jump to the touch.
    expect(g.move(123)).toBe(0.6);
    expect(g.move(83)).toBe(0.4);
    // Past either end, it stops at the end.
    expect(g.move(500)).toBe(1);
    expect(g.move(-500)).toBe(0);
    g.up();
    expect(g.move(150)).toBeNull();
  });

  it('J: values land on the slider’s steps', () => {
    expect(snap(0.123, range)).toBe(0.12);
    expect(snap(7.4, { min: 1, max: 20, step: 1 })).toBe(7);
    expect(snap(-40, { min: -40, max: 40, step: 5 })).toBe(-40);
    expect(fractionOf(0.25, range)).toBe(0.25);
    expect(fractionOf(9, { min: 1, max: 20, step: 1 })).toBeCloseTo(8 / 19, 9);
  });
});

describe('what a row shows', () => {
  const close = knob('snag.close');
  const path = 'snag.close';

  it('L: a tick at the default; nothing else when at the default and nothing is saved', () => {
    const v = rowView(close, path, {}, {});
    expect(v.shown).toBe('0.80 s');
    expect(v.note).toBe('snag.close 0.64 · default');
    // Reach is half to double (0.32–1.28): the default sits a third of the way.
    expect(v.tick).toBeCloseTo(1 / 3, 9);
    expect(v.at).toBeCloseTo(1 / 3, 9);
    expect(v.unsaved).toBe(false);
    expect(v.atDefault).toBe(true);
  });

  it('L: "saved" when the saved value is not the default, UNSAVED when moved since the last save', () => {
    const saved = { [path]: 0.56 };
    expect(rowView(close, path, saved, saved)).toMatchObject({
      shown: '0.70 s',
      note: 'snag.close 0.56 · default 0.64 · saved',
      unsaved: false,
      atDefault: false,
    });
    expect(rowView(close, path, saved, { [path]: 0.48 })).toMatchObject({
      shown: '0.60 s',
      note: 'snag.close 0.48 · default 0.64 · saved 0.56',
      unsaved: true,
    });
    expect(rowView(close, path, {}, { [path]: 0.48 })).toMatchObject({
      note: 'snag.close 0.48 · default 0.64',
      unsaved: true,
    });
  });

  it('K: ↺ sets one slider to its default as an unsaved change, and is faded at the default', () => {
    const saved = { [path]: 0.56, 'snag.window': 0.2 };
    const reset = withValue(saved, path, 0.64);
    expect(reset).toEqual({ 'snag.window': 0.2 });
    expect(rowView(close, path, saved, reset)).toMatchObject({ unsaved: true, atDefault: true });
    expect(rowView(knob('snag.window'), 'snag.window', saved, reset)).toMatchObject({
      unsaved: false,
      atDefault: false,
    });
  });
});
