/**
 * The two modes a link can switch: hard mode and two-tap throwing (GAMEPLAY.md,
 * Fork options). Read in one place so the defaults are written once.
 */
export interface Modes {
  /** Hard mode: the zones go round until you lose. */
  readonly hard: boolean;
  /** Two-tap throwing: the first THROW stops the sweep, the second lobs. */
  readonly twoTapAim: boolean;
}

/**
 * A page's query, already parsed, read for its modes. Both are on unless the
 * link turns one off: `?hard=0` for the run that ends in a win, `?aim=1` for
 * the one-tap sweep. Any other value leaves the default (release mode's map,
 * b2).
 */
export function readModes(params: URLSearchParams): Modes {
  return { hard: params.get('hard') !== '0', twoTapAim: params.get('aim') !== '1' };
}
