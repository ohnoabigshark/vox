import { mkdir, mkdtemp, rename, symlink, writeFile } from 'node:fs/promises';
import { createServer, request, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { configFrom, gameServer, isGamePath, listener } from '../../tools/playLog/server';

/**
 * docs/BUGS.md B11: vox-log serves the built game at /vox/ so a phone asks
 * for the page each time and a new build shows on the next open.
 */

type Got = { status: number; headers: Record<string, string | string[] | undefined>; body: string };

/** A GET of this raw path (not normalised, so `..` reaches the server as sent). */
function get(server: Server, path: string, headers: Record<string, string> = {}): Promise<Got> {
  const { port } = server.address() as AddressInfo;
  return new Promise((done, fail) => {
    const req = request({ host: '127.0.0.1', port, path, headers }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c: string) => (body += c));
      res.on('end', () => done({ status: res.statusCode ?? 0, headers: res.headers, body }));
    });
    req.on('error', fail);
    req.end();
  });
}

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => new Promise((r) => s.close(r))));
});

async function listening(dir: string): Promise<Server> {
  return listen(createServer(gameServer(dir)));
}

async function listen(server: Server): Promise<Server> {
  servers.push(server);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  return server;
}

/** A folder like vox-serve: two builds, `current` pointing at the first, and a file outside both. */
async function serveFolder(): Promise<{ root: string; current: string }> {
  const root = await mkdtemp(join(tmpdir(), 'vox-game-'));
  for (const name of ['a', 'b']) {
    const build = join(root, 'builds', name);
    await mkdir(join(build, 'assets'), { recursive: true });
    await mkdir(join(build, 'dev'), { recursive: true });
    await writeFile(join(build, 'index.html'), `<p>build ${name}</p>`);
    await writeFile(join(build, 'dev', 'setup.html'), `<p>setup ${name}</p>`);
    await writeFile(join(build, 'dev', 'index.html'), `<p>dev ${name}</p>`);
    await writeFile(join(build, 'assets', 'main-AbC123.js'), `/* ${name} */`);
  }
  await writeFile(join(root, 'secret.txt'), 'outside the build');
  const current = join(root, 'current');
  await symlink(join(root, 'builds', 'a'), current);
  return { root, current };
}

describe('the built game, served by vox-log (B11)', () => {
  it('a page answers no-cache with an ETag, and asking again with it answers 304', async () => {
    const { current } = await serveFolder();
    const server = await listening(current);
    for (const path of ['/vox/', '/vox/index.html', '/vox/dev/setup.html']) {
      const first = await get(server, path);
      expect(first.status, path).toBe(200);
      expect(first.headers['cache-control'], path).toBe('no-cache');
      expect(first.headers['content-type'], path).toBe('text/html;charset=utf-8');
      const etag = first.headers.etag;
      expect(typeof etag, path).toBe('string');
      const again = await get(server, path, { 'if-none-match': etag as string });
      expect(again.status, path).toBe(304);
    }
    expect((await get(server, '/vox/')).body).toBe('<p>build a</p>');
  });

  it('a file under assets/ is kept for a year, immutable', async () => {
    const { current } = await serveFolder();
    const server = await listening(current);
    const got = await get(server, '/vox/assets/main-AbC123.js');
    expect(got.status).toBe(200);
    expect(got.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(got.body).toBe('/* a */');
  });

  it('swapping the current symlink serves the new build on the next request', async () => {
    const { root, current } = await serveFolder();
    const server = await listening(current);
    expect((await get(server, '/vox/')).body).toBe('<p>build a</p>');
    // As vox-rebuild.sh swaps it: a new link renamed over the old one.
    await symlink(join(root, 'builds', 'b'), join(root, 'next'));
    await rename(join(root, 'next'), current);
    expect((await get(server, '/vox/')).body).toBe('<p>build b</p>');
    expect((await get(server, '/vox/assets/main-AbC123.js')).body).toBe('/* b */');
  });

  it('a path that climbs out of the build gets no file', async () => {
    const { current } = await serveFolder();
    const server = await listening(current);
    for (const path of [
      '/vox/../secret.txt',
      '/vox/../../secret.txt',
      '/vox/%2e%2e/secret.txt',
      '/vox/%2e%2e/%2e%2e/secret.txt',
      '/vox/assets/..%2f..%2fsecret.txt',
    ]) {
      const got = await get(server, path);
      expect(got.status, path).toBe(404);
      expect(got.body, path).not.toContain('outside the build');
    }
  });

  it('/vox without its slash is sent to /vox/, keeping the query, so the page’s relative paths resolve', async () => {
    const { current } = await serveFolder();
    const server = await listening(current);
    const bare = await get(server, '/vox');
    expect(bare.status).toBe(301);
    expect(bare.headers.location).toBe('/vox/');
    expect((await get(server, '/vox?seed=3&menu=1')).headers.location).toBe('/vox/?seed=3&menu=1');
  });

  it('a blank VOX_GAME answers 503 naming it, and the play log still starts', async () => {
    const server = await listening('');
    const got = await get(server, '/vox/');
    expect(got.status).toBe(503);
    expect(got.body).toContain('VOX_GAME is blank');
    expect(configFrom({ PLAY_LOG: '/tmp/p.jsonl', PLAY_LOG_PORT: '9320' }).game).toBe('');
    expect(
      configFrom({ PLAY_LOG: '/tmp/p.jsonl', PLAY_LOG_PORT: '9320', VOX_GAME: '/srv/current' })
        .game,
    ).toBe('/srv/current');
  });

  it('a folder named without its slash is sent to it with the slash, as /vox is', async () => {
    const { current } = await serveFolder();
    const server = await listening(current);
    const got = await get(server, '/vox/dev?x=1');
    expect(got.status).toBe(301);
    expect(got.headers.location).toBe('/vox/dev/?x=1');
    expect((await get(server, '/vox/dev/')).body).toBe('<p>dev a</p>');
  });

  it('only a page under assets/ is kept a year: a path that climbs back out is not', async () => {
    const { current } = await serveFolder();
    const server = await listening(current);
    const got = await get(server, '/vox/assets/../index.html');
    expect(got.status).toBe(200);
    expect(got.headers['cache-control']).toBe('no-cache');
  });

  it('the game answers only its own paths', async () => {
    const { current } = await serveFolder();
    const server = await listening(current);
    const got = await get(server, '/voxels');
    expect(got.status).toBe(404);
    expect(got.headers.location).toBeUndefined();
  });

  it('a VOX_GAME that names no folder answers 503 naming it', async () => {
    const { root } = await serveFolder();
    const missing = join(root, 'nowhere');
    const server = await listening(missing);
    const got = await get(server, '/vox/');
    expect(got.status).toBe(503);
    expect(got.body).toBe(`VOX_GAME names no folder: ${missing}`);
  });

  it('with VOX_GAME blank the play log still takes lines', async () => {
    const written: string[] = [];
    const server = await listen(
      createServer(
        listener({
          append: async (text) => void written.push(text),
          store: null,
          game: gameServer(''),
        }),
      ),
    );
    const { port } = server.address() as AddressInfo;
    const line = { at: '2026-11-11T14:00:00.000Z', kind: 'event' };
    const posted = await fetch(`http://127.0.0.1:${port}/`, {
      method: 'POST',
      body: JSON.stringify([line]),
    });
    expect(posted.status).toBe(204);
    expect(written).toEqual([`${JSON.stringify(line)}\n`]);
    expect((await get(server, '/vox/')).status).toBe(503);
  });

  it('only /vox and under is the game; the play log and models keep theirs', () => {
    expect(isGamePath('/vox/')).toBe(true);
    expect(isGamePath('/vox/assets/x.js')).toBe(true);
    expect(isGamePath('/vox')).toBe(true);
    expect(isGamePath('/')).toBe(false);
    expect(isGamePath('/models/')).toBe(false);
    expect(isGamePath('/voxels')).toBe(false);
  });
});
