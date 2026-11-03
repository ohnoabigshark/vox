/**
 * Biome scenery: everything around the field. The camera looks down so
 * steeply that no sky shows, so the "background" is the ground: a forest
 * floor, a tree line behind the end zone, props along the sidelines, and fog
 * thickening into the distance. Nothing here affects play.
 */
import * as THREE from 'three';
import { biomes, hexToNumber, type Hex } from '../content/palettes';
import { createRng } from '../sim/rng';
import { getGeometry, voxelMaterial } from '../voxel/models';
import type { Biome } from '../arcade/content/defense';
import { biomeAtYard } from '../arcade/render/world';

/** Where the field is, in world units: the scenery goes around it. */
export interface FieldLayout {
  /** Half the field's width (x runs from -halfWidth to halfWidth). */
  readonly halfWidth: number;
  /** The long field runs from nearZ (nearest the camera) to farZ… */
  readonly nearZ: number;
  readonly farZ: number;
  /** …and the field the sim plays on ends at endZ (the back of the end zone). */
  readonly endZ: number;
}

/** Which part of the scenery a prop belongs to (see ForestScenery). */
type Part = 'always' | 'beyond' | 'treeLine';

interface Placement {
  readonly part: Part;
  readonly model: string;
  readonly x: number;
  readonly z: number;
  readonly rotation: number;
  readonly scale: number;
}

export interface Mood {
  readonly hemi: THREE.HemisphereLight;
  readonly sun: THREE.DirectionalLight;
}

/**
 * The scenery around the long field, each area's along its own stretch
 * (the Forest, the Candy Kingdom, the Farm).
 * The Forest: toadstools, stumps and trees along the
 * sidelines the whole way, and on the Boss series a tree line closing the
 * field off behind the end zone. (The 'beyond' part, shown only while
 * there's another series to come, is empty in the Forest.)
 */
export class ForestScenery {
  readonly group: THREE.Group;
  private readonly beyond = new THREE.Group();
  private readonly treeLine = new THREE.Group();

  constructor(scene: THREE.Scene, mood: Mood, layout: FieldLayout) {
    this.group = createForestScenery(scene, mood, layout, {
      beyond: this.beyond,
      treeLine: this.treeLine,
    });
    this.setEnd(false);
  }

  /** On the Boss series the field ends at the woods; otherwise it runs on. */
  setEnd(ends: boolean): void {
    this.beyond.visible = !ends;
    this.treeLine.visible = ends;
  }
}

/** Build the Forest around the field and set the haunted-dusk mood. */
function createForestScenery(
  scene: THREE.Scene,
  mood: Mood,
  layout: FieldLayout,
  parts: { beyond: THREE.Group; treeLine: THREE.Group },
): THREE.Group {
  const palette = biomes.forest;
  scene.background = new THREE.Color(hexToNumber(palette.fog));
  scene.fog = new THREE.Fog(hexToNumber(palette.fog), 30, 60); // View.fit() sets the real range
  mood.hemi.color.set(hexToNumber(palette.hemiSky));
  mood.hemi.groundColor.set(hexToNumber(palette.hemiGround));
  mood.hemi.intensity = 1.25;
  mood.sun.color.set(hexToNumber(palette.moon));
  mood.sun.intensity = 1.7;

  const group = new THREE.Group();
  group.add(forestFloor(palette.floor, layout), parts.beyond, parts.treeLine);
  // The Candy Kingdom's and the Farm's stretches of the field have their own floors laid over the forest's.
  for (const band of biomeBands(layout, 'candy')) {
    group.add(bandFloor(layout, band, biomes.candy.floor, SPRINKLES, 11));
  }
  for (const band of biomeBands(layout, 'farm')) {
    group.add(bandFloor(layout, band, biomes.farm.floor, SOIL, 13));
  }
  const into: Readonly<Record<Part, THREE.Group>> = { always: group, ...parts };
  // Each area's props only along its own stretch of the field.
  const all = [
    ...forestPlacements(layout).filter((p) => biomeAtZ(p.z) === 'forest'),
    ...candyPlacements(layout).filter((p) => biomeAtZ(p.z) === 'candy'),
    ...farmPlacements(layout).filter((p) => biomeAtZ(p.z) === 'farm'),
  ];
  for (const part of ['always', 'beyond', 'treeLine'] as const) {
    for (const [model, placements] of groupBy(all.filter((p) => p.part === part))) {
      into[part].add(instanced(model, placements));
    }
  }
  return group;
}

/** A big ground plane with a blotchy, leaf-strewn pixel texture. */
function forestFloor(base: Hex, { nearZ, farZ, halfWidth }: FieldLayout): THREE.Mesh {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  if (g) {
    g.fillStyle = base;
    g.fillRect(0, 0, size, size);
    const rng = createRng(7);
    // Soft, low-contrast patches of moss and earth, with a few fallen leaves.
    const blotches = ['#29402f', '#223529', '#2b3a2a'];
    const leaves = ['#a8562b', '#c98a3a', '#8e3b2c'];
    for (let i = 0; i < 90; i++) {
      g.fillStyle = rng.pick(blotches);
      g.fillRect(rng.int(0, size - 1), rng.int(0, size - 1), rng.int(2, 6), rng.int(2, 5));
    }
    for (let i = 0; i < 24; i++) {
      g.fillStyle = rng.pick(leaves);
      g.fillRect(rng.int(0, size - 1), rng.int(0, size - 1), 1, 1);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  const length = nearZ - farZ + 40;
  const width = Math.max(96, halfWidth * 2 + 70);
  texture.repeat.set((12 * width) / 96, (12 * length) / 96);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(width, length),
    new THREE.MeshLambertMaterial({ map: texture }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -0.3, (nearZ + farZ) / 2);
  floor.receiveShadow = true;
  return floor;
}

/** The biome at a world z (the field runs into the screen: z = −yards from the run's start). */
const biomeAtZ = (z: number): Biome => biomeAtYard(-z);

/** The stretches of the field (world z, near to far) where this biome is. */
function biomeBands(layout: FieldLayout, biome: Biome): { near: number; far: number }[] {
  const bands: { near: number; far: number }[] = [];
  for (let z = layout.nearZ; z > layout.farZ; z -= 1) {
    if (biomeAtZ(z) !== biome) continue;
    const last = bands[bands.length - 1];
    if (last && last.far === z + 1) last.far = z;
    else bands.push({ near: z, far: z });
  }
  return bands.map((b) => ({ near: b.near, far: b.far - 1 }));
}

/** The Candy Kingdom's sprinkles, and the Farm's furrows and straw. */
const SPRINKLES = ['#ff8fc7', '#7fe3c0', '#fff8ee', '#ffd23f', '#a259ff'];
const SOIL = ['#2e2116', '#4a3624', '#4a3624', '#c9a646', '#e8c65a'];

/** An area's own floor over its stretch of the field: a ground colour with flecks. */
function bandFloor(
  layout: FieldLayout,
  band: { near: number; far: number },
  base: Hex,
  flecks: readonly string[],
  seed: number,
): THREE.Mesh {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  if (g) {
    g.fillStyle = base;
    g.fillRect(0, 0, size, size);
    const rng = createRng(seed);
    for (let i = 0; i < 70; i++) {
      g.fillStyle = rng.pick(flecks);
      g.fillRect(rng.int(0, size - 1), rng.int(0, size - 1), rng.int(1, 2), 1);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  const length = band.near - band.far;
  const width = Math.max(96, layout.halfWidth * 2 + 70);
  texture.repeat.set((12 * width) / 96, (12 * length) / 96);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(width, length),
    new THREE.MeshLambertMaterial({ map: texture }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -0.29, (band.near + band.far) / 2);
  floor.receiveShadow = true;
  return floor;
}

/**
 * The Candy Kingdom's props along the sidelines: candy canes close in,
 * gingerbread houses behind them facing the field, a few trees at the back.
 * Laid along the whole field, then kept only on the Candy Kingdom's stretch.
 */
function candyPlacements(layout: FieldLayout): Placement[] {
  const { halfWidth, nearZ, farZ } = layout;
  const rng = createRng(4242);
  const out: Placement[] = [];
  const taken: { x: number; z: number; r: number }[] = [];
  const scatter = (
    model: string,
    count: number,
    radius: number,
    min: number,
    max: number,
    facing: boolean,
    scale: () => number = () => 1,
  ): void => {
    for (let placed = 0, tries = 0; placed < count && tries < count * 30; tries++) {
      const sign = rng.next() < 0.5 ? -1 : 1;
      const x = sign * (halfWidth + min + rng.next() * (max - min));
      const z = nearZ - rng.next() * (nearZ - farZ);
      if (taken.some((t) => Math.hypot(t.x - x, t.z - z) < t.r + radius)) continue;
      taken.push({ x, z, r: radius });
      // A house turns its front (+z) to face the field; the rest at random.
      const rotation = facing
        ? sign < 0
          ? Math.PI / 2
          : -Math.PI / 2
        : rng.int(0, 3) * (Math.PI / 2);
      out.push({ part: 'always', model, x, z, rotation, scale: scale() });
      placed++;
    }
  };
  const long = (nearZ - farZ) / 40;
  const n = (count: number): number => Math.round(count * long);
  scatter('candyProps/candyCane', n(12), 0.4, 1.0, 3.2, false, () => 0.9 + rng.next() * 0.4);
  scatter('candyProps/gingerbreadHouse', n(5), 1.6, 3.5, 7.5, true, () => 0.9 + rng.next() * 0.3);
  scatter('forestProps/pine', n(4), 1.1, 6, 10, false, () => 0.9 + rng.next() * 0.4);
  return out;
}

/**
 * The Farm's props along the sidelines: a fence on each side with a glowing
 * jack-o'-lantern every few yards, pumpkin patches and hay bales behind it,
 * and a few bare trees at the back. Laid along the whole field, then kept
 * only on the Farm's stretch.
 */
function farmPlacements(layout: FieldLayout): Placement[] {
  const { halfWidth, nearZ, farZ } = layout;
  const rng = createRng(1313);
  const out: Placement[] = [];
  const taken: { x: number; z: number; r: number }[] = [];
  for (const sign of [-1, 1]) {
    for (let z = nearZ; z > farZ; z -= 1.15) {
      out.push({
        part: 'always',
        model: 'forestProps/fence',
        x: sign * (halfWidth + 0.35),
        z,
        rotation: Math.PI / 2,
        scale: 1,
      });
    }
    for (let z = nearZ - 1.5; z > farZ; z -= 3) {
      out.push({
        part: 'always',
        model: 'forestProps/lantern',
        x: sign * (halfWidth + 1.1),
        z,
        rotation: 0,
        scale: 1,
      });
      taken.push({ x: sign * (halfWidth + 1.1), z, r: 0.6 });
    }
  }
  const scatter = (
    model: string,
    count: number,
    radius: number,
    min: number,
    max: number,
    scale = () => 1,
  ): void => {
    for (let placed = 0, tries = 0; placed < count && tries < count * 30; tries++) {
      const x = (rng.next() < 0.5 ? -1 : 1) * (halfWidth + min + rng.next() * (max - min));
      const z = nearZ - rng.next() * (nearZ - farZ);
      if (taken.some((t) => Math.hypot(t.x - x, t.z - z) < t.r + radius)) continue;
      taken.push({ x, z, r: radius });
      out.push({
        part: 'always',
        model,
        x,
        z,
        rotation: rng.int(0, 3) * (Math.PI / 2),
        scale: scale(),
      });
      placed++;
    }
  };
  const long = (nearZ - farZ) / 40;
  const n = (count: number): number => Math.round(count * long);
  scatter('forestProps/pumpkin', n(16), 0.55, 1.8, 4.5);
  scatter('farmProps/hayBale', n(6), 0.7, 2.5, 6);
  scatter('forestProps/deadTree', n(3), 0.9, 6, 10, () => 1 + rng.next() * 0.3);
  return out;
}

/** Where every prop goes. Deterministic, so the forest looks the same every run. */
function forestPlacements(layout: FieldLayout): Placement[] {
  const { halfWidth: FIELD_HALF_W, nearZ: NEAR_Z, farZ: FAR_Z, endZ: FIELD_FAR_Z } = layout;
  const rng = createRng(2026);
  const out: Placement[] = [];
  const taken: { x: number; z: number; r: number }[] = [];
  let part: Part = 'always';
  const place = (model: string, x: number, z: number, radius: number, scale = 1): boolean => {
    if (taken.some((t) => Math.hypot(t.x - x, t.z - z) < t.r + radius)) return false;
    taken.push({ x, z, r: radius });
    out.push({ part, model, x, z, rotation: rng.int(0, 3) * (Math.PI / 2), scale });
    return true;
  };
  const scatter = (
    model: string,
    count: number,
    radius: number,
    area: () => { x: number; z: number },
    scale: () => number = () => 1,
  ): void => {
    for (let placed = 0, tries = 0; placed < count && tries < count * 30; tries++) {
      const { x, z } = area();
      if (place(model, x, z, radius, scale())) placed++;
    }
  };
  const side = (min: number, max: number) => () => ({
    x: (rng.next() < 0.5 ? -1 : 1) * (FIELD_HALF_W + min + rng.next() * (max - min)),
    z: NEAR_Z - rng.next() * (NEAR_Z - FAR_Z),
  });
  /** How many times longer the sidelines are than the field the sim plays on. */
  const long = (NEAR_Z - FAR_Z) / (3 - FIELD_FAR_Z);

  // The tree line behind the end zone, on the Boss series.
  part = 'treeLine';
  scatter(
    'forestProps/pine',
    26,
    1.1,
    () => ({
      x: -(FIELD_HALF_W + 6.5) + rng.next() * (FIELD_HALF_W + 6.5) * 2,
      z: FIELD_FAR_Z - 1.5 - rng.next() * 9,
    }),
    () => 0.9 + rng.next() * 0.5,
  );
  scatter(
    'forestProps/deadTree',
    7,
    0.8,
    () => ({
      x: -(FIELD_HALF_W + 4.5) + rng.next() * (FIELD_HALF_W + 4.5) * 2,
      z: FIELD_FAR_Z - 1 - rng.next() * 4,
    }),
    () => 1 + rng.next() * 0.4,
  );
  // The woods along the sides, the whole length of the long field: toadstools and stumps
  // close in, trees behind. (No pumpkins: they're for the Farm.)
  part = 'always';
  const n = (count: number): number => Math.round(count * long);
  scatter('forestProps/toadstools', n(16), 0.4, side(1.2, 4));
  scatter('forestProps/stump', n(10), 0.5, side(1.6, 4.5));
  scatter('forestProps/deadTree', n(8), 0.9, side(3, 6));
  scatter('forestProps/pine', n(14), 1.1, side(4.5, 9), () => 0.9 + rng.next() * 0.4);
  return out;
}

function groupBy(placements: readonly Placement[]): Map<string, Placement[]> {
  const map = new Map<string, Placement[]>();
  for (const p of placements) map.set(p.model, [...(map.get(p.model) ?? []), p]);
  return map;
}

/** One draw call per prop model, however many copies there are. */
function instanced(model: string, placements: readonly Placement[]): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(getGeometry(model), voxelMaterial, placements.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  placements.forEach((p, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.rotation);
    m.compose(new THREE.Vector3(p.x, 0, p.z), q, new THREE.Vector3(p.scale, p.scale, p.scale));
    mesh.setMatrixAt(i, m);
  });
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
