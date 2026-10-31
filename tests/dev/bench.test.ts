import { afterEach, describe, expect, it } from 'vitest';
import { arcadeTuning, DT, TIME_SCALE } from '../../src/arcade/content/tuning';
import { breakHardness } from '../../src/arcade/sim/breakit';
import type { StepInput } from '../../src/arcade/sim/types';
import { shooShowing } from '../../src/arcade/ui/testViews';
import { Bench } from '../../src/dev/bench/bench';
import {
  BENCH_TESTS,
  KNOBS,
  allPaths,
  applySettings,
  fromScreen,
  knobsFor,
  pathOf,
  pathsOf,
  reachOf,
  defaultValue,
  toScreen,
  tuningValue,
  withValue,
  withoutPaths,
  type Knob,
} from '../../src/dev/bench/knobs';
import {
  startRep,
  stepRep,
  summary,
  timingText,
  type Rep,
  type RepResult,
  type Situation,
} from '../../src/dev/bench/reps';

/** docs/BENCH.md, tests 1-5 and 7-11, in its order. */

const at = (drive: number, more: Partial<Situation> = {}): Situation => ({
  drive,
  tacklers: 1,
  crowd: 1,
  handsGap: 0,
  ...more,
});

const knob = (key: string): Knob => {
  const k = KNOBS.find((x) => x.key === key);
  if (!k) throw new Error(`no knob ${key}`);
  return k;
};

/** Step a rep to its end, with `tap` deciding each step's input from the rep and the step's time. */
function play(
  rep: Rep,
  tap: (rep: Rep, t: number) => StepInput | undefined = () => undefined,
): RepResult {
  let r = rep;
  for (let i = 0; i < 1200 && !r.result; i++) {
    r = stepRep(r, tap(r, r.state.time + DT) ?? {}).rep;
  }
  if (!r.result) throw new Error('the rep never ended');
  return r.result;
}

afterEach(() => applySettings({}));

describe('the knobs', () => {
  it('1: every slider names a real tuning value, starts at its default, and its reach holds it', () => {
    for (const k of KNOBS) {
      for (const path of pathsOf(k)) {
        const byDefault = defaultValue(path);
        expect(typeof tuningValue(path), path).toBe('number');
        expect(tuningValue(path), path).toBe(byDefault);
        const r = reachOf(k, path);
        expect(r.min, path).toBeLessThanOrEqual(byDefault);
        expect(r.max, path).toBeGreaterThanOrEqual(byDefault);
      }
    }
    expect(allPaths()).toEqual(KNOBS.flatMap(pathsOf));
    // Half to double (k5, the Coach's pick).
    expect(reachOf(knob('snag.close'), 'snag.close')).toMatchObject({ min: 0.32, max: 1.28 });
    // Counts in whole numbers; shares never past 1.
    expect(reachOf(knob('snag.maxDots'), 'snag.maxDots')).toMatchObject({
      min: 3,
      max: 10,
      step: 1,
    });
    expect(reachOf(knob('breakit.jukeBreakShare'), 'breakit.jukeBreakShare')).toMatchObject({
      min: 0.25,
      max: 1,
    });
  });

  it('2: each tab has its own sliders; the three Break it!s share the countdown and the extra tackler', () => {
    const keys = (t: (typeof BENCH_TESTS)[number]): string[] => knobsFor(t).map((k) => k.key);
    const shared = ['breakit.ready', 'breakit.perExtraTackler'];
    expect(keys('bar')).toEqual([
      ...shared,
      'breakit.meterSeconds',
      'breakit.earliest',
      'breakit.byArea.{area}.sweet',
      'breakit.near',
    ]);
    expect(keys('mash')).toEqual([
      ...shared,
      'breakit.mashSeconds',
      'breakit.byArea.{area}.mashPerTap',
      'breakit.mashDrag',
    ]);
    expect(keys('juke')).toEqual([
      ...shared,
      'breakit.byArea.{area}.jukeWindow',
      'breakit.jukeBreakShare',
      'breakit.jukeLinger',
    ]);
    // SNAG IT!: every value in its block.
    expect(keys('snag').sort()).toEqual(
      Object.keys(arcadeTuning.snag)
        .map((k) => `snag.${k}`)
        .sort(),
    );
    expect(keys('shoo')).toEqual(['crows.window']);
  });

  it('N: SNAG IT! shows the seven that shape a rep; the eleven that shape a run are behind More', () => {
    const shown = (t: (typeof BENCH_TESTS)[number]): string[] =>
      knobsFor(t)
        .filter((k) => !k.more)
        .map((k) => k.label);
    const more = (t: (typeof BENCH_TESTS)[number]): string[] =>
      knobsFor(t)
        .filter((k) => k.more)
        .map((k) => k.key);
    expect(shown('snag')).toEqual([
      'Ring closes in',
      'Hit window ±',
      'Next dot after (share of the close)',
      '"SNAG IT!" call',
      'Dot size',
      'Ring starts at (times the dot)',
      'Dots at most apart',
    ]);
    expect(more('snag')).toEqual([
      'snag.minApart',
      'snag.margin',
      'snag.box',
      'snag.fromDrive',
      'snag.fasterAfter',
      'snag.perDrive',
      'snag.closeFloor',
      'snag.minDots',
      'snag.maxDots',
      'snag.perZone',
      'snag.handsGap',
    ]);
    for (const t of ['bar', 'mash', 'juke', 'shoo'] as const) expect(more(t)).toEqual([]);
  });

  it('3: a moved slider changes the next rep, and Reset to defaults puts it back', () => {
    applySettings({ 'snag.close': fromScreen(knob('snag.close'), 1) });
    const dot = startRep('snag', at(5), 1).state.snag!.dots[0]!;
    expect((dot.closesAt - dot.appearsAt) / TIME_SCALE).toBeCloseTo(1, 6);
    applySettings({});
    const back = startRep('snag', at(5), 1).state.snag!.dots[0]!;
    expect(back.closesAt - back.appearsAt).toBe(0.64);
  });

  it('3: a slider moved back to its default drops out of the settings, and Reset drops the tab', () => {
    const close = withValue({}, 'snag.close', 0.56);
    expect(close).toEqual({ 'snag.close': 0.56 });
    expect(withValue(close, 'snag.close', 0.64)).toEqual({});
    expect(withoutPaths({ ...close, 'crows.window': 0.7 }, ['snag.close'])).toEqual({
      'crows.window': 0.7,
    });
  });

  it("4: a by-area slider edits the picked drive's area", () => {
    const sweet = knob('breakit.byArea.{area}.sweet');
    expect(pathOf(sweet, 7)).toBe('breakit.byArea.1.sweet');
    expect(pathOf(sweet, 2)).toBe('breakit.byArea.0.sweet');
    // Past the Farm, the Farm's (hard mode tightens it from there).
    expect(pathOf(sweet, 15)).toBe('breakit.byArea.2.sweet');
    applySettings({ [pathOf(sweet, 7)]: 0.1 });
    expect(breakHardness(1).sweet).toBe(0.1);
    expect(breakHardness(0).sweet).toBe(0.09);
  });

  it('5: seconds show screen time; the tuning number is what is stored', () => {
    const close = knob('snag.close');
    expect(toScreen(close, 0.64)).toBeCloseTo(0.8, 9);
    expect(fromScreen(close, 1)).toBeCloseTo(0.8, 9);
    const share = knob('snag.gapShare');
    expect(toScreen(share, 0.625)).toBe(0.625);
  });
});

describe('the situation', () => {
  it('7: the dot count follows the drive, the crowd and the Hands gap, and the summary says so', () => {
    const dots = (s: Situation): number => startRep('snag', s, 1).state.snag!.dots.length;
    expect(dots(at(17))).toBe(5);
    expect(dots(at(5, { crowd: 2 }))).toBe(3);
    expect(dots(at(5, { handsGap: 20 }))).toBe(2);
    expect(dots(at(9, { handsGap: -20 }))).toBe(4);
    expect(summary('snag', at(9, { handsGap: -20 }))).toBe(
      'drive 9 · 4 dots · ring 0.80 s · 0.50 s apart',
    );
  });

  it("8: two tacklers make the bar's sweet spot 0.6 of its size", () => {
    const width = (tacklers: number): number => {
      const t = startRep('bar', at(1, { tacklers }), 1).state.tackle!;
      if (t.kind !== 'bar') throw new Error('not a bar');
      return t.sweet.to - t.sweet.from;
    };
    expect(width(1)).toBeCloseTo(0.09, 9);
    expect(width(2)).toBeCloseTo(0.054, 9);
  });
});

describe('the reps', () => {
  it('9: each tab starts its own test at once', () => {
    for (let seed = 1; seed <= 12; seed++) {
      for (const kind of ['bar', 'mash', 'juke'] as const) {
        const s = startRep(kind, at(5), seed).state;
        expect(s.phase).toBe('breakit');
        expect(s.tackle?.kind).toBe(kind);
      }
    }
    expect(startRep('snag', at(5), 1).state.phase).toBe('snag');
    const shoo = startRep('shoo', at(5), 1).state;
    expect(shooShowing(shoo)).toBe(true);
    expect(shoo.field.crows?.[0]?.on).toBe(1);
  });

  it('10: SNAG IT! times each dot against its ring closing', () => {
    const result = play(startRep('snag', at(5), 3), (r, t) => {
      const first = r.state.snag?.dots[0];
      return first && first.result === null && t >= first.closesAt + 0.04 ? { snag: 0 } : undefined;
    });
    expect(result.grade).toBe('ok');
    if (result.timing.test !== 'snag') throw new Error('not snag');
    const [first, second] = result.timing.dots;
    expect(first?.hit).toBe(true);
    expect(first?.off).toBeGreaterThanOrEqual(0.05);
    expect(first?.off).toBeLessThan(0.05 + DT / TIME_SCALE);
    expect(second).toEqual({ off: null, hit: false });
    expect(timingText(result.timing)).toMatch(/^\+0\.0[56] hit · none$/);
    // Before a dot is played, it's still to come.
    expect(timingText(startRep('snag', at(5), 3).timing)).toBe('… · …');
  });

  it('10: the bar times the tap from the middle of the sweet spot', () => {
    const rep = startRep('bar', at(1), 2);
    const t0 = rep.state.tackle!;
    if (t0.kind !== 'bar') throw new Error('not a bar');
    const mid = (t0.sweet.from + t0.sweet.to) / 2;
    const go = t0.startedAt + t0.ready;
    const b = arcadeTuning.breakit;
    let tappedAt = 0;
    const result = play(rep, (_r, t) => {
      if ((t - go) / b.meterSeconds < mid) return undefined;
      tappedAt = t;
      return { breakTap: true };
    });
    expect(result.grade).toBe('great');
    if (result.timing.test !== 'bar') throw new Error('not bar');
    const off = (((tappedAt - go) / b.meterSeconds - mid) * b.meterSeconds) / TIME_SCALE;
    expect(result.timing.off).toBeCloseTo(off, 9);
    expect(timingText(result.timing)).toBe(`late +${off.toFixed(2)} s`);
  });

  it('10: the mash counts taps, taps a second, and how full it got', () => {
    const rep = startRep('mash', at(1), 2);
    const go = rep.state.tackle!.startedAt + rep.state.tackle!.ready;
    let n = 0;
    let last = 0;
    const result = play(rep, (_r, t) => {
      if (t < go || n++ % 3 !== 0) return undefined;
      last = t;
      return { breakTap: true };
    });
    expect(result.grade).toBe('great');
    if (result.timing.test !== 'mash') throw new Error('not mash');
    // Every tap after the go counts (it takes 11 at 0.1 a tap: ten tenths add up to just under 1).
    expect(result.timing.taps).toBe(Math.ceil(n / 3));
    expect(result.timing.fill).toBe(1);
    // Taps a second: the taps over the screen time from the go to the last of them.
    expect(result.timing.perSecond).toBeCloseTo(result.timing.taps / ((last - go) / TIME_SCALE), 9);
    expect(timingText(result.timing)).toMatch(/^\d+ taps · \d+\.\d a second · 100%$/);
  });

  it('10: the juke times the reaction to the arrow, and calls a wrong side', () => {
    const rep = startRep('juke', at(1), 2);
    const t0 = rep.state.tackle!;
    if (t0.kind !== 'juke') throw new Error('not a juke');
    const react = (side: -1 | 1): RepResult =>
      play(rep, (_r, t) => (t >= t0.showAt + 0.2 - 1e-9 ? { juke: side } : undefined));
    const right = react(t0.side);
    expect(right.grade).toBe('great');
    expect(timingText(right.timing)).toBe('0.25 s of 0.69 s');
    const wrong = react(t0.side === 1 ? -1 : 1);
    expect(wrong.grade).toBe('bad');
    expect(timingText(wrong.timing)).toBe('0.25 s of 0.69 s · wrong side');
  });

  it('10: SHOO times the reaction to the landing, out of the window', () => {
    const rep = startRep('shoo', at(5), 2);
    const shooed = play(rep, (_r, t) => (t >= 0.4 - 1e-9 ? { shoo: true } : undefined));
    expect(shooed.grade).toBe('great');
    expect(timingText(shooed.timing)).toBe('0.50 s of 0.75 s');
    const late = play(rep);
    expect(late.grade).toBe('bad');
    expect(timingText(late.timing)).toBe('too late · 0.75 s');
  });

  it('11: with Again on the next rep starts a second after the grade; off, it waits for GO', () => {
    const bench = new Bench({ test: 'shoo', situation: at(5), again: true });
    bench.go();
    bench.press({ shoo: true });
    let finished: RepResult | null = null;
    for (let i = 0; i < 10 && !finished; i++) finished = bench.tick(1 / 60).finished;
    expect(finished?.grade).toBe('great');
    expect(bench.reps).toBe(1);
    bench.tick(0.9);
    expect(bench.reps).toBe(1);
    bench.tick(0.15);
    expect(bench.reps).toBe(2);
    expect(bench.rep?.result).toBeNull();

    const waits = new Bench({ test: 'shoo', situation: at(5), again: false });
    waits.go();
    waits.press({ shoo: true });
    for (let i = 0; i < 300; i++) waits.tick(1 / 60);
    expect(waits.reps).toBe(1);
    expect(waits.rep?.result?.grade).toBe('great');
    waits.go();
    expect(waits.reps).toBe(2);
  });

  it('11: Again stops after a rep nobody tapped in', () => {
    const bench = new Bench({ test: 'shoo', situation: at(5), again: true });
    bench.go();
    for (let i = 0; i < 300; i++) bench.tick(1 / 60);
    expect(bench.reps).toBe(1);
    expect(bench.rep?.result?.grade).toBe('bad');
  });
});
