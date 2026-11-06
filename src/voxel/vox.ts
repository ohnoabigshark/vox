/**
 * MagicaVoxel (.vox) import and export (docs/ART.md). A .vox file is
 * converted into .voxt text, with every new color snapped to the nearest
 * named palette color, so imported models share the game's palette and live
 * in the same format as hand-written ones. A model goes out the other way to
 * be edited in Goxel (or MagicaVoxel) and comes back unchanged: on the way
 * back, the colors it already had are kept as they were.
 *
 * Axes: MagicaVoxel's x stays x, its z (up) becomes our y, and its y becomes
 * our depth, with y = 0 as the front.
 */
import { voxel as voxelPalette, type Hex } from '../content/palettes';
import { voxelIndex, type VoxelModel } from './voxt';

export interface VoxFile {
  readonly size: readonly [number, number, number];
  /** [x, y, z, colorIndex] with MagicaVoxel's 1-based color index. */
  readonly voxels: readonly (readonly [number, number, number, number])[];
  /** 256 RGBA entries; entry i is color index i + 1. */
  readonly palette: readonly (readonly [number, number, number, number])[];
}

export function parseVox(bytes: Uint8Array): VoxFile {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (at: number) => String.fromCharCode(...bytes.subarray(at, at + 4));
  if (tag(0) !== 'VOX ') throw new Error('Not a MagicaVoxel file (missing "VOX " header)');

  let size: [number, number, number] | null = null;
  const voxels: [number, number, number, number][] = [];
  let palette: [number, number, number, number][] | null = null;

  // Chunks follow the 8-byte header; MAIN wraps the rest, so we can scan linearly past its header.
  let at = 8;
  while (at + 12 <= bytes.length) {
    const id = tag(at);
    const content = view.getUint32(at + 4, true);
    const children = view.getUint32(at + 8, true);
    const body = at + 12;
    if (id === 'SIZE' && !size) {
      size = [
        view.getUint32(body, true),
        view.getUint32(body + 4, true),
        view.getUint32(body + 8, true),
      ];
    } else if (id === 'XYZI' && voxels.length === 0) {
      const n = view.getUint32(body, true);
      for (let i = 0; i < n; i++) {
        const p = body + 4 + i * 4;
        voxels.push([bytes[p]!, bytes[p + 1]!, bytes[p + 2]!, bytes[p + 3]!]);
      }
    } else if (id === 'RGBA') {
      palette = Array.from({ length: 256 }, (_, i) => {
        const p = body + i * 4;
        return [bytes[p]!, bytes[p + 1]!, bytes[p + 2]!, bytes[p + 3]!] as [
          number,
          number,
          number,
          number,
        ];
      });
    }
    // MAIN's content is empty and its children follow directly; other chunks are skipped whole.
    at = id === 'MAIN' ? body + content : body + content + children;
  }
  if (!size) throw new Error('.vox file has no SIZE chunk');
  if (!palette) throw new Error('.vox file has no RGBA palette chunk (re-save it in MagicaVoxel)');
  return { size, voxels, palette };
}

/** The named palette color closest to an RGB color. */
export function nearestPaletteColor(r: number, g: number, b: number): string {
  let best = '';
  let bestDist = Infinity;
  for (const [name, hex] of Object.entries(voxelPalette) as [string, Hex][]) {
    const n = Number.parseInt(hex.slice(1), 16);
    const dr = ((n >> 16) & 255) - r;
    const dg = ((n >> 8) & 255) - g;
    const db = (n & 255) - b;
    const d = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
    if (d < bestDist) {
      bestDist = d;
      best = name;
    }
  }
  return best;
}

const LEGEND_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

const hexOf = (r: number, g: number, b: number): Hex =>
  `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;

/** The name a .voxt gives a color: its palette name when it has one, else its hex. */
function colorName(hex: Hex): string {
  const named = (Object.entries(voxelPalette) as [string, Hex][]).find(([, h]) => h === hex);
  return named ? named[0] : hex;
}

/**
 * Convert a parsed .vox into .voxt text. A color in `keep` (the colors the
 * model had when it went out) comes back exactly; any other is snapped to the
 * nearest palette color.
 */
export function voxToVoxt(
  vox: VoxFile,
  source: string,
  scale = 0.1,
  keep: readonly Hex[] = [],
): string {
  const [w, depth, h] = vox.size; // MagicaVoxel z is up
  const kept = new Set(keep.map((c) => c.toLowerCase()));
  const colorOf = new Map<number, string>(); // vox color index → palette name or kept hex
  for (const [, , , ci] of vox.voxels) {
    if (!colorOf.has(ci)) {
      const [r, g, b] = vox.palette[ci - 1] ?? [255, 0, 255, 255];
      const hex = hexOf(r, g, b);
      colorOf.set(ci, kept.has(hex) ? colorName(hex) : nearestPaletteColor(r, g, b));
    }
  }
  const names = [...new Set(colorOf.values())];
  if (names.length > LEGEND_CHARS.length) throw new Error('Too many distinct colors to import');
  const charOf = new Map(names.map((n, i) => [n, LEGEND_CHARS[i] as string]));

  const grid: string[][][] = Array.from({ length: depth }, () =>
    Array.from({ length: h }, () => Array.from({ length: w }, () => '.')),
  );
  for (const [x, y, z, ci] of vox.voxels) {
    const row = grid[y]?.[h - 1 - z];
    if (row) row[x] = charOf.get(colorOf.get(ci) as string) as string;
  }

  const out = [
    `# Imported from ${source}. New colors were snapped to the nearest palette color.`,
    `size ${w} ${h} ${depth}`,
    `voxel ${scale}`,
    'colors',
    ...names.map((n) => `  ${charOf.get(n)} ${n}`),
  ];
  grid.forEach((slice, z) => {
    out.push(`slice ${z}`, ...slice.map((row) => `  ${row.join('')}`));
  });
  return `${out.join('\n')}\n`;
}

/** A .vox palette has 256 entries, and index 0 means empty, so a model can use 255 colors. */
const VOX_COLORS = 255;

/**
 * A model as a MagicaVoxel .vox file (version 150: SIZE, XYZI and RGBA chunks
 * inside MAIN), which Goxel opens and saves. Our y (up) is its z, and our
 * depth is its y, the inverse of voxToVoxt.
 */
export function modelToVox(m: VoxelModel): Uint8Array {
  if (m.colors.length > VOX_COLORS) {
    throw new Error(
      `${m.id} has ${m.colors.length} colors; a .vox holds at most ${VOX_COLORS} colors`,
    );
  }
  const voxels: number[] = [];
  for (let z = 0; z < m.depth; z++)
    for (let y = 0; y < m.height; y++)
      for (let x = 0; x < m.width; x++) {
        const v = m.data[voxelIndex(m, x, y, z)] ?? 0;
        if (v !== 0) voxels.push(x, z, y, v);
      }
  const rgba = new Array<number>(256 * 4).fill(0);
  m.colors.forEach((hex, i) => {
    const n = Number.parseInt(hex.slice(1), 16);
    rgba.splice(i * 4, 4, (n >> 16) & 255, (n >> 8) & 255, n & 255, 255);
  });

  const u32 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
  const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
  const chunk = (id: string, content: number[], children: number[] = []) => [
    ...ascii(id),
    ...u32(content.length),
    ...u32(children.length),
    ...content,
    ...children,
  ];
  const children = [
    ...chunk('SIZE', [...u32(m.width), ...u32(m.depth), ...u32(m.height)]),
    ...chunk('XYZI', [...u32(voxels.length / 4), ...voxels]),
    ...chunk('RGBA', rgba),
  ];
  return Uint8Array.from([...ascii('VOX '), ...u32(150), ...chunk('MAIN', [], children)]);
}
