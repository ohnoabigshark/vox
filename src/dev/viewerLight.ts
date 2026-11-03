/**
 * The model viewer's light (dev/models.html, art pipeline map p5): its own
 * plain white studio light, or the game's (render/gameLight.ts) on an area's
 * turf, so a model can be judged in the light it will be played in. Pure
 * data, applied by src/dev/modelViewer.ts. The game's fog is left out: it
 * starts ten yards past the camera, farther than the viewer ever stands.
 */
import { AREAS, type Biome } from '../arcade/content/defense';
import { assertNever } from '../assertNever';
import { biomes, common, type Hex } from '../content/palettes';
import { GAME_LIGHT, type Lights, type PUMPKIN_LAMP } from '../render/gameLight';

export interface ViewerLightChoice {
  readonly mode: 'studio' | 'game';
  /** Whose turf the model stands on in the game's light. */
  readonly biome: Biome;
}

export interface ViewerLight extends Lights {
  /** The pumpkin's lamp, in the game's light only. */
  readonly lamp: typeof PUMPKIN_LAMP | null;
  /** The colour of the tile the model stands on. */
  readonly tile: Hex;
}

/** The turfs to choose from: every area's, in the run's order, named as the area is. */
export const VIEWER_TURFS: readonly { readonly biome: Biome; readonly name: string }[] = AREAS.map(
  (a) => ({ biome: a.biome, name: a.name }),
);

export function viewerLight({ mode, biome }: ViewerLightChoice): ViewerLight {
  switch (mode) {
    case 'studio':
      return {
        hemi: { sky: '#ffffff', ground: common.grassDark, intensity: 1.3 },
        sun: { color: '#ffffff', intensity: 1.8, castShadow: true },
        lamp: null,
        tile: common.grass,
      };
    case 'game':
      return { ...GAME_LIGHT, tile: biomes[biome].grass };
    default:
      return assertNever(mode);
  }
}

/**
 * `?light=game&turf=farm`; anything else is the studio light on the Forest's
 * turf. Named turf, not area, because the game's own `?area=2` numbers an area.
 */
export function readViewerLight(params: URLSearchParams): ViewerLightChoice {
  const turf = params.get('turf');
  const biome = VIEWER_TURFS.find((t) => t.biome === turf)?.biome ?? 'forest';
  return { mode: params.get('light') === 'game' ? 'game' : 'studio', biome };
}
