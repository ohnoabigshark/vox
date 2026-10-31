/** Small vector helpers for the arcade sim (plain {x, y} objects, never mutated). */
import type { Vec } from './types';

export const v = (x: number, y: number): Vec => ({ x, y });
export const add = (a: Vec, b: Vec): Vec => v(a.x + b.x, a.y + b.y);
export const sub = (a: Vec, b: Vec): Vec => v(a.x - b.x, a.y - b.y);
export const scale = (a: Vec, k: number): Vec => v(a.x * k, a.y * k);
export const len = (a: Vec): number => Math.hypot(a.x, a.y);
export const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);
export const lerp = (a: Vec, b: Vec, t: number): Vec =>
  v(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);

/** `a` scaled to length 1 (or zero if it's zero). */
export function norm(a: Vec): Vec {
  const l = len(a);
  return l === 0 ? v(0, 0) : v(a.x / l, a.y / l);
}

/** `a` with its length capped at `max`. */
/** `x` held to `lo`–`hi`. */
export const clamp = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, x));

export function clampLen(a: Vec, max: number): Vec {
  const l = len(a);
  return l <= max ? a : scale(a, max / l);
}
