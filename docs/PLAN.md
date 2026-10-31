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
  we should park that as another catch challenge."_ Being grilled on the
  map https://claude.ai/artifact/PHeREqJNv3izp9eLinmcz4, on the
  `tip-drill` branch. Round 1, decided 2026-10-31 (t1–t5, all approved):
  - **The drop** (t1): the ball pops straight up off the receiver's hands
    and falls back; tap anywhere in the box as it meets the hands, its
    shadow on them growing as it falls. _User: "Let's see how the initial
    concept plays and maybe we add drift later"_ (the drift is under Later).
  - Each contested ball picks SNAG IT! or the tip drill at random, half and
    half (t2), from drive 5, one setting saying when both start (t3).
  - Its grades do what SNAG IT!'s do (t4), and everything else works as
    SNAG IT! does: the shared countdown, the freeze, the box and its
    linger, outside Break it!'s two, a bench tab, the balance bot, the
    existing sounds (t5).
  - Rounds 2 and 3, decided the same day (g1–g6, u1–u3, w1): clean, bobble
    or drop, a drop ending it; one more pop than SNAG IT! has dots; the
    name stays tip drill (_user's note on g4: "Tip drill"_), tried with
    `?tip=1`. The design is `docs/TIP.md`. Built on the `tip-drill`
    branch.
- **The test bench** (dev): a page to play each quick tap test on its own,
  with sliders for its `tuning.ts` values and a Save that puts the
  settings that feel right into the game (a log of every change and rep
  at first, until the rework below). Grilled
  2026-10-31 (b1–b3, k1–k5, l1–l3, t1, u1–u2, w1; all approved, k5 the
  other way); the design is `docs/BENCH.md`. Built on the `test-bench`
  branch. _User, 2026-10-31: "it should actually serve as a dev test page
  for all of the quick action games we have."_ Reworked after the Coach
  played it, grilled the same day on a second map (s1–s8, u1–u4, l1–l3,
  p1–p4, n1–n2, w1–w2): a Save per tab into a saved-settings file over the
  `tuning.ts` defaults, sliders that move only by their knob, a log of reps
  and saves, and seven SNAG IT! sliders with the rest behind More.
- **Teach SNAG IT!'s closing ring.** On the bench the Coach read the ring
  as a countdown of the time left to tap, not as when to tap, and pressed
  too soon until working it out: every early miss came in the first few
  reps. Nothing in the game says what the ring is for. _User, 2026-10-31:
  "I initially thought the outer ring was a counter of how much time I had
  left to tap, not that it was indicating when to tap."_ Its own branch
  after `test-bench` (bench rework map p3, p4). Ideas to grill, none
  decided: a line under the first "SNAG IT!" of a run ("Tap as the ring
  hits the dot"); an outline on the dot that the ring closes onto; a flash
  on the dot at the moment to tap.
- **A dev setup mode** (dev): a screen before a run starts where the Coach
  turns each tap test on or off, picks the throw type, and sets the other
  run options, rather than typing them into the URL. _User, 2026-10-31: "a
  dev setup mode where we can enable/disable different tap events, toggle
  throw type etc before starting a run."_ Today those options are URL
  flags read once in `src/main.ts` (two-tap throwing and hard mode, on unless
  `?aim=1` or `?hard=0`,
  `?snag=1` SNAG IT! from the first drive, `?area=N`, `?seed=N`,
  `?monsters`, `?win`), and Break it! always deals one of its three
  (`bar`, `mash`, `juke`, `BREAK_KINDS` in `sim/breakit.ts`); nothing turns
  one off. It is the dev panel `docs/rules.md` asks for ("Build a dev panel
  from the start"), which `?snag=1` stood in for (`docs/SNAG.md`). Open for
  its grilling: where it lives (a screen in the game behind a dev flag, or
  a dev page that builds the link); which switches (each Break it! kind and
  SNAG IT! on, off or always; throw type; hard mode; the starting area; the
  seed; pickups and Frog Rain); whether the phone remembers the last setup;
  and whether practice gets it too. The tip drill's review found each link
  option touching about ten places (`main.ts`, `game.ts`'s option, field
  and two `createRun` calls, `run.ts`, `types.ts`): the setup mode is the
  time to gather them into one run-options object, so a new switch is one
  edit. Hard mode and two-tap throwing already travel as a pair (`Modes`
  from `readModes`, the game's options, `createRun`'s, `RunState`), and the
  game and `createRun` default both to off while a link defaults both to
  on: one type with one set of defaults (release mode's review, v6).
- **More events like Frog Rain, starting with an event editor** (dev, then
  difficulty). _User, 2026-10-31: "more events like frog rain. along with
  that should be an event editor, like the tap event editor, that lets us
  tune the options of an event. maybe make the editor first and we can
  tweak frog rain and then we develop the next event."_ In that order:
  1. **The event editor:** a page like the test bench where an event plays
     again and again, with sliders for its values and a Save into the saved
     settings (`saved-tuning.json`), which already takes any `tuning.ts`
     value. Frog Rain's are `frogRain` in `tuning.ts`: the lane's width,
     how far behind and ahead of the line it runs, when the frogs come down,
     how long their shadows warn, and how long a player stays flattened.
     Today Frog Rain falls only on Mister Frog's drive (the Forest's Boss,
     drive 4), so trying a change means playing three drives first.
  2. **Frog Rain tuned on it** by the Coach.
  3. **The next event,** designed and then tuned on the editor.

  Open for its grilling: whether the editor is its own page or a tab on
  the test bench; what plays in it (a practice down with the event forced,
  played by the Coach or by the bot; which play and which defense); whether
  SHOO CROWS! and the Royal Decree get tabs too; and, for the events after
  Frog Rain, whether each stays a Boss's one gimmick (`CONTEXT.md`) or
  events can come on any drive, and what the glossary calls them.
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
- **A playable release for esrauch** (branch `release-mode`): our fork on
  GitHub Pages, published the way his is, so he can try what we've made, and
  a release you can ask for by name. _User, 2026-10-31._ Planned by grilling
  on the map https://claude.ai/artifact/25UZwavNd7byH2udNgSQMH (research:
  https://claude.ai/artifact/8K9sR87AB8C4BK71xeHEVU), all three rounds
  decided 2026-10-31:
  - **Where:** GitHub Pages on our fork, `ohnoabigshark.github.io/vox/`
    (Source: GitHub Actions), with the link on the repo's page (p1). The
    built game goes public; f1 and h1 in the stack record are amended (p5).
  - **When:** only when asked, from GitHub's `main`: `deploy.yml` keeps the
    "Run workflow" trigger and loses `push` (p2, p3). Each deploy is tagged
    `release-N` (p4).
  - **What:** the full `npm run build`, dev pages included at `/vox/dev/`,
    open to anyone with the link, "fine for now" (b8, replacing b1 and b7).
    Gated by `npm run check` (b6). It plays `tuning.ts`'s defaults: the
    bench's saves are never committed, so no guard (b9).
  - **The game's defaults:** hard mode and two-tap throwing in every build;
    `?hard=0` and `?aim=1` switch them off, and anything else leaves the
    default (b2). Read in one tested function. The other link options keep
    working (b3); practice's ‹ Sketch is left alone (b4).
  - **Our plays:** the six in-game sketches (Crazy, Empty Set, Clear Out,
    Clear Out Pass, Juke, Flipper), pasted from Copy code, go into
    `ourPlays.ts` (s1–s3). Then the user switches their sketches out of the
    game, or the tailnet game deals each twice (s4). Accepted scope on this
    branch (s5).
  - **Release mode:** a `vox-release` skill in the config repo checks that
    GitHub's `main` matches local `main`, lists what's new since the last tag,
    runs the workflow, confirms the live site changed, tags the release and
    gives the link. It stops only if local `main` is ahead or nothing is new
    (r1, r2). Written after the first deploy by hand (o2).
  - **Later:** a drafted note for esrauch with each release (r3); taking the
    dev tools out of the release again (`build:release` stays for that).

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
- **The tip drill's drift:** each pop carries the ball left or right, its
  shadow marking where along the hands it comes down, and the Coach taps
  that spot as it lands. Option B on the tip drill's map (t1), parked until
  the drop has been played. _User, 2026-10-31._

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
  - **Select any play** (a reward, alongside Draw up a play): instead of
    the three play cards dealt, the Coach picks any play for that down.
    _User, 2026-10-31._ Open for its grilling, with Draw up a play: which
    plays it offers (the whole playbook, only those unlocked so far, the
    Coach's sketches too); whether the Coach sees the defense's line-up
    before picking, as with Draw up a play; how it's earned and how
    often, and whether the two are offered side by side as one reward
    pick.
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
