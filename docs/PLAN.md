# Plan: our fork of vox

This is our roadmap for the fork. esrauch's own roadmap is
[`MILESTONES.md`](../MILESTONES.md), and the game's design is in
[`GAMEPLAY.md`](../GAMEPLAY.md) and [`TECHNICAL.md`](../TECHNICAL.md). This
file is ours alone, so pulling upstream never conflicts with it.

Setup decisions (fork, hosting, conventions) are in the decision map
https://claude.ai/artifact/NPXDWvYYwQKcPhukLtXpnL. An overview of how the game
is built, checked against the code on 2026-10-28, is at
https://claude.ai/artifact/9B7U7HryCxoE7bnGYXJTi5.

## V1: Plays

- **A play editor.** Today a play is TypeScript in
  `src/arcade/content/plays.ts`: each of the seven roster slots either
  blocks or runs a route of waypoints, in yards from where that slot lines
  up (`LINEUP` in `content/team.ts`). Three tests in
  `tests/arcade/plays.test.ts` keep a play legal. An editor would let you draw
  routes on the field and check them against those rules as you go. The first
  feature, to be planned by grilling. _User, 2026-10-28._
- **More plays**, drawn in the editor. There are five today: Slants, Deep
  Shot, Curl & Flat, Dive and Sweep. _User, 2026-10-28._

## Later (not yet in order)

- **Plays as rewards.** TRICK OR TREAT! offers a new play, not only a new
  player. The run then has its own playbook, which grows. esrauch's
  `MILESTONES.md` B4 already lists "New plays for the random pool as
  unlocks". _User, 2026-10-28._
- **Defense against a computer offense.** The coach plays defense while the
  computer runs the offense. The sim's AI only drives defenders and carriers
  today, so the offense needs play calling and throw timing of its own, and
  the coach needs something to do on defense that is still one-tap timing
  (GAMEPLAY.md, Design Pillars 2). _User, 2026-10-28._
- **Objects on the field that a player consumes by running through them,**
  good or bad, so "power-up" is the wrong name (proposed: pickups, split into
  charms and curses; glossary item g5 on the map). A lightning bolt gives a
  speed boost; an oil slick trips the player. They feed play selection and the
  paths you want players to take: a route through a charm is worth more, one
  through a curse is a risk. They touch the editor (routes) and the carrier's
  choice of lane. Unlike upstream's props, which are solid and steered around
  (`sim/props.ts`), a pickup is run through. A tripped player can reuse the
  existing time lying on the turf (`types.ts`, as Frog Rain uses). _User,
  2026-10-28._
  - **Pickups can move** across the field the way players do, so taking one
    is a matter of timing as well as of route. _User, 2026-10-28._
  - Open, for when it's planned: can defenders take them too; which effects
    exist and how long they last; whether a moving pickup's path is drawn
    before the snap like routes; whether the editor places them.
