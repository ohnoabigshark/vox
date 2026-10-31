import { describe, expect, it } from 'vitest';
import { arcadeTuning, DT, TIME_SCALE } from '../../src/arcade/content/tuning';
import {
  FROG_RAIN,
  eventKind,
  fieldEventDefaults,
  type EventArea,
  type FieldEvent,
  type Who,
} from '../../src/arcade/content/fieldEvents';
import { inArea, placeArea } from '../../src/arcade/sim/fieldEvents';
import { createRun, dispatch, setUpDrive } from '../../src/arcade/sim/run';
import type { PlacedArea } from '../../src/arcade/sim/types';
import { v } from '../../src/arcade/sim/vec';
import { ofType, playState, run, stand } from './helpers';

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

/** An event like Frog Rain with these parts changed. */
const ev = (over: Partial<FieldEvent>): FieldEvent => ({ ...FROG_RAIN, ...over });

/** A body of this side at this spot (enough of one for `inArea`). */
const at = (x: number, y: number, radius = 0.4): Parameters<typeof inArea>[1] =>
  ({ pos: v(x, y), radius }) as Parameters<typeof inArea>[1];

describe('areas (test 2)', () => {
  /** The area placed on a down at the line 20, with this seed. */
  const placed = (area: EventArea, seed = 1): PlacedArea => {
    const s = createRun(seed);
    s.drive = { ...s.drive, los: 20 };
    return placeArea(s, area);
  };

  it('a lane runs down the field from the line, against the side it names', () => {
    const lane: EventArea = { shape: 'lane', across: 'left', width: 4, from: -1, to: 10 };
    expect(placed(lane)).toEqual({ shape: 'rect', x0: -hw, x1: -hw + 4, y0: 19, y1: 30 });
    expect(placed({ ...lane, across: 'right' })).toEqual({
      shape: 'rect',
      x0: hw - 4,
      x1: hw,
      y0: 19,
      y1: 30,
    });
    expect(placed({ ...lane, across: 'middle' })).toEqual({
      shape: 'rect',
      x0: -2,
      x1: 2,
      y0: 19,
      y1: 30,
    });
  });

  it('a band runs across the field, from and to yards past the line', () => {
    const band: EventArea = { shape: 'band', across: 'middle', width: 2 * hw, from: 6, to: 9 };
    const p = placed(band);
    expect(p).toEqual({ shape: 'rect', x0: -hw, x1: hw, y0: 26, y1: 29 });
    expect(inArea(p, at(0, 27))).toBe(true);
    expect(inArea(p, at(-8, 28.5))).toBe(true);
    expect(inArea(p, at(0, 24))).toBe(false);
    expect(inArea(p, at(0, 31))).toBe(false);
  });

  it('a circle sits a set way out from the middle and upfield, and takes in what reaches into it', () => {
    const circle: EventArea = { shape: 'circle', across: 'right', out: 4, at: 12, radius: 2 };
    const p = placed(circle);
    expect(p).toEqual({ shape: 'circle', x: 4, y: 32, r: 2 });
    expect(placed({ ...circle, across: 'left' })).toEqual({ shape: 'circle', x: -4, y: 32, r: 2 });
    expect(placed({ ...circle, across: 'middle' })).toEqual({ shape: 'circle', x: 0, y: 32, r: 2 });
    expect(inArea(p, at(4, 32))).toBe(true);
    // Its edge reaches 2 yards out; a body counts if any of it is inside.
    expect(inArea(p, at(4, 34.3))).toBe(true);
    expect(inArea(p, at(4, 34.5))).toBe(false);
    // Corners of its square are outside.
    expect(inArea(p, at(5.8, 33.8))).toBe(false);
  });

  it('either side is picked from the seed each down: both come up, the same for the same seed', () => {
    const circle: EventArea = { shape: 'circle', across: 'either', out: 4, at: 12, radius: 2 };
    const xs = new Set<number>();
    for (let seed = 1; seed <= 20; seed++) {
      const p = placed(circle, seed);
      if (p.shape !== 'circle') throw new Error('a circle');
      xs.add(p.x);
      expect(placed(circle, seed)).toEqual(p);
    }
    expect([...xs].sort()).toEqual([-4, 4]);
  });
});

describe('a burst (test 3)', () => {
  /** A down on the line 0 with a Catcher and a Cover both inside the area, and a Catcher outside, as it goes off. */
  const burst = (event: FieldEvent) => {
    const s = playState(
      [
        { pos: v(4, 6), job: stand(v(4, 6)) },
        { pos: v(-6, 6), job: stand(v(-6, 6)) },
      ],
      [{ kind: 'cover', pos: v(5, 7) }],
    );
    s.field.fieldEvent = { event, area: placeArea(s, event.area), left: DT * 2 };
    const r = run(s, 0.1);
    return ofType(r.events, 'fieldEventWentOff')[0]?.hit.slice().sort();
  };
  const circle: EventArea = { shape: 'circle', across: 'right', out: 4.5, at: 6.5, radius: 2 };

  it('of any shape, flattens whoever is in it as it goes off, and nobody else', () => {
    expect(burst(ev({ area: circle }))).toEqual([100, 2]);
    const band: EventArea = { shape: 'band', across: 'right', width: 8, from: 5, to: 8 };
    expect(burst(ev({ area: band }))).toEqual([100, 2]);
  });

  it('on your players, or on the defenders, it catches only that side', () => {
    expect(burst(ev({ area: circle, effect: { kind: 'flatten', on: 'yours' } }))).toEqual([2]);
    expect(burst(ev({ area: circle, effect: { kind: 'flatten', on: 'theirs' } }))).toEqual([100]);
  });
});

describe('blessing, hex or mischief (test 4)', () => {
  it('worked out from the effect and who it hits', () => {
    const flatten = (on: Who): FieldEvent => ev({ effect: { kind: 'flatten', on } });
    expect(eventKind(FROG_RAIN)).toBe('mischief');
    expect(eventKind(flatten('everyone'))).toBe('mischief');
    expect(eventKind(flatten('yours'))).toBe('hex');
    expect(eventKind(flatten('theirs'))).toBe('blessing');
  });
});

describe('the call (x3, review r1)', () => {
  it('an event that tackles a carrier says its call; one with none says nothing (never a blank word)', () => {
    const tackled = (call: string | null) => {
      const s = playState([{ role: 'runner', pos: v(4, 3), job: stand(v(4, 3)) }]);
      const event = ev({ call });
      s.field.ball = { at: 'carried', by: 2 };
      s.field.fieldEvent = {
        event,
        area: { shape: 'rect', x0: 1.9, x1: 9.1, y0: -1, y1: 16 },
        left: DT * 2,
      };
      return ofType(run(s, 0.1).events, 'eventTackled')[0];
    };
    expect(tackled('FROGGED!')).toEqual({ type: 'eventTackled', id: 2, call: 'FROGGED!' });
    expect(tackled(null)).toEqual({ type: 'eventTackled', id: 2, call: null });
  });
});
