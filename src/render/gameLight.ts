/**
 * The game's light (TECHNICAL.md §5): the pumpkin ball is the lamp, and the
 * moon and the sky are only a dim fill. Shared by the game and the model
 * viewer's game light (src/dev/viewerLight.ts), so a model is judged in the
 * light it will be played in.
 */
import type { Hex } from '../content/palettes';

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
