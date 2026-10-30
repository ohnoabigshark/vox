import { describe, expect, it } from 'vitest';
import { arcadeTuning } from '../../src/arcade/content/tuning';
import { lobLanding, sweepSpeed } from '../../src/arcade/sim/ball';
import {
  DRIVE_KINDS,
  createRun,
  dispatch,
  defenseBoost,
  driveDefense,
  endDown,
  nextDown,
  setUpDrive,
} from '../../src/arcade/sim/run';
import { rollOffer } from '../../src/arcade/sim/team';
import type { ArcadeEvent, RunState } from '../../src/arcade/sim/types';
import { v } from '../../src/arcade/sim/vec';
import { ofType, playState, run, stand, throwAt } from './helpers';

/** Win the drive being played (and the TRICK OR TREAT! after it, taking the first card). */
const winDrive = (s: RunState): RunState => {
  const t = structuredClone(s);
  const events: ArcadeEvent[] = [];
  endDown(t, 'firstDown', t.drive.firstDown, events);
  nextDown(t, events);
  if (t.phase !== 'draft') return t;
  const picked = dispatch(t, { type: 'pick', offer: 0 }).state;
  return picked.phase === 'draft' ? dispatch(picked, { type: 'skipDraft' }).state : picked;
};

describe('hard mode', () => {
  it('goes round the zones again after the last Boss, instead of winning', () => {
    let s = createRun(3, undefined, arcadeTuning.run.areas - 1, { hard: true });
    for (let i = 0; i < DRIVE_KINDS.length; i++) s = winDrive(s);
    expect(s.phase).not.toBe('won');
    expect(s.drive.area).toBe(arcadeTuning.run.areas);
    expect(s.drive.index).toBe(0);
    // The same run, not hard, is won.
    let easy = createRun(3, undefined, arcadeTuning.run.areas - 1);
    for (let i = 0; i < DRIVE_KINDS.length; i++) easy = winDrive(easy);
    expect(easy.phase).toBe('won');
  });

  it('lines up one more defender every zone, never more than 12 on the field (docs/DIFFICULTY.md)', () => {
    const hard = createRun(3, undefined, 0, { hard: true });
    const easy = createRun(3);
    for (const area of [0, 1, 2]) {
      const extra =
        driveDefense(hard, area, 1).defenders.length - driveDefense(easy, area, 1).defenders.length;
      expect(extra, `zone ${area + 1}`).toBe(area);
    }
    // The busiest drive of each zone (its Boss), zones 1 to 8.
    const busiest = [0, 1, 2, 3, 4, 5, 6, 7].map(
      (area) => driveDefense(hard, area, 3).defenders.length,
    );
    expect(busiest).toEqual([8, 10, 11, 11, 12, 12, 12, 12]);
  });

  it('defenders gain 15 a zone in hard mode, 10 otherwise', () => {
    const hard = createRun(3, undefined, 0, { hard: true });
    const easy = createRun(3);
    for (const area of [0, 1, 2, 5]) {
      const spec = driveDefense(easy, area, 1);
      expect(defenseBoost(hard, area, 'challenge', spec) - spec.boost, `zone ${area + 1}`).toBe(
        15 * area,
      );
      if (area < 3)
        expect(defenseBoost(easy, area, 'challenge', spec) - spec.boost).toBe(10 * area);
    }
  });

  it('recruits grow by 30 a zone, for ever, but Hands only like a square root', () => {
    const total = (p: { stats: { hustle: number; hands: number; heft: number } }) =>
      p.stats.hustle + p.stats.hands + p.stats.heft;
    for (const area of [0, 2, 9]) {
      const s = createRun(5, undefined, 0, { hard: true });
      setUpDrive(s, area, 1, [], false);
      for (const perk of rollOffer(s)) {
        if (perk.kind !== 'recruit') continue;
        expect(total(perk.player)).toBe(200 + 30 * area);
        // Far below where its share of a 470 total would put it.
        if (area === 9) expect(perk.player.stats.hands).toBeLessThan(140);
      }
    }
  });

  it("the sweep doesn't get faster after the third zone", () => {
    const s = createRun(3, undefined, 0, { hard: true });
    setUpDrive(s, 2, 0, [], true);
    const third = sweepSpeed(s);
    setUpDrive(s, 7, 0, [], true);
    expect(sweepSpeed(s)).toBeCloseTo(third);
  });

  it('TRICK OR TREAT! lets you set your lineup', () => {
    const s = createRun(3, undefined, 0, { hard: true });
    const events: ArcadeEvent[] = [];
    endDown(s, 'firstDown', s.drive.firstDown, events);
    nextDown(s, events);
    expect(s.phase).toBe('draft');
    expect(dispatch(s, { type: 'pick', offer: 0 }).state.phase).toBe('draft');
  });
});

describe('two-tap throwing (?aim=2)', () => {
  const twoTap = (s: RunState): RunState => Object.assign(s, { twoTapAim: true });

  it('the first tap stops the line; the second lobs it to the marker', () => {
    const s = twoTap(playState([{ pos: v(0, 8), job: stand(v(0, 8)) }]));
    const first = run(s, 0.05, throwAt(s, v(0, 8))).state;
    expect(first.field.aim).not.toBeNull();
    expect(first.field.ball.at).toBe('qb');
    const angle = first.field.aim!.angle;
    // The line stays put while the marker slides.
    expect(run(first, 0.5).state.field.aim!.angle).toBe(angle);
    const r = run(first, 0.02, { throw: true });
    expect(r.state.field.ball.at).not.toBe('qb');
    expect(ofType(r.events, 'thrown')).toHaveLength(1);
  });

  it('a lob sails over a defender in the way and is caught where it comes down', () => {
    const s = twoTap(
      playState(
        [{ pos: v(0, 10), job: stand(v(0, 10)) }],
        [{ kind: 'cover', pos: v(0, 3), stats: { hustle: 0 } }],
      ),
    );
    const qb = s.field.players.find((p) => p.role === 'qb')!;
    // Stop the line straight upfield, then wait for the marker to reach the receiver.
    s.field.aim = { angle: 0, since: s.time };
    const toReceiver =
      (10 - qb.pos.y - arcadeTuning.throw.minDistance) / arcadeTuning.twoTap.markerSpeed;
    const ready = run(s, toReceiver).state;
    const r = run(ready, 2, { throw: true });
    expect(ofType(r.events, 'batted')).toHaveLength(0);
    expect(ofType(r.events, 'caught')[0]?.id).toBe(2);
  });

  it('a lob is caught by your nearest player within the big catch circle, who runs to it', () => {
    const s = twoTap(
      playState([
        { pos: v(2.4, 10), job: stand(v(2.4, 10)) },
        { pos: v(-2.6, 10.5), job: stand(v(-2.6, 10.5)) },
      ]),
    );
    expect(lobLanding(s, v(0, -4), v(0.4, 10))).toMatchObject({ kind: 'caught', by: { id: 2 } });
    // Thrown there, the nearer one runs under it and catches it.
    s.field.ball = {
      at: 'flight',
      from: v(0, -4),
      target: v(0.4, 10),
      thrownAt: s.time,
      landsAt: s.time + 1,
      lob: true,
    };
    const r = run(s, 1.5);
    expect(ofType(r.events, 'caught')[0]?.id).toBe(2);
    // Nobody within the circle: incomplete.
    expect(lobLanding(s, v(0, -4), v(0, 20))?.kind).toBe('incomplete');
  });
});
