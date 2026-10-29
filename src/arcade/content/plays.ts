/**
 * The plays (GAMEPLAY.md, A Down). Each down three are dealt as cards and you
 * call one (Flip mirrors them). A route is waypoints relative to the player's start
 * (yards: x across, y upfield); `block` stays home and blocks (only the
 * Blockers do). Every Runner gets out past the line of scrimmage; every route
 * finishes going upfield, except a curl's angled comeback (the curl is where
 * it stops); and none goes deeper than a throw can reach
 * (`playRules.ts`). A `handoff` play gives one Runner the ball at
 * the snap: calling that card is choosing to run.
 */
export type Assignment =
  | { readonly kind: 'route'; readonly to: readonly { readonly x: number; readonly y: number }[] }
  | { readonly kind: 'block' };

export interface Play {
  readonly id: string;
  readonly name: string;
  /** One assignment per roster slot (2 Blockers, 2 Runners, 3 Catchers). Blockers always block. */
  readonly slots: readonly Assignment[];
  /** A handoff play: this roster slot gets the ball at the snap, heading for its route's hole. */
  readonly handoff?: number;
}

const block: Assignment = { kind: 'block' };
const route = (...to: [number, number][]): Assignment => ({
  kind: 'route',
  to: to.map(([x, y]) => ({ x, y })),
});

export const PLAYS: readonly Play[] = [
  {
    id: 'slants',
    name: 'Slants',
    // The outside Catchers cut inside, then straight upfield; the slot goes deep;
    // one Runner checks down up the middle, the other leaks out to the flat and
    // turns upfield along the sideline.
    slots: [
      block,
      block,
      route([-1.5, 3], [-1.5, 9]),
      route([2.8, 1], [6.3, 2], [6.3, 12]),
      route([0, 3], [4.2, 9], [4.2, 16]),
      route([0, 3], [-4.2, 9], [-4.2, 16]),
      route([0, 18]),
    ],
  },
  {
    id: 'deepShot',
    name: 'Deep Shot',
    // All three Catchers go long; the Runners slip out past the line as check-downs.
    slots: [
      block,
      block,
      route([-2.5, 3], [-2.5, 8]),
      route([2.5, 3], [2.5, 8]),
      route([0, 24]),
      route([0, 24]),
      route([-1.4, 20]),
    ],
  },
  {
    id: 'curlFlat',
    name: 'Curl & Flat',
    // The Catchers run out and curl back at an angle, toward the middle (the
    // curl is where they stop); the Runners swing out to the flats, then turn upfield.
    slots: [
      block,
      block,
      route([-3.5, 1], [-6.3, 2], [-6.3, 12]),
      route([3.5, 1], [6.3, 2], [6.3, 12]),
      route([0, 7], [1.5, 5.5]),
      route([0, 7], [-1.5, 5.5]),
      route([0, 6], [-1.5, 4.5]),
    ],
  },
  {
    id: 'dive',
    name: 'Dive',
    handoff: 2,
    // Built for a handoff: a Runner charges up the middle with the other leading
    // through the hole ahead of it; the Catchers run off.
    slots: [
      block,
      block,
      route([0, 3], [0, 12]),
      route([-0.6, 3], [-0.6, 12]),
      route([0, 16]),
      route([0, 16]),
      route([0, 14]),
    ],
  },
  {
    id: 'sweep',
    name: 'Sweep',
    // A handoff wide: a Runner takes it out toward the sideline and turns upfield behind the
    // other Runner; the Catchers run short routes as decoys (on a handoff they don't block).
    handoff: 2,
    slots: [
      block,
      block,
      route([-5, 1.5], [-5.5, 12]),
      route([-4.5, 3], [-5, 12]),
      route([0.5, 4], [0.5, 8]),
      route([-1, 4], [-1, 8]),
      route([-1.5, 4], [-2, 8]),
    ],
  },
];
