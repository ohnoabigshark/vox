/**
 * The setup (docs/DEV_SETUP.md, d2): the run options the Coach saved on the
 * dev setup page, kept in this site's localStorage, so the tailnet build and
 * the release each keep their own. Only the switches that differ from the
 * defaults are kept. What can't be read is said, never swallowed: storage
 * that can't be read at all is `unreadable` (the page shows why; the game
 * plays the defaults), and a value no switch takes is left out with a
 * warning naming it.
 */
import { changesOnly, checkSwitches, type RunOptions } from './runOptions';

export const SETUP_KEY = 'getJackBack.devSetup';

/** What reading the setup found. */
export type SetupRead =
  | { readonly kind: 'nothing' }
  | {
      readonly kind: 'saved';
      readonly setup: Partial<RunOptions>;
      /** Values left out, each named (none, normally). */
      readonly warnings: readonly string[];
    }
  | { readonly kind: 'unreadable'; readonly reason: string };

/** Where the setup is kept (async, so another store is a swap). */
export interface SetupStore {
  read(): Promise<SetupRead>;
  /** Keep this setup: the switches it changes from the defaults. */
  save(setup: Partial<RunOptions>): Promise<void>;
  /** Forget it: every run plays the defaults (and its link). */
  clear(): Promise<void>;
}

const reasonOf = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** The setup kept in `storage` (the page's localStorage, `browserStorage()`). */
export function setupStore(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
): SetupStore {
  return {
    async read() {
      let raw: string | null;
      try {
        raw = storage.getItem(SETUP_KEY);
      } catch (e) {
        return { kind: 'unreadable', reason: reasonOf(e) };
      }
      if (raw === null) return { kind: 'nothing' };
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        return { kind: 'unreadable', reason: `The dev setup isn’t JSON (${reasonOf(e)}).` };
      }
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
        return { kind: 'unreadable', reason: 'The dev setup isn’t a set of switches.' };
      const { named, bad, unknown } = checkSwitches(parsed as Record<string, unknown>);
      return {
        kind: 'saved',
        setup: named,
        warnings: [
          ...bad.map(
            (b) =>
              `The dev setup’s ${b.key} (${JSON.stringify(b.value)}) isn’t one it knows, so it was left out.`,
          ),
          ...unknown.map(
            (key) =>
              `The dev setup has a switch called ${key}, which isn’t one, so it was left out.`,
          ),
        ],
      };
    },
    async save(setup) {
      storage.setItem(SETUP_KEY, JSON.stringify(changesOnly(setup)));
    },
    async clear() {
      storage.removeItem(SETUP_KEY);
    },
  };
}
