import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PLAY_POOL } from '../../src/arcade/content/playPool';
import { PLAYS } from '../../src/arcade/content/plays';
import { arcadeTuning } from '../../src/arcade/content/tuning';
import { aimContact, pocketTime, sweepAngle, sweepSpeed } from '../../src/arcade/sim/ball';
import { physicsOf } from '../../src/arcade/sim/bodies';
import { moveBodies } from '../../src/arcade/sim/physics';
import {
  createRun,
  dispatch,
  downAndDistance,
  downOn,
  endDown,
  frozenForTest,
  nextDown,
  setUpDrive,
  startingRoster,
} from '../../src/arcade/sim/run';
import { breakMarker, countdownLeft, jukeGrade, jukeShowing } from '../../src/arcade/sim/breakit';
import { canThrow, forceBreakKind, step } from '../../src/arcade/sim/step';
import { pathXAt } from '../../src/arcade/sim/ai';
import { propsForDrive } from '../../src/arcade/sim/props';
import { DT } from '../../src/arcade/content/tuning';
import type { ArcadeEvent, Phase, RunState } from '../../src/arcade/sim/types';
import { dist, v } from '../../src/arcade/sim/vec';
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

const PAUSE = arcadeTuning.drive.pause;
const passCard = (s: RunState) => s.hand.findIndex((i) => PLAYS[i]?.handoff === undefined);
const runCard = (s: RunState) => s.hand.findIndex((i) => PLAYS[i]?.handoff !== undefined);

describe('a run', () => {
  it('starts on the first drive: 1st & 10, eight a side, three play cards, no draft', () => {
    const s = createRun(1);
    expect(s.phase).toBe('setup');
    expect(s.drive).toMatchObject({ index: 0, kind: 'intro', down: 1, los: 0, firstDown: 10 });
    expect(downAndDistance(s)).toBe('1st & 10');
    expect(s.field.players).toHaveLength(8);
    expect(s.hand).toHaveLength(3);
    expect(new Set(s.hand).size).toBe(3);
    expect(s.roster.map((p) => p.preferred)).toEqual([
      'blocker',
      'blocker',
      'runner',
      'runner',
      'catcher',
      'catcher',
      'catcher',
    ]);
    expect(s.field.defenders.length).toBeLessThanOrEqual(4);
  });

  it('deals different hands, with handoff cards among them', () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 40; seed++) createRun(seed).hand.forEach((i) => seen.add(i));
    expect(seen.size).toBe(PLAY_POOL.length);
    expect(PLAY_POOL.some((p) => p.handoff !== undefined)).toBe(true);
  });

  it('nobody but the Bats moves before the call', () => {
    const s = createRun(1);
    const before = s.field.players.map((p) => p.pos);
    expect(run(s, 1).state.field.players.map((p) => p.pos)).toEqual(before);
  });

  it('calling a card shows its play on the field; HIKE starts it', () => {
    const s = createRun(4);
    expect(dispatch(s, { type: 'hike' }).state.phase).toBe('setup'); // nothing called yet
    const called = dispatch(s, { type: 'call', hand: 1 });
    expect(called.state.phase).toBe('setup');
    expect(called.state.called).toBe(1);
    expect(called.state.play).toEqual({ index: s.hand[1], flipped: false });
    expect(called.state.field.players.some((p) => p.job.kind === 'route')).toBe(true);
    // Another card can be called instead, until the hike.
    expect(dispatch(called.state, { type: 'call', hand: 2 }).state.called).toBe(2);
    const hiked = dispatch(called.state, { type: 'hike' });
    expect(hiked.state.phase).toBe('play');
    expect(ofType(hiked.events, 'snapped')).toHaveLength(1);
    expect(dispatch(s, { type: 'call', hand: 5 }).state.called).toBeNull();
  });

  it('Flip draws every play in the pool as its mirror picture, routes and line-up', () => {
    // Ours too, whose own line-ups mirror with them (review v11, 2026-10-31).
    const across = (st: RunState) =>
      st.field.players.filter((q) => q.slot >= 0).map((q) => q.pos.x);
    const ends = (st: RunState) =>
      st.field.players.flatMap((q) => (q.job.kind === 'route' ? [q.job.to.at(-1)!.x] : []));
    const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b);
    for (const p of PLAY_POOL) {
      const called = dispatch(createRun(4, undefined, 0, { playbook: [p] }), {
        type: 'call',
        hand: 0,
      }).state;
      const flipped = dispatch(called, { type: 'flip' }).state;
      const mirrored = (xs: number[]) => sorted(xs.map((x) => -x));
      expect(sorted(ends(flipped)), p.id).toEqual(mirrored(ends(called)));
      sorted(across(flipped)).forEach((x, i) =>
        expect(x, p.id).toBeCloseTo(mirrored(across(called))[i]!),
      );
    }
  });

  it('Flip mirrors the called play where it stands', () => {
    // esrauch's plays, which all use the standard line-up: a play with its own
    // line-up mirrors that too (playbook.test.ts, flipped line-ups).
    const s = createRun(4, undefined, 0, { playbook: PLAYS });
    const called = dispatch(s, { type: 'call', hand: 1 }).state;
    const flipped = dispatch(called, { type: 'flip' }).state;
    expect(flipped.play.flipped).toBe(true);
    const routeEnds = (st: RunState) =>
      st.field.players.flatMap((p) =>
        p.job.kind === 'route' ? [p.job.to[p.job.to.length - 1]!.x] : [],
      );
    const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b);
    expect(sorted(routeEnds(flipped))).toEqual(sorted(routeEnds(called).map((x) => -x)));
    // The roster still lines up left to right: the mirror pairs keep their sides
    // (only the slot Catcher, who has no partner, crosses over).
    for (const p of flipped.field.players.filter((q) => q.slot >= 0 && q.slot < 6)) {
      const before = called.field.players.find((q) => q.slot === p.slot)!;
      expect(p.pos.x).toBeCloseTo(before.pos.x);
    }
  });

  it('Flip hands the ball to the other Runner', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = createRun(seed);
      const card = runCard(s);
      if (card < 0) continue;
      const called = dispatch(s, { type: 'call', hand: card }).state;
      const carrierSlot = (st: RunState) => {
        const r = dispatch(st, { type: 'hike' }).state;
        const ball = r.field.ball;
        return ball.at === 'carried'
          ? r.field.players.find((p) => p.id === ball.by)?.slot
          : undefined;
      };
      const plain = carrierSlot(called);
      const flipped = carrierSlot(dispatch(called, { type: 'flip' }).state);
      expect(plain).toBeDefined();
      expect(flipped).toBeDefined();
      expect(flipped).not.toBe(plain);
      return;
    }
    throw new Error('no handoff card dealt');
  });

  it('a handoff card gives its Runner the ball at the hike', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = createRun(seed);
      const card = runCard(s);
      if (card < 0) continue;
      const r = dispatch(dispatch(s, { type: 'call', hand: card }).state, { type: 'hike' });
      expect(ofType(r.events, 'handoff')).toHaveLength(1);
      expect(r.state.field.ball.at).toBe('carried');
      return;
    }
    throw new Error('no handoff card dealt');
  });
});

describe('stats are physics', () => {
  it('Heft is weight, Hustle is speed, Hands is reach: each point the same step', () => {
    const base = physicsOf({ hustle: 50, hands: 50, heft: 50 });
    const more = physicsOf({ hustle: 60, hands: 60, heft: 60 });
    expect(more.mass / base.mass).toBeCloseTo(arcadeTuning.body.mass.perHeft);
    expect(more.speed).toBeGreaterThan(base.speed);
    expect(more.reach).toBeGreaterThan(base.reach);
  });

  it('a faster player outruns a slower one', () => {
    const s = playState([
      { pos: v(-5, 0), stats: { hustle: 70 } },
      { pos: v(5, 0), stats: { hustle: 40 } },
    ]);
    const r = run(s, 1.5).state;
    expect(body(r, 2).pos.y).toBeGreaterThan(body(r, 3).pos.y + 1);
  });

  it('a Blocker holds the rusher it is on', () => {
    const rush = (blocked: boolean) => {
      const s = playState(
        blocked
          ? [{ role: 'blocker', pos: v(0, -1.2), stats: { heft: 60 }, job: { kind: 'block' } }]
          : [],
        [{ kind: 'rusher', pos: v(0, 0), stats: { heft: 60 } }],
      );
      return body(run(s, 1.5).state, blocked ? 100 : 100).pos.y;
    };
    // Unblocked, it charges back at the QB; blocked, it barely moves.
    expect(rush(true)).toBeGreaterThan(rush(false) + 1);
  });

  it('a Blocker 3 Heft heavier pancakes the defender it hits', () => {
    const s = playState(
      [{ role: 'blocker', pos: v(0, -2), stats: { heft: 80 }, job: { kind: 'block' } }],
      [{ kind: 'rusher', pos: v(0, -0.8), stats: { heft: 50 } }],
    );
    const r = run(s, 1);
    expect(ofType(r.events, 'pancake')[0]).toEqual({ type: 'pancake', blocker: 2, defender: 100 });
  });
});

describe('the sideline', () => {
  // BUGS.md B5: a knocked-down body slid on past the sideline, since it
  // skipped the clamp the others get (found by Clear Out, 2026-10-31).
  it('stops a knocked-down defender sliding out of bounds at the sideline', () => {
    const edge = arcadeTuning.field.halfWidth;
    const s = playState([], [{ kind: 'cover', pos: v(edge - 0.01, 5) }]);
    const d = s.field.defenders[0]!;
    d.down = 0.5;
    d.vel = v(6, 0);
    moveBodies(s);
    expect(d.pos.x).toBe(edge);
  });

  it('stops a block on a handoff driving its man out of bounds, after the whistle too', () => {
    const edge = arcadeTuning.field.halfWidth;
    const s = carry(
      playState(
        [
          { role: 'runner', pos: v(0, -2) },
          { role: 'blocker', pos: v(edge - 0.6, 5), stats: { heft: 90 }, job: { kind: 'block' } },
        ],
        [{ kind: 'cover', pos: v(edge, 5), stats: { heft: 10 } }],
      ),
      2,
    );
    s.play = { index: s.playbook.findIndex((p) => p.handoff !== undefined), flipped: false };
    moveBodies(s);
    expect(s.field.defenders[0]!.pos.x).toBe(edge);
  });
});

describe('the sweep and the pocket', () => {
  it('the line starts at the left sideline and sweeps back and forth', () => {
    const s = playState([]);
    const h = (arcadeTuning.sweep.halfAngle * Math.PI) / 180;
    expect(sweepAngle(s)).toBeCloseTo(-h);
    const angles = Array.from({ length: 300 }, (_, i) =>
      sweepAngle({ ...s, time: s.time + i / 60 }),
    );
    expect(Math.max(...angles)).toBeCloseTo(h, 1);
    expect(Math.min(...angles)).toBeCloseTo(-h, 1);
  });

  it('it sweeps faster in later areas, and on the Boss', () => {
    const s = playState([]);
    const at = (area: number, kind: RunState['drive']['kind']) =>
      sweepSpeed({ ...s, drive: { ...s.drive, area, kind } });
    expect(at(1, 'intro')).toBeGreaterThan(at(0, 'intro'));
    expect(at(0, 'boss')).toBeGreaterThan(at(0, 'intro'));
  });

  it('the pocket holds for its sweeps; then, with the ball still in hand, it is a sack', () => {
    const s = playState([]);
    const held = run(s, pocketTime(s) - 0.1);
    expect(ofType(held.events, 'sacked')).toHaveLength(0);
    const r = run(s, pocketTime(s) + 0.2);
    expect(ofType(r.events, 'sacked')).toHaveLength(1);
    expect(ofType(r.events, 'downEnded')[0]).toMatchObject({ result: 'sacked' });
  });
});

describe('throwing: a bullet along the line', () => {
  // A Catcher standing on (4, 6), the QB on (0, -4).
  const shot = (defenders: Parameters<typeof playState>[1] = [], stats = {}, at = v(4, 6)) => {
    const s = playState([{ pos: at, stats, job: stand(at) }], defenders);
    return run(s, 2, throwAt(s, at));
  };

  it('timed on an open Catcher, it is caught', () => {
    expect(ofType(shot().events, 'caught')).toEqual([{ type: 'caught', id: 2, contested: false }]);
  });

  it('a defender in the lane gets to it first and bats it down', () => {
    const r = shot([{ kind: 'cover', pos: v(2, 1) }]);
    expect(ofType(r.events, 'batted')[0]).toMatchObject({ by: 100, contested: false });
  });

  it('it goes past the scrum: a Blocker never catches it, an engaged rusher can’t bat it', () => {
    // A Blocker locked up with a rusher, right in the lane to a Catcher on (4, 6).
    const s = playState(
      [
        { role: 'blocker', pos: v(1.2, -1), job: stand(v(1.2, -1)) },
        { pos: v(4, 6), job: stand(v(4, 6)) },
      ],
      [{ kind: 'rusher', pos: v(1.2, 0.1) }],
    );
    const r = run(s, 2, throwAt(s, v(4, 6)));
    expect(ofType(r.events, 'caught')[0]?.id).toBe(3);
    // A rusher that's free, in the same lane, knocks it down.
    const free = playState(
      [{ pos: v(4, 6), job: stand(v(4, 6)) }],
      [{ kind: 'rusher', pos: v(1.2, 0.1) }],
    );
    expect(ofType(run(free, 2, throwAt(free, v(4, 6))).events, 'batted')[0]?.by).toBe(100);
  });

  it('a Scarecrow’s wide ring blocks a whole lane', () => {
    const r = shot([{ kind: 'zone', pos: v(3.5, 1) }]);
    expect(ofType(r.events, 'batted')[0]?.by).toBe(100);
  });

  it('contested at the catch, the better Hands wins it; ties go to you', () => {
    // A Catcher and a Cover (with nobody to mark, it stands still) either side of the bullet's
    // line to (4, 6), so with even Hands they reach it at the same moment.
    const contest = (catcherHands: number, coverHands: number) => {
      const s = playState(
        [{ pos: v(4.464, 5.814), stats: { hands: catcherHands }, job: stand(v(4.464, 5.814)) }],
        [{ kind: 'cover', pos: v(3.536, 6.186), stats: { hands: coverHands } }],
      );
      return run(s, 2, throwAt(s, v(4, 6)));
    };
    expect(ofType(contest(60, 60).events, 'caught')[0]).toMatchObject({ id: 2, contested: true });
    // Better Hands reach further, so the Cover gets to it first.
    expect(ofType(contest(50, 80).events, 'batted')[0]?.by).toBe(100);
  });

  it('it goes past your players right by the QB', () => {
    const s = playState(
      [
        { pos: v(0.3, -2), job: stand(v(0.3, -2)) },
        { pos: v(1.5, 4), job: stand(v(1.5, 4)) },
      ],
      [],
    );
    const r = run(s, 2, throwAt(s, v(1.5, 4)));
    expect(ofType(r.events, 'caught')[0]?.id).toBe(3);
  });

  it('with nobody in the way it is incomplete', () => {
    const s = playState([{ pos: v(4, 6), job: stand(v(4, 6)) }]);
    const r = run(s, 3, throwAt(s, v(-6, 8)));
    expect(ofType(r.events, 'incomplete')).toHaveLength(1);
    expect(run(r.state, PAUSE + 0.1).state.drive.down).toBe(2);
  });
});

describe('the carrier, and Break it! (the bar)', () => {
  beforeEach(() => forceBreakKind('bar'));
  afterEach(() => forceBreakKind(undefined));
  /** The bar's tackle state (it's always a bar here). */
  const bar = (st: RunState) => {
    const t = st.tackle;
    if (t?.kind !== 'bar') throw new Error('not a bar');
    return t;
  };

  /** A Runner carrying on (0, 2), a gnome dead ahead on (0, 4). */
  const grabbed = (runnerHeft = 50, extra = false, area = 0) => {
    const s = carry(
      playState(
        // A quick runner, so both tacklers get there together.
        [{ role: 'runner', pos: v(0, 2), stats: { hustle: 60, heft: runnerHeft } }],
        [
          { kind: 'cover', pos: v(0, 4), stats: { heft: 50 } },
          ...(extra ? [{ kind: 'cover' as const, pos: v(0.9, 3.6), stats: { heft: 50 } }] : []),
        ],
      ),
      2,
    );
    s.field.lane = 0;
    s.drive = { ...s.drive, area };
    return untilGrabbed(s);
  };

  it('runs for the emptiest lane by itself', () => {
    const s = carry(
      playState([{ role: 'runner', pos: v(0, 0) }], [{ kind: 'cover', pos: v(-1, 4) }]),
      2,
    );
    const r = run(s, 0.5);
    expect(r.state.field.lane).toBeGreaterThan(0.5);
  });

  it('a defender grabbing it starts Break it!, and the play freezes', () => {
    const r = grabbed();
    expect(r.state.phase).toBe('breakit');
    expect(ofType(r.events, 'grabbed')[0]).toMatchObject({ id: 2, by: [100] });
    const frozen = run(r.state, 0.3).state;
    expect(body(frozen, 2).pos).toEqual(body(r.state, 2).pos);
  });

  it('a GREAT breaks it free: the pile scatters, and nobody grabs it for a moment', () => {
    const s = carry(
      playState(
        [{ role: 'runner', pos: v(0, 2) }],
        [
          { kind: 'cover', pos: v(0, 4) },
          { kind: 'cover', pos: v(1.6, 3.2) },
        ],
      ),
      2,
    );
    s.field.lane = 0;
    const g = untilGrabbed(s).state;
    const t = bar(g);
    const r = tapAt(g, (t.sweet.from + t.sweet.to) / 2);
    expect(ofType(r.events, 'breakResult')[0]?.outcome).toBe('break');
    // Both covers are down (the tackler, and the one beside it), and no grab for the breakaway.
    expect(r.state.field.defenders.every((d) => d.down > 0)).toBe(true);
    const next = run(r.state, arcadeTuning.breakit.breakaway - 0.05);
    expect(ofType(next.events, 'grabbed')).toHaveLength(0);
  });

  it('a Break it! hard on the heels of another has a short countdown', () => {
    const g = grabbed().state;
    expect(g.tackle?.ready).toBe(arcadeTuning.countdown.ready);
    const s = carry(
      playState([{ role: 'runner', pos: v(0, 2) }], [{ kind: 'cover', pos: v(0, 4) }]),
      2,
    );
    s.field.lane = 0;
    s.field.lastBreak = s.time - 0.5;
    expect(untilGrabbed(s).state.tackle?.ready).toBe(arcadeTuning.breakit.chainReady);
  });

  it('it opens with a countdown, when taps don\u2019t count; then the marker runs', () => {
    const g = grabbed().state;
    const ready = arcadeTuning.countdown.ready;
    const during = run(g, ready / 2, { breakTap: true }).state;
    expect(during.phase).toBe('breakit');
    expect(countdownLeft(during)).toBeGreaterThan(0);
    expect(breakMarker(during)).toBe(0);
    const after = run(g, ready + 0.3).state;
    expect(countdownLeft(after)).toBeNull();
    expect(breakMarker(after)).toBeGreaterThan(0);
  });

  it('a tap in the sweet spot breaks it: the tackler goes flying, the carrier keeps going', () => {
    const g = grabbed().state;
    const { from, to } = bar(g).sweet;
    const r = tapAt(g, (from + to) / 2);
    expect(ofType(r.events, 'brokeTackle')).toHaveLength(1);
    expect(r.state.phase).toBe('play');
    expect(body(r.state, 100).down).toBeGreaterThan(0);
  });

  it('a close tap drags the tackler a few yards before going down', () => {
    const g = grabbed().state;
    const t = bar(g);
    const close = t.sweet.from > t.near ? t.sweet.from - t.near / 2 : t.sweet.to + t.near / 2;
    const r = tapAt(g, close);
    const dragged = ofType(r.events, 'dragged')[0];
    expect(dragged?.yards).toBeGreaterThan(0);
    const end = run(r.state, 4);
    expect(ofType(end.events, 'tackled')).toHaveLength(1);
    expect(end.state.drive.los).toBeGreaterThan(body(g, 2).pos.y + 0.3);
  });

  it('a tap that misses, or no tap at all, is a tackle', () => {
    const g = grabbed().state;
    const t = bar(g);
    // The sweet spot (and its close band) never reaches back to the start of the trip.
    expect(t.sweet.from - t.near).toBeGreaterThan(0.05);
    const miss = 0.02;
    expect(ofType(tapAt(g, miss).events, 'tackled')).toHaveLength(1);
    expect(ofType(run(g, 4).events, 'tackled')).toHaveLength(1);
  });

  it('the sweet spot is never in the first third of the marker\u2019s trip, which runs either way', () => {
    const dirs = new Set<number>();
    for (let k = 0; k < 24; k++) {
      // Different starting spots grab on different steps, so each meter is a fresh draw.
      const s = carry(
        playState(
          [{ role: 'runner', pos: v(0, 2 - k * 0.07) }],
          [{ kind: 'cover', pos: v(0, 4), stats: { heft: 50 } }],
        ),
        2,
      );
      s.field.lane = 0;
      const t = bar(untilGrabbed(s).state);
      expect(t.sweet.from).toBeGreaterThanOrEqual(arcadeTuning.breakit.earliest);
      expect(t.sweet.to).toBeLessThanOrEqual(1);
      dirs.add(t.dir);
    }
    expect([...dirs].sort()).toEqual([-1, 1]);
  });

  it('the sweet spot narrows area by area, and with an extra tackler, but not with Heft', () => {
    const width = (heft: number, extra = false, area = 0) => {
      const t = bar(grabbed(heft, extra, area).state);
      return t.sweet.to - t.sweet.from;
    };
    expect(width(80)).toBeCloseTo(width(50));
    expect(width(50, false, 1)).toBeLessThan(width(50));
    expect(width(50, false, 2)).toBeLessThan(width(50, false, 1));
    expect(width(50, true)).toBeLessThan(width(50));
  });

  it('running into a planted Scarecrow stops it dead', () => {
    const s = carry(
      // Right in its face: it has no time to pick another lane.
      playState([{ role: 'runner', pos: v(0, 2) }], [{ kind: 'zone', pos: v(0, 3.05) }]),
      2,
    );
    s.field.lane = 0;
    const r = run(s, 2);
    expect(ofType(r.events, 'tackled')[0]?.by).toBe(100);
    expect(ofType(r.events, 'grabbed')).toHaveLength(0);
  });

  it('after two Break it!s in a down, the next grab is just a tackle', () => {
    const s = carry(
      playState([{ role: 'runner', pos: v(0, 2) }], [{ kind: 'cover', pos: v(0, 4) }]),
      2,
    );
    s.field.lane = 0;
    expect(untilGrabbed(s).state.phase).toBe('breakit');
    s.field.breaks = arcadeTuning.breakit.perDown;
    const r = run(s, 2);
    expect(ofType(r.events, 'grabbed')).toHaveLength(0);
    expect(ofType(r.events, 'tackled')[0]?.by).toBe(100);
  });

  it('over the sideline, it is down there', () => {
    const hw = arcadeTuning.field.halfWidth;
    const s = carry(playState([{ pos: v(hw + 0.2, 0) }]), 2);
    expect(ofType(run(s, 0.2).events, 'outOfBounds')).toHaveLength(1);
  });

  it('over the first-down line wins the drive', () => {
    const s = carry(playState([{ pos: v(0, 8) }]), 2);
    expect(ofType(run(s, 1.5).events, 'downEnded')[0]?.result).toBe('firstDown');
  });
});

describe('Break it!: the mash and the juke', () => {
  afterEach(() => forceBreakKind(undefined));

  /** A Runner carrying on (0, 2), grabbed by a gnome on (0, 4). */
  const grabbed = (
    kind: 'mash' | 'juke',
    stats: { heft?: number; hustle?: number } = {},
    extra = false,
    area = 0,
  ) => {
    forceBreakKind(kind);
    const s = carry(
      playState(
        [{ role: 'runner', pos: v(0, 2), stats: { hustle: 60, ...stats } }],
        [
          { kind: 'cover', pos: v(0, 4), stats: { heft: 50, hustle: 50 } },
          ...(extra
            ? [{ kind: 'cover' as const, pos: v(0.9, 3.6), stats: { heft: 50, hustle: 50 } }]
            : []),
        ],
      ),
      2,
    );
    s.field.lane = 0;
    s.drive = { ...s.drive, area };
    return untilGrabbed(s).state;
  };
  /** Tap on every `every`-th step until it's decided. */
  const mash = (state: RunState, every: number) => {
    let s = state;
    const events: ArcadeEvent[] = [];
    for (let i = 0; i < 200 && s.phase === 'breakit'; i++) {
      const r = step(s, i % every === 0 ? { breakTap: true } : {});
      s = r.state;
      events.push(...r.events);
    }
    return { state: s, events };
  };
  /** Juke to `side`, `delay` seconds after the arrow shows (or right away, if `early`). */
  const juke = (state: RunState, side: -1 | 1, delay: number, early = false) => {
    let s = state;
    const events: ArcadeEvent[] = [];
    let shownAt: number | null = null;
    for (let i = 0; i < 200 && s.phase === 'breakit'; i++) {
      if (shownAt === null && jukeShowing(s)) shownAt = s.time;
      const go = early || (shownAt !== null && s.time - shownAt >= delay);
      const r = step(s, go ? { juke: side } : {});
      s = r.state;
      events.push(...r.events);
    }
    return { state: s, events };
  };

  it('each grab is one of the three, at random', () => {
    const kinds = new Set<string>();
    for (let k = 0; k < 30; k++) {
      const s = carry(
        playState([{ role: 'runner', pos: v(0, 2 - k * 0.07) }], [{ kind: 'cover', pos: v(0, 4) }]),
        2,
      );
      s.field.lane = 0;
      kinds.add(untilGrabbed(s).state.tackle!.kind);
    }
    expect([...kinds].sort()).toEqual(['bar', 'juke', 'mash']);
  });

  it('mash: tap fast enough to fill it and the tackle breaks', () => {
    expect(ofType(mash(grabbed('mash'), 3).events, 'brokeTackle')).toHaveLength(1);
  });

  it('mash: half full by the end drags; barely tapping is a tackle', () => {
    const g = grabbed('mash');
    const t = g.tackle!;
    if (t.kind !== 'mash') throw new Error('not a mash');
    // Enough taps for between half and full by the end.
    const taps = Math.ceil(arcadeTuning.breakit.mashDrag / t.perTap) + 1;
    const every = Math.floor((arcadeTuning.breakit.mashSeconds * 60) / taps);
    expect(ofType(mash(g, every).events, 'dragged')).toHaveLength(1);
    expect(ofType(mash(grabbed('mash'), 60).events, 'tackled')).toHaveLength(1);
  });

  it('mash: each tap fills less in later areas, and with an extra tackler, but Heft doesn\u2019t matter', () => {
    const perTap = (heft: number, extra = false, area = 0) => {
      const t = grabbed('mash', { heft }, extra, area).tackle!;
      return t.kind === 'mash' ? t.perTap : 0;
    };
    expect(perTap(80)).toBeCloseTo(perTap(50));
    expect(perTap(50, false, 2)).toBeLessThan(perTap(50, false, 1));
    expect(perTap(50, false, 1)).toBeLessThan(perTap(50));
    expect(perTap(50, true)).toBeLessThan(perTap(50));
  });

  it('juke: the right side, quickly, breaks it; a beat later drags', () => {
    const g = grabbed('juke');
    const t = g.tackle!;
    if (t.kind !== 'juke') throw new Error('not a juke');
    expect(ofType(juke(g, t.side, 0.05).events, 'brokeTackle')).toHaveLength(1);
    const late = (t.window * (arcadeTuning.breakit.jukeBreakShare + 1)) / 2;
    expect(ofType(juke(g, t.side, late).events, 'dragged')).toHaveLength(1);
  });

  it('juke: the wrong side, or nothing at all, is a tackle', () => {
    const g = grabbed('juke');
    const t = g.tackle!;
    if (t.kind !== 'juke') throw new Error('not a juke');
    const wrong = t.side === 1 ? -1 : 1;
    expect(ofType(juke(g, wrong, 0.05).events, 'tackled')).toHaveLength(1);
    expect(ofType(run(g, 4).events, 'tackled')).toHaveLength(1);
  });

  it('juke: the lit button goes GREAT, then OK, then BAD, which lingers before the tackle', () => {
    const g = grabbed('juke');
    const t = g.tackle!;
    if (t.kind !== 'juke') throw new Error('not a juke');
    const at = (sec: number) => run(g, t.showAt - g.time + sec).state;
    expect(jukeGrade(at(0.02))).toBe('great');
    expect(jukeGrade(at(t.window * 0.9))).toBe('ok');
    const late = at(t.window + arcadeTuning.breakit.jukeLinger / 2);
    expect(late.phase).toBe('breakit');
    expect(jukeGrade(late)).toBe('bad');
    expect(at(t.window + arcadeTuning.breakit.jukeLinger + 0.1).phase).not.toBe('breakit');
  });

  it('juke: presses during the countdown don\u2019t count', () => {
    const g = grabbed('juke');
    const t = g.tackle!;
    if (t.kind !== 'juke') throw new Error('not a juke');
    const wrong = t.side === 1 ? -1 : 1;
    const during = run(g, arcadeTuning.countdown.ready / 2, { juke: wrong }).state;
    expect(during.phase).toBe('breakit');
  });

  it('juke: the window shrinks in later areas, not with Hustle', () => {
    const window = (hustle: number, area = 0) => {
      const t = grabbed('juke', { hustle }, false, area).tackle!;
      return t.kind === 'juke' ? t.window : 0;
    };
    expect(window(80)).toBeCloseTo(window(50));
    expect(window(50, 2)).toBeLessThan(window(50, 1));
    expect(window(50, 1)).toBeLessThan(window(50));
  });
});

describe('drives and the run', () => {
  const winDrive = (s: RunState): RunState => {
    const t = structuredClone(s);
    const events: ArcadeEvent[] = [];
    endDown(t, 'firstDown', t.drive.firstDown, events);
    nextDown(t, events);
    return t;
  };

  it('a won drive lines up the next one, waiting for the move on', () => {
    const s = winDrive(createRun(3));
    expect(s.phase).toBe('draft');
    expect(s.drive).toMatchObject({ index: 1, kind: 'challenge', down: 1, los: 0 });
    expect(dispatch(s, { type: 'skipDraft' }).state.phase).toBe('setup');
  });

  it('failing on 4th down is game over', () => {
    const s = playState([]);
    s.drive.down = 4;
    const r = run(run(s, pocketTime(s) + 0.5).state, PAUSE + 0.1);
    expect(r.state.phase).toBe('over');
    expect(ofType(r.events, 'gameOver')).toHaveLength(1);
  });

  it('the main game is three areas of four drives, each area stiffer; the last Boss wins it', () => {
    let s = createRun(7);
    const drives: string[] = [];
    const coverHeft: number[] = [];
    for (let i = 0; i < 12; i++) {
      drives.push(`${s.drive.area}:${s.drive.kind}`);
      const cover = s.field.defenders.find((d) => d.kind === 'cover');
      if (s.drive.kind === 'intro' && cover) coverHeft.push(cover.stats.heft);
      s = winDrive(s);
      if (s.phase === 'draft') s = dispatch(s, { type: 'skipDraft' }).state;
    }
    const area = (a: number) => ['intro', 'challenge', 'gimmick', 'boss'].map((k) => `${a}:${k}`);
    expect(drives).toEqual([...area(0), ...area(1), ...area(2)]);
    expect(s.phase).toBe('won');
    expect(coverHeft).toEqual([30, 40, 50]);
  });

  it('the Boss drive goes for the end zone: "& Goal"', () => {
    const s = createRun(1);
    s.drive = { ...s.drive, kind: 'boss', down: 3 };
    expect(downAndDistance(s)).toBe('3rd & Goal');
  });
});

describe('determinism', () => {
  /** A crude player: calls a pass card, throws a second in, taps Break it! halfway. */
  const playOut = (seed: number, steps = 3000): RunState => {
    let s = createRun(seed, startingRoster());
    for (let i = 0; i < steps && s.phase !== 'over' && s.phase !== 'won'; i++) {
      if (s.phase === 'setup') {
        s = dispatch(s, { type: 'call', hand: Math.max(0, passCard(s)) }).state;
        s = dispatch(s, { type: 'hike' }).state;
      }
      if (s.phase === 'draft') s = dispatch(s, { type: 'skipDraft' }).state;
      const input =
        s.phase === 'breakit'
          ? s.tackle?.kind === 'juke'
            ? jukeShowing(s)
              ? { juke: s.tackle.side }
              : {}
            : { breakTap: (breakMarker(s) ?? 0) > 0.5 || s.tackle?.kind === 'mash' }
          : canThrow(s) && s.time - s.snappedAt > 1
            ? { throw: true }
            : {};
      s = step(s, input).state;
    }
    return s;
  };

  it('replays the same run from the same seed and inputs', () => {
    expect(JSON.stringify(playOut(42, 1500))).toBe(JSON.stringify(playOut(42, 1500)));
  });

  it('never modifies the state passed to step() or dispatch()', () => {
    const s = createRun(3);
    const before = JSON.stringify(s);
    step(s);
    dispatch(s, { type: 'call', hand: 0 });
    expect(JSON.stringify(s)).toBe(before);
  });

  it('keeps its invariants through long runs: no NaNs, nobody off the field but the carrier', () => {
    for (let seed = 1; seed <= 8; seed++) {
      let s = createRun(seed);
      for (let i = 0; i < 2500 && s.phase !== 'over' && s.phase !== 'won'; i++) {
        if (s.phase === 'setup') {
          s = dispatch(dispatch(s, { type: 'call', hand: i % 3 }).state, { type: 'hike' }).state;
        }
        if (s.phase === 'draft') s = dispatch(s, { type: 'skipDraft' }).state;
        const input =
          s.phase === 'breakit'
            ? { breakTap: i % 7 === 0, ...(i % 11 === 0 ? { juke: 1 as const } : {}) }
            : canThrow(s) && i % 50 === 0
              ? { throw: true }
              : {};
        s = step(s, input).state;
        const carrierId = s.field.ball.at === 'carried' ? s.field.ball.by : null;
        for (const b of [...s.field.players, ...s.field.defenders]) {
          expect(Number.isFinite(b.pos.x) && Number.isFinite(b.pos.y)).toBe(true);
          if (b.id !== carrierId && !(b.side === 'defense' && b.latch)) {
            expect(Math.abs(b.pos.x)).toBeLessThanOrEqual(arcadeTuning.field.halfWidth + 1e-9);
          }
        }
      }
    }
  });
});

it('dist is Euclidean', () => {
  expect(dist(v(0, 0), v(3, 4))).toBe(5);
});

describe('the aim line', () => {
  // The QB is at (0, -4); the line runs straight upfield to (0, 20).
  const end = v(0, 20);

  it('stops at the receiver who would catch it now', () => {
    const s = playState([{ pos: v(0, 8), job: stand(v(0, 8)) }]);
    const aim = aimContact(s, v(0, -4), end);
    expect(aim.outcome.kind).toBe('caught');
    expect(aim.at.y).toBeLessThan(8);
    expect(aim.at.y).toBeGreaterThan(8 - 2);
  });

  it('stops at a defender in the way, short of the receiver', () => {
    const s = playState([{ pos: v(0, 8), job: stand(v(0, 8)) }], [{ kind: 'cover', pos: v(0, 3) }]);
    const aim = aimContact(s, v(0, -4), end);
    expect(aim.outcome.kind).toBe('batted');
    expect(aim.at.y).toBeLessThan(3);
  });

  it('runs to its range when nothing is in the way', () => {
    const aim = aimContact(playState([]), v(0, -4), end);
    expect(aim.outcome.kind).toBe('incomplete');
    expect(aim.at).toEqual(end);
  });
});

describe('crowding', () => {
  it('teammates spread out instead of piling up: no two standing players overlap', () => {
    for (const card of [runCard, passCard]) {
      for (let seed = 1; seed <= 12; seed++) {
        let s = createRun(seed);
        const i = card(s);
        if (i < 0) continue;
        s = dispatch(dispatch(s, { type: 'call', hand: i }).state, { type: 'hike' }).state;
        for (let k = 0; k < 400 && s.phase === 'play'; k++) {
          s = step(s).state;
          const team = s.field.players.filter((p) => p.role !== 'qb' && p.down <= 0);
          for (const a of team) {
            for (const b of team) {
              if (a.id < b.id) {
                expect(dist(a.pos, b.pos)).toBeGreaterThan(0.75 * (a.radius + b.radius));
              }
            }
          }
        }
      }
    }
  });
});

describe('the play fake', () => {
  /** A Runner with the ball at the snap, and a Cover out wide on a Catcher. */
  const coverX = (handoff: boolean) => {
    const s = playState(
      [
        { role: 'runner', pos: v(0, -3) },
        { role: 'catcher', pos: v(6, 0) },
      ],
      [{ kind: 'cover', pos: v(6, 2), mark: 3 }],
    );
    s.play = {
      index: PLAYS.findIndex((p) => (p.handoff !== undefined) === handoff),
      flipped: false,
    };
    return body(run(carry(s, 2), 0.5).state, 100).pos.x;
  };

  it('after a handoff the defense keeps playing the pass for a moment', () => {
    // Fooled, the Cover stays out with its Catcher; otherwise it comes for the carrier.
    expect(coverX(true)).toBeGreaterThan(coverX(false) + 0.5);
  });

  it('on a handoff a Blocker drives its man back, further the more Heft it has on him', () => {
    const pushedTo = (heft: number) => {
      const s = playState(
        [
          { role: 'runner', pos: v(-6, -3) },
          { role: 'blocker', pos: v(0, 0), stats: { heft } },
        ],
        [{ kind: 'rusher', pos: v(0, 0.95), stats: { heft: 50 } }],
      );
      s.play = { index: PLAYS.findIndex((p) => p.handoff !== undefined), flipped: false };
      return body(run(carry(s, 2), 0.6).state, 100).pos.y;
    };
    expect(pushedTo(60)).toBeGreaterThan(pushedTo(50) + 0.3);
    expect(pushedTo(50)).toBeGreaterThan(pushedTo(30));
  });
});

describe("Mister Frog's Frog Rain", () => {
  it('his drive shows a lane each down, never over the pumpkin; he stands in the end zone', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = createRun(seed);
      setUpDrive(s, 0, 3, [], true);
      expect(s.drive.kind).toBe('boss');
      expect(s.field.props.some((p) => p.model === 'bosses/misterFrog')).toBe(true);
      const lane = s.field.frogLane!;
      expect(Math.abs(lane.x) - lane.half).toBeGreaterThan(1);
    }
    // Other drives have none.
    const s = createRun(1);
    expect(s.field.frogLane).toBeNull();
  });

  /** A down with a lane down the right side, its frogs about to come down. */
  const rain = (
    players: Parameters<typeof playState>[0],
    defenders: Parameters<typeof playState>[1] = [],
  ) => {
    const s = playState(players, defenders);
    s.field.frogLane = { x: 5.5, half: 3.6, from: -1, to: 16 };
    s.field.frogDump = DT * 2;
    return s;
  };

  it('the frogs all come down at once: a carrier in the lane is FROGGED (tackled there)', () => {
    const s = carry(rain([{ role: 'runner', pos: v(4, 3), job: stand(v(4, 3)) }]), 2);
    const r = run(s, 0.2);
    expect(ofType(r.events, 'frogged')[0]?.id).toBe(2);
    expect(ofType(r.events, 'tackled')).toHaveLength(1);
  });

  it('they flatten everyone else in the lane, and nobody outside it', () => {
    const s = rain(
      [
        { pos: v(4, 6), job: stand(v(4, 6)) },
        { pos: v(-4, 6), job: stand(v(-4, 6)) },
      ],
      [{ kind: 'cover', pos: v(7, 9) }],
    );
    const r = run(s, 0.1);
    expect(ofType(r.events, 'frogRain')[0]?.flattened.slice().sort()).toEqual([100, 2]);
    expect(ofType(r.events, 'frogged')).toHaveLength(0);
    expect(body(r.state, 2).down).toBeGreaterThan(0);
    expect(body(r.state, 3).down).toBe(0);
  });

  it('they come a moment after the snap, and only once', () => {
    const s = createRun(3);
    setUpDrive(s, 0, 3, [], true);
    let st = dispatch(dispatch(s, { type: 'call', hand: 0 }).state, { type: 'hike' }).state;
    expect(st.field.frogDump).toBe(arcadeTuning.frogRain.dumpAt);
    let dumps = 0;
    for (let i = 0; i < 400 && (st.phase === 'play' || st.phase === 'breakit'); i++) {
      const r = step(st, st.phase === 'breakit' ? { breakTap: i % 4 === 0 } : {});
      dumps += ofType(r.events, 'frogRain').length;
      st = r.state;
    }
    expect(dumps).toBeLessThanOrEqual(1);
  });

  it('the rain waits while Break it! is on', () => {
    const s = carry(
      playState([{ role: 'runner', pos: v(0, 2) }], [{ kind: 'cover', pos: v(0, 4) }]),
      2,
    );
    s.field.lane = 0;
    let st = untilGrabbed(s).state;
    expect(st.phase).toBe('breakit');
    st.field.frogLane = { x: 5.5, half: 3.6, from: -1, to: 16 };
    st.field.frogDump = 0.5;
    // Well inside the countdown, so it's still Break it!.
    for (let i = 0; i < 30; i++) st = step(st).state;
    expect(st.phase).toBe('breakit');
    expect(st.field.frogDump).toBe(0.5);
  });
});

describe('the Candy Kingdom', () => {
  it('a run can start there (?area=2), as if the Forest were won', () => {
    const s = createRun(3, startingRoster(), 1);
    expect(s.drive.area).toBe(1);
    expect(s.drive.index).toBe(0);
    expect(s.drive.name).toBe('Gumdrop Lane');
    expect(s.drivesWon).toBe(4);
    expect(s.phase).toBe('setup');
  });

  it('is the second area: its own drives, and the Queen on its Boss drive', () => {
    const s = createRun(3);
    setUpDrive(s, 1, 0, [], true);
    expect(s.drive.name).toBe('Gumdrop Lane');
    setUpDrive(s, 1, 3, [], true);
    expect(s.drive.name).toBe("The Queen's Court");
    expect(s.field.props.some((p) => p.model === 'bosses/queen')).toBe(true);
    expect(s.banned).not.toBeNull();
    expect(s.field.frogLane).toBeNull();
    // The Forest's Boss drive has no Decree.
    setUpDrive(s, 0, 3, [], true);
    expect(s.banned).toBeNull();
  });

  it("the Queen's Royal Decree bans a card each down: tapping it calls nothing", () => {
    const s = createRun(3);
    setUpDrive(s, 1, 3, [], true);
    const banned = s.banned!;
    expect(PLAYS[s.play.index]).toBe(PLAYS[s.hand[banned === 0 ? 1 : 0]!]);
    const r = dispatch(s, { type: 'call', hand: banned });
    expect(r.state.called).toBeNull();
    expect(ofType(r.events, 'banned')).toHaveLength(1);
    const other = banned === 0 ? 1 : 0;
    expect(dispatch(s, { type: 'call', hand: other }).state.called).toBe(other);
  });
});

describe('props on the field', () => {
  const tree = { id: 0, model: 'forestProps/stump', radius: 0.45, scale: 1 };

  it('are laid the same for a seed, out of the middle lane, in from the sidelines, with room between', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const props = propsForDrive(seed, seed % 2, seed % 4);
      expect(propsForDrive(seed, seed % 2, seed % 4)).toEqual(props);
      expect(props.length).toBeGreaterThan(0);
      for (const p of props) {
        expect(Math.abs(p.x) - p.radius).toBeGreaterThanOrEqual(
          arcadeTuning.fieldProps.center - 1e-9,
        );
        expect(Math.abs(p.x) + p.radius).toBeLessThanOrEqual(arcadeTuning.field.halfWidth);
      }
    }
    // Each area lays its own along its own stretch: the Candy Kingdom's first ten yards are candy,
    // and the stretch behind its first drive is still the Forest's.
    const first = propsForDrive(1, 1, 0);
    const own = first.filter((p) => p.y >= 0 && p.y < 10);
    expect(own.length).toBeGreaterThan(0);
    expect(own.every((p) => p.model.startsWith('candyProps/'))).toBe(true);
    expect(first.filter((p) => p.y < 0).every((p) => p.model.startsWith('forestProps/'))).toBe(
      true,
    );
  });

  it('a route straight through a prop goes round it to the end', () => {
    const s = playState([{ pos: v(4, 0), job: { kind: 'route', to: [v(4, 10)], index: 0 } }]);
    s.field.props = [{ ...tree, x: 4, y: 5 }];
    const r = run(s, 5);
    expect(dist(body(r.state, 2).pos, v(4, 10))).toBeLessThan(0.6);
  });

  it('a waypoint inside a prop counts as reached at its edge, and the route goes on', () => {
    const s = playState([
      { pos: v(4, 0), job: { kind: 'route', to: [v(4, 5), v(8, 5)], index: 0 } },
    ]);
    s.field.props = [{ ...tree, x: 4, y: 5 }];
    const r = run(s, 5);
    expect(dist(body(r.state, 2).pos, v(8, 5))).toBeLessThan(0.6);
  });

  it('a carrier running at a prop gets round it and on upfield', () => {
    const s = carry(playState([{ role: 'runner', pos: v(4, 0), job: stand(v(4, 0)) }]), 2);
    s.field.lane = 4;
    s.field.props = [{ ...tree, x: 4, y: 3 }];
    const r = run(s, 3);
    expect(body(r.state, 2).pos.y).toBeGreaterThan(6);
  });
});

describe('the Farm', () => {
  it('is the third area, and the run ends on its last drive', () => {
    const s = createRun(5, startingRoster(), 2);
    expect(s.drive.name).toBe('The Back Forty');
    setUpDrive(s, 2, 3, [], true);
    expect(s.drive.name).toBe("The King's Patch");
  });

  it('the King stands guard on the last drive: a prop, not a defender, past the first-down line', () => {
    const s = createRun(5, startingRoster(), 2);
    setUpDrive(s, 2, 3, [], true);
    const king = s.field.props.find((p) => p.model === 'bosses/king');
    expect(king).toBeDefined();
    expect(king!.x).toBe(0);
    expect(king!.y).toBeGreaterThan(s.drive.firstDown);
    expect(s.field.defenders.some((d) => (d.kind as string) === 'king')).toBe(false);
    // Only on the last drive.
    setUpDrive(s, 2, 2, [], true);
    expect(s.field.props.some((p) => p.model === 'bosses/king')).toBe(false);
  });

  it('a Crow patrols a lane up and down the field', () => {
    const s = createRun(5, startingRoster(), 2);
    setUpDrive(s, 2, 1, [], true);
    const crow = s.field.defenders.find((d) => d.kind === 'crow')!;
    expect(crow.patrol).toHaveLength(2);
    expect(crow.patrol![1]!.x).toBe(crow.patrol![0]!.x);
    expect(crow.patrol![1]!.y - crow.patrol![0]!.y).toBe(arcadeTuning.defense.crowLane);
  });
});

describe("the King's crows (SHOO!)", () => {
  /** A down on the King's drive, just snapped, the QB holding the ball with one Catcher deep. */
  const kingDown = () => {
    const s = playState([{ pos: v(0, 9), job: stand(v(0, 9)) }]);
    s.field.crows = [0, 1].map(() => ({
      phase: 'perched' as const,
      pos: v(0, 12.5),
      left: 0,
      on: null,
      goneAt: null,
    }));
    return s;
  };

  it('they sit on the King until just after the snap, then fly at the ball and land on it', () => {
    const r = run(kingDown(), arcadeTuning.crows.takeoff - 0.1);
    expect(r.state.field.crows?.[0]?.phase).toBe('perched');
    const landed = run(r.state, 4);
    expect(ofType(landed.events, 'crowsLanded')[0]?.on).toBe(1);
  });

  it('SHOO! in time drives them off for the down', () => {
    const s = untilCrows(kingDown());
    const r = run(s, 0.3, { shoo: true });
    expect(ofType(r.events, 'crowsShooed')).toHaveLength(1);
    expect(r.state.field.crows?.[0]?.phase).toBe('gone');
    expect(r.state.field.crows?.[1]?.phase).toBe('perched');
    expect(ofType(r.events, 'sacked')).toHaveLength(0);
  });

  it('then the second pair comes a moment later, and needs its own SHOO!', () => {
    const first = run(untilCrows(kingDown()), 0.1, { shoo: true }).state;
    const wait = run(first, arcadeTuning.crows.nextFlock - 0.1);
    expect(wait.state.field.crows?.[1]?.phase).toBe('perched');
    const second = untilCrows(wait.state);
    expect(second.field.crows?.[1]?.phase).toBe('shoo');
    const r = run(second, 0.2, { shoo: true });
    expect(ofType(r.events, 'crowsShooed')).toHaveLength(1);
    expect(r.state.field.crows?.every((f) => f.phase === 'gone')).toBe(true);
    expect(r.state.field.breaks).toBe(0);
  });

  it('too late, and they knock the QB down: a sack', () => {
    const r = run(untilCrows(kingDown()), arcadeTuning.crows.window + 0.1);
    expect(ofType(r.events, 'crowsStruck')).toHaveLength(1);
    expect(ofType(r.events, 'sacked')).toHaveLength(1);
  });

  it('a quick deep pass leaves them behind', () => {
    const s = kingDown();
    // Throw at the deep Catcher before they take off.
    const thrown = run(s, 0.1, throwAt(s, v(0, 9)));
    const r = run(thrown.state, 2);
    expect(ofType([...thrown.events, ...r.events], 'caught')).toHaveLength(1);
    expect(ofType(r.events, 'crowsStruck')).toHaveLength(0);
  });

  /** Step until the crows land (SHOO! time). */
  function untilCrows(s: RunState): RunState {
    let st = s;
    const shoo = (x: RunState) => !!x.field.crows?.some((f) => f.phase === 'shoo');
    for (let i = 0; i < 600 && !shoo(st); i++) st = step(st).state;
    expect(shoo(st)).toBe(true);
    return st;
  }
});

describe('Bats', () => {
  it('loop their square while nobody comes near', () => {
    const s = playState([{ pos: v(-6, 2), job: stand(v(-6, 2)) }], [{ kind: 'bat', pos: v(4, 6) }]);
    const bat = s.field.defenders[0]!;
    Object.assign(bat, { patrol: [v(4, 6), v(7.5, 6), v(7.5, 9.5), v(4, 9.5)] });
    const r = run(s, 1);
    expect(body(r.state, 100).pos.x).toBeGreaterThan(4.5);
    expect(ofType(r.events, 'grabbed')).toHaveLength(0);
  });

  it('dive at a carrier that comes close, and grab it', () => {
    const s = carry(
      playState([{ role: 'runner', pos: v(4, 3) }], [{ kind: 'bat', pos: v(4, 6) }]),
      2,
    );
    const bat = s.field.defenders[0]!;
    Object.assign(bat, { patrol: [v(4, 6), v(7.5, 6), v(7.5, 9.5), v(4, 9.5)] });
    s.field.lane = 4;
    const r = untilGrabbed(s);
    expect(ofType(r.events, 'grabbed')[0]?.by).toContain(100);
  });
});

describe('Crows and Safeties', () => {
  it('a Crow leaves its lane to dive at a carrier that comes near, and grabs it', () => {
    const s = carry(
      playState([{ role: 'runner', pos: v(4, 1.5) }], [{ kind: 'crow', pos: v(4, 5) }]),
      2,
    );
    const crow = s.field.defenders[0]!;
    Object.assign(crow, { patrol: [v(4, 5), v(4, 13)] });
    s.field.lane = 4;
    const r = untilGrabbed(s);
    expect(ofType(r.events, 'grabbed')[0]?.by).toContain(100);
  });

  it("a Safety's tackle is sure: no Break it!", () => {
    const s = carry(
      playState([{ role: 'runner', pos: v(0, 2) }], [{ kind: 'safety', pos: v(0, 6) }]),
      2,
    );
    s.field.lane = 0;
    const r = run(s, 3);
    expect(ofType(r.events, 'grabbed')).toHaveLength(0);
    expect(ofType(r.events, 'tackled')[0]?.by).toBe(100);
  });

  it('a Safety meets the carrier head on, from upfield', () => {
    const s = carry(
      playState([{ role: 'runner', pos: v(-3, 2) }], [{ kind: 'safety', pos: v(3, 10) }]),
      2,
    );
    s.field.lane = -3;
    const r = run(s, 0.5);
    const safety = body(r.state, 100);
    const carrier = body(r.state, 2);
    expect(safety.pos.y).toBeGreaterThan(carrier.pos.y);
    expect(Math.abs(safety.pos.x - carrier.pos.x)).toBeLessThan(6);
  });

  it('line up deep, well past the line of scrimmage', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const s = createRun(seed);
      for (const d of s.field.defenders.filter((x) => x.kind === 'safety')) {
        expect(d.pos.y - s.drive.los).toBeGreaterThanOrEqual(arcadeTuning.defense.safetyDepth);
      }
    }
  });
});

describe('a handoff runs its play', () => {
  it('reads where a route is across the field at a given point upfield', () => {
    const path = [v(0, -4), v(-5, 1.5), v(-5.5, 12)];
    expect(pathXAt(path, -10)).toBe(0);
    expect(pathXAt(path, 1.5)).toBeCloseTo(-5);
    expect(pathXAt(path, 6.75)).toBeCloseTo(-5.25);
    expect(pathXAt(path, 30)).toBe(-5.5);
  });

  it('the carrier leans toward its planned route: a Sweep goes wide even with room in the middle', () => {
    let s = createRun(3);
    const sweep = PLAYS.findIndex((p) => p.id === 'sweep');
    s.hand = [sweep, 0, 1];
    s = dispatch(dispatch(s, { type: 'call', hand: 0 }).state, { type: 'hike' }).state;
    // Nobody to dodge: just the route to follow.
    s.field.defenders.splice(0);
    s.field.props = [];
    expect(s.field.runPath).not.toBeNull();
    const r = run(s, 2.5);
    const carrier = r.state.field.players.find((p) => p.slot === 2)!;
    expect(carrier.pos.x).toBeLessThan(-3.5);
  });
});

describe('which phases a down is on in (review a10)', () => {
  it('a down is on from the line-up to the end of the play, through a frozen test; a test freezes it', () => {
    const phases: Phase[] = [
      'setup',
      'play',
      'breakit',
      'snag',
      'downOver',
      'draft',
      'over',
      'won',
    ];
    expect(phases.filter(downOn)).toEqual(['setup', 'play', 'breakit', 'snag']);
    expect(phases.filter(frozenForTest)).toEqual(['breakit', 'snag']);
  });
});

describe("Break it!'s countdown left (review c1)", () => {
  it('the sim seconds left in the countdown, then null; null outside Break it!', () => {
    // A Runner carrying on (0, 2), a Cover dead ahead on (0, 4), as the Break it! tests set it up.
    const s = carry(
      playState(
        [{ role: 'runner', pos: v(0, 2), stats: { hustle: 60 } }],
        [{ kind: 'cover', pos: v(0, 4) }],
      ),
      2,
    );
    s.field.lane = 0;
    const g = untilGrabbed(s).state;
    const ready = arcadeTuning.countdown.ready;
    expect(countdownLeft(g)).toBeCloseTo(ready, 1);
    expect(countdownLeft(run(g, ready / 2).state)).toBeCloseTo(ready / 2, 1);
    expect(countdownLeft(run(g, ready + DT).state)).toBeNull();
    expect(countdownLeft(createRun(1))).toBeNull();
  });
});
