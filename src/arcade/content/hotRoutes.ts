/**
 * Hot routes (docs/PLAYER_MENU.md, CONTEXT.md): a route a player is given
 * for this down only, in place of the card's, by tapping Route on the
 * player's menu. Each tap moves them on round a loop: as drawn, Go, Slant,
 * Out, Post, Corner, Curl, then as drawn again, skipping a route that would
 * leave the field from where they stand (c1). Here are the six routes, which
 * way is out, who can take one and the loop; the sim keeps who has which
 * (`RunState.hotRoutes`) and lines them up with `withHotRoutes`.
 */
import type { Assignment, Play } from './plays';
import { offField, routePath, runsRoutes } from './playRules';
import { lineUpSpot, playSlot } from './team';

export type HotRoute = 'go' | 'slant' | 'out' | 'post' | 'corner' | 'curl';

/** The routes, in the loop's order after the card's own (c1). */
export const HOT_ROUTES: readonly HotRoute[] = ['go', 'slant', 'out', 'post', 'corner', 'curl'];

/** Who has which hot route this down, by roster slot (0-6); a player not in it runs the card's. */
export type HotRoutes = Partial<Record<number, HotRoute>>;

/** These hot routes with this roster slot's set to `route`, or taken away (null: back on the card's). */
export function hotRouteSet(hot: HotRoutes, slot: number, route: HotRoute | null): HotRoutes {
  const rest = Object.fromEntries(Object.entries(hot).filter(([k]) => Number(k) !== slot));
  return route ? { ...rest, [slot]: route } : rest;
}

/**
 * Each route's waypoints (b2), in yards from where the player stands, for a
 * player on the right: x is out, toward their own sideline, and y upfield.
 * Each keeps the rules every play keeps (`playProblems`): it ends going
 * upfield, the Curl's comeback at an angle (as plays.ts's curls do), and
 * stays within a throw's reach.
 */
const SHAPES: Readonly<Record<HotRoute, readonly (readonly [number, number])[]>> = {
  go: [[0, 16]],
  slant: [
    [0, 2],
    [-6, 12],
  ],
  out: [
    [0, 5],
    [5, 6],
    [5, 14],
  ],
  post: [
    [0, 8],
    [-5, 16],
  ],
  corner: [
    [0, 8],
    [5, 16],
  ],
  curl: [
    [0, 10],
    [-1.5, 8.5],
  ],
};

/**
 * The hot route as the play's assignment for play slot `k` (b3). Out is
 * toward the sideline on the side the play lines `k` up; a spot in the
 * middle counts as the right. In the play's own frame, so Flip mirrors it
 * with the rest of the play (`lineUpTeam`): a middle spot is then on the left.
 */
function assignment(play: Play, k: number, route: HotRoute): Assignment {
  const out = lineUpSpot(play, k).x < 0 ? -1 : 1;
  return { kind: 'route', to: SHAPES[route].map(([x, y]) => ({ x: x * out, y })) };
}

/**
 * The play as this down runs it: the card, with each hot route in its
 * player's place. A player's assignment is play slot `playSlot(slot,
 * flipped)` (Flip swaps mirror partners), so the hot route goes there.
 */
export function withHotRoutes(play: Play, hot: HotRoutes, flipped: boolean): Play {
  const slots = play.slots.map((a, k) => {
    const route = hot[playSlot(k, flipped)];
    return route ? assignment(play, k, route) : a;
  });
  return { ...play, slots };
}

/**
 * Whether this roster slot can take a hot route on this play (b1): anyone
 * who runs a route, so not a Blocker, and not the Runner who takes a
 * handoff, whose route is their way to the hole.
 */
export function takesHotRoute(play: Play, slot: number, flipped: boolean): boolean {
  const k = playSlot(slot, flipped);
  return runsRoutes(k) && play.handoff !== k;
}

/** The hot routes this roster slot can take on this play, in the loop's order: those that stay on the field from where they line up (c1). */
export function hotRoutesFor(play: Play, slot: number, flipped: boolean): HotRoute[] {
  if (!takesHotRoute(play, slot, flipped)) return [];
  const k = playSlot(slot, flipped);
  return HOT_ROUTES.filter(
    (route) => !offField(routePath(withHotRoutes(play, { [slot]: route }, flipped), k)),
  );
}

/** One tap of Route: the next in the loop after `current` (null, the card's own), skipping what doesn't fit; null after the last. */
export function nextHotRoute(
  play: Play,
  slot: number,
  flipped: boolean,
  current: HotRoute | null,
): HotRoute | null {
  const loop = [null, ...hotRoutesFor(play, slot, flipped)];
  const at = loop.indexOf(current);
  return loop[(at + 1) % loop.length] ?? null;
}
