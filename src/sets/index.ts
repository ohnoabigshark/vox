/**
 * The list of sets (docs/PLAN.md, Sets, c1 and c7): each set by the fixed
 * number a link picks it with, `?set=1`. The one file outside a set's folder
 * that may import from it (tests/sets/wall.test.ts). Halloween is the only
 * set until its move into `src/sets/halloween/`, so a set is only its number
 * and name for now.
 */

/** A whole run's skin (CONTEXT.md, Set). */
export interface GameSet {
  /** The number a link picks it by: `?set=1`. */
  readonly number: number;
  /** Its name, as the Coach sees it. */
  readonly name: string;
}

/** Every set, the default first. */
export const SETS: readonly [GameSet, ...GameSet[]] = [{ number: 1, name: 'Get Jack Back' }];

/** The set a link asks for, and a notice for the Coach when there's no such set. */
export interface SetLink {
  readonly set: GameSet;
  readonly notice: string | null;
}

/**
 * The set a page's query picks: `?set=N`, or the default with none (or an
 * empty one). A number with no set behind it plays the default, and says so.
 */
export function readSetLink(params: URLSearchParams): SetLink {
  const asked = params.get('set') ?? '';
  const [fallback] = SETS;
  if (asked === '') return { set: fallback, notice: null };
  const set = SETS.find((s) => String(s.number) === asked);
  if (set) return { set, notice: null };
  return { set: fallback, notice: `There's no set ${asked} yet. Playing ${fallback.name}.` };
}
