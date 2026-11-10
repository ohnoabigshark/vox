import { describe, expect, it } from 'vitest';
import { readSetLink, SETS } from '../../src/sets';

/** The link picks a set by its number (docs/PLAN.md, Sets, c7; Thanksgiving map j7). */
const read = (query: string) => readSetLink(new URLSearchParams(query));

describe('?set=', () => {
  it('plays Halloween with no ?set=, or an empty one', () => {
    expect(read('')).toEqual({ set: SETS[0], notice: null });
    expect(read('set=')).toEqual({ set: SETS[0], notice: null });
  });

  it('plays Halloween, Get Jack Back, at ?set=1', () => {
    expect(read('set=1')).toEqual({ set: { number: 1, name: 'Get Jack Back' }, notice: null });
  });

  it('plays Halloween at a number with no set behind it, and says so', () => {
    expect(read('set=2')).toEqual({
      set: SETS[0],
      notice: "There's no set 2 yet. Playing Get Jack Back.",
    });
    expect(read('set=pumpkin').notice).toBe("There's no set pumpkin yet. Playing Get Jack Back.");
  });
});
