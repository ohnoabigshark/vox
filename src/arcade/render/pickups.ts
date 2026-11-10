/**
 * Tricks and treats on the field (docs/PICKUPS.md): a gold lightning bolt
 * that hovers and turns, and a gravestone leaning a little in the turf, each
 * where the sim has it, gone once taken. The bolt is built from voxel boxes in
 * code, merged into one mesh; the gravestone is a model
 * (`assets-src/voxels/pickups/gravestone.voxt`). Anyone running at a bolt's speed trails sparks.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { assertNever } from '../../assertNever';
import { hexToNumber, voxel } from '../../content/palettes';
import { getGeometry, voxelMaterial } from '../../voxel/models';
import { hasStatus } from '../sim/status';
import type { Pickup, RunState } from '../sim/types';
import { v } from '../sim/vec';
import { toWorld } from './world';

/** One voxel of a pickup, in yards. */
const VOX = 0.16;
/** The bolt's voxels, column by row from its foot (a zigzag about a yard tall). */
const BOLT: readonly [number, number][] = [
  [0, 0],
  [1, 1],
  [1, 2],
  [2, 2],
  [2, 3],
  [3, 3],
  [1, 3],
  [0, 3],
  [1, 4],
  [2, 4],
  [2, 5],
  [3, 5],
  [3, 6],
];
/** The bolt is drawn this many times its voxels' size, so it reads at a distance. */
const BOLT_SCALE = 1.7;
/** How many sparks a fast player trails, and how far back they reach (yards). */
const SPARKS = 6;
const TRAIL = 1.4;

const box = new THREE.BoxGeometry(VOX, VOX, VOX);
const gold = new THREE.MeshLambertMaterial({
  color: hexToNumber(voxel.glow),
  emissive: hexToNumber(voxel.glow),
  emissiveIntensity: 0.6,
});
const spark = new THREE.MeshBasicMaterial({ color: hexToNumber(voxel.glow) });

/** Boxes at these voxel spots, merged into one geometry (one draw call). */
function merged(
  spots: readonly [number, number][],
  place: (c: number, r: number) => [number, number, number],
  shape: THREE.BoxGeometry,
): THREE.BufferGeometry {
  const parts = spots.map(([c, r]) => shape.clone().translate(...place(c, r)));
  const out = mergeGeometries(parts);
  for (const g of parts) g.dispose();
  if (!out) throw new Error('The pickup voxels could not be merged');
  return out;
}

/** Built once and shared by every bolt. */
const BOLT_GEO = merged(BOLT, (c, r) => [(c - 1.5) * VOX, r * VOX, 0], box);
export class ArcadePickups {
  private readonly group = new THREE.Group();
  private readonly sparks: THREE.Mesh[] = [];
  private key = '';
  private bolts: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
    // Enough for eight bodies on a bolt at once, either side (the mischief bolt).
    for (let i = 0; i < SPARKS * 8; i++) {
      const m = new THREE.Mesh(box, spark);
      m.scale.setScalar(1.8);
      m.visible = false;
      this.sparks.push(m);
      scene.add(m);
    }
  }

  /** Lay the pickups where the sim has them; rebuilt when one is taken or a new series lays them. */
  update(state: RunState, origin: number): void {
    const pickups = state.field.pickups;
    const key = `${origin}:${pickups.map((p) => p.id).join(',')}`;
    if (key !== this.key) {
      this.key = key;
      this.group.clear();
      this.bolts = [];
      for (const p of pickups) this.group.add(this.mesh(p, origin));
    }
    this.trailSparks(state, origin);
  }

  /** The bolts hover and turn (`clock`: seconds, real time, so they keep going while the play waits). */
  animate(clock: number): void {
    for (const [i, b] of this.bolts.entries()) {
      b.rotation.y = clock * 2 + i;
      b.position.y = 0.45 + Math.sin(clock * 3 + i) * 0.12;
    }
  }

  private mesh(p: Pickup, origin: number): THREE.Group {
    const holder = new THREE.Group();
    holder.position.copy(toWorld(v(p.x, p.y), origin));
    switch (p.kind) {
      case 'bolt': {
        const bolt = new THREE.Mesh(BOLT_GEO, gold);
        // Big enough to read from the camera, edge-on included.
        bolt.scale.setScalar(BOLT_SCALE);
        bolt.castShadow = true;
        this.bolts.push(bolt);
        holder.add(bolt);
        break;
      }
      case 'gravestone': {
        const stone = new THREE.Mesh(getGeometry('pickups/gravestone'), voxelMaterial);
        // The model's front (+z) already faces the camera, behind the play. Each leans a
        // little, its own way, from where it lies (ids can't: a stretch's gravestone's
        // always ends in 1).
        stone.rotation.z = Math.sin(p.x * 3.7 + p.y * 1.3) * 0.08;
        stone.castShadow = true;
        stone.receiveShadow = true;
        holder.add(stone);
        break;
      }
      default:
        assertNever(p.kind);
    }
    return holder;
  }

  /** Sparks strung out behind anyone running at a bolt's speed, flickering. */
  private trailSparks(state: RunState, origin: number): void {
    let n = 0;
    const flicker = Math.floor(state.time * 20);
    for (const p of [...state.field.players, ...state.field.defenders]) {
      if (!hasStatus(p, 'fast')) continue;
      const speed = Math.hypot(p.vel.x, p.vel.y) || 1;
      const back = v(-p.vel.x / speed, -p.vel.y / speed);
      for (let i = 0; i < SPARKS && n < this.sparks.length; i++, n++) {
        const s = this.sparks[n];
        if (!s) break;
        const along = ((i + 1) / SPARKS) * TRAIL;
        const wobble = ((i * 7 + flicker) % 5) / 10 - 0.2;
        s.position.copy(
          toWorld(
            v(p.pos.x + back.x * along + wobble * back.y, p.pos.y + back.y * along),
            origin,
            0.4 + wobble,
          ),
        );
        s.visible = (i + flicker) % 3 !== 0;
      }
    }
    for (; n < this.sparks.length; n++) {
      const s = this.sparks[n];
      if (s) s.visible = false;
    }
  }
}
