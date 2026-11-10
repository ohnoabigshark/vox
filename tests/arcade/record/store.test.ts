import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from '../../../src/arcade/record/achievements';
import { addRun, emptyAllTime, summaryOf } from '../../../src/arcade/record/allTime';
import { catchBy } from './fixtures';
import {
  KEPT_RUNS,
  statsStore,
  type Saved,
  type StatsStore,
} from '../../../src/arcade/record/store';
import {
  JACK,
  RECORD_FORMAT,
  type PlayResult,
  type RunRecord,
} from '../../../src/arcade/record/types';

/**
 * docs/STATS.md, keeping it (k1–k4) and the store's scenarios (f2): a fake
 * storage that can refuse to be read, refuse a write, or hold what the
 * store can't read.
 */

type Fake = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> & {
  data: Map<string, string>;
  /** What fails: reading anything, writing (a full store), or removing. */
  fail: { read: boolean; write: boolean; remove: boolean };
};

const fakeStorage = (): Fake => {
  const data = new Map<string, string>();
  const fail = { read: false, write: false, remove: false };
  return {
    data,
    fail,
    getItem: (k) => {
      if (fail.read) throw new Error('SecurityError');
      return data.get(k) ?? null;
    },
    setItem: (k, v) => {
      if (fail.write) throw new Error('QuotaExceededError');
      data.set(k, v);
    },
    removeItem: (k) => {
      if (fail.remove) throw new Error('SecurityError');
      data.delete(k);
    },
  };
};

const NOW = Date.UTC(2026, 10, 3, 12, 30);

/** What a store loads, which these tests expect it can: no problem reaching or reading it. */
async function loaded(store: StatsStore): Promise<{ saved: Saved; problem: string | null }> {
  const { saved, problem } = await store.load();
  if (!saved) throw new Error(`nothing kept: ${problem}`);
  return { saved, problem };
}
const clock = () => NOW;

const down: PlayResult = {
  seriesNumber: 1,
  down: 1,
  toGo: 10,
  los: 0,
  play: 'dive',
  flipped: false,
  kind: 'rush',
  outcome: 'tackled',
  gained: 4,
  passer: null,
  target: null,
  catcher: null,
  carrier: 1,
  tackledBy: null,
  airYards: null,
  afterCatch: null,
  afterContact: null,
  tackleForLoss: false,
  tacklesBroken: 0,
  drags: 0,
  pancakes: [],
  fieldEvents: [],
  pickups: [],
  crowsShooed: 0,
  tapTests: [],
};

const run = (id: string, more: Partial<RunRecord> = {}): RunRecord => ({
  format: 1,
  id,
  build: 'b',
  link: '',
  modes: { hard: true, twoTap: true, snag: false, tip: false },
  startedAt: '2026-11-03T12:00:00.000Z',
  endedAt: null,
  end: 'over',
  reached: { area: 0, index: 1, seriesNumber: 2 },
  team: [{ id: JACK, name: 'Jack', kind: 'jack', preferred: null, joinedAt: 0 }],
  plays: {},
  downs: [down],
  ...more,
});

describe('the stats store', () => {
  it('nothing kept yet: no runs, empty all-time stats, no problem', async () => {
    expect(await statsStore(fakeStorage(), clock).load()).toEqual({
      saved: {
        runs: [],
        allTime: { hard: emptyAllTime(), normal: emptyAllTime() },
        achievements: {},
        checked: ACHIEVEMENTS.map((a) => a.id),
      },
      problem: null,
    });
  });

  it('a closed run is kept, newest first, with when it ended; all time adds it', async () => {
    const storage = fakeStorage();
    const store = statsStore(storage, clock);
    await store.close(run('a'));
    const saved = await store.close(run('b'));
    const ended = '2026-11-03T12:30:00.000Z';
    expect(saved.runs.map((r) => r.summary.id)).toEqual(['b', 'a']);
    expect(saved.runs[0]!.record).toEqual({ ...run('b'), endedAt: ended });
    expect(saved.allTime.hard.runs).toBe(2);
    expect((await statsStore(storage, clock).load()).saved).toEqual(saved);
  });

  it('hard mode and normal are kept apart', async () => {
    const store = statsStore(fakeStorage(), clock);
    await store.close(run('a'));
    const saved = await store.close(
      run('b', { modes: { hard: false, twoTap: false, snag: false, tip: false } }),
    );
    expect(saved.allTime.hard.runs).toBe(1);
    expect(saved.allTime.normal.runs).toBe(1);
  });

  it('a run saved as it goes, never closed, is closed on the next start: unfinished, and counted', async () => {
    const storage = fakeStorage();
    await statsStore(storage, clock).saveOpen(run('a', { end: 'open' }));
    const { saved, problem } = await loaded(statsStore(storage, clock));
    expect(problem).toBeNull();
    expect(saved.runs.map((r) => [r.summary.id, r.summary.end, r.summary.endedAt])).toEqual([
      ['a', 'unfinished', '2026-11-03T12:30:00.000Z'],
    ]);
    expect(saved.allTime.hard.runs).toBe(1);
    // …once: the next start finds nothing open.
    expect((await loaded(statsStore(storage, clock))).saved.runs).toHaveLength(1);
  });

  it('an unfinished run ended when it was last saved, not when the game opened again', async () => {
    const storage = fakeStorage();
    await statsStore(storage, () => Date.UTC(2026, 10, 3, 12, 5)).saveOpen(
      run('a', { end: 'open' }),
    );
    const { saved } = await loaded(statsStore(storage, clock));
    expect(saved.runs[0]!.summary.endedAt).toBe('2026-11-03T12:05:00.000Z');
  });

  it('a run is counted once, even if its saved progress couldn’t be cleared', async () => {
    const storage = fakeStorage();
    const store = statsStore(storage, clock);
    await store.saveOpen(run('a', { end: 'open' }));
    storage.fail.remove = true;
    await store.close(run('a'));
    storage.fail.remove = false;
    const { saved, problem } = await loaded(statsStore(storage, clock));
    expect(problem).toBeNull();
    expect(saved.runs.map((r) => r.summary.id)).toEqual(['a']);
    expect(saved.allTime.hard.runs).toBe(1);
    expect(storage.data.has('getJackBack.stats.open')).toBe(false);
  });

  it('a run saved again replaces what was saved of it, and closing it clears it', async () => {
    const storage = fakeStorage();
    const store = statsStore(storage, clock);
    await store.saveOpen(run('a', { end: 'open', downs: [] }));
    await store.saveOpen(run('a', { end: 'open' }));
    await store.close(run('a'));
    const { saved } = await loaded(statsStore(storage, clock));
    expect(saved.runs).toHaveLength(1);
    expect(saved.allTime.hard.totals.downs).toBe(1);
  });

  it(`past ${KEPT_RUNS} runs, the oldest keep only their summary`, async () => {
    const store = statsStore(fakeStorage(), clock);
    let saved = await store.close(run('r0'));
    for (let i = 1; i <= KEPT_RUNS; i++) saved = await store.close(run(`r${i}`));
    expect(saved.runs).toHaveLength(KEPT_RUNS + 1);
    expect(saved.runs.slice(0, KEPT_RUNS).every((r) => r.record !== null)).toBe(true);
    const oldest = saved.runs.at(-1)!;
    expect(oldest.record).toBeNull();
    expect(oldest.summary).toEqual(
      summaryOf({ ...run('r0'), endedAt: '2026-11-03T12:30:00.000Z' }),
    );
  });

  it('a closed run’s achievements are kept with it', async () => {
    const store = statsStore(fakeStorage(), clock);
    const saved = await store.close(run('a', { downs: [catchBy(1, 25, 22)] }));
    expect(saved.achievements.airMail).toEqual({
      run: 'a',
      at: '2026-11-03T12:30:00.000Z',
      hard: true,
    });
  });

  it("a format-1 save is brought up to today's format, its runs checked for achievements (h3)", async () => {
    const storage = fakeStorage();
    const ended = {
      ...run('a', { downs: [catchBy(1, 25, 22)] }),
      endedAt: '2026-11-03T12:00:00.000Z',
    };
    const allTime = { hard: addRun(emptyAllTime(), ended), normal: emptyAllTime() };
    storage.data.set(
      'getJackBack.stats',
      JSON.stringify({ format: 1, runs: [{ summary: summaryOf(ended), record: ended }], allTime }),
    );
    const { saved, problem } = await loaded(statsStore(storage, clock));
    expect(problem).toBeNull();
    expect(saved.runs[0]!.record).toEqual(ended);
    expect(saved.achievements.airMail).toEqual({
      run: 'a',
      at: '2026-11-03T12:00:00.000Z',
      hard: true,
    });
    expect(saved.checked).toEqual(ACHIEVEMENTS.map((a) => a.id));
    // What it found is written, so it isn't looked for again.
    const written = JSON.parse(storage.data.get('getJackBack.stats')!);
    expect(written.format).toBe(RECORD_FORMAT);
    expect(written.achievements.airMail.run).toBe('a');
  });

  it('a format-2 save is brought up to format 3: the oil slicks it kept are gravestones (next-job map g3)', async () => {
    const storage = fakeStorage();
    // Saved before the rename: 'slick' was a pickup kind then.
    const old = { ...down, pickups: ['slick', 'bolt'] } as unknown as PlayResult;
    const ended = { ...run('a', { downs: [old] }), endedAt: '2026-11-03T12:00:00.000Z' };
    const allTime = { hard: addRun(emptyAllTime(), ended), normal: emptyAllTime() };
    storage.data.set(
      'getJackBack.stats',
      JSON.stringify({
        format: 2,
        runs: [
          { summary: summaryOf(ended), record: ended },
          { summary: summaryOf(ended), record: null },
        ],
        allTime,
        achievements: {},
        checked: ACHIEVEMENTS.map((a) => a.id),
      }),
    );
    storage.data.set(
      'getJackBack.stats.open',
      JSON.stringify({ format: 2, record: run('b', { downs: [old] }), savedAt: NOW }),
    );
    const { saved, problem } = await loaded(statsStore(storage, clock));
    expect(problem).toBeNull();
    expect(saved.runs.map((r) => r.record?.downs[0]?.pickups ?? null)).toEqual([
      // The open run, closed as unfinished on this start, comes first.
      ['gravestone', 'bolt'],
      ['gravestone', 'bolt'],
      null,
    ]);
  });
});

describe('when it can’t keep them, it says so', () => {
  it('what a new build finds in the saved runs, not written (a full store): the stats still load, and the notice says so', async () => {
    const storage = fakeStorage();
    const ended = {
      ...run('a', { downs: [catchBy(1, 25, 22)] }),
      endedAt: '2026-11-03T12:00:00.000Z',
    };
    const allTime = { hard: addRun(emptyAllTime(), ended), normal: emptyAllTime() };
    const kept = JSON.stringify({
      format: 1,
      runs: [{ summary: summaryOf(ended), record: ended }],
      allTime,
    });
    storage.data.set('getJackBack.stats', kept);
    storage.fail.write = true;
    const { saved, problem } = await statsStore(storage, clock).load();
    expect(problem).toBe("Your stats couldn't be saved (is this browser's storage full?).");
    expect(saved?.runs).toHaveLength(1);
    expect(saved?.achievements.airMail?.run).toBe('a');
    expect(storage.data.get('getJackBack.stats')).toBe(kept);
  });

  it('nothing new to look for: loading writes nothing', async () => {
    const storage = fakeStorage();
    await statsStore(storage, clock).close(run('a'));
    const before = storage.data.get('getJackBack.stats');
    storage.fail.write = true;
    expect((await statsStore(storage, clock).load()).problem).toBeNull();
    expect(storage.data.get('getJackBack.stats')).toBe(before);
  });

  it('storage that can’t be reached: a notice, and the game plays on', async () => {
    const storage = fakeStorage();
    storage.fail.read = true;
    const { saved, problem } = await statsStore(storage, clock).load();
    expect(problem).toBe("This browser isn't keeping your stats (private browsing?).");
    expect(saved).toBeNull();
  });

  it('what’s kept can’t be read: a notice, and it isn’t written over', async () => {
    for (const kept of [
      '{nope',
      JSON.stringify({ format: 99, runs: [] }),
      JSON.stringify({ format: 1 }),
      JSON.stringify({ format: 1, runs: 'x', allTime: {} }),
    ]) {
      const storage = fakeStorage();
      storage.data.set('getJackBack.stats', kept);
      const store = statsStore(storage, clock);
      expect(await store.load()).toEqual({
        saved: null,
        problem: "Your saved stats can't be read, so this run's won't be kept.",
      });
      await store.saveOpen(run('a', { end: 'open' }));
      await store.close(run('a'));
      expect(storage.data.get('getJackBack.stats')).toBe(kept);
    }
  });

  it('a run left open that can’t be read: a notice, and it’s let go', async () => {
    const storage = fakeStorage();
    storage.data.set('getJackBack.stats.open', '{nope');
    expect((await statsStore(storage, clock).load()).problem).toBe(
      "Your last run's stats can't be read, so it isn't counted.",
    );
    expect(storage.data.has('getJackBack.stats.open')).toBe(false);
    expect((await statsStore(storage, clock).load()).problem).toBeNull();
  });

  it('a write refused (a full store) is an error with words for the notice', async () => {
    const storage = fakeStorage();
    const store = statsStore(storage, clock);
    await store.load();
    storage.fail.write = true;
    await expect(store.saveOpen(run('a', { end: 'open' }))).rejects.toThrow(
      "Your stats couldn't be saved (is this browser's storage full?).",
    );
    await expect(store.close(run('a'))).rejects.toThrow(
      "Your stats couldn't be saved (is this browser's storage full?).",
    );
  });
});
