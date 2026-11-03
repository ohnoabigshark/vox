/**
 * The model viewer's light (dev/models.html, art pipeline map p5): its own
 * plain white studio light, or the game's, so a model can be judged in the
 * light it will be played in. Pure data, applied by src/dev/modelViewer.ts.
 */
import type { Biome } from '../arcade/content/defense';
import { biomes, common, type Hex } from '../content/palettes';
import { MOON_FILL, PUMPKIN_LAMP, SKY_FILL } from '../render/gameLight';

export interface ViewerLightChoice {
  readonly mode: 'studio' | 'game';
  /** Whose turf the model stands on in the game's light. */
  readonly biome: Biome;
}

export interface ViewerLight {
  readonly hemi: { readonly sky: Hex; readonly ground: Hex; readonly intensity: number };
  readonly sun: { readonly color: Hex; readonly intensity: number; readonly castShadow: boolean };
  /** The pumpkin's lamp, in the game's light only. */
  readonly lamp: typeof PUMPKIN_LAMP | null;
  /** The colour of the tile the model stands on. */
  readonly tile: Hex;
}

export const BIOMES: readonly Biome[] = ['forest', 'candy', 'farm'];

export function viewerLight({ mode, biome }: ViewerLightChoice): ViewerLight {
  switch (mode) {
    case 'studio':
      return {
        hemi: { sky: '#ffffff', ground: common.grassDark, intensity: 1.3 },
        sun: { color: '#ffffff', intensity: 1.8, castShadow: true },
        lamp: null,
        tile: common.grass,
      };
    case 'game': {
      // Every area plays under the Forest's dusk (render/scenery.ts sets it once for the run).
      const dusk = biomes.forest;
      return {
        hemi: { sky: dusk.hemiSky, ground: dusk.hemiGround, intensity: SKY_FILL },
        sun: { color: dusk.moon, intensity: MOON_FILL, castShadow: false },
        lamp: PUMPKIN_LAMP,
        tile: biomes[biome].grass,
      };
    }
  }
}

/** `?light=game&area=farm`; anything else is the studio light in the Forest. */
export function readViewerLight(params: URLSearchParams): ViewerLightChoice {
  const area = params.get('area');
  const biome = BIOMES.find((b) => b === area) ?? 'forest';
  return { mode: params.get('light') === 'game' ? 'game' : 'studio', biome };
}
