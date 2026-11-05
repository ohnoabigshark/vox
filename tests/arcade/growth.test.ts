import { describe, expect, it } from 'vitest';
import { arcadeTuning } from '../../src/arcade/content/tuning';
import { physicsOf } from '../../src/arcade/sim/bodies';
import { applyGains, gainsOf, newTally, noteGrowth } from '../../src/arcade/sim/growth';
import { createRun, setUpDown } from '../../src/arcade/sim/run';
import { canThrow, step } from '../../src/arcade/sim/step';
import type { ArcadeEvent, DownTally, RunState, StepInput } from '../../src/arcade/sim/types';
import { v } from '../../src/arcade/sim/vec';
import { betweenDowns, ofType, playState, run, stand, throwAt } from './helpers';

/**
 * Growth from play (docs/REWARDS.md, map items g2, z1–z3, t1): each stat
 * grows from what a player does with it, by slot, never past the ceiling.
 */

const g = arcadeTuning.growth;

/** A tally with only these things done. */
const tally = (done: Partial<DownTally>): DownTally => ({ ...newTally(), ...done });

/** A down that gained `gained` yards from the line at 0. */
const down = (gained: number) => ({ gained, los: gained });

describe('what grows which stat (t1)', () => {
  it('1. a catch grows the catcher’s Hands by the catch size, and nobody else’s', () => {
    expect(gainsOf(tally({ catch: { slot: 4, at: 6 } }), down(6))).toEqual([
      { slot: 4, stat: 'hands', by: g.catch },
    ]);
  });

  it('2. a GREAT on SNAG IT! or the tip drill adds the bigger bump', () => {
    expect(gainsOf(tally({ catch: { slot: 4, at: 6 }, catchGreats: [4] }), down(6))).toEqual([
      { slot: 4, stat: 'hands', by: g.catch + g.catchGreat },
    ]);
  });

  it('2b. an OK or BAD on a catch test adds only the catch’s (noted from the events)', () => {
    for (const grade of ['ok', 'bad'] as const) {
      const s = playState([{ pos: v(0, 6) }]);
      noteGrowth(s, [
        { type: 'snagStarted', receiver: 2, dots: 3 },
        { type: 'snagResult', grade },
      ]);
      expect(s.tally.catchGreats).toEqual([]);
    }
    const s = playState([{ pos: v(0, 6) }]);
    noteGrowth(s, [
      { type: 'tipStarted', receiver: 2, pops: 3 },
      { type: 'tipResult', grade: 'great' },
    ]);
    expect(s.tally.catchGreats).toEqual([0]);
  });

  it('3. yards after a catch grow the catcher’s Hustle by the whole yard', () => {
    expect(gainsOf(tally({ catch: { slot: 4, at: 6 } }), down(13.6))).toEqual([
      { slot: 4, stat: 'hustle', by: 7 * g.yacPerYard },
      { slot: 4, stat: 'hands', by: g.catch },
    ]);
  });

  it('4. a rush of 10 yards or more grows the carrier’s Hustle; a 9-yard rush doesn’t', () => {
    expect(gainsOf(tally({ rusher: 2 }), down(9.9))).toEqual([]);
    expect(gainsOf(tally({ rusher: 2 }), down(10))).toEqual([
      { slot: 2, stat: 'hustle', by: g.rush },
    ]);
    expect(gainsOf(tally({ rusher: 2 }), down(14.5))).toEqual([
      { slot: 2, stat: 'hustle', by: g.rush + 4 * g.rushPerYard },
    ]);
  });

  it('5. a GREAT on Break it! grows the carrier’s Hustle, once for each', () => {
    expect(gainsOf(tally({ rusher: 2, breakGreats: [2, 2] }), down(3))).toEqual([
      { slot: 2, stat: 'hustle', by: 2 * g.breakGreat },
    ]);
  });

  it('6. a pancake grows the blocker’s Heft; a block held grows it only on a down that gains', () => {
    expect(gainsOf(tally({ pancakes: [0], held: [0, 1] }), down(4))).toEqual([
      { slot: 0, stat: 'heft', by: g.pancake + g.blockHeld },
      { slot: 1, stat: 'heft', by: g.blockHeld },
    ]);
    expect(gainsOf(tally({ pancakes: [0], held: [0, 1] }), down(-6))).toEqual([
      { slot: 0, stat: 'heft', by: g.pancake },
    ]);
    expect(gainsOf(tally({ held: [0, 1] }), down(0))).toEqual([]);
  });
});

describe('putting gains on the roster', () => {
  it('7. no stat grows past the ceiling, and one already past it doesn’t grow', () => {
    const s = createRun(1);
    s.roster[0] = { ...s.roster[0]!, stats: { hustle: 145, hands: 160, heft: 50 } };
    const events: ArcadeEvent[] = [];
    applyGains(
      s,
      [
        { slot: 0, stat: 'hustle', by: 10 },
        { slot: 0, stat: 'hands', by: 15 },
      ],
      events,
    );
    expect(s.roster[0]!.stats).toEqual({ hustle: g.ceiling, hands: 160, heft: 50 });
    expect(events).toEqual([{ type: 'grew', id: s.roster[0]!.id, stat: 'hustle', by: 5 }]);
  });

  it('8. Jack never grows, and a benched player keeps what it gained', () => {
    const s = playState([{ pos: v(0, 6) }]);
    noteGrowth(s, [{ type: 'caught', id: 1, contested: false }]);
    expect(s.tally.catch).toBeNull();

    const events: ArcadeEvent[] = [];
    applyGains(s, [{ slot: 0, stat: 'heft', by: 8 }], events);
    const grown = s.roster[0]!;
    s.bench.unshift(grown);
    s.roster[0] = s.roster[1]!;
    expect(s.bench[0]!.stats.heft).toBe(58);
  });

  it('8b. the gains since the last TRICK OR TREAT! are kept by player id', () => {
    const s = createRun(1);
    applyGains(s, [{ slot: 3, stat: 'hands', by: 15 }], []);
    applyGains(
      s,
      [
        { slot: 3, stat: 'hands', by: 15 },
        { slot: 3, stat: 'hustle', by: 4 },
      ],
      [],
    );
    expect(s.gains).toEqual({ [s.roster[3]!.id]: { hustle: 4, hands: 30, heft: 0 } });
  });

  it('9. a gain shows in the next down’s play', () => {
    const s = createRun(1);
    applyGains(s, [{ slot: 0, stat: 'heft', by: 20 }], []);
    setUpDown(s, []);
    const blocker = s.field.players.find((p) => p.slot === 0)!;
    expect(blocker.stats.heft).toBe(70);
    expect(blocker.mass).toBe(physicsOf(blocker.stats).mass);
  });

  it('10. practice never grows anyone', () => {
    const s = { ...playState([{ pos: v(0, 6) }]), practice: true };
    const before = structuredClone(s.roster);
    noteGrowth(s, [
      { type: 'caught', id: 2, contested: false },
      { type: 'downEnded', result: 'tackled', gained: 6 },
    ]);
    expect(s.roster).toEqual(before);
  });
});

describe('growth in play', () => {
  it('12. a real catch grows the catcher’s Hands when the down ends, with a grew event', () => {
    const catcher = v(0, 8);
    const s0 = playState([{ pos: catcher, job: stand(catcher) }]);
    const before = s0.roster[0]!.stats;
    const r = run(s0, 12, throwAt(s0, catcher));
    expect(ofType(r.events, 'caught')).toHaveLength(1);
    expect(ofType(r.events, 'downEnded')).toHaveLength(1);
    const after = r.state.roster[0]!.stats;
    expect(after.hands).toBe(before.hands + g.catch);
    expect(after.hustle).toBeGreaterThan(before.hustle);
    expect(after.heft).toBe(before.heft);
    expect(ofType(r.events, 'grew')).toContainEqual({
      type: 'grew',
      id: r.state.roster[0]!.id,
      stat: 'hands',
      by: g.catch,
    });
    // Nobody else grew.
    expect(r.state.roster.slice(1)).toEqual(s0.roster.slice(1));
  });

  it('6b. a real pancake on a down that loses grows Heft by the pancake only', () => {
    const s0 = playState(
      [{ role: 'blocker', pos: v(0, -2), stats: { heft: 150 }, job: { kind: 'block' } }],
      [{ kind: 'rusher', pos: v(0, 1), stats: { heft: 20 } }],
    );
    const r = run(s0, 20);
    expect(ofType(r.events, 'pancake').length).toBeGreaterThan(0);
    const ended = ofType(r.events, 'downEnded')[0];
    expect(ended?.gained).toBeLessThan(0);
    // The roster player behind the body: a starter's 50, whatever the test body weighs.
    const pancakes = ofType(r.events, 'pancake').length;
    expect(r.state.roster[0]!.stats.heft).toBe(s0.roster[0]!.stats.heft + pancakes * g.pancake);
    // It held its block too, which counts only on a down that gains.
    expect(r.state.tally.held).toEqual([0]);
  });

  /** Taps for whatever is up, as stepInPlace's test plays a run. */
  const input = (s: RunState): StepInput => {
    if (s.phase === 'play') return canThrow(s) && s.step % 50 === 0 ? { throw: true } : {};
    if (s.phase === 'breakit') return s.step % 7 === 0 ? { breakTap: true } : {};
    if (s.phase === 'snag') return s.step % 20 === 0 ? { snag: 0 } : {};
    if (s.phase === 'tip') return s.step % 20 === 0 ? { tip: true } : {};
    return {};
  };
  const play = (seed: number, n: number) => {
    let s = createRun(seed);
    const grew: ArcadeEvent[] = [];
    for (let i = 0; i < n && s.phase !== 'over' && s.phase !== 'won'; i++) {
      const next = betweenDowns(s, i);
      if (next) {
        s = next;
        continue;
      }
      const r = step(s, input(s));
      grew.push(...ofType(r.events, 'grew'));
      s = r.state;
    }
    return { s, grew };
  };

  it('11. the same seed and the same taps give the same growth', () => {
    const a = play(4, 6000);
    const b = play(4, 6000);
    expect(a.grew.length).toBeGreaterThan(0);
    expect(b.grew).toEqual(a.grew);
    expect(b.s.roster).toEqual(a.s.roster);
  });
});
