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
import {
  appendFile,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
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
  /** The models folder (VOX_MODELS); blank leaves the models refusing, not the play log. */
  models: string;
} {
  const file = env.PLAY_LOG ?? '';
  const portText = env.PLAY_LOG_PORT ?? '';
  if (!file) throw new Error('PLAY_LOG is blank: name the file to append to');
  if (!portText) throw new Error('PLAY_LOG_PORT is blank: name the port to listen on');
  const port = Number(portText);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`PLAY_LOG_PORT is not a port: ${portText}`);
  }
  return { file, port, models: env.VOX_MODELS ?? '' };
}

/**
 * The Goxel hand-off (Thanksgiving map j8; docs/ART.md, The round trip): the
 * models folder (VOX_MODELS) holds `out/`, the models handed out to open in
 * Goxel, and `inbox/`, what comes back from the phone for `import-vox`.
 */
export interface ModelStore {
  /** The .vox files in a folder, by name. */
  list(folder: 'out' | 'inbox'): Promise<string[]>;
  /** A model in `out/`, or null when there's none of that name. */
  read(name: string): Promise<Uint8Array | null>;
  /** Keep a model in `inbox/`. */
  save(name: string, bytes: Uint8Array): Promise<void>;
}

export type ModelAnswer = {
  readonly status: number;
  readonly body: string | Uint8Array;
  readonly type: string;
  readonly headers?: Record<string, string>;
};

/** A model's file name: letters, digits, - and _, then .vox. */
const MODEL_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}\.vox$/;
/** What a .vox file starts with. */
const VOX_MAGIC = 'VOX ';
/** A model the inbox takes: Tom at 64 voxels a side is well under this. */
const MAX_MODEL = 1024 * 1024;

/** The paths this part answers (as the service sees them, `tailscale serve` having taken off /vox-log). */
export const isModelsPath = (path: string): boolean =>
  path === '/models' || path.startsWith('/models/');

const plain = (status: number, body: string): ModelAnswer => ({
  status,
  body,
  type: 'text/plain; charset=utf-8',
});

/** Answer one request under /models; `store` is null when VOX_MODELS is blank. */
export async function handleModels(
  method: string,
  path: string,
  body: Uint8Array,
  store: ModelStore | null,
  now: () => Date,
): Promise<ModelAnswer> {
  if (!store)
    return plain(503, 'VOX_MODELS is blank: name the folder the models are handed out from');
  const [, , folder, name, ...rest] = path.split('/');
  if (method === 'GET' && (folder === undefined || folder === '')) {
    return {
      status: 200,
      body: page(await store.list('out'), await store.list('inbox')),
      type: 'text/html; charset=utf-8',
    };
  }
  if (method === 'GET' && folder === 'out' && rest.length === 0) {
    const bytes = name && MODEL_NAME.test(name) ? await store.read(name) : null;
    if (!bytes) return plain(404, 'no such model');
    return {
      status: 200,
      body: bytes,
      type: 'application/octet-stream',
      headers: { 'content-disposition': `attachment; filename="${name}"` },
    };
  }
  if (method === 'POST' && folder === 'inbox' && rest.length === 0) {
    if (!name || !MODEL_NAME.test(name))
      return plain(400, 'the name must be a .vox, letters, digits, - and _');
    if (body.length > MAX_MODEL) return plain(413, 'a model is at most 1 MB');
    if (new TextDecoder().decode(body.subarray(0, 4)) !== VOX_MAGIC)
      return plain(400, "it isn't a .vox file");
    const saved = freeName(name, now(), await store.list('inbox'));
    await store.save(saved, body);
    return plain(201, saved);
  }
  if (method === 'GET' || method === 'POST') return plain(404, 'no such page');
  return plain(405, 'GET or POST');
}

/** `tom.vox` sent at 12:30:05 becomes `tom-2026-11-06T12-30-05Z.vox`, with -2, -3… if that's taken. */
function freeName(name: string, at: Date, taken: readonly string[]): string {
  const stamp = at
    .toISOString()
    .replace(/\.\d+Z$/, 'Z')
    .replace(/:/g, '-');
  const base = `${name.replace(/\.vox$/, '')}-${stamp}`;
  let candidate = `${base}.vox`;
  for (let n = 2; taken.includes(candidate); n++) candidate = `${base}-${n}.vox`;
  return candidate;
}

const escape = (t: string): string => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** The phone's page: the models to download, a way to send one back, and what came back. */
function page(out: readonly string[], inbox: readonly string[]): string {
  const list = (names: readonly string[], link: boolean): string =>
    names.length === 0
      ? '<p class="none">None yet.</p>'
      : `<ul>${names
          .map((n) =>
            link
              ? `<li><a href="models/out/${escape(n)}">${escape(n)}</a></li>`
              : `<li>${escape(n)}</li>`,
          )
          .join('')}</ul>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>vox models</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 17px/1.45 system-ui, sans-serif; margin: 0 auto; padding: 16px; max-width: 34rem; }
  h1 { font-size: 24px; margin: 0 0 4px; } h2 { font-size: 18px; margin: 24px 0 6px; }
  li { margin: 8px 0; } a { font-size: 18px; } .none, .hint { color: GrayText; }
  button { font: inherit; padding: 8px 18px; margin-top: 8px; }
  #said { font-weight: 600; }
</style></head><body>
<h1>vox models</h1>
<p class="hint">Download one, open it in Goxel, and send back what Goxel saves.</p>
<h2>To open in Goxel</h2>
${list(out, true)}
<h2>Send one back</h2>
<input type="file" accept=".vox"><br><button type="button">Send</button>
<p id="said" role="status"></p>
<h2>Sent back</h2>
${list(inbox, false)}
<script>
  const input = document.querySelector('input');
  const said = document.querySelector('#said');
  document.querySelector('button').addEventListener('click', async () => {
    const file = input.files[0];
    if (!file) { said.textContent = 'Pick a .vox first.'; return; }
    // The service takes letters, digits, - and _: anything else in the name becomes -.
    const name = file.name.replace(/\\.vox$/i, '').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') + '.vox';
    said.textContent = 'Sending…';
    try {
      const r = await fetch('models/inbox/' + encodeURIComponent(name), { method: 'POST', body: file });
      const t = await r.text();
      said.textContent = r.ok ? 'Sent, as ' + t + '.' : 'Not sent: ' + t;
      if (r.ok) setTimeout(() => location.reload(), 1500);
    } catch (e) {
      said.textContent = 'Not sent: ' + (e instanceof Error ? e.message : String(e));
    }
  });
</script>
</body></html>
`;
}

/** The models folder on disk: `out/` and `inbox/` under `dir`, made when first needed. */
export function folderStore(dir: string): ModelStore {
  return {
    list: async (folder) =>
      (
        await readdir(join(dir, folder)).catch((e: unknown) => {
          ignoreMissing(e);
          return [] as string[];
        })
      )
        .filter((n) => MODEL_NAME.test(n))
        .sort(),
    read: async (name) =>
      readFile(join(dir, 'out', name)).then(
        (b) => new Uint8Array(b),
        (e: unknown) => {
          ignoreMissing(e);
          return null;
        },
      ),
    save: async (name, bytes) => {
      await mkdir(join(dir, 'inbox'), { recursive: true });
      await writeFile(join(dir, 'inbox', name), bytes, { flag: 'wx' });
    },
  };
}

function serve(): void {
  const { file, port, models } = configFrom(process.env);
  const append = rotatingAppend(file, MAX_BYTES, KEEP);
  const store = models ? folderStore(models) : null;
  const answer = (method: string, path: string, body: Buffer): Promise<ModelAnswer> =>
    isModelsPath(path)
      ? handleModels(method, path, new Uint8Array(body), store, () => new Date()).catch(
          (e: unknown) => ({
            status: 500,
            body: e instanceof Error ? e.message : String(e),
            type: 'text/plain; charset=utf-8',
          }),
        )
      : handlePlayLog(method, body.toString('utf8'), append).then((a) => ({
          ...a,
          type: 'text/plain',
        }));
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
      const path = (req.url ?? '/').split('?')[0] ?? '/';
      void answer(req.method ?? '', path, Buffer.concat(chunks)).then((a) => {
        // journald stamps each line with its time.
        if (a.status >= 400)
          console.error(`${a.status}: ${typeof a.body === 'string' ? a.body : ''}`);
        res.writeHead(a.status, { 'content-type': a.type, ...a.headers }).end(a.body);
      });
    });
  });
  // Loopback only: the droplet has a public address (CLAUDE.md, This machine).
  server.listen(port, '127.0.0.1', () => {
    console.log(
      `vox-log: appending to ${file}, models in ${models || '(VOX_MODELS is blank)'}, on 127.0.0.1:${port}`,
    );
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) serve();
