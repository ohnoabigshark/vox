import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ArcadeRoutes } from '../../src/arcade/render/routes';
import { createRun, dispatch } from '../../src/arcade/sim/run';
import type { Player, RunState } from '../../src/arcade/sim/types';

/**
 * The routes as drawn (docs/SELECT.md, test 5, review x11): with a player
 * selected, their route bright and in the big dots, every other one dimmed;
 * a Blocker (no route) dims them all; on a handoff the ring dims with its
 * route. Three.js objects only, so no screen is needed.
 */

interface Drawn {
  readonly dim: boolean;
  readonly big: boolean;
  readonly ring: boolean;
}

/** Draws `players`' routes with `selected`, and says of each piece whether it's dimmed, big, or the ring. */
function draw(state: RunState, players: readonly Player[], selected: number | null): Drawn[] {
  const scene = new THREE.Scene();
  new ArcadeRoutes(scene).update(state, 0, players, selected);
  const group = scene.children[0]!;
  return group.children.map((child) => {
    const mesh = child as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
    const geo = mesh.geometry as THREE.BufferGeometry & { parameters: Record<string, number> };
    return {
      // Every route's usual opacity is 0.8 or more; dimmed, under 0.3.
      dim: mesh.material.opacity < 0.5,
      // Big: the ring, the big dots (0.16 across, not 0.09) and the big arrow (0.42, not 0.28).
      big:
        geo.type === 'RingGeometry' ||
        (geo.type === 'CircleGeometry' && geo.parameters.radius! > 0.15) ||
        (geo.type === 'ConeGeometry' && geo.parameters.radius! > 0.35),
      ring: geo.type === 'RingGeometry',
    };
  });
}

/** A run before the snap with a play called: a pass play, or a handoff. */
function calledPlay(handoff: boolean): RunState {
  for (let seed = 1; seed < 200; seed++) {
    const run = createRun(seed);
    const hand = run.hand.findIndex((i) => (run.playbook[i]?.handoff !== undefined) === handoff);
    if (hand >= 0) return dispatch(run, { type: 'call', hand }).state;
  }
  throw new Error(`No run deals a ${handoff ? 'handoff' : 'pass play'}`);
}

const withRoute = (s: RunState, role: Player['role']) =>
  s.field.players.find((p) => p.role === role && p.job.kind === 'route')!;

describe('routes as drawn', () => {
  it('nobody selected: nothing dimmed, and on a pass play nothing big', () => {
    const s = calledPlay(false);
    const drawn = draw(s, s.field.players, null);
    expect(drawn.length).toBeGreaterThan(0);
    expect(drawn.filter((d) => d.dim)).toEqual([]);
    expect(drawn.filter((d) => d.big)).toEqual([]);
  });

  it('a Catcher selected: their route, and only theirs, bright and in the big dots; the rest dimmed', () => {
    const s = calledPlay(false);
    const catcher = withRoute(s, 'catcher');
    const theirs = draw(s, [catcher], null).length;
    const drawn = draw(s, s.field.players, catcher.slot);
    const bright = drawn.filter((d) => !d.dim);
    expect(bright).toHaveLength(theirs);
    expect(bright.every((d) => d.big)).toBe(true);
    expect(drawn.length).toBe(draw(s, s.field.players, null).length);
    expect(drawn.filter((d) => d.dim).every((d) => !d.big)).toBe(true);
  });

  it('a Blocker selected: every route dimmed', () => {
    const s = calledPlay(false);
    const blocker = s.field.players.find((p) => p.role === 'blocker')!;
    const drawn = draw(s, s.field.players, blocker.slot);
    expect(drawn.length).toBeGreaterThan(0);
    expect(drawn.every((d) => d.dim)).toBe(true);
  });

  it('on a handoff, the ring is bright with nobody selected, and dims with its route when another is selected', () => {
    const s = calledPlay(true);
    const plain = draw(s, s.field.players, null).filter((d) => d.ring);
    expect(plain).toEqual([{ dim: false, big: true, ring: true }]);
    const catcher = withRoute(s, 'catcher');
    const other = draw(s, s.field.players, catcher.slot).filter((d) => d.ring);
    expect(other).toEqual([{ dim: true, big: true, ring: true }]);
  });
});
