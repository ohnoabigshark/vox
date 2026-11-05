/**
 * Field yards → world units for the arcade game. One world unit is a yard;
 * x is across, and the field runs into the screen (−z). Each area's sim
 * coordinates start at 0 (docs/LONG_FIELD.md), so `origin` (where the area
 * starts on the long strip, `areaOrigin`) keeps the field one long,
 * continuous strip.
 */
import * as THREE from 'three';
import { areaAt, type Biome } from '../content/defense';
import { arcadeTuning } from '../content/tuning';
import { AREA_YARDS } from '../sim/props';
import type { Vec } from '../sim/types';

export function toWorld(p: Vec, origin: number, height = 0): THREE.Vector3 {
  return new THREE.Vector3(p.x, height, -(origin + p.y));
}

/**
 * Where a point in the world shows on the canvas, in CSS pixels from its top
 * left. The names, the intro's bubbles and a tap on the field all measure by
 * this, so a tap lands where a name is drawn (review x9).
 */
export function toScreen(
  at: THREE.Vector3,
  camera: THREE.Camera,
  canvas: Pick<HTMLCanvasElement, 'clientWidth' | 'clientHeight'>,
): { x: number; y: number } {
  const p = at.clone().project(camera);
  return { x: ((p.x + 1) / 2) * canvas.clientWidth, y: ((1 - p.y) / 2) * canvas.clientHeight };
}

/** The biome at a yard of the long field (from the run's start): each area takes its four series' worth. */
export function biomeAtYard(yard: number): Biome {
  return areaAt(Math.floor(Math.max(0, yard) / AREA_YARDS)).biome;
}

/**
 * Where an area's yard 0 sits on the long strip. The strip only has the
 * three areas, so hard mode's endless zones come round onto the same
 * stretches (they look the same).
 */
export function areaOrigin(area: number): number {
  return (area % arcadeTuning.run.areas) * AREA_YARDS;
}

/** How far the long field runs, in yards from the run's start: behind the first line, and ahead. */
export const FIELD_BEHIND = 30;
export const FIELD_AHEAD = 150;
