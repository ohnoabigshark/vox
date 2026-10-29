import { describe, expect, it } from 'vitest';
import { draftStore, idFromName } from '../../src/dev/playEditor/drafts';
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

describe('drafts kept on the phone', () => {
  it('lists saved drafts newest first, and a saved draft replaces its older self', async () => {
    let t = 1000;
    const store = draftStore(memoryStorage(), () => t);
    await store.save('a', play('Bootleg'));
    t = 2000;
    await store.save('b', play('Flood Left'));
    t = 3000;
    await store.save('a', play('Bootleg 2'));
    expect(await store.list()).toEqual({
      drafts: [
        { key: 'a', play: play('Bootleg 2'), edited: 3000 },
        { key: 'b', play: play('Flood Left'), edited: 2000 },
      ],
      problem: null,
    });
  });

  it('deletes a draft', async () => {
    const store = draftStore(memoryStorage(), () => 1);
    await store.save('a', play('Bootleg'));
    await store.remove('a');
    expect(await store.list()).toEqual({ drafts: [], problem: null });
  });

  it("a draft that can't be read is left out, and the list says so", async () => {
    const storage = memoryStorage();
    const store = draftStore(storage, () => 1);
    await store.save('a', play('Bootleg'));
    const saved = JSON.parse(storage.data.values().next().value ?? '{}') as { drafts: unknown[] };
    saved.drafts.push({ key: 'x', edited: 2, link: '{oops' });
    storage.data.set([...storage.data.keys()][0] ?? '', JSON.stringify(saved));
    expect(await store.list()).toEqual({
      drafts: [{ key: 'a', play: play('Bootleg'), edited: 1 }],
      problem: "1 saved draft can't be read and isn't shown.",
    });
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
    const store = draftStore(broken, () => 1);
    expect(await store.list()).toEqual({
      drafts: [],
      problem: "This browser isn't keeping drafts (private browsing?).",
    });
    await expect(store.save('a', play('Bootleg'))).rejects.toThrow(
      "This browser isn't keeping drafts (private browsing?).",
    );
  });

  it('a play gets its id from its name, as plays.ts ids look', () => {
    expect(idFromName('Curl & Flat 2')).toBe('curlFlat2');
    expect(idFromName("  Bob's  deep SHOT ")).toBe('bobsDeepShot');
    expect(idFromName('!!!')).toBe('play');
  });
});
