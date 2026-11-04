import { describe, expect, it } from 'vitest';
import { arcadeTuning } from '../../src/arcade/content/tuning';
import { PLAY_POOL } from '../../src/arcade/content/playPool';
import type { Play } from '../../src/arcade/content/plays';
import { areaOrigin } from '../../src/arcade/render/world';
import { pocketTime } from '../../src/arcade/sim/ball';
import { pickupsForArea } from '../../src/arcade/sim/pickups';
import { AREA_YARDS, BOSS_SPOT, stretchProps } from '../../src/arcade/sim/props';
import {
  createRun,
  dispatch,
  downAndDistance,
  endDown,
  nextDown,
  setUpSeries,
} from '../../src/arcade/sim/run';
import type { RunState } from '../../src/arcade/sim/types';
import { ofType, run } from './helpers';

/**
 * The long field, part 1 (docs/LONG_FIELD.md, o2; map
 * https://claude.ai/artifact/5qLrncweSw1w5DgFZgo7JU): each area is one field,
 * measured from its start; all its props and pickups, and its Boss, are out
 * from its first down; losses count on any down, back to 10 yards behind the
 * area's start.
 */

const { distance } = arcadeTuning.series;

/** The series lined up and snapped with the first card, nobody throwing. */
function snapped(state: RunState): RunState {
  const called = dispatch(state, { type: 'call', hand: 0 }).state;
  return dispatch(called, { type: 'hike' }).state;
}

/** Hold the ball until the down ends (a sack), then line up the next down. */
function sackedThenNext(state: RunState): { state: RunState; sacks: number } {
  const r = run(state, pocketTime(state) + 0.5);
  const sacks = ofType(r.events, 'sacked').length;
  nextDown(r.state, []);
  return { state: r.state, sacks };
}

describe('the long field, part 1', () => {
  it('1: a sack on 1st & 10 at the area’s start makes 2nd & 12, the line 2 yards behind it', () => {
    const { state, sacks } = sackedThenNext(snapped(createRun(1)));
    expect(sacks).toBe(1);
    expect(state.series.los).toBe(-arcadeTuning.series.sackLoss);
    expect(state.series.down).toBe(2);
    expect(downAndDistance(state)).toBe('2nd & 12');
  });

  it('2: a tackle for a loss on 1st down moves the line back by it, at most 10 yards behind the area’s start', () => {
    const s = createRun(1);
    s.phase = 'play';
    endDown(s, 'tackled', -4, []);
    expect(s.series.los).toBe(-4);
    expect(s.result).toEqual({ result: 'tackled', gained: -4 });

    const far = createRun(1);
    far.phase = 'play';
    endDown(far, 'tackled', -15, []);
    expect(far.series.los).toBe(-arcadeTuning.series.furthestBack);
    expect(arcadeTuning.series.furthestBack).toBe(10);
  });

  it('3: a sack on the Challenge’s 1st down at 10 goes back into the Intro’s stretch, still the Challenge’s series', () => {
    const s = createRun(1);
    setUpSeries(s, 0, 1, [], true);
    expect(s.series.los).toBe(distance);
    const { state, sacks } = sackedThenNext(snapped(s));
    expect(sacks).toBe(1);
    expect(state.series.los).toBe(distance - arcadeTuning.series.sackLoss);
    expect(state.series.index).toBe(1);
    expect(state.series.kind).toBe('challenge');
    expect(downAndDistance(state)).toBe('2nd & 12');
  });

  it('4: from the area’s first down the field holds all four stretches’ props and pickups, and the Boss', () => {
    for (const seed of [1, 2, 3, 7, 11]) {
      const s = createRun(seed);
      const props = s.field.props;
      for (let k = 0; k < 4; k++) {
        // Each stretch's props, where they're laid (each stretch from the run's seed), shifted onto the area.
        for (const p of stretchProps(seed, k)) {
          const at = { x: p.x, y: p.y + k * distance };
          const nearBoss = Math.hypot(at.x - BOSS_SPOT.x, at.y - BOSS_SPOT.y) < 5;
          if (nearBoss) continue;
          expect(
            props.some((q) => q.id === p.id && q.x === at.x && q.y === at.y),
            `seed ${seed}: prop ${p.id} in stretch ${k}`,
          ).toBe(true);
        }
      }
      const boss = props.find((p) => p.id === -1);
      expect(boss && { model: boss.model, x: boss.x, y: boss.y }).toEqual({
        model: 'bosses/misterFrog',
        x: 0,
        y: BOSS_SPOT.y,
      });
      expect(BOSS_SPOT.y).toBeGreaterThan(AREA_YARDS);
      expect(s.field.pickups).toEqual(pickupsForArea(seed, 0));
      for (let k = 0; k < 4; k++) {
        const own = s.field.pickups.filter((p) => Math.floor(p.id / 10) === k);
        expect(own.length, `seed ${seed}: stretch ${k}`).toBeGreaterThan(0);
        for (const p of own) {
          expect(p.y).toBeGreaterThanOrEqual(k * distance);
          expect(p.y).toBeLessThan((k + 1) * distance);
        }
      }
    }
  });

  it('5: a pickup taken in one stretch stays gone at later series; the rest stay put', () => {
    const s = createRun(4);
    const ahead = s.field.pickups.find((p) => p.y >= 2 * distance);
    if (!ahead) throw new Error('no pickup in the Gimmick’s stretch');
    s.taken.push(ahead.id);
    setUpSeries(s, 0, 1, [], true);
    expect(s.field.pickups.map((p) => p.id)).not.toContain(ahead.id);
    expect(s.field.pickups).toEqual(pickupsForArea(4, 0).filter((p) => p.id !== ahead.id));
  });

  it('6: each series starts and ends where it does today, measured along its area, in normal and hard mode', () => {
    expect(AREA_YARDS).toBe(4 * distance);
    for (const hard of [false, true]) {
      for (const area of hard ? [0, 1, 2, 3, 4] : [0, 1, 2]) {
        for (let index = 0; index < 4; index++) {
          const s = createRun(1, undefined, 0, { hard });
          setUpSeries(s, area, index, [], true);
          expect(s.series, `area ${area} series ${index}`).toMatchObject({
            start: index * distance,
            los: index * distance,
            firstDown: (index + 1) * distance,
          });
        }
      }
    }
    // On the long strip each area has its own 40 yards; hard mode's fourth zone comes round onto the Forest's.
    expect([0, 1, 2, 3, 4].map(areaOrigin)).toEqual([0, 40, 80, 0, 40]);
  });

  it('7: practice still lines every rep up at the same spot, with no pickups', () => {
    let s = createRun(5, undefined, 0, { practice: PLAY_POOL[0] as Play });
    expect(s.field.pickups).toEqual([]);
    const at = s.series.los;
    const lineUp = s.field.players.map((p) => p.pos);
    s = dispatch(s, { type: 'hike' }).state;
    const { state } = sackedThenNext(s);
    expect(state.series.los).toBe(at);
    expect(state.field.players.map((p) => p.pos)).toEqual(lineUp);
    expect(state.field.pickups).toEqual([]);
  });
});
