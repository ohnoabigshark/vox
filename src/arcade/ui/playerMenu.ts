/**
 * The player's menu (docs/PLAYER_MENU.md): the strip of buttons a selected
 * player gets before the snap, with the dev setup's Player menu switch on
 * (a3). Its slots are Route, Perk and Audible (a2), each greyed until it
 * works; in this slice none does, so the strip sends nothing to the game.
 */
import type { PlayerMenuView } from '../../ui/hud';

/**
 * The strip for this selection, or null when it doesn't show: the switch off,
 * or nobody selected (the selection is already null but before the snap,
 * `keptSelection`, so ✕, a tap elsewhere and HIKE! clear the strip too).
 */
export function playerMenu(on: boolean, selected: number | null): PlayerMenuView | null {
  if (!on || selected === null) return null;
  return {
    slots: [
      { name: 'Route', works: false },
      { name: 'Perk', works: false },
      { name: 'Audible', works: false },
    ],
  };
}
