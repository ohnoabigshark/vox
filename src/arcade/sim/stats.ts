/** Small arithmetic on Heft / Hands / Hustle (GAMEPLAY.md, Your Team). */
import type { Stats } from './types';

export const ZERO: Stats = { hustle: 0, hands: 0, heft: 0 };

/** The order the stats are shown in, as the bars draw them, and growth lists its gains. */
export const STAT_ORDER: readonly (keyof Stats)[] = ['heft', 'hustle', 'hands'];

/** `a` plus `k` times `b`, stat by stat. */
export const plus = (a: Stats, b: Stats, k = 1): Stats => ({
  hustle: a.hustle + b.hustle * k,
  hands: a.hands + b.hands * k,
  heft: a.heft + b.heft * k,
});

/** The same number in every stat. */
export const even = (n: number): Stats => ({ hustle: n, hands: n, heft: n });
