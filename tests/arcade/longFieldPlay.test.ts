import { arcadeTuning } from '../../src/arcade/content/tuning';
import { describe, expect, it } from 'vitest';
import { ORIGINAL_GAME } from './helpers';
import { PLAY_POOL } from '../../src/arcade/content/playPool';
import type { Play } from '../../src/arcade/content/plays';
import { catchTestsOn } from '../../src/arcade/sim/catchTests';
import { AREA_YARDS } from '../../src/arcade/sim/props';
import {
  createRun,
  dispatch,
  downAndDistance,
  endDown,
  genericEventFor,
  nextDown,
  seriesDefense,
  setUpSeries,
  stretchNumber,
} from '../../src/arcade/sim/run';
import type { ArcadeEvent, RunState } from '../../src/arcade/sim/types';
import { v } from '../../src/arcade/sim/vec';
import { carry, ofType, playState, run, stand } from './helpers';

/**
 * The long field, part 2 (docs/LONG_FIELD.md; map
 * https://claude.ai/artifact/5qLrncweSw1w5DgFZgo7JU, round 3's p1): football's
 * first downs, each down facing the defense of its line's stretch, the play
 * going on past the line, and a touchdown from anywhere.
 */

/** End the down this way, then line up what comes next; the events of both. */
function ended(state: RunState, how: Parameters<typeof endDown>[1], at: number): ArcadeEvent[] {
  const events: ArcadeEvent[] = [];
  state.phase = 'play';
  endDown(state, how, at, events);
  nextDown(state, events);
  return events;
}

/** The down's own defenders, by kind: those lined up before the patrols ahead (docs/DIFFICULTY.md). */
function ownDefense(state: RunState): string[] {
  const n = seriesDefense(state, state.series.area, state.series.stretch).defenders.length;
  return state.field.defenders.slice(0, n).map((d) => d.kind);
}

/** Past TRICK OR TREAT!, to the next series' first down. */
const skipDraft = (state: RunState): RunState => dispatch(state, { type: 'skipDraft' }).state;

/** A down in play with one of yours carrying the ball from `at`, nobody else on the field. */
function carrying(at: { x: number; y: number }, state = playState([])): RunState {
  const s = playState([{ pos: v(at.x, at.y), job: stand(v(at.x, at.y)) }]);
  return carry({ ...s, series: { ...state.series }, practice: state.practice }, 2);
}

describe('the long field, part 2', () => {
  it('1: football’s first downs: 10 yards from wherever the series starts, & Goal inside the last 10', () => {
    const s = createRun(1, undefined, 0, ORIGINAL_GAME);
    ended(s, 'tackled', 14);
    expect(s.phase).toBe('draft');
    expect(s.series).toMatchObject({ start: 14, los: 14, firstDown: 24, down: 1 });
    expect(downAndDistance(s)).toBe('1st & 10');

    const t = skipDraft(s);
    ended(t, 'tackled', 33);
    expect(t.series).toMatchObject({ start: 33, los: 33, firstDown: AREA_YARDS, down: 1 });
    expect(downAndDistance(t)).toBe('1st & Goal');
  });

  it('2: each down faces the defense of its line’s stretch, the Boss’s gimmick included', () => {
    const s = createRun(1, undefined, 0, ORIGINAL_GAME);
    ended(s, 'tackled', 14);
    let t = skipDraft(s);
    expect(t.series).toMatchObject({ stretch: 1, kind: 'challenge' });
    expect(t.series.name).toBe(seriesDefense(t, 0, 1).name);
    expect(ownDefense(t)).toEqual(seriesDefense(t, 0, 1).defenders.map((d) => d.kind));

    ended(t, 'tackled', 21); // 2nd & 3: the line crossed 20.
    expect(t.series).toMatchObject({ down: 2, stretch: 2, kind: 'gimmick' });
    expect(ownDefense(t)).toEqual(seriesDefense(t, 0, 2).defenders.map((d) => d.kind));

    ended(t, 'sacked', 18); // Back over 20: the Challenge's defense again.
    expect(t.series).toMatchObject({ down: 3, stretch: 1, kind: 'challenge', firstDown: 24 });

    t = createRun(1, undefined, 0, ORIGINAL_GAME);
    setUpSeries(t, 0, 32, [], true);
    expect(t.series).toMatchObject({ stretch: 3, kind: 'boss' });
    expect(t.field.fieldEvent?.event.id).toBe('frogRain');
    setUpSeries(t, 0, 29, [], true);
    // No Frog Rain on the gimmick's line: only the generic event the seed gave stretch 3, if any (round 5).
    expect(t.field.fieldEvent?.event.id ?? null).toBe(genericEventFor(1, 3)?.id ?? null);
    expect(t.field.fieldEvent?.event.id).not.toBe('frogRain');
  });

  it('3: what grows grows with the stretch number, however many series it took', () => {
    // One long first down out of the Forest's Intro, then the Candy Queendom from its 0:
    // two series in, and catch tests are on, as on its stretch 5.
    const s = createRun(1, undefined, 0, ORIGINAL_GAME);
    setUpSeries(s, 1, 0, [], true);
    s.seriesWon = 1;
    expect(stretchNumber(s.series)).toBe(5);
    expect(catchTestsOn(s)).toBe(true);
    setUpSeries(s, 1, 22, [], true);
    expect(stretchNumber(s.series)).toBe(7);
    setUpSeries(s, 0, 38, [], true);
    expect(stretchNumber(s.series)).toBe(4);
    expect(catchTestsOn(s)).toBe(false);
  });

  it('4: past the line the play goes on, with nothing marking it; tackled at 17, one series won', () => {
    const s = carrying({ x: 3, y: 8 });
    const r = run(s, 1.5);
    expect(r.state.phase).toBe('play');
    expect(r.state.field.players.find((p) => p.id === 2)!.pos.y).toBeGreaterThan(10);
    expect(ofType(r.events, 'downEnded')).toEqual([]);
    expect(ofType(r.events, 'seriesWon')).toEqual([]);

    const events = ended(r.state, 'tackled', 17);
    expect(ofType(events, 'downEnded')).toEqual([
      { type: 'downEnded', result: 'firstDown', gained: 17 },
    ]);
    expect(ofType(events, 'seriesWon')).toHaveLength(1);
    expect(r.state.phase).toBe('draft');
    expect(r.state.offer).toHaveLength(arcadeTuning.offer.cards);
    expect(r.state.series).toMatchObject({ start: 17, firstDown: 27 });
  });

  it('5: out of bounds past the line is a first down where the carrier went out', () => {
    const s = carrying({ x: 9.3, y: 12 });
    const r = run(s, 0.1);
    expect(ofType(r.events, 'outOfBounds')).toEqual([{ type: 'outOfBounds', id: 2 }]);
    const [down] = ofType(r.events, 'downEnded');
    expect(down?.result).toBe('firstDown');
    // Where the carrier went out: a step's run past 12.
    expect(down?.gained).toBeGreaterThanOrEqual(12);
    expect(down?.gained).toBeLessThan(12.5);
  });

  it('6: over the goal line from the Intro’s stretch is a touchdown: the area cleared, the Boss skipped', () => {
    const s = carrying({ x: 3, y: 38 });
    const r = run(s, 1);
    expect(ofType(r.events, 'downEnded')).toEqual([
      { type: 'downEnded', result: 'touchdown', gained: AREA_YARDS },
    ]);
    const events: ArcadeEvent[] = [];
    nextDown(r.state, events);
    expect(ofType(events, 'areaCleared')).toEqual([{ type: 'areaCleared', area: 0 }]);
    expect(ofType(events, 'seriesWon')).toHaveLength(1);
    expect(r.state.phase).toBe('draft');
    expect(r.state.offer).toHaveLength(arcadeTuning.offer.cards);
    expect(r.state.series).toMatchObject({ area: 1, start: 0, los: 0, stretch: 0 });

    // On the Farm in normal mode, it's the win.
    const farm = createRun(1, undefined, 2, ORIGINAL_GAME);
    const f = carrying({ x: 3, y: 38 }, farm);
    const won = run(f, 1);
    nextDown(won.state, []);
    expect(won.state.phase).toBe('won');
  });

  it('8: in practice the rep goes on past the line, and the next lines up at the same spot', () => {
    const practice = createRun(5, undefined, 0, {
      ...ORIGINAL_GAME,
      practice: PLAY_POOL[0] as Play,
    });
    const s = carrying({ x: 3, y: 8 }, practice);
    const r = run(s, 1.5);
    expect(r.state.phase).toBe('play');
    expect(r.state.field.players.find((p) => p.id === 2)!.pos.y).toBeGreaterThan(10);
    ended(r.state, 'tackled', 17);
    expect(r.state.series).toMatchObject({ los: 0, down: 1, start: 0 });
  });
});
