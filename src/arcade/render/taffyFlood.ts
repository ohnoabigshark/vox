/**
 * The taffy flood's look (docs/FIELD_EVENTS.md, round 5, t1): its band on
 * the turf, faint pink from before the snap; bubbles rising and popping in
 * it through the build-up; then pink candy ground while the spell is on,
 * and strings of taffy stretched behind everyone it holds. Slowed's own
 * look, the heavy step, is the body's (bodies.ts), whatever slowed it.
 */
import * as THREE from 'three';
import { hexToNumber, voxel } from '../../content/palettes';
import type { FieldEvent } from '../content/fieldEvents';
import { fromEvent, spellOn } from '../sim/fieldEvents';
import { downOn } from '../sim/run';
import { sameSource, statusOf } from '../sim/status';
import type { Body, RunState } from '../sim/types';
import { v } from '../sim/vec';
import { toWorld } from './world';

/** Bubbles in the build-up, and how big one grows (yards) before it pops. */
const BUBBLES = 28;
const BUBBLE_SIZE = 0.35;
/** Strings behind each body held: how many, how far back they reach (yards), and how many bodies at most. */
const STRINGS = 3;
const STRING_BACK = 1.3;
const HELD_MOST = 16;
/** How long the candy takes to fade as the spell ends (sim seconds). */
const FADE = 0.3;

/** A cheap repeatable "random" number for bubble i (so the bubbling looks the same every time). */
const hash = (i: number, k: number): number => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const UP = new THREE.Vector3(0, 1, 0);

export class ArcadeTaffyFlood {
  private readonly band: THREE.Mesh;
  private readonly bandMat: THREE.MeshBasicMaterial;
  private readonly bubbles: THREE.Mesh[] = [];
  private readonly strings: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene) {
    this.bandMat = new THREE.MeshBasicMaterial({
      color: hexToNumber(voxel.candyPink),
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    });
    this.band = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), this.bandMat);
    this.band.visible = false;
    scene.add(this.band);
    const bubbleMat = new THREE.MeshLambertMaterial({
      color: hexToNumber(voxel.candyPink),
      transparent: true,
      opacity: 0.85,
    });
    const bubbleGeo = new THREE.SphereGeometry(1, 10, 8);
    for (let i = 0; i < BUBBLES; i++) {
      const b = new THREE.Mesh(bubbleGeo, bubbleMat);
      b.visible = false;
      scene.add(b);
      this.bubbles.push(b);
    }
    // A unit string along y, from its foot at 0 to 1, stretched between two points each frame.
    const stringGeo = new THREE.CylinderGeometry(0.07, 0.05, 1, 6).translate(0, 0.5, 0);
    // Pulled taffy goes pale as it stretches, so the strings show against the pink.
    const stringMat = new THREE.MeshLambertMaterial({ color: hexToNumber(voxel.icing) });
    for (let i = 0; i < HELD_MOST * STRINGS; i++) {
      const s = new THREE.Mesh(stringGeo, stringMat);
      s.visible = false;
      scene.add(s);
      this.strings.push(s);
    }
  }

  update(state: RunState, origin: number, now: number): void {
    const on = state.field.fieldEvent?.event.look === 'taffyFlood' ? state.field.fieldEvent : null;
    const area = on?.area.shape === 'rect' ? on.area : null;
    const show = on !== null && area !== null && downOn(state.phase);
    this.band.visible = show;
    let bubbling = false;
    let n = 0;
    if (show) {
      this.band.position.copy(
        toWorld(v((area.x0 + area.x1) / 2, (area.y0 + area.y1) / 2), origin, 0.025),
      );
      this.band.scale.set(area.x1 - area.x0, 1, area.y1 - area.y0);
      const left = on.left;
      const buildUp = on.event.warning.buildUp;
      bubbling = left !== null && left > 0 && left <= buildUp;
      const rising = bubbling && buildUp > 0 ? 1 - (left ?? 0) / buildUp : 0;
      if (spellOn(on)) {
        // Candy ground, glossy and rippling a little, fading as the spell ends.
        const end = (left ?? 0) + on.event.lasts;
        this.bandMat.opacity = Math.min(1, end / FADE) * (0.88 + 0.06 * Math.sin(now * 5));
      } else if (left !== null && left <= 0) {
        this.band.visible = false;
      } else {
        // Faint before the snap; thickening as it bubbles up.
        this.bandMat.opacity = 0.3 + 0.35 * rising;
      }
      if (bubbling) this.bubble(area, origin, now, rising);
      if (spellOn(on)) n = this.stretch(state, on.event, origin);
    }
    if (!bubbling) for (const b of this.bubbles) b.visible = false;
    for (; n < this.strings.length; n++) {
      const s = this.strings[n];
      if (s) s.visible = false;
    }
  }

  /** Bubbles swelling and popping all over the band, more of them as it nears going off. */
  private bubble(
    area: { x0: number; x1: number; y0: number; y1: number },
    origin: number,
    now: number,
    rising: number,
  ): void {
    this.bubbles.forEach((b, i) => {
      const cycle = (now * (1.4 + hash(i, 4)) + hash(i, 3)) % 1;
      b.visible = hash(i, 5) < 0.35 + 0.65 * rising;
      const at = v(
        area.x0 + hash(i, 1) * (area.x1 - area.x0),
        area.y0 + hash(i, 2) * (area.y1 - area.y0),
      );
      b.position.copy(toWorld(at, origin, 0.03));
      const r = BUBBLE_SIZE * (0.5 + hash(i, 6)) * cycle;
      b.scale.set(r, r * 0.8, r);
    });
  }

  /** Strings of taffy from the ground behind each body the spell holds, up to its legs. Returns how many are used. */
  private stretch(state: RunState, event: FieldEvent, origin: number): number {
    const from = fromEvent(event);
    const held = (b: Body): boolean => {
      const s = statusOf(b, 'slowed');
      return s !== undefined && sameSource(s.from, from);
    };
    let n = 0;
    const bodies = [...state.field.players, ...state.field.defenders].filter(held);
    for (const b of bodies.slice(0, HELD_MOST)) {
      const speed = Math.hypot(b.vel.x, b.vel.y);
      const back = speed > 0.1 ? v(-b.vel.x / speed, -b.vel.y / speed) : v(0, -1);
      for (let k = 0; k < STRINGS; k++, n++) {
        const s = this.strings[n];
        if (!s) return n;
        const side = (k - (STRINGS - 1) / 2) * 0.25;
        const foot = v(b.pos.x + back.y * side, b.pos.y - back.x * side);
        const top = toWorld(foot, origin, 0.35 + 0.1 * k);
        const ground = toWorld(
          v(foot.x + back.x * STRING_BACK * (0.7 + 0.3 * k), foot.y + back.y * STRING_BACK),
          origin,
          0.02,
        );
        const span = top.clone().sub(ground);
        s.position.copy(ground);
        s.quaternion.setFromUnitVectors(UP, span.clone().normalize());
        s.scale.set(1, span.length(), 1);
        s.visible = true;
      }
    }
    return n;
  }
}
