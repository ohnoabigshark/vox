/**
 * Your team between plays (GAMEPLAY.md, Your Team and Building Up): every
 * player's stats with the perks added, the TRICK OR TREAT!
 * offer, and taking a perk.
 */
import { arcadeTuning } from '../content/tuning';
import { POSITIONS, RECRUIT_NAMES, STARTING_NAMES, ZONE_OFFER } from '../content/perks';
import { BASE_STATS, FORM_STATS, POSITION_STAT, ROSTER_ROLES } from '../content/team';
import type { Rng } from '../../sim/rng';
import { rngFor } from './random';
import { even, plus, ZERO } from './stats';
import type { Form, Perk, Perks, Position, RosterPlayer, RunState, Stats } from './types';

const STATS: readonly (keyof Stats)[] = ['hustle', 'hands', 'heft'];
const KINDS: readonly Form[] = ['human', 'ghost', 'golem', 'werewolf'];
/** The seven you start with: plain humans, each in the position it prefers. */
export function startingRoster(): RosterPlayer[] {
  return ROSTER_ROLES.map((role, i) => {
    const preferred = role === 'qb' ? 'catcher' : role;
    return {
      name: STARTING_NAMES[i] ?? `Player ${i + 1}`,
      kind: 'human',
      preferred,
      stats: BASE_STATS,
    };
  });
}

export function noPerks(): Perks {
  return {
    all: ZERO,
    byKind: {},
    extraScans: 0,
    sweepScale: 1,
    secondWind: false,
    secondWindUsed: false,
    magnet: false,
    throwScale: 1,
  };
}

/** Spots on the roster screen: the field slots (0-6), then the bench seats from here. */
export const BENCH_START = ROSTER_ROLES.length;

/** Who's in a spot (a field slot or a bench seat), if anyone. */
export function atSpot(state: RunState, spot: number): RosterPlayer | undefined {
  return spot < BENCH_START ? state.roster[spot] : state.bench[spot - BENCH_START];
}

/** Put a player in a spot that has someone in it. */
export function setSpot(state: RunState, spot: number, p: RosterPlayer): void {
  if (spot < BENCH_START) state.roster[spot] = p;
  else state.bench[spot - BENCH_START] = p;
}

/** A player's stats with the team's perks (for everyone and for its kind), as it would play. */
export function fieldedStats(state: RunState, p: RosterPlayer): Stats {
  return plus(plus(p.stats, state.perks.all), state.perks.byKind[p.kind] ?? ZERO);
}

/** A field player's stats in play (by slot): its own, plus the perks. */
export function playerStats(state: RunState, slot: number): Stats {
  const p = state.roster[slot];
  return p ? fieldedStats(state, p) : even(50);
}

const total = (s: Stats): number => s.hustle + s.hands + s.heft;

/**
 * Where a new player goes: the field slot whose player it beats by the
 * most total stats (on a tie, a slot of the position it prefers), or null
 * when it beats nobody (it sits on the bench).
 */
export function bestSpot(state: RunState, recruit: RosterPlayer): number | null {
  let best: { slot: number; gain: number; fits: boolean } | null = null;
  state.roster.forEach((p, slot) => {
    const gain = total(recruit.stats) - total(p.stats);
    const fits = ROSTER_ROLES[slot] === recruit.preferred;
    if (gain <= 0) return;
    if (!best || gain > best.gain || (gain === best.gain && fits && !best.fits)) {
      best = { slot, gain, fits };
    }
  });
  return (best as { slot: number } | null)?.slot ?? null;
}

// ── The offer ───────────────────────────────────────────────────────────────

/**
 * TRICK OR TREAT!'s two cards: two new players, never of the same kind,
 * their stats adding up to the zone's total (ZONE_OFFER, by the zone of the
 * series about to be played).
 */
export function rollOffer(state: RunState): Perk[] {
  const rng = rngFor(state.seed, 'perks', state.seriesWon);
  const zone = ZONE_OFFER[Math.min(state.series.area, ZONE_OFFER.length - 1)] ?? ZONE_OFFER[0];
  if (!zone) return [];
  const hard = arcadeTuning.hard;
  const total = state.hard
    ? hard.recruitTotal + hard.recruitPerZone * state.series.area
    : zone.recruitTotal;
  const first = rng.pick(KINDS);
  const second = rng.pick(KINDS.filter((k) => k !== first));
  return [first, second].map((kind) => ({
    rarity: 'common',
    kind: 'recruit',
    player: state.hard
      ? slowHands(makeRecruit(rng, total, kind), total)
      : makeRecruit(rng, total, kind),
  }));
}

/** The position a player's best stat suits (a tie, at random among them). */
function suits(rng: Rng, stats: Stats): Position {
  const best = Math.max(...POSITIONS.map((p) => stats[POSITION_STAT[p]]));
  return rng.pick(POSITIONS.filter((p) => stats[POSITION_STAT[p]] === best));
}

/** How much each stat of a recruit may wander from its kind's shape (a share, either way). */
const RECRUIT_SPREAD = 0.2;

/**
 * A recruit of this kind, its stats adding up to `total`, shared out in
 * the shape of its kind (a Ghost mostly Hands, a Golem mostly Heft; a Human
 * evenly), each share nudged a little at random, in fives.
 */
function makeRecruit(rng: Rng, total: number, kind: Form): RosterPlayer {
  const shape = plus(BASE_STATS, FORM_STATS[kind]);
  const weight = (k: keyof Stats): number => shape[k] * (1 + RECRUIT_SPREAD * (2 * rng.next() - 1));
  const w = { hustle: weight('hustle'), hands: weight('hands'), heft: weight('heft') };
  const sum = w.hustle + w.hands + w.heft;
  const fives = (x: number): number => 5 * Math.round((total * x) / sum / 5);
  const rounded = { hustle: fives(w.hustle), hands: fives(w.hands), heft: fives(w.heft) };
  // Rounding can leave it a five off: put the difference on its biggest stat.
  const biggest = STATS.reduce((a, b) => (rounded[b] > rounded[a] ? b : a));
  const stats: Stats = {
    ...rounded,
    [biggest]: rounded[biggest] + total - (rounded.hustle + rounded.hands + rounded.heft),
  };
  return { name: rng.pick(RECRUIT_NAMES[kind]), kind, preferred: suits(rng, stats), stats };
}

/**
 * Hard mode's recruits grow for ever, but Hands (reach) only like the square
 * root of the total, so catches don't get silly: what it has over ordinary
 * is scaled by √(first zone's total / this total), and what that takes off
 * goes to its Hustle and Heft, half each, so the total stays the same.
 */
function slowHands(p: RosterPlayer, total: number): RosterPlayer {
  const base = arcadeTuning.hard.recruitTotal;
  const ordinary = arcadeTuning.body.statBase;
  const over = p.stats.hands - ordinary;
  if (over <= 0 || total <= base) return p;
  const hands = Math.round(ordinary + over * Math.sqrt(base / total));
  const freed = p.stats.hands - hands;
  const half = Math.floor(freed / 2);
  return {
    ...p,
    stats: {
      hands,
      hustle: p.stats.hustle + half,
      heft: p.stats.heft + (freed - half),
    },
  };
}

/** Whether TRICK OR TREAT! lets you set your lineup (hard mode does; otherwise a tuning flag). */
export function setsLineup(state: RunState): boolean {
  return state.hard || arcadeTuning.trickOrTreat.setLineup;
}

// ── Taking a perk ───────────────────────────────────────────────────────────

/** Apply a perk to the team (a recruit is placed by `pick`, in run.ts). */
export function applyPerk(perks: Perks, perk: Perk): void {
  switch (perk.kind) {
    case 'allStat':
      perks.all = plus(perks.all, { ...ZERO, [perk.stat]: perk.amount });
      break;
    case 'kindStat':
      perks.byKind = {
        ...perks.byKind,
        [perk.form]: plus(perks.byKind[perk.form] ?? ZERO, { ...ZERO, [perk.stat]: perk.amount }),
      };
      break;
    case 'extraSweep':
      perks.extraScans += 1;
      break;
    case 'slowSweep':
      perks.sweepScale *= 0.75;
      break;
    case 'secondWind':
      perks.secondWind = true;
      break;
    case 'magnet':
      perks.magnet = true;
      break;
    case 'hotArm':
      perks.throwScale *= 2;
      break;
    case 'recruit':
      break;
  }
}
