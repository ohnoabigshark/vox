import { describe, expect, it } from 'vitest';
import { PLAY_POOL, startingPlaybook } from '../../src/arcade/content/playPool';
import { PLAYS } from '../../src/arcade/content/plays';
import { createRun, dispatch, endDown, nextDown, setUpDown } from '../../src/arcade/sim/run';
import type { ArcadeEvent, OfferCard, RunState } from '../../src/arcade/sim/types';

/**
 * The new offer (docs/REWARDS.md, part 2: o1–o4, x1, k1; tests t2): three
 * cards, each a new play, a new player or a perk, drawn at random; a Skip;
 * a run that starts with esrauch's five plays.
 */

/** A run just past its first won series: TRICK OR TREAT! is on. */
const atDraft = (seed = 3, run: RunState = createRun(seed)): RunState => {
  const events: ArcadeEvent[] = [];
  endDown(run, 'tackled', run.series.firstDown, events);
  nextDown(run, events);
  return run;
};

/** What a card is, to tell two apart: the play's id, the player's kind, the perk's kind. */
const what = (c: OfferCard): string =>
  c.kind === 'play'
    ? `play ${c.play.id}`
    : c.kind === 'player'
      ? `player ${c.player.kind}`
      : `perk ${c.perk.kind}`;

const pickOf = (s: RunState, kind: OfferCard['kind']): number => {
  const i = s.offer.findIndex((c) => c.kind === kind);
  if (i < 0) throw new Error(`no ${kind} card on offer`);
  return i;
};

/** A seed whose first offer holds a card of this kind. */
const withCard = (kind: OfferCard['kind']): RunState => {
  for (let seed = 1; seed < 200; seed++) {
    const s = atDraft(seed);
    if (s.offer.some((c) => c.kind === kind)) return s;
  }
  throw new Error(`no offer with a ${kind}`);
};

describe('the offer (t2)', () => {
  it('1. an offer is three cards, no two alike, and two players are never of the same kind', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const { offer } = atDraft(seed);
      expect(offer).toHaveLength(3);
      expect(new Set(offer.map(what)).size).toBe(3);
    }
  });

  it('2. a play already in your playbook, or a perk you hold, is never offered', () => {
    const missing = PLAY_POOL.at(-1)!;
    for (let seed = 1; seed <= 60; seed++) {
      const s = createRun(seed, undefined, 0, {
        playbook: PLAY_POOL.filter((p) => p !== missing),
      });
      s.perks.secondWind = true;
      for (const c of atDraft(seed, s).offer) {
        if (c.kind === 'play') expect(c.play.id).toBe(missing.id);
        if (c.kind === 'perk') expect(c.perk.kind).toBe('magnet');
      }
    }
  });

  it('3. when plays and perks have run out, all three cards are players', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = createRun(seed, undefined, 0, { playbook: PLAY_POOL, perks: true });
      const { offer } = atDraft(seed, s);
      expect(offer.map((c) => c.kind)).toEqual(['player', 'player', 'player']);
      expect(new Set(offer.map(what)).size).toBe(3);
    }
  });

  it('4. over many seeds, cards come out near 3 in 5 plays, 1 in 5 players, 1 in 5 perks', () => {
    const count = { play: 0, player: 0, perk: 0 };
    let all = 0;
    for (let seed = 1; seed <= 400; seed++) {
      for (const c of atDraft(seed).offer) {
        count[c.kind]++;
        all++;
      }
    }
    expect(count.play / all).toBeGreaterThan(0.53);
    expect(count.play / all).toBeLessThan(0.67);
    expect(count.player / all).toBeGreaterThan(0.14);
    expect(count.player / all).toBeLessThan(0.26);
    expect(count.perk / all).toBeGreaterThan(0.14);
    expect(count.perk / all).toBeLessThan(0.26);
  });

  it('5. a play you take is in your playbook, and can be dealt on the next down', () => {
    const s = withCard('play');
    const i = pickOf(s, 'play');
    const card = s.offer[i]!;
    if (card.kind !== 'play') throw new Error('play');
    const taken = dispatch(s, { type: 'pick', offer: i }).state;
    expect(taken.playbook).toEqual([...s.playbook, card.play]);
    const index = taken.playbook.length - 1;
    const after = dispatch(taken, { type: 'skipDraft' }).state;
    let dealt = false;
    for (let down = 0; down < 30 && !dealt; down++) {
      after.series = { ...after.series, down: 1 + (down % 4) };
      after.nextId += 50;
      setUpDown(after, []);
      dealt = after.hand.includes(index);
    }
    expect(dealt).toBe(true);
  });

  it('6. a perk you take is held for the rest of the run', () => {
    const s = withCard('perk');
    const i = pickOf(s, 'perk');
    const card = s.offer[i]!;
    if (card.kind !== 'perk') throw new Error('perk');
    const taken = dispatch(s, { type: 'pick', offer: i }).state;
    expect(card.perk.kind === 'secondWind' ? taken.perks.secondWind : taken.perks.magnet).toBe(
      true,
    );
  });

  it('7. Skip takes nothing and goes on to Your team; PLAY ON goes on from there', () => {
    const s = atDraft();
    const skipped = dispatch(s, { type: 'skipDraft' }).state;
    expect(skipped.phase).toBe('draft');
    expect(skipped.offer).toEqual([]);
    expect(skipped.roster).toEqual(s.roster);
    expect(skipped.bench).toEqual(s.bench);
    expect(skipped.playbook).toEqual(s.playbook);
    expect(skipped.perks).toEqual(s.perks);
    expect(dispatch(skipped, { type: 'skipDraft' }).state.phase).toBe('setup');
  });

  it('8. a run starts with esrauch’s five plus your sketches in the game; practice is unchanged', () => {
    expect(createRun(1).playbook).toEqual(PLAYS);
    const sketch = { ...PLAYS[0]!, id: 'sketch-1', name: 'My sketch' };
    expect(startingPlaybook([sketch])).toEqual([...PLAYS, sketch]);
    expect(createRun(1, undefined, 0, { practice: sketch }).playbook).toEqual([sketch]);
  });

  it('9. ?perks=1 starts a run holding both perks', () => {
    const s = createRun(1, undefined, 0, { perks: true });
    expect(s.perks.secondWind).toBe(true);
    expect(s.perks.magnet).toBe(true);
    expect(createRun(1).perks.secondWind).toBe(false);
  });

  it('10. the same seed and the same picks give the same offers, later ones too', () => {
    /** Three TRICK OR TREAT!s, taking the card at `picks[n]` from each; every offer seen. */
    const offers = (seed: number, picks: readonly number[]): OfferCard[][] => {
      let s = createRun(seed);
      const seen: OfferCard[][] = [];
      for (const i of picks) {
        s = atDraft(seed, s);
        seen.push(s.offer);
        s = dispatch(dispatch(s, { type: 'pick', offer: i }).state, { type: 'skipDraft' }).state;
      }
      return seen;
    };
    for (let seed = 1; seed <= 10; seed++) {
      const a = offers(seed, [0, 1, 2]);
      expect(a).toHaveLength(3);
      expect(offers(seed, [0, 1, 2])).toEqual(a);
      // A different pick changes what's held, and so what comes next, but not the first offer.
      expect(offers(seed, [1, 1, 2])[0]).toEqual(a[0]);
    }
  });
});
