/**
 * Plays drawn in the play editor and kept (dev/plays.html, Copy code;
 * docs/PLAY_EDITOR.md). They live apart from esrauch's `plays.ts` so pulling
 * his changes never collides with ours; `playPool.ts` joins the two.
 */
import type { Play } from './plays';

export const OUR_PLAYS: readonly Play[] = [];
