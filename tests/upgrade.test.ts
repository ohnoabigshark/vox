import { describe, expect, it } from 'vitest';
import { upgraded } from '../src/upgrade';

/** Saved data brought up to today's version by numbered steps (docs/rules.md, schemas by migrations). */
describe('upgraded', () => {
  const steps = {
    1: (x: Record<string, unknown>) => ({ ...x, v: 2, b: 'from 1' }),
    2: (x: Record<string, unknown>) => ({ ...x, v: 3, c: 'from 2' }),
  };

  it('every step from its version, in order', () => {
    expect(upgraded({ v: 1, a: 'kept' }, 'v', 3, steps)).toEqual({
      v: 3,
      a: 'kept',
      b: 'from 1',
      c: 'from 2',
    });
  });

  it('today’s version as it is', () => {
    expect(upgraded({ v: 3, a: 1 }, 'v', 3, steps)).toEqual({ v: 3, a: 1 });
  });

  it('a later version, a missing step or no version: null', () => {
    expect(upgraded({ v: 4 }, 'v', 3, steps)).toBeNull();
    expect(upgraded({ v: 0 }, 'v', 3, steps)).toBeNull();
    expect(upgraded({}, 'v', 3, steps)).toBeNull();
  });
});
