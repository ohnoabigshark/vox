/**
 * The test bench's loop (docs/BENCH.md, k3): the rep on now, stepped at the
 * sim's fixed rate from screen time, with the Coach's taps; and Again, which
 * starts the next rep a second after the grade, if the Coach tapped in this
 * one (so a bench left alone stops, rather than logging reps nobody played).
 */
import { DT, TIME_SCALE } from '../../arcade/content/tuning';
import type { ArcadeEvent, StepInput } from '../../arcade/sim/types';
import type { SnagView } from '../../arcade/ui/controls';
import { snagView } from '../../arcade/ui/testViews';
import type { BenchTest } from './knobs';
import { startRep, stepRep, type Rep, type RepResult, type Situation } from './reps';

/** Again: the next rep starts this long after the grade (screen seconds). */
export const AGAIN_AFTER = 1;
/** A frame longer than this (a hidden tab) counts as this long. */
const LONGEST_FRAME = 0.25;

export interface BenchOptions {
  test: BenchTest;
  situation: Situation;
  again: boolean;
}

export class Bench {
  rep: Rep | null = null;
  /** Reps started so far. */
  reps = 0;
  private seed = 0;
  private accumulator = 0;
  private pending: StepInput = {};
  /** Screen seconds until Again starts the next rep, once there's a grade. */
  private wait: number | null = null;
  /** Whether the Coach has tapped in this rep. */
  private touched = false;

  constructor(readonly options: BenchOptions) {}

  /** GO: a new rep, now. */
  go(): void {
    this.seed++;
    this.rep = startRep(this.options.test, this.options.situation, this.seed);
    this.reps++;
    this.accumulator = 0;
    this.pending = {};
    this.wait = null;
    this.touched = false;
  }

  /**
   * What the SNAG IT! box shows for the rep on now, or null. The game tells
   * one SNAG IT! from the next by when it started, but every rep is a fresh
   * run whose SNAG IT! starts at the same moment, so the box kept the last
   * rep's dots (B4). Here each rep is its own: its number is the view's id.
   */
  snagView(): SnagView | null {
    const state = this.rep && !this.rep.result ? this.rep.state : null;
    const view = state ? snagView(state) : null;
    return view ? { ...view, id: this.reps } : null;
  }

  /** A tap, for the next step. */
  press(input: StepInput): void {
    this.pending = { ...this.pending, ...input };
    if (this.rep && !this.rep.result) this.touched = true;
  }

  /** Run `screen` seconds: the events they bring, and the result if the rep ended in them. */
  tick(screen: number): { events: ArcadeEvent[]; finished: RepResult | null } {
    const events: ArcadeEvent[] = [];
    let rep = this.rep;
    if (!rep) return { events, finished: null };
    if (rep.result) {
      if (this.wait !== null) {
        this.wait -= screen;
        if (this.wait <= 0 && this.options.again && this.touched) this.go();
      }
      return { events, finished: null };
    }
    this.accumulator += Math.min(screen, LONGEST_FRAME) * TIME_SCALE;
    while (this.accumulator >= DT && !rep.result) {
      this.accumulator -= DT;
      const r = stepRep(rep, this.pending);
      this.pending = {};
      rep = r.rep;
      events.push(...r.events);
    }
    this.rep = rep;
    if (!rep.result) return { events, finished: null };
    this.wait = AGAIN_AFTER;
    return { events, finished: rep.result };
  }
}
