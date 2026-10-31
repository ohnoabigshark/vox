/**
 * The plain look (docs/FIELD_EVENTS.md): how a field event made on the event
 * editor shows until it gets art of its own. Its area is drawn faintly on the
 * turf from before the snap, pulses through its build-up, and flashes as it
 * goes off. Frog Rain has its own look (frogRain.ts).
 */
import * as THREE from 'three';
import { common, hexToNumber } from '../../content/palettes';
import { downOn } from '../sim/run';
import type { RunState } from '../sim/types';
import { v } from '../sim/vec';
import { toWorld } from './world';

export class ArcadePlainEvent {
  private readonly box: THREE.Mesh;
  private readonly disc: THREE.Mesh;
  private readonly mat: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene) {
    this.mat = new THREE.MeshBasicMaterial({
      color: hexToNumber(common.bone),
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
    });
    this.box = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), this.mat);
    this.disc = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), this.mat);
    this.box.visible = false;
    this.disc.visible = false;
    scene.add(this.box, this.disc);
  }

  update(state: RunState, origin: number, now: number): void {
    const on = state.field.fieldEvent?.event.look === 'plain' ? state.field.fieldEvent : null;
    const show = on !== null && downOn(state.phase);
    this.box.visible = show && on.area.shape === 'rect';
    this.disc.visible = show && on.area.shape === 'circle';
    if (!show) return;
    const a = on.area;
    if (a.shape === 'rect') {
      this.box.position.copy(toWorld(v((a.x0 + a.x1) / 2, (a.y0 + a.y1) / 2), origin, 0.025));
      this.box.scale.set(a.x1 - a.x0, 1, a.y1 - a.y0);
    } else {
      this.disc.position.copy(toWorld(v(a.x, a.y), origin, 0.025));
      this.disc.scale.set(a.r, 1, a.r);
    }
    // Faint before the snap; pulsing through the build-up; a flash as it goes off, fading.
    const left = on.left;
    const buildUp = on.event.warning.buildUp;
    this.mat.opacity =
      left === null
        ? 0.2
        : left > buildUp
          ? 0.2
          : left > 0
            ? 0.3 + 0.2 * Math.sin(now * 14)
            : Math.max(0.2, 0.75 + left);
  }
}
