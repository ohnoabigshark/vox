# Glossary

The words we use for vox, in code, docs and talk. Most are esrauch's, as
[`GAMEPLAY.md`](GAMEPLAY.md) defines them (it has the full rules); the ones we
added are marked _ours_. Decided on the fork's decision map, items g1–g5,
2026-10-29.

## People

- **Coach** _(ours)_: the person at the controls. Calls the plays, taps THROW
  and Break it!, picks who joins the team. The game's own text still calls
  the Coach "you". _Avoid:_ "player" or "user" for this person.
- **Player:** one member of your team on the field, never the person playing.
  Each is a Blocker, a Runner or a Catcher, and is of a **kind** (Human,
  Ghost, Golem, Werewolf). _Avoid:_ "form" (the code's older word for kind).
- **Blocker** (2), **Runner** (2), **Catcher** (3): the seven players' roles
  (`ROSTER_ROLES`). Blockers always block; Runners run short routes or take a
  handoff; Catchers get open.
- **Jack:** the pumpkin ball, which is also the QB. There's no QB player.
- **Carrier:** whoever has the ball after a catch or a handoff.
- **Defender:** one of the forest's team. Until defense mode is planned
  (g4), "defender" always means an opponent, because the Coach is always on
  offense. _Avoid:_ "enemy".
- **Roster** and **bench:** the seven on the field and everyone else on the
  team.

## The run

- **Run:** one game, from PLAY to a loss or the win dance.
- **Set** _(ours)_: a whole run's skin: its areas, Bosses and gimmicks,
  team look, defender looks and on-screen names, over the same rules.
  Holiday sets are the main line (Halloween's is _Get Jack Back_;
  Thanksgiving's comes next); the rest are **alternative sets**. Each has a
  fixed number (`?set=2`) and its own folder; in code, `GameSet`
  (`Set` is JavaScript's). **Theme** is a looser word for a set's subject.
  The plain rules words here (the draft, pickup, treat, trick, perk) are
  the code's; a set names them on screen (TRICK OR TREAT! is Halloween's
  draft). Decided on the art pipeline map, s1–s6 and c1–c8, 2026-11-06.
- **Area:** a themed place of four stretches, crossed in at most four series
  (Froggy's Forest, the Candy Queendom, Frederick's Farm). Upstream's code and hard mode also say
  **zone** for the same thing. **Level** _(ours)_: an area, as the Coach
  says it ("we will eventually add more levels").
- **Drive** _(ours, football's)_: an area's march up the field, its series
  (four at most) ending in the end zone. Won with a touchdown, which clears the
  area; it fails if any of its series fails. _Avoid:_ "drive" for one
  series, esrauch's word until the rename of 2026-11-03 (the code, our
  docs and his `GAMEPLAY.md` say series now; `MILESTONES.md` and our dated
  decisions still say drive). The **drive block** (a Blocker driving a
  defender back, `contact.drive`) is a verb and keeps its name.
- **Series** _(ours, football's)_: four downs to gain 10 yards from
  wherever it starts, football's rule (`docs/LONG_FIELD.md`, a1): yards past
  the first-down line carry over, and within 10 of the goal line it's
  **& Goal**. Winning one is a **first down**; getting the ball over the
  goal line, from any down, is a **touchdown**, which clears the area. In
  code, `state.series`, `Series`, and the events `seriesStarted` and
  `seriesWon`. **Down:** one play.
- **Stretch** _(ours)_: one of an area's four 10-yard parts, named Intro,
  Challenge, Gimmick and Boss (A Quiet Clearing, Gnome Country…). A down
  faces the defense of the stretch its line of scrimmage is in, the Boss's
  gimmick included (`docs/LONG_FIELD.md`, r1). In code, `Series.stretch`.
- **Patrol** _(ours)_: a Scarecrow, Bat or Crow of a stretch ahead of the
  line, which stays in its stretch on every down (`docs/DIFFICULTY.md`, "The
  long field"). Which kinds patrol is `DefenderDef.patrols`. _Avoid:_
  "patrol" for a Bat's square or a Crow's lane, which is its **beat**
  (`Defender.beat`).
- **Stretch number** _(ours)_: a stretch's count in the run, from 1 (the
  Candy Queendom's first is 5), as `stretchNumber` gives it; SNAG IT! and
  the tip drill grow with it (`docs/SNAG.md`). It was the **series
  number** until the long field (r2, 2026-11-04), when every series was its
  stretch, and the level before 2026-11-03. Saved records and the test
  bench still call it `seriesNumber` and `series`.
- **Line of scrimmage** and **first-down line:** where the down starts, and
  10 yards past where the series started (the goal line on & Goal).
- **Boss:** the area's last stretch, with its own gimmick (Frog Rain, the
  Royal Decree, the crows). A gimmick can be a field event (Frog Rain) or
  not (the decree bans a card).
- **TRICK OR TREAT!:** the screen between series where the Coach takes one of
  three cards (the **offer**), or **Skip**s, then sees **Your team**. In code it's the
  **draft** (`phase: 'draft'`). Use "the draft" in docs and code, so it
  can't be confused with a trick or a treat on the field.
- **Offer card** _(ours)_: one TRICK OR TREAT! card: a new play, a new
  player, or a **perk** (`OfferCard`). The offer is the cards on show.
- **Skip** _(ours)_: taking no card at TRICK OR TREAT! (`skipDraft` on the
  offer); Your team comes up as after a pick.
- **Perk:** a card that changes how your team plays for the rest of the
  run: Second Wind, Candy Corn Magnet (`Perk`; esrauch's word). Not a new
  player, and not a pickup on the field.
- **Your team** _(ours)_: the draft once the pick is made: the roster, each
  player's growth since the last TRICK OR TREAT! on its bars, then PLAY ON.
  In hard mode it's where players are swapped (`docs/REWARDS.md`, v2).
- **Growth** _(ours)_: what a player's stats gain from what it does in play:
  Hands from catches, Hustle from yards and GREATs, Heft from blocks and
  pancakes (`sim/growth.ts`, `docs/REWARDS.md`). _Avoid:_ XP, levelling.

## Plays

- **Play:** what every player does on one down: each slot blocks or runs a
  route, and a handoff play names the Runner who takes the ball
  (`content/plays.ts`).
- **Route:** a player's path in a play, as waypoints in yards from where that
  player lines up. Only players run routes.
- **Line-up:** where each of the seven slots stands at the snap. Each play
  can set its own (`Play.lineup`, map item l7); the **standard line-up**
  (`LINEUP`) is the one a play uses when it doesn't. _Avoid:_ "lineup" for
  who plays which slot, upstream's word on TRICK OR TREAT! (`setsLineup`):
  that is arranging the roster.
- **Slot** _(names ours)_: one of the seven places in the line-up, named in
  roster order B1, B2, R1, R2, C1 (left outside), C2 (right outside), C3
  (inside, right of centre). Flip swaps mirror partners.
- **Playbook** _(ours)_: the plays your team can be dealt this run: the play
  pool plus your sketches that are in the game (map item n7). **Play pool**
  _(ours)_: every play in the code (esrauch's five and `ourPlays.ts`), which
  rewards will draw from. _Avoid:_ "deck".
- **Play card:** one play dealt for a down. **Hand:** the three dealt.
- **Flip:** mirrors the called play. Mirror partners swap jobs.
- **Handoff:** a play that gives a Runner the ball at the snap.
- **Sweep** (the aim line): swings back and forth from Jack; THROW fires
  along it. Not to be confused with **Sweep**, the play.

## The play editor _(ours)_

- **Sketch:** a play being drawn in the play editor, kept on the phone that
  drew it (map item g7). _Avoid:_ "draft", which is TRICK OR TREAT!.
- **In the game:** a sketch with its In the game switch on, which the full
  game on that phone deals alongside the play pool, if it has no problems
  (map items n1, n3). One with problems **sits out**.
- **Practice** and **rep:** what Try it opens: one sketch on the field,
  played over and over from the same spot (map item t6). Each go is a rep.
  In code, a run with `practice` set. _Avoid:_ "trial", the old in-game Try it.
- **Copy code:** the sketch written as an entry for `ourPlays.ts`.

## Field events _(ours)_

- **Field event:** something that happens on the field during a down: an
  **area** (a **lane**, **band** or **circle**, in yards from the line), when
  it **goes off** (a **burst**, hitting whoever is in it then, or a
  **spell**, holding whoever is in it while it lasts), a **warning** (shown
  before the snap, then its **build-up**), and an **effect** (flatten, slow,
  ethereal) on your players, the defenders or everyone
  (`docs/FIELD_EVENTS.md`). Frog Rain is the first. _Avoid:_ "event" alone,
  which is the sim's `ArcadeEvent`.
- **Blessing, hex, mischief:** a field event that can only help you, only
  hurt you, or do both. A **mischief** pickup is one either side can take
  (the lightning bolt).
- **Event editor:** the dev page where field events are made, tuned and
  tried (`/dev/events.html`).

## The test bench _(ours)_

- **Test bench:** the dev page where each quick tap test (Break it!'s
  three, SNAG IT!, the tip drill, SHOO CROWS!) is played on its own, with sliders for its
  `tuning.ts` values (`docs/BENCH.md`). One go is a **rep**, as in
  practice. Its **situation** is the series, tacklers, crowd and Hands gap a
  rep is played in.
- **Countdown:** the get-ready before a tap test that freezes the play
  (Break it!'s three, SNAG IT! and the tip drill; not SHOO CROWS!, a
  reaction to the crows landing): "GET READY TO MASH! 2… 1…". One setting,
  `countdown.ready`.
- **Default:** a value as `tuning.ts` has it, always kept behind whatever
  is saved. The bench said "shipped" before its rework.
- **Saved settings:** the values the Coach saved on the test bench, off
  their defaults, in `saved-tuning.json`; the game plays the defaults with
  these on top. **Unsaved:** a slider moved since its tab last saved.

## The field

- **Goal line** and **end zone:** the area's last line, 40 yards from its
  start, and the 10 yards past it where its Boss stands. A down that gets
  the ball over the goal line is a touchdown. Since the long field
  (`docs/LONG_FIELD.md`) the sim measures yards from the area's start, and
  the end zone shows on every down. In code, `AREA_YARDS` and `BOSS_SPOT`.
  The **long field** _(ours)_ is that change's name, not a thing on the
  field.
- **Prop:** a solid object on the field that bodies steer around, such as a
  Scarecrow (`sim/props.ts`).
- **Pickup** _(ours)_: an object a body **takes** by running through it,
  after which it's gone for good (`docs/PICKUPS.md`). A **treat** helps: the
  **lightning bolt** (a burst of speed), which is **mischief**, taken by
  either side once the ball is snapped. A **trick** hurts: the
  **oil slick** (the player slips and lies down; a carrier is tackled,
  SLIPPED!). A pickup that moves (not built) follows a **path**. _Avoid:_
  "power-up", which covers only treats, and "route" for a pickup's path.
- **Heft, Hustle, Hands:** the three stats, which are physics: weight, speed
  and reach.
- **Break it!:** the tap test when a defender grabs the carrier: a break, a
  drag or a tackle.
- **SNAG IT!** _(ours)_: the tap test on a **contested** ball, one a
  receiver and a defender could both get to: dots pop up one after
  another, each tapped as its ring closes. GREAT, OK or BAD: caught and
  free, caught and tackled, or batted (`docs/SNAG.md`). In code, the
  `snag` phase. It isn't a Break it! and doesn't count toward their two a
  down. _Avoid:_ "catch Break it!".
- **Tip drill** _(ours)_: the other tap test on a contested ball, picked at
  random with SNAG IT!: the ball pops up off the receiver's hands and each
  **pop** is tapped as it lands on them, **clean**, a **bobble** or a
  **drop** (`docs/TIP.md`). TIP DRILL! on screen; in code, `tip`. SNAG IT!
  and the tip drill are the **catch tests**.
- **Hands edge** _(ours)_: on a contested lob, how much nearer the spot a
  defender counts than your receiver for its Hands over theirs: a
  quarter-yard a 10 Hands, at most a yard either way (negative when yours
  are better). In yards and defender-first, where a catch test's **Hands
  gap** is raw Hands and receiver-first. In code, `handsEdge`.

## Results and stats _(ours)_

Decided on the stats map (`docs/STATS.md`), 2026-11-02 to 2026-11-03.

- **Record:** what the game keeps of a run: every play's and tap test's
  **result**, who did what, and the plays called. Kept on the phone. Not
  the **play log** (`docs/PLAY_LOG.md`), which is for finding bugs.
- **Rush:** a play where a Runner carries the ball from the handoff. The
  carrier's run after a catch belongs to the pass. _Avoid:_ "run" for a
  play, since a run is a whole game (the play cards keep "Run" and "Pass").
- **Target:** who a pass was meant for: the catcher, or for a pass batted,
  the player who had a hand to it and lost it. An incomplete never has
  one: a ball any of yours could reach is caught or contested, so an
  incomplete is a throwaway.
- **Air yards:** from the line of scrimmage to where a pass was caught,
  downfield only. **Yards after the catch:** from there to where the play
  ended. **Yards after contact:** from where the carrier was first grabbed
  to where the play ended.
- **Tackle for loss** (`tackleForLoss` in code): a rush or a catch brought down behind the line of
  scrimmage, however it happened. A **sack** (Jack brought down holding the
  ball) is never also a tackle for loss.
- **Tackle broken:** one BREAK in Break it!, however many tacklers it sent
  flying.
- **Achievement:** something earned once on a phone and kept, such as Air
  Mail; one earned in hard mode is marked **hard**.
