/**
 * The forest's defenders (GAMEPLAY.md, The Defense) and each drive's
 * defense. Spots are relative to the line of scrimmage (x across, y
 * upfield). The first drive is a handful of sleepy defenders; the Boss
 * brings the whole forest. Every area adds to every defender's stats.
 */
import type { BossName, DefenderKind, PropKind, Stats } from '../sim/types';
import type { DefaultEventId } from './fieldEvents';

export interface DefenderDef {
  readonly name: string;
  readonly creature: string;
  readonly stats: Stats;
  readonly radius: number;
  /** Planted: never moves, and nothing can shove it. Running into one is a tackle. */
  readonly planted: boolean;
  /**
   * Extra reach for the ball beyond what its Hands give it: a Scarecrow's
   * arms cover a wide ring (drawn on the turf), so any low pass coming down
   * inside it is contested.
   */
  readonly reachBonus: number;
}

export const DEFENDERS: Readonly<Record<DefenderKind, DefenderDef>> = {
  rusher: {
    name: 'Rusher',
    creature: 'Rhino Beetle',
    stats: { hustle: 40, hands: 40, heft: 70 },
    radius: 0.6,
    planted: false,
    reachBonus: 0,
  },
  cover: {
    name: 'Cover',
    creature: 'Garden Gnome',
    stats: { hustle: 50, hands: 50, heft: 40 },
    radius: 0.4,
    planted: false,
    reachBonus: 0,
  },
  zone: {
    name: 'Zone',
    creature: 'Scarecrow',
    stats: { hustle: 50, hands: 80, heft: 80 },
    radius: 0.55,
    planted: true,
    reachBonus: 1.2,
  },
  safety: {
    name: 'Safety',
    creature: 'Owl',
    stats: { hustle: 60, hands: 60, heft: 50 },
    radius: 0.5,
    planted: false,
    reachBonus: 0,
  },
  bat: {
    name: 'Bat',
    creature: 'Bat',
    stats: { hustle: 40, hands: 60, heft: 30 },
    radius: 0.4,
    planted: false,
    reachBonus: 0.3,
  },

  crow: {
    name: 'Crow',
    creature: 'Crow',
    // Like a Bat (it swats passes that fly through it), but it patrols a lane up and down the field.
    stats: { hustle: 50, hands: 60, heft: 30 },
    radius: 0.4,
    planted: false,
    reachBonus: 0.3,
  },
};

export interface DefenseSpot {
  readonly kind: DefenderKind;
  readonly x: number;
  readonly y: number;
}

export interface DefenseSpec {
  readonly name: string;
  readonly defenders: readonly DefenseSpot[];
  /** Added to every defender's stats on top of the area's boost (a sleepy first drive is negative). */
  readonly boost: number;
  /** The drive's field event, by id: Mister Frog's Frog Rain (docs/FIELD_EVENTS.md). */
  readonly fieldEvent?: DefaultEventId;
  /** The Queen's Royal Decree: each down one of the three cards is banned (it can't be called). */
  readonly decree?: boolean;
  /** A Boss drive: the Boss who stands in its end zone, a prop (sim/props.ts, BOSSES). */
  readonly boss?: BossName;
  /** The last drive of the run: the end zone is Jack's pumpkin patch. */
  readonly home?: boolean;
}

const d = (kind: DefenderKind, x: number, y: number): DefenseSpot => ({ kind, x, y });
/** The Owl always hangs deep (sim/run.ts places it at least past the first-down line). */
const owl = d('safety', 0, 12);

/** How an area looks: its turf, floor and sideline props (render/scenery.ts, render/field.ts). */
export type Biome = 'forest' | 'candy' | 'farm';

export interface ArcadeArea {
  readonly name: string;
  readonly biome: Biome;
  /** The props on its stretch of the field (sim/props.ts): things to go around. */
  readonly fieldProps: readonly PropKind[];
  /** Its own look for a kind of defender (a model id), where it isn't the Forest's: the rule stays the kind's. */
  readonly looks: Partial<Record<DefenderKind, string>>;
  readonly intro: DefenseSpec;
  readonly challenge: DefenseSpec;
  /** Its Gimmick drive: the same every run. */
  readonly gimmick: DefenseSpec;
  readonly boss: DefenseSpec;
}

export const FOREST: ArcadeArea = {
  name: "Froggy's Forest",
  biome: 'forest',
  looks: {},
  fieldProps: [
    { model: 'forestProps/pine', radius: 0.45, scale: 0.6 },
    { model: 'forestProps/deadTree', radius: 0.35, scale: 0.65 },
    { model: 'forestProps/stump', radius: 0.42, scale: 1 },
    { model: 'forestProps/toadstools', radius: 0.38, scale: 1.2 },
  ],
  intro: {
    name: 'A Quiet Clearing',
    boost: -10,
    defenders: [d('rusher', -1.8, 1), d('cover', -6.3, 4), d('cover', 4.2, 5), owl],
  },
  challenge: {
    name: 'Gnome Country',
    boost: 0,
    defenders: [
      d('rusher', -1.8, 1),
      d('cover', -6.3, 4),
      d('cover', 6.3, 5),
      d('zone', 2.8, 8),
      owl,
    ],
  },
  gimmick: {
    name: 'Bat Cave',
    boost: 0,
    defenders: [
      d('rusher', 1.8, 1),
      d('cover', -6.3, 4),
      d('cover', 6.3, 4),
      d('bat', 2.1, 5),
      d('bat', 4.2, 11),
      owl,
    ],
  },

  boss: {
    name: "Mister Frog's Pond",
    boss: 'misterFrog',
    boost: 0,
    fieldEvent: 'frogRain',
    defenders: [
      d('rusher', -1.8, 1),
      d('rusher', 1.8, 1),
      d('cover', -6.3, 4),
      d('cover', 6.3, 4),
      d('cover', 3.5, 6),
      d('zone', -2.8, 9),
      d('bat', 1.4, 7),
      d('safety', 0, 12),
    ],
  },
};

/**
 * The Candy Kingdom: the Queen's gingerbread realm. The rules are the same
 * kinds as the Forest's; Covers are Gingerbread Men and the Safeties are
 * Witches on brooms (two, one each side, here and on the Farm). Its Boss is
 * the Queen, whose Royal Decree bans a card each down.
 */
export const CANDY_KINGDOM: ArcadeArea = {
  name: 'Candy Queendom',
  biome: 'candy',
  looks: { cover: 'candy/gingerbreadMan', safety: 'forest/witch' },
  fieldProps: [
    { model: 'candyProps/gumdrop', radius: 0.5, scale: 1 },
    { model: 'candyProps/lollipop', radius: 0.35, scale: 1, facing: true },
    { model: 'candyProps/candyCane', radius: 0.3, scale: 0.8 },
  ],
  intro: {
    name: 'Gumdrop Lane',
    // A sleepy start, like every area's Intro.
    boost: -10,
    defenders: [
      d('rusher', 1.8, 1),
      d('cover', -6.3, 4),
      d('cover', 4.2, 5),
      d('safety', -3.5, 12),
      d('safety', 3.5, 12),
    ],
  },
  challenge: {
    name: 'Gingerbread Row',
    boost: 0,
    defenders: [
      d('rusher', 1.8, 1),
      d('cover', -6.3, 4),
      d('cover', 6.3, 5),
      d('cover', -3.5, 6),
      d('safety', -3.5, 12),
      d('safety', 3.5, 12),
    ],
  },
  gimmick: {
    name: 'Broomstick Alley',
    boost: 0,
    defenders: [
      d('rusher', 1.8, 1),
      d('cover', 6.3, 4),
      d('cover', -5.6, 6),
      d('cover', -3.5, 4),
      d('safety', -3.5, 12),
      d('safety', 3.5, 12),
    ],
  },

  boss: {
    name: "The Queen's Court",
    boss: 'queen',
    boost: 0,
    decree: true,
    defenders: [
      d('rusher', -1.8, 1),
      d('rusher', 1.8, 1),
      d('cover', -6.3, 4),
      d('cover', 6.3, 4),
      d('cover', -3.5, 6),
      d('zone', 2.8, 9),
      d('bat', -1.4, 7),
      d('safety', -3.5, 12),
      d('safety', 3.5, 12),
    ],
  },
};

/**
 * The Farm, by Jack's pumpkin patch: rows of Scarecrows and Crows patrolling
 * lanes up and down the field. Its last end zone is the patch: home. The
 * King, a giant scarecrow in a crown, stands guard in front of it: in play
 * he's only a prop (sim/props.ts, KING).
 */
export const FARM: ArcadeArea = {
  name: "Frederick's Farm",
  biome: 'farm',
  looks: {},
  fieldProps: [
    { model: 'forestProps/pumpkin', radius: 0.45, scale: 1 },
    { model: 'farmProps/hayBale', radius: 0.5, scale: 1 },
  ],
  intro: {
    name: 'The Back Forty',
    // A sleepy start, like every area's Intro.
    boost: -10,
    defenders: [
      d('rusher', -1.8, 1),
      d('cover', 6.3, 4),
      d('cover', -4.2, 5),
      d('safety', -3.5, 12),
      d('safety', 3.5, 12),
    ],
  },
  challenge: {
    name: 'The Cornrows',
    boost: 0,
    defenders: [
      d('rusher', -1.8, 1),
      d('cover', -6.3, 4),
      d('cover', 6.3, 5),
      d('zone', -2.8, 7),
      d('crow', 3.5, 4),
      d('safety', -3.5, 12),
      d('safety', 3.5, 12),
    ],
  },
  gimmick: {
    name: 'A Murder of Crows',
    boost: 0,
    defenders: [
      d('rusher', -1.8, 1),
      d('cover', -6.3, 4),
      d('cover', 6.3, 5),
      d('crow', -3.5, 3),
      d('crow', 1.4, 5),
      d('crow', 5.6, 3),
      d('safety', -3.5, 12),
      d('safety', 3.5, 12),
    ],
  },

  boss: {
    name: "The King's Patch",
    boss: 'king',
    boost: 0,
    home: true,
    defenders: [
      d('rusher', -1.8, 1),
      d('rusher', 1.8, 1),
      d('cover', -6.3, 4),
      d('cover', 6.3, 4),
      d('zone', -3.5, 8),
      d('zone', 3.5, 8),
      d('crow', -1.4, 5),
      d('safety', -3.5, 12),
      d('safety', 3.5, 12),
    ],
  },
};

/** The run's areas in order: the Forest, the Candy Kingdom, the Farm. */
export const AREAS: readonly ArcadeArea[] = [FOREST, CANDY_KINGDOM, FARM];

/** An area by its number: past the last they come round again (hard mode goes on for ever). */
export const areaAt = (area: number): ArcadeArea =>
  AREAS[Math.max(0, area) % AREAS.length] ?? FOREST;
