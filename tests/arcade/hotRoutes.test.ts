import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  HOT_ROUTES,
  hotRoutesFor,
  takesHotRoute,
  withHotRoutes,
  type HotRoute,
} from '../../src/arcade/content/hotRoutes';
import { PLAYS, type Play } from '../../src/arcade/content/plays';
import { PLAY_POOL } from '../../src/arcade/content/playPool';
import { playProblems, routePath } from '../../src/arcade/content/playRules';
import { LINEUP, ROSTER_ROLES, playSlot } from '../../src/arcade/content/team';
import { eventLines } from '../../src/arcade/log/playLog';
import { RunRecorder } from '../../src/arcade/record/recorder';
import { createRun, dispatch, routeWorks } from '../../src/arcade/sim/run';
import { step } from '../../src/arcade/sim/step';
import type { Action, ArcadeEvent, Player, RunState } from '../../src/arcade/sim/types';
import { arcadeTuning } from '../../src/arcade/content/tuning';
import { ORIGINAL_GAME } from './helpers';

/** docs/PLAYER_MENU.md, the `menu-routes` tests (the menu's map, c3). */

const play = (id: string): Play => PLAYS.find((p) => p.id === id)!;
const SLANTS = play('slants');
const DIVE = play('dive');
const C1 = 4; // lined up on the left, at -7
const C2 = 5; // on the right, at 7
const C3 = 6; // on the right, at 4.2
const R1 = 2; // on the left, at -1.1
const R2 = 3; // on the right, at 1.1

/** A run whose only card is this play, called (Flip on if `flipped`). */
function calledRun(card: Play, flipped = false, seed = 1): RunState {
  let s = createRun(seed, undefined, 0, { ...ORIGINAL_GAME, playbook: [card] });
  if (flipped) s = dispatch(s, { type: 'flip' }).state;
  return dispatch(s, { type: 'call', hand: 0 }).state;
}

/** These actions in turn. */
function acted(s: RunState, ...actions: Action[]): RunState {
  return actions.reduce((st, a) => dispatch(st, a).state, s);
}

/** Route tapped for this player, `n` times. */
const taps = (slot: number, n: number): Action[] =>
  Array.from({ length: n }, () => ({ type: 'hotRoute', slot }) as const);

const body = (s: RunState, slot: number): Player => s.field.players.find((p) => p.slot === slot)!;

/** Where this player's route goes on the field, relative to where they stand. */
function routeFrom(s: RunState, slot: number): { x: number; y: number }[] {
  const p = body(s, slot);
  if (p.job.kind !== 'route') throw new Error(`slot ${slot} has no route`);
  return p.job.to.map((w) => ({ x: w.x - p.pos.x, y: w.y - p.pos.y }));
}

/** The routes this player is on through `n` taps of Route, as drawn (null) first. */
function loop(s: RunState, slot: number, n: number): (HotRoute | null)[] {
  const seen: (HotRoute | null)[] = [s.hotRoutes[slot] ?? null];
  let st = s;
  for (let i = 0; i < n; i++) {
    st = dispatch(st, { type: 'hotRoute', slot }).state;
    seen.push(st.hotRoutes[slot] ?? null);
  }
  return seen;
}

describe('who can take one (test 1)', () => {
  it('Catchers and Runners on a passing play; never a Blocker', () => {
    expect(ROSTER_ROLES.map((_, slot) => takesHotRoute(SLANTS, slot, false))).toEqual([
      false,
      false,
      true,
      true,
      true,
      true,
      true,
    ]);
  });

  it('on a handoff, not the Runner who takes it (the other Runner on a flipped Dive)', () => {
    expect(takesHotRoute(DIVE, R1, false)).toBe(false);
    expect(takesHotRoute(DIVE, R2, false)).toBe(true);
    // Flipped, R1 and R2 swap assignments: R2 takes the handoff.
    expect(takesHotRoute(DIVE, R1, true)).toBe(true);
    expect(takesHotRoute(DIVE, R2, true)).toBe(false);
    expect(takesHotRoute(DIVE, C1, false)).toBe(true);
  });

  it('Route works for them, and not for the rest (the strip greys it)', () => {
    const slants = calledRun(SLANTS);
    expect(routeWorks(slants, 0)).toBe(false);
    expect(routeWorks(slants, 1)).toBe(false);
    expect(routeWorks(slants, C3)).toBe(true);
    expect(routeWorks(slants, R1)).toBe(true);
    const dive = calledRun(DIVE);
    expect(routeWorks(dive, R1)).toBe(false);
    expect(routeWorks(dive, R2)).toBe(true);
  });

  it('Route for a Blocker or the handoff Runner changes nothing', () => {
    const dive = calledRun(DIVE);
    for (const slot of [0, 1, R1]) {
      const { state, events } = dispatch(dive, { type: 'hotRoute', slot });
      expect(events).toEqual([]);
      expect(state.hotRoutes).toEqual({});
      expect(body(state, slot).job).toEqual(body(dive, slot).job);
    }
  });

  it('nothing until a card is called: the hot route is in place of the card’s', () => {
    const dealt = createRun(1, undefined, 0, { ...ORIGINAL_GAME, playbook: [SLANTS] });
    expect(dealt.called).toBeNull();
    expect(routeWorks(dealt, C3)).toBe(false);
    expect(dispatch(dealt, { type: 'hotRoute', slot: C3 }).events).toEqual([]);
  });
});

describe('the loop (test 2)', () => {
  it('each tap moves to the next route: as drawn, Go, Slant, Out, Post, Corner, Curl, as drawn', () => {
    // A Runner on the left, at -1.1: every route stays on the field.
    expect(loop(calledRun(SLANTS), R1, 8)).toEqual([
      null,
      'go',
      'slant',
      'out',
      'post',
      'corner',
      'curl',
      null,
      'go',
    ]);
  });

  it('skipping any that would leave the field from where they stand', () => {
    // C3 stands at 4.2 and the sideline is at 9.1: Out and Corner, 5 out, would leave it.
    expect(loop(calledRun(SLANTS), C3, 5)).toEqual([null, 'go', 'slant', 'post', 'curl', null]);
    expect(hotRoutesFor(SLANTS, C3, false)).toEqual(['go', 'slant', 'post', 'curl']);
  });

  it('the loop is the routes in order, less those that leave the field', () => {
    for (const card of PLAY_POOL) {
      for (const flipped of [false, true]) {
        for (let slot = 0; slot < ROSTER_ROLES.length; slot++) {
          const offered = hotRoutesFor(card, slot, flipped);
          if (!takesHotRoute(card, slot, flipped)) {
            expect(offered, `${card.id} ${slot}`).toEqual([]);
            continue;
          }
          const k = playSlot(slot, flipped);
          const onField = HOT_ROUTES.filter((r) =>
            routePath(withHotRoutes(card, { [slot]: r }, flipped), k).every(
              (p) => Math.abs(p.x) <= arcadeTuning.field.halfWidth,
            ),
          );
          expect(offered, `${card.id} ${slot} ${flipped}`).toEqual(onField);
        }
      }
    }
  });

  it('the route on the field changes at once', () => {
    const s = calledRun(SLANTS);
    const drawn = routeFrom(s, R1);
    const go = acted(s, ...taps(R1, 1));
    expect(routeFrom(go, R1)).toEqual([{ x: 0, y: 16 }]);
    expect(routeFrom(go, R1)).not.toEqual(drawn);
    expect(routeFrom(acted(s, ...taps(R1, 7)), R1)).toEqual(drawn);
  });
});

describe('the routes (test 3)', () => {
  it('each, from every spot it’s offered at, keeps the rules every play keeps', () => {
    for (const card of PLAY_POOL) {
      for (const flipped of [false, true]) {
        for (let slot = 0; slot < ROSTER_ROLES.length; slot++) {
          for (const route of hotRoutesFor(card, slot, flipped)) {
            const hot = withHotRoutes(card, { [slot]: route }, flipped);
            const k = playSlot(slot, flipped);
            expect(
              playProblems(hot).filter((p) => p.slot === k),
              `${card.id}, slot ${slot}${flipped ? ' flipped' : ''}, ${route}`,
            ).toEqual([]);
          }
        }
      }
    }
  });

  it('drawn for a player on the right: Go, Slant, Out, Post, Corner, Curl at their lengths', () => {
    // R2 stands at 1.1, on the right: out is +x.
    const s = calledRun(SLANTS);
    const shape = (n: number) => routeFrom(acted(s, ...taps(R2, n)), R2);
    expect(shape(1)).toEqual([{ x: 0, y: 16 }]);
    expect(shape(2)).toEqual([
      { x: 0, y: 2 },
      { x: -6, y: 12 },
    ]);
    expect(shape(3)).toEqual([
      { x: 0, y: 5 },
      { x: 5, y: 6 },
      { x: 5, y: 14 },
    ]);
    expect(shape(4)).toEqual([
      { x: 0, y: 8 },
      { x: -5, y: 16 },
    ]);
    expect(shape(5)).toEqual([
      { x: 0, y: 8 },
      { x: 5, y: 16 },
    ]);
    expect(shape(6)).toEqual([
      { x: 0, y: 10 },
      { x: -1.5, y: 8.5 },
    ]);
  });

  it('Out goes toward the player’s own sideline, and a left and a right player mirror each other', () => {
    const s = calledRun(SLANTS);
    const out = (slot: number) => routeFrom(acted(s, ...taps(slot, 3)), slot);
    expect(acted(s, ...taps(R1, 3)).hotRoutes[R1]).toBe('out');
    expect(out(R1).at(-1)!.x).toBeLessThan(0);
    expect(out(R2).at(-1)!.x).toBeGreaterThan(0);
    expect(out(R1)).toEqual(out(R2).map((w) => ({ x: 0 - w.x, y: w.y })));
    // In is toward the middle: C1's Slant (from the left) goes right, C2's goes left.
    const slant = (slot: number) => routeFrom(acted(s, ...taps(slot, 2)), slot);
    expect(slant(C1).at(-1)!.x).toBeGreaterThan(0);
    expect(slant(C2).at(-1)!.x).toBeLessThan(0);
  });

  it('a player lined up in the middle counts as on the right, or on the left with Flip', () => {
    const middle: Play = {
      ...SLANTS,
      id: 'middle',
      name: 'Middle',
      lineup: LINEUP.map((spot, slot) => (slot === C3 ? { x: 0, y: -2 } : spot)),
    };
    expect(playProblems(middle)).toEqual([]);
    const out = (flipped: boolean) => {
      const s = acted(calledRun(middle, flipped), ...taps(C3, 3));
      expect(s.hotRoutes[C3]).toBe('out');
      return routeFrom(s, C3).at(-1)!.x;
    };
    expect(out(false)).toBeGreaterThan(0);
    expect(out(true)).toBeLessThan(0);
  });
});

describe('they run it (test 4)', () => {
  it('after HIKE!, the player follows the hot route’s waypoints', () => {
    // C2, on the right at 7, on a Slant: 2 up, then in to 12.
    let s = acted(calledRun(SLANTS), ...taps(C2, 2), { type: 'hike' });
    expect(s.phase).toBe('play');
    const start = body(s, C2).pos;
    const job = body(s, C2).job;
    expect(job.kind === 'route' && job.to).toEqual([
      { x: start.x, y: start.y + 2 },
      { x: start.x - 6, y: start.y + 12 },
    ]);
    for (let i = 0; i < 90 && s.phase === 'play'; i++) s = step(s, {}).state;
    const now = body(s, C2);
    expect(now.job.kind === 'route' && now.job.index).toBe(1);
    expect(now.pos.x).toBeLessThan(start.x - 1);
  });
});

describe('Flip and cards (test 5)', () => {
  it('Flip mirrors hot routes and keeps them', () => {
    // C3 has no partner: Flip lines them up at -4.2, and their Slant still goes in, now to the right.
    const s = acted(calledRun(SLANTS), ...taps(C3, 2));
    const flipped = dispatch(s, { type: 'flip' }).state;
    expect(flipped.hotRoutes).toEqual({ [C3]: 'slant' });
    expect(routeFrom(flipped, C3)).toEqual(routeFrom(s, C3).map((w) => ({ x: 0 - w.x, y: w.y })));
    expect(body(flipped, C3).pos.x).toBeCloseTo(-body(s, C3).pos.x);
    // And back again.
    const back = dispatch(flipped, { type: 'flip' }).state;
    expect(routeFrom(back, C3)).toEqual(routeFrom(s, C3));
  });

  it('a player with a mirror partner keeps theirs, toward their own sideline', () => {
    const s = acted(calledRun(SLANTS), ...taps(C1, 2));
    const flipped = dispatch(s, { type: 'flip' }).state;
    expect(flipped.hotRoutes).toEqual({ [C1]: 'slant' });
    expect(routeFrom(flipped, C1)).toEqual(routeFrom(s, C1));
  });

  it('calling another card, or the same one, drops them all', () => {
    let s = createRun(1, undefined, 0, { ...ORIGINAL_GAME, playbook: [SLANTS, play('deepShot')] });
    s = acted(s, { type: 'call', hand: 0 }, ...taps(R1, 1), ...taps(C3, 2));
    expect(s.hotRoutes).toEqual({ [R1]: 'go', [C3]: 'slant' });
    const again = dispatch(s, { type: 'call', hand: 0 }).state;
    expect(again.hotRoutes).toEqual({});
    expect(routeFrom(again, R1)).toEqual(routeFrom(calledRun(SLANTS), R1));
    const other = dispatch(s, { type: 'call', hand: 1 }).state;
    expect(other.hotRoutes).toEqual({});
  });
});

describe('one down (test 6)', () => {
  it('next down the card plays as drawn', () => {
    let s = acted(calledRun(SLANTS), ...taps(C2, 2), { type: 'hike' });
    for (let i = 0; i < 4000 && s.phase !== 'setup'; i++) {
      s = step(s, { breakTap: i % 5 === 0 }).state;
      if (s.phase === 'draft') s = acted(s, { type: 'skipDraft' }, { type: 'skipDraft' });
    }
    expect(s.phase).toBe('setup');
    expect(s.hotRoutes).toEqual({});
    s = dispatch(s, { type: 'call', hand: 0 }).state;
    const card = calledRun(SLANTS);
    expect(routeFrom(s, C2)).toEqual(routeFrom(card, C2));
  });
});

describe('free until HIKE! (test 7)', () => {
  it('any number of changes before the snap', () => {
    const s = calledRun(SLANTS);
    const many = acted(s, ...taps(R1, 20), ...taps(R2, 3), ...taps(C3, 9));
    // 20 taps round a loop of 7 is 6 on: Curl. 9 round C3's loop of 5 is 4 on: Curl.
    expect(many.hotRoutes).toEqual({ [R1]: 'curl', [R2]: 'out', [C3]: 'curl' });
  });

  it('none after it', () => {
    const hiked = acted(calledRun(SLANTS), ...taps(R1, 1), { type: 'hike' });
    const { state, events } = dispatch(hiked, { type: 'hotRoute', slot: R1 });
    expect(events).toEqual([]);
    expect(state.hotRoutes).toEqual(hiked.hotRoutes);
    expect(body(state, R1).job).toEqual(body(hiked, R1).job);
  });
});

describe('recorded (test 8)', () => {
  /** A run driven by these actions on each setup, then its seed: a digest of its events and positions. */
  function digest(seed: number, onSetup: (s: RunState) => RunState): string {
    const hash = createHash('sha256');
    let s = createRun(seed, undefined, 0, ORIGINAL_GAME);
    for (let i = 0; i < 3000 && s.phase !== 'over' && s.phase !== 'won'; i++) {
      if (s.phase === 'setup') s = dispatch(onSetup(s), { type: 'hike' }).state;
      if (s.phase === 'draft') s = acted(s, { type: 'skipDraft' }, { type: 'skipDraft' });
      const r = step(s, s.phase === 'breakit' ? { breakTap: i % 7 === 0 } : {});
      for (const e of r.events) hash.update(JSON.stringify(e));
      s = r.state;
      for (const b of [...s.field.players, ...s.field.defenders]) {
        hash.update(`${b.id}:${b.pos.x},${b.pos.y};`);
      }
    }
    return hash.digest('hex');
  }
  const withHot = (s: RunState) =>
    acted(s, { type: 'call', hand: 0 }, ...taps(C2, 2), ...taps(R1, 1), { type: 'flip' });
  const without = (s: RunState) => acted(s, { type: 'call', hand: 0 }, { type: 'flip' });

  it('a recorded run replays to the same result', () => {
    expect(digest(21, withHot)).toBe(digest(21, withHot));
    // And the hot routes are played: it isn't the run without them.
    expect(digest(21, withHot)).not.toBe(digest(21, without));
  });

  it('the play log has a line saying who took which hot route', () => {
    const s = calledRun(SLANTS);
    const { state, events } = dispatch(s, { type: 'hotRoute', slot: C2 });
    const meta = { session: 's', build: 'b', link: '', setup: '' };
    const lines = eventLines(s, state, events, meta, Date.UTC(2026, 10, 11));
    expect(lines.map((l) => l.event)).toEqual([
      { type: 'hotRoute', id: body(s, C2).id, slot: C2, route: 'go' },
    ]);
    // Back to the card's own route is a line too.
    const back = dispatch(acted(s, ...taps(C3, 4)), { type: 'hotRoute', slot: C3 }).events;
    expect(back).toEqual([{ type: 'hotRoute', id: body(s, C3).id, slot: C3, route: null }]);
  });

  it('the run’s record says who ran which on the down', () => {
    let s = calledRun(SLANTS);
    const rec = new RunRecorder(s, { id: 'r', build: 'b', link: '', setup: '', now: 0 });
    const feed = (a: Action | 'step'): void => {
      const r = a === 'step' ? step(s, { breakTap: true }) : dispatch(s, a);
      rec.step(s, r.state, r.events);
      s = r.state;
    };
    for (const a of [...taps(C2, 2), ...taps(R1, 1), { type: 'hike' } as const]) feed(a);
    for (let i = 0; i < 4000 && rec.record.downs.length === 0; i++) feed('step');
    const ids = (slot: number) => s.roster[slot]!.id;
    expect(rec.record.downs[0]?.hotRoutes).toEqual([
      { player: ids(R1), route: 'go' },
      { player: ids(C2), route: 'slant' },
    ]);
  });

  it('a down with none records none', () => {
    let s = calledRun(SLANTS);
    const rec = new RunRecorder(s, { id: 'r', build: 'b', link: '', setup: '', now: 0 });
    let r = dispatch(s, { type: 'hike' });
    rec.step(s, r.state, r.events);
    s = r.state;
    for (let i = 0; i < 4000 && rec.record.downs.length === 0; i++) {
      r = step(s, { breakTap: true });
      rec.step(s, r.state, r.events);
      s = r.state;
    }
    expect(rec.record.downs[0]?.hotRoutes).toEqual([]);
  });
});

describe('balance unchanged (test 9)', () => {
  it('a run with no hot routes has none, and the events say nothing of them', () => {
    const events: ArcadeEvent[] = [];
    let s = createRun(3, undefined, 0, ORIGINAL_GAME);
    for (let i = 0; i < 600; i++) {
      if (s.phase === 'setup') {
        const r = dispatch(dispatch(s, { type: 'call', hand: 0 }).state, { type: 'hike' });
        events.push(...r.events);
        s = r.state;
      }
      const r = step(s, {});
      events.push(...r.events);
      s = r.state;
    }
    expect(s.hotRoutes).toEqual({});
    expect(events.some((e) => e.type === 'hotRoute')).toBe(false);
  });
});
