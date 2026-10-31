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
- **Area:** a themed place of four drives (Froggy's Forest, the Candy
  Queendom, Frederick's Farm). Upstream's code and hard mode also say
  **zone** for the same thing.
- **Drive:** four downs to gain 10 yards. **Down:** one play.
- **Line of scrimmage** and **first-down line:** where the down starts, and
  10 yards past where the drive started.
- **Boss:** the area's last drive, with its own gimmick (Frog Rain, the
  Royal Decree, the crows).
- **TRICK OR TREAT!:** the screen between drives where the Coach takes one of
  two new players (the **offer**) and arranges the roster. In code it's the
  **draft** (`phase: 'draft'`). Use "the draft" in docs and code, so it
  can't be confused with a trick or a treat on the field.

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

## The test bench _(ours)_

- **Test bench:** the dev page where each quick tap test (Break it!'s
  three, SNAG IT!, SHOO CROWS!) is played on its own, with sliders for its
  `tuning.ts` values (`docs/BENCH.md`). One go is a **rep**, as in
  practice. Its **situation** is the drive, tacklers, crowd and Hands gap a
  rep is played in.
- **Default:** a value as `tuning.ts` has it, always kept behind whatever
  is saved. The bench said "shipped" before its rework.
- **Saved settings:** the values the Coach saved on the test bench, off
  their defaults, in `saved-tuning.json`; the game plays the defaults with
  these on top. **Unsaved:** a slider moved since its tab last saved.

## The field

- **Prop:** a solid object on the field that bodies steer around, such as a
  Scarecrow (`sim/props.ts`).
- **Pickup** _(ours)_: an object one of your players **takes** by running
  through it, after which it's gone for good (`docs/PICKUPS.md`). A **treat**
  helps: the **lightning bolt** (a burst of speed). A **trick** hurts: the
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
