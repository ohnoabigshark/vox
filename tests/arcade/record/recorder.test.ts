import { beforeAll, describe, expect, it } from 'vitest';
import { createRun } from '../../../src/arcade/sim/run';
import type { ArcadeEvent, RunState, Tackle } from '../../../src/arcade/sim/types';
import { v } from '../../../src/arcade/sim/vec';
import { RunRecorder, recordable } from '../../../src/arcade/record/recorder';
import { JACK, type PlayResult } from '../../../src/arcade/record/types';
import { playState } from '../helpers';

/**
 * docs/STATS.md, the record branch's scenarios (f2): the recorder fed one
 * down at a time. Bodies are playState's: the QB (1), your players from 2
 * (body 2 plays roster slot 0, the player with id 1), defenders from 100.
 */

/** One step: its events, and what changed on the field by its end. */
interface Frame {
  readonly events: ArcadeEvent[];
  readonly set?: (s: RunState) => void;
}

const META = { id: 'run-1', build: 'abc123', link: 'snag=1', now: Date.UTC(2026, 10, 3, 12) };

/** Feed `frames` to a recorder over `state`, step by step. */
function feed(state: RunState, frames: readonly Frame[], rec = new RunRecorder(state, META)) {
  let s = state;
  for (const f of frames) {
    const next = structuredClone(s);
    f.set?.(next);
    rec.step(s, next, f.events);
    s = next;
  }
  return { rec, state: s };
}

/** A down with three of yours (bodies 2, 3, 4: ids 1, 2, 3) and a Cover (100). */
const field = (): RunState =>
  playState(
    [{ pos: v(2, 2) }, { role: 'runner', pos: v(-1, -2) }, { role: 'blocker', pos: v(0, -1) }],
    [{ kind: 'cover', pos: v(3, 12) }],
  );

const at = (id: number, y: number) => (s: RunState) => {
  s.field.players.find((p) => p.id === id)!.pos = v(0, y);
};
const deadAt =
  (y: number, how: 'tackled' | 'incomplete' | 'batted' | 'sacked' = 'tackled') =>
  (s: RunState) => {
    s.field.ball = { at: 'dead', pos: v(0, y), how };
  };
const breakIt = (kind: Tackle['kind']) => (s: RunState) => {
  s.tackle = { kind, startedAt: 0, ready: 0, tacklers: [100], dragYards: 1 } as unknown as Tackle;
};

const called: Frame = {
  events: [{ type: 'called', id: 'slants', play: 'Slants', flipped: false }],
};
const snapped: Frame = { events: [{ type: 'snapped' }] };
const thrown: Frame = { events: [{ type: 'thrown', target: v(0, 8), landsAt: 1 }] };

/** The one down's result. */
const only = (frames: readonly Frame[], state = field()): PlayResult => {
  const { rec } = feed(state, frames);
  expect(rec.record.downs).toHaveLength(1);
  return rec.record.downs[0]!;
};

describe('a pass play', () => {
  let pass: PlayResult;
  beforeAll(() => {
    pass = only([
      called,
      snapped,
      thrown,
      { events: [{ type: 'caught', id: 2, contested: false }], set: at(2, 7) },
      {
        events: [{ type: 'grabbed', id: 2, by: [100] }],
        set: (s) => (at(2, 9)(s), breakIt('bar')(s)),
      },
      {
        events: [
          { type: 'breakResult', outcome: 'drag' },
          { type: 'dragged', id: 2, yards: 1 },
        ],
      },
      {
        events: [
          { type: 'tackled', id: 2, by: 100 },
          { type: 'downEnded', result: 'tackled', gained: 11 },
        ],
        set: deadAt(11),
      },
    ]);
  });

  it('the situation and the call by id', () => {
    expect(pass).toMatchObject({ seriesNumber: 1, down: 1, toGo: 10, los: 0 });
    expect(pass.play).toBe('slants');
    expect(pass.flipped).toBe(false);
  });

  it('kind pass: Jack, the target and the catcher, the outcome and the yards', () => {
    expect(pass.kind).toBe('pass');
    expect(pass.passer).toBe(JACK);
    expect(pass.target).toBe(1);
    expect(pass.catcher).toBe(1);
    expect(pass.carrier).toBe(1);
    expect(pass.outcome).toBe('tackled');
    expect(pass.gained).toBe(11);
  });

  it('who tackled them: the defender’s kind (defenders are new each down)', () => {
    expect(pass.tackledBy).toBe('cover');
  });

  it('air yards from the line to the catch, then yards after the catch and after contact', () => {
    expect(pass.airYards).toBe(7);
    expect(pass.afterCatch).toBe(4);
    expect(pass.afterContact).toBe(2);
  });

  it('a catch behind the line has no air yards: downfield only', () => {
    const r = only([
      thrown,
      { events: [{ type: 'caught', id: 2, contested: false }], set: at(2, -2) },
      { events: [{ type: 'downEnded', result: 'tackled', gained: 3 }], set: deadAt(3) },
    ]);
    expect(r.airYards).toBe(0);
    expect(r.afterCatch).toBe(5);
  });

  it('an incomplete has no air yards and no target', () => {
    const r = only([
      called,
      snapped,
      thrown,
      {
        events: [
          { type: 'incomplete', at: v(0, 20) },
          { type: 'downEnded', result: 'incomplete', gained: 0 },
        ],
        set: deadAt(20, 'incomplete'),
      },
    ]);
    expect(r).toMatchObject({ kind: 'pass', outcome: 'incomplete', passer: JACK });
    expect(r.airYards).toBeNull();
    expect(r.target).toBeNull();
    expect(r.catcher).toBeNull();
  });

  it('a batted pass keeps its target', () => {
    const r = only([
      thrown,
      {
        events: [
          { type: 'batted', by: 100, at: v(2, 8), contested: true, target: 2 },
          { type: 'downEnded', result: 'batted', gained: 0 },
        ],
        set: deadAt(8, 'batted'),
      },
    ]);
    expect(r.target).toBe(1);
    expect(r.catcher).toBeNull();
    expect(r.outcome).toBe('batted');
  });
});

describe('a rush', () => {
  it('the carrier, the yards, yards after contact from the first grab', () => {
    const r = only([
      snapped,
      { events: [{ type: 'handoff', id: 3 }] },
      {
        events: [{ type: 'grabbed', id: 3, by: [100] }],
        set: (s) => (at(3, 3)(s), breakIt('mash')(s)),
      },
      { events: [{ type: 'breakResult', outcome: 'break' }], set: (s) => (s.tackle = null) },
      {
        events: [{ type: 'grabbed', id: 3, by: [100] }],
        set: (s) => (at(3, 6)(s), breakIt('juke')(s)),
      },
      { events: [{ type: 'breakResult', outcome: 'tackle' }] },
      { events: [{ type: 'downEnded', result: 'tackled', gained: 7 }], set: deadAt(7) },
    ]);
    expect(r.kind).toBe('rush');
    expect(r.carrier).toBe(2);
    expect(r.passer).toBeNull();
    expect(r.gained).toBe(7);
    expect(r.afterContact).toBe(4);
  });

  it('a carrier never grabbed has no yards after contact', () => {
    const r = only([
      { events: [{ type: 'handoff', id: 3 }] },
      { events: [{ type: 'downEnded', result: 'outOfBounds', gained: 5 }], set: at(3, 5) },
    ]);
    expect(r.afterContact).toBeNull();
    expect(r.tackleForLoss).toBe(false);
  });
});

describe('sacks and losses', () => {
  it('a sack is its own kind, and not a tackle for loss', () => {
    const r = only([
      snapped,
      {
        events: [{ type: 'sacked' }, { type: 'downEnded', result: 'sacked', gained: -2 }],
        set: deadAt(-6, 'sacked'),
      },
    ]);
    expect(r.kind).toBe('sack');
    expect(r.passer).toBe(JACK);
    expect(r.tackleForLoss).toBe(false);
  });

  it('a rush brought down behind the line is a tackle for loss, even where the line can’t go back', () => {
    const r = only([
      { events: [{ type: 'handoff', id: 3 }] },
      { events: [{ type: 'downEnded', result: 'tackled', gained: 0 }], set: deadAt(-2) },
    ]);
    expect(r.tackleForLoss).toBe(true);
  });

  it('a catch brought down behind the line is a tackle for loss', () => {
    const r = only([
      thrown,
      { events: [{ type: 'caught', id: 2, contested: false }], set: at(2, 1) },
      {
        events: [
          { type: 'eventTackled', id: 2, call: 'FROGGED!' },
          { type: 'downEnded', result: 'tackled', gained: -1 },
        ],
        set: deadAt(-1),
      },
    ]);
    expect(r.kind).toBe('pass');
    expect(r.tackleForLoss).toBe(true);
  });
});

describe('tap tests', () => {
  it('each with its test, player, grade and taps', () => {
    const r = only([
      thrown,
      { events: [{ type: 'snagStarted', receiver: 2, dots: 2 }] },
      { events: [{ type: 'snagDot', index: 0, hit: true }] },
      { events: [{ type: 'snagDot', index: 1, hit: false }] },
      {
        events: [
          { type: 'snagResult', grade: 'ok' },
          { type: 'caught', id: 2, contested: true },
        ],
        set: at(2, 6),
      },
      { events: [{ type: 'grabbed', id: 2, by: [100] }], set: breakIt('bar') },
      {
        events: [
          { type: 'breakResult', outcome: 'tackle' },
          { type: 'downEnded', result: 'tackled', gained: 6 },
        ],
        set: deadAt(6),
      },
    ]);
    expect(r.tapTests).toEqual([
      { test: 'snag', player: 1, grade: 'ok', taps: ['hit', 'miss'] },
      { test: 'bar', player: 1, grade: 'bad', taps: [] },
    ]);
  });

  it('a BAD that Second Wind turned into a drag is still the Coach’s BAD', () => {
    const r = only([
      { events: [{ type: 'handoff', id: 3 }] },
      { events: [{ type: 'grabbed', id: 3, by: [100] }], set: breakIt('bar') },
      { events: [{ type: 'secondWind' }, { type: 'breakResult', outcome: 'drag' }] },
      { events: [{ type: 'downEnded', result: 'tackled', gained: 3 }], set: deadAt(3) },
    ]);
    expect(r.tapTests).toEqual([{ test: 'bar', player: 2, grade: 'bad', taps: [] }]);
  });

  it('the tip drill’s pops are its taps', () => {
    const r = only([
      thrown,
      { events: [{ type: 'tipStarted', receiver: 2, pops: 3 }] },
      {
        events: [
          { type: 'tipPop', index: 0, result: 'clean' },
          { type: 'tipPop', index: 1, result: 'bobble' },
        ],
      },
      {
        events: [
          { type: 'tipPop', index: 2, result: 'clean' },
          { type: 'tipResult', grade: 'great' },
        ],
      },
      { events: [{ type: 'downEnded', result: 'firstDown', gained: 10 }], set: at(2, 10) },
    ]);
    expect(r.tapTests).toEqual([
      { test: 'tip', player: 1, grade: 'great', taps: ['clean', 'bobble', 'clean'] },
    ]);
  });

  it('a BREAK on two tacklers is one tackle broken', () => {
    const r = only([
      { events: [{ type: 'handoff', id: 3 }] },
      { events: [{ type: 'grabbed', id: 3, by: [100, 101] }], set: breakIt('mash') },
      {
        events: [
          { type: 'brokeTackle', id: 3, defender: 100 },
          { type: 'brokeTackle', id: 3, defender: 101 },
          { type: 'breakResult', outcome: 'break' },
        ],
      },
      { events: [{ type: 'downEnded', result: 'firstDown', gained: 10 }], set: at(3, 10) },
    ]);
    expect(r.tacklesBroken).toBe(1);
    expect(r.tapTests).toEqual([{ test: 'mash', player: 2, grade: 'great', taps: [] }]);
  });
});

describe('along the way', () => {
  it('pancakes by whom, field events, pickups and crows shooed', () => {
    const r = only([
      snapped,
      {
        events: [
          { type: 'pancake', blocker: 4, defender: 100 },
          { type: 'pancake', blocker: 4, defender: 101 },
        ],
      },
      {
        events: [{ type: 'fieldEventWentOff', event: 'frogRain', look: 'frogRain', hit: [] }],
      },
      {
        events: [{ type: 'pickupTaken', id: 2, kind: 'bolt', pickup: 7 }, { type: 'crowsShooed' }],
      },
      thrown,
      {
        events: [
          { type: 'incomplete', at: v(0, 9) },
          { type: 'downEnded', result: 'incomplete', gained: 0 },
        ],
        set: deadAt(9, 'incomplete'),
      },
    ]);
    expect(r.pancakes).toEqual([3, 3]);
    expect(r.fieldEvents).toEqual(['frogRain']);
    expect(r.pickups).toEqual(['bolt']);
    expect(r.crowsShooed).toBe(1);
  });

  it('a down over the goal line is a touchdown, from any stretch (long field test 7)', () => {
    const s = field();
    const r = only(
      [
        { events: [{ type: 'handoff', id: 3 }] },
        { events: [{ type: 'downEnded', result: 'touchdown', gained: 40 }], set: at(3, 40) },
      ],
      s,
    );
    expect(r.outcome).toBe('touchdown');
    expect(r.gained).toBe(40);
    expect(r.seriesNumber).toBe(1);
  });

  it('how far a run got is the furthest stretch, not where a loss left it (long field review)', () => {
    const s = field();
    s.series = { ...s.series, kind: 'boss', stretch: 3 };
    const { rec } = feed(s, [
      {
        events: [{ type: 'sacked' }],
        set: (n) => (n.series = { ...n.series, kind: 'gimmick', stretch: 2 }),
      },
    ]);
    expect(rec.record.reached).toEqual({ area: 0, index: 3, seriesNumber: 4 });
  });

  it('a won series is a first down, even on the Boss’s stretch (long field test 7)', () => {
    const s = field();
    s.series = { ...s.series, kind: 'boss', stretch: 3 };
    const r = only(
      [
        { events: [{ type: 'handoff', id: 3 }] },
        { events: [{ type: 'downEnded', result: 'firstDown', gained: 10 }], set: at(3, 10) },
      ],
      s,
    );
    expect(r.outcome).toBe('firstDown');
  });
});

describe('plays', () => {
  it('a play’s copy is kept once a run, however often it’s called', () => {
    const s = createRun(2);
    const id = s.playbook[0]!.id;
    const call: Frame = {
      events: [{ type: 'called', id, play: s.playbook[0]!.name, flipped: false }],
    };
    const down: Frame = { events: [{ type: 'downEnded', result: 'incomplete', gained: 0 }] };
    const { rec } = feed(s, [call, down, call, down]);
    expect(Object.keys(rec.record.plays)).toEqual([id]);
    expect(rec.record.plays[id]).toEqual(s.playbook[0]);
    expect(rec.record.downs.map((d) => d.play)).toEqual([id, id]);
  });

  it('a sketch redrawn mid-run keeps its id, and the record keeps the copy it first saw', () => {
    const s = createRun(2);
    const first = { ...s.playbook[0]!, id: 's1700000000000', name: 'Hook' };
    Object.assign(s, { playbook: [first, ...s.playbook.slice(1)] });
    const call: Frame = {
      events: [{ type: 'called', id: first.id, play: 'Hook', flipped: false }],
    };
    const redrawn: Frame = {
      events: [{ type: 'called', id: first.id, play: 'Hook 2', flipped: true }],
      set: (n) =>
        Object.assign(n, { playbook: [{ ...first, name: 'Hook 2' }, ...n.playbook.slice(1)] }),
    };
    const down: Frame = { events: [{ type: 'downEnded', result: 'incomplete', gained: 0 }] };
    const { rec } = feed(s, [call, down, redrawn, down]);
    expect(rec.record.plays[first.id]!.name).toBe('Hook');
    expect(rec.record.downs.map((d) => [d.play, d.flipped])).toEqual([
      [first.id, false],
      [first.id, true],
    ]);
  });
});

describe('players', () => {
  it('Jack has a fixed id, and the team is who started', () => {
    const { rec } = feed(field(), []);
    expect(rec.record.team[0]).toEqual({
      id: JACK,
      name: 'Jack',
      kind: 'jack',
      preferred: null,
      joinedAt: 0,
    });
    expect(rec.record.team.slice(1).map((p) => p.id)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('a recruit joins with its own id, before the series it joined for; whoever it replaced stays', () => {
    const s = field();
    const recruit = {
      id: 8,
      name: 'Boo Radish',
      kind: 'ghost' as const,
      preferred: 'catcher' as const,
      stats: { hustle: 50, hands: 70, heft: 30 },
    };
    const { rec } = feed(s, [
      {
        events: [
          { type: 'joined', id: 8, name: 'Boo Radish', slot: 0, replaced: s.roster[0]!.name },
        ],
        set: (n) => {
          n.bench.unshift(n.roster[0]!);
          n.roster[0] = recruit;
          n.series = { ...n.series, stretch: 1 };
        },
      },
    ]);
    expect(rec.record.team.map((p) => p.id)).toEqual([JACK, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(rec.record.team.at(-1)).toEqual({
      id: 8,
      name: 'Boo Radish',
      kind: 'ghost',
      preferred: 'catcher',
      joinedAt: 2,
    });
  });

  it('a catch by the recruit in slot 0 is the recruit’s, not the player it replaced', () => {
    const s = field();
    s.roster[0] = { ...s.roster[0]!, id: 8, name: 'Boo Radish' };
    const r = only(
      [
        thrown,
        { events: [{ type: 'caught', id: 2, contested: false }], set: at(2, 5) },
        { events: [{ type: 'downEnded', result: 'tackled', gained: 5 }], set: deadAt(5) },
      ],
      s,
    );
    expect(r.catcher).toBe(8);
  });
});

describe('the run', () => {
  it('a random id, the build, the link and the modes it was played in', () => {
    const s = createRun(4, undefined, 0, {
      hard: false,
      twoTapAim: false,
      snagAlways: true,
      tipAlways: true,
    });
    const { rec } = feed(s, []);
    expect(rec.record).toMatchObject({
      format: 2,
      id: 'run-1',
      build: 'abc123',
      link: 'snag=1',
      end: 'open',
      endedAt: null,
    });
    expect(rec.record.modes).toEqual({ hard: false, twoTap: false, snag: true, tip: true });
    expect(rec.record.startedAt).toBe('2026-11-03T12:00:00.000Z');
  });

  it('how far it got, and how it ended: Game Over, or won', () => {
    const over = feed(field(), [
      {
        events: [{ type: 'gameOver', seriesWon: 6, yards: 81 }],
        set: (n) => (n.series = { ...n.series, area: 1, stretch: 2 }),
      },
    ]);
    expect(over.rec.record.end).toBe('over');
    expect(over.rec.record.reached).toEqual({ area: 1, index: 2, seriesNumber: 7 });
    const won = feed(field(), [
      { events: [{ type: 'areaCleared', area: 2 }], set: (n) => (n.phase = 'won') },
    ]);
    expect(won.rec.record.end).toBe('won');
  });
});

describe('what counts', () => {
  it('every real run, whatever its link options; never practice or an event’s practice', () => {
    const real = createRun(1, undefined, 0, { snagAlways: true, tipAlways: true });
    expect(recordable(real)).toBe(true);
    expect(recordable({ ...real, practice: true })).toBe(false);
    expect(recordable({ ...real, practiceEvent: {} as RunState['practiceEvent'] })).toBe(false);
  });
});
