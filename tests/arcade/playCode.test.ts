import { describe, expect, it } from 'vitest';
import {
  playFromLink,
  playToLink,
  playToSource,
  practiceQuery,
  readPractice,
} from '../../src/arcade/content/playCode';
import { readModes } from '../../src/arcade/content/modeFlags';
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
/** The standard line-up (team.ts, LINEUP), written out. */
const standard = [
  { x: -0.9, y: -0.7 },
  { x: 0.9, y: -0.7 },
  { x: -1.1, y: -4.5 },
  { x: 1.1, y: -4.5 },
  { x: -7, y: -0.7 },
  { x: 7, y: -0.7 },
  { x: 4.2, y: -1.2 },
];
/** Mine, with R2 moved up and right. */
const moved: Play = {
  ...mine,
  lineup: standard.map((spot, slot) => (slot === 3 ? { x: 3, y: -2 } : spot)),
};

describe('a play in a link', () => {
  it('comes back from the link exactly as it went in', () => {
    expect(playFromLink(playToLink(mine))).toEqual({ ok: true, play: mine });
    expect(playFromLink(playToLink(moved))).toEqual({ ok: true, play: moved });
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

  it('a tampered line-up is refused, with what is wrong with it', () => {
    const tamper = (l: unknown): string =>
      JSON.stringify({ ...(JSON.parse(playToLink(moved)) as object), l });
    const reason = "The play in this link has a line-up that isn't seven pairs of numbers.";
    expect(playFromLink(tamper([[0, -1]]))).toEqual({ ok: false, reason });
    expect(playFromLink(tamper(standard.map(() => [0, 'back'])))).toEqual({ ok: false, reason });
    expect(playFromLink(tamper('wide'))).toEqual({ ok: false, reason });
  });
});

describe('the practice link (Try it)', () => {
  it('carries the play and which sketch it is, so ‹ Sketch can go back to it', () => {
    const query = practiceQuery(mine, 'd1767000000000', true);
    expect(readPractice(`?${query}`)).toEqual({
      play: { ok: true, play: mine },
      sketch: 'd1767000000000',
    });
  });

  // Two-tap throwing is the game's default (readModes), so Try with: Two-tap
  // off has to say so in the link (release mode's map, b2).
  it('plays the throw Try with: Two-tap chose, on or off', () => {
    expect(readModes(`?${practiceQuery(mine, 'd1', true)}`).twoTapAim).toBe(true);
    expect(readModes(`?${practiceQuery(mine, 'd1', false)}`).twoTapAim).toBe(false);
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
    expect(readBack(playToSource(moved))).toEqual(moved);
  });

  it('writes a line-up only when it differs from the standard one', () => {
    expect(readBack(playToSource({ ...mine, lineup: standard }))).toEqual(mine);
    expect(playToSource(moved)).toContain(`    lineup: [
      { x: -0.9, y: -0.7 },
      { x: 0.9, y: -0.7 },
      { x: -1.1, y: -4.5 },
      { x: 3, y: -2 },
      { x: -7, y: -0.7 },
      { x: 7, y: -0.7 },
      { x: 4.2, y: -1.2 },
    ],
`);
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
