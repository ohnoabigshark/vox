import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  configFrom,
  folderStore,
  handleModels,
  isModelsPath,
  type ModelRequest,
  type ModelStore,
} from '../../tools/playLog/server';

/**
 * The Goxel round trip's travel (Thanksgiving map j8; docs/ART.md, The round
 * trip): the play log's service also hands models out to the phone and takes
 * them back, at …ts.net:8443/vox-log/models on the tailnet.
 */

const NOW = () => new Date('2026-11-06T12:30:05.123Z');
const STAMP = '2026-11-06T12-30-05Z';
const VOX = new Uint8Array([...'VOX '].map((c) => c.charCodeAt(0)).concat([150, 0, 0, 0]));
const none = new Uint8Array();
const text = (b: string | Uint8Array) => (typeof b === 'string' ? b : new TextDecoder().decode(b));

const get = (path: string): ModelRequest => ({ method: 'GET', path, body: none, fromPage: false });
/** A send from the page, which marks itself as one. */
const send = (name: string, body: Uint8Array = VOX): ModelRequest => ({
  method: 'POST',
  path: `/models/inbox/${encodeURIComponent(name)}`,
  body,
  fromPage: true,
});

/** An in-memory store, as the folders would be: saving over a file fails, as `wx` does on disk. */
function fakeStore(
  out: Record<string, Uint8Array> = {},
  fail?: Error,
): ModelStore & { saved: Record<string, Uint8Array> } {
  const saved: Record<string, Uint8Array> = {};
  return {
    saved,
    list: async (folder) => Object.keys(folder === 'out' ? out : saved).sort(),
    read: async (name) => out[name] ?? null,
    save: async (name, bytes) => {
      if (fail) throw fail;
      if (name in saved) throw Object.assign(new Error(`EEXIST: ${name}`), { code: 'EEXIST' });
      saved[name] = bytes;
    },
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
    await store.save(`gumdrop-${STAMP}.vox`, VOX);
    const a = await handleModels(get('/models'), store, NOW);
    expect(a.status).toBe(200);
    expect(a.type).toBe('text/html; charset=utf-8');
    const page = text(a.body);
    expect(page).toContain('href="models/out/dinnerRoll.vox"');
    expect(page).toContain('href="models/out/tom.vox"');
    expect(page).toContain(`gumdrop-${STAMP}.vox`);
    expect(page).toContain('<input type="file">');
  });

  it('with a slash after it, the page sends you to itself without one, so its links work', async () => {
    expect(await handleModels(get('/models/'), fakeStore(), NOW)).toEqual({
      status: 301,
      body: '',
      type: 'text/plain; charset=utf-8',
      headers: { location: '../models' },
    });
  });

  it('a model downloads as a file', async () => {
    const a = await handleModels(get('/models/out/tom.vox'), fakeStore({ 'tom.vox': VOX }), NOW);
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
      expect((await handleModels(get(path), store, NOW)).status, path).toBe(404);
    }
  });
});

describe('taking models back', () => {
  it('a model sent in lands in the inbox under its name and the time', async () => {
    const store = fakeStore();
    const a = await handleModels(send('tom.vox'), store, NOW);
    expect([a.status, text(a.body)]).toEqual([201, `tom-${STAMP}.vox`]);
    expect(store.saved).toEqual({ [`tom-${STAMP}.vox`]: VOX });
  });

  it('never over another: a second in the same second gets -2', async () => {
    const store = fakeStore();
    await handleModels(send('tom.vox'), store, NOW);
    expect(text((await handleModels(send('tom.vox'), store, NOW)).body)).toBe(`tom-${STAMP}-2.vox`);
  });

  it('takes whatever the phone called the file, making a name the inbox lists', async () => {
    const cases: [string, string][] = [
      ['witch (1).vox', 'witch-1'],
      ['_witch.VOX', 'witch'],
      ['../../play.jsonl', 'play-jsonl'],
      ['ведьма.vox', 'model'],
      ['a'.repeat(80) + '.vox', 'a'.repeat(40)],
    ];
    for (const [name, stem] of cases) {
      const store = fakeStore();
      const a = await handleModels(send(name), store, NOW);
      expect(text(a.body), name).toBe(`${stem}-${STAMP}.vox`);
      expect(await store.list('inbox'), name).toEqual([`${stem}-${STAMP}.vox`]);
    }
  });

  it("refuses what isn't a .vox, a send not from the page, or a full inbox, with the reason, saving nothing", async () => {
    const full = fakeStore();
    for (let i = 0; i < 200; i++) full.saved[`m${i}-${STAMP}.vox`] = VOX;
    const cases: [ModelRequest, ModelStore, number, string][] = [
      [send('tom.vox', new Uint8Array([1, 2, 3, 4])), fakeStore(), 400, "it isn't a .vox file"],
      [
        send('tom.vox', new Uint8Array(1536 * 1024 + 1)),
        fakeStore(),
        413,
        'a model is at most 1.5 MB',
      ],
      [
        { ...send('tom.vox'), fromPage: false },
        fakeStore(),
        403,
        'send models from the models page',
      ],
      [send('tom.vox'), full, 507, 'the inbox holds 200 models: clear it out first'],
    ];
    for (const [request, store, status, reason] of cases) {
      const a = await handleModels(request, store, NOW);
      expect([a.status, text(a.body)], reason).toEqual([status, reason]);
    }
  });

  it('a save that fails is a 500 naming why, not a silent 201', async () => {
    const a = await handleModels(send('tom.vox'), fakeStore({}, new Error('disk full')), NOW);
    expect([a.status, text(a.body)]).toEqual([500, 'disk full']);
  });

  it('other methods are refused', async () => {
    const a = await handleModels(
      { ...get('/models/out/tom.vox'), method: 'DELETE' },
      fakeStore(),
      NOW,
    );
    expect(a.status).toBe(405);
  });
});

describe('the models folder', () => {
  it('unset, the models answer 503 naming the setting, and the play log still starts', async () => {
    const a = await handleModels(get('/models'), null, NOW);
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

  it('keeps models in out/ and inbox/, listing only models, never saving over one', async () => {
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
    await expect(store.save('tom-x.vox', VOX)).rejects.toMatchObject({ code: 'EEXIST' });
  });
});
