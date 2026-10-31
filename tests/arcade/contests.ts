/**
 * Contested balls for the catch tests' tests (docs/SNAG.md, docs/TIP.md):
 * a bullet or a lob that one of your players and a defender both get to.
 * From drive 5 a contested ball picks SNAG IT! or the tip drill at random;
 * `force` picks one, as ?snag=1 or ?tip=1 does.
 */
import { v } from '../../src/arcade/sim/vec';
import type { RunState } from '../../src/arcade/sim/types';
import { playState, run, stand, throwAt } from './helpers';

export type Force = 'snag' | 'tip';

/** Put a down on the given drive of the run (1-based: drive 5 is the Candy Queendom's first). */
export function onDrive(state: RunState, drive: number): RunState {
  const area = Math.floor((drive - 1) / 4);
  state.drive = { ...state.drive, area, index: (drive - 1) % 4 };
  return state;
}

/** Turn on ?snag=1 or ?tip=1 for this run. */
export function forced(state: RunState, force: Force | undefined): RunState {
  if (force === 'snag') Object.assign(state, { snagAlways: true });
  if (force === 'tip') Object.assign(state, { tipAlways: true });
  return state;
}

/**
 * A bullet to (4, 6) with a Catcher half a yard to the right of its line, and
 * Covers placed (from their reach) so each gets a hand to it at the same
 * moment as the Catcher: a contested ball. `along` puts a Cover that far
 * further up the line (yards), still reaching it at that moment. With more
 * Hands on the Cover, today's rule gives it the ball.
 */
export function bulletContest(
  drive: number,
  catcherHands = 60,
  covers: readonly { hands: number; along?: number }[] = [{ hands: 60 }],
  force?: Force,
): RunState {
  const dir = v(0.371, 0.928);
  const right = v(0.928, -0.371);
  const s = playState(
    [{ pos: v(4 + right.x * 0.5, 6 + right.y * 0.5), stats: { hands: catcherHands } }],
    covers.map((c) => ({ kind: 'cover' as const, pos: v(0, 30), stats: { hands: c.hands } })),
  );
  const catcher = s.field.players[1]!;
  catcher.job = stand(catcher.pos);
  // How far short of (4, 6), along the line, the ball comes into the Catcher's reach.
  const entry = Math.sqrt(catcher.reach ** 2 - 0.25);
  covers.forEach((c, i) => {
    const d = s.field.defenders[i]!;
    const along = c.along ?? 0;
    const off = Math.sqrt(d.reach ** 2 - (entry + along) ** 2);
    d.pos = v(4 + dir.x * along - right.x * off, 6 + dir.y * along - right.y * off);
  });
  forced(onDrive(s, drive), force);
  return run(s, 2, throwAt(s, v(4, 6))).state;
}

/** A lob coming down at (0.4, 10) between a Catcher and a Cover at x `cover` (the nearer wins today). */
export function lobContest(drive: number, force?: Force, cover = -0.2): RunState {
  const s = playState(
    [{ pos: v(2.2, 10), job: stand(v(2.2, 10)) }],
    [{ kind: 'cover', pos: v(cover, 10) }],
  );
  forced(onDrive(s, drive), force);
  s.field.ball = {
    at: 'flight',
    from: v(0, -4),
    target: v(0.4, 10),
    thrownAt: s.time,
    landsAt: s.time + 0.5,
    lob: true,
  };
  return run(s, 1).state;
}
