import { describe, expect, it } from 'vitest';
import {
  playFromLink,
  playToLink,
  playToSource,
  practiceQuery,
  readPractice,
} from '../../src/arcade/content/playCode';
import { PLAYS, type Assignment, type Play } from '../../src/arcade/content/plays';

const block: Assignment = { kind: 'block' };
const route = (...to: [number, number][]): Assignment => ({
  kind: 'route',
  to: to.map(([x, y]) => ({ x, y })),
});
const mine: Play = {
  id: 'mine',
  name: 'Bootleg & Co.',
  slots: [
    block,
    block,
    route([-2, 6]),
    route([2.5, 5.5]),
    route([0, 10], [3, 14]),
    route([0, 7], [-1.5, 5.5]),
    route([0, 8]),
  ],
  handoff: 3,
};

describe('a play in a link', () => {
  it('comes back from the link exactly as it went in', () => {
    expect(playFromLink(playToLink(mine))).toEqual({ ok: true, play: mine });
    for (const p of PLAYS) expect(playFromLink(playToLink(p))).toEqual({ ok: true, play: p });
  });

  it('a link that is not a play says so, rather than being ignored', () => {
    expect(playFromLink('{oops')).toEqual({
      ok: false,
      reason: "The play in this link can't be read.",
    });
    expect(playFromLink('[1,2]')).toEqual({
      ok: false,
      reason: "The play in this link can't be read.",
    });
  });

  it('a tampered play is refused, with what is wrong with it', () => {
    const tamper = (change: (o: Record<string, unknown>) => void): string => {
      const o = JSON.parse(playToLink(mine)) as Record<string, unknown>;
      change(o);
      return JSON.stringify(o);
    };
    expect(playFromLink(tamper((o) => (o.s = (o.s as unknown[]).slice(0, 6))))).toEqual({
      ok: false,
      reason: 'The play in this link has 6 slots; a play has 7.',
    });
    expect(playFromLink(tamper((o) => (o.h = 5)))).toEqual({
      ok: false,
      reason: 'The play in this link hands off to C2; only a Runner can take a handoff.',
    });
    expect(playFromLink(tamper((o) => ((o.s as unknown[])[0] = [[0, 3]])))).toEqual({
      ok: false,
      reason: 'The play in this link gives B1 a route; Blockers always block.',
    });
    expect(playFromLink(tamper((o) => ((o.s as unknown[])[4] = [[0, 'far']])))).toEqual({
      ok: false,
      reason: "The play in this link has a waypoint for C1 that isn't a pair of numbers.",
    });
  });
});

describe('the practice link (Try it)', () => {
  it('carries the play and which sketch it is, so ‹ Sketch can go back to it', () => {
    const query = practiceQuery(mine, 'd1767000000000', true);
    expect(readPractice(`?${query}`)).toEqual({
      play: { ok: true, play: mine },
      sketch: 'd1767000000000',
    });
    expect(new URLSearchParams(query).get('aim')).toBe('2');
    expect(new URLSearchParams(practiceQuery(mine, 'd1', false)).has('aim')).toBe(false);
  });

  it('a broken play still says why, and still knows its sketch', () => {
    expect(readPractice('?try=%7Boops&sketch=d1')).toEqual({
      play: { ok: false, reason: "The play in this link can't be read." },
      sketch: 'd1',
    });
  });

  it('a link with no play is not practice', () => {
    expect(readPractice('?seed=3&aim=2')).toBeNull();
  });
});

describe('Copy code', () => {
  /** Read written source back the way plays.ts would: an object literal using block and route. */
  const readBack = (source: string): unknown =>
    new Function('block', 'route', `return ${source.trim().replace(/,$/, '')};`)(block, route);

  it('writes a play as plays.ts does, which reads back as the same play', () => {
    expect(readBack(playToSource(mine))).toEqual(mine);
    for (const p of PLAYS) expect(readBack(playToSource(p))).toEqual(p);
  });

  it('writes it in the style of plays.ts', () => {
    expect(
      playToSource({
        id: 'bob',
        name: "Bob's Bootleg",
        slots: [
          block,
          block,
          route([-2, 6]),
          route([2, 6]),
          route([0, 10], [3, 14]),
          route([0, 10]),
          route([0, 8]),
        ],
      }),
    ).toBe(`  {
    id: 'bob',
    name: 'Bob\\'s Bootleg',
    slots: [
      block,
      block,
      route([-2, 6]),
      route([2, 6]),
      route([0, 10], [3, 14]),
      route([0, 10]),
      route([0, 8]),
    ],
  },
`);
  });
});
