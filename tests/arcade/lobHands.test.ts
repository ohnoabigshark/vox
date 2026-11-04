import { describe, expect, it } from 'vitest';
import { DT } from '../../src/arcade/content/tuning';
import { lobLanding } from '../../src/arcade/sim/ball';
import { step } from '../../src/arcade/sim/step';
import type { ArcadeEvent, DefenderKind, RunState } from '../../src/arcade/sim/types';
import { v } from '../../src/arcade/sim/vec';
import { forced } from './contests';
import { ofType, playState, stand } from './helpers';

/**
 * Hands on a lob (docs/PLAN.md; map https://claude.ai/artifact/GoDRbJaFXbBA1p3QwESN6D,
 * b1's scenarios): the nearer one still wins a contested lob, but each 10
 * Hands counts as a quarter-yard nearer (h1), Hands only (h2), ties to you
 * (h3), and the catch tests get the defenders in that order (h4).
 */

const FROM = v(0, -4);
const SPOT = v(0, 10);

/** Your catcher `away` yards right of the spot, and defenders each `away` yards left of it. */
function lobState(
  catcher: { away: number; hands: number },
  defenders: readonly { kind?: DefenderKind; away: number; hands?: number; up?: number }[],
): RunState {
  const at = v(SPOT.x + catcher.away, SPOT.y);
  return playState(
    [{ pos: at, job: stand(at), stats: { hands: catcher.hands } }],
    defenders.map((d) => ({
      kind: d.kind ?? 'cover',
      // `up` moves one off the line, so two can stand the same side at different distances.
      pos: v(SPOT.x - Math.sqrt(d.away ** 2 - (d.up ?? 0) ** 2), SPOT.y + (d.up ?? 0)),
      ...(d.hands === undefined ? {} : { stats: { hands: d.hands } }),
    })),
  );
}

/** Who'd get the lob coming down at the spot, with everyone where they stand. */
function lobAt(...args: Parameters<typeof lobState>) {
  const r = lobLanding(lobState(...args), FROM, SPOT);
  if (!r) throw new Error('the lob is still in the air');
  return r;
}

/** The lob thrown, coming down at the spot on the next step. */
function lobLanding1Step(state: RunState): RunState {
  state.field.ball = {
    at: 'flight',
    from: FROM,
    target: SPOT,
    thrownAt: state.time,
    landsAt: state.time + DT / 2,
    lob: true,
  };
  return state;
}

/** The ids of the defenders reaching for a contested lob, in the order a catch test gets them. */
const reaching = (r: ReturnType<typeof lobAt>): number[] | undefined =>
  r.kind === 'incomplete' ? undefined : r.contest?.defenders.map((d) => d.id);

describe('Hands on a lob', () => {
  it('1: a catcher with 70 Hands (a Ghost’s) a little further than a Gnome (50), within half a yard, catches it', () => {
    // 1.2 less half a yard is 0.7, nearer than the Gnome's 0.8. Before Hands counted, the Gnome batted it.
    const r = lobAt({ away: 1.2, hands: 70 }, [{ away: 0.8 }]);
    expect(r.kind).toBe('caught');
    expect(r.kind === 'caught' ? r.by.id : null).toBe(2);
  });

  it('2: a catcher with 30 Hands (a Werewolf’s) a little nearer than a Gnome (50) loses it', () => {
    // 0.6 and half a yard is 1.1, further than the Gnome's 0.8. Before Hands counted, it was caught.
    const r = lobAt({ away: 0.6, hands: 30 }, [{ away: 0.8 }]);
    expect(r.kind).toBe('batted');
    expect(r.kind === 'batted' ? r.by : null).toBe(100);
  });

  it('3: equal Hands, the nearer wins, as before; equal after Hands, yours', () => {
    expect(lobAt({ away: 0.7, hands: 50 }, [{ away: 0.8 }]).kind).toBe('caught');
    expect(lobAt({ away: 0.9, hands: 50 }, [{ away: 0.8 }]).kind).toBe('batted');
    // 1.3 less half a yard is 0.8, the Gnome's own distance: a tie, so yours.
    expect(lobAt({ away: 1.3, hands: 70 }, [{ away: 0.8 }]).kind).toBe('caught');
    expect(lobAt({ away: 1.31, hands: 70 }, [{ away: 0.8 }]).kind).toBe('batted');
  });

  it('4: a Scarecrow’s kind bonus lets it reach the lob but not win it; only its Hands count', () => {
    // A Scarecrow (80 Hands) 1.5 yards off counts as 0.75; your catcher at 0.7 wins.
    // Counting its 1.2-yard bonus too, it would be -0.45 and bat it.
    const r = lobAt({ away: 0.7, hands: 50 }, [{ kind: 'zone', away: 1.5 }]);
    expect(r.kind).toBe('caught');
    expect(reaching(r)).toEqual([100]);
    expect(lobAt({ away: 0.8, hands: 50 }, [{ kind: 'zone', away: 1.5 }]).kind).toBe('batted');
  });

  it('5: a catch test gets the defenders in the rule’s order, the one it pits against you first', () => {
    // A Gnome (50) at 0.7 counts as 0.7; a Bat (60) at 0.85 counts as 0.6, so the Bat comes first.
    const r = lobAt({ away: 0.5, hands: 50 }, [
      { away: 0.7 },
      { kind: 'bat', away: 0.85, up: 0.5 },
    ]);
    expect(r.kind).toBe('caught');
    expect(reaching(r)).toEqual([101, 100]);
  });

  it('5b: on a BAD, the one the rule put first bats it, not the first on the field', () => {
    // The Gnome (100) is first on the field; the Scarecrow (101, 80 Hands, planted) is first by the rule:
    // 1.3 yards less 0.75 is 0.55, against the Gnome's 0.85.
    const s = forced(
      lobLanding1Step(
        lobState({ away: 1, hands: 50 }, [{ away: 0.85 }, { kind: 'zone', away: 1.3, up: 0.6 }]),
      ),
      'snag',
    );
    const events: ArcadeEvent[] = [];
    let state = s;
    for (let i = 0; i < 900 && (i === 0 || state.phase === 'snag'); i++) {
      // No taps: every dot missed, a BAD.
      const r = step(state);
      state = r.state;
      events.push(...r.events);
    }
    expect(ofType(events, 'snagStarted')).toHaveLength(1);
    expect(ofType(events, 'batted').map((e) => e.by)).toEqual([101]);
  });

  it('6: a contested lob that gets no catch test is settled by the new rule', () => {
    // Before series 5, so no catch test: the 70-Hands catcher at 1.0 counts as 0.5, the Gnome 0.8.
    const s = lobLanding1Step(lobState({ away: 1, hands: 70 }, [{ away: 0.8 }]));
    const r = step(s);
    expect(r.state.snag).toBeNull();
    expect(r.state.tip).toBeNull();
    expect(ofType(r.events, 'caught').map((e) => e.id)).toEqual([2]);
    expect(ofType(r.events, 'batted')).toEqual([]);
  });
});
