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
import type { FieldEvent } from '../content/fieldEvents';
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
  /** Seconds left at a lightning bolt's speed (0 = none: docs/PICKUPS.md). */
  boltLeft: number;
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
  /** SNAG IT! (docs/SNAG.md): it hangs just short of the receiver's hands while the test is on. */
  | { readonly at: 'contested'; readonly pos: Vec }
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

/** A trick or a treat (docs/PICKUPS.md): the lightning bolt speeds up whoever takes it, the oil slick trips them. */
export type PickupKind = 'bolt' | 'slick';

/** A pickup on the field (sim/pickups.ts), in the drive's own coordinates; the first of your players to run through it takes it. */
export interface Pickup {
  /** Unique in the run, so one taken stays gone (RunState.taken). */
  readonly id: number;
  readonly kind: PickupKind;
  readonly x: number;
  readonly y: number;
}

/** A field event's area as placed this down, in field yards: a rectangle (a lane or a band). */
export interface PlacedRect {
  readonly shape: 'rect';
  /** Left and right edges (across), near and far edges (upfield). */
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
}

/** A field event's circle as placed this down, in field yards. */
export interface PlacedCircle {
  readonly shape: 'circle';
  readonly x: number;
  readonly y: number;
  readonly r: number;
}

export type PlacedArea = PlacedRect | PlacedCircle;

/** A field event on the field this down (docs/FIELD_EVENTS.md): which, where, and when it goes off. */
export interface FieldEventOn {
  readonly event: FieldEvent;
  readonly area: PlacedArea;
  /**
   * Sim seconds of live play until it goes off: null before the snap; past
   * zero it counts on to −1 for the show, then null again.
   */
  left: number | null;
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
  /** The pickups lying there, not yet taken (none in practice). */
  pickups: readonly Pickup[];
  /** This down's field event (Frog Rain, on Mister Frog's drive), shown from before the snap, or null. */
  fieldEvent: FieldEventOn | null;
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

/**
 * SNAG IT! (docs/SNAG.md): a contested ball, the play frozen while the Coach
 * taps each dot as its ring closes. Dots are placed in a square box, as
 * shares of its sides (0 to 1, x left to right, y top to bottom).
 */
export interface Snag {
  readonly startedAt: number;
  /** Who'd catch it, and the defenders reaching for it too (the first is the one that'd bat it). */
  readonly receiver: number;
  readonly defenders: readonly number[];
  readonly dots: SnagDot[];
}

export interface SnagDot {
  readonly x: number;
  readonly y: number;
  /** When it shows, and when its ring closes onto it (sim time). */
  readonly appearsAt: number;
  readonly closesAt: number;
  /** Hit or missed, or null while it's still to play. */
  result: SnagDotResult;
}

/** How a SNAG IT! dot went: hit, missed, or null while it's still to play. */
export type SnagDotResult = 'hit' | 'miss' | null;

/**
 * The tip drill (docs/TIP.md): a contested ball, the play frozen while the
 * Coach juggles it, tapping as each pop lands back on the receiver's hands.
 */
export interface TipDrill {
  readonly startedAt: number;
  /** Who'd catch it, and the defenders reaching for it too (the first is the one that'd bat it). */
  readonly receiver: number;
  readonly defenders: readonly number[];
  /** How long each pop is in the air, in order (sim seconds). */
  readonly pops: readonly number[];
  /** When the pop being played left the hands: the first as the countdown ends, each later one at the tap before it. */
  poppedAt: number;
  /** How each pop played so far went, in order. */
  readonly results: TipResult[];
}

/** How a pop went: tapped close to its landing, a little off, or dropped. */
export type TipResult = 'clean' | 'bobble' | 'drop';

/** A tap test's grade, as Break it!, SNAG IT! and the tip drill all grade. */
export type Grade = 'great' | 'ok' | 'bad';

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
  /** SNAG IT!: the play is frozen while you tap the dots. */
  | 'snag'
  /** The tip drill: the play is frozen while you juggle the ball. */
  | 'tip'
  | 'downOver'
  | 'draft'
  | 'over'
  | 'won';

export interface RunState {
  readonly seed: number;
  /**
   * Hard mode (a link's default: `readModes`): the zones go round and round until you lose, each with two
   * more defenders; recruits grow by 30 a zone (Hands more slowly); you set your lineup.
   */
  readonly hard: boolean;
  /** Two-tap throwing (a link's default: `readModes`): the first THROW stops the line, the second lobs it as far as the marker. */
  readonly twoTapAim: boolean;
  /** ?snag=1: SNAG IT! from the first drive, not only from drive 5 (docs/SNAG.md). */
  readonly snagAlways: boolean;
  /** ?tip=1: the tip drill from the first drive (docs/TIP.md); with ?snag=1 too, either at random. */
  readonly tipAlways: boolean;
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
  /** Event practice (the event editor's Try it): the field event set off every rep, or null. */
  readonly practiceEvent: FieldEvent | null;
  /** The pickups taken this run, by id: they never come back (map item k3). */
  taken: number[];
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
  /** SNAG IT!, while it's on. */
  snag: Snag | null;
  /**
   * The SNAG IT! that just finished, every dot graded, and when: kept so the
   * box can show the last dot's pop before it closes (`catchTests.linger`). For the
   * screen only; nothing in the sim reads it.
   */
  snagDone: { readonly snag: Snag; readonly endedAt: number } | null;
  /** The tip drill, while it's on… */
  tip: TipDrill | null;
  /** …and the one that just finished, and when, kept as `snagDone` is (for the screen only). */
  tipDone: { readonly tip: TipDrill; readonly endedAt: number } | null;
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
  /** SNAG IT!: a tap on this dot. */
  readonly snag?: number;
  /** The tip drill: a tap anywhere in its box. */
  readonly tip?: boolean;
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
  /** A contested ball: SNAG IT! starts. */
  | { readonly type: 'snagStarted'; readonly receiver: number; readonly dots: number }
  /** A dot hit or missed in SNAG IT!… */
  | { readonly type: 'snagDot'; readonly index: number; readonly hit: boolean }
  /** …and how it went. */
  | { readonly type: 'snagResult'; readonly grade: Grade }
  /** A contested ball: the tip drill starts… */
  | { readonly type: 'tipStarted'; readonly receiver: number; readonly pops: number }
  /** …each pop tapped clean, bobbled or dropped… */
  | { readonly type: 'tipPop'; readonly index: number; readonly result: TipResult }
  /** …and how it went. */
  | { readonly type: 'tipResult'; readonly grade: Grade }
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
  /** A field event went off (the frogs came down): `hit` are the bodies in it that it caught… */
  | { readonly type: 'fieldEventWentOff'; readonly event: string; readonly hit: readonly number[] }
  /** …and the carrier was one: tackled there, with the event's call (FROGGED!), or none. */
  | { readonly type: 'eventTackled'; readonly id: number; readonly call: string | null }
  /** One of your players ran through a pickup and took it (docs/PICKUPS.md). */
  | {
      readonly type: 'pickupTaken';
      readonly id: number;
      readonly kind: PickupKind;
      readonly pickup: number;
    }
  /** A carrier slipped on an oil slick and is down there: SLIPPED! */
  | { readonly type: 'slipped'; readonly id: number }
  | { readonly type: 'driveStarted'; readonly drive: number; readonly name: string }
  | { readonly type: 'areaCleared'; readonly area: number }
  | { readonly type: 'gameOver'; readonly drivesWon: number; readonly yards: number };

export interface ArcadeResult {
  readonly state: RunState;
  readonly events: ArcadeEvent[];
}
