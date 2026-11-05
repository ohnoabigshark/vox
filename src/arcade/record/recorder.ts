/**
 * The recorder (docs/STATS.md, a2): it takes each step's events, with the
 * state before and after, and adds to the run's record. Pure: no storage,
 * no clock; the game saves what it builds (store.ts). The sim knows nothing
 * of it.
 */
import { assertNever } from '../../assertNever';
import { stretchNumber } from '../sim/run';
import type { ArcadeEvent, DefenderKind, DownResult, Grade, RunState } from '../sim/types';
import {
  JACK,
  RECORD_FORMAT,
  type Outcome,
  type PlayKind,
  type PlayResult,
  type RecordPlayer,
  type RunRecord,
  type TapTestResult,
} from './types';

/** Whether a run is recorded: every real run, never a drill (practice or an event's practice: c1). */
export function recordable(state: RunState): boolean {
  return !state.practice && state.practiceEvent === null;
}

/** What the game knows about a run that the sim doesn't. */
export interface RecordMeta {
  readonly id: string;
  readonly build: string;
  readonly link: string;
  /** When the run started (ms since the epoch, from the clock). */
  readonly now: number;
}

/** A tap test under way: SNAG IT! or the tip drill, between its start and its grade. */
interface OpenTest {
  readonly test: 'snag' | 'tip';
  readonly player: number | null;
  readonly taps: TapTestResult['taps'][number][];
}

/** The down being played, as it's pieced together. */
interface Draft {
  readonly seriesNumber: number;
  readonly down: number;
  readonly toGo: number;
  readonly los: number;
  play: string | null;
  flipped: boolean;
  thrown: boolean;
  handedOff: boolean;
  sacked: boolean;
  target: number | null;
  catcher: number | null;
  carrier: number | null;
  tackledBy: DefenderKind | null;
  catchY: number | null;
  grabY: number | null;
  /** Who Break it! is for, from the grab. */
  grabbed: number | null;
  /** Second Wind turned the coming Break it!'s BAD into a drag: the grade is still BAD. */
  secondWind: boolean;
  tacklesBroken: number;
  drags: number;
  pancakes: number[];
  fieldEvents: string[];
  pickups: PlayResult['pickups'][number][];
  crowsShooed: number;
  tapTests: TapTestResult[];
  open: OpenTest | null;
}

const BREAK_GRADE: Record<'break' | 'drag' | 'tackle', Grade> = {
  break: 'great',
  drag: 'ok',
  tackle: 'bad',
};

export class RunRecorder {
  readonly record: RunRecord;
  private draft: Draft | null = null;

  constructor(state: RunState, meta: RecordMeta) {
    const jack: RecordPlayer = {
      id: JACK,
      name: 'Jack',
      kind: 'jack',
      preferred: null,
      joinedAt: 0,
    };
    this.record = {
      format: RECORD_FORMAT,
      id: meta.id,
      build: meta.build,
      link: meta.link,
      modes: {
        hard: state.hard,
        twoTap: state.twoTapAim,
        snag: state.snagAlways,
        tip: state.tipAlways,
      },
      startedAt: new Date(meta.now).toISOString(),
      endedAt: null,
      end: 'open',
      reached: reachedOf(state),
      team: [
        jack,
        ...[...state.roster, ...state.bench]
          .map((p) => ({
            id: p.id,
            name: p.name,
            kind: p.kind,
            preferred: p.preferred,
            joinedAt: 0,
          }))
          .sort((a, b) => a.id - b.id),
      ],
      plays: {},
      downs: [],
    };
  }

  /** One step's (or one action's) events: the down from `prev`, the spots from `next`. */
  step(prev: RunState, next: RunState, events: readonly ArcadeEvent[]): void {
    for (const e of events) this.event(prev, next, e);
    // How far the run got: the furthest stretch, since a loss can now take the line back (docs/LONG_FIELD.md).
    const now = reachedOf(next);
    if (now.seriesNumber > this.record.reached.seriesNumber) this.record.reached = now;
    if (next.phase === 'won') this.record.end = 'won';
  }

  private event(prev: RunState, next: RunState, e: ArcadeEvent): void {
    switch (e.type) {
      case 'downStarted':
        this.draft = newDraft(next);
        return;
      case 'called': {
        const d = this.draftOf(prev);
        d.play = e.id;
        d.flipped = e.flipped;
        const play = next.playbook.find((p) => p.id === e.id);
        if (play && !(e.id in this.record.plays)) this.record.plays[e.id] = structuredClone(play);
        return;
      }
      case 'snapped':
        this.draftOf(prev);
        return;
      case 'thrown':
        this.draftOf(prev).thrown = true;
        return;
      case 'handoff': {
        const d = this.draftOf(prev);
        d.handedOff = true;
        d.carrier = who(next, e.id);
        return;
      }
      case 'caught': {
        const d = this.draftOf(prev);
        d.catcher = who(next, e.id);
        d.target = d.catcher;
        d.carrier = d.catcher;
        d.catchY = spot(next, e.id);
        return;
      }
      case 'batted':
        this.draftOf(prev).target = e.target === null ? null : who(next, e.target);
        return;
      case 'grabbed': {
        const d = this.draftOf(prev);
        d.grabbed = who(next, e.id);
        d.grabY ??= spot(next, e.id);
        return;
      }
      case 'breakResult': {
        const d = this.draftOf(prev);
        const kind = prev.tackle?.kind;
        if (kind && d.grabbed !== null) {
          d.tapTests.push({
            test: kind,
            player: d.grabbed,
            grade: d.secondWind ? 'bad' : BREAK_GRADE[e.outcome],
            taps: [],
          });
        }
        d.secondWind = false;
        if (e.outcome === 'break') d.tacklesBroken++;
        return;
      }
      case 'secondWind':
        this.draftOf(prev).secondWind = true;
        return;
      case 'dragged':
        this.draftOf(prev).drags++;
        return;
      case 'pancake': {
        const d = this.draftOf(prev);
        const blocker = who(next, e.blocker);
        if (blocker !== null) d.pancakes.push(blocker);
        return;
      }
      case 'snagStarted':
        this.draftOf(prev).open = { test: 'snag', player: who(next, e.receiver), taps: [] };
        return;
      case 'snagDot':
        this.draftOf(prev).open?.taps.push(e.hit ? 'hit' : 'miss');
        return;
      case 'tipStarted':
        this.draftOf(prev).open = { test: 'tip', player: who(next, e.receiver), taps: [] };
        return;
      case 'tipPop':
        this.draftOf(prev).open?.taps.push(e.result);
        return;
      case 'snagResult':
      case 'tipResult': {
        const d = this.draftOf(prev);
        const open = d.open;
        if (open && open.player !== null) {
          d.tapTests.push({
            test: open.test,
            player: open.player,
            grade: e.grade,
            taps: open.taps,
          });
        }
        d.open = null;
        return;
      }
      case 'crowsShooed':
        this.draftOf(prev).crowsShooed++;
        return;
      case 'fieldEventWentOff':
        this.draftOf(prev).fieldEvents.push(e.event);
        return;
      case 'pickupTaken':
        // Your pickups: a bolt a defender took is the defense's (the mischief bolt).
        if (e.side === 'team') this.draftOf(prev).pickups.push(e.kind);
        return;
      case 'sacked':
        this.draftOf(prev).sacked = true;
        return;
      case 'tackled':
        this.draftOf(prev).tackledBy =
          next.field.defenders.find((d) => d.id === e.by)?.kind ?? null;
        return;
      case 'downEnded':
        this.record.downs.push(finished(this.draftOf(prev), next, e.result, e.gained));
        this.draft = null;
        return;
      case 'joined': {
        const p = [...next.roster, ...next.bench].find((r) => r.id === e.id);
        if (p) {
          this.record.team.push({
            id: p.id,
            name: p.name,
            kind: p.kind,
            preferred: p.preferred,
            joinedAt: stretchNumber(next.series),
          });
        }
        return;
      }
      case 'gameOver':
        this.record.end = 'over';
        return;
      // The rest say nothing a result needs, or nothing that isn't counted above.
      case 'banned':
      case 'incomplete':
      case 'brokeTackle':
      case 'crowsLanded':
      case 'crowsStruck':
      case 'outOfBounds':
      case 'seriesWon':
      case 'picked':
      case 'eventTackled':
      case 'slipped':
      case 'seriesStarted':
      case 'areaCleared':
        return;
      // Growth from play: the record keeps no stats yet (docs/REWARDS.md); the play log has each gain.
      case 'grew':
        return;
      // The perk's pop (docs/REWARDS.md, notes p4); the catch itself is counted by `caught`.
      case 'magnet':
        return;
      default:
        assertNever(e);
    }
  }

  /** The down being played, started from `prev` if nothing has started it yet. */
  private draftOf(prev: RunState): Draft {
    this.draft ??= newDraft(prev);
    return this.draft;
  }
}

function newDraft(state: RunState): Draft {
  const { series } = state;
  const play = state.playbook[state.play.index];
  return {
    seriesNumber: stretchNumber(series),
    down: series.down,
    toGo: series.firstDown - series.los,
    los: series.los,
    play: state.called === null ? null : (play?.id ?? null),
    flipped: state.play.flipped,
    thrown: false,
    handedOff: false,
    sacked: false,
    target: null,
    catcher: null,
    carrier: null,
    tackledBy: null,
    catchY: null,
    grabY: null,
    grabbed: null,
    secondWind: false,
    tacklesBroken: 0,
    drags: 0,
    pancakes: [],
    fieldEvents: [],
    pickups: [],
    crowsShooed: 0,
    tapTests: [],
    open: null,
  };
}

function finished(d: Draft, next: RunState, result: DownResult, gained: number): PlayResult {
  // Saved records keep their own union, which today has the sim's results exactly.
  const outcome: Outcome = result;
  const kind: PlayKind = d.sacked ? 'sack' : d.handedOff && !d.thrown ? 'rush' : 'pass';
  const end = endSpot(next, d);
  return {
    seriesNumber: d.seriesNumber,
    down: d.down,
    toGo: d.toGo,
    los: d.los,
    play: d.play,
    flipped: d.flipped,
    kind,
    outcome,
    gained,
    passer: kind === 'rush' ? null : JACK,
    target: kind === 'pass' ? d.target : null,
    catcher: d.catcher,
    carrier: d.carrier,
    tackledBy: d.tackledBy,
    airYards: d.catchY === null ? null : Math.max(0, d.catchY - d.los),
    afterCatch: d.catchY === null ? null : end - d.catchY,
    afterContact: d.grabY === null ? null : end - d.grabY,
    tackleForLoss: kind !== 'sack' && d.carrier !== null && outcome === 'tackled' && end < d.los,
    tacklesBroken: d.tacklesBroken,
    drags: d.drags,
    pancakes: d.pancakes,
    fieldEvents: d.fieldEvents,
    pickups: d.pickups,
    crowsShooed: d.crowsShooed,
    tapTests: d.tapTests,
  };
}

/** Where the play ended: where the ball lies dead, else where its carrier is, else the line. */
function endSpot(next: RunState, d: Draft): number {
  const ball = next.field.ball;
  if (ball.at === 'dead') return ball.pos.y;
  if (ball.at === 'carried') return spot(next, ball.by) ?? d.los;
  return d.los;
}

/** A body's record id: Jack for the QB, else the roster player in its slot. */
function who(state: RunState, body: number): number | null {
  const p = state.field.players.find((b) => b.id === body);
  if (!p) return null;
  return p.slot < 0 ? JACK : (state.roster[p.slot]?.id ?? null);
}

function spot(state: RunState, body: number): number | null {
  return state.field.players.find((b) => b.id === body)?.pos.y ?? null;
}

function reachedOf(state: RunState): RunRecord['reached'] {
  const { area, stretch } = state.series;
  // Kept as `index` and `seriesNumber` in saved records: the stretch, and its number (CONTEXT.md, Stretch number).
  return { area, index: stretch, seriesNumber: stretchNumber(state.series) };
}
