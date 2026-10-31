/**
 * Save and Restore defaults on the test bench (docs/BENCH.md, Saving).
 * Two sets of settings, each holding only values off their defaults: what's
 * saved (saved-tuning.json, what the game plays) and what the sliders are at
 * now. Each tab saves and restores its own sliders; the two the Break it!
 * tabs share are one value each, so they save and restore as one (r-s8).
 */
import {
  BENCH_TESTS,
  defaultValue,
  knobsFor,
  pathsOf,
  round,
  type BenchTest,
  type Settings,
} from './knobs';

/** Every value a tab's sliders edit, every area's for a by-area slider. */
function tabPaths(test: BenchTest): string[] {
  return knobsFor(test).flatMap(pathsOf);
}

const valueIn = (settings: Settings, path: string): number =>
  round(settings[path] ?? defaultValue(path));

/** The tab's values moved since they were saved. */
export function unsaved(saved: Settings, current: Settings, test: BenchTest): string[] {
  return tabPaths(test).filter((p) => valueIn(saved, p) !== valueIn(current, p));
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

export interface SaveState {
  /** Whether a server that can save answered: still asking, none, or up. */
  readonly server: 'checking' | 'none' | 'up';
  /** Whether saved-tuning.json is as last committed, so the served game plays it. */
  readonly inServedGame: boolean;
  /** Why the last save failed, or null. */
  readonly error: string | null;
}

/** The save status line, and whether it's a problem (shown in red). */
export function saveStatus(s: SaveState): { text: string; bad: boolean } {
  if (s.error !== null) {
    return { text: `Couldn't save: ${s.error}. Your changes are still here.`, bad: true };
  }
  switch (s.server) {
    case 'checking':
      return { text: 'Checking for the save server…', bad: false };
    case 'none':
      return { text: 'Saving needs the hot-reload server (/vox-dev/dev/bench.html)', bad: true };
    case 'up':
      return s.inServedGame
        ? { text: 'Saved settings are in the served game', bad: false }
        : { text: 'Saved · not in the served game yet', bad: false };
  }
}

/** The hot-reload server's save endpoint. */
export interface BenchSaver {
  /** Whether the saved file is in the served game, or null when nothing can save here. */
  probe(): Promise<{ inServedGame: boolean } | null>;
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
      try {
        const r = await fetchFn(url);
        return r.ok ? answer(await r.json()) : null;
      } catch {
        return null;
      }
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
