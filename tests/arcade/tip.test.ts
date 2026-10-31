import { describe, expect, it } from 'vitest';
import { arcadeTuning, DT, TIME_SCALE } from '../../src/arcade/content/tuning';
import { createRun } from '../../src/arcade/sim/run';
import { step } from '../../src/arcade/sim/step';
import { tipCountdownLeft, tipLanding, tipPops, tipTimes } from '../../src/arcade/sim/tip';
import type { ArcadeEvent, RunState } from '../../src/arcade/sim/types';
import { v } from '../../src/arcade/sim/vec';
import { bulletContest, forced, onDrive, type Force } from './contests';
import { ofType, playState, run, stand } from './helpers';
import { tipView } from '../../src/arcade/ui/testViews';

/** docs/TIP.md: the tests it lists (u2), in its order. */

const tip = arcadeTuning.tip;

/**
 * When to tap each pop, as sim seconds from its landing (0 is on it), or
 * 'none' for no tap. The tap lands on the step nearest that moment.
 */
type TapAt = number | 'none';
const CLEAN = 0;
/** Late, but inside the bobble window (0.1 s on screen). */
const BOBBLE = 0.08;
/** Well before the landing, with the ball still high. */
const EARLY = -0.25;

function play(state: RunState, taps: readonly TapAt[]): { state: RunState; events: ArcadeEvent[] } {
  let s = state;
  const events: ArcadeEvent[] = [];
  for (let i = 0; i < 900 && s.phase === 'tip'; i++) {
    const now = s.time + DT;
    const t = s.tip;
    const at = t ? taps[t.results.length] : undefined;
    const landing = t ? tipLanding(t) : null;
    const tap =
      typeof at === 'number' && landing !== null && Math.abs(now - (landing + at)) < DT / 2 + 1e-9;
    const r = step(s, tap ? { tip: true } : {});
    s = r.state;
    events.push(...r.events);
  }
  // A little live play after, for what follows the grade.
  for (let i = 0; i < 6 && s.phase === 'play'; i++) {
    const r = step(s);
    s = r.state;
    events.push(...r.events);
  }
  return { state: s, events };
}

/**
 * The lob of `lobContest`, in a run with this seed, as it arrives: the pick
 * is made then, from the seed. `flags` turns on ?snag=1 and ?tip=1.
 */
function lobArrives(seed: number, drive: number, flags: readonly Force[] = []): RunState {
  const s = playState(
    [{ pos: v(2.2, 10), job: stand(v(2.2, 10)) }],
    [{ kind: 'cover', pos: v(-0.2, 10) }],
  );
  const seeded = onDrive({ ...s, seed }, drive);
  for (const f of flags) forced(seeded, f);
  seeded.field.ball = {
    at: 'flight',
    from: v(0, -4),
    target: v(0.4, 10),
    thrownAt: seeded.time,
    landsAt: seeded.time + 0.5,
    lob: true,
  };
  return run(seeded, 1).state;
}

describe('1. the pick (t2, t3, g5)', () => {
  it('from drive 5 a contested ball starts SNAG IT! or the tip drill, the same for the same seed', () => {
    const s = bulletContest(5);
    expect(['snag', 'tip']).toContain(s.phase);
    expect(bulletContest(5).phase).toBe(s.phase);
    for (const seed of [3, 4, 5]) expect(lobArrives(seed, 5).phase).toBe(lobArrives(seed, 5).phase);
  });

  it('over many seeds, about half are each', () => {
    let tips = 0;
    for (let seed = 1; seed <= 200; seed++) if (lobArrives(seed, 5).phase === 'tip') tips++;
    expect(tips).toBeGreaterThan(70);
    expect(tips).toBeLessThan(130);
  });

  it('before drive 5, neither: today’s rule settles it', () => {
    const s = bulletContest(4);
    expect(s.snag).toBeNull();
    expect(s.tip).toBeNull();
    expect(s.field.ball).toEqual({ at: 'carried', by: 2 });
  });

  it('?snag=1 alone always gives SNAG IT! and ?tip=1 alone the tip drill, from drive 1', () => {
    expect(createRun(1, undefined, 0, { tipAlways: true }).tipAlways).toBe(true);
    expect(createRun(1).tipAlways).toBe(false);
    for (const drive of [1, 5, 9]) {
      expect(bulletContest(drive, 60, undefined, 'snag').phase).toBe('snag');
      const t = bulletContest(drive, 60, undefined, 'tip');
      expect(t.phase).toBe('tip');
      expect(t.tip?.receiver).toBe(2);
      expect(t.tip?.defenders).toEqual([100]);
      expect(t.field.ball.at).toBe('contested');
    }
    for (let seed = 1; seed <= 20; seed++) {
      expect(lobArrives(seed, 5, ['snag']).phase).toBe('snag');
      expect(lobArrives(seed, 5, ['tip']).phase).toBe('tip');
    }
  });

  it('with both, either, from drive 1', () => {
    const phases = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) phases.add(lobArrives(seed, 1, ['snag', 'tip']).phase);
    expect([...phases].sort()).toEqual(['snag', 'tip']);
  });
});

describe('2. the count (g3)', () => {
  it('SNAG IT!’s rule plus one, 2 to 5', () => {
    expect(tipPops({ drive: 5, crowd: 1, handsGap: 0 })).toBe(3);
    expect(tipPops({ drive: 5, crowd: 1, handsGap: 20 })).toBe(2);
    expect(tipPops({ drive: 5, crowd: 1, handsGap: 40 })).toBe(2);
    expect(tipPops({ drive: 5, crowd: 2, handsGap: 0 })).toBe(4);
    expect(tipPops({ drive: 9, crowd: 1, handsGap: 0 })).toBe(4);
    expect(tipPops({ drive: 13, crowd: 1, handsGap: 0 })).toBe(5);
    expect(tipPops({ drive: 17, crowd: 4, handsGap: -40 })).toBe(5);
  });

  it('a contested ball at drive 5 with one Cover gets 3 pops', () => {
    expect(bulletContest(5, 60, undefined, 'tip').tip?.pops).toHaveLength(3);
  });
});

describe('3. the pace (g2, g3)', () => {
  it('pops of 1.0, 0.8 and 0.64 s on screen, each 0.8 of the last', () => {
    const screen = tipTimes(5, 5).map((t) => t / TIME_SCALE);
    [1.0, 0.8, 0.64, 0.512, 0.4096].forEach((want, i) => expect(screen[i]).toBeCloseTo(want, 9));
  });

  it('past drive 10, shorter by SNAG IT!’s share: the first pop 0.95 s at 11, 0.625 s from 18', () => {
    expect(tipTimes(10, 1)[0]! / TIME_SCALE).toBeCloseTo(1, 9);
    expect(tipTimes(11, 1)[0]! / TIME_SCALE).toBeCloseTo(0.95, 9);
    expect(tipTimes(18, 1)[0]! / TIME_SCALE).toBeCloseTo(0.625, 9);
    expect(tipTimes(40, 1)[0]! / TIME_SCALE).toBeCloseTo(0.625, 9);
  });

  it('the windows: clean within 0.07 s, a bobble within 0.14 s, on screen', () => {
    expect(tip.clean / TIME_SCALE).toBeCloseTo(0.07, 9);
    expect(tip.bobble / TIME_SCALE).toBeCloseTo(0.14, 9);
  });
});

describe('4. the countdown (t5)', () => {
  it('the first pop leaves the hands as countdown.ready ends', () => {
    const s = bulletContest(5, 60, undefined, 'tip');
    const t = s.tip!;
    expect(t.poppedAt).toBeCloseTo(t.startedAt + arcadeTuning.countdown.ready, 9);
    expect(tipCountdownLeft(s)).toBeCloseTo(arcadeTuning.countdown.ready, 9);
    expect(tipCountdownLeft(run(s, arcadeTuning.countdown.ready + DT).state)).toBeNull();
    expect(tipCountdownLeft(createRun(1))).toBeNull();
  });

  it('a tap during the countdown does nothing', () => {
    const s = bulletContest(5, 60, undefined, 'tip');
    const r = step(s, { tip: true });
    expect(ofType(r.events, 'tipPop')).toEqual([]);
    expect(r.state.tip?.results).toEqual([]);
    expect(r.state.phase).toBe('tip');
  });
});

describe('5. a tap (g1, g2, u1)', () => {
  it('on the landing is clean; 0.1 s late, a bobble', () => {
    const r = play(bulletContest(5, 60, undefined, 'tip'), [CLEAN, BOBBLE, -BOBBLE]);
    expect(ofType(r.events, 'tipPop').map((e) => e.result)).toEqual(['clean', 'bobble', 'bobble']);
  });

  it('an early tap is a drop, and so is no tap by 0.14 s after the landing', () => {
    const early = play(bulletContest(5, 60, undefined, 'tip'), [EARLY]);
    expect(ofType(early.events, 'tipPop').map((e) => e.result)).toEqual(['drop']);
    const none = play(bulletContest(5, 60, undefined, 'tip'), ['none']);
    expect(ofType(none.events, 'tipPop').map((e) => e.result)).toEqual(['drop']);
  });

  it('no tap is a drop only once the bobble window has passed', () => {
    const s = bulletContest(5, 60, undefined, 'tip');
    const landing = tipLanding(s.tip!)!;
    const justIn = run(s, landing + tip.bobble - DT - s.time).state;
    expect(justIn.tip?.results).toEqual([]);
    const past = run(s, landing + tip.bobble + 2 * DT - s.time);
    expect(ofType(past.events, 'tipPop').map((e) => e.result)).toEqual(['drop']);
  });

  it('the next pop leaves the hands at the tap', () => {
    const s = bulletContest(5, 60, undefined, 'tip');
    let t = s;
    const landing = tipLanding(s.tip!)!;
    // Step to 0.08 s after the first landing, then tap.
    while (t.time + DT < landing + BOBBLE - DT / 2) t = step(t).state;
    const r = step(t, { tip: true });
    const tapped = r.state.time;
    expect(r.state.tip?.results).toEqual(['bobble']);
    expect(r.state.tip?.poppedAt).toBeCloseTo(tapped, 9);
    expect(tipLanding(r.state.tip!)).toBeCloseTo(tapped + r.state.tip!.pops[1]!, 9);
  });
});

describe('6. the grade (t4, g1)', () => {
  it('all clean: GREAT, caught, the contesting defenders knocked flying, the receiver free', () => {
    // A second Cover with longer arms reaches it too: 5 pops (two defenders, and their Hands 40 better).
    const s = bulletContest(5, 60, [{ hands: 60 }, { hands: 100, along: 1 }], 'tip');
    expect(s.tip?.pops).toHaveLength(5);
    const r = play(s, [CLEAN, CLEAN, CLEAN, CLEAN, CLEAN]);
    expect(ofType(r.events, 'tipResult')).toEqual([{ type: 'tipResult', grade: 'great' }]);
    expect(ofType(r.events, 'caught')).toEqual([{ type: 'caught', id: 2, contested: true }]);
    const contesting = r.state.tipDone?.tip.defenders ?? [];
    expect(contesting).toHaveLength(2);
    for (const id of contesting) {
      expect(r.state.field.defenders.find((d) => d.id === id)?.down).toBeGreaterThan(0);
    }
    expect(r.state.field.breakaway).toBeGreaterThan(0);
  });

  it('a bobble and no drop: OK, caught and tackled on the spot', () => {
    const s = bulletContest(5, 60, undefined, 'tip');
    const r = play(s, [CLEAN, BOBBLE, CLEAN]);
    expect(ofType(r.events, 'tipResult')).toEqual([{ type: 'tipResult', grade: 'ok' }]);
    expect(ofType(r.events, 'caught')).toEqual([{ type: 'caught', id: 2, contested: true }]);
    const ended = ofType(r.events, 'downEnded')[0];
    expect(ended?.result).toBe('tackled');
    expect(ended?.gained).toBeCloseTo(6 - s.drive.los, 0);
  });

  it('a drop ends the drill at once: BAD, batted down by the Cover', () => {
    const r = play(bulletContest(5, 60, undefined, 'tip'), [CLEAN, 'none', CLEAN]);
    expect(ofType(r.events, 'tipPop').map((e) => e.result)).toEqual(['clean', 'drop']);
    expect(ofType(r.events, 'tipResult')).toEqual([{ type: 'tipResult', grade: 'bad' }]);
    expect(ofType(r.events, 'batted')).toEqual([
      { type: 'batted', by: 100, at: expect.anything(), contested: true },
    ]);
    expect(ofType(r.events, 'caught')).toEqual([]);
    expect(r.state.tip).toBeNull();
    expect(r.state.tipDone?.tip.results).toEqual(['clean', 'drop']);
  });

  it('the finished drill is kept, with when it ended, for the box to linger', () => {
    const s = bulletContest(5, 60, undefined, 'tip');
    const r = play(s, [CLEAN, CLEAN, CLEAN]);
    expect(r.state.tipDone?.tip.startedAt).toBe(s.tip?.startedAt);
    expect(r.state.tipDone?.endedAt).toBeLessThanOrEqual(r.state.time);
  });
});

describe('7. outside Break it!’s two a down (t5)', () => {
  it('a Break it! still follows a tip drill in the same down', () => {
    const r = play(bulletContest(5, 60, undefined, 'tip'), [CLEAN, CLEAN, CLEAN]);
    expect(r.state.field.breaks).toBe(0);
    const s = r.state;
    const cover = s.field.defenders[0]!;
    const receiver = s.field.players.find((p) => p.id === 2)!;
    cover.down = 0;
    cover.pos = v(receiver.pos.x + 0.3, receiver.pos.y + 0.3);
    s.field.breakaway = 0;
    let t = s;
    for (let i = 0; i < 30 && t.phase === 'play'; i++) t = step(t).state;
    expect(t.phase).toBe('breakit');
  });
});

describe('8. the view (u1, w1)', () => {
  /** Step a drill until `at` (sim time), tapping clean on each landing before then. */
  function until(state: RunState, at: number, taps = true): RunState {
    let s = state;
    while (s.time + DT <= at + 1e-9 && s.phase === 'tip') {
      const t = s.tip!;
      const landing = tipLanding(t);
      const now = s.time + DT;
      const tap = taps && landing !== null && Math.abs(now - landing) < DT / 2 + 1e-9;
      s = step(s, tap ? { tip: true } : {}).state;
    }
    return s;
  }

  it('no drill, no box', () => {
    expect(tipView(createRun(1))).toBeNull();
  });

  it('the countdown: the seconds left on screen, the ball resting on the hands, no pips played', () => {
    const s = bulletContest(5, 60, undefined, 'tip');
    const view = tipView(s)!;
    expect(view.id).toBe(s.tip!.startedAt);
    expect(view.ready).toBeCloseTo(arcadeTuning.countdown.ready / TIME_SCALE, 9);
    expect(view.ball).toBe(0);
    expect(view.pips).toEqual([null, null, null]);
    expect(view.flash).toBeNull();
  });

  it('the ball: up to the top at the first pop’s middle, back on the hands at its landing; lower on the next', () => {
    const s = bulletContest(5, 60, undefined, 'tip');
    const t = s.tip!;
    const [first, second] = t.pops as [number, number];
    const mid = until(s, t.poppedAt + first / 2);
    expect(tipView(mid)!.ready).toBeNull();
    expect(tipView(mid)!.ball).toBeCloseTo(1, 1);
    // Just before the landing, low and falling; the shadow nearly full.
    const low = until(s, t.poppedAt + first - 2 * DT);
    expect(tipView(low)!.ball).toBeGreaterThan(0);
    expect(tipView(low)!.ball).toBeLessThan(0.2);
    expect(tipView(low)!.shadow).toBeGreaterThan(0.8);
    // Tapped clean on the landing: the next pop, 0.8 as long, peaks about 0.64 as high.
    const tapped = until(s, t.poppedAt + first);
    const t2 = tapped.tip!;
    expect(t2.results).toEqual(['clean']);
    const mid2 = until(tapped, t2.poppedAt + second / 2);
    expect(tipView(mid2)!.ball).toBeCloseTo(0.64, 1);
  });

  it('a late ball falls below the hands, and stays on the turf once dropped', () => {
    const s = bulletContest(5, 60, undefined, 'tip');
    const t = s.tip!;
    const late = until(s, t.poppedAt + t.pops[0]! + 3 * DT, false);
    expect(tipView(late)!.ball).toBeLessThan(0);
    const dropped = until(s, t.poppedAt + t.pops[0]! + tip.bobble + 2 * DT, false);
    expect(dropped.phase).not.toBe('tip');
    const view = tipView(dropped)!;
    expect(view.pips).toEqual(['drop', null, null]);
    expect(view.ball).toBeLessThan(0);
    expect(view.flash).toBe('drop');
  });

  it('the pips and the flash: each pop’s result, the last one flashing a moment', () => {
    const s = bulletContest(5, 60, undefined, 'tip');
    const t = s.tip!;
    const one = until(s, t.poppedAt + t.pops[0]!);
    expect(tipView(one)!.pips).toEqual(['clean', null, null]);
    expect(tipView(one)!.flash).toBe('clean');
    const later = until(one, one.time + 0.3);
    expect(tipView(later)!.flash).toBeNull();
  });

  it('the box stays for the linger after the grade, then goes', () => {
    const s = bulletContest(5, 60, undefined, 'tip');
    let t = s;
    for (let i = 0; i < 900 && t.phase === 'tip'; i++) {
      const d = t.tip!;
      const landing = tipLanding(d);
      const tap = landing !== null && Math.abs(t.time + DT - landing) < DT / 2 + 1e-9;
      t = step(t, tap ? { tip: true } : {}).state;
    }
    expect(t.tipDone).not.toBeNull();
    const ended = t.tipDone!.endedAt;
    expect(tipView(t)!.pips).toEqual(['clean', 'clean', 'clean']);
    const linger = arcadeTuning.catchTests.linger;
    let u = t;
    while (u.time + DT < ended + linger - 1e-9) u = step(u).state;
    expect(tipView(u)).not.toBeNull();
    u = step(step(u).state).state;
    expect(tipView(u)).toBeNull();
  });
});

describe('never fail silently', () => {
  it('a step in the tip phase with no drill running throws, rather than leaving the play stuck', () => {
    const s = bulletContest(5, 60, undefined, 'tip');
    expect(() => step({ ...s, tip: null })).toThrow('tip drill phase with no tip drill running');
  });
});
