/**
 * What TRICK OR TREAT! shows (GAMEPLAY.md, Building Up): two new players
 * to choose from (each a player card like the roster's), then Your team
 * (docs/REWARDS.md, v2): the roster, with what each player gained since
 * the last TRICK OR TREAT! on its bars. The field is on the left by
 * position, the bench on the right; in hard mode any two swap.
 */
import { POSITION_STAT, ROSTER_ROLES } from '../content/team';
import { atSpot, BENCH_START, fieldedStats, playerStats, setsLineup } from '../sim/team';
import { STAT_ORDER } from '../sim/stats';
import { kindIcon } from './kindIcons';
import type { Form, Perk, Position, RosterPlayer, RunState, Stats } from '../sim/types';
import type { DraftView, OfferCard, RosterRow, StatBar } from '../../ui/hud';

const STAT: Readonly<Record<keyof Stats, string>> = {
  hustle: 'Hustle',
  hands: 'Hands',
  heft: 'Heft',
};
const KIND: Readonly<Record<Form, string>> = {
  human: 'Human',
  ghost: 'Ghost',
  golem: 'Golem',
  werewolf: 'Werewolf',
};
const POSITION: Readonly<Record<Position, string>> = {
  blocker: 'Blocker',
  runner: 'Runner',
  catcher: 'Catcher',
};

/** A player's bars, its main stat marked, with what it gained (Your team) drawn on them. */
const bars = (s: Stats, key?: keyof Stats, gained?: Stats): StatBar[] =>
  STAT_ORDER.map((k) => ({
    label: STAT[k],
    value: s[k],
    key: k === key,
    ...(gained?.[k] ? { delta: gained[k] } : {}),
  }));

/** The position a field slot plays. */
const slotPosition = (slot: number): Position => {
  const role = ROSTER_ROLES[slot];
  return role && role !== 'qb' ? role : 'catcher';
};

/** A new player on offer, as a player card. */
function offerCard(state: RunState, perk: Perk): OfferCard | null {
  if (perk.kind !== 'recruit') return null;
  const p = perk.player;
  return {
    title: 'New Player!',
    player: {
      name: p.name,
      form: KIND[p.kind],
      icon: kindIcon(p.kind),
      stats: bars(fieldedStats(state, p), POSITION_STAT[p.preferred]),
      note: `prefers ${POSITION[p.preferred]}`,
    },
  };
}

/**
 * The TRICK OR TREAT! screen: the cards to choose from, on their own; then
 * Your team (field and bench) with its growth, swappable in hard mode, and
 * PLAY ON.
 */
export function trickOrTreatView(state: RunState, selected: number | null): DraftView {
  // The cards have the screen to themselves (k4): the team comes after.
  if (state.offer.length > 0) {
    return {
      screen: 'offer',
      title: 'TRICK OR TREAT!',
      lead: 'Choose a player to join your team',
      offer: state.offer.map((p) => offerCard(state, p)).filter((c): c is OfferCard => c !== null),
      roster: [],
      bench: [],
      hand: null,
      swappable: false,
    };
  }
  // ★ on the position heading the tapped player prefers.
  const starred = (selected === null ? undefined : atSpot(state, selected))?.preferred;
  const row = (
    p: RosterPlayer,
    spot: number,
    position: string,
    stats: Stats,
    key?: keyof Stats,
  ): RosterRow => ({
    spot,
    position,
    selected: selected === spot,
    name: p.name,
    form: KIND[p.kind],
    icon: kindIcon(p.kind),
    stats: bars(stats, key, state.gains[p.id]),
    note:
      position === 'Bench' || p.preferred !== slotPosition(spot)
        ? `prefers ${POSITION[p.preferred]}`
        : '',
  });
  const roster: RosterRow[] = state.roster.map((p, slot) => {
    const position = slotPosition(slot);
    return {
      ...row(p, slot, POSITION[position], playerStats(state, slot), POSITION_STAT[position]),
      fits: starred === position,
    };
  });
  // The bench, newest first.
  const bench = state.bench.map((p, seat) =>
    row(p, BENCH_START + seat, 'Bench', fieldedStats(state, p)),
  );
  const from = selected === null ? null : atSpot(state, selected);
  const swappable = setsLineup(state);
  const hand = !swappable
    ? null
    : from
      ? `Now tap who ${from.name} swaps with (or ${from.name} again to cancel).`
      : 'Tap any two players to swap them, field or bench.';
  return {
    screen: 'team',
    title: 'Your team',
    lead: null,
    offer: [],
    roster,
    bench,
    hand,
    goOn: 'PLAY ON',
    swappable,
  };
}
