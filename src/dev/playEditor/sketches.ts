/**
 * Sketches: plays being drawn in the editor, kept in this browser's
 * localStorage (map items e2, e13). Each is stored as its link text
 * (content/playCode.ts), so a sketch is read back with the same checks as a
 * Try it link. Storage can be unavailable or hold something unreadable; the
 * list then says so rather than quietly showing less.
 */
import { playFromLink, playToLink } from '../../arcade/content/playCode';
import { playProblems } from '../../arcade/content/playRules';
import type { Play } from '../../arcade/content/plays';

const KEY = 'getJackBack.playEditor.sketches';
/** Where sketches were kept while they were called drafts: read until the first save moves them. */
const OLD_KEY = 'getJackBack.playEditor.drafts';
const VERSION = 1;
const UNAVAILABLE = "This browser isn't keeping sketches (private browsing?).";
const UNREADABLE = "Your saved sketches can't be read, so they can't be shown.";
const OTHER_VERSION =
  "Your saved sketches are from another version of the play editor, so they can't be shown.";

export interface Sketch {
  /** Which sketch this is, kept as it's renamed. */
  readonly key: string;
  readonly play: Play;
  /** When it was last saved, in milliseconds. */
  readonly edited: number;
  /** Its In the game switch (map item n1): the full game deals it, if it has no problems. */
  readonly inGame: boolean;
}

export interface SketchList {
  /** Newest first. */
  readonly sketches: readonly Sketch[];
  /** Why the list may be short or empty, for the page to show; null when nothing's wrong. */
  readonly problem: string | null;
}

export interface SketchStore {
  list(): Promise<SketchList>;
  save(key: string, play: Play): Promise<void>;
  remove(key: string): Promise<void>;
  setInGame(key: string, on: boolean): Promise<void>;
}

interface Saved {
  readonly key: string;
  readonly edited: number;
  readonly link: string;
  /** Written only when on, so a sketch saved before the switch existed reads as off. */
  readonly inGame?: true;
}

/** The browser's localStorage, or, where even reaching it throws, a stand-in that always refuses. */
export function browserStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  try {
    return localStorage;
  } catch {
    const refuse = (): never => {
      throw new Error('localStorage is unavailable');
    };
    return { getItem: refuse, setItem: refuse };
  }
}

/** A saved sketch with its In the game switch set: written only when on, so older saves read as off. */
function switched(d: Saved, on: boolean): Saved {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- the old switch, replaced
  const { inGame, ...rest } = d;
  return on ? { ...rest, inGame: true } : rest;
}

/** Sketches kept in `storage` (localStorage on the page); `now` stamps each save. */
export function sketchStore(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  now: () => number,
): SketchStore {
  // Anything stored that can't be read is reported, and never written over:
  // the sketches may still matter to whichever editor wrote them.
  // What one key holds (its list is under `field`), or null when it holds nothing.
  const load = (key: string, field: 'sketches' | 'drafts'): Saved[] | null => {
    let raw: string | null;
    try {
      raw = storage.getItem(key);
    } catch {
      throw new Error(UNAVAILABLE);
    }
    if (!raw) return null;
    let parsed: { version?: unknown; [list: string]: unknown };
    try {
      parsed = JSON.parse(raw) as typeof parsed;
    } catch {
      throw new Error(UNREADABLE);
    }
    const list = parsed[field];
    if (parsed.version !== VERSION || !Array.isArray(list)) throw new Error(OTHER_VERSION);
    return list as Saved[];
  };
  const read = (): Saved[] => load(KEY, 'sketches') ?? load(OLD_KEY, 'drafts') ?? [];
  const write = (sketches: readonly Saved[]): void => {
    try {
      storage.setItem(KEY, JSON.stringify({ version: VERSION, sketches }));
    } catch {
      throw new Error(UNAVAILABLE);
    }
  };
  const failed = (e: unknown): Promise<never> =>
    Promise.reject(e instanceof Error ? e : new Error(UNAVAILABLE));
  return {
    list(): Promise<SketchList> {
      let saved: Saved[];
      try {
        saved = read();
      } catch (e) {
        return Promise.resolve({
          sketches: [],
          problem: e instanceof Error ? e.message : UNAVAILABLE,
        });
      }
      const sketches: Sketch[] = [];
      let unreadable = 0;
      for (const d of saved) {
        const back = typeof d?.link === 'string' ? playFromLink(d.link) : null;
        if (back?.ok && typeof d.key === 'string' && typeof d.edited === 'number') {
          sketches.push({
            key: d.key,
            play: back.play,
            edited: d.edited,
            inGame: d.inGame === true,
          });
        } else unreadable++;
      }
      sketches.sort((a, b) => b.edited - a.edited);
      const problem =
        unreadable === 0
          ? null
          : `${unreadable} saved ${unreadable === 1 ? "sketch can't" : "sketches can't"} be read and ${unreadable === 1 ? "isn't" : "aren't"} shown.`;
      return Promise.resolve({ sketches, problem });
    },
    save(key: string, play: Play): Promise<void> {
      try {
        const all = read();
        const was = all.find((d) => d.key === key);
        const others = all.filter((d) => d.key !== key);
        write([
          ...others,
          switched({ key, edited: now(), link: playToLink(play) }, was?.inGame === true),
        ]);
        return Promise.resolve();
      } catch (e) {
        return failed(e);
      }
    },
    setInGame(key: string, on: boolean): Promise<void> {
      try {
        const all = read();
        const was = all.find((d) => d.key === key);
        if (!was) throw new Error("That sketch isn't saved any more.");
        if (on) {
          // Only a sketch with no problems switches on (map item n3).
          const back = playFromLink(was.link);
          const first = back.ok ? playProblems(back.play)[0] : undefined;
          if (back.ok && first) {
            throw new Error(`Fix ${back.play.name || 'this sketch'} first: ${first.message}`);
          }
        }
        write(all.map((d) => (d.key === key ? switched(d, on) : d)));
        return Promise.resolve();
      } catch (e) {
        return failed(e);
      }
    },
    remove(key: string): Promise<void> {
      try {
        write(read().filter((d) => d.key !== key));
        return Promise.resolve();
      } catch (e) {
        return failed(e);
      }
    },
  };
}

/**
 * Where a sketch stands with the full game (map items n1, n3): switched off,
 * dealt, or switched on but sitting out until its problems are fixed. The one
 * place this is decided: the game deals by it and the list shows it.
 */
export type InGame = 'off' | 'dealt' | 'sitsOut';
export function inGameOf(d: Sketch): InGame {
  if (!d.inGame) return 'off';
  return playProblems(d.play).length === 0 ? 'dealt' : 'sitsOut';
}

/**
 * The sketches the full game deals (map round 6), oldest first so a seeded
 * run deals the same each time, each with its key as its id, so two sketches
 * with one name never clash. Oldest first is by key: the page makes keys as
 * `s` and the time it was made, all the same length (older `d` keys sort first).
 */
export function inGamePlays(sketches: readonly Sketch[]): Play[] {
  return sketches
    .filter((d) => inGameOf(d) === 'dealt')
    .sort((a, b) => (a.key < b.key ? -1 : 1))
    .map((d) => ({ ...d.play, id: d.key }));
}

/** An id for a play, from its name, shaped like plays.ts ids: "Curl & Flat 2" is curlFlat2. */
export function idFromName(name: string): string {
  const words = name
    .replace(/'/g, '')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  if (words.length === 0) return 'play';
  return words
    .map((w, i) => (i === 0 ? w.toLowerCase() : w[0]?.toUpperCase() + w.slice(1).toLowerCase()))
    .join('');
}
