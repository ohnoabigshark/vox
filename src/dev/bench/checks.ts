/** Small checks the bench's modules share when reading what came from outside. */

export { isRecord } from '../../isRecord';

export const clamp = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, x));
