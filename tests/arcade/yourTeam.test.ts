import { describe, expect, it } from 'vitest';
import { applyGains } from '../../src/arcade/sim/growth';
import { createRun, dispatch, endDown, nextDown } from '../../src/arcade/sim/run';
import { trickOrTreatView } from '../../src/arcade/ui/trickOrTreat';
import type { ArcadeEvent, RunState } from '../../src/arcade/sim/types';

/**
 * Your team (docs/REWARDS.md, v2 and g4): after every TRICK OR TREAT! pick,
 * a screen of its own shows the roster with what each player gained since
 * the last one, then PLAY ON. The offer shows only its cards.
 */

/** A run just past its first won series: TRICK OR TREAT! is on. */
const atDraft = (seed = 3, hard = false): RunState => {
  const s = { ...createRun(seed), hard };
  const events: ArcadeEvent[] = [];
  endDown(s, 'tackled', s.series.firstDown, events);
  nextDown(s, events);
  return s;
};

describe('Your team (t1, 13)', () => {
  it('the offer shows only its cards under Take one, with Skip, and no roster (v1, x1)', () => {
    const s = atDraft();
    const view = trickOrTreatView(s, null);
    expect(view.screen).toBe('offer');
    expect(view.title).toBe('TRICK OR TREAT!');
    expect(view.lead).toBe('Take one');
    expect(view.goOn).toBe('Skip');
    expect(view.roster).toEqual([]);
    expect(view.bench).toEqual([]);
    // A face for each card, saying what kind it is.
    const title = { play: 'New Play!', recruit: 'New Player!', perk: 'Perk!' };
    expect(view.offer.map((f) => f.title)).toEqual(s.offer.map((c) => title[c.kind]));
  });

  it('a play card names the play and whether it’s a pass or a run; a perk card says what it does', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = atDraft(seed);
      trickOrTreatView(s, null).offer.forEach((face, i) => {
        const card = s.offer[i]!;
        if (card.kind === 'play' && face.kind === 'play') {
          expect(face.play).toBe(card.play);
          expect(face.blurb).toBe(card.play.handoff === undefined ? 'Pass play' : 'Run play');
        } else if (card.kind === 'perk' && face.kind === 'perk') {
          expect(face.name).toBe(
            card.perk.kind === 'secondWind' ? 'Second Wind' : 'Candy Corn Magnet',
          );
          expect(face.blurb.length).toBeGreaterThan(0);
        } else {
          expect([card.kind, face.kind]).toEqual(['recruit', 'player']);
        }
      });
    }
  });

  it('after a pick Your team stays up, in normal mode too, until PLAY ON', () => {
    const picked = dispatch(atDraft(), { type: 'pick', offer: 0 }).state;
    expect(picked.phase).toBe('draft');
    expect(picked.offer).toEqual([]);
    const view = trickOrTreatView(picked, null);
    expect(view.title).toBe('Your team');
    expect(view.screen).toBe('team');
    expect(view.goOn).toBe('PLAY ON');
    expect(view.roster).toHaveLength(7);
    expect(view.swappable).toBe(false);
    expect(dispatch(picked, { type: 'skipDraft' }).state.phase).toBe('setup');
  });

  it('each player’s bars carry what it gained since the last TRICK OR TREAT!', () => {
    const s = atDraft();
    applyGains(
      s,
      [
        { slot: 4, stat: 'hands', by: 15 },
        { slot: 4, stat: 'hustle', by: 6 },
      ],
      [],
    );
    const picked = dispatch(s, { type: 'pick', offer: 0 }).state;
    const name = s.roster[4]!.name;
    const row = trickOrTreatView(picked, null).roster.find((r) => r.name === name)!;
    expect(row.stats.map((b) => [b.label, b.delta ?? 0])).toEqual([
      ['Heft', 0],
      ['Hustle', 6],
      ['Hands', 15],
    ]);
  });

  it('PLAY ON starts the count again', () => {
    const s = atDraft();
    applyGains(s, [{ slot: 4, stat: 'hands', by: 15 }], []);
    const picked = dispatch(s, { type: 'pick', offer: 0 }).state;
    expect(dispatch(picked, { type: 'skipDraft' }).state.gains).toEqual({});
  });

  it('in hard mode the swaps are made on Your team', () => {
    const picked = dispatch(atDraft(3, true), { type: 'pick', offer: 0 }).state;
    expect(trickOrTreatView(picked, null).swappable).toBe(true);
    const [a, b] = [picked.roster[0]!.name, picked.roster[4]!.name];
    const swapped = dispatch(picked, { type: 'swap', a: 0, b: 4 }).state;
    expect(swapped.roster.map((p) => p.name).slice(0, 5)).toEqual([
      b,
      ...picked.roster.slice(1, 4).map((p) => p.name),
      a,
    ]);
  });
});
