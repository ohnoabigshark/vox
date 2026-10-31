/**
 * The test bench's Save (docs/BENCH.md, Saving): a Vite plugin for the
 * hot-reload server that takes the whole saved file at `…/__bench-save` and
 * writes it to src/arcade/content/saved-tuning.json. It never commits: GET
 * and every save answer whether the file is as last committed, so the bench
 * can say whether the served game plays it yet (r-s7).
 *
 * A save doesn't hot-reload anything: the bench that sent it already plays
 * it, and the game picks it up on its next load.
 */
import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import { promisify } from 'node:util';
import type { Plugin } from 'vite';
import { endpoint } from './endpoint';
import { BENCH_SAVE_PATH } from '../src/dev/bench/endpoints';
// savedTuning imports nothing; tuning.ts (which loads the saved file) is
// loaded per request through Vite, never by the config: a file the config
// loads restarts the server when it changes, and a save would then reload
// every page, losing the other tabs' unsaved moves.
import { checkSaved } from '../src/arcade/content/savedTuning';

export interface SaveDeps {
  write(text: string): Promise<void>;
  inServedGame(): Promise<boolean>;
  /** tuning.ts's defaults, to check a save against. */
  defaults(): Promise<object>;
}

/** Answer one request: GET is a probe, POST the whole saved file. */
export async function handleBenchSave(
  method: string,
  body: string,
  deps: SaveDeps,
): Promise<{ status: number; body: string }> {
  const answer = async (): Promise<{ status: number; body: string }> => ({
    status: 200,
    body: JSON.stringify({ inServedGame: await deps.inServedGame() }),
  });
  if (method === 'GET') return answer();
  if (method !== 'POST') return { status: 405, body: 'GET or POST' };
  let saved: unknown;
  try {
    saved = JSON.parse(body);
  } catch {
    return { status: 400, body: 'not JSON' };
  }
  const { settings, warnings } = checkSaved(saved, await deps.defaults());
  if (warnings.length > 0) return { status: 400, body: warnings.join('\n') };
  const sorted = Object.fromEntries(Object.entries(settings).sort(([a], [b]) => (a < b ? -1 : 1)));
  try {
    // As prettier writes JSON, so `npm run check` passes with it saved.
    await deps.write(`${JSON.stringify(sorted, null, 2)}\n`);
  } catch (e) {
    return { status: 500, body: e instanceof Error ? e.message : String(e) };
  }
  return answer();
}

/** Writes the saved file. */
export function savedFileWriter(file: string): (text: string) => Promise<void> {
  return (text) => writeFile(file, text, 'utf8');
}

const run = promisify(execFile);

/** Whether `file` is as last committed (git status lists nothing for it). */
export async function gitInServedGame(file: string): Promise<boolean> {
  const { stdout } = await run('git', ['status', '--porcelain', '--', basename(file)], {
    cwd: dirname(file),
  });
  return stdout.trim() === '';
}

export function benchSavePlugin(file: string): Plugin {
  return {
    name: 'bench-save',
    configureServer(server) {
      const deps: SaveDeps = {
        write: savedFileWriter(file),
        inServedGame: () => gitInServedGame(file),
        defaults: async () =>
          (
            (await server.ssrLoadModule('/src/arcade/content/tuning.ts')) as {
              tuningDefaults: object;
            }
          ).tuningDefaults,
      };
      server.middlewares.use(
        endpoint(BENCH_SAVE_PATH, (method, body) => handleBenchSave(method, body, deps)),
      );
    },
    // Vite still drops its cached copy of the file, so the next load reads the save.
    handleHotUpdate(ctx) {
      if (ctx.file === file) return [];
      return undefined;
    },
  };
}
