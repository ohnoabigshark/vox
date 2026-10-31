import { describe, expect, it } from 'vitest';
import { arcadeTuning } from '../../src/arcade/content/tuning';
import { pocketTime, sweepSpeed } from '../../src/arcade/sim/ball';
import { createRun, dispatch, endDown, nextDown } from '../../src/arcade/sim/run';
import { forceBreakKind } from '../../src/arcade/sim/step';
import { ZONE_OFFER } from '../../src/arcade/content/perks';
import { POSITION_STAT, ROSTER_ROLES } from '../../src/arcade/content/team';
import { applyPerk, noPerks, playerStats, rollOffer } from '../../src/arcade/sim/team';
import type { ArcadeEvent, Perk, RunState } from '../../src/arcade/sim/types';
import { v } from '../../src/arcade/sim/vec';
import { carry, ofType, playState, run, stand, tapAt, throwAt, untilGrabbed } from './helpers';

/** A run just past its first won drive: TRICK OR TREAT! is on. */
const atDraft = (seed = 3): RunState => {
  const s = createRun(seed);
  const events: ArcadeEvent[] = [];
  endDown(s, 'firstDown', s.drive.firstDown, events);
  nextDown(s, events);
  return s;
};

/** A run at TRICK OR TREAT! with this perk on offer first. */
const offering = (perk: Perk): RunState => {
  const s = atDraft();
  s.offer = [perk, ...s.offer.slice(1)];
  return s;
};

describe('TRICK OR TREAT!', () => {
  it('after a won drive, TRICK OR TREAT! offers two cards', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = atDraft(seed);
      expect(s.phase).toBe('draft');
      expect(s.offer).toHaveLength(2);
      for (const p of s.offer) expect(['common', 'rare', 'epic']).toContain(p.rarity);
    }
  });

  /** The offer in a zone (0 Forest, 1 Swamp, 2 Farm). */
  const offerIn = (zone: number, seed: number) => {
    const s = atDraft(seed);
    s.drive = { ...s.drive, area: zone };
    return { s, offer: rollOffer(s) };
  };

  it('every offer is two new players, never of the same kind', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const { offer } = offerIn(0, seed);
      expect(offer.map((p) => p.kind)).toEqual(['recruit', 'recruit']);
      const [a, b] = offer.map((p) => (p.kind === 'recruit' ? p.player.kind : null));
      expect(a).not.toBe(b);
    }
  });

  it('new players grow by zone: 200 / 250 / 300 in all', () => {
    ZONE_OFFER.forEach((zone, i) => {
      for (let seed = 1; seed <= 20; seed++) {
        for (const p of offerIn(i, seed).offer) {
          if (p.kind !== 'recruit') throw new Error('offer');
          const st = p.player.stats;
          expect(st.hustle + st.hands + st.heft).toBe(zone.recruitTotal);
        }
      }
    });
  });

  it('a new player is shaped like its kind: a Ghost mostly Hands, a Golem mostly Heft', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const recruit = offerIn(0, seed).offer[0]!;
      if (recruit.kind !== 'recruit') continue;
      const { kind, stats } = recruit.player;
      if (kind === 'ghost') expect(stats.hands).toBeGreaterThan(stats.heft);
      if (kind === 'golem') expect(stats.heft).toBeGreaterThan(stats.hustle);
      if (kind === 'werewolf') expect(stats.hustle).toBeGreaterThan(stats.hands);
    }
  });

  it('+10 to a stat for everyone shows up on every player in the line-up', () => {
    const s = dispatch(offering({ rarity: 'common', kind: 'allStat', stat: 'hands', amount: 10 }), {
      type: 'pick',
      offer: 0,
    }).state;
    expect(s.phase).toBe('setup');
    s.roster.forEach((p, slot) => expect(playerStats(s, slot).hands).toBe(p.stats.hands + 10));
    const catcher = s.field.players.find((p) => p.slot === 4)!;
    expect(catcher.stats.hands).toBe(s.roster[4]!.stats.hands + 10);
  });

  it('a kind perk only helps players of that kind', () => {
    const s = offering({
      rarity: 'rare',
      kind: 'kindStat',
      form: 'ghost',
      stat: 'heft',
      amount: 20,
    });
    s.roster[0] = { ...s.roster[0]!, kind: 'ghost' };
    s.roster[1] = { ...s.roster[1]!, kind: 'ghost' };
    const after = dispatch(s, { type: 'pick', offer: 0 }).state;
    expect(playerStats(after, 0).heft).toBe(after.roster[0]!.stats.heft + 20);
    expect(playerStats(after, 5).heft).toBe(after.roster[5]!.stats.heft);
  });

  const boo = {
    name: 'Boo Radish',
    kind: 'ghost' as const,
    preferred: 'catcher' as const,
    stats: { hustle: 50, hands: 70, heft: 30 },
  };

  it('a recruit prefers the position its best stat suits', () => {
    let seen = 0;
    for (let seed = 1; seed <= 60; seed++) {
      for (const perk of rollOffer(createRun(seed))) {
        if (perk.kind !== 'recruit') continue;
        seen++;
        const { stats, preferred } = perk.player;
        expect(stats[POSITION_STAT[preferred]]).toBe(
          Math.max(stats.hustle, stats.hands, stats.heft),
        );
      }
    }
    expect(seen).toBeGreaterThan(5);
  });

  /** Run `f` with TRICK OR TREAT!'s lineup setting turned on (it's off for now). */
  const withSetLineup = (f: () => void): void => {
    const flags = arcadeTuning.trickOrTreat as { setLineup: boolean };
    const was = flags.setLineup;
    flags.setLineup = true;
    try {
      f();
    } finally {
      flags.setLineup = was;
    }
  };

  const take = (player: typeof boo) =>
    dispatch(offering({ rarity: 'common', kind: 'recruit', player }), { type: 'pick', offer: 0 });

  it('a new player goes straight into the slot it improves most, a slot it prefers on a tie', () => {
    // 200 in all against seven plain 150s: it beats them all by the same, so it goes to a Catcher slot.
    const star = { ...boo, stats: { hustle: 60, hands: 100, heft: 40 } };
    const r = take(star);
    const slot = r.state.roster.findIndex((p) => p.name === 'Boo Radish');
    expect(ROSTER_ROLES[slot]).toBe('catcher');
    expect(r.state.bench).toHaveLength(1);
    expect(ofType(r.events, 'joined')[0]).toMatchObject({ slot, replaced: r.state.bench[0]!.name });
    // Play goes straight on (the lineup is set for you).
    expect(r.state.phase).toBe('setup');
    expect(r.state.offer).toEqual([]);
    expect(r.state.field.players.some((p) => p.form === 'ghost')).toBe(true);
  });

  it('with setting the lineup turned on, the roster stays open to rearrange, then Done', () => {
    withSetLineup(() => {
      const r = take({ ...boo, stats: { hustle: 60, hands: 100, heft: 40 } });
      expect(r.state.phase).toBe('draft');
      expect(dispatch(r.state, { type: 'skipDraft' }).state.phase).toBe('setup');
    });
  });

  it('it goes in for the weakest player, wherever it plays', () => {
    const s = offering({
      rarity: 'common',
      kind: 'recruit',
      player: { ...boo, stats: { hustle: 60, hands: 100, heft: 40 } },
    });
    s.roster[1] = { ...s.roster[1]!, stats: { hustle: 30, hands: 30, heft: 30 } };
    const r = dispatch(s, { type: 'pick', offer: 0 }).state;
    expect(r.roster[1]!.name).toBe('Boo Radish');
  });

  it('a new player who beats nobody sits on the bench', () => {
    const r = take(boo); // 150, like everyone
    expect(r.state.bench.map((p) => p.name)).toEqual(['Boo Radish']);
    expect(ofType(r.events, 'joined')[0]).toMatchObject({ slot: -1, replaced: null });
  });

  it('the bench has no limit, and the newest sit at the top', () => {
    const s = offering({
      rarity: 'common',
      kind: 'recruit',
      player: { ...boo, stats: { hustle: 60, hands: 100, heft: 40 } },
    });
    s.bench = Array.from({ length: 6 }, (_, i) => ({ ...s.roster[0]!, name: `Sub ${i}` }));
    const r = dispatch(s, { type: 'pick', offer: 0 });
    const replaced = ofType(r.events, 'joined')[0]!.replaced;
    expect(r.state.bench.map((p) => p.name)).toEqual([
      replaced,
      'Sub 0',
      'Sub 1',
      'Sub 2',
      'Sub 3',
      'Sub 4',
      'Sub 5',
    ]);
  });

  it('with setting the lineup turned on, any player can play any position: two swap slots', () => {
    withSetLineup(() => {
      const s = atDraft();
      const [a, b] = [s.roster[0]!.name, s.roster[4]!.name];
      const swapped = dispatch(s, { type: 'swap', a: 0, b: 4 }).state;
      expect(swapped.roster[0]!.name).toBe(b);
      expect(swapped.roster[4]!.name).toBe(a);
      // The Catcher now in a Blocker slot plays Blocker, with its own stats.
      const blocker = swapped.field.players.find((p) => p.slot === 0)!;
      expect(blocker.role).toBe('blocker');
      expect(blocker.stats).toEqual(playerStats(swapped, 0));
    });
  });

  it('with it off (for now), tapping players swaps nobody', () => {
    const s = atDraft();
    const names = s.roster.map((p) => p.name);
    expect(dispatch(s, { type: 'swap', a: 0, b: 4 }).state.roster.map((p) => p.name)).toEqual(
      names,
    );
  });

  it('skipping takes nothing and moves on', () => {
    const s = dispatch(atDraft(), { type: 'skipDraft' }).state;
    expect(s.phase).toBe('setup');
    expect(s.perks).toEqual(noPerks());
  });
});

describe('the perks in play', () => {
  const withPerk = (state: RunState, perk: Perk): RunState => {
    applyPerk(state.perks, perk);
    return state;
  };

  it('Extra Sweep holds the pocket longer; Slow-Mo Sweep slows the line', () => {
    const base = playState([]);
    const extra = withPerk(playState([]), { rarity: 'common', kind: 'extraSweep' });
    expect(pocketTime(extra)).toBeGreaterThan(pocketTime(base));
    const slow = withPerk(playState([]), { rarity: 'rare', kind: 'slowSweep' });
    expect(sweepSpeed(slow)).toBeCloseTo(sweepSpeed(base) * 0.75);
  });

  it('Hot Arm: the ball gets there in half the time', () => {
    const flight = (s: RunState) => {
      const r = run(s, 0.1, throwAt(s, v(4, 6)));
      const thrown = ofType(r.events, 'thrown')[0]!;
      return thrown.landsAt - (r.state.time - 0.1);
    };
    const plain = playState([{ pos: v(4, 6), job: stand(v(4, 6)) }]);
    const hot = withPerk(playState([{ pos: v(4, 6), job: stand(v(4, 6)) }]), {
      rarity: 'rare',
      kind: 'hotArm',
    });
    expect(flight(hot)).toBeLessThan(flight(plain) * 0.75);
  });

  it('Candy Corn Magnet: a throw about to fall incomplete near a Catcher is caught', () => {
    // The bullet runs out at (6.8, 30), the end of its range; a Catcher stands 1.65 yards off it:
    // out of reach, but not of twice its reach.
    const make = () => playState([{ pos: v(8.4, 29.6), job: stand(v(8.4, 29.6)) }]);
    const end = v(6.8, 30);
    const plain = make();
    expect(ofType(run(plain, 3, throwAt(plain, end)).events, 'caught')).toHaveLength(0);
    const magnet = withPerk(make(), { rarity: 'rare', kind: 'magnet' });
    const r = run(magnet, 3, throwAt(magnet, end));
    expect(ofType(r.events, 'caught')).toHaveLength(1);
  });

  it('Second Wind: once a drive, a BAD Break it! counts as OK', () => {
    forceBreakKind('bar');
    const s = carry(
      playState(
        [{ role: 'runner', pos: v(0, 2) }],
        [{ kind: 'cover', pos: v(0, 4), stats: { heft: 50 } }],
      ),
      2,
    );
    s.field.lane = 0;
    withPerk(s, { rarity: 'rare', kind: 'secondWind' });
    const g = untilGrabbed(s).state;
    const r = tapAt(g, 0.02);
    forceBreakKind(undefined);
    expect(ofType(r.events, 'breakResult')[0]?.outcome).toBe('drag');
    expect(r.state.perks.secondWindUsed).toBe(true);
    expect(arcadeTuning.countdown.ready).toBeGreaterThan(0);
  });
});
