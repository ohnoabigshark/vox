/**
 * The test bench's loop (docs/BENCH.md, k3): the rep on now, stepped at the
 * sim's fixed rate from screen time, with the Coach's taps; and Again, which
 * starts the next rep a second after the grade, if the Coach tapped in this
 * one (so a bench left alone stops, rather than logging reps nobody played).
 */
import { arcadeTuning, DT, TIME_SCALE } from '../../arcade/content/tuning';
import type { ArcadeEvent, StepInput } from '../../arcade/sim/types';
import type { SnagView, TipView } from '../../arcade/ui/controls';
import { snagView, tipView } from '../../arcade/ui/testViews';
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

  private opts: BenchOptions;

  constructor(options: BenchOptions) {
    this.opts = { ...options };
  }

  /** What the bench is set to: the open tab's test, the situation, and Again. */
  get options(): Readonly<BenchOptions> {
    return this.opts;
  }

  /** Another tab: its test, with no rep on until GO. */
  showTest(test: BenchTest): void {
    this.opts = { ...this.opts, test };
    this.rep = null;
  }

  /** The situation the next rep is played in. */
  setSituation(situation: Situation): void {
    this.opts = { ...this.opts, situation };
  }

  setAgain(again: boolean): void {
    this.opts = { ...this.opts, again };
  }

  /** GO: a new rep, now. */
  go(): void {
    this.seed++;
    this.rep = startRep(this.opts.test, this.opts.situation, this.seed);
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
    const rep = this.showing();
    const view = rep ? snagView(rep.state) : null;
    return view ? { ...view, id: this.reps } : null;
  }

  /** What the tip drill's box shows for the rep on now, or null; each rep its own box, as SNAG IT!'s (B4). */
  tipView(): TipView | null {
    const rep = this.showing();
    const view = rep ? tipView(rep.state) : null;
    return view ? { ...view, id: this.reps } : null;
  }

  /**
   * The rep on now while it still shows its box, or null. After the grade
   * the rep's sim stops, so the bench times the box's linger
   * (catchTests.linger, the last dot's or pop's result) itself, from when the
   * grade came in.
   */
  private showing(): Rep | null {
    const rep = this.rep;
    if (!rep) return null;
    const since = this.wait === null ? 0 : AGAIN_AFTER - this.wait;
    return !rep.result || since < arcadeTuning.catchTests.linger / TIME_SCALE ? rep : null;
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
        if (this.wait <= 0 && this.opts.again && this.touched) this.go();
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
