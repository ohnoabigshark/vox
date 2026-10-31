import { describe, expect, it } from 'vitest';
import { arcadeTuning, TIME_SCALE } from '../../src/arcade/content/tuning';
import { FROG_RAIN, fieldEventDefaults } from '../../src/arcade/content/fieldEvents';
import { createRun, dispatch, setUpDrive } from '../../src/arcade/sim/run';

/** docs/FIELD_EVENTS.md, test 1: Frog Rain as the first field event, playing exactly as before. */

const hw = arcadeTuning.field.halfWidth;

describe('Frog Rain is the first field event (test 1)', () => {
  it('its four parts are the numbers Frog Rain has always had, on screen', () => {
    expect(fieldEventDefaults.map((e) => e.id)).toEqual(['frogRain']);
    const f = FROG_RAIN;
    expect(f.name).toBe('Frog Rain');
    expect(f.boss).toBe('misterFrog');
    // A lane in from either side, 40% of the width, a yard behind the line to 16 ahead.
    expect(f.area).toEqual({
      shape: 'lane',
      across: 'either',
      width: expect.any(Number),
      from: -1,
      to: 16,
    });
    expect(f.area.shape === 'lane' && f.area.width / (2 * hw)).toBeCloseTo(0.4, 9);
    // The frogs land 2.0 s after the snap, their shadows fill the lane 0.875 s before, and whoever they land on is flat 1.5 s.
    expect(f.goesOff / TIME_SCALE).toBeCloseTo(2.0, 9);
    expect(f.warning.buildUp / TIME_SCALE).toBeCloseTo(0.875, 9);
    expect(f.lasts / TIME_SCALE).toBeCloseTo(1.5, 9);
    expect(f.effect).toEqual({ kind: 'flatten', on: 'everyone' });
    expect(f.call).toBe('FROGGED!');
    expect(f.look).toBe('frogRain');
  });

  it('Mister Frog’s drive places it each down: either side from the seed, never over the pumpkin, −1 to +16 yards', () => {
    const sides = new Set<number>();
    for (let seed = 1; seed <= 20; seed++) {
      const s = createRun(seed);
      setUpDrive(s, 0, 3, [], true);
      const on = s.field.fieldEvent;
      expect(on?.event.id).toBe('frogRain');
      expect(on?.left).toBeNull();
      const a = on!.area;
      if (a.shape !== 'rect') throw new Error('a lane is a rectangle');
      expect(a.x1 - a.x0).toBeCloseTo(
        FROG_RAIN.area.shape === 'lane' ? FROG_RAIN.area.width : 0,
        9,
      );
      // Against a sideline, clear of the middle (the pumpkin).
      expect(Math.min(Math.abs(a.x0), Math.abs(a.x1))).toBeGreaterThan(1);
      expect(Math.max(Math.abs(a.x0), Math.abs(a.x1))).toBeCloseTo(hw, 9);
      expect(a.y0).toBe(s.drive.los - 1);
      expect(a.y1).toBe(s.drive.los + 16);
      sides.add(Math.sign(a.x0 + a.x1));
    }
    expect([...sides].sort()).toEqual([-1, 1]);
    // Other drives have none.
    expect(createRun(1).field.fieldEvent).toBeNull();
  });

  it('its countdown starts at the hike', () => {
    const s = createRun(3);
    setUpDrive(s, 0, 3, [], true);
    const st = dispatch(dispatch(s, { type: 'call', hand: 0 }).state, { type: 'hike' }).state;
    expect(st.field.fieldEvent?.left).toBe(FROG_RAIN.goesOff);
  });
});
