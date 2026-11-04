/**
 * The arcade field: one long strip of pixel turf (mowing stripes every
 * yard, a lighter band every five, flecks of grass; each area in its own
 * colours), and the lines that move with the series.
 */
import * as THREE from 'three';
import { biomes, hexToNumber, team } from '../../content/palettes';
import { arcadeTuning } from '../content/tuning';
import { AREA_YARDS } from '../sim/props';
import type { Series } from '../sim/types';
import { createRng } from '../../sim/rng';
import { FIELD_AHEAD, FIELD_BEHIND, biomeAtYard } from './world';

const HALF = arcadeTuning.field.halfWidth;

/** Texture pixels to a yard of turf: chunky, like the rest of the pixel look. */
const TURF_PX = 8;

/**
 * The turf's pixel texture, the whole long strip in one canvas: each area's
 * stretch in its own colours, a lighter or darker band every five yards,
 * mowing stripes every yard, and flecks (darker blades and lighter tufts in
 * the Forest; sprinkles in the Candy Kingdom); the Farm is a tilled field,
 * furrows running up it and sprouts on the ridges.
 */
function turfTexture(rows: number): THREE.CanvasTexture {
  const w = Math.round(HALF * 2 * TURF_PX);
  const h = rows * TURF_PX;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  const rng = createRng(31);
  // Scales the colour in linear light (so 0.93 is a gentle step on screen).
  const shade = (hex: string, k: number): string => {
    const c = new THREE.Color(hex).multiplyScalar(k);
    return `#${c.getHexString()}`;
  };
  if (g) {
    for (let i = 0; i < rows; i++) {
      // Canvas row 0 is the far end of the strip (texture v runs from the far end to the near).
      const yard = FIELD_AHEAD - 1 - i;
      const biome = biomeAtYard(yard);
      const palette = biomes[biome];
      const band = Math.floor(yard / 5) % 2 === 0 ? palette.grass : palette.grassDark;
      const base = shade(band, yard % 2 === 0 ? 1 : 0.93);
      const top = i * TURF_PX;
      g.fillStyle = base;
      g.fillRect(0, top, w, TURF_PX);
      if (biome === 'farm') {
        // A tilled field: a furrow running up the field every yard across, sprouts on the ridges.
        g.fillStyle = shade(band, 0.7);
        for (let x = 0; x < w; x += TURF_PX) g.fillRect(x + TURF_PX - 2, top, 2, TURF_PX);
        for (let x = TURF_PX / 2 - 1; x < w; x += TURF_PX) {
          if (rng.next() < 0.45) {
            g.fillStyle = rng.pick(['#5fa04a', '#4f8f3f', '#79b357']);
            g.fillRect(x + rng.int(-1, 1), top + rng.int(0, TURF_PX - 2), 1, 2);
          }
        }
        continue;
      }
      // Flecks over the yard: one or two to every square yard.
      const flecks = Math.round((w / TURF_PX) * 1.5);
      for (let f = 0; f < flecks; f++) {
        const x = rng.int(0, w - 1);
        const y = top + rng.int(0, TURF_PX - 1);
        if (biome === 'candy') {
          // Sprinkles, half-blended into the pink, so they don't shout.
          const sprinkle = rng.pick(['#fff8ee', '#7fe3c0', '#ffd23f', '#a259ff']);
          g.fillStyle = `#${new THREE.Color(band).lerp(new THREE.Color(sprinkle), 0.5).getHexString()}`;
          g.fillRect(x, y, rng.next() < 0.5 ? 2 : 1, 1);
        } else if (rng.next() < 0.7) {
          g.fillStyle = shade(band, 0.825); // a darker blade, two pixels tall
          g.fillRect(x, y, 1, 2);
        } else {
          g.fillStyle = shade(band, 1.15); // a lighter tuft
          g.fillRect(x, y, 1, 1);
        }
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // Crisp pixels up close, smooth far away (no shimmer down the field).
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}

export function createArcadeTurf(): THREE.Group {
  const group = new THREE.Group();
  const rows = FIELD_BEHIND + FIELD_AHEAD;
  // One long slab: the pixel turf on top, plain earth down its sides.
  const earth = new THREE.MeshLambertMaterial({ color: hexToNumber(biomes.forest.floor) });
  const top = new THREE.MeshLambertMaterial({ map: turfTexture(rows) });
  const turf = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2, 0.3, rows), [
    earth,
    earth,
    top,
    earth,
    earth,
    earth,
  ]);
  turf.position.set(0, -0.15, -(FIELD_AHEAD - FIELD_BEHIND) / 2);
  turf.receiveShadow = true;
  group.add(turf);
  // Chalk sidelines.
  for (const sign of [-1, 1]) {
    const line = new THREE.Mesh(
      new THREE.PlaneGeometry(0.15, rows),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }),
    );
    line.rotation.x = -Math.PI / 2;
    line.position.set(sign * HALF, 0.005, -(rows / 2 - FIELD_BEHIND));
    group.add(line);
  }
  return group;
}

/** The line of scrimmage (white), the first-down line (gold), and the area's end zone, on every down (docs/LONG_FIELD.md, d1). */
export class ArcadeLines {
  private readonly scrimmage: THREE.Mesh;
  private readonly firstDown: THREE.Mesh;
  private readonly endZone: THREE.Mesh;

  constructor(scene: THREE.Scene) {
    const plane = (color: number, opacity: number, depth: number): THREE.Mesh => {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(HALF * 2, depth),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity }),
      );
      mesh.rotation.x = -Math.PI / 2;
      scene.add(mesh);
      return mesh;
    };
    this.scrimmage = plane(0xffffff, 0.6, 0.12);
    this.firstDown = plane(hexToNumber(team.accent), 0.9, 0.18);
    this.endZone = plane(hexToNumber(team.jersey), 0.28, 10);
  }

  update(series: Series, origin: number): void {
    this.scrimmage.position.set(0, 0.008, -(origin + series.los));
    this.firstDown.position.set(0, 0.009, -(origin + series.firstDown));
    this.endZone.position.set(0, 0.007, -(origin + AREA_YARDS + 5));
  }
}
