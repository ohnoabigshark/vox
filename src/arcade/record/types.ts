/**
 * The run's record (docs/STATS.md): what the game keeps of a run, read
 * from the sim's events. Plain data, saved as JSON, so a field added here
 * needs a format step in store.ts.
 */
import type { Play } from '../content/plays';
import type { DefenderKind, Form, Grade, PickupKind, Position, TipResult } from '../sim/types';

/** The saved format's version; store.ts brings older ones up to it. */
export const RECORD_FORMAT = 4;

/** Jack's id in the record: he throws every pass, and isn't on the roster (y2). */
export const JACK = 0;

/** What a play was, by what happened in it (p3). */
export type PlayKind = 'pass' | 'rush' | 'sack';

/** How a down ended: the sim's result, with a won Boss's series a touchdown. */
export type Outcome =
  'firstDown' | 'touchdown' | 'tackled' | 'incomplete' | 'batted' | 'sacked' | 'outOfBounds';

/** Break it!'s three, and the two catch tests. */
export type TapTestKind = 'bar' | 'mash' | 'juke' | 'snag' | 'tip';

/** One tap test (p2): which, for whom, its grade, and each tap's result (the catch tests only). */
export interface TapTestResult {
  readonly test: TapTestKind;
  readonly player: number;
  readonly grade: Grade;
  /** SNAG IT!'s dots hit or missed, the tip drill's pops; empty for Break it!. */
  readonly taps: readonly ('hit' | 'miss' | TipResult)[];
}

/** One down's result (p1). Players are record ids: JACK, or a roster player's id. */
export interface PlayResult {
  /** The situation: the stretch number (named before the long field, CONTEXT.md), the down, yards to go, the line. */
  readonly seriesNumber: number;
  readonly down: number;
  readonly toGo: number;
  readonly los: number;
  /** The call: the play's id (its copy is in the record's `plays`), and whether it was flipped. */
  readonly play: string | null;
  readonly flipped: boolean;
  readonly kind: PlayKind;
  readonly outcome: Outcome;
  /** Yards gained, as the game counted them. */
  readonly gained: number;
  readonly passer: number | null;
  readonly target: number | null;
  readonly catcher: number | null;
  /** Who had the ball last: the catcher, or the Runner on a rush. */
  readonly carrier: number | null;
  /**
   * Who tackled the carrier: the defender's kind (a defender is new each
   * down, so its kind is all there is to keep); null for anything else.
   */
  readonly tackledBy: DefenderKind | null;
  /** A completed pass: from the line to the catch, downfield only (p4)… */
  readonly airYards: number | null;
  /** …and from the catch to where the play ended. */
  readonly afterCatch: number | null;
  /** From where the carrier was first grabbed to where the play ended; null if never grabbed (p9). */
  readonly afterContact: number | null;
  /** A rush or a catch brought down behind the line (p10). */
  readonly tackleForLoss: boolean;
  /** Break it!s won: one per BREAK, however many it sent flying (d1). */
  readonly tacklesBroken: number;
  readonly drags: number;
  /** The Blockers who pancaked someone, once per pancake. */
  readonly pancakes: readonly number[];
  readonly fieldEvents: readonly string[];
  readonly pickups: readonly PickupKind[];
  readonly crowsShooed: number;
  readonly tapTests: readonly TapTestResult[];
}

/** A player as the run knew it (y1): a recruit's stats are its own. */
export interface RecordPlayer {
  readonly id: number;
  readonly name: string;
  readonly kind: Form | 'jack';
  readonly preferred: Position | null;
  /** The series number it joined before; 0 for the starting seven and Jack. */
  readonly joinedAt: number;
}

/** How a run ended: still going, Game Over, won, or never closed (the tab went away). */
export type RunEnd = 'open' | 'over' | 'won' | 'unfinished';

/** The modes a run was played in (c1). */
export interface RunModes {
  readonly hard: boolean;
  readonly twoTap: boolean;
  readonly snag: boolean;
  readonly tip: boolean;
}

/** Which of the all-time stats a run counts in: hard mode and normal are kept apart (c1). */
export type Mode = 'hard' | 'normal';
export const modeOf = (modes: RunModes): Mode => (modes.hard ? 'hard' : 'normal');

export interface RunRecord {
  readonly format: number;
  /** A random id (k4). */
  readonly id: string;
  /** The commit the game was built from. */
  readonly build: string;
  /** The link's query string, e.g. `snag=1&tip=1`. */
  readonly link: string;
  /**
   * The dev setup it was made with (docs/DEV_SETUP.md): the switches the
   * saved setup changed, as a link writes them, e.g. `hard=0&breakit=juke`;
   * '' for none. The link's switches win over these (map round 5, q3).
   */
  readonly setup: string;
  readonly modes: RunModes;
  readonly startedAt: string;
  endedAt: string | null;
  end: RunEnd;
  /** How far it got, the furthest: the area and the stretch in it (`index`, both from 0), and the stretch number. */
  reached: { area: number; index: number; seriesNumber: number };
  readonly team: RecordPlayer[];
  /** A copy of each play called, once a run, by id (p5). */
  readonly plays: Record<string, Play>;
  readonly downs: PlayResult[];
}
