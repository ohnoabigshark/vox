/**
 * A saved file the hot-reload server writes for a dev page: the test
 * bench's settings (docs/BENCH.md, Saving) and the event editor's events
 * (docs/FIELD_EVENTS.md, k1). The page POSTs the whole file; it's checked,
 * written as prettier writes JSON, and never committed. GET and every save
 * answer whether the file is as last committed, so the page can say whether
 * the served game plays it yet.
 *
 * A save doesn't hot-reload anything: the page that sent it already plays
 * it, and the game picks it up on its next load.
 */
import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import { promisify } from 'node:util';
import type { Plugin, ViteDevServer } from 'vite';
import { endpoint } from './endpoint';

/** What's written for a save that checks out (`value`), or why not (`warnings`). */
export interface Checked {
  readonly value: unknown;
  readonly warnings: readonly string[];
}

export interface SavedFileDeps {
  write(text: string): Promise<void>;
  inServedGame(): Promise<boolean>;
  check(saved: unknown): Checked | Promise<Checked>;
}

/** Answer one request: GET is a probe, POST the whole saved file. */
export async function handleSave(
  method: string,
  body: string,
  deps: SavedFileDeps,
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
  const { value, warnings } = await deps.check(saved);
  if (warnings.length > 0) return { status: 400, body: warnings.join('\n') };
  try {
    // As prettier writes JSON, so `npm run check` passes with it saved.
    await deps.write(`${JSON.stringify(value, null, 2)}\n`);
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

/** An object with its keys in order, so a saved file reads the same however it was built. */
export function sortedKeys(o: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)));
}

/**
 * The plugin: `path` (under the page's base URL) takes saves of `file`.
 * `check` gets the dev server, so a check that needs the game's modules
 * loads them per request through Vite: a file the config loads restarts the
 * server when it changes, and a save would then reload every page.
 */
export function savedFilePlugin(options: {
  readonly name: string;
  readonly path: string;
  readonly file: string;
  readonly check: (server: ViteDevServer) => SavedFileDeps['check'];
}): Plugin {
  const { name, path, file } = options;
  return {
    name,
    configureServer(server) {
      const deps: SavedFileDeps = {
        write: savedFileWriter(file),
        inServedGame: () => gitInServedGame(file),
        check: options.check(server),
      };
      server.middlewares.use(endpoint(path, (method, body) => handleSave(method, body, deps)));
    },
    // Vite still drops its cached copy of the file, so the next load reads the save.
    handleHotUpdate(ctx) {
      if (ctx.file === file) return [];
      return undefined;
    },
  };
}
