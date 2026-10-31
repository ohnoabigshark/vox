import { describe, expect, it } from 'vitest';
import { readModes } from '../../src/arcade/content/modeFlags';

/** The modes read from a query written as text. */
const modes = (query: string) => readModes(new URLSearchParams(query));

// Decision map b2 and o1 (release mode, 2026-10-31): hard mode and two-tap
// throwing are the defaults; ?hard=0 and ?aim=1 switch them off.
describe('readModes', () => {
  it('plays hard mode with two-tap throwing when the link says nothing', () => {
    expect(modes('')).toEqual({ hard: true, twoTapAim: true });
  });

  it('turns hard mode off with ?hard=0 and keeps two-tap throwing', () => {
    expect(modes('?hard=0')).toEqual({ hard: false, twoTapAim: true });
  });

  it('throws with the one-tap sweep with ?aim=1 and keeps hard mode', () => {
    expect(modes('?aim=1')).toEqual({ hard: true, twoTapAim: false });
  });

  it("plays esrauch's original game with ?hard=0&aim=1", () => {
    expect(modes('?hard=0&aim=1')).toEqual({ hard: false, twoTapAim: false });
  });

  it('reads the old ?hard=1&aim=2 links as the default', () => {
    expect(modes('?hard=1&aim=2')).toEqual(modes(''));
  });

  it('leaves the default for a value it does not know', () => {
    expect(modes('?hard=yes&aim=3')).toEqual({ hard: true, twoTapAim: true });
    expect(modes('?hard&aim=')).toEqual({ hard: true, twoTapAim: true });
  });

  it('is not moved by the other link options', () => {
    expect(modes('?snag=1&tip=1&area=2&seed=7&monsters=1')).toEqual({
      hard: true,
      twoTapAim: true,
    });
    expect(modes('?seed=7&hard=0&snag=1&aim=1')).toEqual({ hard: false, twoTapAim: false });
  });

  it('plays a practice link with no aim with two-tap throwing', () => {
    expect(modes('?try=%7B%7D&sketch=s1').twoTapAim).toBe(true);
  });
});
