/**
 * Selecting a player before the snap (docs/SELECT.md): a tap on one of your
 * seven selects them, kept as their roster slot, which they keep through
 * calling a card and Flip (`lineUpTeam`). Their route lights up and the
 * rest dim; their card is `fieldCard` (ui/trickOrTreat.ts). Drawing only:
 * it never touches the sim.
 */
import type { RunState, Vec } from '../sim/types';

/** How far a tap may land from a body and still be on it: about a thumb's width (CSS pixels; docs/SELECT.md, s1). */
export const TAP_REACH = 40;

/** A body on the field where it stands on the screen (pixels): one of your seven by roster slot, or Jack or a defender (no slot). */
export interface ScreenPoint {
  readonly slot: number | null;
  readonly x: number;
  readonly y: number;
}

/** Every body on the field on the screen, through `project` (field yards → screen). */
export function fieldPoints(
  state: RunState,
  project: (pos: Vec) => { x: number; y: number },
): ScreenPoint[] {
  const { players, defenders } = state.field;
  return [
    ...players.map((p) => ({ slot: p.slot >= 0 ? p.slot : null, ...project(p.pos) })),
    ...defenders.map((d) => ({ slot: null, ...project(d.pos) })),
  ];
}

/**
 * Who a tap is on: the nearest body within reach, and its roster slot. A tap
 * nearest Jack or a defender, or out of reach of every body, is on nobody
 * (null), so it clears the selection; it never reaches past them to one of
 * your seven.
 */
export function slotAt(
  points: readonly ScreenPoint[],
  tap: { x: number; y: number },
): number | null {
  let best: { slot: number | null; d: number } | null = null;
  for (const p of points) {
    const d = Math.hypot(p.x - tap.x, p.y - tap.y);
    if (d <= TAP_REACH && (!best || d < best.d)) best = { slot: p.slot, d };
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
