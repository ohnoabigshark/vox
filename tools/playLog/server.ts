/**
 * vox-log: the play log's service (docs/PLAY_LOG.md, l1 and l6). It takes
 * the game's lines, a POST of a JSON array, and appends them one per line to
 * the file named by PLAY_LOG, starting it fresh once past 20 MB and keeping
 * the last three. It listens on loopback at PLAY_LOG_PORT; `tailscale serve`
 * puts it at https://…ts.net:8443/vox-log/ on the tailnet.
 *
 * Node runs this file as it is (`node tools/playLog/server.ts`, Node 24
 * strips the types), so it imports nothing but Node's own modules. That is
 * why its request handling repeats the bench log's (tools/benchLog.ts)
 * rather than sharing it: sharing would need a build step (review r7).
 */
import { appendFile, mkdir, rename, rm, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { basename, dirname, extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Started fresh once past this; the last `KEEP` old ones kept (l6). */
const MAX_BYTES = 20 * 1024 * 1024;
const KEEP = 3;
/** A batch is at most `BATCH` (500) lines of a few hundred bytes (src/arcade/log/playLogSender.ts, which can't share a constant with this file); this is about 4× that. */
const MAX_BODY = 2 * 1024 * 1024;

export type Answer = { readonly status: number; readonly body: string };

/** Answer one request: GET is a probe, POST an array of lines to append. */
export async function handlePlayLog(
  method: string,
  body: string,
  append: (text: string) => Promise<void>,
): Promise<Answer> {
  if (method === 'GET') return { status: 200, body: '{"recording":true}' };
  if (method !== 'POST') return { status: 405, body: 'GET or POST' };
  let lines: unknown;
  try {
    lines = JSON.parse(body);
  } catch {
    return { status: 400, body: 'not JSON' };
  }
  if (!Array.isArray(lines)) return { status: 400, body: 'not an array of lines' };
  const bad = lines.findIndex((l) => !isLine(l));
  if (bad >= 0) return { status: 400, body: `line ${bad + 1} has no "at" or "kind"` };
  try {
    await append(lines.map((l) => `${JSON.stringify(l)}\n`).join(''));
  } catch (e) {
    return { status: 500, body: e instanceof Error ? e.message : String(e) };
  }
  return { status: 204, body: '' };
}

/** The service checks only what it needs to file a line; the game makes them (src/arcade/log/playLog.ts). */
function isLine(x: unknown): boolean {
  if (typeof x !== 'object' || x === null) return false;
  const l = x as Record<string, unknown>;
  return typeof l.at === 'string' && typeof l.kind === 'string';
}

/**
 * Append to `file`, first moving it aside once it has reached `maxBytes`:
 * play.jsonl becomes play.1.jsonl, play.1 play.2, and so on, `keep` of them.
 * Appends run one at a time, so a move never races a write.
 */
export function rotatingAppend(
  file: string,
  maxBytes: number,
  keep: number,
): (text: string) => Promise<void> {
  const ext = extname(file);
  const old = (n: number): string => join(dirname(file), `${basename(file, ext)}.${n}${ext}`);
  let queue: Promise<void> = Promise.resolve();
  const once = async (text: string): Promise<void> => {
    await mkdir(dirname(file), { recursive: true });
    const size = await stat(file).then(
      (s) => s.size,
      () => 0,
    );
    if (size >= maxBytes) {
      await rm(old(keep), { force: true });
      for (let n = keep - 1; n >= 1; n--) {
        await rename(old(n), old(n + 1)).catch(ignoreMissing);
      }
      await rename(file, old(1));
    }
    await appendFile(file, text);
  };
  return (text) => {
    const next = queue.then(() => once(text));
    queue = next.catch(() => undefined);
    return next;
  };
}

function ignoreMissing(e: unknown): void {
  if ((e as { code?: string }).code !== 'ENOENT') throw e;
}

/** Where it writes and listens. Blank means unconfigured: it refuses to start, naming what's missing. */
export function configFrom(env: Record<string, string | undefined>): {
  file: string;
  port: number;
} {
  const file = env.PLAY_LOG ?? '';
  const portText = env.PLAY_LOG_PORT ?? '';
  if (!file) throw new Error('PLAY_LOG is blank: name the file to append to');
  if (!portText) throw new Error('PLAY_LOG_PORT is blank: name the port to listen on');
  const port = Number(portText);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`PLAY_LOG_PORT is not a port: ${portText}`);
  }
  return { file, port };
}

function serve(): void {
  const { file, port } = configFrom(process.env);
  const append = rotatingAppend(file, MAX_BYTES, KEEP);
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        res.writeHead(413).end('too big');
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (res.writableEnded) return;
      void handlePlayLog(req.method ?? '', Buffer.concat(chunks).toString('utf8'), append).then(
        (a) => {
          // journald stamps each line with its time.
          if (a.status >= 400) console.error(`${a.status}: ${a.body}`);
          res.writeHead(a.status, { 'content-type': 'text/plain' }).end(a.body);
        },
      );
    });
  });
  // Loopback only: the droplet has a public address (CLAUDE.md, This machine).
  server.listen(port, '127.0.0.1', () => {
    console.log(`vox-log: appending to ${file}, on 127.0.0.1:${port}`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) serve();
