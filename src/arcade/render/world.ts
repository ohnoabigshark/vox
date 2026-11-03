/**
 * Field yards → world units for the arcade game. One world unit is a yard;
 * x is across, and the field runs into the screen (−z). Each series' sim
 * coordinates start at 0, so `origin` (the yards marched in earlier series)
 * keeps the field one long, continuous strip.
 */
import * as THREE from 'three';
import { areaAt, type Biome } from '../content/defense';
import { arcadeTuning } from '../content/tuning';
import { SERIES_KINDS } from '../sim/run';
import type { Vec } from '../sim/types';

export function toWorld(p: Vec, origin: number, height = 0): THREE.Vector3 {
  return new THREE.Vector3(p.x, height, -(origin + p.y));
}

/** The biome at a yard of the long field (from the run's start): each area takes its four series' worth. */
export function biomeAtYard(yard: number): Biome {
  const perArea = SERIES_KINDS.length * arcadeTuning.series.distance;
  return areaAt(Math.floor(Math.max(0, yard) / perArea)).biome;
}

/** How far the long field runs, in yards from the run's start: behind the first line, and ahead. */
export const FIELD_BEHIND = 30;
export const FIELD_AHEAD = 150;
