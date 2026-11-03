import { describe, expect, it } from 'vitest';
import { biomes, common } from '../../src/content/palettes';
import { MOON_FILL, PUMPKIN_LAMP, SKY_FILL } from '../../src/render/gameLight';
import { readViewerLight, viewerLight } from '../../src/dev/viewerLight';

/** The model viewer's light (art pipeline map, p5): studio, or the game's own. */

describe('viewerLight', () => {
  it("studio is the viewer's plain white light on a bright grass tile", () => {
    expect(viewerLight({ mode: 'studio', biome: 'forest' })).toEqual({
      hemi: { sky: '#ffffff', ground: common.grassDark, intensity: 1.3 },
      sun: { color: '#ffffff', intensity: 1.8, castShadow: true },
      lamp: null,
      tile: common.grass,
    });
  });

  it("game is the field's light: dim moon and sky, the pumpkin's lamp, the area's turf", () => {
    expect(viewerLight({ mode: 'game', biome: 'candy' })).toEqual({
      hemi: { sky: biomes.forest.hemiSky, ground: biomes.forest.hemiGround, intensity: SKY_FILL },
      sun: { color: biomes.forest.moon, intensity: MOON_FILL, castShadow: false },
      lamp: PUMPKIN_LAMP,
      tile: biomes.candy.grass,
    });
  });
});

describe('readViewerLight', () => {
  it('reads ?light=game&area=farm', () => {
    expect(readViewerLight(new URLSearchParams('light=game&area=farm'))).toEqual({
      mode: 'game',
      biome: 'farm',
    });
  });

  it('defaults to studio in the Forest, and ignores what it does not know', () => {
    expect(readViewerLight(new URLSearchParams(''))).toEqual({ mode: 'studio', biome: 'forest' });
    expect(readViewerLight(new URLSearchParams('light=disco&area=moon'))).toEqual({
      mode: 'studio',
      biome: 'forest',
    });
  });
});
