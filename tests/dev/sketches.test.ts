import { describe, expect, it } from 'vitest';
import { sketchStore, idFromName } from '../../src/dev/playEditor/sketches';
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
        { key: 'a', play: play('Bootleg 2'), edited: 3000 },
        { key: 'b', play: play('Flood Left'), edited: 2000 },
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
      sketches: [{ key: 'a', play: play('Bootleg'), edited: 1 }],
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
      sketches: [{ key: 'a', play: play('Bootleg'), edited: 7 }],
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

  it('a play gets its id from its name, as plays.ts ids look', () => {
    expect(idFromName('Curl & Flat 2')).toBe('curlFlat2');
    expect(idFromName("  Bob's  deep SHOT ")).toBe('bobsDeepShot');
    expect(idFromName('!!!')).toBe('play');
  });
});
