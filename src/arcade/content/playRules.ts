/**
 * The rules a play has to keep (GAMEPLAY.md, A Down): every route finishes
 * going upfield, except a curl's angled comeback; every Runner gets out past
 * the line of scrimmage; and no route goes deeper than a throw can reach, or
 * off the field. The tests hold every play in the pool to them, and the play
 * editor shows them as you draw (docs/PLAY_EDITOR.md).
 */
import type { Play } from './plays';
import { LINEUP, ROSTER_ROLES, SLOT_NAMES } from './team';
import { arcadeTuning } from './tuning';

export type PlayRule = 'ends' | 'pastLine' | 'inRange';

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
    const start = LINEUP[slot];
    const role = ROSTER_ROLES[slot];
    if (!start || role === 'blocker') return;
    const name = SLOT_NAMES[slot] ?? `Slot ${slot}`;
    if (a.kind !== 'route') {
      problems.push({
        slot,
        rule: 'pastLine',
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
    const path = [start, ...a.to.map((w) => ({ x: start.x + w.x, y: start.y + w.y }))];
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
    if (role === 'runner' && Math.max(...path.map((p) => p.y)) <= 1) {
      problems.push({
        slot,
        rule: 'pastLine',
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
  return problems;
}
