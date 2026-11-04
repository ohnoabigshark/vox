import { describe, expect, it } from 'vitest';
import { FROG_RAIN } from '../../src/arcade/content/fieldEvents';
import { PLAY_POOL } from '../../src/arcade/content/playPool';
import type { Play } from '../../src/arcade/content/plays';
import { arcadeTuning } from '../../src/arcade/content/tuning';
import { createRun, seriesDefense, setUpSeries } from '../../src/arcade/sim/run';
import type { Defender, RunState } from '../../src/arcade/sim/types';
import { v } from '../../src/arcade/sim/vec';
import { carry, ofType, run } from './helpers';

/**
 * The patrols ahead (docs/DIFFICULTY.md, "The long field"; difficulty map
 * https://claude.ai/artifact/QA9UrG4Tammp58npg1uP7v, t2): on every down,
 * each stretch past the line's own keeps its Scarecrows, Bats and Crows on
 * the field, at their spots from the stretch's start.
 */

/** The defenders past the down's own defense: the patrols ahead. */
function patrols(s: RunState): Defender[] {
  const own = seriesDefense(s, s.series.area, s.series.stretch).defenders.length;
  return s.field.defenders.slice(own);
}

const where = (d: Defender) => ({ kind: d.kind, x: d.home.x, y: d.home.y });

/** A down in play with only the patrols ahead on defense, one of yours carrying from `at`. */
function carryingAmongPatrols(at: { x: number; y: number }): RunState {
  const s = createRun(1);
  s.field = { ...s.field, defenders: patrols(s) };
  const runner = s.field.players.find((p) => p.role !== 'qb')!;
  runner.pos = v(at.x, at.y);
  s.phase = 'play';
  return carry(s, runner.id);
}

describe('the patrols ahead', () => {
  it('1: from the Forest’s Intro, the field holds the down’s defense plus every patrol ahead, each at its spot from its stretch’s start', () => {
    const s = createRun(1);
    expect(s.series).toMatchObject({ area: 0, stretch: 0, los: 0 });
    expect(patrols(s).map(where)).toEqual([
      // Gnome Country, from 10: its Scarecrow.
      { kind: 'zone', x: 2.8, y: 18 },
      // Bat Cave, from 20: two Bats.
      { kind: 'bat', x: 2.1, y: 25 },
      { kind: 'bat', x: 4.2, y: 31 },
      // Mister Frog's Pond, from 30: a Scarecrow and a Bat.
      { kind: 'zone', x: -2.8, y: 39 },
      { kind: 'bat', x: 1.4, y: 37 },
    ]);
    // Ids are the run's, after the down's own.
    const ids = s.field.defenders.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('2: from the Gimmick stretch, only the Boss stretch’s patrols are ahead, nothing from behind', () => {
    const s = createRun(1);
    setUpSeries(s, 0, 22, [], true);
    expect(s.series.stretch).toBe(2);
    expect(patrols(s).map(where)).toEqual([
      { kind: 'zone', x: -2.8, y: 39 },
      { kind: 'bat', x: 1.4, y: 37 },
    ]);
  });

  it('3: from the Boss stretch, no patrols are ahead', () => {
    const s = createRun(1);
    setUpSeries(s, 0, 32, [], true);
    expect(s.field.defenders).toHaveLength(seriesDefense(s, 0, 3).defenders.length);
  });

  it('4: hard mode’s extras are only in the down’s defense, and its cap of 12 doesn’t count patrols', () => {
    // The Farm in hard mode: two extras on the down's defense.
    const s = createRun(3, undefined, 2, { hard: true });
    const own = seriesDefense(s, 2, 0).defenders.length;
    expect(own).toBe(5 + 2);
    expect(patrols(s).map((d) => d.kind)).toEqual([
      'zone',
      'crow', // The Cornrows
      'crow',
      'crow',
      'crow', // A Murder of Crows
      'zone',
      'zone',
      'crow', // The King's Patch
    ]);
    expect(s.field.defenders.length).toBeGreaterThan(arcadeTuning.hard.maxDefenders);
  });

  it('5: a carrier who runs into a Scarecrow ahead is tackled there, even on a breakaway', () => {
    const s = carryingAmongPatrols({ x: 2.8, y: 16.6 });
    s.field.breakaway = arcadeTuning.breakit.breakaway;
    const scarecrow = s.field.defenders.find((d) => d.kind === 'zone')!;
    const r = run(s, 1);
    expect(ofType(r.events, 'tackled')[0]?.by).toBe(scarecrow.id);
    expect(ofType(r.events, 'downEnded')[0]?.result).toBe('firstDown');
  });

  it('6: a Bat ahead loops before the snap, and dives at a carrier within 3 yards', () => {
    const s = createRun(1);
    const bat = patrols(s).find((d) => d.kind === 'bat')!;
    const before = run(s, 1).state;
    expect(before.phase).toBe('setup');
    expect(before.field.defenders.find((d) => d.id === bat.id)!.pos).not.toEqual(bat.pos);

    const c = carryingAmongPatrols({ x: 2.1, y: 23 });
    const r = run(c, 1);
    const grab = ofType(r.events, 'grabbed')[0] ?? ofType(r.events, 'tackled')[0];
    expect(grab).toBeDefined();
    const by = 'by' in grab! ? grab.by : [];
    expect([by].flat()).toContain(bat.id);
  });

  it('7: practice and event practice have the patrols ahead too', () => {
    const practice = createRun(5, undefined, 0, { practice: PLAY_POOL[0] as Play });
    expect(patrols(practice).map((d) => d.kind)).toEqual(['zone', 'bat', 'bat', 'zone', 'bat']);
    // Event practice at the Challenge (stretch number 2): Bat Cave's and the Pond's.
    const event = createRun(3, undefined, 0, { eventPractice: { event: FROG_RAIN, stretch: 2 } });
    expect(patrols(event).map((d) => d.kind)).toEqual(['bat', 'bat', 'zone', 'bat']);
  });
});
