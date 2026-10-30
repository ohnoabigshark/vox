import { describe, expect, it } from 'vitest';
import type { Assignment, Play } from '../../src/arcade/content/plays';
import { playSlot } from '../../src/arcade/content/team';
import { createRun, dispatch, endDown, nextDown } from '../../src/arcade/sim/run';
import { step } from '../../src/arcade/sim/step';
import type { ArcadeEvent, DownResult, RunState } from '../../src/arcade/sim/types';

const block: Assignment = { kind: 'block' };
const route = (...to: [number, number][]): Assignment => ({
  kind: 'route',
  to: to.map(([x, y]) => ({ x, y })),
});
const slots = (): Assignment[] => [
  block,
  block,
  route([-2, 6]),
  route([2, 6]),
  route([0, 10]),
  route([0, 10]),
  route([0, 8]),
];
const passPlay = (id: string): Play => ({ id, name: id, slots: slots() });

/** The ids of the cards in the hand. */
const handIds = (s: RunState): (string | undefined)[] => s.hand.map((i) => s.playbook[i]?.id);

/** The hands of a run's first four downs, each down ending incomplete. */
const firstHands = (s: RunState): (string | undefined)[][] => {
  const hands = [handIds(s)];
  for (let d = 0; d < 3; d++) {
    endDown(s, 'incomplete', 0, []);
    nextDown(s, []);
    hands.push(handIds(s));
  }
  return hands;
};

describe("a run's playbook", () => {
  it('with the play pool, a seeded run deals exactly what it did before playbooks', () => {
    // Recorded from the game before runs carried a playbook (2026-10-29).
    expect(firstHands(createRun(1))).toEqual([
      ['slants', 'deepShot', 'sweep'],
      ['deepShot', 'sweep', 'curlFlat'],
      ['deepShot', 'slants', 'sweep'],
      ['slants', 'dive', 'sweep'],
    ]);
    expect(firstHands(createRun(7))).toEqual([
      ['curlFlat', 'dive', 'sweep'],
      ['curlFlat', 'dive', 'sweep'],
      ['curlFlat', 'sweep', 'dive'],
      ['curlFlat', 'deepShot', 'dive'],
    ]);
  });

  it('deals only from its own playbook', () => {
    const s = createRun(3, undefined, 0, { playbook: [passPlay('a'), passPlay('b')] });
    for (const hand of firstHands(s)) expect([...hand].sort()).toEqual(['a', 'b']);
  });

  it('runs its own plays: a handoff in the playbook hands off at the hike', () => {
    const run: Play = { ...passPlay('run'), handoff: 2 };
    let s = createRun(3, undefined, 0, { playbook: [run] });
    s = dispatch(s, { type: 'call', hand: 0 }).state;
    const { events } = dispatch(s, { type: 'hike' });
    expect(events.map((e: ArcadeEvent) => e.type)).toContain('handoff');
  });
});

describe('practice (Try it): one sketch, rep after rep', () => {
  /** Where a rep lines up: the down, the line, the hand, the call and the mirror. */
  const lineUp = (s: RunState) => ({
    phase: s.phase,
    down: s.drive.down,
    los: s.drive.los,
    hand: handIds(s),
    called: s.called,
    play: s.play,
    slots: s.field.players.map((p) => p.slot),
  });

  /** Where each body stands and what it will do: a mirrored play differs here. */
  const jobs = (s: RunState) => s.field.players.map((p) => ({ pos: p.pos, job: p.job }));

  it('deals only the sketch, already called, at 1st & 10', () => {
    const s = createRun(5, undefined, 0, { practice: passPlay('mine') });
    expect(lineUp(s)).toEqual({
      phase: 'setup',
      down: 1,
      los: 0,
      hand: ['mine'],
      called: 0,
      play: { index: 0, flipped: false },
      // Jack, then the seven.
      slots: [-1, 0, 1, 2, 3, 4, 5, 6],
    });
  });

  it('after every kind of ending, on any down, the next rep is the same spot, Flip kept', () => {
    const endings: [DownResult, number][] = [
      ['tackled', 6],
      ['firstDown', 14],
      ['incomplete', 0],
      ['batted', 0],
      ['sacked', -3],
      ['outOfBounds', 2],
    ];
    for (const [result, at] of endings) {
      for (const down of [1, 4]) {
        let s = createRun(5, undefined, 0, { practice: passPlay('mine') });
        s = dispatch(s, { type: 'flip' }).state;
        const before = lineUp(s);
        const beforeJobs = jobs(s);
        s = dispatch(s, { type: 'hike' }).state;
        s.drive.down = down;
        endDown(s, result, at, []);
        const events: ArcadeEvent[] = [];
        nextDown(s, events);
        expect(lineUp(s), `${result} on down ${down}`).toEqual(before);
        expect(jobs(s), `${result} on down ${down}`).toEqual(beforeJobs);
        expect(before.play.flipped).toBe(true);
        expect(
          events.map((e) => e.type),
          `${result} on down ${down}`,
        ).not.toContain('gameOver');
      }
    }
  });

  it('a rep played out in the sim lines up the same spot again', () => {
    let s = createRun(5, undefined, 0, { practice: passPlay('mine') });
    const start = lineUp(s);
    const startJobs = jobs(s);
    s = dispatch(s, { type: 'hike' }).state;
    // Never throwing: the pocket collapses and the rep ends in a sack.
    let ended = false;
    for (let i = 0; i < 60 * 60 && !(ended && s.phase === 'setup'); i++) {
      s = step(s, {}).state;
      if (s.phase === 'downOver') ended = true;
    }
    expect(ended).toBe(true);
    expect(lineUp(s)).toEqual(start);
    expect(jobs(s)).toEqual(startJobs);
  });

  it('a handoff sketch hands off to its Runner, and flipped, to the other Runner', () => {
    const mine: Play = { ...passPlay('mine'), handoff: 2 };
    for (const flipped of [false, true]) {
      let s = createRun(3, undefined, 0, { practice: mine });
      if (flipped) s = dispatch(s, { type: 'flip' }).state;
      const { state, events } = dispatch(s, { type: 'hike' });
      const handoff = events.find((e: ArcadeEvent) => e.type === 'handoff');
      const runner = state.field.players.find(
        (p) => p.id === (handoff?.type === 'handoff' ? handoff.id : -1),
      );
      expect(runner?.slot, `flipped ${flipped}`).toBe(playSlot(2, flipped));
    }
  });
});

describe("a play's line-up", () => {
  /** The standard line-up, with R2 moved up and right and C3 moved to the other side. */
  const moved = [
    { x: -0.9, y: -0.7 },
    { x: 0.9, y: -0.7 },
    { x: -1.1, y: -4.5 },
    { x: 3, y: -2 },
    { x: -7, y: -0.7 },
    { x: 7, y: -0.7 },
    { x: -3, y: -1.5 },
  ];
  const mine: Play = { ...passPlay('mine'), lineup: moved };
  const body = (s: RunState, slot: number) => {
    const p = s.field.players.find((q) => q.slot === slot);
    return { pos: p?.pos, to: p?.job.kind === 'route' ? p.job.to : undefined };
  };

  it('lines each player up where the play says, its route starting there', () => {
    const s = createRun(5, undefined, 0, { practice: mine });
    expect(body(s, 3)).toEqual({ pos: { x: 3, y: -2 }, to: [{ x: 5, y: 4 }] });
    expect(body(s, 6)).toEqual({ pos: { x: -3, y: -1.5 }, to: [{ x: -3, y: 6.5 }] });
  });

  it('flipped, the line-up is the mirror picture: partners swap spots as well as jobs', () => {
    const s = dispatch(createRun(5, undefined, 0, { practice: mine }), { type: 'flip' }).state;
    // R1 takes R2's spot and route, mirrored; C3 has no partner, so it mirrors its own.
    expect(body(s, 2)).toEqual({ pos: { x: -3, y: -2 }, to: [{ x: -5, y: 4 }] });
    expect(body(s, 6)).toEqual({ pos: { x: 3, y: -1.5 }, to: [{ x: 3, y: 6.5 }] });
  });

  it('a play without a line-up stands in the standard line-up', () => {
    const s = createRun(5, undefined, 0, { practice: passPlay('plain') });
    expect(s.field.players.map((p) => p.pos)).toEqual([
      { x: 0, y: -4 },
      { x: -0.9, y: -0.7 },
      { x: 0.9, y: -0.7 },
      { x: -1.1, y: -4.5 },
      { x: 1.1, y: -4.5 },
      { x: -7, y: -0.7 },
      { x: 7, y: -0.7 },
      { x: 4.2, y: -1.2 },
    ]);
  });
});
