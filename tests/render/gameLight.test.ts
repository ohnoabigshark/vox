import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { biomes } from '../../src/content/palettes';
import { GAME_LIGHT, MOON_FILL, SKY_FILL, setLights } from '../../src/render/gameLight';

/** TECHNICAL.md §5: the game's light, set in one place for the game and the model viewer. */

describe("the game's light", () => {
  it("is the Forest's dusk, dimmed: the sky and the moon are fills, and the moon casts no shadow", () => {
    expect(GAME_LIGHT.hemi).toEqual({
      sky: biomes.forest.hemiSky,
      ground: biomes.forest.hemiGround,
      intensity: SKY_FILL,
    });
    expect(GAME_LIGHT.sun).toEqual({
      color: biomes.forest.moon,
      intensity: MOON_FILL,
      castShadow: false,
    });
  });

  it('setLights puts it on a hemisphere light and a directional light', () => {
    const hemi = new THREE.HemisphereLight();
    const sun = new THREE.DirectionalLight();
    sun.castShadow = true;
    setLights(hemi, sun, GAME_LIGHT);
    expect('#' + hemi.color.getHexString(THREE.SRGBColorSpace)).toBe(biomes.forest.hemiSky);
    expect('#' + hemi.groundColor.getHexString(THREE.SRGBColorSpace)).toBe(
      biomes.forest.hemiGround,
    );
    expect(hemi.intensity).toBe(SKY_FILL);
    expect('#' + sun.color.getHexString(THREE.SRGBColorSpace)).toBe(biomes.forest.moon);
    expect(sun.intensity).toBe(MOON_FILL);
    expect(sun.castShadow).toBe(false);
  });
});
