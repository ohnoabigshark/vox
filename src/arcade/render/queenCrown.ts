/**
 * The Queen's crown (the Candy Kingdom, where she stands in the end zone), just for looks: it glows purple, pulsing
 * slowly, and lights the field around her. It does nothing to the game.
 */
import * as THREE from 'three';
import { common, hexToNumber } from '../../content/palettes';
import { BOSS_SPOT, BOSSES } from '../sim/props';
import type { RunState } from '../sim/types';
import { toWorld } from './world';

/** Where her crown is: she's drawn twice her model's size. */
const CROWN_HEIGHT = 4.2;
/** One slow pulse this long (seconds, real time). */
const PULSE = 2.5;

export class ArcadeQueenCrown {
  private readonly glow: THREE.Mesh;
  private readonly light: THREE.PointLight;

  constructor(scene: THREE.Scene) {
    const purple = hexToNumber(common.candyPurple);
    this.glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 16, 12),
      new THREE.MeshBasicMaterial({
        color: purple,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    this.light = new THREE.PointLight(purple, 0, 12, 1.5);
    scene.add(this.glow, this.light);
  }

  /** `clock`: seconds, real time (it keeps pulsing while the play waits). */
  update(state: RunState, origin: number, clock: number): void {
    const queen = state.field.props.some((p) => p.model === BOSSES.queen.model);
    this.glow.visible = queen;
    this.light.visible = queen;
    if (!queen) return;
    const level = 0.55 + 0.45 * Math.sin((clock / PULSE) * Math.PI * 2);
    const at = toWorld(BOSS_SPOT, origin, CROWN_HEIGHT);
    this.glow.position.copy(at);
    this.glow.scale.setScalar(0.8 + 0.4 * level);
    (this.glow.material as THREE.MeshBasicMaterial).opacity = 0.55 * level;
    this.light.position.copy(at);
    this.light.intensity = 6 * level;
  }
}
