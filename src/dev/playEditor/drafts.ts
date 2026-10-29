/**
 * Drafts: plays being drawn in the editor, kept in this browser's
 * localStorage (map items e2, e13). Each is stored as its link text
 * (content/playCode.ts), so a draft is read back with the same checks as a
 * Try it link. Storage can be unavailable or hold something unreadable; the
 * list then says so rather than quietly showing less.
 */
import { playFromLink, playToLink } from '../../arcade/content/playCode';
import type { Play } from '../../arcade/content/plays';

const KEY = 'getJackBack.playEditor.drafts';
const VERSION = 1;
const UNAVAILABLE = "This browser isn't keeping drafts (private browsing?).";

export interface Draft {
  /** Which draft this is, kept as it's renamed. */
  readonly key: string;
  readonly play: Play;
  /** When it was last saved, in milliseconds. */
  readonly edited: number;
}

export interface DraftList {
  /** Newest first. */
  readonly drafts: readonly Draft[];
  /** Why the list may be short or empty, for the page to show; null when nothing's wrong. */
  readonly problem: string | null;
}

export interface DraftStore {
  list(): Promise<DraftList>;
  save(key: string, play: Play): Promise<void>;
  remove(key: string): Promise<void>;
}

interface Saved {
  readonly key: string;
  readonly edited: number;
  readonly link: string;
}

/** Drafts kept in `storage` (localStorage on the page); `now` stamps each save. */
export function draftStore(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  now: () => number,
): DraftStore {
  const read = (): Saved[] => {
    const raw = storage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { version?: unknown; drafts?: unknown };
    if (parsed.version !== VERSION || !Array.isArray(parsed.drafts)) return [];
    return parsed.drafts as Saved[];
  };
  const write = (drafts: readonly Saved[]): void => {
    try {
      storage.setItem(KEY, JSON.stringify({ version: VERSION, drafts }));
    } catch {
      throw new Error(UNAVAILABLE);
    }
  };
  const readOrThrow = (): Saved[] => {
    try {
      return read();
    } catch {
      throw new Error(UNAVAILABLE);
    }
  };
  return {
    list(): Promise<DraftList> {
      let saved: Saved[];
      try {
        saved = read();
      } catch {
        return Promise.resolve({ drafts: [], problem: UNAVAILABLE });
      }
      const drafts: Draft[] = [];
      let unreadable = 0;
      for (const d of saved) {
        const back = typeof d?.link === 'string' ? playFromLink(d.link) : null;
        if (back?.ok && typeof d.key === 'string' && typeof d.edited === 'number') {
          drafts.push({ key: d.key, play: back.play, edited: d.edited });
        } else unreadable++;
      }
      drafts.sort((a, b) => b.edited - a.edited);
      const problem =
        unreadable === 0
          ? null
          : `${unreadable} saved ${unreadable === 1 ? "draft can't" : "drafts can't"} be read and ${unreadable === 1 ? "isn't" : "aren't"} shown.`;
      return Promise.resolve({ drafts, problem });
    },
    save(key: string, play: Play): Promise<void> {
      try {
        const others = readOrThrow().filter((d) => d.key !== key);
        write([...others, { key, edited: now(), link: playToLink(play) }]);
        return Promise.resolve();
      } catch (e) {
        return Promise.reject(e instanceof Error ? e : new Error(UNAVAILABLE));
      }
    },
    remove(key: string): Promise<void> {
      try {
        write(readOrThrow().filter((d) => d.key !== key));
        return Promise.resolve();
      } catch (e) {
        return Promise.reject(e instanceof Error ? e : new Error(UNAVAILABLE));
      }
    },
  };
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
