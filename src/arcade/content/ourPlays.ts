/**
 * Plays drawn in the play editor and kept (dev/plays.html, Copy code;
 * docs/PLAY_EDITOR.md). They live apart from esrauch's `plays.ts` so pulling
 * his changes never collides with ours; `playPool.ts` joins the two.
 */
import type { Assignment, Play } from './plays';

// The same two helpers as plays.ts, which keeps its own private: Copy code
// writes plays with them, and his file stays untouched (docs/PLAY_EDITOR.md).
const block: Assignment = { kind: 'block' };
const route = (...to: [number, number][]): Assignment => ({
  kind: 'route',
  to: to.map(([x, y]) => ({ x, y })),
});

/** The in-game sketches kept for the first release (release mode's map, s1-s3), 2026-10-31. */
export const OUR_PLAYS: readonly Play[] = [
  {
    id: 'crazy',
    name: 'Crazy',
    slots: [
      block,
      block,
      route([0.5, 17]),
      route([1.5, 3], [3.5, 8], [6, 10], [7.5, 9]),
      route([2.5, 8.5], [12.5, 13], [12.5, 16]),
      route([-4, 5.5], [1.5, 11.5]),
      route([-1.5, 4], [-5, 5.5], [-11.5, 6.5], [-12.5, 3]),
    ],
  },
  {
    id: 'emptySet',
    name: 'Empty Set',
    slots: [
      block,
      block,
      route([1, 7], [11, 8], [13, 14.5]),
      route([1, 8], [-6.5, 10], [-8, 15.5]),
      route([-0.5, 5.5], [0, 26]),
      route([-0.5, 26]),
      route([1.5, 5.5], [-2.5, 5.5], [-4, 4]),
    ],
    lineup: [
      { x: -0.9, y: -0.7 },
      { x: 0.9, y: -0.7 },
      { x: -5.5, y: -3 },
      { x: 4, y: -1 },
      { x: -7, y: -0.7 },
      { x: 7, y: -0.7 },
      { x: 5.5, y: -2.5 },
    ],
  },
  {
    id: 'clearOut',
    name: 'Clear Out',
    slots: [
      block,
      block,
      route([-0.5, 4.5], [-4, 7], [-4, 13]),
      route([-3, 5], [2.5, 11.5]),
      route([14, 14], [15.5, 16.5]),
      route([1, 7], [-6, 9.5], [-7.5, 11.5]),
      route([-10.5, 15.5]),
    ],
    handoff: 3,
    lineup: [
      { x: -0.9, y: -0.7 },
      { x: 0.9, y: -0.7 },
      { x: -3, y: -2.5 },
      { x: 2.5, y: -2.5 },
      { x: -7, y: -0.7 },
      { x: 7, y: -0.7 },
      { x: 6, y: -2.5 },
    ],
  },
  {
    id: 'clearOutPass',
    name: 'Clear Out Pass',
    slots: [
      block,
      block,
      route([0, 4], [2.5, 6], [3.5, 8]),
      route([1, 8]),
      route([11, 14.5]),
      route([0.5, 8.5], [-8.5, 9.5], [-9, 12.5]),
      route([-13.5, 14]),
    ],
    lineup: [
      { x: -0.9, y: -0.7 },
      { x: 0.9, y: -0.7 },
      { x: -4, y: -3 },
      { x: 2.5, y: -3.5 },
      { x: -7, y: -0.7 },
      { x: 7, y: -0.7 },
      { x: 6, y: -2.5 },
    ],
  },
  {
    id: 'juke',
    name: 'Juke',
    slots: [
      block,
      block,
      route([0, 17]),
      route([5, 1.5], [4.5, 7], [1, 11.5]),
      route([0, 5.5], [1, 4.5], [1, 24]),
      route([0, 10.5], [-2, 8]),
      route([-3.5, 3], [0, 5.5], [3.5, 10]),
    ],
    lineup: [
      { x: -0.9, y: -0.7 },
      { x: 0.9, y: -0.7 },
      { x: -3.5, y: -1.5 },
      { x: 1.1, y: -4.5 },
      { x: -7, y: -0.7 },
      { x: 7, y: -0.7 },
      { x: 4.2, y: -1.2 },
    ],
  },
  {
    id: 'flipper',
    name: 'Flipper',
    slots: [
      block,
      block,
      route([3, 0.5], [3.5, 10], [1.5, 7.5]),
      route([5, 2], [5.5, 9.5]),
      route([0.5, 24]),
      route([0, 7], [1.5, 6.5], [8, 14.5]),
      route([2.5, -1.5], [3.5, 6]),
    ],
    lineup: [
      { x: -0.9, y: -0.7 },
      { x: 0.9, y: -0.7 },
      { x: 1, y: -3 },
      { x: 1, y: -5.5 },
      { x: -8.5, y: -0.5 },
      { x: -4, y: -0.5 },
      { x: -6, y: -1.5 },
    ],
  },
];
