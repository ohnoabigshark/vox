import { describe, expect, it } from 'vitest';
import { arcadeTuning } from '../../src/arcade/content/tuning';
import { pickupsForDrive } from '../../src/arcade/sim/pickups';
import { drivePropsWithBoss } from '../../src/arcade/sim/props';
import { createRun, dispatch, endDown, nextDown, setUpDrive } from '../../src/arcade/sim/run';
import { step } from '../../src/arcade/sim/step';
import type { Pickup, RunState } from '../../src/arcade/sim/types';
import { body, carry, ofType, playState, run, type DefenderSpec } from './helpers';
import type { Play } from '../../src/arcade/content/plays';
import { PLAY_POOL } from '../../src/arcade/content/playPool';
import { dist, v } from '../../src/arcade/sim/vec';

const { pickups: tuning, field } = arcadeTuning;

describe('tricks and treats: where they lie (docs/PICKUPS.md)', () => {
  it('are laid the same for a seed: one bolt and one slick to every 10-yard stretch', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const area = seed % 3;
      const index = seed % 4;
      const pickups = pickupsForDrive(seed, area, index);
      expect(pickupsForDrive(seed, area, index)).toEqual(pickups);
      // This drive's own stretch, and the two ahead of it.
      for (const from of [0, 10, 20]) {
        const here = pickups.filter((p) => p.y >= from && p.y < from + 10);
        expect(here.map((p) => p.kind).sort(), `seed ${seed}, from ${from}`).toEqual([
          'bolt',
          'slick',
        ]);
      }
    }
    expect(pickupsForDrive(1, 0, 0)).not.toEqual(pickupsForDrive(2, 0, 0));
  });

  it('a stretch keeps its pickups where they are, whichever drive the field is showing', () => {
    const round = (y: number): number => Math.round(y * 1e6) / 1e6;
    const stretch = (seed: number, index: number, from: number) =>
      pickupsForDrive(seed, 0, index)
        .filter((p) => p.y >= from && p.y < from + 10)
        .map((p) => ({ ...p, y: round(p.y - from) }));
    for (let seed = 1; seed <= 60; seed++) {
      for (let index = 0; index < 3; index++) {
        // Seen one drive ahead, then two, as from the drive before.
        expect(stretch(seed, index + 1, 0), `seed ${seed}`).toEqual(stretch(seed, index, 10));
        expect(stretch(seed, index + 1, 10), `seed ${seed}`).toEqual(stretch(seed, index, 20));
      }
    }
  });

  it('lie out of the middle lane, in from the sidelines, and clear of every prop, a Boss included', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const props = drivePropsWithBoss(seed, 0, 3, 'misterFrog');
      for (const p of pickupsForDrive(seed, 0, 3)) {
        expect(Math.abs(p.x) - tuning.radius).toBeGreaterThanOrEqual(tuning.center - 1e-9);
        expect(Math.abs(p.x) + tuning.radius).toBeLessThanOrEqual(
          field.halfWidth - tuning.edge + 1e-9,
        );
        for (const prop of props) {
          expect(dist(v(p.x, p.y), v(prop.x, prop.y))).toBeGreaterThanOrEqual(
            prop.radius + tuning.radius + tuning.gap - 1e-9,
          );
        }
      }
    }
  });

  it("a run starts with its first drive's pickups on the field; practice has none", () => {
    const s = createRun(4);
    expect(s.field.pickups).toEqual(pickupsForDrive(4, 0, 0));
    expect(s.field.pickups.length).toBeGreaterThan(0);
    const play = PLAY_POOL[0] as Play;
    expect(createRun(4, undefined, 0, { practice: play }).field.pickups).toEqual([]);
  });
});

describe('tricks and treats: taking them', () => {
  const { bolt, slick } = arcadeTuning.pickups;
  /** A Catcher (id 2) running straight upfield from (5, 0), with these pickups lying ahead. */
  const runner = (pickups: Pickup[], defenders: DefenderSpec[] = []): RunState => {
    const s = playState(
      [{ pos: v(5, 0), job: { kind: 'route', to: [v(5, 40)], index: 0 } }],
      defenders,
    );
    s.field.pickups = pickups;
    return s;
  };
  const speedOf = (s: RunState, id: number): number => {
    const b = body(s, id);
    return Math.hypot(b.vel.x, b.vel.y);
  };

  it('a lightning bolt makes whoever takes it half as fast again for 3 seconds, then it wears off', () => {
    const plain = run(runner([]), 2).state;
    const { state: boosted, events } = run(runner([{ id: 7, kind: 'bolt', x: 5, y: 0.5 }]), 2);
    expect(ofType(events, 'pickupTaken')).toEqual([
      { type: 'pickupTaken', id: 2, kind: 'bolt', pickup: 7 },
    ]);
    expect(boosted.field.pickups).toEqual([]);
    expect(boosted.taken).toEqual([7]);
    expect(speedOf(boosted, 2) / speedOf(plain, 2)).toBeCloseTo(1 + bolt.faster, 1);
    const later = run(boosted, bolt.time).state;
    expect(speedOf(later, 2) / speedOf(run(plain, bolt.time).state, 2)).toBeCloseTo(1, 1);
  });

  it('a pickup reaches three quarters of a yard: a player brushing past a yard off takes it', () => {
    // The Catcher (0.45 across) runs up x 5; a bolt a yard to its side is touched at 0.45 + 0.75.
    const near = run(runner([{ id: 7, kind: 'bolt', x: 6, y: 2 }]), 1);
    expect(ofType(near.events, 'pickupTaken').map((e) => e.pickup)).toEqual([7]);
    const far = run(runner([{ id: 7, kind: 'bolt', x: 6.3, y: 2 }]), 1);
    expect(ofType(far.events, 'pickupTaken')).toEqual([]);
  });

  it('a pickup is taken once: the next player through the same spot gets nothing', () => {
    const s = playState([
      { pos: v(5, 0), job: { kind: 'route', to: [v(5, 40)], index: 0 } },
      { pos: v(5, -3), job: { kind: 'route', to: [v(5, 40)], index: 0 } },
    ]);
    s.field.pickups = [{ id: 7, kind: 'bolt', x: 5, y: 0.5 }];
    const { state, events } = run(s, 1);
    expect(ofType(events, 'pickupTaken').map((e) => e.id)).toEqual([2]);
    expect(state.field.players.find((p) => p.id === 3)?.boltLeft).toBe(0);
  });

  it('an oil slick trips whoever runs through it: they lie on the turf for a moment', () => {
    const { state, events } = run(runner([{ id: 8, kind: 'slick', x: 5, y: 0.5 }]), 0.2);
    expect(ofType(events, 'pickupTaken')).toEqual([
      { type: 'pickupTaken', id: 2, kind: 'slick', pickup: 8 },
    ]);
    expect(body(state, 2).down).toBeGreaterThan(slick.time - 0.25);
    expect(state.field.pickups).toEqual([]);
  });

  it('a carrier who slips is tackled there: SLIPPED!', () => {
    const s = carry(runner([{ id: 8, kind: 'slick', x: 5, y: 0.5 }]), 2);
    const { state, events } = run(s, 0.5);
    expect(ofType(events, 'slipped')).toEqual([{ type: 'slipped', id: 2 }]);
    expect(ofType(events, 'tackled')[0]?.id).toBe(2);
    expect(state.phase).toBe('downOver');
  });

  it('defenders run over them and leave them be (only offense, for now)', () => {
    const pickups: Pickup[] = [
      { id: 7, kind: 'bolt', x: -5, y: 3 },
      { id: 8, kind: 'slick', x: -5, y: 1 },
    ];
    // A Cover standing on the slick, heading over the bolt to its mark.
    const s = runner(pickups, [{ kind: 'cover', pos: v(-5, 1), mark: 2 }]);
    const { state, events } = run(s, 0.5);
    expect(ofType(events, 'pickupTaken')).toEqual([]);
    expect(state.field.pickups).toEqual(pickups);
    expect(body(state, 100).down).toBe(0);
  });

  it('a pickup taken stays gone at the next down and the next drive; the rest stay put', () => {
    let s = dispatch(dispatch(createRun(4), { type: 'call', hand: 0 }).state, {
      type: 'hike',
    }).state;
    const [first, ...rest] = s.field.pickups;
    if (!first) throw new Error('no pickups');
    const p = s.field.players.find((q) => q.role === 'catcher');
    if (!p) throw new Error('no catcher');
    p.pos = v(first.x, first.y);
    s = step(s).state;
    expect(s.taken).toEqual([first.id]);
    endDown(s, 'incomplete', s.drive.los, []);
    nextDown(s, []);
    expect(s.field.pickups).toEqual(rest);
    setUpDrive(s, 0, 1, [], true);
    expect(s.field.pickups.map((q) => q.id)).not.toContain(first.id);
    expect(s.field.pickups.length).toBeGreaterThan(0);
  });
});
