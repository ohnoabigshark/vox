/**
 * The will-o'-wisps' look (docs/FIELD_EVENTS.md, w1): pale green lights
 * hovering over their circle from before the snap, dim, drifting slowly;
 * brightening and circling faster through the build-up; then, while the
 * spell is on, a glow on the turf and the lights swirling bright, fading as
 * it ends. Ethereal's own look, the see-through body, is the body's
 * (bodies.ts), whatever made it Ethereal.
 */
import * as THREE from 'three';
import { hexToNumber, voxel } from '../../content/palettes';
import { spellLeft, spellOn } from '../sim/fieldEvents';
import { downOn } from '../sim/run';
import type { RunState } from '../sim/types';
import { v } from '../sim/vec';
import { toWorld } from './world';
import { hash } from './hash';

/** How many lights, how big each is (yards), and how high they hover (yards). */
const LIGHTS = 9;
const LIGHT_SIZE = 0.16;
const HOVER = { low: 0.5, high: 1.4 };
/** How long the glow takes to fade as the spell ends (sim seconds). */
const FADE = 0.3;

export class ArcadeWisps {
  private readonly glow: THREE.Mesh;
  private readonly glowMat: THREE.MeshBasicMaterial;
  private readonly lightMat: THREE.MeshBasicMaterial;
  private readonly lights: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene) {
    const green = hexToNumber(voxel.wispGreen);
    this.glowMat = new THREE.MeshBasicMaterial({
      color: green,
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
    });
    this.glow = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), this.glowMat);
    this.glow.visible = false;
    scene.add(this.glow);
    // Unlit, so they glow whatever the light; additive, so they brighten what's behind them.
    this.lightMat = new THREE.MeshBasicMaterial({
      color: green,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const geo = new THREE.SphereGeometry(1, 10, 8);
    for (let i = 0; i < LIGHTS; i++) {
      const m = new THREE.Mesh(geo, this.lightMat);
      m.visible = false;
      scene.add(m);
      this.lights.push(m);
    }
  }

  update(state: RunState, origin: number, now: number): void {
    const on = state.field.fieldEvent?.event.look === 'wisps' ? state.field.fieldEvent : null;
    const area = on?.area.shape === 'circle' ? on.area : null;
    // Gone off, and its spell run out: the lights are spent for this down.
    const spent = on !== null && on.left !== null && on.left <= 0 && !spellOn(on);
    const show = on !== null && area !== null && downOn(state.phase) && !spent;
    this.glow.visible = show;
    for (const l of this.lights) l.visible = show;
    if (!show) return;
    const left = on.left;
    const buildUp = on.event.warning.buildUp;
    // 0 before the snap, rising to 1 through the build-up; 1 while it's on, fading at its end.
    const rising =
      left === null || left > buildUp ? 0 : left > 0 ? 1 - left / Math.max(buildUp, 1e-6) : 1;
    const fade = spellOn(on) ? Math.min(1, spellLeft(on) / FADE) : 1;
    this.glow.position.copy(toWorld(v(area.x, area.y), origin, 0.03));
    this.glow.scale.set(area.r, 1, area.r);
    this.glowMat.opacity = spellOn(on)
      ? (0.4 + 0.08 * Math.sin(now * 6)) * fade
      : 0.1 + 0.15 * rising;
    this.lightMat.opacity = (0.45 + 0.5 * rising) * fade;
    // They drift round the circle, faster as they brighten.
    const speed = 0.4 + 1.6 * rising;
    this.lights.forEach((l, i) => {
      const turn = hash(i, 1) * Math.PI * 2 + now * speed * (0.6 + hash(i, 2));
      const out = area.r * (0.25 + 0.65 * hash(i, 3));
      const at = v(area.x + Math.cos(turn) * out, area.y + Math.sin(turn) * out);
      const high = HOVER.low + (HOVER.high - HOVER.low) * hash(i, 4) + 0.12 * Math.sin(now * 2 + i);
      l.position.copy(toWorld(at, origin, high));
      l.scale.setScalar(LIGHT_SIZE * (0.8 + 0.4 * hash(i, 5)) * (1 + 0.5 * rising));
    });
  }
}
