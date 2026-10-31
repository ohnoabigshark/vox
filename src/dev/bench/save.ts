/**
 * Save and Restore defaults on the test bench (docs/BENCH.md, Saving).
 * Two sets of settings, each holding only values off their defaults: what's
 * saved (saved-tuning.json, what the game plays) and what the sliders are at
 * now. Each tab saves and restores its own sliders; the two the Break it!
 * tabs share are one value each, so they save and restore as one (r-s8).
 */
import { assertNever } from '../../assertNever';
import { areaAt } from '../../arcade/content/defense';
import {
  BENCH_TESTS,
  defaultValue,
  knobsFor,
  pathOf,
  pathsOf,
  round,
  tabPaths,
  type BenchTest,
  type Settings,
} from './knobs';

const valueIn = (settings: Settings, path: string): number =>
  round(settings[path] ?? defaultValue(path));

/** The tab's values moved since they were saved. */
export function unsaved(saved: Settings, current: Settings, test: BenchTest): string[] {
  return tabPaths(test).filter((p) => valueIn(saved, p) !== valueIn(current, p));
}

/**
 * The tab's unsaved values that no row on screen shows: a by-area slider
 * shows the picked drive's area, but Save saves every area's (r-s8). Each is
 * its slider's name and the area: "Sweet spot (Candy Queendom)".
 */
export function unsavedOffScreen(
  saved: Settings,
  current: Settings,
  test: BenchTest,
  drive: number,
): string[] {
  const shown = new Set(knobsFor(test).map((k) => pathOf(k, drive)));
  return unsaved(saved, current, test)
    .filter((p) => !shown.has(p))
    .map((p) => {
      const knob = knobsFor(test).find((k) => pathsOf(k).includes(p));
      const area = /\.byArea\.(\d+)\./.exec(p)?.[1];
      const where = area === undefined ? '' : ` (${areaAt(Number(area)).name})`;
      return `${knob?.label ?? p}${where}`;
    });
}

/** The tabs with anything unsaved, for the dot on each tab's button. */
export function tabsWithUnsaved(saved: Settings, current: Settings): BenchTest[] {
  return BENCH_TESTS.filter((t) => unsaved(saved, current, t).length > 0);
}

/** The saved file after Save on `test`: that tab's values as they are now, everything else as saved. */
export function savedAfter(saved: Settings, current: Settings, test: BenchTest): Settings {
  const mine = tabPaths(test);
  const next: Record<string, number> = {};
  for (const [p, v] of Object.entries(saved)) if (!mine.includes(p)) next[p] = v;
  for (const p of mine) {
    const v = valueIn(current, p);
    if (v !== round(defaultValue(p))) next[p] = v;
  }
  return next;
}

/** The sliders after Restore defaults on `test`: that tab's at their defaults. */
export function restoredTab(current: Settings, test: BenchTest): Settings {
  const mine = tabPaths(test);
  return Object.fromEntries(Object.entries(current).filter(([p]) => !mine.includes(p)));
}

/** Save's label: how many of the tab's changes it would save. */
export function saveLabel(changes: number): string {
  if (changes === 0) return 'Saved';
  return `Save ${changes} change${changes === 1 ? '' : 's'}`;
}

/** The save server, as the bench last heard from it. */
export type SaveServer =
  | { readonly kind: 'checking' }
  /** Nothing here can save (the served copy, or the server is down). */
  | { readonly kind: 'none' }
  /** A server answered, but with an error (git failing, say). */
  | { readonly kind: 'broken'; readonly reason: string }
  /**
   * It can save; `inServedGame` when saved-tuning.json is as last committed,
   * and `savedAt` when this visit last saved (clock time), or null.
   */
  | { readonly kind: 'up'; readonly inServedGame: boolean; readonly savedAt: number | null };

export interface SaveState {
  readonly server: SaveServer;
  /** Why the last save failed, or null. */
  readonly error: string | null;
}

/** A clock time as the phone's local hours and minutes, 24-hour: "04:12". */
const hhmm = (at: number): string =>
  new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(at);

/** The save status line, and whether it's a problem (shown in red). */
export function saveStatus(s: SaveState): { text: string; bad: boolean } {
  if (s.error !== null) {
    return { text: `Couldn't save: ${s.error}. Your changes are still here.`, bad: true };
  }
  const server = s.server;
  switch (server.kind) {
    case 'checking':
      return { text: 'Checking for the save server…', bad: false };
    case 'none':
      return { text: 'Saving needs the hot-reload server (/vox-dev/dev/bench.html)', bad: true };
    case 'broken':
      return { text: `The save server can't save: ${server.reason}`, bad: true };
    case 'up': {
      if (server.savedAt !== null) {
        const where = server.inServedGame ? 'in the served game' : 'not in the served game yet';
        return { text: `Saved ${hhmm(server.savedAt)} · ${where}`, bad: false };
      }
      return server.inServedGame
        ? { text: 'Saved settings are in the served game', bad: false }
        : { text: 'Saved · not in the served game yet', bad: false };
    }
    default:
      return assertNever(server);
  }
}

/** The hot-reload server's save endpoint. */
export interface BenchSaver {
  /** Whether anything here can save, and if so whether the saved file is in the served game. */
  probe(): Promise<Exclude<SaveServer, { kind: 'checking' }>>;
  /** Write the whole saved file; throws with the server's reason when it can't. */
  save(saved: Settings): Promise<{ inServedGame: boolean }>;
}

const answer = (x: unknown): { inServedGame: boolean } => ({
  inServedGame: (x as { inServedGame?: unknown }).inServedGame === true,
});

/** The endpoint at `url`. */
export function httpSaver(url: string, fetchFn: typeof fetch = fetch): BenchSaver {
  return {
    async probe() {
      let r: Response;
      try {
        r = await fetchFn(url);
      } catch {
        return { kind: 'none' };
      }
      if (r.ok) return { kind: 'up', ...answer(await r.json()), savedAt: null };
      // A 404 is a page with no server behind it; anything else is a server with a problem.
      if (r.status === 404) return { kind: 'none' };
      return { kind: 'broken', reason: (await r.text()) || `the server answered ${r.status}` };
    },
    async save(saved) {
      const r = await fetchFn(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(saved),
      });
      if (!r.ok) throw new Error((await r.text()) || `the server answered ${r.status}`);
      return answer(await r.json());
    },
  };
}
