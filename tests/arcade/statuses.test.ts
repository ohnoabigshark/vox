import { describe, expect, it } from 'vitest';
import { kindOf } from '../../src/arcade/content/statuses';
import { arcadeTuning, DT } from '../../src/arcade/content/tuning';
import { FROM_BOLT } from '../../src/arcade/sim/pickups';
import {
  giveStatus,
  hasStatus,
  speedShare,
  statusOf,
  wearStatuses,
} from '../../src/arcade/sim/status';
import type { ArcadeEvent, Body, RunState } from '../../src/arcade/sim/types';
import { v } from '../../src/arcade/sim/vec';
import { body, ofType, playState, run, stand, type DefenderSpec } from './helpers';

/**
 * Statuses (docs/STATUSES.md; the field events map, s1–s9): a condition a
 * body carries for a while, read by the rules whatever gave it. This branch
 * has Fast, the lightning bolt's; Slowed and Ethereal come with the taffy
 * and the wisps. Test 1, the bolt playing as before, is
 * statusesSameRun.test.ts.
 */

const { bolt } = arcadeTuning.pickups;
const { fast } = arcadeTuning.statuses;

/** One of yours (id 2) standing at (6, 0), in play, with these defenders (ids 100 up). */
const field = (defenders: DefenderSpec[] = []): RunState =>
  playState([{ pos: v(6, 0), job: stand(v(6, 0)) }], defenders);

/** Wear a body's statuses for this long, collecting what it reports. */
function wear(b: Body, seconds: number, events: ArcadeEvent[]): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) wearStatuses(b, events);
}

describe('the bolt gives Fast (s2)', () => {
  it('1b: one of yours who runs through a bolt is Fast for the bolt’s time, at 1.5 × top speed', () => {
    const s = field();
    s.field.pickups = [{ id: 7, kind: 'bolt', x: 6, y: 0 }];
    const { state } = run(s, DT);
    const p = body(state, 2);
    expect(hasStatus(p, 'fast')).toBe(true);
    expect(statusOf(p, 'fast')?.left).toBeGreaterThan(bolt.time - 0.1);
    expect(statusOf(p, 'fast')?.from).toEqual(FROM_BOLT);
    expect(speedShare(p)).toBeCloseTo(1 + fast.faster, 9);
  });

  it('1c: a defender who takes one is Fast too (the mischief bolt), and runs half as fast again', () => {
    const rusher: DefenderSpec = { kind: 'rusher', pos: v(0, 6) };
    const plain = run(field([rusher]), 0.4).state;
    const s = field([rusher]);
    s.field.pickups = [{ id: 7, kind: 'bolt', x: 0, y: 5.6 }];
    const { state } = run(s, 0.4);
    const d = body(state, 100);
    expect(hasStatus(d, 'fast')).toBe(true);
    const speed = (b: Body): number => Math.hypot(b.vel.x, b.vel.y);
    expect(speed(d) / speed(body(plain, 100))).toBeCloseTo(1 + fast.faster, 1);
  });

  it('1d: Fast wears off after its time, back to top speed', () => {
    const p = body(field(), 2);
    const events: ArcadeEvent[] = [];
    giveStatus(p, 'fast', 0.5, FROM_BOLT, events);
    wear(p, 0.5 + DT, events);
    expect(hasStatus(p, 'fast')).toBe(false);
    expect(speedShare(p)).toBe(1);
  });
});

describe('stacking (s3)', () => {
  it('2: the same status given again keeps the longer time left, not the sum', () => {
    const p = body(field(), 2);
    const events: ArcadeEvent[] = [];
    giveStatus(p, 'fast', 3, FROM_BOLT, events);
    wear(p, 1, events);
    giveStatus(p, 'fast', 1, FROM_BOLT, events);
    expect(statusOf(p, 'fast')?.left).toBeCloseTo(2, 6);
    giveStatus(p, 'fast', 3, FROM_BOLT, events);
    expect(statusOf(p, 'fast')?.left).toBe(3);
    expect(p.statuses).toHaveLength(1);
  });
});

describe('blessing, hex or mischief, from the status and who (s4)', () => {
  it('3: what helps is a blessing on yours, a hex on theirs; what hurts the other way; on everyone, mischief', () => {
    expect(kindOf('helps', 'yours')).toBe('blessing');
    expect(kindOf('helps', 'theirs')).toBe('hex');
    expect(kindOf('helps', 'everyone')).toBe('mischief');
    expect(kindOf('hurts', 'yours')).toBe('hex');
    expect(kindOf('hurts', 'theirs')).toBe('blessing');
    expect(kindOf('hurts', 'everyone')).toBe('mischief');
  });
});

describe('the sim says so (s8)', () => {
  it('4: a status given is reported, with who, which and what gave it; its running out once', () => {
    const p = body(field(), 2);
    const events: ArcadeEvent[] = [];
    giveStatus(p, 'fast', 0.2, FROM_BOLT, events);
    expect(events).toEqual([
      { type: 'statusGained', id: 2, status: 'fast', from: FROM_BOLT, changed: true },
    ]);
    wear(p, 1, events);
    expect(ofType(events, 'statusEnded')).toEqual([
      { type: 'statusEnded', id: 2, status: 'fast', from: FROM_BOLT },
    ]);
  });

  it('4c: every give is reported, saying whether it changed anything: a shorter one keeps the time and the source', () => {
    const p = body(field(), 2);
    const events: ArcadeEvent[] = [];
    const other = { kind: 'pickup', pickup: 'slick' } as const;
    giveStatus(p, 'fast', 3, FROM_BOLT, events);
    giveStatus(p, 'fast', 1, other, events);
    giveStatus(p, 'fast', 3, other, events);
    expect(ofType(events, 'statusGained').map((e) => [e.from.pickup, e.changed])).toEqual([
      ['bolt', true],
      ['slick', false],
      ['slick', true],
    ]);
    expect(statusOf(p, 'fast')?.from).toEqual(other);
  });

  it('4b: in play, taking a bolt reports the pickup, then the status', () => {
    const s = field();
    s.field.pickups = [{ id: 7, kind: 'bolt', x: 6, y: 0 }];
    const { events } = run(s, DT);
    const types = events.map((e) => e.type);
    expect(types.indexOf('statusGained')).toBeGreaterThan(types.indexOf('pickupTaken'));
    expect(ofType(events, 'statusGained')).toEqual([
      { type: 'statusGained', id: 2, status: 'fast', from: FROM_BOLT, changed: true },
    ]);
  });
});
