import { describe, expect, it } from 'vitest';
import { addRun, emptyAllTime, summaryOf } from '../../../src/arcade/record/allTime';
import { KEPT_RUNS, statsStore } from '../../../src/arcade/record/store';
import { JACK, type PlayResult, type RunRecord } from '../../../src/arcade/record/types';

/**
 * docs/STATS.md, keeping it (k1–k4) and the store's scenarios (f2): a fake
 * storage that can refuse to be read, refuse a write, or hold what the
 * store can't read.
 */

type Fake = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> & {
  data: Map<string, string>;
  /** What fails: reading anything, or writing (a full store). */
  fail: { read: boolean; write: boolean };
};

const fakeStorage = (): Fake => {
  const data = new Map<string, string>();
  const fail = { read: false, write: false };
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
    removeItem: (k) => void data.delete(k),
  };
};

const NOW = Date.UTC(2026, 10, 3, 12, 30);
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
  airYards: null,
  afterCatch: null,
  afterContact: null,
  lossTackle: false,
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
      saved: { runs: [], allTime: { hard: emptyAllTime(), normal: emptyAllTime() } },
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
    const { saved, problem } = await statsStore(storage, clock).load();
    expect(problem).toBeNull();
    expect(saved.runs.map((r) => [r.summary.id, r.summary.end, r.summary.endedAt])).toEqual([
      ['a', 'unfinished', '2026-11-03T12:30:00.000Z'],
    ]);
    expect(saved.allTime.hard.runs).toBe(1);
    // …once: the next start finds nothing open.
    expect((await statsStore(storage, clock).load()).saved.runs).toHaveLength(1);
  });

  it('a run saved again replaces what was saved of it, and closing it clears it', async () => {
    const storage = fakeStorage();
    const store = statsStore(storage, clock);
    await store.saveOpen(run('a', { end: 'open', downs: [] }));
    await store.saveOpen(run('a', { end: 'open' }));
    await store.close(run('a'));
    const { saved } = await statsStore(storage, clock).load();
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

  it('what’s saved carries its format; a format-1 save loads as it is', async () => {
    const storage = fakeStorage();
    const ended = { ...run('a'), endedAt: '2026-11-03T12:00:00.000Z' };
    const allTime = { hard: addRun(emptyAllTime(), ended), normal: emptyAllTime() };
    storage.data.set(
      'getJackBack.stats',
      JSON.stringify({ format: 1, runs: [{ summary: summaryOf(ended), record: ended }], allTime }),
    );
    const { saved, problem } = await statsStore(storage, clock).load();
    expect(problem).toBeNull();
    expect(saved.runs[0]!.record).toEqual(ended);
    await statsStore(storage, clock).close(run('b'));
    expect(JSON.parse(storage.data.get('getJackBack.stats')!).format).toBe(1);
  });
});

describe('when it can’t keep them, it says so', () => {
  it('storage that can’t be reached: a notice, and the game plays on', async () => {
    const storage = fakeStorage();
    storage.fail.read = true;
    const { saved, problem } = await statsStore(storage, clock).load();
    expect(problem).toBe("This browser isn't keeping your stats (private browsing?).");
    expect(saved.runs).toEqual([]);
  });

  it('what’s kept can’t be read: a notice, and it isn’t written over', async () => {
    for (const kept of ['{nope', JSON.stringify({ format: 99, runs: [] })]) {
      const storage = fakeStorage();
      storage.data.set('getJackBack.stats', kept);
      const store = statsStore(storage, clock);
      expect((await store.load()).problem).toBe(
        "Your saved stats can't be read, so this run's won't be kept.",
      );
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
