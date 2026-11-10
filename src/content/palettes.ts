/**
 * The single source of truth for colors. It feeds voxel vertex colors, CSS
 * custom properties and SVG fills, so 3D and 2D always match (TECHNICAL.md §9).
 */

export type Hex = `#${string}`;

/** Shared colors used everywhere: the backdrop, the UI chrome. */
export const common = {
  /** The world behind everything: the page, the empty scene and the fog all fade to this dark purple-grey. */
  backdrop: '#3b2a55',
  grass: '#7ed957',
  grassDark: '#6cc447',
  pumpkin: '#ff8a1f',
  candyPurple: '#a259ff',
  slimeGreen: '#9cff2e',
  bone: '#f7f1e3',
  ink: '#2b2140',
  /** Warnings: a throw that isn't allowed. */
  danger: '#e8344e',
  white: '#ffffff',
} as const satisfies Record<string, Hex>;

/** The team's colors: every teammate, rookie or recruit, wears them (THEME.md, Art Direction). */
export const team = {
  helmet: '#ffb627', // gold
  jersey: '#ff8a1f', // pumpkin orange
  accent: '#ffd23f', // golden yellow
} as const satisfies Record<string, Hex>;

/**
 * Named colors that voxel models (.voxt) refer to. Models use these names,
 * never raw hex, so changing a color here recolors every model that uses it.
 */
export const voxel = {
  ink: '#2b2140',
  white: '#ffffff',
  bone: '#f7f1e3',
  glow: '#ffd23f',
  glowHot: '#fff2a8',
  pumpkin: '#ff8a1f',
  pumpkinDark: '#e06a10',
  stemGreen: '#5a8f2e',
  leafGold: '#ffb627',
  leafGoldDark: '#e8901a',
  leafRed: '#e2543b',
  leafOrange: '#ff7a2f',
  acornCap: '#9c5a2c',
  acornStem: '#6b4423',
  bark: '#7a4e2d',
  barkDark: '#5a3a22',
  moss: '#6cc447',
  // Defenders: every biome's locals wear candy purple, so the opposition always reads as "not us".
  purple: '#a259ff',
  purpleDark: '#6b2fc4',
  purpleLight: '#c9a2ff',
  skin: '#ffcfa0',
  straw: '#e8c65a',
  burlap: '#e9d8a6',
  horn: '#f3e6c4',
  // Forest props.
  pine: '#2f6a54',
  pineDark: '#1e4638',
  wood: '#b88a5e',
  woodGrey: '#7d7364',
  // Monster players: the Werewolf's fur.
  fur: '#8a5a33',
  furDark: '#5e3b20',
  // Hazards.
  stone: '#8d93a3',
  stoneDark: '#646a79',
  /** The gravestone's stone: lighter than `stone`, so it reads on the dark turf (2026-11-10). */
  graveStone: '#b9bfcc',
  graveStoneDark: '#8f96a7',
  witchSkin: '#7fd15a',
  // The Candy Kingdom.
  gingerbread: '#c27a3e',
  gingerbreadDark: '#8f5326',
  icing: '#fff8ee',
  candyRed: '#e8344e',
  candyPink: '#ff8fc7',
  mint: '#7fe3c0',
  chocolate: '#4a2a1a',
  // The will-o'-wisps' pale lights.
  wispGreen: '#c4ffd6',
} as const satisfies Record<string, Hex>;

/**
 * Biome moods: the field, the ground around it, the sky, fog and light.
 * Spooky, but bright enough that gold players and purple defenders always pop.
 */
export const biomes = {
  forest: {
    /** Deep, cool greens, so the pumpkin's orange light leaves them green rather than khaki. */
    grass: '#3f8f4f',
    grassDark: '#357c43',
    floor: '#253a2c',
    skyTop: '#1c1236',
    skyMid: '#4a2f6e',
    skyHorizon: '#d9774a',
    fog: common.backdrop,
    /** Moonlight from above and a purple bounce from below. */
    moon: '#e6e2ff',
    hemiSky: '#c5b3ff',
    hemiGround: '#2c3f2f',
  },
  farm: {
    /** A tilled field: warm brown soil (darker than the team's gold and orange), dark soil beyond. */
    grass: '#7a5536',
    grassDark: '#6c4a2f',
    floor: '#3a2a1c',
  },
  candy: {
    /** Pink-and-white checker turf, a berry floor beyond it. */
    grass: '#f2a3c6',
    grassDark: '#e48bb5',
    floor: '#5c3350',
  },
} as const satisfies Record<string, Record<string, Hex>>;

export type BiomeId = keyof typeof biomes;

export type VoxelColor = keyof typeof voxel;
export type CommonColor = keyof typeof common;

/** Convert a palette hex string to a 0xRRGGBB number for three.js. */
export function hexToNumber(hex: Hex): number {
  return Number.parseInt(hex.slice(1), 16);
}
