/**
 * The test bench's reps (docs/BENCH.md, b2, k2, t1): each is a run from
 * `createRun` with its tap test started straight away, in the situation the
 * Coach set, and stepped with the game's own `step()`, so hits, misses and
 * grades are the game's. Each rep keeps its timing, one measure per test
 * in screen seconds, read off the run at the moment of each tap.
 */
import { arcadeTuning, DT, TIME_SCALE } from '../../arcade/content/tuning';
import { qbOf } from '../../arcade/sim/ai';
import { breakHardness, startBreakIt } from '../../arcade/sim/breakit';
import { createRun } from '../../arcade/sim/run';
import { snagCount, snagPace, startSnag } from '../../arcade/sim/snag';
import { step } from '../../arcade/sim/step';
import { startingRoster } from '../../arcade/sim/team';
import type { ArcadeEvent, Player, RunState, StepInput } from '../../arcade/sim/types';
import { DRIVE_KINDS } from '../../arcade/sim/run';
import type { BenchTest } from './knobs';

/** Where a rep is played (k2): the drive, and who's in on it. */
export interface Situation {
  /** 1 to 20. */
  readonly drive: number;
  /** Break it!: defenders on the carrier, 1 to 3. */
  readonly tacklers: number;
  /** SNAG IT!: defenders reaching for the ball, 1 to 3… */
  readonly crowd: number;
  /** …and the receiver's Hands over theirs, −40 to +40. */
  readonly handsGap: number;
}

export const FIRST_SITUATION: Situation = { drive: 5, tacklers: 1, crowd: 1, handsGap: 0 };

export type Grade = 'great' | 'ok' | 'bad';

/** How the taps went (t1), in screen seconds. */
export type Timing =
  /** Where the marker was from the middle of the sweet spot (late is +), or null with no tap. */
  | { readonly test: 'bar'; readonly off: number | null }
  /** Taps after the go, taps a second up to the last of them, and how full it got (0 to 1). */
  | {
      readonly test: 'mash';
      readonly taps: number;
      readonly perSecond: number;
      readonly fill: number;
    }
  /** The reaction to the arrow, out of the window, and which side was pressed. */
  | {
      readonly test: 'juke';
      readonly reaction: number | null;
      readonly window: number;
      readonly side: 'right' | 'wrong' | null;
    }
  /**
   * Each dot, early (−) or late of its ring closing (off null if it wasn't
   * tapped); null while it's still to play.
   */
  | {
      readonly test: 'snag';
      readonly dots: readonly ({ readonly off: number | null; readonly hit: boolean } | null)[];
    }
  /** The reaction to the landing, out of the window. */
  | { readonly test: 'shoo'; readonly reaction: number | null; readonly window: number };

export interface RepResult {
  readonly test: BenchTest;
  readonly situation: Situation;
  readonly grade: Grade;
  readonly timing: Timing;
}

export interface Rep {
  readonly test: BenchTest;
  readonly situation: Situation;
  readonly state: RunState;
  /** When the test started (sim time). */
  readonly startedAt: number;
  readonly timing: Timing;
  readonly result: RepResult | null;
}

/** Start a rep of `test` in `situation`; `seed` varies where the sweet spot, the arrow and the dots fall. */
export function startRep(test: BenchTest, situation: Situation, seed: number): Rep {
  const state = createRun(seed, startingRoster(), 0, { snag: true });
  const drive = situation.drive - 1;
  state.drive = {
    ...state.drive,
    area: Math.floor(drive / DRIVE_KINDS.length),
    index: drive % DRIVE_KINDS.length,
  };
  state.phase = 'play';
  state.snappedAt = state.time;
  state.field.pickups = [];
  const players = state.field.players;
  const defenders = state.field.defenders;
  const qb = qbOf(state);
  if (!qb) throw new Error('the run has no QB');
  const events: ArcadeEvent[] = [];
  let timing: Timing;
  switch (test) {
    case 'bar':
    case 'mash':
    case 'juke': {
      const carrier = players.find((p) => p.role === 'runner') ?? qb;
      state.field.ball = { at: 'carried', by: carrier.id };
      const tacklers = defenders.slice(0, situation.tacklers).map((d) => d.id);
      startBreakIt(state, carrier, tacklers, test);
      const t = state.tackle;
      timing =
        test === 'bar'
          ? { test, off: null }
          : test === 'mash'
            ? { test, taps: 0, perSecond: 0, fill: 0 }
            : {
                test,
                reaction: null,
                window: (t?.kind === 'juke' ? t.window : 0) / TIME_SCALE,
                side: null,
              };
      break;
    }
    case 'snag': {
      // The receiver's Hands over the defenders' by the gap; as many defenders reaching as the crowd.
      const i = players.findIndex((p) => p.role === 'catcher');
      const catcher = players[i];
      if (!catcher) throw new Error('the run has no Catcher');
      const receiver: Player = {
        ...catcher,
        stats: { ...catcher.stats, hands: 50 + situation.handsGap },
      };
      players[i] = receiver;
      const crowd = defenders.slice(0, situation.crowd).map((d, j) => {
        const reaching = { ...d, stats: { ...d.stats, hands: 50 } };
        defenders[j] = reaching;
        return reaching;
      });
      startSnag(state, { receiver, defenders: crowd }, qb.pos, events);
      const dots = state.snag?.dots.map(() => null) ?? [];
      timing = { test, dots };
      break;
    }
    case 'shoo': {
      // The crows already on the QB, with nobody else about to bring him down.
      defenders.length = 0;
      state.field.crows = [
        { phase: 'shoo', pos: qb.pos, left: arcadeTuning.crows.window, on: qb.id, goneAt: null },
      ];
      timing = { test, reaction: null, window: arcadeTuning.crows.window / TIME_SCALE };
      break;
    }
  }
  return { test, situation, state, startedAt: state.time, timing, result: null };
}

/** Step a rep once with this input: the timing notes any tap, and the result comes with the grade. */
export function stepRep(rep: Rep, input: StepInput): { rep: Rep; events: ArcadeEvent[] } {
  if (rep.result) return { rep, events: [] };
  const prev = rep.state;
  // The moment step() judges this input at.
  const t = prev.time + DT;
  let timing = noteTap(rep, input, t);
  const { state, events } = step(prev, input);
  if (timing.test === 'snag') {
    const dots = [...timing.dots];
    for (const e of events) {
      if (e.type !== 'snagDot') continue;
      const dot = prev.snag?.dots[e.index];
      const tapped = input.snag === e.index && dot;
      dots[e.index] = { off: tapped ? (t - dot.closesAt) / TIME_SCALE : null, hit: e.hit };
    }
    timing = { ...timing, dots };
  }
  const grade = gradeOf(events);
  const result = grade ? { test: rep.test, situation: rep.situation, grade, timing } : null;
  return { rep: { ...rep, state, timing, result }, events };
}

/** The timing with this step's tap noted, read off the run before step() judges it. */
function noteTap(rep: Rep, input: StepInput, t: number): Timing {
  const timing = rep.timing;
  const tackle = rep.state.tackle;
  const sinceGo = tackle ? t - (tackle.startedAt + tackle.ready) : -1;
  const b = arcadeTuning.breakit;
  switch (timing.test) {
    case 'bar': {
      if (!input.breakTap || tackle?.kind !== 'bar' || sinceGo < 0 || timing.off !== null) {
        return timing;
      }
      const marker = Math.min(1, sinceGo / b.meterSeconds);
      const mid = (tackle.sweet.from + tackle.sweet.to) / 2;
      return { ...timing, off: ((marker - mid) * b.meterSeconds) / TIME_SCALE };
    }
    case 'mash': {
      if (!input.breakTap || tackle?.kind !== 'mash' || sinceGo < 0) return timing;
      const taps = timing.taps + 1;
      return {
        ...timing,
        taps,
        perSecond: sinceGo > 0 ? taps / (sinceGo / TIME_SCALE) : 0,
        fill: Math.min(1, tackle.fill + tackle.perTap),
      };
    }
    case 'juke': {
      if (input.juke === undefined || tackle?.kind !== 'juke' || t < tackle.showAt) return timing;
      if (timing.reaction !== null) return timing;
      return {
        ...timing,
        reaction: (t - tackle.showAt) / TIME_SCALE,
        side: input.juke === tackle.side ? 'right' : 'wrong',
      };
    }
    case 'shoo': {
      const on = rep.state.field.crows?.some((c) => c.phase === 'shoo');
      if (!input.shoo || !on || timing.reaction !== null) return timing;
      return { ...timing, reaction: (t - rep.startedAt) / TIME_SCALE };
    }
    case 'snag':
      return timing;
  }
}

/** The grade, once this step's events settle the test. */
function gradeOf(events: readonly ArcadeEvent[]): Grade | null {
  for (const e of events) {
    switch (e.type) {
      case 'breakResult':
        return e.outcome === 'break' ? 'great' : e.outcome === 'drag' ? 'ok' : 'bad';
      case 'snagResult':
        return e.grade;
      case 'crowsShooed':
        return 'great';
      case 'crowsStruck':
        return 'bad';
      default:
        break;
    }
  }
  return null;
}

/** Seconds, signed: "+0.05", "−0.21". */
const signed = (s: number): string => `${s < 0 ? '−' : '+'}${Math.abs(s).toFixed(2)}`;

/** The Timing readout (t1): "late +0.05 s", "11 taps · 9.2 a second · 100%", "+0.03 hit · −0.21 early". */
export function timingText(timing: Timing): string {
  switch (timing.test) {
    case 'bar':
      return timing.off === null
        ? 'no tap'
        : `${timing.off < 0 ? 'early' : 'late'} ${signed(timing.off)} s`;
    case 'mash':
      return `${timing.taps} taps · ${timing.perSecond.toFixed(1)} a second · ${Math.round(timing.fill * 100)}%`;
    case 'juke':
      return timing.reaction === null
        ? `too late · ${timing.window.toFixed(2)} s`
        : `${timing.reaction.toFixed(2)} s of ${timing.window.toFixed(2)} s${timing.side === 'wrong' ? ' · wrong side' : ''}`;
    case 'snag':
      return timing.dots
        .map((d) =>
          d === null
            ? '…'
            : d.off === null
              ? 'none'
              : `${signed(d.off)} ${d.hit ? 'hit' : d.off < 0 ? 'early' : 'late'}`,
        )
        .join(' · ');
    case 'shoo':
      return timing.reaction === null
        ? `too late · ${timing.window.toFixed(2)} s`
        : `${timing.reaction.toFixed(2)} s of ${timing.window.toFixed(2)} s`;
  }
}

/** What the situation adds up to for this test (k2), in screen seconds. */
export function summary(test: BenchTest, situation: Situation): string {
  const { drive } = situation;
  const area = Math.floor((drive - 1) / DRIVE_KINDS.length);
  const b = arcadeTuning.breakit;
  const pile = b.perExtraTackler ** (situation.tacklers - 1);
  const level = breakHardness(area);
  const s = (sim: number): string => `${(sim / TIME_SCALE).toFixed(2)} s`;
  const tacklers = `${situation.tacklers} tackler${situation.tacklers === 1 ? '' : 's'}`;
  switch (test) {
    case 'bar':
      return `drive ${drive} · sweet spot ${+(level.sweet * pile * 100).toFixed(1)}% of the meter · ${tacklers}`;
    case 'mash': {
      // Counted as the game fills it, tap by tap.
      let fill = 0;
      let taps = 0;
      while (fill < 1 && taps < 1000) {
        fill += level.mashPerTap * pile;
        taps++;
      }
      return `drive ${drive} · ${taps} taps in ${s(b.mashSeconds)} · ${tacklers}`;
    }
    case 'juke':
      return `drive ${drive} · window ${s(level.jukeWindow * pile)} · ${tacklers}`;
    case 'snag': {
      const count = snagCount({ drive, crowd: situation.crowd, handsGap: situation.handsGap });
      const pace = snagPace(drive);
      return `drive ${drive} · ${count} dots · ring ${s(pace.close)} · ${s(pace.gap)} apart`;
    }
    case 'shoo':
      return `${s(arcadeTuning.crows.window)} to shoo`;
  }
}
