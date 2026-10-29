/**
 * The arcade simulation's types (GAMEPLAY.md, rewritten 2026-10-19). The
 * simulation is pure data: a RunState advanced one fixed step at a time by
 * step(), with actions between steps through dispatch(). Nothing here knows
 * about rendering or audio.
 *
 * Coordinates are yards: x across the field (0 is the middle, negative is
 * left), y upfield. Each drive starts its line of scrimmage at y = 0 and its
 * first-down line at y = 10. Times are seconds.
 */
import type { Play } from '../content/plays';

export interface Vec {
  readonly x: number;
  readonly y: number;
}

/** Hustle (speed), Hands (reach), Heft (weight). Small whole numbers around 0. */
export interface Stats {
  readonly hustle: number;
  readonly hands: number;
  readonly heft: number;
}

export type Role = 'qb' | 'blocker' | 'runner' | 'catcher';
export type Form = 'human' | 'golem' | 'werewolf' | 'ghost';
/** The defenders. (The Bosses aren't defenders: each stands in its end zone as a prop, sim/props.ts.) */
export type DefenderKind = 'rusher' | 'cover' | 'zone' | 'safety' | 'bat' | 'crow';

/** Everything that moves and collides: a circle with stats turned into physics. */
interface BodyBase {
  readonly id: number;
  pos: Vec;
  vel: Vec;
  readonly radius: number;
  readonly stats: Stats;
  /** From Heft. */
  readonly mass: number;
  /** From Hustle: top speed. */
  readonly speed: number;
  /** From Hands: how far it can reach for the ball. */
  readonly reach: number;
  /** Seconds left lying on the turf (0 = up). */
  down: number;
}

/** What one of your players is doing this down. */
export type Job =
  | { readonly kind: 'qb' }
  | { readonly kind: 'route'; readonly to: readonly Vec[]; index: number }
  | { readonly kind: 'block' }
  | { readonly kind: 'carry' };

export interface Player extends BodyBase {
  readonly side: 'team';
  readonly role: Role;
  /** Which roster player (0-6), or -1 for the QB. */
  readonly slot: number;
  readonly form: Form;
  job: Job;
}

export interface Defender extends BodyBase {
  readonly side: 'defense';
  readonly kind: DefenderKind;
  readonly planted: boolean;
  readonly home: Vec;
  /** The player a Cover marks (picked at the snap). */
  mark: number | null;
  /** Hanging on to the carrier, at this offset from it (null when it isn't). */
  latch: Vec | null;
  /** A Bat's loop, and the corner it's heading for. */
  readonly patrol: readonly Vec[] | null;
  patrolIndex: number;
}

export type Body = Player | Defender;

export type Ball =
  | { readonly at: 'qb' }
  | {
      readonly at: 'flight';
      readonly from: Vec;
      readonly target: Vec;
      /** When it was thrown and when it comes down (sim time). */
      readonly thrownAt: number;
      readonly landsAt: number;
      /** A lob (two-tap throwing): it sails over everyone and is only caught or batted where it comes down. */
      readonly lob?: boolean;
    }
  | { readonly at: 'carried'; readonly by: number }
  | { readonly at: 'dead'; readonly pos: Vec; readonly how: DeadBall };

export type DeadBall = 'batted' | 'incomplete' | 'sacked' | 'tackled';

/** The three Bosses (each a prop in its end zone). */
export type BossName = 'misterFrog' | 'queen' | 'king';

/** A kind of prop on the field: its model, how big it is to bump into (yards), and how big it's drawn. */
export interface PropKind {
  readonly model: string;
  readonly radius: number;
  readonly scale: number;
  /** Always faces you (not turned at random): a character like the King. */
  readonly facing?: boolean;
}

/** A prop on the field (sim/props.ts): a solid circle everyone goes around; the ball flies over. */
export interface FieldProp extends PropKind {
  readonly id: number;
  readonly x: number;
  readonly y: number;
}

/** Mister Frog's Frog Rain: the lane it falls in this down (shown before the snap). */
export interface FrogLane {
  /** The lane's middle (yards across) and half its width. */
  readonly x: number;
  readonly half: number;
  /** It runs from the line of scrimmage up to here (yards upfield). */
  readonly from: number;
  readonly to: number;
}

/**
 * A pair of the King's crows (his drive): they sit on him, swoop at
 * whoever has the ball, and land on them for the SHOO! test. He has two
 * pairs a down: the second goes once the first is done.
 */
export interface RoyalCrows {
  /** On his arms; flying at the ball; on the holder (SHOO!); gone for the down. */
  phase: 'perched' | 'flying' | 'shoo' | 'gone';
  pos: Vec;
  /** SHOO!: seconds of live play left to shoo them off. */
  left: number;
  /** Who they've landed on (a body id). */
  on: number | null;
  /** When they were shooed off, missed or struck (sim time), or null. */
  goneAt: number | null;
}

export interface Field {
  readonly players: Player[];
  readonly defenders: Defender[];
  /** This drive's props on the field (and the stretches either side of it). */
  props: readonly FieldProp[];
  /**
   * Frog Rain (Mister Frog's drive): this down's lane, and once it's snapped,
   * the seconds of live play until the frogs all come down in it (negative
   * after, for the show), or null.
   */
  frogLane: FrogLane | null;
  frogDump: number | null;
  /** The King's two pairs of crows (his drive), in the order they go, or null. */
  crows: RoyalCrows[] | null;
  ball: Ball;
  /** Two-tap throwing: the line, stopped by the first tap (its angle, and when), or null while it sweeps. */
  aim: { readonly angle: number; readonly since: number } | null;
  /** On a handoff, the Runner's planned route (it leans toward it when it picks its lane), or null. */
  runPath: readonly Vec[] | null;
  /** The carrier's lane: the x it runs for (it picks the emptiest one itself, every moment). */
  lane: number;
  /** After a GREAT: seconds of live play left in which nobody can grab the carrier (it's breaking free). */
  breakaway: number;
  /** When the last Break it! this down ended (sim time), or null: a grab soon after gets a short countdown. */
  lastBreak: number | null;
  /** How many Break it!s this down has had: past `breakit.perDown`, a grab is just a tackle. */
  breaks: number;
  /** A carrier dragging tacklers after a close Break it!: it goes down when it reaches this row. */
  drag: { readonly to: number } | null;
}

/**
 * Break it! (GAMEPLAY.md): a defender has grabbed the carrier and the play
 * is frozen for one of three quick tests, picked at random. Each ends in a
 * break, a drag (`dragYards`), or a tackle (sim/breakit.ts).
 *
 * - **bar:** a marker crosses a meter once; tap in `sweet` (never in the
 *   first third of its trip) to break, within `near` of it to drag. `sweet`
 *   is measured along the trip; `dir` is which way it runs on screen.
 * - **mash:** tap as fast as you can: every tap adds `perTap` to `fill`;
 *   full breaks it, half full by the end drags.
 * - **juke:** at `showAt` (the end of the countdown) an arrow points to
 *   `side`; tap that side within `window` (the first half breaks, the rest
 *   drags). The wrong side, or too late, is a tackle.
 *
 * Each opens with a countdown, when taps don't count: `ready` long (shorter
 * when it follows hard on another Break it!).
 */
export type Tackle = {
  readonly startedAt: number;
  /** The countdown's length (sim seconds). */
  readonly ready: number;
  readonly tacklers: readonly number[];
  /** Yards a drag gets. */
  readonly dragYards: number;
} & (
  | {
      readonly kind: 'bar';
      readonly dir: 1 | -1;
      readonly sweet: { readonly from: number; readonly to: number };
      readonly near: number;
    }
  | { readonly kind: 'mash'; fill: number; readonly perTap: number }
  | {
      readonly kind: 'juke';
      readonly showAt: number;
      readonly side: 1 | -1;
      readonly window: number;
    }
);

export type BreakKind = Tackle['kind'];

export type DriveKind = 'intro' | 'challenge' | 'gimmick' | 'boss';

export interface Drive {
  readonly area: number;
  /** 0-3: Intro, Challenge, Gimmick, Boss. */
  readonly index: number;
  readonly kind: DriveKind;
  readonly name: string;
  /** Where the drive started (always 0) and the line it has to cross (10). */
  readonly start: number;
  readonly firstDown: number;
  down: number;
  /** The line of scrimmage (yards upfield). */
  los: number;
}

export type DownResult =
  'tackled' | 'incomplete' | 'batted' | 'sacked' | 'outOfBounds' | 'firstDown';

/** One of your seven players, for the whole run. */
/** A position on the field: a slot in the line-up (2 Blockers, 2 Runners, 3 Catchers). */
export type Position = 'blocker' | 'runner' | 'catcher';

/**
 * One of your seven players, for the whole run (GAMEPLAY.md, Your Team): a
 * name, a kind, the position it prefers, and its own stats (50 is
 * ordinary). Where it plays is its slot in the roster, not its preference:
 * any player can play any position.
 */
export interface RosterPlayer {
  readonly name: string;
  readonly kind: Form;
  readonly preferred: Position;
  readonly stats: Stats;
}

/** How rare a perk is: how often it turns up. */
export type Rarity = 'common' | 'rare' | 'epic';

/** A TRICK OR TREAT! perk (GAMEPLAY.md, Building Up). */
export type Perk = { readonly rarity: Rarity } & (
  | { readonly kind: 'allStat'; readonly stat: keyof Stats; readonly amount: number }
  | {
      readonly kind: 'kindStat';
      readonly form: Form;
      readonly stat: keyof Stats;
      readonly amount: number;
    }
  | { readonly kind: 'extraSweep' }
  | { readonly kind: 'slowSweep' }
  | { readonly kind: 'secondWind' }
  | { readonly kind: 'magnet' }
  | { readonly kind: 'hotArm' }
  | { readonly kind: 'recruit'; readonly player: RosterPlayer }
);

/** Everything the perks taken so far add up to. */
export interface Perks {
  /** Added to every player's stats. */
  all: Stats;
  /** Added to the stats of every player of a kind. */
  byKind: Partial<Record<Form, Stats>>;
  /** More sweeps before the pocket collapses. */
  extraScans: number;
  /** The sweep's speed is multiplied by this (Slow-Mo Sweep: ×0.75 each). */
  sweepScale: number;
  /** Second Wind: once a drive, a BAD Break it! counts as OK… */
  secondWind: boolean;
  /** …and whether it's been used this drive. */
  secondWindUsed: boolean;
  /** Candy Corn Magnet: a ball that would fall incomplete gets twice the reach. */
  magnet: boolean;
  /** The bullet's speed is multiplied by this (Hot Arm: ×2). */
  throwScale: number;
}

export type Phase =
  | 'setup'
  | 'play'
  /** Break it!: the play is frozen while you time the tap. */
  | 'breakit'
  | 'downOver'
  | 'draft'
  | 'over'
  | 'won';

export interface RunState {
  readonly seed: number;
  /**
   * Hard mode (?hard=1): the zones go round and round until you lose, each with two
   * more defenders; recruits grow by 30 a zone (Hands more slowly); you set your lineup.
   */
  readonly hard: boolean;
  /** Two-tap throwing (?aim=2): the first THROW stops the line, the second lobs it as far as the marker. */
  readonly twoTapAim: boolean;
  /** Fixed steps since the run began, and the time they add up to. */
  step: number;
  time: number;
  phase: Phase;
  drive: Drive;
  /**
   * The plays this run can deal (CONTEXT.md, playbook). The play pool unless the
   * run was started with its own; plays as rewards will grow it.
   */
  readonly playbook: readonly Play[];
  /**
   * Practice (the play editor's Try it, docs/PLAY_EDITOR.md): the playbook is
   * one sketch, called at every setup, and every rep lines up the same spot.
   */
  readonly practice: boolean;
  /** The three play cards on offer this down (indices into the playbook), which one is called (null until one is), and whether Flip is on. */
  hand: number[];
  called: number | null;
  /** The Queen's Royal Decree (her drive): the card in the hand that's banned this down, or null. */
  banned: number | null;
  flipped: boolean;
  /** The play called (or, before the call, the first card's), and whether it's mirrored. */
  play: { readonly index: number; readonly flipped: boolean };
  /** Break it!, while it's on. */
  tackle: Tackle | null;
  /** The seven on the field, in slot order (the slot decides the position played)… */
  roster: RosterPlayer[];
  /** …and the bench: kept, but not playing, newest first (it has no limit). */
  bench: RosterPlayer[];
  /** What the perks taken so far add up to. */
  perks: Perks;
  /** TRICK OR TREAT!: the three perks on offer… */
  offer: Perk[];
  field: Field;
  /** When this down was snapped (sim time). */
  snappedAt: number;
  /** Seconds left before the next down (in downOver). */
  pause: number;
  result: { readonly result: DownResult; readonly gained: number } | null;
  drivesWon: number;
  /** Net yards over the run. */
  yards: number;
  nextId: number;
}

/** What the player does on a step: the two buttons, and the Break it! tap. */
export interface StepInput {
  /** THROW: a bullet along the sweeping line. */
  readonly throw?: boolean;
  /** A tap in Break it! (the bar, and each tap of a mash). */
  readonly breakTap?: boolean;
  /** A juke: a tap on the left (-1) or right (+1) side of the screen. */
  readonly juke?: -1 | 1;
  /** SHOO!: drive the King's crows off whoever they've landed on. */
  readonly shoo?: boolean;
}

export type Action =
  /** Tap a play card: call it (its routes show), or switch to it. */
  | { readonly type: 'call'; readonly hand: number }
  /** Mirror the cards (and the called play). */
  | { readonly type: 'flip' }
  /** HIKE: start the called play. */
  | { readonly type: 'hike' }
  | { readonly type: 'skipDraft' }
  /** TRICK OR TREAT!: take one of the perks on offer. */
  | { readonly type: 'pick'; readonly offer: number }
  /** Swap two players' spots, field or bench (between drives). Spots: 0-6 are the field slots, 7 up the bench seats. */
  | { readonly type: 'swap'; readonly a: number; readonly b: number };

export type ArcadeEvent =
  | { readonly type: 'downStarted'; readonly down: number; readonly toGo: number }
  | { readonly type: 'called'; readonly play: string; readonly flipped: boolean }
  /** A card banned by the Queen's Royal Decree was tapped: it can't be called. */
  | { readonly type: 'banned' }
  | { readonly type: 'snapped' }
  | { readonly type: 'handoff'; readonly id: number }
  | { readonly type: 'thrown'; readonly target: Vec; readonly landsAt: number }
  | { readonly type: 'caught'; readonly id: number; readonly contested: boolean }
  /** A pass knocked down: `contested` when your player had a hand to it too and lost it. */
  | { readonly type: 'batted'; readonly by: number; readonly at: Vec; readonly contested: boolean }
  | { readonly type: 'incomplete'; readonly at: Vec }
  | { readonly type: 'pancake'; readonly blocker: number; readonly defender: number }
  /** A defender grabbed the carrier: Break it! starts. */
  | { readonly type: 'grabbed'; readonly id: number; readonly by: readonly number[] }
  /** How a Break it! went: a break, a drag, or a tackle. */
  | { readonly type: 'breakResult'; readonly outcome: 'break' | 'drag' | 'tackle' }
  /** A tap in the sweet spot: this tackler goes flying, the carrier keeps going. */
  | { readonly type: 'brokeTackle'; readonly id: number; readonly defender: number }
  /** A close tap: the carrier drags its tacklers this far before it goes down. */
  | { readonly type: 'dragged'; readonly id: number; readonly yards: number }
  | { readonly type: 'tackled'; readonly id: number; readonly by: number }
  /** The pocket collapsed (after its sweeps) with the QB still holding the ball. */
  | { readonly type: 'sacked' }
  /** The King's crows landed on the ball's holder (SHOO! now); were shooed off; or knocked it down. */
  | { readonly type: 'crowsLanded'; readonly on: number }
  | { readonly type: 'crowsShooed' }
  | { readonly type: 'crowsStruck'; readonly on: number }
  | { readonly type: 'outOfBounds'; readonly id: number }
  | { readonly type: 'downEnded'; readonly result: DownResult; readonly gained: number }
  | { readonly type: 'driveWon'; readonly drive: number }
  | { readonly type: 'perk'; readonly perk: Perk }
  | {
      readonly type: 'joined';
      readonly name: string;
      /** The field slot it took (-1: it sat on the bench), and who it put on the bench, if anyone. */
      readonly slot: number;
      readonly replaced: string | null;
    }
  /** The frogs came down (Frog Rain): `flattened` are the bodies in the lane they knocked down. */
  | { readonly type: 'frogRain'; readonly flattened: readonly number[] }
  /** …and the carrier was in it: tackled there. */
  | { readonly type: 'frogged'; readonly id: number }
  | { readonly type: 'driveStarted'; readonly drive: number; readonly name: string }
  | { readonly type: 'areaCleared'; readonly area: number }
  | { readonly type: 'gameOver'; readonly drivesWon: number; readonly yards: number };

export interface ArcadeResult {
  readonly state: RunState;
  readonly events: ArcadeEvent[];
}
