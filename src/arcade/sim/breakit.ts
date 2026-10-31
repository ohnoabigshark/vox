/**
 * Break it! (GAMEPLAY.md): when a defender grabs the carrier, the play
 * freezes for a quick test, picked at random: the bar (a timed tap), a mash
 * (tap fast), or a juke (react to an arrow). Each opens with a countdown
 * ("Get ready to mash…"), when taps don't count; then the test runs. How
 * hard it is is set by the area, not by stats; every extra tackler on it
 * makes it harder (only the drag's yards come from Heft). Each ends in a break, a drag or a tackle;
 * step.ts carries that out.
 */
import { arcadeTuning } from '../content/tuning';
import { rngFor } from './random';
import type { BreakKind, Player, RunState, StepInput, Tackle } from './types';
import { clamp } from './vec';

const b = arcadeTuning.breakit;

export type BreakOutcome = 'break' | 'drag' | 'tackle';

const BREAK_KINDS: readonly BreakKind[] = ['bar', 'mash', 'juke'];

/** How hard the three tests are: the bar's sweet spot, the mash's fill per tap, the juke's window. */
export type BreakHardness = { -readonly [K in keyof (typeof b.byArea)[number]]: number };

/**
 * How hard Break it! is in this area (0-based): set by area for the first
 * three; past them (hard mode's later zones), a step tighter each area, down
 * to a floor. The floor is for one tackler: each extra one still makes it
 * harder (`perExtraTackler`).
 */
export function breakHardness(area: number): BreakHardness {
  const last = b.byArea.length - 1;
  const known = b.byArea[Math.min(area, last)] ?? b.byArea[0];
  const past = Math.max(0, area - last);
  const tightened = (k: keyof BreakHardness): number =>
    Math.max(b.floor[k], known[k] + past * b.perAreaPast[k]);
  return {
    sweet: tightened('sweet'),
    mashPerTap: tightened('mashPerTap'),
    jukeWindow: tightened('jukeWindow'),
  };
}

/** Start Break it! for a carrier the `tacklers` have grabbed. `kind` forces one (for tests); otherwise it's random. */
export function startBreakIt(
  state: RunState,
  carrier: Player,
  tacklers: number[],
  kind?: BreakKind,
): void {
  const grabbers = state.field.defenders.filter((d) => tacklers.includes(d.id));
  // How many steps (10 points) of Heft the carrier has over its heaviest tackler (for the drag).
  const step = arcadeTuning.body.statStep;
  const heftGap = (carrier.stats.heft - Math.max(...grabbers.map((d) => d.stats.heft))) / step;
  const level = breakHardness(state.drive.area);
  const pile = b.perExtraTackler ** (tacklers.length - 1);
  const rng = rngFor(state.seed, 'break', state.step);
  const last = state.field.lastBreak;
  const chained = last !== null && state.time - last <= b.chainWindow;
  const ready = chained ? b.chainReady : arcadeTuning.countdown.ready;
  const base = {
    startedAt: state.time,
    ready,
    tacklers,
    dragYards: clamp(b.dragYards + b.dragPerHeft * heftGap, b.minDrag, b.maxDrag),
  };
  const pick = kind ?? BREAK_KINDS[rng.int(0, BREAK_KINDS.length - 1)] ?? 'bar';
  let tackle: Tackle;
  switch (pick) {
    case 'mash':
      tackle = {
        ...base,
        kind: 'mash',
        fill: 0,
        perTap: level.mashPerTap * pile,
      };
      break;
    case 'juke':
      tackle = {
        ...base,
        kind: 'juke',
        showAt: state.time + ready,
        side: rng.next() < 0.5 ? -1 : 1,
        window: level.jukeWindow * pile,
      };
      break;
    default: {
      // Where the sweet spot sits, and which way the marker runs, is a fresh surprise every time;
      // but never in the first third of the marker's trip, so there's time to see it and react.
      const width = level.sweet * pile;
      const at = b.earliest + rng.next() * Math.max(0, 1 - b.earliest - width);
      tackle = {
        ...base,
        kind: 'bar',
        dir: rng.next() < 0.5 ? 1 : -1,
        sweet: { from: at, to: at + width },
        near: b.near,
      };
    }
  }
  state.tackle = tackle;
  state.phase = 'breakit';
}

/** Seconds since the countdown ended (negative during it), or null outside Break it!. */
export function sinceGo(state: RunState): number | null {
  const t = state.tackle;
  return t ? state.time - (t.startedAt + t.ready) : null;
}

/** Sim seconds left in the countdown, or null once it's over (or outside Break it!). */
export function countdownLeft(state: RunState): number | null {
  const since = sinceGo(state);
  return since === null || since >= 0 ? null : -since;
}

/** The bar's marker along its trip (0 to 1; 0 through the countdown), or null when it isn't a bar. */
export function breakMarker(state: RunState): number | null {
  const t = state.tackle;
  if (!t || t.kind !== 'bar') return null;
  return Math.max(0, Math.min(1, (sinceGo(state) ?? 0) / b.meterSeconds));
}

/** How much of a mash's time is left (1 to 0; 1 through the countdown), or null when it isn't a mash. */
export function mashLeft(state: RunState): number | null {
  const t = state.tackle;
  if (!t || t.kind !== 'mash') return null;
  return Math.max(0, Math.min(1, 1 - (sinceGo(state) ?? 0) / b.mashSeconds));
}

/** Whether a juke's arrow is showing. */
export function jukeShowing(state: RunState): boolean {
  const t = state.tackle;
  return t?.kind === 'juke' && state.time >= t.showAt;
}

/**
 * What pressing the lit juke button would get right now: GREAT early in its
 * window, OK later, BAD once it's over (it lingers red a moment before the
 * tackle). Null when it isn't a juke or the arrow isn't showing yet.
 */
export function jukeGrade(state: RunState): 'great' | 'ok' | 'bad' | null {
  const t = state.tackle;
  if (t?.kind !== 'juke' || state.time < t.showAt) return null;
  const shown = state.time - t.showAt;
  return shown <= t.window * b.jukeBreakShare ? 'great' : shown <= t.window ? 'ok' : 'bad';
}

/** Judge this step's input (it may fill a mash). Returns the outcome once there is one. */
export function judgeBreakIt(state: RunState, input: StepInput): BreakOutcome | null {
  const t = state.tackle;
  if (!t) return 'tackle';
  const elapsed = sinceGo(state) ?? 0;
  // The countdown: nothing counts yet.
  if (elapsed < 0) return null;
  switch (t.kind) {
    case 'bar': {
      const m = Math.min(1, elapsed / b.meterSeconds);
      if (!input.breakTap) return m >= 1 ? 'tackle' : null;
      if (m >= t.sweet.from && m <= t.sweet.to) return 'break';
      if (m >= t.sweet.from - t.near && m <= t.sweet.to + t.near) return 'drag';
      return 'tackle';
    }
    case 'mash': {
      if (input.breakTap) t.fill += t.perTap;
      if (t.fill >= 1) return 'break';
      if (elapsed < b.mashSeconds) return null;
      return t.fill >= b.mashDrag ? 'drag' : 'tackle';
    }
    case 'juke': {
      const shown = state.time - t.showAt;
      if (input.juke !== undefined) {
        if (input.juke !== t.side) return 'tackle';
        return shown <= t.window * b.jukeBreakShare
          ? 'break'
          : shown <= t.window
            ? 'drag'
            : 'tackle';
      }
      return shown > t.window + b.jukeLinger ? 'tackle' : null;
    }
  }
}
