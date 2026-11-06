import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { voxel } from '../../src/content/palettes';
import { modelToVox, parseVox, voxToVoxt } from '../../src/voxel/vox';
import { parseVoxt, type VoxelModel } from '../../src/voxel/voxt';
import { importOver } from '../../tools/voxels/importOver';
import { MODELS_DIR } from '../../tools/voxels/paths';

/**
 * The exporter (art pipeline map, a1): a model goes out to Goxel as a .vox
 * and comes back through the importer unchanged.
 */

function allModels(): VoxelModel[] {
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory()
        ? walk(join(dir, e.name))
        : e.name.endsWith('.voxt')
          ? [join(dir, e.name)]
          : [],
    );
  return walk(MODELS_DIR).map((file) =>
    parseVoxt(relative(MODELS_DIR, file).replace(/\.voxt$/, ''), readFileSync(file, 'utf8')),
  );
}

/** Each voxel's color as a hex (or null when empty), so two models compare by what they show. */
const colorsOf = (m: VoxelModel) =>
  Array.from(m.data, (v) => (v === 0 ? null : (m.colors[v - 1] ?? 'missing')));

const tiny = parseVoxt(
  'tiny',
  `size 3 2 2
voxel 0.2
colors
  r leafRed
  k #123456
slice 0
  r.k
  ...
slice 1
  ...
  .r.
`,
);

describe('the exporter', () => {
  it('writes a .vox with the header and chunks Goxel and MagicaVoxel read', () => {
    const bytes = modelToVox(tiny);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const tag = (at: number) => String.fromCharCode(...bytes.subarray(at, at + 4));
    expect(tag(0)).toBe('VOX ');
    expect(view.getUint32(4, true)).toBe(150);
    expect(tag(8)).toBe('MAIN');
    expect(view.getUint32(12, true)).toBe(0); // MAIN has no content of its own…
    expect(view.getUint32(16, true)).toBe(bytes.length - 20); // …only its children
    expect([tag(20), tag(20 + 12 + 12)]).toEqual(['SIZE', 'XYZI']);
  });

  it("puts our depth on MagicaVoxel's y and our height on its z (up)", () => {
    const vox = parseVox(modelToVox(tiny));
    expect(vox.size).toEqual([3, 2, 2]); // width, depth, height
    const colorAt = (x: number, y: number, z: number) => {
      const v = vox.voxels.find(([vx, vy, vz]) => vx === x && vy === y && vz === z);
      const [r, g, b] = v ? (vox.palette[v[3] - 1] ?? []) : [];
      return v ? `#${[r, g, b].map((n) => (n ?? 0).toString(16).padStart(2, '0')).join('')}` : null;
    };
    // Our (x, y, z) is MagicaVoxel's (x, z, y): the front slice's top row is up top at y = 0.
    expect(colorAt(0, 0, 1)).toBe(voxel.leafRed);
    expect(colorAt(2, 0, 1)).toBe('#123456');
    expect(colorAt(1, 1, 0)).toBe(voxel.leafRed);
    expect(vox.voxels).toHaveLength(3);
  });

  it('keeps colors the model already had, and snaps new ones to the palette', () => {
    const vox = parseVox(modelToVox(tiny));
    // A new color, as if added in Goxel: close to leafGold but not it.
    const edited = {
      ...vox,
      voxels: [...vox.voxels, [0, 1, 0, 9] as const],
      palette: vox.palette.map((c, i) => (i === 8 ? ([250, 180, 40, 255] as const) : c)),
    };
    const back = parseVoxt('tiny', voxToVoxt(edited, 'tiny.vox', 0.2, tiny.colors));
    expect(new Set(back.colors)).toEqual(new Set([voxel.leafRed, '#123456', voxel.leafGold]));
  });

  it('brings every model in the game back unchanged', () => {
    const models = allModels();
    expect(models.length).toBeGreaterThan(20);
    for (const m of models) {
      const back = parseVoxt(
        m.id,
        voxToVoxt(parseVox(modelToVox(m)), `${m.id}.vox`, m.scale, m.colors),
      );
      expect([back.width, back.height, back.depth, back.scale], m.id).toEqual([
        m.width,
        m.height,
        m.depth,
        m.scale,
      ]);
      expect(colorsOf(back), m.id).toEqual(colorsOf(m));
    }
  });

  it('refuses a model with more colors than a .vox palette holds', () => {
    const many = { ...tiny, colors: Array.from({ length: 256 }, () => '#000000' as const) };
    expect(() => modelToVox(many)).toThrow(/255 colors/);
  });
});

describe('bringing a model back (import-vox over a model that exists)', () => {
  const bytesOf = (text: string) => modelToVox(parseVoxt('m', text));
  const smaller = `size 3 1 2
colors
  r leafRed
slice 0
  r.r
slice 1
  ...
`;

  it('keeps the voxel size and colors the model went out with', () => {
    const { text, warnings } = importOver(modelToVox(tiny), 'tiny.vox', tiny);
    const back = parseVoxt('tiny', text);
    expect(back.scale).toBe(0.2);
    expect(colorsOf(back)).toEqual(colorsOf(tiny));
    expect(warnings).toEqual([]);
  });

  it('takes a voxel size given on the command line over the old one', () => {
    expect(parseVoxt('tiny', importOver(modelToVox(tiny), 'tiny.vox', tiny, 0.5).text).scale).toBe(
      0.5,
    );
  });

  it('imports a new model at 0.1 with every color snapped', () => {
    const back = parseVoxt('new', importOver(modelToVox(tiny), 'tiny.vox', null).text);
    expect(back.scale).toBe(0.1);
    expect(back.colors).not.toContain('#123456');
  });

  it('warns when the model comes back a different size (an editor trims empty edges)', () => {
    const { warnings } = importOver(bytesOf(smaller), 'tiny.vox', tiny);
    expect(warnings).toEqual([
      'tiny came back 3×1×2 (wide × tall × deep) but went out 3×2×2: an editor may have trimmed empty edges, so check where it sits in the viewer',
    ]);
  });

  it('warns when the file holds more than one model, since only the first comes in', () => {
    const one = bytesOf(smaller);
    // A second SIZE and XYZI after the first, as a file with two models has.
    const view = new DataView(one.buffer);
    const size = one.subarray(20, 20 + 24);
    const xyzi = one.subarray(44, 44 + 12 + view.getUint32(48, true));
    const rest = one.subarray(44 + xyzi.length);
    const two = Uint8Array.from([...one.subarray(0, 44), ...xyzi, ...size, ...xyzi, ...rest]);
    new DataView(two.buffer).setUint32(16, two.length - 20, true);
    expect(importOver(two, 'two.vox', null).warnings).toEqual([
      'two.vox holds 2 models; only the first was imported',
    ]);
  });
});
