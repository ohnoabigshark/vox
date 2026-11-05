/** The play pool (CONTEXT.md): every play that exists, esrauch's first, then ours. */
import { OUR_PLAYS } from './ourPlays';
import { PLAYS, type Play } from './plays';

export const PLAY_POOL: readonly Play[] = [...PLAYS, ...OUR_PLAYS];

/**
 * A run's playbook at the start (docs/REWARDS.md, o3): esrauch's five plus
 * the sketches put in the game. Every other play in the pool can be won at
 * TRICK OR TREAT!.
 */
export function startingPlaybook(sketches: readonly Play[] = []): readonly Play[] {
  return [...PLAYS, ...sketches];
}
