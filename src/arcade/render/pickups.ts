/**
 * Tricks and treats on the field (docs/PICKUPS.md): a gold lightning bolt
 * that hovers and turns, an oil slick lying flat with a purple sheen, each
 * where the sim has it, gone once taken. Built from voxel boxes in code
 * (there's no model file). Anyone running at a bolt's speed trails sparks.
 */
import * as THREE from 'three';
import { common, hexToNumber, voxel } from '../../content/palettes';
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
/** The slick: a lopsided puddle of voxels (column, row) about a yard and a half across. */
const SLICK: readonly [number, number][] = Array.from(
  { length: 9 * 7 },
  (_, i): [number, number] => [(i % 9) - 4, Math.floor(i / 9) - 3],
).filter(([c, r]) => (c / 4.4) ** 2 + (r / 3.2) ** 2 + ((c * r) % 3) * 0.02 <= 1);
/** The sheen on the slick: a few voxels picked out in purple. */
const SHEEN = new Set(['-2,1', '-1,1', '0,2', '1,-1', '2,-1']);
/** The bolt is drawn this many times its voxels' size, so it reads at a distance. */
const BOLT_SCALE = 1.7;
/** How many sparks a fast player trails, and how far back they reach (yards). */
const SPARKS = 6;
const TRAIL = 1.4;

const box = new THREE.BoxGeometry(VOX, VOX, VOX);
const flatBox = new THREE.BoxGeometry(VOX, VOX * 0.25, VOX);
const gold = new THREE.MeshLambertMaterial({
  color: hexToNumber(voxel.glow),
  emissive: hexToNumber(voxel.glow),
  emissiveIntensity: 0.6,
});
const oil = new THREE.MeshLambertMaterial({ color: hexToNumber(voxel.ink) });
const sheen = new THREE.MeshLambertMaterial({ color: hexToNumber(common.candyPurple) });
const spark = new THREE.MeshBasicMaterial({ color: hexToNumber(voxel.glow) });

function boltMesh(): THREE.Group {
  const g = new THREE.Group();
  for (const [c, r] of BOLT) {
    const m = new THREE.Mesh(box, gold);
    m.position.set((c - 1.5) * VOX, r * VOX, 0);
    m.castShadow = true;
    g.add(m);
  }
  return g;
}

function slickMesh(): THREE.Group {
  const g = new THREE.Group();
  for (const [c, r] of SLICK) {
    const m = new THREE.Mesh(flatBox, SHEEN.has(`${c},${r}`) ? sheen : oil);
    m.position.set(c * VOX, 0.02, r * VOX);
    m.receiveShadow = true;
    g.add(m);
  }
  return g;
}

export class ArcadePickups {
  private readonly group = new THREE.Group();
  private readonly sparks: THREE.Mesh[] = [];
  private key = '';
  private bolts: THREE.Group[] = [];

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
    for (let i = 0; i < SPARKS * 3; i++) {
      const m = new THREE.Mesh(box, spark);
      m.scale.setScalar(1.8);
      m.visible = false;
      this.sparks.push(m);
      scene.add(m);
    }
  }

  /** Lay the pickups where the sim has them; rebuilt when one is taken or a new drive lays them. */
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
        const bolt = boltMesh();
        // Big enough to read from the camera, edge-on included.
        bolt.scale.setScalar(BOLT_SCALE);
        this.bolts.push(bolt);
        holder.add(bolt);
        break;
      }
      case 'slick':
        holder.add(slickMesh());
        break;
    }
    return holder;
  }

  /** Sparks strung out behind anyone running at a bolt's speed, flickering. */
  private trailSparks(state: RunState, origin: number): void {
    let n = 0;
    const flicker = Math.floor(state.time * 20);
    for (const p of state.field.players) {
      if (p.fast <= 0) continue;
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
