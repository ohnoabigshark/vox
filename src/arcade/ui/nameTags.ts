/**
 * Names on the field (docs/REWARDS.md, playtest notes p6): which of your
 * players get a name tag under them, and where.
 */
import type { RunState, Vec } from '../sim/types';

/** One name tag: the player's body id, its full name, and where its feet are (field yards). */
export interface NameTag {
  readonly id: number;
  readonly name: string;
  readonly at: Vec;
}

/** The name tags to draw now: your seven in slot order, while a play is being picked (until HIKE!, as the routes). */
export function nameTags(state: RunState): NameTag[] {
  if (state.phase !== 'setup') return [];
  return state.field.players
    .filter((p) => p.slot >= 0)
    .sort((a, b) => a.slot - b.slot)
    .flatMap((p) => {
      const name = state.roster[p.slot]?.name;
      return name === undefined ? [] : [{ id: p.id, name, at: p.pos }];
    });
}
