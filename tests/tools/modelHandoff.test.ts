import { mkdtemp, readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  configFrom,
  folderStore,
  handleModels,
  isModelsPath,
  type ModelStore,
} from '../../tools/playLog/server';

/**
 * The Goxel hand-off (Thanksgiving map j8; docs/ART.md, The round trip): the
 * play log's service also hands models out to the phone and takes them back,
 * at …ts.net:8443/vox-log/models on the tailnet.
 */

const NOW = () => new Date('2026-11-06T12:30:05.123Z');
const VOX = new Uint8Array([...'VOX '].map((c) => c.charCodeAt(0)).concat([150, 0, 0, 0]));
const none = new Uint8Array();
const text = (b: string | Uint8Array) => (typeof b === 'string' ? b : new TextDecoder().decode(b));

/** An in-memory store, as the folders would be. */
function fakeStore(out: Record<string, Uint8Array> = {}): ModelStore & {
  saved: Record<string, Uint8Array>;
} {
  const saved: Record<string, Uint8Array> = {};
  return {
    saved,
    list: async (folder) => Object.keys(folder === 'out' ? out : saved).sort(),
    read: async (name) => out[name] ?? null,
    save: async (name, bytes) => void (saved[name] = bytes),
  };
}

describe('which paths are the models', () => {
  it('takes /models and below; the play log keeps everything else', () => {
    expect(['/models', '/models/', '/models/out/tom.vox'].map(isModelsPath)).toEqual([
      true,
      true,
      true,
    ]);
    expect(['/', '', '/modelsx', '/vox-log'].map(isModelsPath)).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });
});

describe('handing models out', () => {
  it('the page lists the models to download, what came back, and a way to send one', async () => {
    const store = fakeStore({ 'tom.vox': VOX, 'dinnerRoll.vox': VOX });
    await store.save('gumdrop-2026-11-05T09-00-00Z.vox', VOX);
    const a = await handleModels('GET', '/models', none, store, NOW);
    expect(a.status).toBe(200);
    expect(a.type).toBe('text/html; charset=utf-8');
    const page = text(a.body);
    expect(page).toContain('href="models/out/dinnerRoll.vox"');
    expect(page).toContain('href="models/out/tom.vox"');
    expect(page).toContain('gumdrop-2026-11-05T09-00-00Z.vox');
    expect(page).toContain('<input type="file"');
  });

  it('a model downloads as a file', async () => {
    const a = await handleModels(
      'GET',
      '/models/out/tom.vox',
      none,
      fakeStore({ 'tom.vox': VOX }),
      NOW,
    );
    expect(a).toEqual({
      status: 200,
      body: VOX,
      type: 'application/octet-stream',
      headers: { 'content-disposition': 'attachment; filename="tom.vox"' },
    });
  });

  it("a model that isn't there, or a name that isn't a model's, is a 404", async () => {
    const store = fakeStore({ 'tom.vox': VOX });
    for (const path of [
      '/models/out/gone.vox',
      '/models/out/../secret.vox',
      '/models/out/tom.txt',
    ]) {
      expect((await handleModels('GET', path, none, store, NOW)).status, path).toBe(404);
    }
  });
});

describe('taking models back', () => {
  it('a .vox sent in lands in the inbox under its name and the time, never over another', async () => {
    const store = fakeStore();
    const a = await handleModels('POST', '/models/inbox/tom.vox', VOX, store, NOW);
    expect(a.status).toBe(201);
    expect(text(a.body)).toBe('tom-2026-11-06T12-30-05Z.vox');
    expect(store.saved).toEqual({ 'tom-2026-11-06T12-30-05Z.vox': VOX });
  });

  it("refuses what isn't a .vox, with the reason, and saves nothing", async () => {
    const store = fakeStore();
    const cases: [string, Uint8Array, number, string][] = [
      ['/models/inbox/tom.png', VOX, 400, 'the name must be a .vox, letters, digits, - and _'],
      ['/models/inbox/..%2Ftom.vox', VOX, 400, 'the name must be a .vox, letters, digits, - and _'],
      ['/models/inbox/tom.vox', new Uint8Array([1, 2, 3, 4]), 400, "it isn't a .vox file"],
      ['/models/inbox/tom.vox', new Uint8Array(1024 * 1024 + 1), 413, 'a model is at most 1 MB'],
    ];
    for (const [path, body, status, reason] of cases) {
      const a = await handleModels('POST', path, body, store, NOW);
      expect([a.status, text(a.body)], path).toEqual([status, reason]);
    }
    expect(store.saved).toEqual({});
  });

  it('other methods are refused', async () => {
    expect(
      (await handleModels('DELETE', '/models/out/tom.vox', none, fakeStore(), NOW)).status,
    ).toBe(405);
  });
});

describe('the models folder', () => {
  it('unset, the models answer 503 naming the setting, and the play log still starts', async () => {
    const a = await handleModels('GET', '/models', none, null, NOW);
    expect([a.status, text(a.body)]).toEqual([
      503,
      'VOX_MODELS is blank: name the folder the models are handed out from',
    ]);
    expect(configFrom({ PLAY_LOG: '/tmp/p.jsonl', PLAY_LOG_PORT: '9320' }).models).toBe('');
  });

  it('reads VOX_MODELS', () => {
    expect(
      configFrom({ PLAY_LOG: '/tmp/p.jsonl', PLAY_LOG_PORT: '9320', VOX_MODELS: '/m' }).models,
    ).toBe('/m');
  });

  it('keeps models in out/ and inbox/, listing only .vox files, and makes inbox/ when first used', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'vox-models-'));
    await mkdir(join(dir, 'out'));
    await writeFile(join(dir, 'out', 'tom.vox'), VOX);
    await writeFile(join(dir, 'out', 'notes.txt'), 'x');
    const store = folderStore(dir);
    expect(await store.list('out')).toEqual(['tom.vox']);
    expect(await store.list('inbox')).toEqual([]);
    expect(await store.read('tom.vox')).toEqual(new Uint8Array(VOX));
    expect(await store.read('gone.vox')).toBeNull();
    await store.save('tom-x.vox', VOX);
    expect(await readdir(join(dir, 'inbox'))).toEqual(['tom-x.vox']);
    expect(new Uint8Array(await readFile(join(dir, 'inbox', 'tom-x.vox')))).toEqual(VOX);
  });
});
