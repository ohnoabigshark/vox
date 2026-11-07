import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  eventKind,
  FROG_RAIN,
  GENERIC_EVENTS,
  TAFFY_FLOOD,
  WILL_O_WISPS,
  type FieldEvent,
} from '../../src/arcade/content/fieldEvents';
import { statusPolarity } from '../../src/arcade/content/statuses';
import { arcadeTuning, DT, TIME_SCALE } from '../../src/arcade/content/tuning';
import { comingFor, heldBy, placeArea } from '../../src/arcade/sim/fieldEvents';
import { separate } from '../../src/arcade/sim/physics';
import { genericEventFor } from '../../src/arcade/sim/run';
import { giveStatus, hasStatus, speedShare } from '../../src/arcade/sim/status';
import type { Body, RunState } from '../../src/arcade/sim/types';
import { v } from '../../src/arcade/sim/vec';
import {
  body,
  carry,
  ofType,
  playState,
  run,
  stand,
  tapAt,
  throwAt,
  untilGrabbed,
} from './helpers';
import { bulletContest } from './contests';
import { step } from '../../src/arcade/sim/step';
import { dotOpen } from '../../src/arcade/sim/snag';

/**
 * docs/FIELD_EVENTS.md, round 5, `field-wisps`' tests: Ethereal (6), the
 * pool of two (7); the editor's (8) are in tests/dev/eventEditor.test.ts and
 * savedEvents.test.ts. Ethereal's rules are docs/STATUSES.md's.
 */

const FROM_WISPS = { kind: 'fieldEvent', event: 'willOWisps' } as const;

/** One of your players by id (to set its job). */
const yours = (s: RunState, id: number) => s.field.players.find((p) => p.id === id)!;

/** Make a body Ethereal for a good while, as the wisps would. */
const ghost = <B extends Body>(b: B): B => {
  giveStatus(b, 'ethereal', 10, FROM_WISPS, []);
  return b;
};

/** Put this event on the field, placed from the line and already counting: it goes off on the next step. */
function setOff(s: RunState, event: FieldEvent): RunState {
  s.field.fieldEvent = { event, area: placeArea(s, event.area), left: DT };
  return s;
}

describe('the wisps (w1)', () => {
  it('a blessing: a circle 6 yards across, 10 yards ahead (7 to 13) on either side, a 3 s spell of Ethereal on yours', () => {
    const w = WILL_O_WISPS;
    expect(w.name).toBe('Will-o’-Wisps');
    expect(w.boss).toBeNull();
    expect(w.area).toEqual({ shape: 'circle', across: 'either', out: 5, at: 10, radius: 3 });
    expect(w.goesOffAs).toBe('spell');
    // It goes off 1 s after the snap and lasts 3 s, on screen.
    expect(w.goesOff / TIME_SCALE).toBeCloseTo(1, 9);
    expect(w.lasts / TIME_SCALE).toBeCloseTo(3, 9);
    expect(w.warning.buildUp).toBeGreaterThan(0);
    expect(w.warning.buildUp).toBeLessThanOrEqual(w.goesOff);
    expect(w.effect).toEqual({ kind: 'status', status: 'ethereal', on: 'yours' });
    expect(w.call).toBeNull();
    expect(w.look).toBe('wisps');
    expect(eventKind(w)).toBe('blessing');
  });

  it('Ethereal helps, and leaves a body’s speed as it is', () => {
    expect(statusPolarity('ethereal')).toBe('helps');
    const s = playState([{ pos: v(0, 0) }]);
    expect(speedShare(ghost(body(s, 2)))).toBe(1);
  });

  it('holds your players in it while it’s on, never a defender', () => {
    // Yours (2) and a Cover (100) standing in the circle, on the side the seed puts it.
    const s = playState(
      [{ pos: v(0, 12), job: stand(v(0, 12)) }],
      [{ kind: 'cover', pos: v(0, 12) }],
    );
    setOff(s, WILL_O_WISPS);
    const area = s.field.fieldEvent!.area;
    if (area.shape !== 'circle') throw new Error('not a circle');
    for (const b of [body(s, 2), body(s, 100)]) b.pos = v(area.x, area.y);
    yours(s, 2).job = stand(v(area.x, area.y));
    body(s, 100).vel = v(0, 0);
    const on = run(s, 0.2).state;
    expect(hasStatus(body(on, 2), 'ethereal')).toBe(true);
    expect(heldBy(body(on, 2), on.field.fieldEvent!)).toBe(true);
    expect(hasStatus(body(on, 100), 'ethereal')).toBe(false);
  });

  it('lets go as one leaves the circle, and of everyone as the spell ends', () => {
    // Two of yours in the circle: 2 walks out once it's on, 3 stays put.
    const s = playState([
      { pos: v(0, 12), job: stand(v(0, 12)) },
      { pos: v(0, 12), job: stand(v(0, 12)) },
    ]);
    setOff(s, WILL_O_WISPS);
    const area = s.field.fieldEvent!.area;
    if (area.shape !== 'circle') throw new Error('not a circle');
    for (const id of [2, 3]) {
      body(s, id).pos = v(area.x, area.y);
      yours(s, id).job = stand(v(area.x, area.y));
    }
    const on = run(s, 0.2).state;
    expect(hasStatus(body(on, 2), 'ethereal')).toBe(true);
    expect(hasStatus(body(on, 3), 'ethereal')).toBe(true);

    // 2 is carried well out of the circle: within a step or two it's solid again; 3 isn't.
    const outside = v(area.x > 0 ? area.x - area.r - 3 : area.x + area.r + 3, area.y);
    body(on, 2).pos = outside;
    yours(on, 2).job = stand(outside);
    const left = run(on, 0.1).state;
    expect(hasStatus(body(left, 2), 'ethereal')).toBe(false);
    expect(hasStatus(body(left, 3), 'ethereal')).toBe(true);

    // The spell ends (3 s on screen): 3, still standing in it, is solid too.
    const ended = run(left, WILL_O_WISPS.lasts + 0.2).state;
    expect(hasStatus(body(ended, 3), 'ethereal')).toBe(false);
  });

  it('the carrier doesn’t steer away from it: it’s a blessing, not a danger; Frog Rain and the taffy still are', () => {
    const s = playState([{ pos: v(0, 0) }]);
    const coming = (event: FieldEvent) =>
      comingFor({ event, area: placeArea(s, event.area), left: 1 });
    expect(coming(WILL_O_WISPS)).toBe(false);
    expect(coming(FROG_RAIN)).toBe(true);
    expect(coming(TAFFY_FLOOD)).toBe(true);
  });
});

describe('Ethereal (test 6)', () => {
  /** A Runner carrying on (0, 2), a gnome dead ahead on (0, 4). */
  const runner = (ethereal: boolean): RunState => {
    const s = carry(
      playState(
        [{ role: 'runner', pos: v(0, 2), stats: { hustle: 60 } }],
        [{ kind: 'cover', pos: v(0, 4) }],
      ),
      2,
    );
    s.field.lane = 0;
    if (ethereal) ghost(body(s, 2));
    return s;
  };

  it('no defender grabs an Ethereal carrier: no Break it!, no tackle', () => {
    expect(untilGrabbed(runner(false)).state.phase).toBe('breakit');
    const r = run(runner(true), 1.5);
    expect(ofType(r.events, 'grabbed')).toEqual([]);
    expect(ofType(r.events, 'tackled')).toEqual([]);
    expect(r.state.phase).toBe('play');
  });

  it('not even a planted Scarecrow, nor a Safety, whose tackles are sure', () => {
    for (const kind of ['zone', 'safety'] as const) {
      const s = carry(
        playState([{ role: 'runner', pos: v(0, 2) }], [{ kind, pos: v(0, 3.05) }]),
        2,
      );
      s.field.lane = 0;
      ghost(body(s, 2));
      const r = run(s, 1.5);
      expect(ofType(r.events, 'tackled')).toEqual([]);
      expect(ofType(r.events, 'grabbed')).toEqual([]);
    }
  });

  it('defenders pass through without a shove; your players among themselves still bump', () => {
    const s = playState(
      [
        { pos: v(0, 5), job: stand(v(0, 5)) },
        { pos: v(3, 5), job: stand(v(3, 5)) },
        { pos: v(3.3, 5), job: stand(v(3.3, 5)) },
      ],
      [{ kind: 'cover', pos: v(0.3, 5) }],
    );
    ghost(body(s, 2));
    ghost(body(s, 3));
    separate(s);
    // The ghost and the Cover overlap, and stay put.
    expect(body(s, 2).pos).toEqual(v(0, 5));
    expect(body(s, 100).pos).toEqual(v(0.3, 5));
    // Two of yours are pushed apart, Ethereal or not.
    expect(body(s, 4).pos.x - body(s, 3).pos.x).toBeGreaterThan(0.3);
  });

  it('a ball still reaches one: a pass to an Ethereal Catcher is caught', () => {
    const s = playState([{ pos: v(4, 6), job: stand(v(4, 6)) }]);
    ghost(body(s, 2));
    const r = run(s, 2, throwAt(s, v(4, 6)));
    expect(ofType(r.events, 'caught')).toEqual([{ type: 'caught', id: 2, contested: false }]);
  });

  it('a defender can still bat a ball meant for one', () => {
    const s = playState([{ pos: v(4, 6), job: stand(v(4, 6)) }], [{ kind: 'cover', pos: v(2, 1) }]);
    ghost(body(s, 2));
    const r = run(s, 2, throwAt(s, v(4, 6)));
    expect(ofType(r.events, 'batted')).toEqual([
      // No target: the Cover got there before the Catcher could reach it (docs/STATS.md, t1).
      { type: 'batted', by: 100, at: expect.anything(), contested: false, target: null },
    ]);
  });

  it('a contested catch graded OK isn’t a tackle: an Ethereal receiver keeps the ball and runs on', () => {
    // SNAG IT! forced, as ?snag=1 does (from series 5 a contest may pick the tip drill instead).
    let s = bulletContest(5, 60, [{ hands: 60 }], 'snag');
    expect(s.phase).toBe('snag');
    ghost(body(s, 2));
    const events = [];
    // Hit the first dot on its close, miss the second: OK.
    for (let i = 0; i < 600 && s.phase === 'snag'; i++) {
      const now = s.time + DT;
      const first = s.snag?.dots[0];
      const hit = first && dotOpen(first, now) && Math.abs(now - first.closesAt) < DT / 2 + 1e-9;
      const r = step(s, hit ? { snag: 0 } : {});
      s = r.state;
      events.push(...r.events);
    }
    const after = run(s, 0.5);
    events.push(...after.events);
    expect(ofType(events, 'snagResult')).toEqual([{ type: 'snagResult', grade: 'ok' }]);
    expect(ofType(events, 'caught')).toEqual([{ type: 'caught', id: 2, contested: true }]);
    expect(ofType(events, 'tackled')).toEqual([]);
    expect(after.state.field.ball).toEqual({ at: 'carried', by: 2 });
    expect(after.state.phase).toBe('play');
  });

  it('a rusher on an Ethereal Blocker isn’t locked up with it: it can still bat the ball', () => {
    // As sim.test's scrum, but the Blocker is Ethereal: the rusher's hands are free.
    const s = playState(
      [
        { role: 'blocker', pos: v(1.2, -1), job: stand(v(1.2, -1)) },
        { pos: v(4, 6), job: stand(v(4, 6)) },
      ],
      [{ kind: 'rusher', pos: v(1.2, 0.1) }],
    );
    ghost(body(s, 2));
    expect(ofType(run(s, 2, throwAt(s, v(4, 6))).events, 'batted')[0]?.by).toBe(100);
  });

  it('one already grabbed stays grabbed: Break it! goes on, and a missed tap is still a tackle', () => {
    const g = untilGrabbed(runner(false)).state;
    expect(g.phase).toBe('breakit');
    ghost(body(g, 2));
    const r = tapAt(g, 0.01);
    const rest = run(r.state, 0.5);
    expect(ofType([...r.events, ...rest.events], 'tackled')[0]?.by).toBe(100);
  });

  it('an Ethereal Blocker can’t block: the rusher runs through it, and it pancakes nobody', () => {
    const rush = (ethereal: boolean | null) => {
      const s = playState(
        ethereal === null
          ? []
          : [{ role: 'blocker', pos: v(0, -1.2), stats: { heft: 60 }, job: { kind: 'block' } }],
        [{ kind: 'rusher', pos: v(0, 0), stats: { heft: 60 } }],
      );
      if (ethereal) ghost(body(s, 2));
      return body(run(s, 1.5).state, 100).pos.y;
    };
    // Blocked, it barely moves; an Ethereal Blocker holds it no more than nobody does.
    expect(rush(false)).toBeGreaterThan(rush(null) + 1);
    expect(rush(true)).toBeCloseTo(rush(null), 0);

    const s = playState(
      [{ role: 'blocker', pos: v(0, -2), stats: { heft: 80 }, job: { kind: 'block' } }],
      [{ kind: 'rusher', pos: v(0, -0.8), stats: { heft: 50 } }],
    );
    ghost(body(s, 2));
    expect(ofType(run(s, 1).events, 'pancake')).toEqual([]);
  });
});

describe('the pool (test 7)', () => {
  it('Halloween’s generic events are the taffy and the wisps', () => {
    expect(GENERIC_EVENTS).toEqual(['taffyFlood', 'willOWisps']);
  });

  it('a stretch that gets one gets either, from the seed: the same seed, the same pick', () => {
    const picked = new Set<string>();
    for (let seed = 1; seed <= 100; seed++) {
      for (let n = 1; n <= 16; n++) {
        const e = genericEventFor(seed, n);
        if (e) picked.add(e.id);
        expect(genericEventFor(seed, n)?.id).toBe(e?.id);
      }
    }
    expect([...picked].sort()).toEqual(['taffyFlood', 'willOWisps']);
  });

  it('the wisps joining changes which, never whether: the same stretches get one as with the taffy alone', () => {
    const marks: string[] = [];
    for (let seed = 1; seed <= 100; seed++) {
      for (let n = 1; n <= 16; n++) marks.push(genericEventFor(seed, n) ? '1' : '0');
    }
    // Taken with the taffy alone in the pool (field-taffy, cdb9921, was
    // 0bdb8979ee44ce29 at one in three), and again at one in two (2026-11-07)
    // with the pool cut to the taffy alone: both give this.
    expect(createHash('sha256').update(marks.join('')).digest('hex').slice(0, 16)).toBe(
      '036b8e66d11b2941',
    );
  });
});

// Keep the halfWidth import honest: the wisps sit inside the field.
it('the wisps’ circle is inside the field on either side', () => {
  const { out, radius } = WILL_O_WISPS.area as { out: number; radius: number };
  expect(out + radius).toBeLessThan(arcadeTuning.field.halfWidth);
});
