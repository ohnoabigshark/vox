/**
 * Your team (GAMEPLAY.md, Your Team): the QB plus seven players in three
 * roles, where they line up, their base stats, and the monster forms.
 */
import type { Play } from './plays';
import type { Form, Position, Role, Stats } from '../sim/types';

/** The seven players, in roster order: 2 Blockers, 2 Runners, 3 Catchers. */
export const ROSTER_ROLES: readonly Role[] = [
  'blocker',
  'blocker',
  'runner',
  'runner',
  'catcher',
  'catcher',
  'catcher',
];

/** Each slot's short name, in roster order: the play editor's chips and its messages. */
export const SLOT_NAMES: readonly string[] = ['B1', 'B2', 'R1', 'R2', 'C1', 'C2', 'C3'];

/** The standard line-up: where each roster slot lines up, relative to the line of scrimmage (x across, y upfield). */
export const LINEUP: readonly { readonly x: number; readonly y: number }[] = [
  { x: -0.9, y: -0.7 },
  { x: 0.9, y: -0.7 },
  { x: -1.1, y: -4.5 },
  { x: 1.1, y: -4.5 },
  { x: -7, y: -0.7 },
  { x: 7, y: -0.7 },
  { x: 4.2, y: -1.2 },
];

/** Where a roster slot lines up for this play: the play's own line-up, or the standard one. */
export function lineUpSpot(play: Pick<Play, 'lineup'>, slot: number): { x: number; y: number } {
  return play.lineup?.[slot] ?? LINEUP[slot] ?? { x: 0, y: 0 };
}

/**
 * Flip mirrors the play, and mirror partners (the two Blockers, the two
 * Runners, the two outside Catchers) swap assignments, so the roster still
 * lines up left to right: on a flipped play, roster slot `slot` runs the
 * play's assignment for this slot (and the other way round).
 */
const PARTNER: readonly number[] = [1, 0, 3, 2, 5, 4, 6];
export function playSlot(slot: number, flipped: boolean): number {
  return flipped ? (PARTNER[slot] ?? slot) : slot;
}

/** The QB lines up this far behind the line of scrimmage. */
export const QB_DEPTH = 4;

/**
 * A plain human's stats, whatever position it plays: 50 is ordinary and
 * every 10 points is one step (tuning.body), so there's room to tune small
 * bonuses. Only kinds (FORM_STATS) and perks move them.
 */
export const BASE_STATS: Stats = { hustle: 50, hands: 50, heft: 50 };

/** Body size by role (yards). */
export const ROLE_RADIUS: Readonly<Record<Role, number>> = {
  qb: 0.5,
  blocker: 0.6,
  runner: 0.45,
  catcher: 0.45,
};

/** A Golem is built wide (render/bodies.ts, GOLEM_SHAPE): its body is at least this big, whatever its position. */
export const GOLEM_RADIUS = 0.6;

/** One notch up (++) or down (--) in a kind's build: a big enough swing to read, and to tune. */
const UP = 20;
const DOWN = -20;

/**
 * What each form adds to a player's stats. Every kind is a trade: one stat
 * up, one down, one left alone, so no kind is simply better (GAMEPLAY.md,
 * Your Team). A new kind should follow the same rule. Humans are all-rounders.
 */
export const FORM_STATS: Readonly<Record<Form, Stats>> = {
  human: { hustle: 0, hands: 0, heft: 0 },
  ghost: { hustle: 0, hands: UP, heft: DOWN },
  golem: { hustle: DOWN, hands: 0, heft: UP },
  werewolf: { hustle: UP, hands: DOWN, heft: 0 },
};

/** The stat each position leans on; a player prefers the position its best stat suits. */
export const POSITION_STAT: Readonly<Record<Position, keyof Stats>> = {
  blocker: 'heft',
  runner: 'hustle',
  catcher: 'hands',
};
