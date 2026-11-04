/**
 * The props on the field (sim/props.ts): trees, stumps and toadstools in the
 * Forest, gumdrops, lollipops and candy canes in the Candy Kingdom, each
 * where the sim has it, drawn twice its kind's size (the sim's circle stays as it is).
 * On the Farm, the King stands guard in his end zone and the pumpkin patch
 * fills the field behind him. Mister Frog hops on the spot. Rebuilt whenever a
 * new area lays its props (they're in the area's own yards, docs/LONG_FIELD.md).
 */
import * as THREE from 'three';
import { BOSSES, KING } from '../sim/props';
import type { RunState } from '../sim/types';
import { v } from '../sim/vec';
import { getGeometry, voxelMaterial } from '../../voxel/models';
import { toWorld } from './world';

/** Props are drawn this many times their kind's size; what you bump into (the sim's circle) stays the same. */
const DRAW_SCALE = 2;

export class ArcadeFieldProps {
  private readonly group = new THREE.Group();
  private key = '';
  /** Mister Frog, when he's on the field, and his size (he hops: `animate`). */
  private frog: { mesh: THREE.Mesh; scale: number } | null = null;

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
  }

  update(state: RunState, origin: number): void {
    const props = state.field.props;
    const key = `${origin}:${props.map((p) => p.id).join(',')}`;
    if (key === this.key) return;
    this.key = key;
    this.group.clear();
    this.frog = null;
    for (const p of props) {
      const mesh = new THREE.Mesh(getGeometry(p.model), voxelMaterial);
      mesh.position.copy(toWorld(v(p.x, p.y), origin));
      mesh.scale.setScalar(p.scale * DRAW_SCALE);
      // A few quarter turns, so a row of the same prop doesn't look stamped (by its id, so it never changes).
      mesh.rotation.y = p.facing ? 0 : (p.id % 4) * (Math.PI / 2);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      if (p.model === BOSSES.misterFrog.model) this.frog = { mesh, scale: p.scale * DRAW_SCALE };
    }
    this.animate(0);
    // The Farm: Jack's pumpkin patch fills the field behind the King (just scenery).
    const king = props.find((p) => p.model === KING.model);
    if (king) {
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 11; col++) {
          const jitter = ((row * 7 + col * 13) % 5) / 10 - 0.2;
          const x = -8 + col * 1.6 + jitter;
          const y = king.y + 2.5 + row * 1.6 - jitter;
          const lantern = (row + col) % 5 === 0;
          const mesh = new THREE.Mesh(
            getGeometry(lantern ? 'forestProps/lantern' : 'forestProps/pumpkin'),
            voxelMaterial,
          );
          mesh.position.copy(toWorld(v(x, y), origin));
          mesh.scale.setScalar(1.3);
          mesh.rotation.y = ((row + col) % 4) * (Math.PI / 2);
          mesh.castShadow = true;
          this.group.add(mesh);
        }
      }
    }
  }

  /**
   * Mister Frog hops on the spot (`clock`: seconds, real time, so he keeps
   * going while the play waits): a squat, a spring up stretched tall, a
   * landing.
   */
  animate(clock: number): void {
    const frog = this.frog;
    if (!frog) return;
    const HOP = 1.1;
    const phase = (clock % HOP) / HOP;
    // In the air for the first 45% of the hop, crouched on the turf the rest.
    const air = phase < 0.45 ? Math.sin((phase / 0.45) * Math.PI) : 0;
    const crouch = phase >= 0.45 ? Math.sin(((phase - 0.45) / 0.55) * Math.PI) : 0;
    frog.mesh.position.y = 0.5 * air;
    const tall = 1 + 0.08 * air - 0.12 * crouch;
    const wide = 1 - 0.04 * air + 0.07 * crouch;
    frog.mesh.scale.set(frog.scale * wide, frog.scale * tall, frog.scale * wide);
  }
}
