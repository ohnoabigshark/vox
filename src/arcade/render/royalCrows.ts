/**
 * The King's crows (his series): two pairs, perched on him before the snap
 * (one pair on the ends of his arms, the other on his shoulders); each pair
 * in turn flies at the ball, then flaps over whoever it's landed on while
 * you SHOO! it (sim/step.ts, royalCrows). A pair is gone once it's shooed
 * or has struck.
 */
import * as THREE from 'three';
import { BOSS_SPOT } from '../sim/props';
import type { RunState } from '../sim/types';
import { add, v } from '../sim/vec';
import { getGeometry, voxelMaterial } from '../../voxel/models';
import { toWorld } from './world';

/** Where each pair perches (he's drawn twice his model's size): across from his middle, and how high. */
const PERCH = [
  { x: 1.3, height: 2.7 },
  { x: 0.7, height: 3.4 },
];
/** How high they fly, and how far apart the two of a pair are. */
const FLY_HEIGHT = 1.7;
const SPREAD = 0.5;

export class ArcadeRoyalCrows {
  /** Two meshes a pair. */
  private readonly crows: THREE.Mesh[];

  constructor(scene: THREE.Scene) {
    this.crows = [0, 1, 2, 3].map(() => {
      const crow = new THREE.Mesh(getGeometry('farm/crow'), voxelMaterial);
      crow.castShadow = true;
      crow.visible = false;
      scene.add(crow);
      return crow;
    });
  }

  update(state: RunState, origin: number): void {
    const flocks = state.field.crows;
    this.crows.forEach((crow, i) => {
      const pair = Math.floor(i / 2);
      const c = flocks?.[pair];
      const show = !!c && c.phase !== 'gone' && state.phase !== 'downOver';
      crow.visible = show;
      if (!c || !show) return;
      const side = i % 2 === 0 ? -1 : 1;
      const flap = Math.sin(state.time * (c.phase === 'perched' ? 2 : 14) + i * 1.7);
      if (c.phase === 'perched') {
        const perch = PERCH[pair] ?? { x: 1.3, height: 2.7 };
        crow.position.copy(toWorld(add(BOSS_SPOT, v(side * perch.x, 0)), origin, perch.height));
        crow.scale.set(1, 1 + 0.03 * flap, 1);
      } else {
        // Flying at the ball, or flapping over whoever they've landed on.
        const height = (c.phase === 'shoo' ? FLY_HEIGHT - 0.2 : FLY_HEIGHT) + 0.12 * flap;
        crow.position.copy(toWorld(add(c.pos, v(side * SPREAD, 0)), origin, height));
        crow.scale.set(1, 1 + 0.25 * flap, 1);
      }
    });
  }
}
