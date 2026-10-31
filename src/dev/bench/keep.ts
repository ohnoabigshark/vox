/**
 * What the test bench keeps in this browser's storage between visits
 * (docs/BENCH.md, k4 and r-s5): the open tab, the situation and the
 * toggles. Not the sliders: the bench opens at what the game plays, its
 * saved settings. What's kept is checked on the way back in: a situation
 * out of range is pulled inside it, sliders kept before the rework are
 * ignored, and storage that can't be read starts afresh and says so.
 */
import { BENCH_TESTS, type BenchTest } from './knobs';
import { FIRST_SITUATION, type Situation } from './reps';

export interface Toggles {
  readonly again: boolean;
  readonly sound: boolean;
  readonly buzz: boolean;
  readonly timing: boolean;
}

export interface Kept {
  readonly test: BenchTest;
  readonly situation: Situation;
  readonly toggles: Toggles;
}

export const FIRST_KEPT: Kept = {
  test: 'snag',
  situation: FIRST_SITUATION,
  toggles: { again: true, sound: true, buzz: true, timing: true },
};

export interface BenchStore {
  /** What's kept, and why it may be the first settings instead (null when nothing's wrong). */
  load(): Promise<{ kept: Kept; problem: string | null }>;
  save(kept: Kept): Promise<void>;
}

const KEY = 'getJackBack.testBench';
const VERSION = 1;
const UNAVAILABLE = "This browser isn't keeping the bench's settings (private browsing?).";
const UNREADABLE = "The bench's kept tab and situation can't be read, so it starts afresh.";

/** The situation's ranges (k2). */
const RANGES: Readonly<Record<keyof Situation, readonly [number, number]>> = {
  drive: [1, 20],
  tacklers: [1, 3],
  crowd: [1, 3],
  handsGap: [-40, 40],
};

const clamp = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, x));
const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

export function benchStore(storage: Pick<Storage, 'getItem' | 'setItem'>): BenchStore {
  return {
    async load() {
      let raw: string | null;
      try {
        raw = storage.getItem(KEY);
      } catch {
        return { kept: FIRST_KEPT, problem: UNAVAILABLE };
      }
      if (!raw) return { kept: FIRST_KEPT, problem: null };
      try {
        const saved: unknown = JSON.parse(raw);
        if (!isRecord(saved) || saved.version !== VERSION) throw new Error('unreadable');
        return { kept: readKept(saved), problem: null };
      } catch {
        return { kept: FIRST_KEPT, problem: UNREADABLE };
      }
    },
    async save(kept) {
      try {
        storage.setItem(KEY, JSON.stringify({ version: VERSION, ...kept }));
      } catch {
        throw new Error(UNAVAILABLE);
      }
    },
  };
}

/** What was kept, made fit for today's sliders. */
function readKept(saved: Record<string, unknown>): Kept {
  const test = BENCH_TESTS.includes(saved.test as BenchTest)
    ? (saved.test as BenchTest)
    : FIRST_KEPT.test;
  const s = isRecord(saved.situation) ? saved.situation : {};
  const situation = Object.fromEntries(
    (Object.keys(RANGES) as (keyof Situation)[]).map((k) => {
      const [lo, hi] = RANGES[k];
      const v = s[k];
      return [k, typeof v === 'number' ? Math.round(clamp(v, lo, hi)) : FIRST_SITUATION[k]];
    }),
  ) as unknown as Situation;
  const t = isRecord(saved.toggles) ? saved.toggles : {};
  const toggle = (k: keyof Toggles): boolean =>
    typeof t[k] === 'boolean' ? (t[k] as boolean) : FIRST_KEPT.toggles[k];
  return {
    test,
    situation,
    toggles: {
      again: toggle('again'),
      sound: toggle('sound'),
      buzz: toggle('buzz'),
      timing: toggle('timing'),
    },
  };
}
