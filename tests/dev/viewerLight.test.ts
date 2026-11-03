import { describe, expect, it } from 'vitest';
import { biomes, common } from '../../src/content/palettes';
import { GAME_LIGHT } from '../../src/render/gameLight';
import { AREAS } from '../../src/arcade/content/defense';
import { VIEWER_TURFS, readViewerLight, viewerLight } from '../../src/dev/viewerLight';

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
      ...GAME_LIGHT,
      tile: biomes.candy.grass,
    });
  });
});

describe('VIEWER_TURFS', () => {
  it("is every area's turf, in the run's order, named as the area is", () => {
    expect(VIEWER_TURFS).toEqual(AREAS.map((a) => ({ biome: a.biome, name: a.name })));
  });
});

describe('readViewerLight', () => {
  it('reads ?light=game&turf=farm', () => {
    expect(readViewerLight(new URLSearchParams('light=game&turf=farm'))).toEqual({
      mode: 'game',
      biome: 'farm',
    });
  });

  it("ignores the game's ?area=2, which numbers an area rather than naming its turf", () => {
    expect(readViewerLight(new URLSearchParams('light=game&area=candy'))).toEqual({
      mode: 'game',
      biome: 'forest',
    });
  });

  it('defaults to studio in the Forest, and ignores what it does not know', () => {
    expect(readViewerLight(new URLSearchParams(''))).toEqual({ mode: 'studio', biome: 'forest' });
    expect(readViewerLight(new URLSearchParams('light=disco&turf=moon'))).toEqual({
      mode: 'studio',
      biome: 'forest',
    });
  });
});
