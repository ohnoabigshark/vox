import { describe, expect, it } from 'vitest';
import { StatsKeeper } from '../../../src/arcade/record/keeper';
import { emptyAllTime } from '../../../src/arcade/record/allTime';
import type { Saved, StatsStore } from '../../../src/arcade/record/store';
import type { RunRecord } from '../../../src/arcade/record/types';
import { createRun } from '../../../src/arcade/sim/run';
import type { ArcadeEvent, RunState } from '../../../src/arcade/sim/types';

/**
 * docs/STATS.md, keeping it (k2) and what counts (c1): the game's side of
 * the record. A run is saved after every down and when the page is
 * hidden, and closed at Game Over or a win; a drill is never recorded; a
 * store that fails says so.
 */

const EMPTY: Saved = { runs: [], allTime: { hard: emptyAllTime(), normal: emptyAllTime() } };

/** A store that remembers what it was asked, and can be made to fail. */
function fakeStore(fail: { load?: string; save?: string } = {}) {
  const calls: { op: 'saveOpen' | 'close'; record: RunRecord }[] = [];
  const store: StatsStore = {
    load: async () => ({ saved: EMPTY, problem: fail.load ?? null }),
    saveOpen: async (record) => {
      if (fail.save) throw new Error(fail.save);
      calls.push({ op: 'saveOpen', record: structuredClone(record) });
    },
    close: async (record) => {
      if (fail.save) throw new Error(fail.save);
      calls.push({ op: 'close', record: structuredClone(record) });
      return EMPTY;
    },
  };
  return { store, calls };
}

function keeper(fail: { load?: string; save?: string } = {}) {
  const { store, calls } = fakeStore(fail);
  const notices: string[] = [];
  let ids = 0;
  const k = new StatsKeeper({
    store,
    build: 'abc123',
    link: 'snag=1',
    newId: () => `run-${++ids}`,
    now: () => Date.UTC(2026, 10, 3, 12),
    notice: (text) => notices.push(text),
  });
  return { k, calls, notices };
}

/** Let the store's promises settle. */
const settled = () => new Promise((r) => setTimeout(r, 0));

const downEnded: ArcadeEvent[] = [{ type: 'downEnded', result: 'incomplete', gained: 0 }];

/** One step of `state` with these events; `phase` sets where it ends up. */
function stepOf(k: StatsKeeper, state: RunState, events: ArcadeEvent[], phase?: RunState['phase']) {
  const next = structuredClone(state);
  if (phase) next.phase = phase;
  k.step(state, next, events);
  return next;
}

describe('the stats keeper', () => {
  it('a run is saved after every down, with its id, the build and the link', async () => {
    const { k, calls } = keeper();
    const s = createRun(1);
    k.start(s);
    stepOf(k, s, [{ type: 'snapped' }]);
    expect(calls).toEqual([]);
    stepOf(k, s, downEnded);
    await settled();
    expect(calls.map((c) => c.op)).toEqual(['saveOpen']);
    expect(calls[0]!.record).toMatchObject({
      id: 'run-1',
      build: 'abc123',
      link: 'snag=1',
      end: 'open',
    });
    expect(calls[0]!.record.downs).toHaveLength(1);
  });

  it('saved when the page is hidden; a run with no down played isn’t a run, and isn’t saved', async () => {
    const { k, calls } = keeper();
    const s = createRun(1);
    k.start(s);
    k.hidden();
    await settled();
    expect(calls).toEqual([]);
    stepOf(k, s, downEnded);
    k.hidden();
    await settled();
    expect(calls.map((c) => c.op)).toEqual(['saveOpen', 'saveOpen']);
  });

  it('closed at Game Over, once', async () => {
    const { k, calls } = keeper();
    const s = createRun(1);
    k.start(s);
    stepOf(k, s, downEnded);
    // After the pause: the 4th down failed.
    stepOf(k, s, [{ type: 'gameOver', seriesWon: 0, yards: 0 }], 'over');
    stepOf(k, s, [], 'over');
    await settled();
    expect(calls.map((c) => c.op)).toEqual(['saveOpen', 'close']);
    expect(calls[1]!.record.end).toBe('over');
  });

  it('closed at a win', async () => {
    const { k, calls } = keeper();
    const s = createRun(1);
    k.start(s);
    stepOf(k, s, downEnded);
    stepOf(k, s, [{ type: 'areaCleared', area: 2 }], 'won');
    await settled();
    // A save waits its turn, so it writes the run as it stands by then.
    expect(calls.map((c) => c.op)).toEqual(['saveOpen', 'close']);
    expect(calls[1]!.record.end).toBe('won');
  });

  it('each run has its own id', async () => {
    const { k, calls } = keeper();
    for (const seed of [1, 2]) {
      const s = createRun(seed);
      k.start(s);
      stepOf(k, s, downEnded);
    }
    await settled();
    expect(calls.map((c) => c.record.id)).toEqual(['run-1', 'run-2']);
  });

  it('a run waits for what’s kept to be loaded: last time’s run is closed before this one is saved', async () => {
    const order: string[] = [];
    let loaded!: () => void;
    const store: StatsStore = {
      load: () =>
        new Promise((resolve) => {
          loaded = () => {
            order.push('load');
            resolve({ saved: EMPTY, problem: null });
          };
        }),
      saveOpen: async () => void order.push('saveOpen'),
      close: async () => (order.push('close'), EMPTY),
    };
    const k = new StatsKeeper({
      store,
      build: 'b',
      link: '',
      newId: () => 'r',
      now: () => 0,
      notice: () => {},
    });
    void k.load();
    const s = createRun(1);
    k.start(s);
    stepOf(k, s, downEnded);
    stepOf(k, s, [{ type: 'gameOver', seriesWon: 0, yards: 0 }], 'over');
    await settled();
    expect(order).toEqual([]);
    loaded();
    await settled();
    expect(order).toEqual(['load', 'saveOpen', 'close']);
  });

  it('practice and an event’s practice are never recorded', async () => {
    const { k, calls } = keeper();
    for (const s of [
      { ...createRun(1), practice: true },
      { ...createRun(1), practiceEvent: {} as RunState['practiceEvent'] },
    ]) {
      k.start(s);
      stepOf(k, s, downEnded);
      k.hidden();
    }
    await settled();
    expect(calls).toEqual([]);
  });
});

describe('what the screens need', () => {
  it('what’s kept, once loaded, and again after a run closes', async () => {
    const { k } = keeper();
    expect(k.saved).toBeNull();
    await k.load();
    expect(k.saved).toEqual(EMPTY);
  });

  it('a closed run is handed on with what’s kept after it, for the card', async () => {
    const { store } = fakeStore();
    const closed: [string, Saved | null][] = [];
    const k = new StatsKeeper({
      store,
      build: 'b',
      link: '',
      newId: () => 'r1',
      now: () => 0,
      notice: () => {},
      onClosed: (record, saved) => closed.push([record.id, saved]),
    });
    const s = createRun(1);
    k.start(s);
    stepOf(k, s, downEnded);
    stepOf(k, s, [{ type: 'gameOver', seriesWon: 0, yards: 0 }], 'over');
    await settled();
    expect(closed).toEqual([['r1', EMPTY]]);
  });

  it('a close that fails still hands the run on, with nothing kept', async () => {
    const { store } = fakeStore({ save: 'Storage full.' });
    const closed: [string, Saved | null][] = [];
    const k = new StatsKeeper({
      store,
      build: 'b',
      link: '',
      newId: () => 'r1',
      now: () => 0,
      notice: () => {},
      onClosed: (record, saved) => closed.push([record.id, saved]),
    });
    const s = createRun(1);
    k.start(s);
    stepOf(k, s, downEnded);
    stepOf(k, s, [{ type: 'gameOver', seriesWon: 0, yards: 0 }], 'over');
    await settled();
    expect(closed).toEqual([['r1', null]]);
  });
});

describe('a store that fails says so', () => {
  it('the store’s problem on loading is the notice', async () => {
    const { k, notices } = keeper({ load: 'No stats here.' });
    await k.load();
    expect(notices).toEqual(['No stats here.']);
  });

  it('a load that fails outright is the notice too', async () => {
    const { store } = fakeStore();
    const notices: string[] = [];
    const k = new StatsKeeper({
      store: { ...store, load: () => Promise.reject(new Error('Storage full.')) },
      build: 'b',
      link: '',
      newId: () => 'r',
      now: () => 0,
      notice: (text) => notices.push(text),
    });
    await k.load();
    expect(notices).toEqual(['Storage full.']);
  });

  it('a save that fails is the notice, and the game plays on', async () => {
    const { k, notices } = keeper({ save: 'Storage full.' });
    const s = createRun(1);
    k.start(s);
    stepOf(k, s, downEnded);
    await settled();
    expect(notices).toEqual(['Storage full.']);
  });
});
