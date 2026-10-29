/** The play pool (CONTEXT.md): every play that exists, esrauch's first, then ours. */
import { OUR_PLAYS } from './ourPlays';
import { PLAYS, type Play } from './plays';

export const PLAY_POOL: readonly Play[] = [...PLAYS, ...OUR_PLAYS];
