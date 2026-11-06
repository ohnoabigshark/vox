/**
 * Convert a MagicaVoxel .vox file into a .voxt model.
 *
 *   npm run import-vox -- path/to/model.vox forestProps/tree [voxelSize]
 *
 * Writes assets-src/voxels/<id>.voxt. A model coming back from Goxel
 * (export-vox) keeps the colors and voxel size it had; only new colors are
 * snapped to the palette. A new model needs its source and license in
 * assets/manifest.json (check-assets will remind you).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { parseVox, voxToVoxt } from '../../src/voxel/vox';
import { parseVoxt } from '../../src/voxel/voxt';

const [input, id, scaleArg] = process.argv.slice(2);
if (!input || !id) {
  console.error('usage: npm run import-vox -- <file.vox> <model id> [voxel size]');
  process.exit(1);
}

const out = join(import.meta.dirname, '..', '..', 'assets-src', 'voxels', `${id}.voxt`);
// Coming back from Goxel: the model as it went out.
const before = existsSync(out) ? parseVoxt(id, readFileSync(out, 'utf8')) : null;
const text = voxToVoxt(
  parseVox(new Uint8Array(readFileSync(input))),
  basename(input),
  Number(scaleArg) || before?.scale || 0.1,
  before?.colors ?? [],
);
parseVoxt(id, text); // make sure the result is valid before writing it
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, text);
console.log(
  before
    ? `updated ${out}`
    : `wrote ${out}\nAdd it to assets/manifest.json with its source and license.`,
);
