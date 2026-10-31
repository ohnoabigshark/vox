/**
 * Every number for the arcade game (GAMEPLAY.md, rewritten 2026-10-19), in
 * one place. Distances are yards, times are seconds, speeds yards a second.
 * Starting values: tune by playtesting and the balance runs.
 */
export const arcadeTuning = {
  /** The simulation's fixed step. */
  stepsPerSecond: 60,
  field: {
    /** Half the field's width: x runs from -halfWidth to +halfWidth (18 yards wide, for the camera's sake). */
    halfWidth: 9.1,
  },
  drive: {
    /** Yards to gain for a first down. */
    distance: 10,
    downs: 4,
    /** Yards lost on a sack. */
    sackLoss: 2,
    /** Seconds a finished down stays on screen before the next lines up. */
    pause: 0.8,
  },
  run: {
    /** Areas in the main game (the forest again until there are more). */
    areas: 3,
  },
  /** How the three stats become physics (GAMEPLAY.md, Your Team). */
  body: {
    /** Stats are measured from this (ordinary)… */
    statBase: 50,
    /** …in steps of this: every number below that says "per Heft" or "per Hustle" means per step. */
    statStep: 10,
    /**
     * Heft is weight: mass = perHeft ^ Heft, so every point of Heft is the
     * same step at any level, and the contact ratios below read as Heft gaps.
     */
    mass: { perHeft: 1.25 },
    /** Hustle is speed (yards a second). */
    speed: { base: 3.4, perHustle: 0.4, min: 1.5 },
    /** Hands is reach (yards from the body's centre). */
    reach: { base: 0.9, perHands: 0.25, min: 0.3 },
    /** How fast anyone changes velocity (yards a second, a second). */
    accel: 12,
    /** How fast a body lying down slides to a stop. */
    friction: 8,
  },
  contact: {
    /** A Blocker this many times heavier than the defender it hits flattens it (3 Heft heavier)… */
    pancakeRatio: 1.9,
    /** …for this long. On a handoff it only takes this much heavier (2 Heft heavier). */
    pancakeTime: 2.4,
    runPancakeRatio: 1.5,
    /**
     * The drive block: on a handoff, anyone blocking for the Runner drives
     * the defender it's on back, away from the play, at this speed (yards a
     * second) at an even Heft match, plus this much per step of Heft over it
     * (within the range: a lighter blocker can only hold it).
     */
    drive: { base: 0.8, perHeft: 0.9, min: 0, max: 4 },
    /** A tackler shaken off in Break it! (or knocked off a SNAG IT! GREAT) lies there this long… */
    brokenTime: 1.0,
    /** …sent flying this fast (yards a second); a pancake or a scatter goes at `knockSpeed`. */
    brokenSpeed: 5,
    knockSpeed: 4,
    /** Bodies this close (beyond touching) count as contact for a tackle or a sack. */
    slop: 0.1,
    /**
     * A defender a Blocker is on moves at this share of its speed: held when
     * the Blocker is at least as heavy, slowed when it's lighter.
     */
    held: 0.25,
    slowed: 0.6,
  },
  throw: {
    /** A bullet: straight and fast, along the sweeping line (yards a second). */
    speed: 24,
    /** It flies no further than this past the line of scrimmage. */
    maxAhead: 30,
    /** Your players closer than this to the QB are skipped (it's going past them). */
    minDistance: 3,
  },
  /** Two-tap throwing (?aim=2): once the line is stopped, a marker slides out along it and back… */
  twoTap: {
    /** …at this speed (yards a second)… */
    markerSpeed: 14,
    /** …and the lob flies there at this speed (yards a second; slower than a bullet, so defenders close in)… */
    lobSpeed: 15,
    /** …and your player nearest where it comes down, within this (yards), catches it (they run to it as it flies). */
    catchRadius: 2,
  },
  sweep: {
    /** The aim line sweeps this far either side of straight upfield (degrees)… */
    halfAngle: 62,
    /** …at this speed (degrees a second)… */
    degreesPerSecond: 112.5,
    /** …this much faster each area after the first (a share of it)… */
    perArea: 0.3,
    /** …and again on the Boss drive. It stops getting faster after the last area (hard mode's endless zones). */
    boss: 0.1,
    /**
     * The pocket holds while the line crosses this many times; then it's a
     * sack. (4.5 at 112.5°/s is the same time as 3 at the old 75°/s: the
     * line got faster, the pocket didn't get shorter.)
     */
    scans: 4.5,
  },
  breakit: {
    /**
     * Every test opens with a countdown ("Get ready to mash…") this long in
     * sim time (2 seconds on screen, at the game's 0.8 time scale); taps
     * during it don't count.
     */
    ready: 1.6,
    /** …but only this long when it starts within `chainWindow` of the last one ending (no dead time in a pile-up). */
    chainReady: 0.5,
    chainWindow: 2,
    /** The marker crosses the meter once, in this long… */
    meterSeconds: 1.1,
    /** …and the sweet spot never starts before this share of its trip, so there's time to react. */
    earliest: 0.34,
    /**
     * How hard the tests are is fixed by area (Forest, Candy Kingdom, Farm),
     * not by anyone's stats: the bar's sweet spot (a share of the meter), the
     * mash's fill per tap, the juke's window (seconds).
     */
    byArea: [
      { sweet: 0.09, mashPerTap: 0.1, jukeWindow: 0.55 },
      { sweet: 0.075, mashPerTap: 0.088, jukeWindow: 0.48 },
      { sweet: 0.06, mashPerTap: 0.078, jukeWindow: 0.42 },
    ],
    /**
     * Past the last of those (hard mode's zones 4 on), each zone tightens it
     * this much more, but never past the floor, where a GREAT still breaks
     * free (docs/DIFFICULTY.md, d3).
     */
    perAreaPast: { sweet: -0.01, mashPerTap: -0.004, jukeWindow: -0.02 },
    /**
     * A fast player can still get a GREAT at the floor (with one tackler):
     * the bar's sweet spot 3.5% of it, a full mash at about 10 taps a second
     * on screen, a juke tapped within about 0.225 s on screen.
     */
    floor: { sweet: 0.035, mashPerTap: 0.068, jukeWindow: 0.36 },
    /** At most this many a down: the grab after that is a tackle. */
    perDown: 2,
    /** Every extra tackler on it makes it this many times harder. */
    perExtraTackler: 0.6,
    /** "Close": this far either side of the sweet spot, a drag. */
    near: 0.1,
    /** Mash: this long to tap. */
    mashSeconds: 1.2,
    /** …full breaks it at once; this full by the end drags. */
    mashDrag: 0.55,
    /** Juke: when the countdown ends the arrow shows, and a tap in this first share of the window breaks it (later, a drag). */
    jukeBreakShare: 0.5,
    /** Once the window is over the button turns red and stays this long (half a second on screen) before it's a tackle. */
    jukeLinger: 0.4,
    /**
     * A GREAT breaks the carrier free of the pile: any other defender this close
     * (yards, beyond touching) is knocked back too, down this long; and nobody can
     * grab it for this long after (seconds of live play), so it gets clear instead
     * of being grabbed again at once.
     */
    scatter: 1.2,
    scatterDown: 0.6,
    breakaway: 0.6,
    /** A drag gets this many yards, plus this many for every point of Heft over the tackler (within the range). */
    dragYards: 1.5,
    dragPerHeft: 0.5,
    minDrag: 0.5,
    maxDrag: 4,
  },
  /**
   * SNAG IT! (docs/SNAG.md): a contested ball, from drive `fromDrive`, is a
   * test of dots in a box, each tapped as its ring closes. Times are sim
   * seconds (the screen's times 0.8); positions are shares of the box.
   */
  snag: {
    fromDrive: 5,
    /** "SNAG IT!" is called this long before the first dot (half a second on screen). */
    call: 0.4,
    /** A ring closes onto its dot this long after the dot shows (0.8 s on screen)… */
    close: 0.64,
    /** …and the next dot shows this share of that later (0.5 s on screen). */
    gapShare: 0.625,
    /** Past this drive, the ring closes this much sooner each drive, down to the floor (0.5 s on screen). */
    fasterAfter: 10,
    perDrive: 0.032,
    closeFloor: 0.4,
    /** A tap this close to the ring closing, either side, is a hit (0.15 s on screen). */
    window: 0.12,
    /** The box stays this long after the grade, so the last dot's pop or crack is seen (0.3 s on screen). */
    linger: 0.24,
    /** 2 dots on drives 5-8, one more a zone (of `perZone` drives), never under 2 or over 5. */
    minDots: 2,
    maxDots: 5,
    perZone: 4,
    /** One fewer dot when the receiver's Hands beat the best defender's by this much; one more the other way. */
    handsGap: 20,
    /** Each dot's middle stays this far in from the box's edges… */
    margin: 0.14,
    /** …at least this far from the two dots before it, and at most this far from the last. */
    minApart: 0.33,
    maxApart: 0.5,
  },
  /** Hard mode (?hard=1): the endless run. */
  hard: {
    /**
     * Every zone after the first lines up this many more defenders than the
     * one before, never past this many on the field: harder, not busier
     * (docs/DIFFICULTY.md)…
     */
    extraDefendersPerZone: 1,
    maxDefenders: 12,
    /** …and every defender's stats grow this much a zone (defense.perArea in normal mode). */
    statsPerZone: 20,
    /** A recruit's stats add up to this in the first zone, and this much more every zone after. */
    recruitTotal: 200,
    recruitPerZone: 30,
  },
  trickOrTreat: {
    /**
     * After taking a recruit, set your lineup (tap any two players to swap
     * them, then Done). Off for now: the recruit goes where it helps most
     * (bestSpot), and play goes straight on. The code stays, behind this.
     */
    setLineup: false,
  },
  carrier: {
    /** The carrier aims this far ahead of itself, in its lane… */
    lookAhead: 3,
    /** …and picks the emptiest lane again this often (seconds)… */
    laneEvery: 0.25,
    /** …leaning toward its planned route on a handoff: this much less room per yard away from it. */
    pathPull: 0.35,
  },
  defense: {
    /** Added to every defender's stats each area after the first… */
    perArea: 10,
    /** …and again on the Boss drive (its bigger line-up is most of its step up). */
    boss: 0,
    /** How far behind its Catcher a Cover trails. */
    coverTrail: 0.8,
    /** How far ahead a chaser leads the carrier (seconds of its velocity). */
    chaseLead: 0.3,
    /** A Bat's loop: a square this wide. */
    batLoop: 3.5,
    /** A Bat leaves its loop to dive at a carrier this close (yards), and goes back to it if the carrier gets away. */
    batDive: 3,
    /** A Crow's lane: it flies this far up the field and back… */
    crowLane: 8,
    /** …and it leaves it to dive at a carrier this close (yards). */
    crowDive: 4,
    /**
     * The Safeties line up this far past the line of scrimmage (and never
     * short of just past the first-down line). Once someone has the ball, a
     * Safety meets the carrier head on, aiming this far upfield of it. Its
     * tackle is sure: no Break it!.
     */
    safetyDepth: 14,
    safetyFront: 1.2,
    /** The play fake: after a handoff the defense keeps playing the pass this long (seconds)… */
    playFake: 0.9,
    /** …except a defender this close to the carrier (yards), who sees it. */
    fakeSees: 2,
  },
  fieldProps: {
    /** How many to a 10-yard stretch (at random in this range)… */
    min: 2,
    max: 3,
    /** …kept this far out of the middle (the pumpkin's lane), this far in from the sidelines… */
    center: 2.2,
    edge: 1,
    /** …and at least this far apart (edge to edge), so there's always a way between. */
    gap: 2.2,
    /** A body looks this far ahead for a prop in its way, and passes it with this much room. */
    lookAhead: 2.5,
    margin: 0.25,
    /** A Boss stands this far past its drive's first-down line, in the middle of the end zone. */
    bossBeyond: 2.5,
  },
  pickups: {
    /** A pickup's size (yards): one of your players whose body touches it takes it. */
    radius: 0.75,
    /** Kept this far out of the middle (the pumpkin's lane), this far in from the sidelines… */
    center: 2.2,
    edge: 1,
    /** …and this far from any prop (edge to edge). */
    gap: 0.6,
    /** The lightning bolt: this much faster (a share of top speed), for this long (seconds). */
    bolt: { faster: 0.5, time: 3 },
    /** The oil slick: whoever slips lies on the turf this long (a carrier is tackled: SLIPPED!). */
    slick: { time: 1.2 },
  },
  crows: {
    /** The King's crows take off this long after the snap (seconds of live play)… */
    takeoff: 0.5,
    /** …fly at the ball this fast (yards a second: slower than a bullet, so a quick deep pass leaves them behind)… */
    speed: 12,
    /** …land on its holder from this close… */
    reach: 0.8,
    /** …and SHOO! has this long before they knock it down. */
    window: 0.6,
    /** He has two pairs: the second takes off this long after the first is shooed (or misses). */
    nextFlock: 0.8,
  },
  frogRain: {
    /** The lane runs in from one sideline (either, at random) this share of the way across: never over the pumpkin, so Flip matters. */
    width: 0.4,
    /** It runs from just behind the line of scrimmage to this far upfield. */
    behind: 1,
    ahead: 16,
    /** The frogs all come down at once, this long into the down (seconds of live play)… */
    dumpAt: 1.6,
    /** …their shadows filling the lane this long before… */
    warn: 0.7,
    /** …and everyone in the lane is flattened for this long (a carrier in it is tackled: FROGGED!). */
    flatTime: 1.2,
  },
} as const;

/** The fixed step, in seconds. */
export const DT = 1 / arcadeTuning.stepsPerSecond;
