# Plan: our fork of vox

This is our roadmap for the fork. esrauch's own roadmap is
[`MILESTONES.md`](../MILESTONES.md), and the game's design is in
[`GAMEPLAY.md`](../GAMEPLAY.md) and [`TECHNICAL.md`](../TECHNICAL.md). This
file is ours alone, so pulling upstream never conflicts with it.

Setup decisions (fork, hosting, conventions) are in the decision map
https://claude.ai/artifact/NPXDWvYYwQKcPhukLtXpnL.

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
- **Power-ups on the field** that your players pick up by running through
  them. A route that crosses one is worth more, so they feed play selection
  and the paths you want players to take, and they touch the editor (routes)
  and the carrier's choice of lane. Name and theme open. _User,
  2026-10-28._
