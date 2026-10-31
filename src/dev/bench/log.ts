/**
 * The test bench's log (docs/BENCH.md, l1 and r-l3): a rep line on each
 * grade, with the settings it was played at, and a save line on each Save,
 * sent to the hot-reload server, which appends them to a file Claude reads
 * (tools/benchLog.ts). A slider move writes nothing. Where nothing takes
 * the lines (the served build), the page says so rather than pretending.
 */
import { isRecord } from './checks';
import { BENCH_TESTS, round, tabOffDefault, type BenchTest, type Settings } from './knobs';
import type { RepResult, Situation, Timing } from './reps';

export type LogLine =
  | {
      readonly at: string;
      readonly kind: 'rep';
      readonly test: BenchTest;
      readonly situation: Situation;
      readonly grade: RepResult['grade'];
      readonly timing: Timing;
      /** The tab's settings off their defaults when it was played, as tuning.ts numbers. */
      readonly settings: Settings;
    }
  | {
      readonly at: string;
      readonly kind: 'save';
      readonly test: BenchTest;
      /** The tab's values off default that it saved, as tuning.ts numbers. */
      readonly saved: Settings;
    };

/** The line for a rep's grade, its timing rounded as tuning.ts numbers are. */
export function repLine(result: RepResult, settings: Settings, now: number): LogLine {
  return {
    at: new Date(now).toISOString(),
    kind: 'rep',
    test: result.test,
    situation: result.situation,
    grade: result.grade,
    timing: roundAll(result.timing),
    settings: tabOffDefault(settings, result.test),
  };
}

/** The line for a Save on `test`, given the saved file as it now is. */
export function saveLine(test: BenchTest, savedFile: Settings, now: number): LogLine {
  return {
    at: new Date(now).toISOString(),
    kind: 'save',
    test,
    saved: tabOffDefault(savedFile, test),
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

const numbers = (x: unknown): boolean =>
  isRecord(x) && Object.values(x).every((v) => typeof v === 'number');

/** Whether what arrived is a log line (the endpoint writes nothing else). */
export function isLogLine(x: unknown): x is LogLine {
  if (!isRecord(x) || typeof x.at !== 'string') return false;
  if (!BENCH_TESTS.includes(x.test as BenchTest)) return false;
  switch (x.kind) {
    case 'rep': {
      const s = x.situation;
      return (
        isRecord(s) &&
        ['drive', 'tacklers', 'crowd', 'handsGap'].every((k) => typeof s[k] === 'number') &&
        ['great', 'ok', 'bad'].includes(x.grade as string) &&
        isRecord(x.timing) &&
        x.timing.test === x.test &&
        numbers(x.settings)
      );
    }
    case 'save':
      return numbers(x.saved);
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
