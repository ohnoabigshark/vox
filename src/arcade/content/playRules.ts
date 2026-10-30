/**
 * The rules a play has to keep (GAMEPLAY.md, A Down): every route finishes
 * going upfield, except a curl's angled comeback (`ends`); Blockers block,
 * everyone else runs a route, every Runner gets out past the line of
 * scrimmage, and only a Runner takes a handoff (`roles`); no route goes
 * deeper than a throw can reach, or off the field (`inRange`); and players
 * line up behind the line, apart, Blockers where they always stand
 * (`lineUp`). The tests hold every play in the pool to them, and the play
 * editor shows them as you draw (docs/PLAY_EDITOR.md).
 */
import type { Play } from './plays';
import { QB_DEPTH, ROSTER_ROLES, SLOT_NAMES, lineUpSpot, isStandardSpot } from './team';
import { arcadeTuning } from './tuning';

export type PlayRule = 'ends' | 'roles' | 'inRange' | 'lineUp';

/** Whether this roster slot runs routes: everyone but the Blockers, who always block. */
export function runsRoutes(slot: number): boolean {
  const role = ROSTER_ROLES[slot];
  return role !== undefined && role !== 'blocker';
}

/** Whether this roster slot can take a handoff: only a Runner. */
export function takesHandoff(slot: number): boolean {
  return ROSTER_ROLES[slot] === 'runner';
}

/**
 * Where a slot's assignment goes on the field, in yards from the line of
 * scrimmage: where the play lines it up, then each waypoint. Mirrored across
 * the field when `flipped` (sim/bodies.ts, lineUpTeam, lines the flipped
 * play up the same way).
 */
export function routePath(play: Play, slot: number, flipped = false): { x: number; y: number }[] {
  const mirror = flipped ? -1 : 1;
  const spot = lineUpSpot(play, slot);
  const start = { x: spot.x * mirror, y: spot.y };
  const a = play.slots[slot];
  if (a?.kind !== 'route') return [start];
  return [start, ...a.to.map((w) => ({ x: start.x + w.x * mirror, y: start.y + w.y }))];
}

/** One broken rule: the roster slot whose assignment breaks it, and how to fix it. */
export interface PlayProblem {
  readonly slot: number;
  /** The other player of a crowded pair (the line-up rule), which the editor shows red too. */
  readonly other?: number;
  readonly rule: PlayRule;
  readonly message: string;
}

/**
 * Where a player may line up (map item l5): at least this far behind the
 * line, no farther back than this (the bottom of the editor's field), and
 * this far from anyone else, Jack included. The editor's drag stops at the
 * first two and at the sidelines.
 */
export const NEAREST_LINE = 0.5;
export const FARTHEST_BACK = 6;
export const APART = 1;
/** A hair, so a spot exactly at a limit isn't lost to rounding (1.9 - 0.9 is 0.9999…). */
/** A distance as a message says it: "half a yard", "a yard", "6 yards". */
const yards = (n: number): string =>
  n === 0.5 ? 'half a yard' : n === 1 ? 'a yard' : `${n} yards`;
const HAIR = 1e-9;

/** How deep a route may go: a little short of the longest throw, so it can still be reached. */
export const DEEPEST = arcadeTuning.throw.maxAhead - 2;

/** Every rule this play breaks, in slot order; none for a legal play. */
export function playProblems(play: Play): PlayProblem[] {
  const problems: PlayProblem[] = [];
  play.slots.forEach((a, slot) => {
    const name = SLOT_NAMES[slot] ?? `Slot ${slot}`;
    if (!runsRoutes(slot)) {
      if (a.kind === 'route') {
        problems.push({
          slot,
          rule: 'roles',
          message: `${name} has a route. Blockers always block.`,
        });
      }
      return;
    }
    if (a.kind !== 'route') {
      problems.push({
        slot,
        rule: 'roles',
        message: `${name} is blocking. Only Blockers block: give it a route.`,
      });
      return;
    }
    if (a.to.length === 0) {
      problems.push({
        slot,
        rule: 'ends',
        message: `${name} has no route yet. Tap the field to add a point.`,
      });
      return;
    }
    const path = routePath(play, slot);
    const end = path[path.length - 1];
    const before = path[path.length - 2];
    if (!end || !before) return;
    const dy = end.y - before.y;
    const dx = end.x - before.x;
    if (dy < 0 && Math.abs(dx) < 1) {
      problems.push({
        slot,
        rule: 'ends',
        message: `${name}'s route comes straight back. Curl it back at an angle of at least a yard.`,
      });
    } else if (dy >= 0 && dy <= Math.abs(dx)) {
      problems.push({
        slot,
        rule: 'ends',
        message: `${name}'s route ends going sideways. End it going upfield, or curl it back at an angle.`,
      });
    }
    if (ROSTER_ROLES[slot] === 'runner' && Math.max(...path.map((p) => p.y)) <= 1) {
      problems.push({
        slot,
        rule: 'roles',
        message: `${name} doesn't get past the line. Take its route more than a yard past the line of scrimmage.`,
      });
    }
    if (path.some((p) => p.y > DEEPEST)) {
      problems.push({
        slot,
        rule: 'inRange',
        message: `${name}'s route goes past a throw's reach. Keep it within ${DEEPEST} yards of the line.`,
      });
    }
    if (path.some((p) => Math.abs(p.x) > arcadeTuning.field.halfWidth)) {
      problems.push({
        slot,
        rule: 'inRange',
        message: `${name}'s route goes off the field. Keep it inside the sidelines.`,
      });
    }
  });
  if (play.handoff !== undefined && !takesHandoff(play.handoff)) {
    const name = SLOT_NAMES[play.handoff] ?? `Slot ${play.handoff}`;
    problems.push({
      slot: play.handoff,
      rule: 'roles',
      message: `${name} takes the handoff. Only a Runner can take a handoff.`,
    });
  }
  problems.push(...lineUpProblems(play));
  // In slot order, the handoff's and line-up's problems with the rest of their slot's.
  return problems.sort((a, b) => a.slot - b.slot);
}

/**
 * The line-up rule (l1, l5): Blockers stand where they always do; everyone
 * else lines up behind the line, inside the sidelines, no deeper than
 * FARTHEST_BACK and APART from the rest. A crowded pair is told on its later
 * slot, so a Blocker is never told.
 */
function lineUpProblems(play: Play): PlayProblem[] {
  const problems: PlayProblem[] = [];
  const spots = ROSTER_ROLES.map((_, slot) => lineUpSpot(play, slot));
  const jack = { x: 0, y: -QB_DEPTH };
  const apart = (a: { x: number; y: number }, b: { x: number; y: number }): boolean =>
    Math.hypot(a.x - b.x, a.y - b.y) >= APART - HAIR;
  spots.forEach((spot, slot) => {
    const name = SLOT_NAMES[slot] ?? `Slot ${slot}`;
    const tell = (message: string, other?: number): void => {
      problems.push({ slot, ...(other === undefined ? {} : { other }), rule: 'lineUp', message });
    };
    if (!runsRoutes(slot)) {
      if (!isStandardSpot(slot, spot))
        tell(`${name} has moved. Blockers line up where they always do.`);
      return;
    }
    if (spot.y > -NEAREST_LINE) {
      tell(
        `${name} lines up too close to the line. Line up at least ${yards(NEAREST_LINE)} behind it.`,
      );
    } else if (spot.y < -FARTHEST_BACK) {
      tell(
        `${name} lines up too deep. Line up no more than ${yards(FARTHEST_BACK)} behind the line.`,
      );
    }
    if (Math.abs(spot.x) > arcadeTuning.field.halfWidth) {
      tell(`${name} lines up off the field. Line up inside the sidelines.`);
    }
    if (!apart(spot, jack))
      tell(`${name} lines up on top of Jack. Keep players ${yards(APART)} from Jack.`);
    const crowded = spots.slice(0, slot).findIndex((other) => !apart(spot, other));
    if (crowded >= 0) {
      tell(
        `${name} lines up on top of ${SLOT_NAMES[crowded] ?? `Slot ${crowded}`}. Keep players ${yards(APART)} apart.`,
        crowded,
      );
    }
  });
  return problems;
}
