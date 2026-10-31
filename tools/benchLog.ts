/**
 * The test bench's log endpoint (docs/BENCH.md, l1): a Vite plugin for the
 * hot-reload server that takes the bench's lines at `…/__bench-log` and
 * appends each to the file named by BENCH_LOG (vox-dev.sh sets it to
 * /root/.local/share/vox-serve/bench.jsonl). GET says whether it's
 * recording, so the page can say so; with BENCH_LOG blank it refuses, naming
 * the variable, and the page says it isn't recording.
 */
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Plugin } from 'vite';
import { BENCH_LOG_PATH } from '../src/dev/bench/endpoints';

/**
 * Answer one request: GET is a probe, POST a line to append. `isLine` is
 * log.ts's `isLogLine`, loaded per request through Vite rather than by the
 * config, since it reaches the saved settings file (tools/benchSave.ts).
 */
export async function handleBenchLog(
  method: string,
  body: string,
  append: (line: string) => Promise<void>,
  isLine: (x: unknown) => Promise<boolean>,
): Promise<{ status: number; body: string }> {
  if (method === 'GET') return { status: 200, body: '{"recording":true}' };
  if (method !== 'POST') return { status: 405, body: 'GET or POST' };
  let line: unknown;
  try {
    line = JSON.parse(body);
  } catch {
    return { status: 400, body: 'not JSON' };
  }
  if (!(await isLine(line))) return { status: 400, body: 'not a test bench log line' };
  try {
    await append(`${JSON.stringify(line)}\n`);
  } catch (e) {
    return { status: 500, body: e instanceof Error ? e.message : String(e) };
  }
  return { status: 204, body: '' };
}

/** Appends to `file`, making its folder first. */
export function fileAppender(file: string): (line: string) => Promise<void> {
  return async (line) => {
    await mkdir(dirname(file), { recursive: true });
    await appendFile(file, line, 'utf8');
  };
}

export function benchLogPlugin(file: string): Plugin {
  const append = file
    ? fileAppender(file)
    : async (): Promise<void> => {
        throw new Error('BENCH_LOG is not set, so the test bench has nowhere to log');
      };
  return {
    name: 'bench-log',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!(req.url ?? '').split('?')[0]?.endsWith(`/${BENCH_LOG_PATH}`)) return next();
        if (!file && req.method === 'GET') {
          res.statusCode = 503;
          res.end('BENCH_LOG is not set');
          return;
        }
        let body = '';
        req.setEncoding('utf8');
        req.on('data', (chunk: string) => (body += chunk));
        req.on('end', () => {
          void handleBenchLog(req.method ?? '', body, append, async (x) =>
            (
              (await server.ssrLoadModule(
                '/src/dev/bench/log.ts',
              )) as typeof import('../src/dev/bench/log')
            ).isLogLine(x),
          ).then((r) => {
            res.statusCode = r.status;
            res.end(r.body);
          });
        });
      });
    },
  };
}
