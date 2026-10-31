import { afterEach, describe, expect, it } from 'vitest';
import { layerSaved } from '../../src/arcade/content/savedTuning';
import { arcadeTuning, DT, TIME_SCALE, tuningDefaults } from '../../src/arcade/content/tuning';
import { createRun, driveAt, driveNumber } from '../../src/arcade/sim/run';
import { dotOpen, nextDot, snagCount, snagPace } from '../../src/arcade/sim/snag';
import { step } from '../../src/arcade/sim/step';
import type { ArcadeEvent, RunState } from '../../src/arcade/sim/types';
import { snagView } from '../../src/arcade/ui/testViews';
import { v } from '../../src/arcade/sim/vec';
import { ofType, playState, run, stand, throwAt } from './helpers';

/** docs/SNAG.md: the tests it lists, in its order. */

const sn = arcadeTuning.snag;

/** Put a down on the given drive of the run (1-based: drive 5 is the Candy Queendom's first). */
function onDrive(state: RunState, drive: number): RunState {
  const area = Math.floor((drive - 1) / 4);
  state.drive = { ...state.drive, area, index: (drive - 1) % 4 };
  return state;
}

/**
 * A bullet to (4, 6) with a Catcher half a yard to the right of its line, and
 * Covers placed (from their reach) so each gets a hand to it at the same
 * moment as the Catcher: a contested ball. `along` puts a Cover that far
 * further up the line (yards), still reaching it at that moment. With more
 * Hands on the Cover, today's rule gives it the ball.
 */
function bulletContest(
  drive: number,
  catcherHands = 60,
  covers: readonly { hands: number; along?: number }[] = [{ hands: 60 }],
): RunState {
  const dir = v(0.371, 0.928);
  const right = v(0.928, -0.371);
  const s = playState(
    [{ pos: v(4 + right.x * 0.5, 6 + right.y * 0.5), stats: { hands: catcherHands } }],
    covers.map((c) => ({ kind: 'cover' as const, pos: v(0, 30), stats: { hands: c.hands } })),
  );
  const catcher = s.field.players[1]!;
  catcher.job = stand(catcher.pos);
  // How far short of (4, 6), along the line, the ball comes into the Catcher's reach.
  const entry = Math.sqrt(catcher.reach ** 2 - 0.25);
  covers.forEach((c, i) => {
    const d = s.field.defenders[i]!;
    const along = c.along ?? 0;
    const off = Math.sqrt(d.reach ** 2 - (entry + along) ** 2);
    d.pos = v(4 + dir.x * along - right.x * off, 6 + dir.y * along - right.y * off);
  });
  onDrive(s, drive);
  return run(s, 2, throwAt(s, v(4, 6))).state;
}

/** A lob coming down at (0.4, 10) between a Catcher and a Cover, the Cover nearer: contested. */
function lobContest(drive: number): RunState {
  const s = playState(
    [{ pos: v(2.2, 10), job: stand(v(2.2, 10)) }],
    [{ kind: 'cover', pos: v(-0.2, 10) }],
  );
  onDrive(s, drive);
  s.field.ball = {
    at: 'flight',
    from: v(0, -4),
    target: v(0.4, 10),
    thrownAt: s.time,
    landsAt: s.time + 0.5,
    lob: true,
  };
  return run(s, 1).state;
}

type Tap = 'hit' | 'early' | 'none';

/** Play SNAG IT! out: each dot tapped on its close ('hit'), as soon as it shows ('early'), or not at all. */
function snag(state: RunState, taps: readonly Tap[]): { state: RunState; events: ArcadeEvent[] } {
  let s = state;
  const events: ArcadeEvent[] = [];
  for (let i = 0; i < 600 && s.phase === 'snag'; i++) {
    const now = s.time + DT;
    const dots = s.snag?.dots ?? [];
    const tap = dots.findIndex(
      (d, k) =>
        dotOpen(d, now) &&
        ((taps[k] === 'hit' && Math.abs(now - d.closesAt) < DT / 2 + 1e-9) ||
          (taps[k] === 'early' && now - d.appearsAt < DT)),
    );
    const r = step(s, tap >= 0 ? { snag: tap } : {});
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

describe('SNAG IT!: how many dots (s1)', () => {
  it('2 from drive 5, one more a zone, 5 from drive 17', () => {
    expect(snagCount({ drive: 5, crowd: 1, handsGap: 0 })).toBe(2);
    expect(snagCount({ drive: 8, crowd: 1, handsGap: 0 })).toBe(2);
    expect(snagCount({ drive: 9, crowd: 1, handsGap: 0 })).toBe(3);
    expect(snagCount({ drive: 13, crowd: 1, handsGap: 0 })).toBe(4);
    expect(snagCount({ drive: 17, crowd: 1, handsGap: 0 })).toBe(5);
    expect(snagCount({ drive: 40, crowd: 1, handsGap: 0 })).toBe(5);
    // Before drive 5 (only with ?snag=1), the level gives 2.
    expect(snagCount({ drive: 1, crowd: 1, handsGap: 0 })).toBe(2);
  });

  it('one more for each defender after the first in reach', () => {
    expect(snagCount({ drive: 5, crowd: 2, handsGap: 0 })).toBe(3);
    expect(snagCount({ drive: 5, crowd: 3, handsGap: 0 })).toBe(4);
  });

  it('one fewer when the receiver’s Hands beat theirs by 20, one more the other way', () => {
    expect(snagCount({ drive: 9, crowd: 1, handsGap: 20 })).toBe(2);
    expect(snagCount({ drive: 9, crowd: 1, handsGap: 19 })).toBe(3);
    expect(snagCount({ drive: 9, crowd: 1, handsGap: -20 })).toBe(4);
    expect(snagCount({ drive: 9, crowd: 1, handsGap: -19 })).toBe(3);
  });

  it('never under 2 or over 5', () => {
    expect(snagCount({ drive: 5, crowd: 1, handsGap: 40 })).toBe(2);
    expect(snagCount({ drive: 17, crowd: 4, handsGap: -30 })).toBe(5);
  });

  it('a level is the drive’s number in the run', () => {
    expect(driveNumber({ area: 0, index: 0 })).toBe(1);
    expect(driveNumber({ area: 1, index: 0 })).toBe(5);
    expect(driveNumber({ area: 2, index: 3 })).toBe(12);
    expect(driveNumber({ area: 4, index: 0 })).toBe(17);
  });

  it('and back: the area and index of a drive number (review a7)', () => {
    expect(driveAt(1)).toEqual({ area: 0, index: 0 });
    expect(driveAt(5)).toEqual({ area: 1, index: 0 });
    expect(driveAt(12)).toEqual({ area: 2, index: 3 });
    for (let n = 1; n <= 20; n++) expect(driveNumber(driveAt(n))).toBe(n);
  });
});

describe('SNAG IT!: how fast (s2)', () => {
  it('rings close in 0.8 s on screen, dots 0.5 s apart, up to drive 10', () => {
    expect(snagPace(5)).toEqual({ close: sn.close, gap: sn.close * sn.gapShare });
    expect(snagPace(10)).toEqual(snagPace(5));
    // On screen, at the game's 0.8 time scale.
    expect(sn.close / 0.8).toBeCloseTo(0.8);
    expect((sn.close * sn.gapShare) / 0.8).toBeCloseTo(0.5);
  });

  it('past drive 10, faster each drive, down to the floor', () => {
    expect(snagPace(11).close).toBeCloseTo(sn.close - sn.perDrive);
    expect(snagPace(12).close).toBeCloseTo(sn.close - 2 * sn.perDrive);
    expect(snagPace(11).gap).toBeCloseTo(snagPace(11).close * sn.gapShare);
    expect(snagPace(18).close).toBeCloseTo(sn.closeFloor);
    expect(snagPace(40)).toEqual(snagPace(18));
  });
});

describe('SNAG IT!: when (c2, c3, c6)', () => {
  it('before drive 5 a contested bullet is settled as today', () => {
    // Today's rule: even Hands, it's yours; better Hands on the Cover, it's batted.
    const won = bulletContest(4);
    expect(won.snag).toBeNull();
    expect(won.field.ball).toEqual({ at: 'carried', by: 2 });
    const lost = bulletContest(4, 60, [{ hands: 70 }]);
    expect(lost.snag).toBeNull();
    expect(lost.field.ball).toMatchObject({ at: 'dead', how: 'batted' });
  });

  it('from drive 5 a contested bullet goes to SNAG IT!, whichever way today’s rule would go', () => {
    for (const cover of [60, 70]) {
      const s = bulletContest(5, 60, [{ hands: cover }]);
      expect(s.phase).toBe('snag');
      expect(s.snag?.receiver).toBe(2);
      expect(s.snag?.defenders).toEqual([100]);
      expect(s.field.ball.at).toBe('contested');
    }
  });

  it('a contested lob goes to it too', () => {
    const s = lobContest(5);
    expect(s.phase).toBe('snag');
    expect(s.snag?.receiver).toBe(2);
    expect(s.snag?.defenders).toEqual([100]);
  });

  it('an uncontested catch is unchanged', () => {
    const s = playState([{ pos: v(4, 6), job: stand(v(4, 6)) }]);
    onDrive(s, 9);
    const r = run(s, 2, throwAt(s, v(4, 6)));
    expect(ofType(r.events, 'caught')).toEqual([{ type: 'caught', id: 2, contested: false }]);
    expect(r.state.snag).toBeNull();
  });

  it('?snag=1 turns it on from drive 1', () => {
    const base = createRun(1, undefined, 0, { snagAlways: true });
    expect(base.snagAlways).toBe(true);
    const s = playState(
      [{ pos: v(4.464, 5.814), stats: { hands: 60 }, job: stand(v(4.464, 5.814)) }],
      [{ kind: 'cover', pos: v(3.536, 6.186), stats: { hands: 60 } }],
    );
    const on = { ...s, snagAlways: true };
    expect(run(on, 2, throwAt(on, v(4, 6))).state.phase).toBe('snag');
  });

  it('the dots: 2 for one Cover at drive 5, more for a second defender in reach and its Hands', () => {
    expect(bulletContest(5).snag?.dots).toHaveLength(2);
    // A second Cover, further up the line with longer arms, reaches it at the same moment:
    // one more for it, and one more for its Hands (40 better than the Catcher's).
    const crowd = bulletContest(5, 60, [{ hands: 60 }, { hands: 100, along: 1 }]);
    expect(crowd.snag?.defenders).toEqual([101, 100]);
    expect(crowd.snag?.dots).toHaveLength(4);
  });

  it('the dots come 0.5 s apart after the countdown, inside the box, apart from the last two', () => {
    const s = bulletContest(9, 60, [{ hands: 60 }, { hands: 100, along: 1 }]);
    const t = s.snag;
    if (!t) throw new Error('no snag');
    const { close, gap } = snagPace(9);
    t.dots.forEach((d, i) => {
      expect(d.appearsAt).toBeCloseTo(t.startedAt + arcadeTuning.countdown.ready + i * gap);
      expect(d.closesAt).toBeCloseTo(d.appearsAt + close);
      expect(d.result).toBeNull();
      for (const c of [d.x, d.y]) {
        expect(c).toBeGreaterThanOrEqual(sn.margin);
        expect(c).toBeLessThanOrEqual(1 - sn.margin);
      }
      for (const back of [1, 2]) {
        const o = t.dots[i - back];
        if (o) expect(Math.hypot(d.x - o.x, d.y - o.y)).toBeGreaterThanOrEqual(sn.minApart);
      }
      const last = t.dots[i - 1];
      if (last) expect(Math.hypot(d.x - last.x, d.y - last.y)).toBeLessThanOrEqual(sn.maxApart);
    });
  });
});

describe('SNAG IT!: hits and misses (s3)', () => {
  it('a tap within the window hits', () => {
    const r = snag(bulletContest(5), ['hit', 'hit']);
    expect(ofType(r.events, 'snagDot').map((e) => e.hit)).toEqual([true, true]);
  });

  it('a tap as the dot shows (early) misses it', () => {
    const r = snag(bulletContest(5), ['early', 'hit']);
    expect(ofType(r.events, 'snagDot')).toEqual([
      { type: 'snagDot', index: 0, hit: false },
      { type: 'snagDot', index: 1, hit: true },
    ]);
  });

  it('no tap misses once the window has passed', () => {
    const s = bulletContest(5);
    const d = s.snag?.dots[0];
    if (!d) throw new Error('no dot');
    const before = run(s, d.closesAt + sn.window - s.time - DT);
    expect(ofType(before.events, 'snagDot')).toHaveLength(0);
    const after = run(before.state, 2 * DT);
    expect(ofType(after.events, 'snagDot')).toEqual([{ type: 'snagDot', index: 0, hit: false }]);
  });

  it('a tap on a dot not showing yet does nothing', () => {
    const s = bulletContest(5);
    const r = step(s, { snag: 1 });
    expect(r.state.snag?.dots[1]?.result).toBeNull();
    expect(ofType(r.events, 'snagDot')).toHaveLength(0);
  });
});

describe('SNAG IT!: the grade (c4, s4)', () => {
  it('every dot hit: GREAT, caught, the Cover knocked down, the receiver running', () => {
    const r = snag(bulletContest(5), ['hit', 'hit']);
    expect(ofType(r.events, 'snagResult')).toEqual([{ type: 'snagResult', grade: 'great' }]);
    expect(ofType(r.events, 'caught')).toEqual([{ type: 'caught', id: 2, contested: true }]);
    expect(r.state.field.ball).toEqual({ at: 'carried', by: 2 });
    expect(r.state.field.defenders[0]?.down).toBeGreaterThan(0);
    expect(r.state.phase).toBe('play');
    expect(r.state.snag).toBeNull();
  });

  it('one miss: OK, caught and tackled where it was caught', () => {
    const r = snag(bulletContest(5), ['hit', 'none']);
    expect(ofType(r.events, 'snagResult')).toEqual([{ type: 'snagResult', grade: 'ok' }]);
    expect(ofType(r.events, 'caught')).toEqual([{ type: 'caught', id: 2, contested: true }]);
    expect(ofType(r.events, 'tackled')[0]).toEqual({ type: 'tackled', id: 2, by: 100 });
    expect(ofType(r.events, 'downEnded')[0]?.result).toBe('tackled');
  });

  it('two misses: BAD, batted down by the Cover', () => {
    const r = snag(bulletContest(5), ['none', 'early']);
    expect(ofType(r.events, 'snagResult')).toEqual([{ type: 'snagResult', grade: 'bad' }]);
    expect(ofType(r.events, 'caught')).toHaveLength(0);
    expect(ofType(r.events, 'batted')[0]).toMatchObject({ by: 100, contested: true });
    expect(ofType(r.events, 'downEnded')[0]?.result).toBe('batted');
  });

  it('a lob snagged is the receiver’s', () => {
    const r = snag(lobContest(5), ['hit', 'hit']);
    expect(ofType(r.events, 'caught')).toEqual([{ type: 'caught', id: 2, contested: true }]);
  });
});

describe('SNAG IT! and Break it! (c5)', () => {
  it('isn’t one of the two Break it!s a down', () => {
    const r = snag(bulletContest(5), ['hit', 'hit']);
    expect(r.state.field.breaks).toBe(0);
  });
});

describe('SNAG IT!: the countdown (cd-c10)', () => {
  afterEach(() => void layerSaved(arcadeTuning, tuningDefaults, {}));

  it('1: the first dot comes as the countdown ends, 2.0 s on screen after the freeze', () => {
    const t = bulletContest(9, 60, [{ hands: 60 }, { hands: 100, along: 1 }]).snag;
    if (!t) throw new Error('no snag');
    expect((t.dots[0]!.appearsAt - t.startedAt) / TIME_SCALE).toBeCloseTo(2, 9);
    expect('call' in arcadeTuning.snag).toBe(false);
  });

  it('2: during it the box says get ready, with the seconds left, and no dot; then dot 1 and the title', () => {
    const s = bulletContest(5);
    const start = snagView(s);
    expect(start?.ready).toBeCloseTo(2, 6);
    expect(start?.dots.every((d) => d.ring === null)).toBe(true);
    const half = run(s, arcadeTuning.countdown.ready / 2).state;
    expect(snagView(half)?.ready).toBeCloseTo(1, 1);
    expect(snagView(half)?.dots.every((d) => d.ring === null)).toBe(true);
    const after = run(s, arcadeTuning.countdown.ready + DT).state;
    expect(snagView(after)?.ready).toBeNull();
    expect(snagView(after)?.dots[0]?.ring).not.toBeNull();
  });

  it('3: a tap during the countdown hits nothing and costs nothing', () => {
    const s = bulletContest(5);
    const r = step(s, { snag: 0 });
    expect(r.state.snag?.dots[0]?.result).toBeNull();
    expect(ofType(r.events, 'snagDot')).toHaveLength(0);
    const played = snag(r.state, ['hit', 'hit']);
    expect(ofType(played.events, 'snagResult')).toEqual([{ type: 'snagResult', grade: 'great' }]);
  });

  it("4: one setting, countdown.ready, moves SNAG IT!'s first dot", () => {
    layerSaved(arcadeTuning, tuningDefaults, { 'countdown.ready': 2.4 });
    const t = bulletContest(5).snag;
    if (!t) throw new Error('no snag');
    expect(t.dots[0]!.appearsAt - t.startedAt).toBeCloseTo(2.4, 9);
  });
});

describe('SNAG IT!: the last dot is seen (review a1)', () => {
  it('the finished SNAG IT!, every dot graded, is kept for the box to show a moment longer', () => {
    const s = bulletContest(5);
    const startedAt = s.snag?.startedAt;
    const r = snag(s, ['hit', 'hit']);
    expect(r.state.snag).toBeNull();
    const done = r.state.snagDone;
    expect(done?.snag.startedAt).toBe(startedAt);
    expect(done?.snag.dots.map((d) => d.result)).toEqual(['hit', 'hit']);
    // Graded on the step the last dot was tapped (a few steps of play follow in the helper).
    expect(done?.endedAt).toBeLessThanOrEqual(r.state.time);
    // 0.3 s on screen, at the game's 0.8 time scale.
    expect(sn.linger / 0.8).toBeCloseTo(0.3, 9);
  });
});

describe('SNAG IT!: never fail silently (review a8)', () => {
  it('a step in the SNAG IT! phase with no test running throws, rather than leaving the play stuck', () => {
    const s = bulletContest(5);
    s.snag = null;
    expect(() => step(s, {})).toThrow('SNAG IT! phase with no SNAG IT! running');
  });
});

describe('SNAG IT!: the dot to tap, defined once (review a5)', () => {
  it('a dot is open from when it shows until it is graded; the next dot is the first open one', () => {
    const s = bulletContest(5);
    const [d0, d1] = s.snag?.dots ?? [];
    if (!d0 || !d1) throw new Error('no dots');
    expect(dotOpen(d0, d0.appearsAt - DT)).toBe(false);
    expect(dotOpen(d0, d0.appearsAt)).toBe(true);
    expect(nextDot(s)).toBeNull();
    const shown = run(s, d1.appearsAt - s.time + DT).state;
    expect(nextDot(shown)).toBe(0);
    shown.snag!.dots[0]!.result = 'hit';
    expect(dotOpen(shown.snag!.dots[0]!, shown.time)).toBe(false);
    expect(nextDot(shown)).toBe(1);
  });
});

describe('SNAG IT!: what the plan’s tests promised, checked in full (review a4)', () => {
  it('every dot hit: every defender contesting it is knocked down, and the receiver runs free', () => {
    const r = snag(bulletContest(5, 60, [{ hands: 60 }, { hands: 100, along: 1 }]), [
      'hit',
      'hit',
      'hit',
      'hit',
    ]);
    expect(ofType(r.events, 'snagResult')).toEqual([{ type: 'snagResult', grade: 'great' }]);
    const contesting = r.state.snagDone?.snag.defenders ?? [];
    expect(contesting).toHaveLength(2);
    for (const id of contesting) {
      expect(r.state.field.defenders.find((d) => d.id === id)?.down).toBeGreaterThan(0);
    }
    expect(r.state.field.breakaway).toBeGreaterThan(0);
  });

  it('one miss: tackled on the spot, no yards after the catch', () => {
    const s = bulletContest(5);
    const r = snag(s, ['hit', 'none']);
    const caughtAt = r.state.snagDone?.snag;
    expect(caughtAt).toBeDefined();
    const ended = ofType(r.events, 'downEnded')[0];
    expect(ended?.result).toBe('tackled');
    // The ball hangs a yard short of the receiver's hands at (4, 6), and it's caught there.
    expect(ended?.gained).toBeCloseTo(6 - s.drive.los, 0);
  });

  it('a Break it! still follows a SNAG IT! in the same down, both of them', () => {
    const r = snag(bulletContest(5), ['hit', 'hit']);
    expect(r.state.field.breaks).toBe(0);
    expect(arcadeTuning.breakit.perDown).toBe(2);
    // A Cover back on its feet grabs the receiver: Break it! starts as usual.
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

  it('before drive 5 a contested lob is settled as today; from drive 5, whichever way it would go', () => {
    // A lob onto (0.4, 10): the Catcher at x 2.2, a Cover at x `cover` (they move as it falls).
    const lob = (drive: number, cover: number): RunState => {
      const s = playState(
        [{ pos: v(2.2, 10), job: stand(v(2.2, 10)) }],
        [{ kind: 'cover', pos: v(cover, 10) }],
      );
      onDrive(s, drive);
      s.field.ball = {
        at: 'flight',
        from: v(0, -4),
        target: v(0.4, 10),
        thrownAt: s.time,
        landsAt: s.time + 0.5,
        lob: true,
      };
      return run(s, 1).state;
    };
    // Today's rule, before drive 5: one caught, one batted, no SNAG IT!.
    expect(lob(4, -0.2).field.ball).toEqual({ at: 'carried', by: 2 });
    expect(lob(4, 0.3).field.ball).toMatchObject({ at: 'dead', how: 'batted' });
    // From drive 5, both are SNAG IT!.
    expect(lob(5, -0.2).phase).toBe('snag');
    expect(lob(5, 0.3).phase).toBe('snag');
  });

  it('the floor: 0.5 s to close and about 0.3 s apart, from drive 18', () => {
    const { close, gap } = snagPace(18);
    expect(close / 0.8).toBeCloseTo(0.5, 9);
    expect(gap / 0.8).toBeCloseTo(0.3125, 9);
    expect(snagPace(30)).toEqual(snagPace(18));
    expect(snagPace(17).close).toBeGreaterThan(close);
  });
});
