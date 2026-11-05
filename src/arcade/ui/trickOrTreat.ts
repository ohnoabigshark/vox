/**
 * What TRICK OR TREAT! shows (GAMEPLAY.md, Building Up): three cards to
 * choose from, each a new play, a new player (a player card like the
 * roster's) or a perk, and Skip; then Your team
 * (docs/REWARDS.md, v2): the roster, with what each player gained since
 * the last TRICK OR TREAT! on its bars. The field is on the left by
 * position, the bench on the right; in hard mode any two swap.
 */
import { POSITION_STAT, ROSTER_ROLES } from '../content/team';
import { atSpot, BENCH_START, fieldedStats, playerStats, setsLineup } from '../sim/team';
import { STAT_ORDER } from '../sim/stats';
import { kindIcon } from './kindIcons';
import { assertNever } from '../../assertNever';
import type { Form, OfferCard, Perk, Position, RosterPlayer, RunState, Stats } from '../sim/types';
import type {
  DraftView,
  OfferFace,
  PlayerCard,
  RosterRow,
  SelectedCard,
  StatBar,
} from '../../ui/hud';

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

/** What a player's card shows on Your team, and as the selected player before the snap: name, kind, photo, bars. */
function face(
  state: RunState,
  p: RosterPlayer,
  stats: Stats,
  key?: keyof Stats,
): Omit<PlayerCard, 'note'> {
  return {
    name: p.name,
    form: KIND[p.kind],
    icon: kindIcon(p.kind),
    stats: bars(stats, key, state.gains[p.id]),
  };
}

/** A field player's card, as selected before the snap (docs/SELECT.md, s3): Your team's, with its position. */
export function fieldCard(state: RunState, slot: number): SelectedCard | null {
  const p = state.roster[slot];
  if (!p) return null;
  const position = slotPosition(slot);
  return {
    ...face(state, p, playerStats(state, slot), POSITION_STAT[position]),
    position: POSITION[position],
  };
}

/** The position a field slot plays. */
const slotPosition = (slot: number): Position => {
  const role = ROSTER_ROLES[slot];
  return role && role !== 'qb' ? role : 'catcher';
};

/** What each perk on offer is called and does, and its icon (docs/REWARDS.md, o4). */
function perkFace(perk: Perk): { name: string; blurb: string; icon: string } {
  switch (perk.kind) {
    case 'secondWind':
      return {
        name: 'Second Wind',
        blurb: 'Once a series, a BAD on Break it! still drags on.',
        icon: SECOND_WIND_ICON,
      };
    case 'magnet':
      return {
        name: 'Candy Corn Magnet',
        blurb: 'A pass about to fall incomplete gets twice the catch reach.',
        icon: MAGNET_ICON,
      };
    case 'allStat':
    case 'kindStat':
    case 'extraSweep':
    case 'slowSweep':
    case 'hotArm':
      // Parked: never offered (docs/REWARDS.md, k2, k3). One that is has no card yet.
      throw new Error(`No card for the perk ${perk.kind}: it is parked, and not in OFFERED_PERKS`);
    default:
      return assertNever(perk);
  }
}

/** Second Wind: a gust, three swirling strokes. */
const SECOND_WIND_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="#f3ead6" stroke-width="2.4" stroke-linecap="round"><path d="M3 8h11a3 3 0 1 0-3-3"/><path d="M3 13h15a3 3 0 1 1-3 3"/><path d="M3 18h7"/></svg>';
/** Candy Corn Magnet: a horseshoe magnet in candy-corn bands. */
const MAGNET_ICON =
  '<svg viewBox="0 0 24 24"><path d="M5 3h5v9a2 2 0 0 0 4 0V3h5v9a7 7 0 0 1-14 0z" fill="#ff8a2a"/><path d="M5 3h5v4H5zM14 3h5v4h-5z" fill="#f3ead6"/><path d="M5 12a7 7 0 0 0 14 0h-5a2 2 0 0 1-4 0z" fill="#ffd23f"/></svg>';

/** A card on offer, as drawn: a new play, a new player (a player card), or a perk. */
function offerFace(state: RunState, card: OfferCard): OfferFace {
  switch (card.kind) {
    case 'play':
      return {
        kind: 'play',
        title: 'New Play!',
        play: card.play,
        blurb: card.play.handoff === undefined ? 'Pass play' : 'Run play',
      };
    case 'player': {
      const p = card.player;
      return {
        kind: 'player',
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
    case 'perk':
      return { kind: 'perk', title: 'Perk!', ...perkFace(card.perk) };
    default:
      return assertNever(card);
  }
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
      lead: 'Take one',
      offer: state.offer.map((c) => offerFace(state, c)),
      goOn: 'Skip',
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
    ...face(state, p, stats, key),
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
