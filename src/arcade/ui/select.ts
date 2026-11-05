/**
 * Selecting a player before the snap (docs/SELECT.md): a tap on one of your
 * seven selects them, kept as their roster slot, which they keep through
 * calling a card and Flip (`lineUpTeam`). Their route lights up, the rest
 * dim, and their card shows. Drawing only: it never touches the sim.
 */
import type { RunState, Vec } from '../sim/types';
import type { SelectedCard } from '../../ui/hud';
import { fieldCard } from './trickOrTreat';

/** One of your seven where it stands on the screen (pixels), by roster slot. */
export interface ScreenPoint {
  readonly slot: number;
  readonly x: number;
  readonly y: number;
}

/** Your seven on the screen, through `project` (field yards → screen); never Jack or a defender. */
export function teamPoints(
  state: RunState,
  project: (pos: Vec) => { x: number; y: number },
): ScreenPoint[] {
  return state.field.players
    .filter((p) => p.slot >= 0)
    .map((p) => ({ slot: p.slot, ...project(p.pos) }));
}

/** The nearest of `points` to a tap, if within `reach`; otherwise null. */
export function slotAt(
  points: readonly ScreenPoint[],
  tap: { x: number; y: number },
  reach: number,
): number | null {
  let best: { slot: number; d: number } | null = null;
  for (const p of points) {
    const d = Math.hypot(p.x - tap.x, p.y - tap.y);
    if (d <= reach && (!best || d < best.d)) best = { slot: p.slot, d };
  }
  return best?.slot ?? null;
}

/** What a tap does: on a player, selects them (or clears it, if already selected); on nothing, clears it. */
export function tapSelect(current: number | null, hit: number | null): number | null {
  return hit === null || hit === current ? null : hit;
}

/** The selection as it stands now: only before the snap, and only a slot with a player in it. */
export function keptSelection(state: RunState, selected: number | null): number | null {
  if (selected === null || state.phase !== 'setup') return null;
  return state.roster[selected] ? selected : null;
}

/** How a player's route is drawn: as today with nobody selected; otherwise bright for theirs, dim for the rest. */
export function routeLook(slot: number, selected: number | null): 'plain' | 'bright' | 'dim' {
  if (selected === null) return 'plain';
  return slot === selected ? 'bright' : 'dim';
}

/** The selected player's card, or null. */
export function selectedCard(state: RunState, selected: number | null): SelectedCard | null {
  return selected === null ? null : fieldCard(state, selected);
}
