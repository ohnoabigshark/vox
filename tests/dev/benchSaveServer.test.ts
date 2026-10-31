import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfigFromFile } from 'vite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { tuningDefaults } from '../../src/arcade/content/tuning';
import { benchCheck } from '../../tools/benchSave';
import {
  gitInServedGame,
  handleSave,
  savedFileWriter,
  type SavedFileDeps,
} from '../../tools/savedFile';

/** docs/BENCH.md, the rework's test F: the hot-reload server writes the saved file, never commits. */

describe('the save endpoint', () => {
  const fake = (): {
    written: string[];
    deps: SavedFileDeps;
  } => {
    const written: string[] = [];
    return {
      written,
      deps: {
        write: async (text) => void written.push(text),
        inServedGame: async () => written.length === 0,
        check: benchCheck(tuningDefaults),
      },
    };
  };

  it('F: GET says it can save, and whether the saved file is in the served game', async () => {
    const { deps } = fake();
    expect(await handleSave('GET', '', deps)).toEqual({
      status: 200,
      body: '{"inServedGame":true}',
    });
  });

  it('F: POST writes a valid settings object, sorted, as prettier writes JSON', async () => {
    const { deps, written } = fake();
    const r = await handleSave('POST', '{"snag.window":0.2,"snag.close":0.56}', deps);
    expect(r).toEqual({ status: 200, body: '{"inServedGame":false}' });
    expect(written).toEqual(['{\n  "snag.close": 0.56,\n  "snag.window": 0.2\n}\n']);
    await handleSave('POST', '{}', deps);
    expect(written[1]).toBe('{}\n');
  });

  it('F: anything else is turned away without writing', async () => {
    const { deps, written } = fake();
    expect(await handleSave('POST', 'not json', deps)).toEqual({
      status: 400,
      body: 'not JSON',
    });
    expect(await handleSave('POST', '[1]', deps)).toEqual({
      status: 400,
      body: 'saved-tuning.json is not an object of settings, so nothing saved was played',
    });
    expect(await handleSave('POST', '{"snag.nope":1}', deps)).toEqual({
      status: 400,
      body: 'saved-tuning.json: snag.nope is not a setting in tuning.ts, so it was left out',
    });
    expect(await handleSave('POST', '{"snag.close":"fast"}', deps)).toEqual({
      status: 400,
      body: 'saved-tuning.json: snag.close is not a number ("fast"), so it was left out',
    });
    expect(await handleSave('PUT', '{}', deps)).toEqual({ status: 405, body: 'GET or POST' });
    expect(written).toEqual([]);
  });

  it('F: a failed write says why', async () => {
    const r = await handleSave('POST', '{}', {
      write: async () => {
        throw new Error('disk full');
      },
      inServedGame: async () => true,
      check: benchCheck(tuningDefaults),
    });
    expect(r).toEqual({ status: 500, body: 'disk full' });
  });
});

describe('the saved file in git', () => {
  let repo = '';
  const git = (...args: string[]): string =>
    execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim();

  beforeEach(async () => {
    repo = await mkdtemp(join(tmpdir(), 'bench-save-'));
    git('init', '-q');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'Test');
    await writeFile(join(repo, 'saved-tuning.json'), '{}\n');
    git('add', '.');
    git('commit', '-q', '-m', 'first');
  });
  afterEach(async () => {
    await rm(repo, { recursive: true, force: true });
  });

  it('F: a save writes the file and never commits; git says it is not in the served game until committed', async () => {
    const file = join(repo, 'saved-tuning.json');
    const head = git('rev-parse', 'HEAD');
    expect(await gitInServedGame(file)).toBe(true);
    await savedFileWriter(file)('{\n  "snag.close": 0.56\n}\n');
    expect(await readFile(file, 'utf8')).toBe('{\n  "snag.close": 0.56\n}\n');
    expect(git('rev-parse', 'HEAD')).toBe(head);
    expect(git('status', '--porcelain')).toBe('M saved-tuning.json');
    expect(await gitInServedGame(file)).toBe(false);
    git('commit', '-qam', 'save');
    expect(await gitInServedGame(file)).toBe(true);
  });
});

describe('the hot-reload server', () => {
  it("F: a save doesn't restart it: its config loads neither saved file (nor field events, test 6)", async () => {
    // Vite restarts the server, reloading every page, when a file its config
    // loaded changes; that would throw away the other tabs' unsaved moves.
    const loaded = await loadConfigFromFile(
      { command: 'serve', mode: 'development' },
      'vite.config.ts',
    );
    expect(loaded?.dependencies.length).toBeGreaterThan(0);
    expect(
      loaded?.dependencies.filter((d) =>
        /saved-tuning|tuning\.ts|saved-events|fieldEvents\.ts/.test(d),
      ),
    ).toEqual([]);
  });
});
