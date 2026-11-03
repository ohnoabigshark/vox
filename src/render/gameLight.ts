/**
 * The game's light (TECHNICAL.md §5): the pumpkin ball is the lamp, and the
 * moon and the sky are only a dim fill in the Forest's dusk colours, the same
 * for every area of the run. Set here once for the game (game.ts) and the
 * model viewer's game light (src/dev/viewerLight.ts), so a model is judged in
 * the light it will be played in.
 */
import type * as THREE from 'three';
import { biomes, type Hex } from '../content/palettes';

/** The lamp inside the pumpkin (render/ball.ts): its colour, strength, reach in yards, and falloff. */
export const PUMPKIN_LAMP = {
  color: '#ffa64d' as Hex,
  intensity: 60,
  range: 22,
  decay: 1.6,
} as const;

/** With the pumpkin as the light, the moon and the sky are only a dim fill, so the field stays readable. */
export const MOON_FILL = 0.45;
export const SKY_FILL = 0.75;

/** A hemisphere light and a directional light, as data. */
export interface Lights {
  readonly hemi: { readonly sky: Hex; readonly ground: Hex; readonly intensity: number };
  readonly sun: { readonly color: Hex; readonly intensity: number; readonly castShadow: boolean };
}

const dusk = biomes.forest;

/** The field's light: moonlight from above and a purple bounce from below, dim, and no moon shadows. */
export const GAME_LIGHT = {
  hemi: { sky: dusk.hemiSky, ground: dusk.hemiGround, intensity: SKY_FILL },
  sun: { color: dusk.moon, intensity: MOON_FILL, castShadow: false },
  lamp: PUMPKIN_LAMP,
} as const satisfies Lights & { lamp: typeof PUMPKIN_LAMP };

/** Put a light's sky and moon on the scene's two fill lights (View.hemi and View.sun). */
export function setLights(
  hemi: THREE.HemisphereLight,
  sun: THREE.DirectionalLight,
  lights: Lights,
): void {
  hemi.color.set(lights.hemi.sky);
  hemi.groundColor.set(lights.hemi.ground);
  hemi.intensity = lights.hemi.intensity;
  sun.color.set(lights.sun.color);
  sun.intensity = lights.sun.intensity;
  sun.castShadow = lights.sun.castShadow;
}
