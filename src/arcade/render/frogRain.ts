/**
 * Mister Frog's Frog Rain (GAMEPLAY.md, The Run): the lane on the turf,
 * shown from before the snap (so you can pick a play, or Flip, to keep out
 * of it); then, a moment into the down, shadows filling the lane, and the
 * frogs all coming down at once: a shower of them over the whole lane, which
 * sit there a moment and shrink away.
 */
import * as THREE from 'three';
import { common, hexToNumber } from '../../content/palettes';
import { downOn } from '../sim/run';
import type { RunState } from '../sim/types';
import { v } from '../sim/vec';
import { getGeometry, voxelMaterial } from '../../voxel/models';
import { toWorld } from './world';

/** How many frogs make the shower, and how high they fall from (yards) in how long (seconds). */
const FROGS = 40;
const FALL_HEIGHT = 9;
const FALL_TIME = 0.45;
/** They don't all land at once: each lands up to this much either side of the moment. */
const SPREAD = 0.15;
/** How long a landed frog takes to shrink away. */
const GONE_TIME = 0.6;

/** A frog of the shower: where in the lane (0-1 across and along it) and when it lands (around 0). */
interface Frog {
  readonly mesh: THREE.Mesh;
  readonly shadow: THREE.Mesh;
  readonly across: number;
  readonly along: number;
  readonly lands: number;
}

/** A cheap repeatable "random" number for frog i (so the shower looks the same every time). */
const hash = (i: number, k: number): number => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export class ArcadeFrogRain {
  private readonly lane: THREE.Mesh;
  private readonly laneMat: THREE.MeshBasicMaterial;
  private readonly edges: THREE.Mesh[];
  private readonly frogs: Frog[] = [];

  constructor(scene: THREE.Scene) {
    const flat = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.laneMat = new THREE.MeshBasicMaterial({
      color: hexToNumber(common.candyPurple),
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    });
    this.lane = new THREE.Mesh(flat, this.laneMat);
    const edgeMat = new THREE.MeshBasicMaterial({
      color: hexToNumber(common.candyPurple),
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    });
    this.edges = [new THREE.Mesh(flat, edgeMat), new THREE.Mesh(flat, edgeMat)];
    scene.add(this.lane, ...this.edges);
    const shadowGeo = new THREE.CircleGeometry(0.6, 16).rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: hexToNumber(common.ink),
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    for (let i = 0; i < FROGS; i++) {
      const mesh = new THREE.Mesh(getGeometry('forest/frog'), voxelMaterial);
      mesh.castShadow = true;
      mesh.visible = false;
      const shadow = new THREE.Mesh(shadowGeo, shadowMat);
      shadow.visible = false;
      scene.add(mesh, shadow);
      this.frogs.push({
        mesh,
        shadow,
        across: hash(i, 1),
        along: hash(i, 2),
        lands: (hash(i, 3) * 2 - 1) * SPREAD,
      });
    }
  }

  update(state: RunState, origin: number): void {
    // Frog Rain's look (docs/FIELD_EVENTS.md): its lane and its frogs, from the field event on the field.
    const on = state.field.fieldEvent?.event.look === 'frogRain' ? state.field.fieldEvent : null;
    const lane =
      on && on.area.shape === 'rect'
        ? {
            x: (on.area.x0 + on.area.x1) / 2,
            half: (on.area.x1 - on.area.x0) / 2,
            from: on.area.y0,
            to: on.area.y1,
          }
        : null;
    const live = downOn(state.phase);
    const showLane = lane !== null && live;
    this.lane.visible = showLane;
    for (const e of this.edges) e.visible = showLane;
    const dump = on?.left ?? null;
    const warn = on?.event.warning.buildUp ?? 0;
    if (lane && showLane) {
      const length = lane.to - lane.from;
      const mid = toWorld(v(lane.x, (lane.from + lane.to) / 2), origin, 0.025);
      this.lane.position.copy(mid);
      this.lane.scale.set(lane.half * 2, 1, length);
      this.edges.forEach((e, i) => {
        e.position.copy(mid).setX(lane.x + (i === 0 ? -lane.half : lane.half));
        e.position.y = 0.03;
        e.scale.set(0.12, 1, length);
      });
      // The lane darkens as the frogs come.
      const coming = dump !== null && dump > 0 && dump <= warn ? 1 - dump / warn : 0;
      this.laneMat.opacity = 0.22 + 0.33 * coming;
    }
    for (const f of this.frogs) {
      const t = dump === null || !lane || !live ? null : dump - f.lands;
      if (t === null || !lane || t > Math.max(FALL_TIME, warn)) {
        f.mesh.visible = false;
        f.shadow.visible = false;
        continue;
      }
      const ground = toWorld(
        v(
          lane.x + (f.across * 2 - 1) * lane.half * 0.9,
          lane.from + f.along * (lane.to - lane.from),
        ),
        origin,
      );
      // Its shadow grows on the turf until it lands; the frog falls for the last moment, then shrinks away.
      f.shadow.visible = t > 0;
      f.shadow.position.copy(ground).setY(0.04);
      f.shadow.scale.setScalar(0.3 + 0.7 * (1 - Math.min(1, t / warn)));
      f.mesh.visible = t < FALL_TIME && t > -GONE_TIME;
      f.mesh.position.copy(ground).setY(Math.max(0, t) * (FALL_HEIGHT / FALL_TIME));
      f.mesh.scale.setScalar(t > 0 ? 1 : Math.max(0, 1 + t / GONE_TIME));
    }
  }
}
