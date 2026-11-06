import { describe, expect, it } from 'vitest';
import { arcadeTuning } from '../../src/arcade/content/tuning';
import { createRun, dispatch } from '../../src/arcade/sim/run';
import { step } from '../../src/arcade/sim/step';
import type { Defender, Pickup, RunState } from '../../src/arcade/sim/types';
import { v } from '../../src/arcade/sim/vec';
import { carry, ofType, playState, run, stand, type DefenderSpec } from './helpers';

/**
 * The mischief bolt (docs/PICKUPS.md; difficulty map b1–b6, b6's tests): once
 * the ball is snapped, whoever runs through a bolt first takes it, yours or a
 * defender. Slicks stay your side's trick.
 */

const { bolt } = arcadeTuning.pickups;
const { fast } = arcadeTuning.statuses;

/** A down in play: one of yours (id 2) standing at (6, 0), these defenders (ids 100 up), these pickups. */
function field(defenders: DefenderSpec[], pickups: Pickup[]): RunState {
  const s = playState([{ pos: v(6, 0), job: stand(v(6, 0)) }], defenders);
  s.field.pickups = pickups;
  return s;
}

const defender = (s: RunState, id: number): Defender => {
  const d = s.field.defenders.find((x) => x.id === id);
  if (!d) throw new Error(`no defender ${id}`);
  return d;
};
const speedOf = (d: Defender): number => Math.hypot(d.vel.x, d.vel.y);

describe('the mischief bolt', () => {
  it('1: after the snap, a defender who runs through a bolt takes it: half as fast again, and it’s gone', () => {
    // A Rusher charging Jack (0, −4) from (0, 6), a bolt in its way.
    const rusher: DefenderSpec = { kind: 'rusher', pos: v(0, 6) };
    const plain = run(field([rusher], []), 0.4).state;
    const { state, events } = run(field([rusher], [{ id: 7, kind: 'bolt', x: 0, y: 5.6 }]), 0.4);
    expect(ofType(events, 'pickupTaken')).toEqual([
      { type: 'pickupTaken', id: 100, side: 'defense', kind: 'bolt', pickup: 7 },
    ]);
    expect(state.field.pickups).toEqual([]);
    expect(state.taken).toEqual([7]);
    expect(defender(state, 100).statuses.find((x) => x.name === 'fast')?.left).toBeGreaterThan(
      bolt.time - 0.5,
    );
    expect(speedOf(defender(state, 100)) / speedOf(defender(plain, 100))).toBeCloseTo(
      1 + fast.faster,
      1,
    );
  });

  it('1b: a defender’s bolt wears off after its time, back to its own speed', () => {
    const rusher: DefenderSpec = { kind: 'rusher', pos: v(0, 8) };
    const s = field([rusher], []);
    defender(s, 100).statuses = [
      { name: 'fast', left: 0.1, from: { kind: 'pickup', pickup: 'bolt' } },
    ];
    const after = run(s, 0.3).state;
    expect(defender(after, 100).statuses).toEqual([]);
    expect(
      speedOf(defender(after, 100)) / speedOf(defender(run(field([rusher], []), 0.3).state, 100)),
    ).toBeCloseTo(1, 2);
  });

  it('1c: a bolt a defender took is gone for your players too', () => {
    // The defender gets there first; then one of yours runs through the same spot.
    const s = playState(
      [{ pos: v(-3, -2), job: { kind: 'route', to: [v(0, 5.6), v(0, 20)], index: 0 } }],
      [{ kind: 'rusher', pos: v(0, 6) }],
    );
    s.field.pickups = [{ id: 7, kind: 'bolt', x: 0, y: 5.6 }];
    const { state, events } = run(s, 1.2);
    expect(ofType(events, 'pickupTaken').map((e) => e.side)).toEqual(['defense']);
    expect(state.field.players.find((p) => p.id === 2)?.statuses).toEqual([]);
  });

  it('2: before the snap, a Bat looping over a bolt leaves it', () => {
    let s = createRun(3);
    expect(s.phase).toBe('setup');
    const bat = s.field.defenders.find((d) => d.kind === 'bat' && d.beat);
    if (!bat) throw new Error('test needs a Bat in the opening line-up');
    // A bolt on every corner of its loop.
    s.field.pickups = (bat.beat ?? []).map((p, i) => ({
      id: 70 + i,
      kind: 'bolt',
      x: p.x,
      y: p.y,
    }));
    const laid = s.field.pickups;
    for (let i = 0; i < 300; i++) s = step(s).state;
    expect(s.field.pickups).toEqual(laid);
    expect(s.field.defenders.every((d) => d.statuses.length === 0)).toBe(true);
  });

  it('2b: after the snap, a Bat whose loop crosses a bolt takes it', () => {
    let s = createRun(3);
    const bat = s.field.defenders.find((d) => d.kind === 'bat' && d.beat);
    if (!bat?.beat) throw new Error('test needs a Bat in the opening line-up');
    s = dispatch(dispatch(s, { type: 'call', hand: 0 }).state, { type: 'hike' }).state;
    // A bolt on the corner it's flying to next.
    const corner = bat.beat[bat.beatIndex % bat.beat.length];
    if (!corner) throw new Error('no corner');
    s.field.pickups = [{ id: 99, kind: 'bolt', x: corner.x, y: corner.y }];
    const taken = [];
    for (let i = 0; i < 400 && s.phase === 'play'; i++) {
      const r = step(s);
      taken.push(...ofType(r.events, 'pickupTaken'));
      s = r.state;
    }
    expect(taken).toEqual([
      { type: 'pickupTaken', id: bat.id, side: 'defense', kind: 'bolt', pickup: 99 },
    ]);
  });

  it('3: a planted Scarecrow, a defender hanging onto the carrier and one lying down leave a bolt be', () => {
    const s = field(
      [
        { kind: 'zone', pos: v(-6, 3) },
        // Hanging on below the carrier, which runs upfield away from the bolt.
        { kind: 'rusher', pos: v(6, -0.95) },
        { kind: 'rusher', pos: v(-3, 8) },
      ],
      [
        { id: 7, kind: 'bolt', x: -6, y: 3 },
        { id: 8, kind: 'bolt', x: 6, y: -1.85 },
        { id: 9, kind: 'bolt', x: -3, y: 8 },
      ],
    );
    carry(s, 2);
    defender(s, 101).latch = v(0, -0.95);
    defender(s, 102).down = 1;
    const { state, events } = run(s, 0.3);
    expect(ofType(events, 'pickupTaken')).toEqual([]);
    expect(state.field.pickups.map((p) => p.id)).toEqual([7, 8, 9]);
  });

  it('4: a defender still runs over a slick and leaves it', () => {
    const { state, events } = run(
      field([{ kind: 'rusher', pos: v(0, 6) }], [{ id: 8, kind: 'slick', x: 0, y: 5.6 }]),
      0.4,
    );
    expect(ofType(events, 'pickupTaken')).toEqual([]);
    expect(state.field.pickups.map((p) => p.id)).toEqual([8]);
    expect(defender(state, 100).down).toBe(0);
  });
});
