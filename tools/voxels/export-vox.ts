/**
 * Send a .voxt model out as a MagicaVoxel .vox file, to edit in Goxel
 * (art pipeline map, a1):
 *
 *   npm run export-vox -- forestProps/tree [out.vox]
 *
 * Writes <name>.vox in the current folder unless told where. Bring it back
 * with `npm run import-vox -- <file.vox> forestProps/tree`, which keeps the
 * colors and voxel size the model had.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { modelToVox } from '../../src/voxel/vox';
import { parseVoxt } from '../../src/voxel/voxt';

const [id, outArg] = process.argv.slice(2);
if (!id) {
  console.error('usage: npm run export-vox -- <model id> [out.vox]');
  process.exit(1);
}

const file = join(import.meta.dirname, '..', '..', 'assets-src', 'voxels', `${id}.voxt`);
const out = outArg ?? `${basename(id)}.vox`;
writeFileSync(out, modelToVox(parseVoxt(id, readFileSync(file, 'utf8'))));
console.log(`wrote ${out}`);
