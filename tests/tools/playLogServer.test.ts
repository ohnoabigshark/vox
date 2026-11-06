import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { configFrom, handlePlayLog, rotatingAppend } from '../../tools/playLog/server';

/** docs/PLAY_LOG.md: the vox-log service (l1, l6). */

function collector() {
  const written: string[] = [];
  return { written, append: async (text: string) => void written.push(text) };
}

const line = { at: '2026-11-01T16:21:07.512Z', kind: 'event', down: 2 };

describe('the play log service: what it takes', () => {
  it('a POST of an array of lines appends one JSON line each', async () => {
    const c = collector();
    const r = await handlePlayLog(
      'POST',
      JSON.stringify([line, { ...line, kind: 'flag' }]),
      c.append,
    );
    expect(r).toEqual({ status: 204, body: '' });
    expect(c.written).toEqual([
      `${JSON.stringify(line)}\n${JSON.stringify({ ...line, kind: 'flag' })}\n`,
    ]);
  });

  it('anything else is refused, with the reason, and nothing written', async () => {
    const c = collector();
    const cases: [string, string][] = [
      ['{not json', 'not JSON'],
      [JSON.stringify(line), 'not an array of lines'],
      [JSON.stringify([line, { kind: 'event' }]), 'line 2 has no "at" or "kind"'],
      [JSON.stringify([line, 'text']), 'line 2 has no "at" or "kind"'],
    ];
    for (const [body, reason] of cases) {
      expect(await handlePlayLog('POST', body, c.append)).toEqual({ status: 400, body: reason });
    }
    expect(c.written).toEqual([]);
  });

  it('GET says it is recording; other methods are refused', async () => {
    const c = collector();
    expect(await handlePlayLog('GET', '', c.append)).toEqual({
      status: 200,
      body: '{"recording":true}',
    });
    expect(await handlePlayLog('PUT', '', c.append)).toEqual({ status: 405, body: 'GET or POST' });
  });

  it('a failed write is a 500 naming why, not a silent 204', async () => {
    const r = await handlePlayLog('POST', JSON.stringify([line]), async () => {
      throw new Error('ENOSPC: no space left on device');
    });
    expect(r).toEqual({ status: 500, body: 'ENOSPC: no space left on device' });
  });
});

describe('the play log service: its settings', () => {
  it('reads the file and the port (and the models folder, blank here: modelHandoff.test.ts)', () => {
    expect(configFrom({ PLAY_LOG: '/x/play.jsonl', PLAY_LOG_PORT: '9320' })).toEqual({
      file: '/x/play.jsonl',
      port: 9320,
      models: '',
    });
  });

  it('a blank or missing one refuses to start, naming it', () => {
    expect(() => configFrom({ PLAY_LOG_PORT: '9320' })).toThrow('PLAY_LOG is blank');
    expect(() => configFrom({ PLAY_LOG: '', PLAY_LOG_PORT: '9320' })).toThrow('PLAY_LOG is blank');
    expect(() => configFrom({ PLAY_LOG: '/x' })).toThrow('PLAY_LOG_PORT is blank');
    expect(() => configFrom({ PLAY_LOG: '/x', PLAY_LOG_PORT: 'abc' })).toThrow(
      'PLAY_LOG_PORT is not a port: abc',
    );
  });
});

describe('the play log service: keeping it (l6)', () => {
  it('past the size the file starts fresh, and only the last three old ones are kept', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'play-log-'));
    const file = join(dir, 'play.jsonl');
    const append = rotatingAppend(file, 10, 3);
    for (const text of [
      'aaaaaaaaaaaa\n',
      'b\n',
      'cccccccccccc\n',
      'dddddddddddd\n',
      'eeeeeeeeeeee\n',
      'f\n',
    ]) {
      await append(text);
    }
    expect((await readdir(dir)).sort()).toEqual([
      'play.1.jsonl',
      'play.2.jsonl',
      'play.3.jsonl',
      'play.jsonl',
    ]);
    expect(await readFile(file, 'utf8')).toBe('f\n');
    expect(await readFile(join(dir, 'play.1.jsonl'), 'utf8')).toBe('eeeeeeeeeeee\n');
    expect(await readFile(join(dir, 'play.2.jsonl'), 'utf8')).toBe('dddddddddddd\n');
    // The first file, a's, is gone: three old ones kept.
    expect(await readFile(join(dir, 'play.3.jsonl'), 'utf8')).toBe('b\ncccccccccccc\n');
  });

  it('under the size it just appends, making the folder if needed', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'play-log-'));
    const file = join(dir, 'new', 'play.jsonl');
    const append = rotatingAppend(file, 1000, 3);
    await append('a\n');
    await writeFile(join(dir, 'new', 'other'), '');
    await append('b\n');
    expect(await readFile(file, 'utf8')).toBe('a\nb\n');
  });
});
