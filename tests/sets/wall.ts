/**
 * The wall between sets (docs/PLAN.md, Sets, c2): which imports break it.
 * Reads relative paths and paths from the repo's root (as Vite serves them,
 * `/src/…`), in imports, re-exports, `import()` and `import.meta.glob`. A
 * glob's array form is read only for its first pattern.
 */
import { posix } from 'node:path';

/** A source file, by its path from the repo's root. */
export interface SourceFile {
  readonly path: string;
  readonly source: string;
}

/** The list of sets: the one file outside a set's folder that may import from it. */
const LIST_OF_SETS = 'src/sets/index.ts';

/** `from '…'`, a bare `import '…'`, `import('…')` and `import.meta.glob('…')`, in any quotes. */
const IMPORT =
  /(?:\bfrom|\bimport(?:\.meta\.glob)?)\s*\(?\s*\[?\s*['"`]((?:\.{1,2})?\/[^'"`]*)['"`]/g;

/** The set whose folder a path is in, or null. */
const setOf = (path: string): string | null => /^src\/sets\/([^/]+)\//.exec(path)?.[1] ?? null;

/** Each import that crosses the wall, as "<file> imports <path>, inside <set>". */
export function wallBreaches(files: readonly SourceFile[]): string[] {
  return files.flatMap(({ path, source }) =>
    [...source.matchAll(IMPORT)].flatMap(([, spec = '']) => {
      const target = spec.startsWith('/')
        ? posix.normalize(spec.slice(1))
        : posix.join(posix.dirname(path), spec);
      const set = setOf(target);
      if (set === null || set === setOf(path) || path === LIST_OF_SETS) return [];
      return [`${path} imports ${target}, inside ${set}`];
    }),
  );
}
