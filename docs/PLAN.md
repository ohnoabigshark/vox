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
  `tests/arcade/plays.test.ts` keep a play legal. The first feature, planned
  by grilling on the map. _User, 2026-10-28._ Round 1, decided 2026-10-29:
  - A dev page, `/dev/plays.html`, for authoring plays; not part of the game
    loop (e1).
  - Drafts stay in the phone's browser; Copy code hands a finished play to
    Claude, who adds it to `plays.ts` with its tests (e2). _User: "I don't
    love this solution but it's fine for now."_
  - Try it opens the game with the draft dealt every down. A run carries its
    own playbook in its state, which plays as rewards will reuse (e3).
  - The three play rules live in one function used by the tests and the
    editor; a broken rule blocks Copy code, not Try it (e4).
  - v1 edits the name, the routes of all but the Blockers, and the handoff
    Runner (e5).
  - Start blank or from a copy; esrauch's five are never changed in place
    (e6).
  - A flat top-down field, dragged with a thumb (e7).
  - Rounds 2 and 3 settled the screen and its tests (e8-e20); the design is
    `docs/PLAY_EDITOR.md`. **Built 2026-10-29** on the `play-editor` branch.
  - Round 4, decided 2026-10-29 (t1–t7, g7): a play being drawn is a
    **sketch**; Try it opens **practice**, one sketch on the field rep after
    rep from the same spot, against the Forest's first defense, with
    "‹ Sketch" between reps (_user's note on t4: "Only between reps"_). The
    in-game trial is removed. Built on the `sketch-practice` branch.
  - Round 5, decided 2026-10-30 (l1–l8): a play carries its own **line-up**;
    one without one uses the **standard line-up**. Runners and Catchers are
    moved by dragging them in the editor (_user's note on l1: "Only runners
    and catchers can move for now"_); a move changes only the route's first
    leg, its points staying put on the field (_note on l4: "Only it's first
    spot"_); a fourth play rule keeps players behind the line, inside the
    sidelines, no more than 6 yards back and a yard apart. Built on the
    `lineup` branch.
  - Round 6, decided 2026-10-30 (n1–n8): each sketch has an **In the game**
    switch; the full game on that phone deals switched-on sketches alongside
    the play pool, read when a run starts. Only a sketch with no problems can
    be switched on, and one broken later sits out. The game says nothing
    about a sketch that sits out or storage it can't read: the editor's list
    shows both (_user's note on n4: "Only in editor list"_, a deliberate
    exception to "never fail silently"). Copy code stays the way to keep a
    play for good. Built on the `sketches-in-game` branch.
- **More plays**, drawn in the editor. There are five today: Slants, Deep
  Shot, Curl & Flat, Dive and Sweep. _User, 2026-10-28._

## Later (not yet in order)

- **Route timing and speeds,** the rest of e5's advanced play editing. Where
  players line up was built in round 5. _User, 2026-10-29._
- **Moving the Blockers, and blocking by others:** a Catcher or Runner told to
  block on some plays. _User's note on l1, 2026-10-30: "In a later iteration,
  we can move blockers and assign catchers or runners to block on certain
  plays."_
- **A handoff to a Runner lined up far from Jack** (l6, Not now, 2026-10-30).
  The ball goes straight to the Runner at the snap, so from out wide it jumps
  across the field. Offered: a rule keeping the handoff Runner within 2 yards
  of Jack, or a real pitch, the ball tossed to the Runner.
- **Moving a player clears its route,** another way l4 could go, which the
  user raised: "We could also consider making moving a player just cancel
  their route entirely." _2026-10-30._
- **Choosing the defense in practice** (each area's drives, the decree, the
  crows). Offered as t3's alternative; practice always plays the Forest's
  first drive for now. _2026-10-29._
- **Sharing plays.** A Copy code play can be pasted to anyone, which the user
  called "a backdoor way to sharing plays". A real way to share, such as a
  link that opens the play, could grow from Try it's link (e2, e3). _User,
  2026-10-29._
- **Plays as rewards.** TRICK OR TREAT! offers a new play, not only a new
  player. The run then has its own playbook, which grows. esrauch's
  `MILESTONES.md` B4 already lists "New plays for the random pool as
  unlocks". _User, 2026-10-28._
- **Defense against a computer offense.** The Coach plays defense while the
  computer runs the offense. The sim's AI only drives defenders and carriers
  today, so the offense needs play calling and throw timing of its own, and
  the Coach needs something to do on defense that is still one-tap timing
  (GAMEPLAY.md, Design Pillars 2). _User, 2026-10-28._
- **Objects on the field that a player consumes by running through them,**
  good or bad, so "power-up" is the wrong name (pickups: treats help, tricks
  hurt; `CONTEXT.md`, decided as g5). A lightning bolt gives a
  speed boost; an oil slick trips the player. They feed play selection and the
  paths you want players to take: a route through a treat is worth more, one
  through a trick is a risk. They touch the editor (routes) and the carrier's
  choice of lane. Unlike upstream's props, which are solid and steered around
  (`sim/props.ts`), a pickup is run through. A tripped player can reuse the
  existing time lying on the turf (`types.ts`, as Frog Rain uses). _User,
  2026-10-28._
  - **Pickups can move** across the field the way players do, so taking one
    is a matter of timing as well as of route. _User, 2026-10-28._
  - Open, for when it's planned: can defenders take them too; which effects
    exist and how long they last; whether a moving pickup's path is drawn
    before the snap like routes; whether the editor places them.
