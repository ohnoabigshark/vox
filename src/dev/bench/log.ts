/**
 * The test bench's log (docs/BENCH.md, l1 and l2): a settings line on each
 * change and a rep line on each grade, sent to the hot-reload server, which
 * appends them to a file Claude reads (tools/benchLog.ts). Where nothing
 * takes them (the served build), the log says so rather than pretending.
 */
import {
  BENCH_TESTS,
  knobsFor,
  pathOf,
  round,
  shippedValue,
  type BenchTest,
  type Settings,
} from './knobs';
import type { RepResult, Situation, Timing } from './reps';

export type LogLine =
  | {
      readonly at: string;
      readonly kind: 'settings';
      readonly test: BenchTest;
      /** The value just changed, by its tuning.ts path. */
      readonly changed: Readonly<Record<string, number>>;
      readonly situation: Situation;
      /** Every value the test's sliders set, at the situation's drive, as tuning.ts numbers. */
      readonly settings: Readonly<Record<string, number>>;
    }
  | {
      readonly at: string;
      readonly kind: 'rep';
      readonly test: BenchTest;
      readonly situation: Situation;
      readonly grade: RepResult['grade'];
      readonly timing: Timing;
    };

/** The line for a slider let go at `path` (or a Reset of several), with the test's whole settings. */
export function settingsLine(
  test: BenchTest,
  situation: Situation,
  settings: Settings,
  path: string | readonly string[],
  now: number,
): LogLine {
  const paths = typeof path === 'string' ? [path] : path;
  const value = (p: string): number => round(settings[p] ?? shippedValue(p));
  const all = Object.fromEntries(
    knobsFor(test).map((k) => [pathOf(k, situation.drive), value(pathOf(k, situation.drive))]),
  );
  return {
    at: new Date(now).toISOString(),
    kind: 'settings',
    test,
    changed: Object.fromEntries(paths.map((p) => [p, value(p)])),
    situation,
    settings: all,
  };
}

/** The line for a rep's grade, its timing rounded as tuning.ts numbers are. */
export function repLine(result: RepResult, now: number): LogLine {
  return {
    at: new Date(now).toISOString(),
    kind: 'rep',
    test: result.test,
    situation: result.situation,
    grade: result.grade,
    timing: roundAll(result.timing),
  };
}

function roundAll<T>(x: T): T {
  if (typeof x === 'number') return round(x) as T;
  if (Array.isArray(x)) return x.map(roundAll) as T;
  if (x && typeof x === 'object') {
    return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, roundAll(v)])) as T;
  }
  return x;
}

const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);
const numbers = (x: unknown): boolean =>
  isRecord(x) && Object.values(x).every((v) => typeof v === 'number');

/** Whether what arrived is a log line (the endpoint writes nothing else). */
export function isLogLine(x: unknown): x is LogLine {
  if (!isRecord(x) || typeof x.at !== 'string') return false;
  if (!BENCH_TESTS.includes(x.test as BenchTest)) return false;
  const s = x.situation;
  if (
    !isRecord(s) ||
    !['drive', 'tacklers', 'crowd', 'handsGap'].every((k) => typeof s[k] === 'number')
  ) {
    return false;
  }
  switch (x.kind) {
    case 'settings':
      return numbers(x.changed) && numbers(x.settings);
    case 'rep':
      return (
        ['great', 'ok', 'bad'].includes(x.grade as string) &&
        isRecord(x.timing) &&
        x.timing.test === x.test
      );
    default:
      return false;
  }
}

/** Where log lines go: whether anything is taking them, and sending one. */
export interface BenchLog {
  /** Whether the endpoint is there (true), or not or failing (false). */
  probe(): Promise<boolean>;
  /** Whether the line was written. */
  record(line: LogLine): Promise<boolean>;
}

/** The hot-reload server's endpoint at `url`. */
export function httpLog(url: string, fetchFn: typeof fetch = fetch): BenchLog {
  const ok = async (init?: RequestInit): Promise<boolean> => {
    try {
      return (await fetchFn(url, init)).ok;
    } catch {
      return false;
    }
  };
  return {
    probe: () => ok(),
    record: (line) =>
      ok({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(line),
      }),
  };
}
