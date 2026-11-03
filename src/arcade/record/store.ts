/**
 * Where the record is kept (docs/STATS.md, k1–k4): this phone's storage,
 * behind an async store, so moving it to IndexedDB or a server is a swap.
 * Two keys: the run in progress, saved after every down and when the page
 * is hidden; and the closed runs with the all-time stats, written as a run
 * closes.
 */
import { upgraded, type UpgradeStep } from '../../upgrade';
import { addRun, emptyAllTime, summaryOf, type AllTime, type RunSummary } from './allTime';
import { RECORD_FORMAT, type RunRecord } from './types';

/** Every play of the last this-many runs; older ones keep their summary (k3). */
export const KEPT_RUNS = 20;

export interface SavedRun {
  readonly summary: RunSummary;
  /** The whole record, for the last KEPT_RUNS runs; null for older ones. */
  readonly record: RunRecord | null;
}

export interface Saved {
  /** Newest first. */
  readonly runs: readonly SavedRun[];
  readonly allTime: { readonly hard: AllTime; readonly normal: AllTime };
}

export interface StatsStore {
  /** What's kept, closing a run left open as unfinished; `problem` says why it may be empty. */
  load(): Promise<{ saved: Saved; problem: string | null }>;
  /** The run in progress, as it now stands. */
  saveOpen(record: RunRecord): Promise<void>;
  /** The run ended: kept, counted, and no longer open. */
  close(record: RunRecord): Promise<Saved>;
}

const KEY = 'getJackBack.stats';
const OPEN_KEY = 'getJackBack.stats.open';

/** Each older format brought up to the next (`UPGRADES[n]`: n to n + 1). None yet: format 1 is the first. */
const UPGRADES: Readonly<Record<number, UpgradeStep>> = {};

const UNAVAILABLE = "This browser isn't keeping your stats (private browsing?).";
const UNREADABLE = "Your saved stats can't be read, so this run's won't be kept.";
const FULL = "Your stats couldn't be saved (is this browser's storage full?).";
const LOST_OPEN = "Your last run's stats can't be read, so it isn't counted.";

const empty = (): Saved => ({
  runs: [],
  allTime: { hard: emptyAllTime(), normal: emptyAllTime() },
});

const isObject = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

/** A saved blob read and brought up to today's format, or null if it can't be. */
function parsed(raw: string): Record<string, unknown> | null {
  try {
    const x: unknown = JSON.parse(raw);
    return isObject(x) ? upgraded(x, 'format', RECORD_FORMAT, UPGRADES) : null;
  } catch {
    return null;
  }
}

/** The run ended: kept newest first (every play for the last KEPT_RUNS), and added to its mode's all time. */
function closed(saved: Saved, record: RunRecord): Saved {
  const mode = record.modes.hard ? 'hard' : 'normal';
  const runs = [{ summary: summaryOf(record), record }, ...saved.runs].map((r, i) =>
    i < KEPT_RUNS ? r : { ...r, record: null },
  );
  return {
    runs,
    allTime: { ...saved.allTime, [mode]: addRun(saved.allTime[mode], record) },
  };
}

export function statsStore(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
  now: () => number,
): StatsStore {
  /** Set when what's kept can't be reached or read: nothing is written over it, and the notice has said so. */
  let blocked = false;

  /** What's kept, or why it can't be had. */
  const read = (): { saved: Saved; open: RunRecord | null; problem: string | null } => {
    let raw: string | null;
    let openRaw: string | null;
    try {
      raw = storage.getItem(KEY);
      openRaw = storage.getItem(OPEN_KEY);
    } catch {
      blocked = true;
      return { saved: empty(), open: null, problem: UNAVAILABLE };
    }
    const kept = raw === null ? { format: RECORD_FORMAT, ...empty() } : parsed(raw);
    if (!kept) {
      blocked = true;
      return { saved: empty(), open: null, problem: UNREADABLE };
    }
    const saved = { runs: kept.runs, allTime: kept.allTime } as Saved;
    if (openRaw === null) return { saved, open: null, problem: null };
    const open = parsed(openRaw)?.record;
    if (!isObject(open)) {
      storage.removeItem(OPEN_KEY);
      return { saved, open: null, problem: LOST_OPEN };
    }
    return { saved, open: open as unknown as RunRecord, problem: null };
  };

  const write = (key: string, value: object): void => {
    try {
      storage.setItem(key, JSON.stringify({ format: RECORD_FORMAT, ...value }));
    } catch {
      throw new Error(FULL);
    }
  };

  const close = (record: RunRecord): Saved => {
    const { saved } = read();
    const next = closed(saved, { ...record, endedAt: new Date(now()).toISOString() });
    if (blocked) return next;
    write(KEY, next);
    storage.removeItem(OPEN_KEY);
    return next;
  };

  return {
    async load() {
      const { saved, open, problem } = read();
      if (!open) return { saved, problem };
      return {
        saved: close({ ...open, end: open.end === 'open' ? 'unfinished' : open.end }),
        problem,
      };
    },
    async saveOpen(record) {
      if (!blocked) write(OPEN_KEY, { record });
    },
    async close(record) {
      return close(record);
    },
  };
}
