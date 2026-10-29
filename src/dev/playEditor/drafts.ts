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
const UNREADABLE = "Your saved drafts can't be read, so they can't be shown.";
const OTHER_VERSION =
  "Your saved drafts are from another version of the play editor, so they can't be shown.";

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
  // Anything stored that can't be read is reported, and never written over:
  // the drafts may still matter to whichever editor wrote them.
  const read = (): Saved[] => {
    let raw: string | null;
    try {
      raw = storage.getItem(KEY);
    } catch {
      throw new Error(UNAVAILABLE);
    }
    if (!raw) return [];
    let parsed: { version?: unknown; drafts?: unknown };
    try {
      parsed = JSON.parse(raw) as typeof parsed;
    } catch {
      throw new Error(UNREADABLE);
    }
    if (parsed.version !== VERSION || !Array.isArray(parsed.drafts)) throw new Error(OTHER_VERSION);
    return parsed.drafts as Saved[];
  };
  const write = (drafts: readonly Saved[]): void => {
    try {
      storage.setItem(KEY, JSON.stringify({ version: VERSION, drafts }));
    } catch {
      throw new Error(UNAVAILABLE);
    }
  };
  const failed = (e: unknown): Promise<never> =>
    Promise.reject(e instanceof Error ? e : new Error(UNAVAILABLE));
  return {
    list(): Promise<DraftList> {
      let saved: Saved[];
      try {
        saved = read();
      } catch (e) {
        return Promise.resolve({
          drafts: [],
          problem: e instanceof Error ? e.message : UNAVAILABLE,
        });
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
        const others = read().filter((d) => d.key !== key);
        write([...others, { key, edited: now(), link: playToLink(play) }]);
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
