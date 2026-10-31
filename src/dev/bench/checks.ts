/** Small checks the bench's modules share when reading what came from outside. */

export const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

export const clamp = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, x));
