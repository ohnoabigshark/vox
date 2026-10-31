/**
 * The test bench's Save (docs/BENCH.md, Saving): settings saved at
 * `…/__bench-save` into src/arcade/content/saved-tuning.json, through the
 * shared saved file (tools/savedFile.ts).
 */
import type { Plugin } from 'vite';
import { BENCH_SAVE_PATH } from '../src/dev/bench/endpoints';
// savedTuning imports nothing; tuning.ts (which loads the saved file) is
// loaded per request through Vite, never by the config (tools/savedFile.ts).
import { checkSaved } from '../src/arcade/content/savedTuning';
import { savedFilePlugin, sortedKeys, type Checked } from './savedFile';

/** A save checked against tuning.ts's defaults, its paths in order. */
export function benchCheck(defaults: object): (saved: unknown) => Checked {
  return (saved) => {
    const { settings, warnings } = checkSaved(saved, defaults);
    return { value: sortedKeys(settings), warnings };
  };
}

export function benchSavePlugin(file: string): Plugin {
  return savedFilePlugin({
    name: 'bench-save',
    path: BENCH_SAVE_PATH,
    file,
    check: (server) => async (saved) => {
      const { tuningDefaults } = (await server.ssrLoadModule('/src/arcade/content/tuning.ts')) as {
        tuningDefaults: object;
      };
      return benchCheck(tuningDefaults)(saved);
    },
  });
}
