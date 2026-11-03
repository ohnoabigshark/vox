import { describe, expect, it } from 'vitest';
import { StatsKeeper } from '../../../src/arcade/record/keeper';
import { runStats } from '../../../src/arcade/record/stats';
import { statsStore } from '../../../src/arcade/record/store';
import { createRun, dispatch } from '../../../src/arcade/sim/run';
import { rngFor } from '../../../src/arcade/sim/random';
import { step } from '../../../src/arcade/sim/step';
import type { Action, ArcadeEvent, RunState, StepInput } from '../../../src/arcade/sim/types';

/**
 * Whole runs through the real sim, recorded as the game records them: a
 * bot taps at random, and the record must agree with the game's own count.
 */

function memoryStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

/** Play one run to its end with a bot that taps at random; every step and action goes to `keeper`. */
function playOut(seed: number, keeper: StatsKeeper, hard: boolean) {
  let s = createRun(seed, undefined, 0, { hard, twoTapAim: seed % 2 === 0 });
  keeper.start(s);
  const rng = rngFor(seed, 'bot');
  const events: ArcadeEvent[] = [];
  const feed = (next: { state: RunState; events: ArcadeEvent[] }) => {
    keeper.step(s, next.state, next.events);
    events.push(...next.events);
    s = next.state;
  };
  const act = (a: Action) => feed(dispatch(s, a));
  for (let i = 0; i < 200_000 && s.phase !== 'over' && s.phase !== 'won'; i++) {
    if (s.phase === 'setup') {
      act({ type: 'call', hand: Math.floor(rng.next() * 3) });
      act({ type: 'hike' });
      continue;
    }
    if (s.phase === 'draft') {
      act(rng.next() < 0.8 ? { type: 'pick', offer: 0 } : { type: 'skipDraft' });
      continue;
    }
    // Throws come about a second into a play; Break it! and the catch tests get quicker taps.
    const tap = rng.next() < (s.phase === 'play' ? 0.015 : 0.1);
    const input: StepInput =
      s.phase === 'play'
        ? { throw: tap, shoo: tap }
        : s.phase === 'breakit'
          ? tap
            ? { breakTap: true, juke: rng.next() < 0.5 ? -1 : 1 }
            : {}
          : s.phase === 'snag'
            ? tap
              ? { snag: Math.floor(rng.next() * 5) }
              : {}
            : s.phase === 'tip'
              ? { tip: tap }
              : {};
    feed(step(s, input));
  }
  return { state: s, events };
}

describe('whole runs, recorded', () => {
  for (const [seed, hard] of Array.from({ length: 10 }, (_, i) => [i + 1, i % 3 !== 2] as const)) {
    it(`seed ${seed}${hard ? ', hard' : ''}: the record agrees with the game`, async () => {
      const store = statsStore(memoryStorage(), () => Date.UTC(2026, 10, 3));
      const notices: string[] = [];
      const keeper = new StatsKeeper({
        store,
        build: 'b',
        link: '',
        newId: () => `run-${seed}`,
        now: () => Date.UTC(2026, 10, 3),
        notice: (t) => notices.push(t),
      });
      const { state, events } = playOut(seed, keeper, hard);
      await new Promise((r) => setTimeout(r, 0));
      expect(notices).toEqual([]);
      expect(['over', 'won']).toContain(state.phase);

      const { saved } = await store.load();
      expect(saved.runs).toHaveLength(1);
      const record = saved.runs[0]!.record!;
      const stats = runStats(record);
      const ended = events.filter((e) => e.type === 'downEnded');
      expect(record.end).toBe(state.phase);
      expect(record.downs).toHaveLength(ended.length);
      expect(stats.yards).toBe(state.yards);
      expect(stats.firstDowns + stats.touchdowns).toBe(state.seriesWon);
      expect(stats.touchdowns).toBe(events.filter((e) => e.type === 'areaCleared').length);
      expect(stats.against.sacks).toBe(events.filter((e) => e.type === 'sacked').length);
      expect(stats.contact.tacklesBroken).toBe(
        events.filter((e) => e.type === 'breakResult' && e.outcome === 'break').length,
      );
      expect(stats.passing.completions).toBe(events.filter((e) => e.type === 'caught').length);
      expect(record.reached).toMatchObject({ area: state.series.area, index: state.series.index });
      // Every player in a result is on the team the record kept.
      const team = new Set(record.team.map((p) => p.id));
      for (const d of record.downs) {
        for (const id of [d.passer, d.target, d.catcher, d.carrier, ...d.pancakes]) {
          if (id !== null) expect(team.has(id)).toBe(true);
        }
      }
      expect(saved.allTime[hard ? 'hard' : 'normal'].runs).toBe(1);
    });
  }
});
