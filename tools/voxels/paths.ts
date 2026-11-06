import { join } from 'node:path';

/** Where every .voxt model lives (src/voxel/models.ts loads them all from here). */
export const MODELS_DIR = join(import.meta.dirname, '..', '..', 'assets-src', 'voxels');

/** A model's file, by its id (its path under MODELS_DIR without the extension). */
export const modelFile = (id: string): string => join(MODELS_DIR, `${id}.voxt`);
