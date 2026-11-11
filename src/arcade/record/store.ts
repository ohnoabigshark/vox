/**
 * Where the record is kept (docs/STATS.md, k1–k4): this phone's storage,
 * behind an async store, so moving it to IndexedDB or a server is a swap.
 * Two keys: the run in progress, saved after every down and when the page
 * is hidden; and the closed runs with the all-time stats, written as a run
 * closes.
 */
import { isRecord } from '../../isRecord';
import { upgraded, type UpgradeStep } from '../../upgrade';
import { ACHIEVEMENT_IDS, catchUp, earn, type AchievementId, type EarnedSet } from './achievements';
import { addRun, emptyAllTime, summaryOf, type AllTime, type RunSummary } from './allTime';
import { modeOf, RECORD_FORMAT, type RunRecord } from './types';

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
  /** The achievements earned on this phone (h1). */
  readonly achievements: EarnedSet;
  /** The achievements already looked for in the saved runs (h3): a new one isn't, until it is. */
  readonly checked: readonly AchievementId[];
}

export interface StatsStore {
  /**
   * What's kept, closing a run left open as unfinished; null when it can't
   * be reached or read. `problem` says what went wrong, for the notice.
   */
  load(): Promise<{ saved: Saved | null; problem: string | null }>;
  /** The run in progress, as it now stands. */
  saveOpen(record: RunRecord): Promise<void>;
  /** The run ended: kept, counted, and no longer open. */
  close(record: RunRecord): Promise<Saved>;
}

const KEY = 'getJackBack.stats';
const OPEN_KEY = 'getJackBack.stats.open';

/** A saved run's record with its downs' oil slicks called gravestones; anything else as it was. */
function slicksToGravestones(record: unknown): unknown {
  if (!isRecord(record) || !Array.isArray(record.downs)) return record;
  const downs = record.downs.map((d: unknown) =>
    isRecord(d) && Array.isArray(d.pickups)
      ? { ...d, pickups: d.pickups.map((k: unknown) => (k === 'slick' ? 'gravestone' : k)) }
      : d,
  );
  return { ...record, downs };
}

/**
 * Each older format brought up to the next (`UPGRADES[n]`: n to n + 1).
 * Each step is given either blob: the closed runs (`runs`) or the run in
 * progress (`record`).
 * 1 → 2 (2026-11-03): achievements earned, none yet, and none looked for in
 * the saved runs, so loading looks for them all (h3).
 * 2 → 3 (2026-11-10): the oil slick became the gravestone (next-job map
 * g3), so a down's pickups say so.
 * 3 → 4 (2026-11-10): a run says what dev setup it was made with (map
 * round 5, q3); runs saved before had none.
 * 4 → 5 (2026-11-11): a down says who ran a hot route (docs/PLAYER_MENU.md,
 * b7); downs saved before had none.
 */
const UPGRADES: Readonly<Record<number, UpgradeStep>> = {
  1: (saved) => ({ ...saved, format: 2, achievements: {}, checked: [] }),
  2: recordsTo(3, slicksToGravestones),
  3: recordsTo(4, withNoSetup),
  4: recordsTo(5, withNoHotRoutes),
};

/**
 * A step to `format` that changes every run record in either blob: each
 * closed run's (`runs`) and the run in progress (`record`).
 */
function recordsTo(format: number, fix: (record: unknown) => unknown): UpgradeStep {
  return (saved) => ({
    ...saved,
    format,
    ...(Array.isArray(saved.runs)
      ? {
          runs: saved.runs.map((r: unknown) => (isRecord(r) ? { ...r, record: fix(r.record) } : r)),
        }
      : {}),
    ...('record' in saved ? { record: fix(saved.record) } : {}),
  });
}

/** A run record from before format 4, made with no dev setup (one that's null stays null). */
function withNoSetup(record: unknown): unknown {
  return isRecord(record) ? { setup: '', ...record } : record;
}

/** A run record from before format 5: its downs had no hot routes. */
function withNoHotRoutes(record: unknown): unknown {
  if (!isRecord(record) || !Array.isArray(record.downs)) return record;
  const downs = record.downs.map((d: unknown) => (isRecord(d) ? { hotRoutes: [], ...d } : d));
  return { ...record, downs };
}

const UNAVAILABLE = "This browser isn't keeping your stats (private browsing?).";
const UNREADABLE = "Your saved stats can't be read, so this run's won't be kept.";
const FULL = "Your stats couldn't be saved (is this browser's storage full?).";
const LOST_OPEN = "Your last run's stats can't be read, so it isn't counted.";

const empty = (): Saved => ({
  runs: [],
  allTime: { hard: emptyAllTime(), normal: emptyAllTime() },
  achievements: {},
  // Nothing saved to look in: every achievement is as good as looked for.
  checked: ACHIEVEMENT_IDS,
});

/** A saved blob read and brought up to today's format, or null if it can't be. */
function parsed(raw: string): Record<string, unknown> | null {
  try {
    const x: unknown = JSON.parse(raw);
    return isRecord(x) ? upgraded(x, 'format', RECORD_FORMAT, UPGRADES) : null;
  } catch {
    return null;
  }
}

/** The run ended: kept newest first (every play for the last KEPT_RUNS), and added to its mode's all time; once. */
function closed(saved: Saved, record: RunRecord): Saved {
  if (saved.runs.some((r) => r.summary.id === record.id)) return saved;
  const mode = modeOf(record.modes);
  const runs = [{ summary: summaryOf(record), record }, ...saved.runs].map((r, i) =>
    i < KEPT_RUNS ? r : { ...r, record: null },
  );
  return {
    runs,
    allTime: { ...saved.allTime, [mode]: addRun(saved.allTime[mode], record) },
    achievements: earn(saved.achievements, record),
    checked: saved.checked,
  };
}

/** Whether a saved blob has the closed runs' shape (its format says what's in it; this checks it's there). */
const isSaved = (x: Record<string, unknown>): boolean =>
  Array.isArray(x.runs) &&
  isRecord(x.allTime) &&
  isRecord(x.allTime.hard) &&
  isRecord(x.allTime.normal) &&
  isRecord(x.achievements) &&
  Array.isArray(x.checked);

/** Whether a saved run in progress has a record's shape. */
const isRunRecord = (x: unknown): x is RunRecord =>
  isRecord(x) &&
  typeof x.id === 'string' &&
  Array.isArray(x.downs) &&
  Array.isArray(x.team) &&
  isRecord(x.modes) &&
  isRecord(x.reached);

export function statsStore(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
  now: () => number,
): StatsStore {
  /** Set when what's kept can't be reached or read: nothing is written over it, and the notice has said so. */
  let blocked = false;
  const iso = (ms: number): string => new Date(ms).toISOString();

  /**
   * Let go of the run in progress. A failure here is safe to leave: a run
   * is counted once, by its id, so finding it again next time only clears it.
   */
  const clearOpen = (): void => {
    try {
      storage.removeItem(OPEN_KEY);
    } catch {
      // See above.
    }
  };

  /** What's kept, or why it can't be had. */
  const read = (): {
    saved: Saved;
    open: { record: RunRecord; savedAt: number | null } | null;
    problem: string | null;
  } => {
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
    if (!kept || !isSaved(kept)) {
      blocked = true;
      return { saved: empty(), open: null, problem: UNREADABLE };
    }
    const saved = {
      runs: kept.runs,
      allTime: kept.allTime,
      achievements: kept.achievements,
      checked: kept.checked,
    } as Saved;
    if (openRaw === null) return { saved, open: null, problem: null };
    const open = parsed(openRaw);
    if (!open || !isRunRecord(open.record)) {
      clearOpen();
      return { saved, open: null, problem: LOST_OPEN };
    }
    const savedAt = typeof open.savedAt === 'number' ? open.savedAt : null;
    return { saved, open: { record: open.record, savedAt }, problem: null };
  };

  const write = (key: string, value: object): void => {
    try {
      storage.setItem(key, JSON.stringify({ format: RECORD_FORMAT, ...value }));
    } catch {
      throw new Error(FULL);
    }
  };

  const close = (record: RunRecord, endedAt: number): Saved => {
    const { saved } = read();
    const next = closed(saved, { ...record, endedAt: iso(endedAt) });
    if (blocked) return next;
    if (next !== saved) write(KEY, next);
    clearOpen();
    return next;
  };

  return {
    async load() {
      const { saved: kept, open, problem } = read();
      if (blocked) return { saved: null, problem };
      // Achievements new in this build looked for in the saved runs, once, and written (h3).
      const saved = catchUp(kept);
      let notice = problem;
      if (saved !== kept) {
        // Best effort: if it can't be written, it's found again next time; the stats still load.
        try {
          write(KEY, saved);
        } catch (e) {
          notice = e instanceof Error ? e.message : FULL;
        }
      }
      if (!open) return { saved, problem: notice };
      const { record, savedAt } = open;
      const end = record.end === 'open' ? 'unfinished' : record.end;
      // It ended when it was last saved: the game can't know when the tab went away.
      return { saved: close({ ...record, end }, savedAt ?? now()), problem: notice };
    },
    async saveOpen(record) {
      if (!blocked) write(OPEN_KEY, { record, savedAt: now() });
    },
    async close(record) {
      return close(record, now());
    },
  };
}
