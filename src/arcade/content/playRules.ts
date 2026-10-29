/**
 * The rules a play has to keep (GAMEPLAY.md, A Down): every route finishes
 * going upfield, except a curl's angled comeback (`ends`); Blockers block,
 * everyone else runs a route, every Runner gets out past the line of
 * scrimmage, and only a Runner takes a handoff (`roles`); and no route goes
 * deeper than a throw can reach, or off the field (`inRange`). The tests hold every play in the pool to them, and the play
 * editor shows them as you draw (docs/PLAY_EDITOR.md).
 */
import type { Assignment, Play } from './plays';
import { LINEUP, ROSTER_ROLES, SLOT_NAMES } from './team';
import { arcadeTuning } from './tuning';

export type PlayRule = 'ends' | 'roles' | 'inRange';

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
 * scrimmage: where it lines up, then each waypoint. Mirrored across the
 * field when `flipped` (sim/bodies.ts, lineUpTeam, lines the flipped play up
 * the same way).
 */
export function routePath(
  slot: number,
  a: Assignment,
  flipped = false,
): { x: number; y: number }[] {
  const mirror = flipped ? -1 : 1;
  const spot = LINEUP[slot] ?? { x: 0, y: 0 };
  const start = { x: spot.x * mirror, y: spot.y };
  if (a.kind !== 'route') return [start];
  return [start, ...a.to.map((w) => ({ x: start.x + w.x * mirror, y: start.y + w.y }))];
}

/** One broken rule: the roster slot whose assignment breaks it, and how to fix it. */
export interface PlayProblem {
  readonly slot: number;
  readonly rule: PlayRule;
  readonly message: string;
}

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
    const path = routePath(slot, a);
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
  // In slot order, the handoff's problem with the rest of its slot's.
  return problems.sort((a, b) => a.slot - b.slot);
}
