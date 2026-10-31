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
- **Tricks and treats**, the first slice: a lightning bolt and an oil slick
  on every 10-yard stretch, taken by running through them. Round 7, decided
  2026-10-30 (k1–k9); the design is `docs/PICKUPS.md`. Only your team takes
  them for now (_user's note on k3 and k4: "Only offense for now"_). Built on
  the `pickups` branch.
- **Harder, not busier** (hard mode): one extra defender a zone, at most 12,
  with stats growing faster and Break it! tightening past zone 3. Round 9,
  decided 2026-10-30 (d1–d4, d7); the design is `docs/DIFFICULTY.md`. Built
  on the `harder-not-busier` branch. _User, 2026-10-30: "increasing
  difficulty right now really just adds more players and makes the screen
  really busy."_
- **SNAG IT!**, a Break it!-style test on contested catches: dots pop up
  one after another, and the Coach taps each as a ring closes on it. From
  drive 5, every contested ball goes to it. Grilled 2026-10-30 (c1–c6,
  s1–s8, u1–u2, all approved); the design is `docs/SNAG.md`. Built on the
  `snag-it` branch. It was parked here as "a Break it! test on catches" (a
  box of dots to tap in Y seconds), which the grilling turned into rings.
- **The tip drill, a second catch test.** The ball pops up off the
  defender's hands and the Coach taps as it drops onto a bar, three times,
  juggling it until it's held: one spot, pure timing. It was option C on
  the SNAG IT! map. _User, 2026-10-30: "I like the tip drill idea too, and
  we should park that as another catch challenge."_ Open for its grilling:
  whether a contested catch picks SNAG IT! or the tip drill at random (as
  Break it! picks its three), or each fits a kind of catch (a lob, a
  bullet); how many pops, and how fast; what it grades on.
- **The test bench** (dev): a page to play each quick tap test on its own,
  with sliders for its `tuning.ts` values and a log of every change and
  rep, so the settings that feel right can go into the game. Grilled
  2026-10-31 (b1–b3, k1–k5, l1–l3, t1, u1–u2, w1; all approved, k5 the
  other way); the design is `docs/BENCH.md`. Built on the `test-bench`
  branch. _User, 2026-10-31: "it should actually serve as a dev test page
  for all of the quick action games we have."_
- **Losses move you back past the drive's start** (difficulty), so a sack
  or a tackle for a loss on 1st down makes it 2nd & 12. Today losses do move
  the line back, but never behind where the drive started (`endDown` in
  `sim/run.ts`: "Never behind the drive's start (there's no room for the
  QB)"), so a loss on the drive's first snap leaves 2nd & 10. Open for its
  grilling: what that "no room" was (the camera, the field behind, the
  previous drive's props and pickups), and how far back a drive may go.
  _User, 2026-10-30._
- **A play clock** (difficulty). Today you can wait forever before
  calling a play and hiking. From some level on, a clock counts down the
  call and the hike, to force a faster choice. _User, 2026-10-30._ Open for
  its grilling: from which zone or drive, and how long (shrinking as it
  goes?); what running out costs (delay of game, 5 yards back, or a random
  card called and hiked for you); whether practice has one; how it's shown
  (a countdown in the HUD, the cards flashing).
- **More plays**, drawn in the editor. There are five today: Slants, Deep
  Shot, Curl & Flat, Dive and Sweep. _User, 2026-10-28._

## Later (not yet in order)

- **Tackles for a loss, explored.** They already happen: a tackled carrier
  is down where it falls (`tackle` in `sim/step.ts`), and behind the line the
  screen says "LOSS OF N". What's open is making them a moment of their own
  (more often, called out, the defense driving the carrier back). _User,
  2026-10-30: "I'm not sure if this is possible but may be interesting to
  explore."_
- **Forward progress: called down when driven back.** A carrier with the
  ball who keeps getting pushed backward for some time is ruled down there,
  rather than being shoved yards back. How long, and how far back counts, is
  open. _User, 2026-10-30._
- **A native Android build** of the game. _User, 2026-10-30._

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
- **A play dealt twice.** A sketch left in the game after its Copy code has
  gone into `ourPlays.ts`, or an unchanged copy of a built-in play, is dealt
  as often as two plays. Found in the round 6 review; not decided.
  _2026-10-30._
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
  - **Draw up a play** (a reward): instead of the three play cards dealt,
    the Coach sees what the defense is lining up in and draws the play to
    beat it. The play editor opens, and the play drawn is the one called
    for that down. _User, 2026-10-31: "you get to see what the defense is
    using and then can draw up the perfect play."_ Open for its grilling:
    how it's earned and how often (once a run, once a drive, a TRICK OR
    TREAT! pick); what the Coach sees of the defense (the line-up, their
    assignments, coverage); whether the editor opens in the game or as the
    dev page, and what it allows (every slot, or routes only); whether the
    play rules still apply; whether the play is kept afterwards (in the
    run's playbook, as a sketch) or gone after the down.
- **Defense against a computer offense.** The Coach plays defense while the
  computer runs the offense. The sim's AI only drives defenders and carriers
  today, so the offense needs play calling and throw timing of its own, and
  the Coach needs something to do on defense that is still one-tap timing
  (GAMEPLAY.md, Design Pillars 2). _User, 2026-10-28._
  - **Turnovers come with it:** interceptions (and fumbles) only once the
    Coach can answer on defense. _User's note on d5, 2026-10-30: "Nah let's
    skip this for now because turnovers are annoying in general when you
    can't respond on defense... we can add turnovers to the plan as part of
    adding defensive play."_ The round 9 proposal (a defender that out-Hands
    the receiver by 20 intercepts; what a pick costs) is on the map, d5–d6.
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
  - The first slice is planned (round 7, above). Still open: defenders
    taking them (the user: "only offense for now"); more kinds; moving
    pickups and whether a path is drawn before the snap; placing them in the
    editor; pickups in practice.
