import { afterEach, describe, expect, it } from 'vitest';
import { loadSettings, saveSettings } from '../src/settings';

/** A phone's storage, for the test (the tests run without a browser). */
const store = (saved: Record<string, string> = {}): Record<string, string> => {
  const items = { ...saved };
  Object.assign(globalThis, {
    localStorage: {
      getItem: (k: string) => items[k] ?? null,
      setItem: (k: string, v: string) => (items[k] = v),
    },
  });
  return items;
};

afterEach(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

/** The names switch is remembered on the phone (docs/SELECT.md, n3 and test 7). */
describe('the names switch setting', () => {
  it('defaults to on', () => {
    store();
    expect(loadSettings().names).toBe(true);
  });

  it('saves and loads off', () => {
    store();
    saveSettings({ ...loadSettings(), names: false });
    expect(loadSettings().names).toBe(false);
  });

  it('a setting saved before the switch existed reads as on, keeping the rest', () => {
    store({
      'getJackBack.settings': JSON.stringify({ version: 1, audioOffsetMs: 40, haptics: false }),
    });
    expect(loadSettings()).toEqual({ audioOffsetMs: 40, haptics: false, names: true });
  });

  it('with no storage at all, on', () => {
    expect(loadSettings().names).toBe(true);
  });
});
