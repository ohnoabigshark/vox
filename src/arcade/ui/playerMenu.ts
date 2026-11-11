/**
 * The player's menu (docs/PLAYER_MENU.md): the strip of buttons a selected
 * player gets before the snap, in every run. Its slots are Route, Perk and
 * Audible (a2), each greyed until it works: Route gives the player a hot
 * route (`routeWorks`, sim/run.ts); Perk and Audible are planned later.
 */
import { routeWorks } from '../sim/run';
import type { RunState } from '../sim/types';
import type { PlayerMenuView } from '../../ui/hud';

/**
 * The strip for this selection, or null with nobody selected. The game
 * passes the selection as it shows (`selectionNow`, null but before the
 * snap, `beforeSnap`), so HIKE!, the intro, the outro and a pause hide the
 * strip, and ✕ or a tap elsewhere (`selectionAfter`) clear it with the card.
 */
export function playerMenu(state: RunState, selected: number | null): PlayerMenuView | null {
  if (selected === null) return null;
  return {
    slots: [
      { slot: 'route', works: routeWorks(state, selected) },
      { slot: 'perk', works: false },
      { slot: 'audible', works: false },
    ],
  };
}
