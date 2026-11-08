import { describe, expect, it } from 'vitest';
import {
  FROG_RAIN,
  TAFFY_FLOOD,
  WILL_O_WISPS,
  type EventArea,
  type FieldEvent,
} from '../../src/arcade/content/fieldEvents';
import { arcadeTuning } from '../../src/arcade/content/tuning';
import { chooseLane } from '../../src/arcade/sim/ai';
import { areaFor, nearEdge } from '../../src/arcade/sim/fieldEvents';
import {
  createRun,
  genericEventFor,
  setUpSeries,
  stretchAt,
  stretchStart,
} from '../../src/arcade/sim/run';
import type { Player, PlacedArea, RunState } from '../../src/arcade/sim/types';
import { v } from '../../src/arcade/sim/vec';
import { body, carry, playState } from './helpers';

/**
 * docs/FIELD_EVENTS.md, `field-places` (the taffy places map, rounds 1 and
 * 2): an event's shapes, where its near edge lands, and its size, picked
 * from the seed each down; tests 1 to 5.
 */

const hw = arcadeTuning.field.halfWidth;

/** A down of a seeded run: the seed, and which down of which series, as the sim counts them. */
function downOf(seed: number, i: number): RunState {
  const s = createRun(seed);
  s.seriesWon = i % 5;
  s.series = { ...s.series, down: (i % 4) + 1 };
  s.nextId += i;
  return s;
}

/** Its size against the event's own: depth for a lane or band, radius for a circle. */
function scaleOf(a: EventArea, base: EventArea): number {
  if (a.shape === 'circle' && base.shape === 'circle') return a.radius / base.radius;
  if (a.shape !== 'circle' && base.shape !== 'circle')
    return (a.to - a.from) / (base.to - base.from);
  throw new Error('shapes differ');
}

/** Which of the event's areas this one is a placing of: same shape, side and width (or out). */
function whichArea(event: FieldEvent, a: EventArea): number {
  return event.areas.findIndex((b) =>
    b.shape === 'circle' && a.shape === 'circle'
      ? b.across === a.across && b.out === a.out
      : b.shape === a.shape &&
        b.across === a.across &&
        'width' in b &&
        'width' in a &&
        b.width === a.width,
  );
}

const SEEDS = 60;
const DOWNS = 12;

/** Every down's area for the event, over many seeds. */
function picks(event: FieldEvent): EventArea[] {
  const out: EventArea[] = [];
  for (let seed = 1; seed <= SEEDS; seed++) {
    for (let i = 0; i < DOWNS; i++) out.push(areaFor(downOf(seed, i), event));
  }
  return out;
}

describe('the taffy: three shapes, 2 to 12 yards out, three quarters to one and a half its size (p1, p2, z1)', () => {
  it('its data: a band, a half band and a puddle; its reach and size', () => {
    expect(TAFFY_FLOOD.areas).toEqual([
      { shape: 'band', across: 'middle', width: 2 * hw, from: 3, to: 7 },
      { shape: 'band', across: 'either', width: hw, from: 3, to: 7 },
      { shape: 'circle', across: 'any', out: 4, at: 6, radius: 3 },
    ]);
    expect(TAFFY_FLOOD.reach).toEqual({ nearest: 2, farthest: 12 });
    expect(TAFFY_FLOOD.size).toEqual({ smallest: 0.75, largest: 1.5 });
  });

  it('1: each down one of its shapes, its near edge 2 to 12 yards out and its size in range; over many seeds, all of each', () => {
    const all = picks(TAFFY_FLOOD);
    const seen = new Set<number>();
    const nears: number[] = [];
    const scales: number[] = [];
    for (const a of all) {
      const i = whichArea(TAFFY_FLOOD, a);
      expect(i).toBeGreaterThanOrEqual(0);
      seen.add(i);
      const near = nearEdge(a);
      expect(near).toBeGreaterThanOrEqual(2 - 1e-9);
      expect(near).toBeLessThanOrEqual(12 + 1e-9);
      nears.push(near);
      const scale = scaleOf(a, TAFFY_FLOOD.areas[i]!);
      expect(scale).toBeGreaterThanOrEqual(0.75 - 1e-9);
      expect(scale).toBeLessThanOrEqual(1.5 + 1e-9);
      scales.push(scale);
    }
    expect([...seen].sort()).toEqual([0, 1, 2]);
    // Both ends of the reach and of the size come up.
    expect(Math.min(...nears)).toBeLessThan(2.5);
    expect(Math.max(...nears)).toBeGreaterThan(11.5);
    expect(Math.min(...scales)).toBeLessThan(0.8);
    expect(Math.max(...scales)).toBeGreaterThan(1.45);
    // Each shape about a third of the time.
    for (const i of [0, 1, 2]) {
      const share = all.filter((a) => whichArea(TAFFY_FLOOD, a) === i).length / all.length;
      expect(share).toBeGreaterThan(0.25);
      expect(share).toBeLessThan(0.42);
    }
  });

  it('2: the same seed and down give the same shape, place and size; other downs, others', () => {
    expect(areaFor(downOf(7, 3), TAFFY_FLOOD)).toEqual(areaFor(downOf(7, 3), TAFFY_FLOOD));
    const many = new Set(
      Array.from({ length: 20 }, (_, i) => JSON.stringify(areaFor(downOf(7, i), TAFFY_FLOOD))),
    );
    expect(many.size).toBeGreaterThan(15);
  });
});

describe('Frog Rain and the wisps (z2)', () => {
  it('3: Frog Rain has one lane, no reach and no size: every down, its lane as it is', () => {
    expect(FROG_RAIN.areas).toHaveLength(1);
    expect(FROG_RAIN.reach).toBeNull();
    expect(FROG_RAIN.size).toBeNull();
    for (const a of picks(FROG_RAIN)) expect(a).toBe(FROG_RAIN.areas[0]);
  });

  it('4: the wisps keep their near edge at 3 yards and are 4.5 to 7.5 yards across; both ends come up', () => {
    expect(WILL_O_WISPS.reach).toBeNull();
    expect(WILL_O_WISPS.size).toEqual({ smallest: 0.75, largest: 1.25 });
    const across: number[] = [];
    for (const a of picks(WILL_O_WISPS)) {
      if (a.shape !== 'circle') throw new Error('not a circle');
      expect(nearEdge(a)).toBeCloseTo(3, 9);
      expect(a.across).toBe('either');
      expect(a.out).toBe(5);
      across.push(2 * a.radius);
    }
    expect(Math.min(...across)).toBeGreaterThanOrEqual(4.5 - 1e-9);
    expect(Math.max(...across)).toBeLessThanOrEqual(7.5 + 1e-9);
    expect(Math.min(...across)).toBeLessThan(4.7);
    expect(Math.max(...across)).toBeGreaterThan(7.3);
  });

  it('every placing stays inside the field', () => {
    for (const event of [TAFFY_FLOOD, WILL_O_WISPS]) {
      for (const a of picks(event)) {
        if (a.shape === 'circle') expect(a.out + a.radius).toBeLessThanOrEqual(hw);
        else expect(a.width).toBeLessThanOrEqual(2 * hw);
      }
    }
  });
});

describe('5: the carrier steers round the taffy while it’s coming and while it’s on, unless there’s no way round (p4)', () => {
  /** A Runner carrying at the line's middle, nobody else about, with the taffy placed here. */
  function laneWith(area: PlacedArea | null, left: number): number {
    const s = carry(playState([{ role: 'runner', pos: v(0, 0) }]), 2);
    s.field.fieldEvent = area ? { event: TAFFY_FLOOD, area, left } : null;
    return chooseLane(s, body(s, 2) as Player);
  }
  const ON = -0.5; // gone off half a second ago: the spell is on
  const COMING = 0.5;
  const halfRight: PlacedArea = { shape: 'rect', x0: 0, x1: hw, y0: 3, y1: 7 };
  const puddle: PlacedArea = { shape: 'circle', x: 0, y: 6, r: 3 };
  const full: PlacedArea = { shape: 'rect', x0: -hw, x1: hw, y0: 3, y1: 7 };

  it('a half band: he runs the other way, coming or on', () => {
    expect(laneWith(halfRight, COMING)).toBeLessThan(0);
    expect(laneWith(halfRight, ON)).toBeLessThan(0);
  });

  it('a puddle in the middle: he goes round it, coming or on', () => {
    expect(Math.abs(laneWith(puddle, COMING))).toBeGreaterThan(2.5);
    expect(Math.abs(laneWith(puddle, ON))).toBeGreaterThan(2.5);
  });

  it('a full band: no way round, so he runs as if it weren’t there', () => {
    const plain = laneWith(null, 0);
    expect(laneWith(full, COMING)).toBe(plain);
    expect(laneWith(full, ON)).toBe(plain);
  });
});

describe('the pick keeps to its own stream (p3, p6)', () => {
  it('a taffy down deals the same cards and pickups as the same down with no generic events', () => {
    const tuning = arcadeTuning.fieldEvents as { genericShare: number };
    const share = tuning.genericShare;
    /** A down at the start of stretch n of this seed: its hand, its pickups and its event. */
    const downAt = (seed: number, n: number) => {
      const s = createRun(seed);
      const at = stretchAt(n);
      setUpSeries(s, at.area, stretchStart(at.stretch), [], true);
      return { hand: s.hand, pickups: s.field.pickups, event: s.field.fieldEvent?.event.id };
    };
    let compared = 0;
    try {
      for (let seed = 1; seed <= 40 && compared < 6; seed++) {
        for (let n = 2; n <= 8; n++) {
          tuning.genericShare = share;
          if (genericEventFor(seed, n)?.id !== 'taffyFlood') continue;
          const withTaffy = downAt(seed, n);
          tuning.genericShare = 0;
          const without = downAt(seed, n);
          expect(withTaffy.event).toBe('taffyFlood');
          expect(without.event).toBeUndefined();
          expect(withTaffy.hand).toEqual(without.hand);
          expect(withTaffy.pickups).toEqual(without.pickups);
          compared++;
        }
      }
    } finally {
      tuning.genericShare = share;
    }
    expect(compared).toBeGreaterThanOrEqual(6);
  });
});
