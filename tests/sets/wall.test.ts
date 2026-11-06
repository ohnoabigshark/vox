import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { wallBreaches, type SourceFile } from './wall';

/**
 * The wall between sets (docs/PLAN.md, Sets, c2; Thanksgiving map j7): the
 * game imports a set's folder only through the list of sets, and no set
 * imports from another, so sets can be built side by side.
 */

const file = (path: string, ...imports: string[]): SourceFile => ({
  path,
  source: imports.map((from) => `import { x } from '${from}';`).join('\n'),
});

describe('the rule', () => {
  it('lets the list of sets import each set', () => {
    expect(wallBreaches([file('src/sets/index.ts', './halloween/areas')])).toEqual([]);
  });

  it('lets a set import from its own folder and from the engine', () => {
    expect(
      wallBreaches([file('src/sets/halloween/areas.ts', './colors', '../../arcade/sim/types')]),
    ).toEqual([]);
  });

  it('stops the engine importing from a set', () => {
    expect(wallBreaches([file('src/arcade/sim/run.ts', '../../sets/halloween/areas')])).toEqual([
      'src/arcade/sim/run.ts imports src/sets/halloween/areas, inside halloween',
    ]);
  });

  it('stops one set importing from another', () => {
    expect(wallBreaches([file('src/sets/thanksgiving/areas.ts', '../halloween/colors')])).toEqual([
      'src/sets/thanksgiving/areas.ts imports src/sets/halloween/colors, inside halloween',
    ]);
  });

  it('reads every way an import is written', () => {
    const source = [
      "import '../sets/halloween/a';",
      'import type { B } from "../sets/halloween/b";',
      "export { c } from '../sets/halloween/c';",
      "const d = await import('../sets/halloween/d');",
      'import {\n  e,\n} from "../sets/halloween/e";',
    ].join('\n');
    expect(wallBreaches([{ path: 'src/arcade/game.ts', source }])).toHaveLength(5);
  });

  it("doesn't count a path that only begins like a set's folder", () => {
    expect(wallBreaches([file('src/arcade/game.ts', '../sets/halloweenish/a')])).toEqual([
      'src/arcade/game.ts imports src/sets/halloweenish/a, inside halloweenish',
    ]);
    expect(wallBreaches([file('src/sets/halloweenish/a.ts', '../halloween/b')])).toHaveLength(1);
  });
});

describe('the game as it is', () => {
  const ROOT = join(__dirname, '../..');
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith('.ts') ? [join(dir, e.name)] : [],
    );

  it('keeps the wall', () => {
    const files = walk(join(ROOT, 'src')).map((f) => ({
      path: relative(ROOT, f),
      source: readFileSync(f, 'utf8'),
    }));
    expect(files.length).toBeGreaterThan(100);
    expect(wallBreaches(files)).toEqual([]);
  });
});
