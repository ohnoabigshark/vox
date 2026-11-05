import { describe, expect, it } from 'vitest';
import { createRun, dispatch } from '../../src/arcade/sim/run';
import { nameTags } from '../../src/arcade/ui/nameTags';

/**
 * Names on the field (docs/REWARDS.md, playtest notes p6): before the snap,
 * each of your seven has its full name under it; never Jack, never a
 * defender; gone at HIKE!.
 */
describe('names on the field (p6)', () => {
  it('before the snap: your seven, by their roster names, at their feet', () => {
    const s = createRun(1);
    const tags = nameTags(s);
    expect(tags.map((t) => t.name)).toEqual(s.roster.map((p) => p.name));
    for (const t of tags) {
      const body = s.field.players.find((p) => p.id === t.id)!;
      expect(body.role).not.toBe('qb');
      expect(t.at).toEqual(body.pos);
    }
  });

  it('with a play called, still there; at HIKE! they go', () => {
    const called = dispatch(createRun(1), { type: 'call', hand: 0 }).state;
    expect(nameTags(called)).toHaveLength(7);
    const hiked = dispatch(called, { type: 'hike' }).state;
    expect(nameTags(hiked)).toEqual([]);
  });

  it('a recruit in a field slot is named by its own name', () => {
    const s = createRun(1);
    s.roster[2] = { ...s.roster[2]!, name: 'Boo Radish' };
    expect(nameTags(s)[2]!.name).toBe('Boo Radish');
  });
});
