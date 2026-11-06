/**
 * The wall between sets (docs/PLAN.md, Sets, c2): which imports break it.
 * Only relative imports are read, the only kind the game's code uses.
 */
import { posix } from 'node:path';

/** A source file, by its path from the repo's root. */
export interface SourceFile {
  readonly path: string;
  readonly source: string;
}

/** The list of sets: the one file outside a set's folder that may import from it. */
const LIST_OF_SETS = 'src/sets/index.ts';

/** `from '…'`, a bare `import '…'`, and `import('…')`. */
const IMPORT = /(?:\bfrom\s*|\bimport\s*\(?\s*)['"](\.{1,2}\/[^'"]*)['"]/g;

/** The set whose folder a path is in, or null. */
const setOf = (path: string): string | null => /^src\/sets\/([^/]+)\//.exec(path)?.[1] ?? null;

/** Each import that crosses the wall, as "<file> imports <path>, inside <set>". */
export function wallBreaches(files: readonly SourceFile[]): string[] {
  return files.flatMap(({ path, source }) =>
    [...source.matchAll(IMPORT)].flatMap(([, spec = '']) => {
      const target = posix.join(posix.dirname(path), spec);
      const set = setOf(target);
      if (set === null || set === setOf(path) || path === LIST_OF_SETS) return [];
      return [`${path} imports ${target}, inside ${set}`];
    }),
  );
}
