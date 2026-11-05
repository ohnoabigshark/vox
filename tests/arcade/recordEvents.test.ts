import { describe, expect, it } from 'vitest';
import { PLAY_POOL } from '../../src/arcade/content/playPool';
import { createRun, dispatch, endDown, nextDown } from '../../src/arcade/sim/run';
import { rollOffer, startingRoster } from '../../src/arcade/sim/team';
import type { ArcadeEvent, RunState } from '../../src/arcade/sim/types';
import { v } from '../../src/arcade/sim/vec';
import { ofType, playState, run, stand } from './helpers';

/**
 * What the sim's events must carry for the run's record (docs/STATS.md,
 * "The record"): the play's id, who a batted pass was meant for, and an id
 * for every player on the team.
 */

/** A run just past its first won series: TRICK OR TREAT! is on. */
const atDraft = (s: RunState = createRun(3)): RunState => {
  // Every play and perk held, so every card on offer is a new player (docs/REWARDS.md, o1).
  s.playbook = PLAY_POOL;
  s.perks.secondWind = true;
  s.perks.magnet = true;
  const events: ArcadeEvent[] = [];
  endDown(s, 'tackled', s.series.firstDown, events);
  nextDown(s, events);
  return s;
};

/** A lob coming down at (0.4, 10), with a Catcher at x `catcher` (or none) and a Cover at x `cover`. */
function lob(catcher: number | null, cover: number): ArcadeEvent[] {
  const s = playState(
    catcher === null ? [] : [{ pos: v(catcher, 10), job: stand(v(catcher, 10)) }],
    [{ kind: 'cover', pos: v(cover, 10) }],
  );
  s.field.ball = {
    at: 'flight',
    from: v(0, -4),
    target: v(0.4, 10),
    thrownAt: s.time,
    landsAt: s.time + 0.5,
    lob: true,
  };
  return run(s, 1).events;
}

describe('the events the record reads', () => {
  it('a call carries the play’s id as well as its name', () => {
    const s = createRun(5);
    const play = s.playbook[s.hand[0]!]!;
    const called = ofType(dispatch(s, { type: 'call', hand: 0 }).events, 'called');
    expect(called).toEqual([{ type: 'called', id: play.id, play: play.name, flipped: false }]);
  });

  it('a batted pass carries who it was meant for: the receiver who lost it', () => {
    const batted = ofType(lob(2.2, 0.3), 'batted');
    expect(batted).toHaveLength(1);
    expect(batted[0]!.target).toBe(2);
  });

  it('a pass batted with none of yours in reach was meant for nobody', () => {
    const batted = ofType(lob(null, 0.4), 'batted');
    expect(batted).toHaveLength(1);
    expect(batted[0]!.target).toBeNull();
  });
});

describe('every player has an id for the run', () => {
  it('the starting seven are 1 to 7', () => {
    expect(startingRoster().map((p) => p.id)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('a recruit gets the next id, and says so as it joins', () => {
    const s = atDraft();
    expect(rollOffer(s).map((p) => (p.kind === 'recruit' ? p.player.id : null))).toEqual([8, 8, 8]);
    const joined = ofType(dispatch(s, { type: 'pick', offer: 0 }).events, 'joined');
    expect(joined[0]!.id).toBe(8);
  });

  it('two recruits of the same name are two players', () => {
    let s = atDraft();
    s = dispatch(dispatch(s, { type: 'pick', offer: 0 }).state, { type: 'skipDraft' }).state;
    s = atDraft(s);
    const offer = s.offer[0]!;
    if (offer.kind !== 'recruit') throw new Error('not a recruit');
    const first = [...s.roster, ...s.bench].find((p) => p.id === 8)!;
    s.offer = [{ ...offer, player: { ...offer.player, name: first.name } }, ...s.offer.slice(1)];
    const after = dispatch(s, { type: 'pick', offer: 0 }).state;
    const named = [...after.roster, ...after.bench].filter((p) => p.name === first.name);
    expect(named.map((p) => p.id).sort()).toEqual([8, 9]);
  });
});
