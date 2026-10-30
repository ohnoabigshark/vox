/**
 * The play editor's logic, with no screen (docs/PLAY_EDITOR.md): what each
 * tap and drag does to the play being drawn. Every function returns a new
 * state; the page (page.ts) only draws it and passes taps in.
 *
 * Field positions are yards from the line of scrimmage at the centre of the
 * field (x across, y upfield), as the game's are; a route's waypoints are
 * stored, as in plays.ts, in yards from where its slot lines up.
 */
import type { Play } from '../../arcade/content/plays';
import { playProblems, routePath, runsRoutes, takesHandoff } from '../../arcade/content/playRules';
import { LINEUP, ROSTER_ROLES, playSlot } from '../../arcade/content/team';

export interface Yards {
  readonly x: number;
  readonly y: number;
}

export interface EditorState {
  readonly play: Play;
  /** The roster slot being drawn, or null. Blockers can't be picked: they always block. */
  readonly selected: number | null;
  /** The picked waypoint of that slot's route, or null. */
  readonly point: number | null;
  /** The play before each change, latest last: Undo pops it. */
  readonly history: readonly Play[];
  /** Flip's preview: the play shown mirrored, as the game runs it flipped. Nothing can be edited meanwhile. */
  readonly flipped: boolean;
}

export function startEditing(play: Play): EditorState {
  return { play, selected: null, point: null, history: [], flipped: false };
}

/** The picked player's route and where it lines up, if a player is picked. */
function picked(s: EditorState): { slot: number; start: Yards; to: readonly Yards[] } | null {
  if (s.flipped) return null;
  const slot = s.selected;
  const start = slot === null ? undefined : LINEUP[slot];
  const a = slot === null ? undefined : s.play.slots[slot];
  if (slot === null || !start || a?.kind !== 'route') return null;
  return { slot, start, to: a.to };
}

/** The state with the picked player's route replaced, remembered for Undo. */
function withRoute(
  s: EditorState,
  slot: number,
  to: readonly Yards[],
  point: number | null,
): EditorState {
  const slots = s.play.slots.map((b, i) => (i === slot ? { kind: 'route' as const, to } : b));
  return { ...s, play: { ...s.play, slots }, point, history: [...s.history, s.play] };
}

/** Pick a player to draw its route. */
export function select(s: EditorState, slot: number): EditorState {
  if (!runsRoutes(slot)) return s;
  return { ...s, selected: slot, point: null };
}

/** Waypoints snap to the half yard (map item e10). */
const snap = (n: number): number => Math.round(n * 2) / 2;

/** Add a waypoint at this field position to the end of the picked player's route. */
export function addPoint(s: EditorState, at: Yards): EditorState {
  const p = picked(s);
  if (!p) return s;
  const to = [...p.to, { x: snap(at.x - p.start.x), y: snap(at.y - p.start.y) }];
  return withRoute(s, p.slot, to, to.length - 1);
}

/**
 * Move one of the picked player's waypoints to this field position. During a
 * drag, call it each time from the state where the drag began, so the whole
 * drag is one step for Undo.
 */
export function movePoint(s: EditorState, index: number, at: Yards): EditorState {
  const p = picked(s);
  if (!p || index < 0 || index >= p.to.length) return s;
  const moved = { x: snap(at.x - p.start.x), y: snap(at.y - p.start.y) };
  return withRoute(
    s,
    p.slot,
    p.to.map((w, i) => (i === index ? moved : w)),
    index,
  );
}

/** Pick one of the picked player's waypoints, for Remove. */
export function selectPoint(s: EditorState, index: number): EditorState {
  const p = picked(s);
  if (!p || index < 0 || index >= p.to.length) return s;
  return { ...s, point: index };
}

/** Take out the picked waypoint. */
export function removePoint(s: EditorState): EditorState {
  const p = picked(s);
  if (!p || s.point === null) return s;
  return withRoute(
    s,
    p.slot,
    p.to.filter((_, i) => i !== s.point),
    null,
  );
}

/** Step back one change. The name stays as it is: renaming isn't a step. */
export function undo(s: EditorState): EditorState {
  const before = s.history[s.history.length - 1];
  if (!before || s.flipped) return s;
  return {
    ...s,
    play: { ...before, name: s.play.name },
    point: null,
    history: s.history.slice(0, -1),
  };
}

/** Give the ball to this Runner at the snap, or to nobody (a pass play). */
export function setHandoff(s: EditorState, slot: number | null): EditorState {
  if (s.flipped || (slot !== null && !takesHandoff(slot))) return s;
  if ((s.play.handoff ?? null) === slot) return s;
  const base = { id: s.play.id, name: s.play.name, slots: s.play.slots };
  const play: Play = slot === null ? base : { ...base, handoff: slot };
  return { ...s, play, history: [...s.history, s.play] };
}

/** Rename the play. Not a step for Undo: every letter typed would be one. */
export function setName(s: EditorState, name: string): EditorState {
  return { ...s, play: { ...s.play, name } };
}

/** Turn Flip's mirrored preview on or off. */
export function toggleFlip(s: EditorState): EditorState {
  return { ...s, flipped: !s.flipped, point: null };
}

/** One player as the field shows it: where it lines up, then its route, all as field positions. */
export interface FieldRoute {
  readonly slot: number;
  /** A Blocker blocks; a route is run; the handoff Runner's route is where it carries the ball. */
  readonly kind: 'block' | 'route' | 'carry';
  readonly path: readonly Yards[];
  /** It breaks one of the play rules (playRules.ts). */
  readonly broken: boolean;
}

/**
 * Every player on the field, by roster slot. With Flip on, each runs its
 * mirror partner's assignment, mirrored, as the game lines it up
 * (sim/bodies.ts, lineUpTeam).
 */
export function fieldView(s: EditorState): FieldRoute[] {
  const broken = new Set(playProblems(s.play).map((p) => p.slot));
  return ROSTER_ROLES.map((_, slot): FieldRoute => {
    const k = playSlot(slot, s.flipped);
    const a = s.play.slots[k] ?? { kind: 'block' };
    const path = routePath(s.play, k, s.flipped);
    const kind = a.kind !== 'route' ? 'block' : s.play.handoff === k ? 'carry' : 'route';
    return { slot, kind, path, broken: broken.has(k) };
  });
}
