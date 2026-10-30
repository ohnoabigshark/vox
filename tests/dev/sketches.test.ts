import { describe, expect, it } from 'vitest';
import { inGameOf, inGamePlays, sketchStore, idFromName } from '../../src/dev/playEditor/sketches';
import { playToLink } from '../../src/arcade/content/playCode';
import type { Assignment, Play } from '../../src/arcade/content/plays';

const block: Assignment = { kind: 'block' };
const route = (...to: [number, number][]): Assignment => ({
  kind: 'route',
  to: to.map(([x, y]) => ({ x, y })),
});
const play = (name: string): Play => ({
  id: idFromName(name),
  name,
  slots: [
    block,
    block,
    route([-2, 6]),
    route([2, 6]),
    route([0, 10]),
    route([0, 10]),
    route([0, 8]),
  ],
});

/** A stand-in for the browser's localStorage. */
const memoryStorage = (): Pick<Storage, 'getItem' | 'setItem'> & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

describe('sketches kept on the phone', () => {
  it('lists saved sketches newest first, and a saved sketch replaces its older self', async () => {
    let t = 1000;
    const store = sketchStore(memoryStorage(), () => t);
    await store.save('a', play('Bootleg'));
    t = 2000;
    await store.save('b', play('Flood Left'));
    t = 3000;
    await store.save('a', play('Bootleg 2'));
    expect(await store.list()).toEqual({
      sketches: [
        { key: 'a', play: play('Bootleg 2'), edited: 3000, inGame: false },
        { key: 'b', play: play('Flood Left'), edited: 2000, inGame: false },
      ],
      problem: null,
    });
  });

  it('deletes a sketch', async () => {
    const store = sketchStore(memoryStorage(), () => 1);
    await store.save('a', play('Bootleg'));
    await store.remove('a');
    expect(await store.list()).toEqual({ sketches: [], problem: null });
  });

  it("a sketch that can't be read is left out, and the list says so", async () => {
    const storage = memoryStorage();
    const store = sketchStore(storage, () => 1);
    await store.save('a', play('Bootleg'));
    const saved = JSON.parse(storage.data.values().next().value ?? '{}') as { sketches: unknown[] };
    saved.sketches.push({ key: 'x', edited: 2, link: '{oops' });
    storage.data.set([...storage.data.keys()][0] ?? '', JSON.stringify(saved));
    expect(await store.list()).toEqual({
      sketches: [{ key: 'a', play: play('Bootleg'), edited: 1, inGame: false }],
      problem: "1 saved sketch can't be read and isn't shown.",
    });
  });

  it('sketches saved by another version of the editor are reported, and never overwritten', async () => {
    const storage = memoryStorage();
    const store = sketchStore(storage, () => 1);
    await store.save('a', play('Bootleg'));
    const key = [...storage.data.keys()][0] ?? '';
    const later = JSON.stringify({
      version: 99,
      sketches: [{ key: 'z', edited: 5, anything: true }],
    });
    storage.data.set(key, later);
    expect(await store.list()).toEqual({
      sketches: [],
      problem:
        "Your saved sketches are from another version of the play editor, so they can't be shown.",
    });
    await expect(store.save('b', play('Flood Left'))).rejects.toThrow('from another version');
    expect(storage.data.get(key)).toBe(later);
  });

  it('when the browser keeps nothing, the list says why instead of looking empty', async () => {
    const broken = {
      getItem: (): string => {
        throw new Error('denied');
      },
      setItem: (): void => {
        throw new Error('denied');
      },
    };
    const store = sketchStore(broken, () => 1);
    expect(await store.list()).toEqual({
      sketches: [],
      problem: "This browser isn't keeping sketches (private browsing?).",
    });
    await expect(store.save('a', play('Bootleg'))).rejects.toThrow(
      "This browser isn't keeping sketches (private browsing?).",
    );
  });

  it('drafts saved before the rename are listed as sketches, and the next save keeps them', async () => {
    const storage = memoryStorage();
    const old = JSON.stringify({
      version: 1,
      drafts: [{ key: 'a', edited: 7, link: playToLink(play('Bootleg')) }],
    });
    storage.data.set('getJackBack.playEditor.drafts', old);
    const store = sketchStore(storage, () => 9);
    expect(await store.list()).toEqual({
      sketches: [{ key: 'a', play: play('Bootleg'), edited: 7, inGame: false }],
      problem: null,
    });
    await store.save('b', play('Flood Left'));
    expect(JSON.parse(storage.data.get('getJackBack.playEditor.sketches') ?? 'null')).toEqual({
      version: 1,
      sketches: [
        { key: 'a', edited: 7, link: playToLink(play('Bootleg')) },
        { key: 'b', edited: 9, link: playToLink(play('Flood Left')) },
      ],
    });
    // The old copy is left as it was, never written over.
    expect(storage.data.get('getJackBack.playEditor.drafts')).toBe(old);
  });

  it('old drafts carry over once: deleting every sketch does not bring them back', async () => {
    const storage = memoryStorage();
    storage.data.set(
      'getJackBack.playEditor.drafts',
      JSON.stringify({
        version: 1,
        drafts: [{ key: 'a', edited: 7, link: playToLink(play('Bootleg')) }],
      }),
    );
    const store = sketchStore(storage, () => 9);
    await store.remove('a');
    expect(await store.list()).toEqual({ sketches: [], problem: null });
  });

  it("old drafts that can't be read are reported, and nothing is saved over them", async () => {
    const storage = memoryStorage();
    storage.data.set('getJackBack.playEditor.drafts', '{oops');
    const store = sketchStore(storage, () => 9);
    expect(await store.list()).toEqual({
      sketches: [],
      problem: "Your saved sketches can't be read, so they can't be shown.",
    });
    await expect(store.save('b', play('Flood Left'))).rejects.toThrow("can't be read");
    expect([...storage.data.entries()]).toEqual([['getJackBack.playEditor.drafts', '{oops']]);
  });

  it('the In the game switch is kept per sketch, and saving the sketch again keeps it', async () => {
    let t = 1;
    const store = sketchStore(memoryStorage(), () => t++);
    await store.save('a', play('Bootleg'));
    await store.save('b', play('Flood Left'));
    await store.setInGame('a', true);
    await store.save('a', play('Bootleg 2'));
    const { sketches } = await store.list();
    expect(sketches.map((d) => [d.key, d.inGame])).toEqual([
      ['a', true],
      ['b', false],
    ]);
    await store.setInGame('a', false);
    expect((await store.list()).sketches.map((d) => d.inGame)).toEqual([false, false]);
  });

  it('only a sketch with no problems switches on; one that has them says why', async () => {
    const store = sketchStore(memoryStorage(), () => 1);
    const broken: Play = {
      ...play('Wing Slant'),
      slots: play('Wing Slant').slots.map((a, i) => (i === 6 ? block : a)),
    };
    await store.save('w', broken);
    await expect(store.setInGame('w', true)).rejects.toThrow(
      'Fix Wing Slant first: C3 is blocking. Only Blockers block: give it a route.',
    );
    expect((await store.list()).sketches.map((d) => d.inGame)).toEqual([false]);
  });

  it('sketches saved before the switch existed start off', async () => {
    const storage = memoryStorage();
    storage.data.set(
      'getJackBack.playEditor.sketches',
      JSON.stringify({
        version: 1,
        sketches: [{ key: 'a', edited: 7, link: playToLink(play('Bootleg')) }],
      }),
    );
    expect((await sketchStore(storage, () => 9).list()).sketches.map((d) => d.inGame)).toEqual([
      false,
    ]);
  });

  it("switching a sketch that isn't saved says so", async () => {
    const store = sketchStore(memoryStorage(), () => 1);
    await expect(store.setInGame('gone', true)).rejects.toThrow(
      "That sketch isn't saved any more.",
    );
  });

  it('a play gets its id from its name, as plays.ts ids look', () => {
    expect(idFromName('Curl & Flat 2')).toBe('curlFlat2');
    expect(idFromName("  Bob's  deep SHOT ")).toBe('bobsDeepShot');
    expect(idFromName('!!!')).toBe('play');
  });
});

describe('sketches in the full game (map round 6)', () => {
  const broken: Play = {
    ...play('Wing Slant'),
    slots: play('Wing Slant').slots.map((a, i) => (i === 6 ? block : a)),
  };
  const sketch = (key: string, p: Play, inGame: boolean) => ({ key, play: p, edited: 1, inGame });

  it('a sketch is off, dealt, or switched on but sitting out with problems', () => {
    expect(inGameOf(sketch('a', play('Bootleg'), false))).toBe('off');
    expect(inGameOf(sketch('a', play('Bootleg'), true))).toBe('dealt');
    expect(inGameOf(sketch('a', broken, true))).toBe('sitsOut');
    expect(inGameOf(sketch('a', broken, false))).toBe('off');
  });

  it('deals only switched-on sketches with no problems, oldest first, each with its key as its id', () => {
    expect(
      inGamePlays([
        sketch('s3', play('Curl & Flat 2'), true),
        sketch('s2', play('Bootleg'), false),
        sketch('s4', broken, true),
        sketch('s1', play('Curl & Flat 2'), true),
      ]),
    ).toEqual([
      { ...play('Curl & Flat 2'), id: 's1' },
      { ...play('Curl & Flat 2'), id: 's3' },
    ]);
  });
});
