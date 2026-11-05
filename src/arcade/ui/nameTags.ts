/**
 * Names on the field (docs/REWARDS.md, playtest notes p6; docs/SELECT.md):
 * which of your players get a name tag under them, and where. The Aa switch
 * shows or hides them all; a selected player's always shows, marked.
 */
import type { RunState, Vec } from '../sim/types';

/** One name tag: the player's body id, its full name, and where its feet are (field yards). */
export interface NameTag {
  readonly id: number;
  readonly name: string;
  readonly at: Vec;
  /** The selected player's: drawn at the front, bigger. */
  readonly selected: boolean;
}

/** What decides which names show: the Aa switch, and the selected roster slot (or null). */
export interface NameShow {
  readonly names: boolean;
  readonly selected: number | null;
}

/** The name tags to draw now: your seven in slot order, while a play is being picked (until HIKE!, as the routes). */
export function nameTags(state: RunState, show: NameShow): NameTag[] {
  if (state.phase !== 'setup') return [];
  return state.field.players
    .filter((p) => p.slot >= 0 && (show.names || p.slot === show.selected))
    .sort((a, b) => a.slot - b.slot)
    .flatMap((p) => {
      const name = state.roster[p.slot]?.name;
      if (name === undefined) return [];
      return [{ id: p.id, name, at: p.pos, selected: p.slot === show.selected }];
    });
}
