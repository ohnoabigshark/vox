/**
 * The test bench's slider rows (docs/BENCH.md, r-u1–u4): a slider moves
 * only when its knob is dragged, so a scroll that starts on a row can't
 * change it, and each row shows its default, what's saved, and whether it
 * has moved since. The page draws them; the rules are here.
 */
import { clamp } from './checks';
import { defaultValue, reachOf, round, showValue, type Knob, type Settings } from './knobs';

export interface Range {
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

const decimals = (step: number): number => (String(step).split('.')[1] ?? '').length;

/** The nearest step to `v`, inside the range. */
export function snap(v: number, r: Range): number {
  const steps = Math.round((clamp(v, r.min, r.max) - r.min) / r.step);
  return +clamp(r.min + steps * r.step, r.min, r.max).toFixed(decimals(r.step) + 4);
}

/** Where `v` sits along the track, 0 at its left end and 1 at its right. */
export function fractionOf(v: number, r: Range): number {
  return r.max === r.min ? 0 : clamp((v - r.min) / (r.max - r.min), 0, 1);
}

/**
 * One drag of a slider: it starts only on the knob (r-u1), and moves the
 * value by how far the pointer has gone since, so grabbing never jumps.
 */
export class Grab {
  private from: { x: number; value: number } | null = null;

  constructor(
    private readonly range: Range,
    private readonly width: () => number,
  ) {}

  get dragging(): boolean {
    return this.from !== null;
  }

  /** A pointer down on the knob or the track, at `x`; true if it grabbed the knob. */
  down(on: 'knob' | 'track', x: number, value = this.range.min): boolean {
    this.from = on === 'knob' ? { x, value } : null;
    return this.from !== null;
  }

  /** The pointer at `x`: the new value while dragging, or null. */
  move(x: number): number | null {
    if (!this.from) return null;
    const { min, max } = this.range;
    const moved = ((x - this.from.x) / Math.max(1, this.width())) * (max - min);
    return snap(this.from.value + moved, this.range);
  }

  up(): void {
    this.from = null;
  }
}

/** What a tuning slider's row shows (r-u4). */
export interface RowView {
  /** The value, as the slider shows it ("0.80 s"). */
  readonly shown: string;
  /** The small print: the path and value, the default, and what's saved. */
  readonly note: string;
  /** Where the knob sits, and the tick at the default, along the track (0–1). */
  readonly at: number;
  readonly tick: number;
  /** Moved since it was last saved: tinted, marked UNSAVED. */
  readonly unsaved: boolean;
  /** At its default: ↺ faded. */
  readonly atDefault: boolean;
}

export function rowView(knob: Knob, path: string, saved: Settings, current: Settings): RowView {
  const byDefault = round(defaultValue(path));
  const savedValue = round(saved[path] ?? byDefault);
  const value = round(current[path] ?? byDefault);
  const reach = reachOf(knob, path);
  const savedNote =
    savedValue === byDefault ? '' : value === savedValue ? ' · saved' : ` · saved ${savedValue}`;
  return {
    shown: showValue(knob, value),
    note: `${path} ${value} · default${value === byDefault ? '' : ` ${byDefault}`}${savedNote}`,
    at: fractionOf(value, { ...reach }),
    tick: fractionOf(byDefault, { ...reach }),
    unsaved: value !== savedValue,
    atDefault: value === byDefault,
  };
}
