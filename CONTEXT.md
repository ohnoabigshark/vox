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
- **Line-up:** where each of the seven slots stands at the snap (`LINEUP`).
- **Playbook** _(ours)_: the plays your team can be dealt this run. **Play
  pool** _(ours)_: every play that exists, which rewards will draw from.
  Today they're the same five. _Avoid:_ "deck".
- **Play card:** one play dealt for a down. **Hand:** the three dealt.
- **Flip:** mirrors the called play. Mirror partners swap jobs.
- **Handoff:** a play that gives a Runner the ball at the snap.
- **Sweep** (the aim line): swings back and forth from Jack; THROW fires
  along it. Not to be confused with **Sweep**, the play.

## The field

- **Prop:** a solid object on the field that bodies steer around, such as a
  Scarecrow (`sim/props.ts`).
- **Pickup** _(ours, not built)_: an object a player takes by running through
  it. A **treat** helps (a lightning bolt's speed); a **trick** hurts (an oil
  slick's trip). A pickup that moves follows a **path**. _Avoid:_
  "power-up", which covers only treats, and "route" for a pickup's path.
- **Heft, Hustle, Hands:** the three stats, which are physics: weight, speed
  and reach.
- **Break it!:** the tap test when a defender grabs the carrier: a break, a
  drag or a tackle.
