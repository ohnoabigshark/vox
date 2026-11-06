/**
 * import-vox's work, apart from the files: a .vox becomes .voxt text. Over a
 * model that exists (one coming back from Goxel, docs/ART.md "The round
 * trip"), the voxel size and colors it went out with are kept, and anything
 * that may have gone wrong on the way is said, never passed over.
 */
import { parseVox, voxToVoxt } from '../../src/voxel/vox';
import type { VoxelModel } from '../../src/voxel/voxt';

const dims = (w: number, h: number, d: number) => `${w}×${h}×${d}`;

export function importOver(
  bytes: Uint8Array,
  source: string,
  before: VoxelModel | null,
  scale?: number,
): { text: string; warnings: string[] } {
  const vox = parseVox(bytes);
  const text = voxToVoxt(vox, source, scale ?? before?.scale ?? 0.1, before?.colors ?? []);
  const warnings: string[] = [];
  if (vox.models > 1)
    warnings.push(`${source} holds ${vox.models} models; only the first was imported`);
  const [w, depth, h] = vox.size; // MagicaVoxel z is up
  if (before && (w !== before.width || h !== before.height || depth !== before.depth)) {
    warnings.push(
      `${before.id} came back ${dims(w, h, depth)} (wide × tall × deep) but went out ${dims(before.width, before.height, before.depth)}: an editor may have trimmed empty edges, so check where it sits in the viewer`,
    );
  }
  return { text, warnings };
}
