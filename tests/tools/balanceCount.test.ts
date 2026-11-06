import { describe, expect, it } from 'vitest';
import {
  DownWatch,
  LONG_PLAY,
  BoltWatch,
  PickWatch,
  GrowthWatch,
  botPick,
  byStretch,
  isLong,
  noteBefore,
  seriesSpread,
  stops,
} from '../../tools/balanceCount';
import { PLAYS } from '../../src/arcade/content/plays';
import { rngFor } from '../../src/arcade/sim/random';
import type { ArcadeEvent, OfferCard, RunState } from '../../src/arcade/sim/types';
import { v } from '../../src/arcade/sim/vec';
import { carry, playState, stand } from '../arcade/helpers';

/**
 * The balance tool's counts for long plays (docs/DIFFICULTY.md, "The long
 * field", t1): fed made-up steps, the states before and after and their events.
 */

/** A down in play from `los` in `area`'s `stretch`, one of yours (id 2) carrying at `at`. */
function down(
  { area = 0, stretch = 0, los = 0 } = {},
  at = v(0, los + 2),
  defenders: Parameters<typeof playState>[1] = [],
): RunState {
  const s = carry(playState([{ pos: at, job: stand(at) }], defenders), 2);
  s.series = { ...s.series, area, stretch, los };
  return s;
}

/** Feed one step: the same state before and after, these events. */
const feed = (w: DownWatch, s: RunState, events: ArcadeEvent[]): void =>
  w.step(noteBefore(s), s, events);

describe('balance counts for the long field', () => {
  it('1: a down gaining 20 or more is a long play, with how it ended, run or pass, and its area', () => {
    const w = new DownWatch();
    const s = down({ area: 1, stretch: 1, los: 12 }, v(0, 14), [{ kind: 'safety', pos: v(0, 40) }]);
    feed(w, s, [{ type: 'handoff', id: 2 }]);
    feed(w, s, [
      { type: 'tackled', id: 2, by: 100 },
      { type: 'downEnded', result: 'firstDown', gained: 24 },
    ]);
    // A 19-yard pass: not long.
    feed(w, s, [{ type: 'thrown', target: v(0, 30), landsAt: 1 }]);
    feed(w, s, [{ type: 'downEnded', result: 'firstDown', gained: LONG_PLAY - 1 }]);

    expect(w.downs).toEqual([
      expect.objectContaining({
        kind: 'rush',
        area: 1,
        result: 'firstDown',
        gained: 24,
        stoppedBy: 'safety',
      }),
      expect.objectContaining({ kind: 'pass', gained: 19, stoppedBy: null }),
    ]);
    expect(w.downs.map(isLong)).toEqual([true, false]);
  });

  it('2: each tackle counts for its tackler’s kind, on all downs and on long plays', () => {
    const w = new DownWatch();
    const s = down({}, v(0, 2), [
      { kind: 'zone', pos: v(0, 30) },
      { kind: 'bat', pos: v(3, 30) },
    ]);
    feed(w, s, [
      { type: 'tackled', id: 2, by: 100 },
      { type: 'downEnded', result: 'firstDown', gained: 25 },
    ]);
    feed(w, s, [
      { type: 'tackled', id: 2, by: 101 },
      { type: 'downEnded', result: 'tackled', gained: 3 },
    ]);
    feed(w, s, [{ type: 'sacked' }, { type: 'downEnded', result: 'sacked', gained: -2 }]);
    feed(w, s, [
      { type: 'outOfBounds', id: 2 },
      { type: 'downEnded', result: 'outOfBounds', gained: 4 },
    ]);
    feed(w, s, [
      { type: 'eventTackled', id: 2, call: 'FROGGED!' },
      { type: 'downEnded', result: 'tackled', gained: 1 },
    ]);

    expect(stops(w.downs)).toEqual(
      new Map([
        ['zone', 1],
        ['bat', 1],
        ['sack', 1],
        ['outOfBounds', 1],
        ['event', 1],
      ]),
    );
    expect(stops(w.downs.filter(isLong))).toEqual(new Map([['zone', 1]]));
  });

  it('3: a touchdown counts for the stretch of its line of scrimmage', () => {
    const w = new DownWatch();
    feed(w, down({ stretch: 1, los: 14 }), [
      { type: 'downEnded', result: 'touchdown', gained: 26 },
    ]);
    feed(w, down({ stretch: 3, los: 33 }), [{ type: 'downEnded', result: 'touchdown', gained: 7 }]);
    feed(w, down({ stretch: 1, los: 11 }), [{ type: 'downEnded', result: 'tackled', gained: 3 }]);
    feed(w, down({ stretch: 1, los: 18 }), [
      { type: 'downEnded', result: 'touchdown', gained: 22 },
    ]);
    expect(byStretch(w.downs.filter((d) => d.result === 'touchdown'))).toEqual(
      new Map([
        [1, 2],
        [3, 1],
      ]),
    );
  });

  it('4: the yards a carrier runs after the last defender in front of them is passed', () => {
    const w = new DownWatch();
    // At 18, an Owl still ahead at 22: not clear yet.
    const s = down({}, v(0, 18), [
      { kind: 'safety', pos: v(0, 22) },
      { kind: 'cover', pos: v(2, 10) },
    ]);
    feed(w, s, []);
    // Past it at 25: clear from there.
    s.field.players.find((p) => p.id === 2)!.pos = v(0, 25);
    feed(w, s, []);
    // Still clear later: it counts from where they first got clear.
    s.field.players.find((p) => p.id === 2)!.pos = v(0, 31);
    feed(w, s, []);
    feed(w, s, [{ type: 'downEnded', result: 'touchdown', gained: 40 }]);
    // Never clear: null.
    const t = down({}, v(0, 5), [{ kind: 'safety', pos: v(0, 20) }]);
    feed(w, t, [{ type: 'downEnded', result: 'tackled', gained: 6 }]);

    expect(w.downs.map((d) => d.pastLast)).toEqual([15, null]);
  });

  it('4b: a carrier still on the field after the down has ended doesn’t count toward the next down', () => {
    const w = new DownWatch();
    // A touchdown: the scorer stays in the end zone, nobody ahead, while the result shows.
    const scored = down({}, v(0, 40), [{ kind: 'safety', pos: v(0, 30) }]);
    scored.phase = 'play';
    feed(w, scored, [{ type: 'downEnded', result: 'touchdown', gained: 40 }]);
    scored.phase = 'downOver';
    feed(w, scored, []);
    // The next down never gets clear.
    const next = down({}, v(0, 3), [{ kind: 'safety', pos: v(0, 14) }]);
    next.phase = 'play';
    feed(w, next, [{ type: 'downEnded', result: 'tackled', gained: 5 }]);
    // Clear on the goal line as it scored: 0 yards after; the next, never clear.
    expect(w.downs.map((d) => d.pastLast)).toEqual([0, null]);
  });

  it('5: series won spread: the worst tenth, the median, the top tenth and the best', () => {
    const perRun = [7, 2, 9, 4, 12, 5, 6, 3, 8, 10];
    expect(seriesSpread(perRun)).toEqual({ p10: 3, median: 7, p90: 12, best: 12 });
    expect(seriesSpread([])).toEqual({ p10: 0, median: 0, p90: 0, best: 0 });
  });

  it('6: the draft picks a run has taken when it first snaps the ball in each area, among runs that reach it (n1)', () => {
    const w = new PickWatch();
    const inArea = (area: number) => noteBefore(down({ area }));
    const card: OfferCard = { kind: 'perk', perk: { rarity: 'common', kind: 'extraSweep' } };
    // A run that reaches area 3.
    w.step(inArea(0), [{ type: 'snapped' }]);
    w.step(inArea(0), [{ type: 'picked', card }]);
    // The draft after a touchdown is in front of the next area's first series; a new player is one pick, though it brings a `joined` too.
    w.step(inArea(1), [
      { type: 'picked', card },
      { type: 'joined', id: 9, name: 'Example', slot: 2, replaced: null },
    ]);
    w.step(inArea(1), [{ type: 'snapped' }]);
    // Only the area's first snap counts.
    w.step(inArea(1), [{ type: 'picked', card }]);
    w.step(inArea(1), [{ type: 'snapped' }]);
    // Winning a series isn't a pick.
    w.step(inArea(1), [{ type: 'seriesWon', stretch: 0 }]);
    w.step(inArea(2), [{ type: 'snapped' }]);
    w.endRun();
    // A run that never leaves area 1.
    w.step(inArea(0), [{ type: 'snapped' }]);
    w.step(inArea(0), [{ type: 'picked', card }]);
    w.endRun();

    expect([...w.onEntering.entries()]).toEqual([
      [0, [0, 0]],
      [1, [2]],
      [2, [3]],
    ]);
  });

  it('7: bolts taken by each side, yours and the defense’s (the mischief bolt, b4)', () => {
    const w = new BoltWatch();
    w.step([{ type: 'pickupTaken', id: 2, side: 'team', kind: 'bolt', pickup: 7 }]);
    w.step([
      { type: 'pickupTaken', id: 100, side: 'defense', kind: 'bolt', pickup: 17 },
      // A slick isn't a bolt.
      { type: 'pickupTaken', id: 3, side: 'team', kind: 'slick', pickup: 8 },
    ]);
    w.step([{ type: 'pickupTaken', id: 101, side: 'defense', kind: 'bolt', pickup: 27 }]);
    expect(w.bySide).toEqual({ team: 1, defense: 2 });
  });

  it('8: stepping in place, the counts read what was noted before the step, not the run as it is after', () => {
    // A Safety tackles on the last stretch's line; by the end of the step the
    // tackler has left the field, the clock has run on and the series has moved.
    const s = down({ area: 1, stretch: 3, los: 33 }, v(0, 40), [{ kind: 'safety', pos: v(0, 41) }]);
    s.snappedAt = 2;
    s.time = 5;
    const before = noteBefore(s);
    s.field = { ...s.field, defenders: [] };
    s.series = { ...s.series, area: 2, stretch: 0, los: 0 };
    s.time = 6;
    const carrier = s.field.players.find((p) => p.id === 2);
    if (carrier) carrier.pos = v(0, 99);

    const w = new DownWatch();
    w.step(before, s, [
      { type: 'tackled', id: 2, by: 100 },
      { type: 'downEnded', result: 'tackled', gained: 7 },
    ]);
    expect(w.downs).toEqual([
      expect.objectContaining({ area: 1, stretch: 3, gained: 7, stoppedBy: 'safety' }),
    ]);
    expect(before).toEqual({
      series: { area: 1, stretch: 3, los: 33 },
      time: 5,
      snappedAt: 2,
      tackleKind: null,
      defenders: [{ id: 100, kind: 'safety' }],
      players: [
        { id: 1, y: -4 },
        { id: 2, y: 40 },
      ],
    });
  });
});

describe('growth from play (docs/REWARDS.md, b2)', () => {
  it('for each area a run played in: the most one player grew there, and the team’s total', () => {
    const w = new GrowthWatch();
    const inArea = (area: number) => noteBefore(down({ area }));
    w.step(inArea(0), [
      { type: 'grew', id: 5, stat: 'hands', by: 15 },
      { type: 'grew', id: 5, stat: 'hustle', by: 6 },
      { type: 'grew', id: 1, stat: 'heft', by: 8 },
    ]);
    w.step(inArea(0), [{ type: 'grew', id: 1, stat: 'heft', by: 3 }]);
    w.step(inArea(1), [{ type: 'grew', id: 2, stat: 'hustle', by: 10 }]);
    w.endRun();
    w.step(inArea(0), [{ type: 'grew', id: 3, stat: 'hands', by: 15 }]);
    w.endRun();
    expect(w.byArea.get(0)).toEqual([
      { busiest: 21, team: 32, busiestHands: 15 },
      { busiest: 15, team: 15, busiestHands: 15 },
    ]);
    expect(w.byArea.get(1)).toEqual([{ busiest: 10, team: 10, busiestHands: 0 }]);
  });
});

describe('the bot at TRICK OR TREAT! (docs/REWARDS.md, b2)', () => {
  const play: OfferCard = { kind: 'play', play: PLAYS[0]! };
  const perk: OfferCard = { kind: 'perk', perk: { rarity: 'common', kind: 'magnet' } };
  const player = (id: number): OfferCard => ({
    kind: 'player',
    player: {
      id,
      name: `P${id}`,
      kind: 'ghost',
      preferred: 'catcher',
      stats: { hustle: 60, hands: 90, heft: 50 },
    },
  });
  const rng = rngFor(1, 'test');

  it('takes a new player if one is offered, then a play, then a perk, and never skips', () => {
    expect(botPick([perk, play, player(8)], rng)).toBe(2);
    expect(botPick([perk, play], rng)).toBe(1);
    expect(botPick([perk], rng)).toBe(0);
  });

  it('picks among the players at random when there are two', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 40; i++) seen.add(botPick([play, player(8), player(9)], rng));
    expect([...seen].sort()).toEqual([1, 2]);
  });
});
