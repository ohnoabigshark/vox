import { describe, expect, it } from 'vitest';
import { FIRST_KEPT, benchStore, type Kept } from '../../src/dev/bench/keep';

/** docs/BENCH.md, test 15: the bench's settings kept on the phone. */

const memoryStorage = (): Pick<Storage, 'getItem' | 'setItem'> & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

const kept: Kept = {
  test: 'snag',
  situation: { drive: 9, tacklers: 2, crowd: 2, handsGap: -20 },
  settings: { 'snag.close': 0.56, 'breakit.byArea.1.sweet': 0.1 },
  toggles: { again: false, sound: true, buzz: false, timing: true },
};

describe('the settings kept on the phone', () => {
  it('come back after a reload', async () => {
    const storage = memoryStorage();
    await benchStore(storage).save(kept);
    expect(await benchStore(storage).load()).toEqual({ kept, problem: null });
  });

  it('start from the shipped values when nothing is kept', async () => {
    expect(await benchStore(memoryStorage()).load()).toEqual({ kept: FIRST_KEPT, problem: null });
  });

  it('drop a slider that has gone, and pull a value outside its reach back inside it', async () => {
    const storage = memoryStorage();
    await benchStore(storage).save({
      ...kept,
      settings: { 'snag.close': 5, 'snag.gone': 1, 'snag.window': 0.01, 'crows.window': 0.7 },
      situation: { drive: 99, tacklers: 0, crowd: 7, handsGap: 100 },
    });
    const { kept: back, problem } = await benchStore(storage).load();
    expect(problem).toBeNull();
    expect(back.settings).toEqual({ 'snag.close': 1.28, 'snag.window': 0.06, 'crows.window': 0.7 });
    expect(back.situation).toEqual({ drive: 20, tacklers: 1, crowd: 3, handsGap: 40 });
  });

  it("start from the shipped values, and say why, when storage can't be read", async () => {
    const garbled = memoryStorage();
    garbled.data.set('getJackBack.testBench', '{nope');
    expect(await benchStore(garbled).load()).toEqual({
      kept: FIRST_KEPT,
      problem: "The bench's saved settings can't be read, so it starts from the shipped values.",
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
