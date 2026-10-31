import { describe, expect, it } from 'vitest';
import { FIRST_KEPT, benchStore, type Kept } from '../../src/dev/bench/keep';

/** docs/BENCH.md, test 15 and the rework's test G: what the bench keeps on the phone. */

const memoryStorage = (): Pick<Storage, 'getItem' | 'setItem'> & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

const kept: Kept = {
  test: 'snag',
  situation: { drive: 9, tacklers: 2, crowd: 2, handsGap: -20 },
  toggles: { again: false, sound: true, buzz: false, timing: true },
};

describe('the settings kept on the phone', () => {
  it('G: the open tab, the situation and the toggles come back after a reload', async () => {
    const storage = memoryStorage();
    await benchStore(storage).save(kept);
    expect(await benchStore(storage).load()).toEqual({ kept, problem: null });
  });

  it('start afresh when nothing is kept', async () => {
    expect(await benchStore(memoryStorage()).load()).toEqual({ kept: FIRST_KEPT, problem: null });
  });

  it('pull a situation outside its range back inside it', async () => {
    const storage = memoryStorage();
    await benchStore(storage).save({
      ...kept,
      situation: { drive: 99, tacklers: 0, crowd: 7, handsGap: 100 },
    });
    const { kept: back, problem } = await benchStore(storage).load();
    expect(problem).toBeNull();
    expect(back.situation).toEqual({ drive: 20, tacklers: 1, crowd: 3, handsGap: 40 });
  });

  it('G: slider values kept before the rework are not brought back: the bench opens at what the game plays', async () => {
    const storage = memoryStorage();
    storage.data.set(
      'getJackBack.testBench',
      JSON.stringify({ version: 1, ...kept, settings: { 'snag.maxDots': 8 } }),
    );
    const { kept: back, problem } = await benchStore(storage).load();
    expect(problem).toBeNull();
    expect(back).toEqual(kept);
    expect('settings' in back).toBe(false);
    await benchStore(storage).save(back);
    expect(storage.data.get('getJackBack.testBench')).not.toContain('settings');
  });

  it("start afresh, and say why, when storage can't be read", async () => {
    const garbled = memoryStorage();
    garbled.data.set('getJackBack.testBench', '{nope');
    expect(await benchStore(garbled).load()).toEqual({
      kept: FIRST_KEPT,
      problem: "The bench's kept tab and situation can't be read, so it starts afresh.",
    });
    const refusing = {
      getItem: (): string | null => {
        throw new Error('denied');
      },
      setItem: (): void => {
        throw new Error('denied');
      },
    };
    expect(await benchStore(refusing).load()).toEqual({
      kept: FIRST_KEPT,
      problem: "This browser isn't keeping the bench's settings (private browsing?).",
    });
    await expect(benchStore(refusing).save(kept)).rejects.toThrow(
      "This browser isn't keeping the bench's settings (private browsing?).",
    );
  });
});
