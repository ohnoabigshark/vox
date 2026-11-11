# Plan: our fork of vox

This is our roadmap for the fork. esrauch's own roadmap is
[`MILESTONES.md`](../MILESTONES.md), and the game's design is in
[`GAMEPLAY.md`](../GAMEPLAY.md) and [`TECHNICAL.md`](../TECHNICAL.md). This
file is ours alone.

Setup decisions (fork, hosting, conventions) are in the decision map
https://claude.ai/artifact/NPXDWvYYwQKcPhukLtXpnL. An overview of how the game
is built, checked against the code on 2026-10-28, is at
https://claude.ai/artifact/9B7U7HryCxoE7bnGYXJTi5.

## Direction

**A football arcade sim at its core, dressed in many themes.** The main
theme is holidays: levels and players, on offense and defense, each from a
holiday (Halloween's _Get Jack Back_ is the first). Beside it go lots of
**alternative sets**, themed on pop culture, for play outside the main
theme, to help get people into the game. _User, 2026-11-03: "it's a fun
football arcade sim at its core, but we come up with tons of pop culture
related themes and player sets for it to help get people into it. the main
theme is still going to be all holiday themed levels and players (on
offense and defense), but we will make lots of alternative sets too for non
main theme play."_

### Sets

Decided on the art pipeline map, rounds 2 and 3
(https://claude.ai/artifact/5CvJdCRtTedcMrwLYx5NUt, 2026-11-06, all
approved but s3):

- **A set is a whole run in a new skin** (s1): its own areas (four
  stretches each), Bosses and gimmicks, team look, defender looks and
  names on screen, with the rules unchanged. A kind keeps its rules
  whatever it looks like. The plain rules words (the draft, pickup, treat,
  trick, perk) stay in code and docs, and each set names them on screen:
  TRICK OR TREAT! is Halloween's name for the draft (s4).
- **Sets don't mix** for now (s2): a team from one set in another's areas,
  or areas from several sets in one run, is parked.
- **Thanksgiving is the first new set** (s3, rejected for Christmas: _"Thanksgiving
  is sooner let's do that plz"_), aiming to be playable on the tailnet
  build by Thanksgiving, 2026-11-26 (t1). Its design is planned on its own
  map. **Not now** (2026-11-10, the next-job map ("Pick the Next Job",
  https://claude.ai/artifact/MP8EsnMZnfgnyX9DaE7cA8), t1–t4): merging #48, the move (#45) and the
  set's build all wait, behind gravestones and the dev setup mode. The
  Nov 26 date is off: Thanksgiving waits with no date (round 2, n1).
- **Alternative sets nod to a genre** with original characters, not to one
  franchise's names or likenesses (s5).
- **_Get Jack Back_ is the Halloween set's name** (s6); the whole game's
  name waits until a second set exists.
- **Every set in its own compartment, so sets can be built in parallel.**
  _User, 2026-11-06: "I want to design our set and asset pipelines in such
  a way that we can create new sets in parallel easily. so their data
  structures, code, assets, etc are ideally compartmentalized."_
  - One folder per set, `src/sets/<set>/`, with its models in
    `assets-src/voxels/<set>/`; the engine reads the set being played
    from one typed `GameSet` value, and one file lists the sets (c1).
  - A test fails if the engine imports from a set's folder or one set
    imports from another (c2).
  - A set is data, except a gimmick that needs new behaviour, written in
    its own folder behind one gimmick interface; Halloween's three
    gimmicks move behind it as reusable building blocks (c3).
  - Halloween moves in first, in pieces each merged quickly, as a pure
    refactor proven by identical seeded runs and `balance:compare`
    reports; then Thanksgiving is built in its own folder (c4). This
    replaces round 1's p7.
  - A shared base palette (the team's gold and orange, ink, bone, the
    glow, the defenders' purple) stays with the engine; each set adds its
    own named colours, and a test keeps a set's models to its own (c5).
  - Each set keeps its own asset manifest; `check-assets` reads them all
    (c6).
  - A set has a fixed number, and a link picks it: `?set=1` Halloween,
    the default, and `?set=2` Thanksgiving (c7, the user's note: _"Can we
    just do enums so I can send a number as the value"_). A picker screen
    comes later, with mockups.
  - Each set's design is in `docs/sets/<set>.md` (c8).

Still open:

- **The holiday multiverse,** the user's name for a bigger concept, not
  yet described (2026-11-05). It may reopen s2.
- **A set picker** on the title screen, and how a run's record and
  achievements say which set it was in (runs so far count as
  Halloween's).
- **The game's name** above its sets (s6).

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
  2026-10-30 (k1–k9); the design is `docs/PICKUPS.md`. Only your team took
  them at first (_user's note on k3 and k4: "Only offense for now"_); since
  the mischief bolt (`difficulty-4`) a defender takes a bolt too. Built on
  the `pickups` branch.
- **Harder, not busier** (hard mode): one extra defender a zone, at most 12,
  with stats growing faster and Break it! tightening past zone 3. Round 9,
  decided 2026-10-30 (d1–d4, d7); the design is `docs/DIFFICULTY.md`. Built
  on the `harder-not-busier` branch. _User, 2026-10-30: "increasing
  difficulty right now really just adds more players and makes the screen
  really busy."_
- **SNAG IT!**, a Break it!-style test on contested catches: dots pop up
  one after another, and the Coach taps each as a ring closes on it. From
  series 5, every contested ball goes to it. Grilled 2026-10-30 (c1–c6,
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
    half (t2), from series 5, one setting saying when both start (t3). Since
    2026-11-04 only four in five go to either, today's rule settling the
    rest (`catchTests.chance`). _User: "can we make it so that the passing
    tap event games trigger about 20% less."_
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
- **Teach SNAG IT!'s closing ring.** **Dropped** (2026-11-10, next-job map
  v2). On the bench the Coach read the ring
  as a countdown of the time left to tap, not as when to tap, and pressed
  too soon until working it out: every early miss came in the first few
  reps. Nothing in the game says what the ring is for. _User, 2026-10-31:
  "I initially thought the outer ring was a counter of how much time I had
  left to tap, not that it was indicating when to tap."_ Its own branch
  after `test-bench` (bench rework map p3, p4). Ideas to grill, none
  decided: a line under the first "SNAG IT!" of a run ("Tap as the ring
  hits the dot"); an outline on the dot that the ring closes onto; a flash
  on the dot at the moment to tap.
- **A dev setup mode** (dev): **picked next** (2026-11-10, next-job map v3),
  the user's note: _"Let's do this so that it is under the /Dev route and
  saves the config to local storage. We should also have there be a default
  config file for all of the same toggles/values."_ Grilled on the same map;
  round 2, all approved 2026-11-10 (d1–d6):
  - **The defaults file** (d1): `src/arcade/content/runOptions.ts`, one
    `RunOptions` type with one set of defaults, which the game, a link and
    the page all read. Built first, as a refactor on its own branch
    (`run-options`) that changes nothing in play.
  - **A saved setup applies to every new run on that phone** (d2), stored
    per site, and the start screen shows a **DEV SETUP** tag with Reset
    whenever it differs from the defaults.
  - **Layers** (d3): each switch from the link if it names it, else the
    saved setup, else the defaults. Links keep working for the tools.
  - **The switches** (d4): throw type, hard mode, starting area, seed,
    SNAG IT! and the tip drill (Off / Normal / Always), every perk, a
    monster team; new: each Break it! kind on or off, pickups on or off,
    field events Off / Normal / one chosen event (on or off only since map
    round 5, p2). `win`, `video` and
    `farmSong` stay link-only.
  - **Practice ignores the setup** (d5). _User's note: "make sure to make
    it clear that the toggles only effect actual gameplay and not the
    practice modes"_: the page says so at the top.
  - **Ships with the dev pages** in releases (d6).
  - Order (o1): gravestones, then `run-options`, then `dev-setup`.
  - Round 3, approved 2026-11-10 (d7–d9): the tests and the whole design,
    in `docs/DEV_SETUP.md`.
  - **`run-options` built** 2026-11-10: one `RunOptions` type and its
    defaults (`content/runOptions.ts`), one link reader, nothing playing
    differently (`docs/DEV_SETUP.md`, "As built").
  - **`dev-setup` built** 2026-11-10: the page (`dev/setup.html`), the
    setup saved per site, the start screen's DEV SETUP tag with Reset, and
    the three new switches (Break it! kinds, pickups, field events) with
    SNAG IT! and the tip drill Off / Normal / Always
    (`docs/DEV_SETUP.md`, "As built").
  - Map round 5 (2026-11-10): Copy link names every switch (q1); field
    events are only on or off, the chosen event dropped (q2, p2); a run
    made with a setup says so in the play log and its record (q3); the
    page's on/off switches are the editors' toggles, the dropdowns kept
    (p2: _"Please use consistent UI components like we have from our other
    editors. Toggles where the checkboxes are."_).

  A screen before a run starts where the Coach
  turns each tap test on or off, picks the throw type, and sets the other
  run options, rather than typing them into the URL. _User, 2026-10-31: "a
  dev setup mode where we can enable/disable different tap events, toggle
  throw type etc before starting a run."_ Before it, those options were URL
  flags read once in `src/main.ts` (two-tap throwing and hard mode, on unless
  `?aim=1` or `?hard=0`,
  `?snag=1` SNAG IT! from the first series, `?area=N`, `?seed=N`,
  `?monsters`, `?win`), and Break it! always dealt one of its three
  (`bar`, `mash`, `juke`, `BREAK_KINDS`, now in `content/runOptions.ts`);
  nothing turned one off. It is the dev panel `docs/rules.md` asks for ("Build a dev panel
  from the start"), which `?snag=1` stood in for (`docs/SNAG.md`). Open for
  its grilling: where it lives (a screen in the game behind a dev flag, or
  a dev page that builds the link); which switches (each Break it! kind and
  SNAG IT! on, off or always; throw type; hard mode; the starting area; the
  seed; pickups and Frog Rain); whether the phone remembers the last setup;
  and whether practice gets it too. The tip drill's review found each link
  option touching about ten places (`main.ts`, `game.ts`'s option, field
  and two `createRun` calls, `run.ts`, `types.ts`): the setup mode is the
  time to gather them into one run-options object, so a new switch is one
  edit. With it, the run's `practice` flag and `practiceEvent` (field
  events, review r14) become one practice union, as the game already has.
  Hard mode and two-tap throwing travelled as a pair (`Modes` from
  `readModes`), the game and `createRun` defaulting both to off while a link
  defaulted both to on (release mode's review, v6); since `run-options`
  (2026-11-10) there is one `RunOptions` type with one set of defaults, and
  since `dev-setup` a new switch touches the type, the defaults, its entry
  in `SWITCHES` (its link flag and checks), `runSwitches`, `RunState` and
  `createRun`, the sim where it acts, and a control on the setup page.
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

  Being grilled on the map https://claude.ai/artifact/9gtEaZxi3ypfNU4bfLRevA
  (branch `field-events`). Round 1, decided 2026-10-31 (f1–f8):
  - **Field events** (f1): an area on the field, when it goes off, a
    warning, and an effect on whoever is in it; Frog Rain is the first.
    _User: "Positive ones can be blessings and negative ones can be
    hexes."_ ("Event" alone is the sim's `ArcadeEvent`.)
  - **The event editor** (f2): its own dev page, `/dev/events.html`, built
    like the play editor, the area dragged and sized on a flat field.
  - **Try it** (f3): practice with the event every rep, the usual three
    cards, against the defense of a chosen drive.
  - **In a run** (f4): Frog Rain stays Mister Frog's; new events on
    ordinary drives, at most one a drive, every down of it. _User: "We will
    have generic ones and boss specific ones eventually."_
  - **Each event its own look** (f5, rejected the shared good/bad
    colours): _"Events keep their own themed colors/initial graphics and
    you have to learn whether they are good and bad."_
  - **Will-o'-wisps** (f6, changed): _"should make an offensive player
    untackleable when in the area. Like a wisp is ethereal so it can make
    the player semi transparent when in it and defenders run through
    them."_ **Taffy flood** (f7): a band across where everyone moves at
    half speed. Grasping hands: rejected (f8).

  Round 2, decided the same day (k1, p1–p5, n1–n2, w1, t1, o1–o2; all
  approved):
  - **Saving** (k1): events in code (`content/fieldEvents.ts`) are the
    defaults; the editor's Save writes changes and new events to
    `saved-events.json` over them, as the bench's Save does; Restore
    defaults.
  - **The parts:** a lane, a band or a circle, in yards from the line, on
    the left, middle, right or either side each down (p1); going off a set
    time after the snap, as a burst (who's in it then) or a spell (who's in
    it while it lasts) (p2); shown before the snap, then the event's own
    build-up art (p3; _user: "Some events can be a surprise but we won't
    implement that yet, let's just plan for that to be possible."_); flatten,
    slow or ethereal, on your players, the defenders or everyone (p4).
  - **Blessing, hex or mischief** (p5): only helps you, only hurts you, or
    both. _User: "Mischief is a great third word love it."_
  - **In a run** (n1, n2): from drive 2, about one ordinary drive in three
    gets a generic event, from the seed; wisps and taffy are generic, Frog
    Rain Mister Frog's.
  - **Wisps** (w1): a circle about 4 yards across, 12 ahead on either side,
    from 1 s after the snap for 3 s; your players in it are ethereal.
    **Taffy** (t1): a band across, 6 to 9 yards ahead, from 1 s for 2 s;
    everyone in it at half speed.
  - **Order** (o1, o2): three branches, each reviewed and merged before the
    next: field events and the editor (Frog Rain as data, no change in
    play), the taffy flood, the wisps. Gravestones are not part of it
    (_user: "I just want that in the plan (including my choices for it). I
    don't want to do that work as part of the event blessing curse mischief
    work"_).

  Round 3, decided the same day (u1–u4, x1–x3; all approved): the whole
  design confirmed, with the editor offering only what the game can play
  (x1), Try it carrying the unsaved event (x2), and Frog Rain's rules (who's
  spared, the call, the carrier steering clear) made every event's (x3). The
  design is `docs/FIELD_EVENTS.md`. The first of the three branches, field
  events and the editor, built on `field-events`; then the Coach tunes Frog
  Rain with Save, and the taffy flood is next.
- **Losses move you back past the series' start** (difficulty), so a sack
  or a tackle for a loss on 1st down makes it 2nd & 12. _User, 2026-10-30._
  Now part of the long field (below, a3): back to 10 yards behind the
  area's start, built in its part 1.
- **A play clock** (difficulty). Today you can wait forever before
  calling a play and hiking. From some level on, a clock counts down the
  call and the hike, to force a faster choice. _User, 2026-10-30._ Open for
  its grilling: from which zone or series, and how long (shrinking as it
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
  decided 2026-10-31. **Shipped** that day as `release-1` (PR #13, the
  first `Deploy` run), live at https://ohnoabigshark.github.io/vox/:
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

- **Results, stats and achievements.** Record a result after every play
  and every tap test, so the game can keep stats and award achievements.
  _User, 2026-10-31: "result recording. we need to do this after each play,
  each quick time event. the reason being I want to add achievements and
  stats."_ **Planned** by grilling, seven rounds, 2026-11-02 to 2026-11-03,
  on the map https://claude.ai/artifact/1jesxDVCarUMEPTMDcwqfR; the design
  is [`docs/STATS.md`](STATS.md). **Built** 2026-11-03 in four branches,
  each reviewed and merged before the next (PRs #20, #22, #23, #24):
  - **`series-rename`:** football's words for the game as it is (w1, w3):
    an area's march is a **drive** of four **series**, won series are
    **first downs** and the Boss's a **touchdown**. esrauch's `drive`
    becomes `series` in the code and the docs (r1, r2). `main` is tagged
    `pre-series-rename` first, and the user plays some rounds as a smoke
    test before it merges (r3).
  - **`record`:** a pure recorder fed from the sim's events, the run's
    record saved on the phone as the run goes, the run's stats, all-time
    totals and records. Its test scenarios are approved (f2).
  - **`stats-screens`:** the Game Over card, a run's stats, the win card
    before the song, STATS on the start screen, the stats section (v1–v5).
  - **`achievements`:** fourteen approved, defined in one file as checks
    over the record, popped after the down that earns them (h1–h3).

- **Hands on a lob.** On a contested two-tap lob the nearer one wins and
  Hands never counts (`lobLanding`, esrauch's 2026-10-27 rule), so in the
  default game a receiver's Hands barely matter. _User, 2026-11-04: "yeah I
  want to make hands matter."_ Planned by grilling, one round, 2026-11-04,
  on the map https://claude.ai/artifact/GoDRbJaFXbBA1p3QwESN6D, all approved:
  - **The rule** (h1): the nearer one still wins, but each 10 Hands counts
    as a quarter-yard nearer, reach's own rate (`body.reach.perHands`).
  - **Hands only** (h2), not a kind's `reachBonus` (the Scarecrow's 1.2
    yards would count twice). **Ties go to you** (h3). **The catch tests**
    order the defenders reaching for a lob the same way (h4).
  - **Unchanged** (s1–s3): straight throws; the screen (the player lit while
    aiming already comes from the same rule, so it follows); the 2-yard
    catch circle for everyone.
  - **Built** on one branch, `lob-hands`, tests first (b1), reviewed, and
    played in two-tap before it merges (b2). Built 2026-11-04: `handsEdge`
    and `countedDistance` in `sim/ball.ts`, with `handsReach` in `sim/bodies.ts`
    the one rate. The review found a catch test's BAD batted by the first
    defender on the field rather than the rule's first; fixed, bullets too.
  - **Round 2**, decided the same day from the review: the Hands edge counts
    at most a yard either way (n2, `twoTap.handsEdgeCap`), since hard mode's
    defenders gain 20 Hands a zone; your player who goes for the lob is still
    simply your nearest (n1 rejected), not the one Hands would favour.

- **The long field.** The play goes on past the first-down line, losses
  count on any down, and any down can score by reaching the end of the
  area. First downs follow football's rule, 10 yards from wherever a series
  starts, and each down faces the defense of the stretch its line of
  scrimmage is in. _User, 2026-11-04._ Planned by grilling, two rounds so
  far, 2026-11-04, on the map https://claude.ai/artifact/5qLrncweSw1w5DgFZgo7JU;
  the design and the order of work are in `docs/LONG_FIELD.md`. It is built
  in two parts, each played before it merges: the area's field and losses
  (`long-field-1`, built 2026-11-04), then football's downs and the long
  play (`long-field-2`, its tests on the map's round 3).

- **Rewards: growth from play and a new offer.** Your players get better
  by playing (Hands from catches, Hustle from yards and GREATs, Heft from
  blocks and pancakes, up to 150), shown on a Your team screen after each
  TRICK OR TREAT!; then TRICK OR TREAT! offers three random cards, a new
  play, a rarer new player or a perk (Second Wind, Candy Corn Magnet), with
  a Skip, and a run starts with esrauch's five plays. _User, 2026-11-05._
  Planned by grilling, three rounds and a confirmation, 2026-11-05, on the
  map https://claude.ai/artifact/AUGh5MeCe8ZZJfxSBQdYVT; the design, the
  tests and the order of work are in `docs/REWARDS.md`. Built in two parts,
  each played before it merges: growth from play (`rewards-growth`, merged
  as PR #38), then the offer (`rewards-offer`, built and playtested
  2026-11-05, notes p2-p6; reviewed on
  https://claude.ai/artifact/6Qk66hbs7FoMpEprdTd3cW).

- **Selecting a player, and a names switch.** Before the snap, tap one of
  your seven: their route lights up, the rest dim, and their card shows at
  the top; an **Aa** switch shows or hides the names on the field. _User,
  2026-11-05: "pressing on a player selects them and highlights just their
  route and shows a lil card about that player"._ Planned on the map
  https://claude.ai/artifact/8PEvNHSLuK3X92urZb2usp; the design and tests
  are in `docs/SELECT.md`; built on `player-select`, after B7's fix
  (`names-fix`).
  - **Parked: select only, no Aa switch.** _User, 2026-11-05, after playing
    it: "I think eventually I want select only but it's hard to know you
    can tap on players to select them. we can park that."_ Both stay for
    now. What it needs first: a way to show that your players can be tapped
    (a hint on the first down, a pulse on them, or the tutorial below).

- **Two new tap tests: a spin-o-rama and a DDR-style one.** _User,
  2026-11-05: "spinorama quick event. ddr like quick event. both for notes
  in future planning."_ For a grilling of their own. What's there to build
  on: the tap tests today are Break it! (a break, a drag or a tackle, with
  MASH! and JUKE!), SNAG IT! and the tip drill, each with a countdown and
  GREAT/OK/BAD, and each on the test bench.
  - **Spin-o-rama:** the carrier spins out of a tackle, a move beside
    Break it!'s JUKE!. Open: what you tap or swipe, and when it's offered.
  - **DDR-style:** arrows to hit in time, like Dance Dance Revolution. The
    game already keeps time to its music (`src/beat`, with tap-latency
    calibration in the settings), so the arrows could land on the song's
    beat. Open: what it decides (a catch, a block, a break) and how many
    arrows.

- **A short tutorial** that teaches a new player how to play, above all the
  passing mechanic. _User, 2026-11-01: "we need a short tutorial to help
  teach people how to play, esp with the passing mechanic."_ Open for its
  grilling: what it covers beyond the throw (calling a play, Break it!,
  SNAG IT! and the tip drill, pickups and field events); its shape (a
  scripted first series, prompts over real play, or a page of its own);
  hard mode's two-tap throw against the original one-tap, since the game
  now defaults to two-tap; when it shows (first launch only, and how to
  open it again or skip it); with mockups.

## Later (not yet in order)

- **No penalties, ever.** _User, 2026-11-05 (rewards review, l2): "I don't
  think I ever want there to be penalties in this game. Let the players
  play."_ No holding, no flags: an idea that needs one is out.
- **Parked from the rewards map** (`docs/REWARDS.md`, 2026-11-05):
  - **A candy shop:** candy earned by the yard and spent at TRICK OR
    TREAT! (w1). _User: "Ohhhhhh I love the shop idea...but we will park
    that."_ Rarity raised by a long play is parked with it: on top of
    growth from play it "may result in too much compounding".
  - **A card that takes a play out of your playbook** (o2): _"kind of
    interesting for the future so park it."_
  - **The playbook on the Your team screen** (v2): _"Don't show the
    playbook for now."_
  - **Boost cards** for one player's stats (k2, rejected for growth from
    play), if growth alone can't carry the squad.
  - **Fewer defenders** if play can't carry the stats, after the first
    playtests (g3).
  - **A BAD wipes out the gains:** a BAD on a tap test could undo that
    player's growth (t1): _"We can explore that. Later."_
  - **A tap event for Jack against a sack:** instead of an instant sack, a
    quick tap test buys him another second to throw (z2). Belongs with
    **Stats for Jack**, below, which stays parked too (k3: "keep this a bit
    smaller").
  - **The offer cards' text a bit bigger, and their headings centred**
    (user, 2026-11-05, after part 2's playtest: "notes for later (not
    implementing now)"). **Done 2026-11-06** (`fixes-offer-hands`, map
    https://claude.ai/artifact/HcAVyNiXGEU8NCVJmYGTkJ, o1 and o2): the
    offer cards' text about a third bigger, and each card's heading row
    centred under its title; Your team's rows are unchanged. As built,
    beyond the map's list: a perk's icon box 52 → 64 px with the photo,
    and a little more spacing (between a card's parts, between a stat's
    columns, and between a perk's lines); the stat bars come out a
    little shorter, as the map said.
  - **Hands grows more slowly for Catchers** (balance). _User, 2026-11-05,
    after playing `player-select`: "I think hands should scale more slowly
    for catchers"._ **Done 2026-11-06** (`fixes-offer-hands`, map
    https://claude.ai/artifact/HcAVyNiXGEU8NCVJmYGTkJ, h1): a catch is now
    +8 Hands and a catch-test GREAT +7 more, half what they were, for
    everyone who catches. Before, the player who grew the most Hands in
    an area grew a median +30 to +45 there (the bot, nine scenarios of 30
    runs) and reached 150 by area 3 or 4 (the user's runs); after, +16 to
    +24. The bot won a little less: on average 8.9 → 8.6 series of 12,
    and beat the game in 83% → 76% of runs, lower in 8 of 9 scenarios
    (30 runs each, so noisy). Watch for it in play.
  - **Draw up a play and Select any play** are rewards in this system,
    grilled and built after both parts (k5; **Plays as rewards**, below).

- **The Boss as the extra point:** the Boss's series becomes a set of downs
  of its own, played after the area's touchdown, a Boss battle as the
  "extra point". _User's note on the long field's b4, 2026-11-04: "I do
  like the idea of the boss of each area being a separate series/set of
  downs... Let's save that concept to explore later, I want to see how the
  game plays with the recommendation for this first."_
  With it (difficulty map d2, 2026-11-04): the Boss, who stands in his end
  zone (`BOSS_SPOT`), steps out to stop a carrier near the goal line, a
  last line of defense with his own Break it!.
- **Defenses tuned for the long field:** if breakaways get past the defense
  too easily once the play goes on past the line, adjust the defense (the
  Safeties, a second line of defenders, pursuit). _User's note on c1,
  2026-11-04._ The long field's balance runs (e1) give the numbers.
  **Under way:** planned on the difficulty map
  (https://claude.ai/artifact/QA9UrG4Tammp58npg1uP7v), in
  `docs/DIFFICULTY.md` ("The long field"). First the balance tool counts
  long plays (`difficulty-1`), then the stretches ahead keep their patrols
  (`difficulty-2`; both merged as PR #31). Then two Owls in every Forest
  stretch and the picks counted (`difficulty-3`), then the mischief bolt
  (`difficulty-4`), then the public release (map v1).
- **The goal-line Owl** (difficulty map r3, parked by t4, 2026-11-04):
  from the Intro or the Challenge, the Boss stretch's Safeties wait 3 yards
  short of the goal line, with sure tackles. For if breakaways come back:
  after the two Forest Owls a long play still scores about half the time,
  and the user dropped the 10–20% target. _User: "Long plays (20yds+)
  scoring 52% of the time isn't actually so bad considering the field
  length."_
- **The mischief bolt** (difficulty map round 4, b1–b6, approved
  2026-11-04, for `difficulty-4`; the plan is in `docs/DIFFICULTY.md`):
  the lightning bolt becomes mischief, taken by whoever runs through it
  first once the ball is snapped, yours or a defender. _User, 2026-11-04:
  "we turn the lightning bolt power ups to be 'mischief' class where either
  side can take them, but only once the snap starts."_ Built on
  `difficulty-4` (`docs/PICKUPS.md`, "The mischief bolt").
- **Replay a down, and keep it.** _User, 2026-11-05: "replay of a down.
  I'd love to be able to see a replay and save it for later."_ What exists:
  the sim is deterministic from the run's seed (`src/sim/rng.ts`: never
  `Math.random`), so a down can be played again from its starting state and
  the inputs of each step (taps, THROW, tap-test taps). That makes a saved
  replay small. Open for its grilling: replay from inputs (small, but an
  older replay plays differently once the sim changes, so each keeps the
  build it came from) or from recorded positions (bigger, always the
  same); when to offer it (right after the down, from the record's list of
  plays, after a big play); what you can do while it plays (slow motion,
  another camera, scrub back); where saved replays live (the phone, like
  the record, `docs/STATS.md`) and how many; sharing one.
- **Faster balance runs** (after the release; the plan, with diagrams:
  https://claude.ai/artifact/ASsZs8QaF34RpLhkscL2hA). A before-and-after
  comparison takes about 45 minutes. A profile of three runs (2026-11-05):
  80% of the time is the passing bot's lookahead (`predictsCatch`), and 66%
  is copying the state, since `step()` copies the whole run every step.
  _User: "yeah after the release. 2 especially."_
  1. **Keep main's results** (first): the six-scenario script moves into
     `tools/`, and each baseline is kept under a key of main's commit, the
     tool's code and the run count, so only the branch side runs.
     _Built 2026-11-05 on `balance-speed`: `npm run balance:compare`
     (`tools/balance-compare.ts`), its reports in `.balance/`. Main runs
     with the branch's balance tool, so a change to what the report counts
     runs main again once._
  2. **Step in place in the balance tool:** `step()` becomes a copy plus a
     new `stepInPlace()`; the tool and its lookahead call `stepInPlace`
     (the lookahead copies once, not up to 121 times), noting the few
     "before" facts its counters read. The game keeps `step()`. Tests
     first: the same seeded run, state and events, either way; `step()`
     leaves its input alone; the lookahead leaves the real run alone; the
     same report. About 3× faster, by the profile; measured before and after.
     _Built 2026-11-05 on `balance-speed`. Measured on the same three runs
     (normal mode, passing bot): 72.4 s before, 23.7 s after, 3.1×; all six
     scenarios, 3 runs each: 1 min 50 s before, 42 s after, with every
     report the same line for line. The lookahead is
     `tools/balanceLookahead.ts`._
- **Play-call levers: no flip, a random play, hidden routes.** Three
  ways to make a down harder before the snap, each likely set by a
  stretch or a Boss rather than for the whole run, and each also a toggle
  the player can set to play their own way. _User, 2026-11-04: "take away
  the ability to flip the play, could be on a specific level/boss. also,
  choose a play at random for you. also, don't show the routes your
  players will take. these are 3 different levers that we can add to
  pull, likely tied to levels/bosses and not just general run settings
  (although we can expose them as toggles so a player can customize how
  they want to play)."_
  - **No flip:** the Flip button does nothing today outside `setup`
    (`case 'flip'` in `sim/run.ts`); this would turn it off for a
    stretch.
  - **A random play:** the same idea as **A forced play** below (two
    cards banned, one left), there planned as an event. Grill the two
    together.
  - **Hidden routes:** the called play's routes are drawn on the turf
    until the hike (`render/routes.ts`); this would hide them, and maybe
    the handoff's ring too.
  - Open for its grilling: which stretches or Bosses pull which lever,
    and where the toggles live (the title screen beside hard mode and
    two-tap, or a settings page), and whether a toggle run still counts
    toward the same records.
- **A player's menu.** Selecting a player (V1, above) opens a menu of
  things to do with them on this play. _User, 2026-11-10: "now that we can
  select players, we could add some functionality where there can be per
  play perks that could be activated on some menu that displays when they
  are selected. the start of this idea can just be the shell of the menu
  itself and what it would look like and we could eventually add actions of
  some sort to it. one play activated perks are one idea, route changes are
  another, audibles are another (maybe these even are specific to the
  selected play or player combination like a flea flicker)."_
  - **Parked** (next-job map m1, 2026-11-10); grilled after the dev setup
    mode, on its own map (2026-11-11).
  - **First slice:** the menu's shell only, how it looks and opens from a
    selected player's card, with no actions yet. Mockups first. **Built**
    2026-11-11 on `player-menu`: the strip above the play cards with Route,
    Perk and Audible greyed, behind the dev setup's Player menu switch
    (`docs/PLAYER_MENU.md`, As built). Next: `menu-routes`, hot routes.
  - **Actions for later:** perks used for one play; route changes (beside
    the play editor's "route timing and speeds" and "moving the Blockers",
    below); audibles, maybe tied to the play and the player together, such
    as a flea flicker.
  - Open for its grilling: where it sits against the card at the top of
    the screen; whether it shows when it has nothing in it; how an action
    is used up (once a play, once a series, once a run); how it meets
    "select only" (parked, V1) and the tutorial.
  - **Grilled on its own map**, https://claude.ai/artifact/6qjgoC72xLeSWPXw2VCDpJ.
    Round 1, all approved 2026-11-11: the menu is a strip above the play
    cards (a1, the user: "Yeah I like c"); three slots, Route, Perk and
    Audible, each greyed until it works (a2); it shows only with a dev
    setup switch, "Player menu", off by default, until an action works
    (a3); the shell first, then a route change, each its own branch (a4);
    a changed route lasts this down only and the card stays as drawn (a5);
    the new route is picked from a short list of set routes, not dragged
    (a6).
    Round 2, 2026-11-11: Route works for Catchers and a Runner on a
    passing play, greyed for Blockers and a handoff's Runner (b1); six set
    routes, Go 16 yards, Slant 2 up then in to 12, Out 5 up, out 5 and up
    to 14, Post 8 up then in to 16, Corner 8 up then out to 16, Curl 10 up
    and back (b2); "out" is toward the player's own sideline (b3); Flip
    keeps a changed route, mirrored, and calling a card drops every change
    (b4); free, as often as you like until HIKE! (b5); the word is **hot
    route**, a game action in the record and the play log (b7). b6's route
    list was rejected: _"Tapping route just goes through a linked list of
    the route changes. We don't need a card we can just show the route on
    the screen."_ Round 3, 2026-11-11: each tap of Route moves to the next
    route in a loop (c1, confirmed with c4), the tests (c2, c3) and the
    whole design (c4) approved; written up as `docs/PLAYER_MENU.md`.
  - **Changing a route after the call** (the user, 2026-11-11: "one thing
    to consider with the player menu is the ability to change their route.
    I don't know if we have the ability to edit the play after it's chosen
    or adjust a specific route but we will need it once we start adding
    capabilities to the player menu"). What exists: between the call and
    the hike you can call another card or Flip, and each one lines your
    players up again from the card (`call` and `flip` in `sim/run.ts`).
    Nothing changes one player's route. Calling a card already copies each
    route onto its player for that down (`job: { kind: 'route', to }`,
    `sim/bodies.ts`), so a new action could change one player's copy for
    this down and leave the playbook alone. Routes are drawn and dragged
    only in the play editor (`dev/playEditor/editor.ts`), and checked by
    `playProblems` (`content/playRules.ts`). Open for the grilling: whether
    a change lasts one down or changes the card; picking from set routes
    (a go, a slant, a curl) or dragging waypoints as the editor does;
    whether Flip or calling another card undoes it; whether the Runner's
    handoff route can change; and whether it's free or a menu action
    that's used up.
- **More passes blocked or dropped.** **Dropped** (2026-11-10, next-job map
  l3). _User, 2026-11-04, while playing
  difficulty-3: "we will need to consider more outright blocks/drops on
  passes."_ What exists: a ball that only a defender reaches is batted;
  one both reach is caught or batted by Hands (`sim/ball.ts`), or, from
  the fifth stretch on (`catchTests.fromStretch`), goes to the catch tests
  (SNAG IT!, the tip drill) at `catchTests.chance`. Nothing is
  intercepted, and an uncontested catch is never dropped. Candidates for
  the grilling: a defender in a bullet's lane bats it on the way (not
  only at its end), Rushers batting balls at the line, uncontested drops
  for low Hands, interceptions. Measure first: the balance tool counts
  how passes end.
- **Stats for Jack, the QB.** Jack has no stats today (the three stats,
  Heft, Hustle and Hands, are the players'). _User, 2026-11-04: "stats for
  the QB to give them a faster/slower pass, faster/slower 'reads' (not sure
  what the actual mechanism is called for having the passing line scan
  from left to right). also the ability to flip that direction.
  evasiveness to allow for more time in the pocket. maybe a power up or
  something that lets them see the sack timer. random sack timers."_ In
  our words (`CONTEXT.md`):
  - **Pass speed:** the bullet's speed (`throw.speed` in `content/tuning.ts`, 24 yards a second).
  - **Reads:** the **sweep**, the aim line, which starts at the left
    sideline at the snap and crosses back and forth (`sweepAngle` in
    `sim/ball.ts`); its speed is `sweep.degreesPerSecond`, faster each
    area. The Slow-Mo Sweep perk (`slowSweep`) already slows it by a
    quarter.
  - **Flip the sweep's direction:** start it at the right sideline.
  - **Evasiveness:** a longer **pocket**, which holds for 4.5 scans
    (`sweep.scans`) and then it's a sack. The Extra Sweep perk
    (`extraSweep`) already adds one.
  - **Seeing the sack timer:** nothing shows the pocket's time today. A
    power-up or treat could show it.
  - **Random sack timers:** the pocket's length varies from down to down,
    so the 4.5 scans can't be counted.
  - Open for its grilling: whether these are Jack's stats (rolled per
    run, or raised by TRICK OR TREAT!) or perks like the two sweep perks,
    and which are difficulty levers (random sack timers) rather than
    rewards.
- **A late-game perk for longer throws,** toward a "break the game" feel as
  your receivers get faster. _User, 2026-11-07, after a run of 20 series
  with the taffy: "I'm definitely going to want to add a later game perk
  that lets your distance selector speed on throws increase to allow for
  throwing further down field. this helps lead to a 'break the game' feel
  as your receivers get faster. not sure how to get that feel for runs
  that's interactive yet but we will figure that out."_ In our words: two-
  tap throwing's **marker** slides out along the aim line, from 3 yards
  past Jack to the line's end (`throw.maxAhead`, 30 yards), and back, at
  `twoTap.markerSpeed` (14 yards a second; `aimDistance` in `sim/ball.ts`).
  The perk would lengthen the line and speed the marker up, so a deep lob
  takes no longer to set. Open for its grilling: how much further, whether
  it stacks, when in a run it's offered, and the same feel for runs, which
  needs an interactive way in. Beside **Stats for Jack** (above: pass speed,
  reads).
- **Hexes and events for the long field** (difficulty map c1, parked
  2026-11-04): the generic events from `docs/FIELD_EVENTS.md` (n1, n2), the
  taffy flood first. Each event belongs to a stretch and goes off on every
  down whose line is in it. _User: "Let's park this and save it for later.
  Let's just try to tune without it for now."_ **Under way** (2026-11-06,
  map https://claude.ai/artifact/1H2idLc7kQhhn3quA7TshS): the taffy flood
  and the wisps, after `statuses` (`docs/STATUSES.md`, `docs/FIELD_EVENTS.md`
  round 5). "Hex" stays the word (a3).
- **A first hex,** a generic field event that only hurts you (flatten or
  Slowed on your players). Parked from the field events map, b4
  (2026-11-06): the taffy is mischief and the wisps a blessing.
- **A perk that turns a grabbed player Ethereal** for a moment, so they slip
  free. _User, 2026-11-06: "perhaps if we added a perk that triggered it on
  a single player when they get tackled."_ Needs triggers (below, "Left for
  a later refactor"). Open: once a down or once a run.
- **Rare tap tests with stronger effects.** _User's note on s5, 2026-11-06:
  "It would be cool if we had certain special/rare quick events that could
  trigger more powerful effects."_ A tap test whose grade gives a status
  (`docs/STATUSES.md`, s10).
- **An arrow for a receiver out of sight:** at the top edge of the screen,
  for a receiver who has run off it but can still be thrown to. Parked from
  the long field (d2, 2026-11-04).

- **A catch circle that grows with Hands** (two-tap): a catcher with good
  Hands gets a bigger circle round the marker, drawn bigger. Parked from
  Hands on a lob (s3, 2026-11-04), since it changes what you see while
  aiming and the run under the ball.
- **More catch tests if lobs are batted too often:** if Hands on a lob
  leaves too many batted down, send more contested lobs to SNAG IT! or the
  tip drill to give the Coach a chance. _User's note on h2, 2026-11-04: "We
  can add more tap events to be triggered by this to give the player a
  chance if we get too many batted balls."_ The lever is
  `catchTests.chance`.
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
  **Flagged in play, 2026-11-07** (saved as
  `docs/play-logs/2026-11-07-forward-progress.jsonl`, the session's start
  line and then the whole down, since the play log rotates). Build
  2739a65, seed 226869837, area 2 stretch 2 (gimmick), 2nd and 1.5 at the
  21.3, Deep Shot. The catch was at the 27.8 (12:44:50); the carrier broke
  one tackle, was dragged 0.5 yards in a second grab, and reached about
  the 32. A Blocker's pancake at 12:45:00 was the last contact, and the
  bolt's Fast ended at 12:45:01 with the carrier at the 30.75. **Then
  30 seconds with no events at all:** at the ⚑ (12:45:31) the down was
  still live, the carrier at the 27.16, 3.6 yards back and 7 yards
  across. _User: "a scenario we need to record the logs of for stopping
  play after some amount of limited movement (forward progress rule)."_
  So the rule needs to cover a play with no tackle coming and little
  progress, not only a carrier being shoved back.
  **Built and closed, 2026-11-08** (B9, branch `forward-progress`): the flagged downs
  were all a drag that never ended. A drag now also ends once the carrier
  has gone 1.5 s on screen without gaining a quarter yard, down where he
  stands.
  No wider rule (forward progress map f2,
  https://claude.ai/artifact/BHZ9WcjSz3THckuhjGpWMd): outside a drag any
  defender who touches the carrier grabs him at once.
- **Ethereal as a pickup.** The wisps' effect may be good but its
  application bad: a circle on the field, gone off 1 s after the snap, is
  passed before it helps. Ethereal could instead be an on-field pickup, a
  power-up a player takes (as the bolt gives Fast). _User, 2026-11-07:
  "maybe this is a good effect but bad application. could be better as an
  on field pickup power up. before we go down that road, can we modify the
  wisps to be like 3 yards from the line of scrimmage instead. the issue
  may be the timing of it, it goes off too soon to be super beneficial
  when it's far from the line of scrimmage."_ Tried first: the wisps at 3
  to 9 yards (field-wisps). Open: whether the timing (goes off at 1 s,
  lasts 3 s) is the lever instead.
- **A native Android build** of the game. _User, 2026-10-30._
- **Gravestones instead of oil slicks.** **Built** 2026-11-10 on
  `gravestones`; the design, decisions and tests are in `docs/PICKUPS.md`,
  "Gravestones". _User, 2026-10-31: "change oil slicks to gravestones. same
  effect as it currently has."_ Decided on the field events map (v1,
  2026-10-31) and the next-job map (v1, rounds 2 and 3, g1–g5): the same
  effect and numbers, the call **TRIPPED!**, a stumble and a thud, the word
  "gravestone" everywhere, a yard's reach (up from the slick's 0.75, the
  bolt keeping 0.75), and Claude's model, approved as is, to be replaced by
  the user's Goxel pass if one comes back. After playing it (2026-11-10):
  drawn true to size, as wide as its reach, and in a lighter stone
  (next-job map round 4; g6's ring rejected).
  For the long field (difficulty map c2, parked 2026-11-04): more of them
  further up the field (one in the Intro, two in the Challenge, and so
  on), so a long run is likelier to meet one. _User: "It's a good thing to
  tune but I want to focus on the defenders first."_
- **A pickup's moment of being taken.** Each pickup gets an animation as
  it's taken, a "taken" model left on the field afterwards, or both: a
  gravestone crumbles into a pile of rubble, say. Today a taken pickup
  just disappears (`render/pickups.ts`). _User, 2026-11-10, after playing
  the true-to-size gravestones: "add a future note for power ups to have
  a pickup animation and /or a "picked up" model for after they have been
  interacted with. eg. gravestones would crumble into a pile."_ Open for
  its grilling: which pickups get which (the bolt's spark, the
  gravestone's rubble); whether a pile stays for the rest of the series
  or the stretch; whether it can trip anyone again (today one gravestone
  trips once); and the models, drafted for the Goxel round trip.
- **The art pipeline** (`docs/ART.md`; map round 1,
  https://claude.ai/artifact/5CvJdCRtTedcMrwLYx5NUt, 2026-11-03):
  - **The Goxel round trip** (round 3, a1 and a2, 2026-11-06; the user's
    goal of 2026-11-05: Claude makes the models, the user tweaks them in
    Goxel and hands them back). The `.voxt` → `.vox` exporter is built
    (p4 unparked; `npm run export-vox`, `docs/ART.md`, "The round trip"),
    tested by every model going out and coming back unchanged.
    Models were to travel through one Google Drive folder, but the first
    check failed (2026-11-06): the Drive connector takes and gives a file
    only as base64 text that Claude has to copy out in full, and a 3 KB
    `.vox` (the gumdrop) came out invalid. Real models are bigger, so the
    models travel over the tailnet (a2's fallback; Thanksgiving map j8,
    the user: _"I think serving on the tailnet is fine"_): a page on the
    play log's service, `…:8443/vox-log/models`, rather than j8's own
    `/vox-models/` path, so `tailscale serve` needs nothing new
    (`docs/ART.md`; live once deployed). The first real
    trip, one of Claude's models changed in Goxel and brought back,
    replaces p3's gravestone test (the user confirmed on 2026-11-04 that
    Goxel's Android app saves `.vox`).
  - **An area's art as data** (p7) became the set compartments (Direction,
    "Sets", c1–c8).
- **"Either side" drawn on both sides** of the event editor's field, the
  right solid and the left dashed, so an event that picks a side each down
  doesn't read as flipped in play. Field events map round 4, e5, Not now
  (2026-10-31).
- **A forced play (a future event).** Two of the three play cards are
  banned at random, leaving one, so the play is chosen for you. It's the
  Queen's Royal Decree doubled: she bans one card a down (`decree` in
  `content/defense.ts`, `state.banned` in `sim/run.ts`). _User,
  2026-11-03: "an event that forces a play choice randomly, kinda like how
  the decree removes a single play, but this would remove two plays."_
  Open for its grilling: what kind of event it is (a field event, a Boss
  power, a trick from TRICK OR TREAT!) and where and how often it comes; its
  name, call and look beside the BANNED seal; whether the two bans show,
  or the remaining card is just dealt alone; and how it sits with the
  decree when both apply (`state.banned` holds one card today). It is
  also one of the play-call levers above (2026-11-04), as a stretch's
  rule or the player's toggle.
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
- **Choosing the defense in practice** (each area's series, the decree, the
  crows). Offered as t3's alternative; practice always plays the Forest's
  first series for now. _2026-10-29._
- **Sharing plays.** A Copy code play can be pasted to anyone, which the user
  called "a backdoor way to sharing plays". A real way to share, such as a
  link that opens the play, could grow from Try it's link (e2, e3). _User,
  2026-10-29._
- **A test bench for one play** (dev): pick a play, set the down, the
  distance to go and where on the field it starts (an ordinary series, or a
  Boss series' goal to go with its end zone), then run it again and again.
  It's for exact situations like B6's, a catch in the end zone, which today
  take a real run to reach. _User, 2026-11-01: "a test bench for an
  individual play where you can set the down and distance you run the play
  at and the position on the field."_ Close to Try it's practice (which
  always plays the Forest's first series) and to **Choosing the defense in
  practice**, below; it may grow out of them. Open for its grilling: which
  defense it lines up (each area's series, the Boss's), whether the tap
  tests can be forced as `?snag=1` and `?tip=1` do, and whether it logs
  each rep as the tap-test bench does (`docs/BENCH.md`).
- **A team that grows (a big change, not yet broken up).** Your players
  skill up slowly on their own, from the results of each play and what each
  of them did in it, and certain pickups raise a stat for good. The aim is a
  sense of progression: improving the squad you have, rather than always
  bringing in new players. With it, TRICK OR TREAT! rarely offers a new
  player and offers new plays instead (Plays as rewards, below), along
  with Draw up a play as an override of the three play cards dealt each
  down, which opens the play editor with the defense shown in it. _User,
  2026-11-01: "I want to also consider a more radical change to the game:
  players slowly skill up on their own, depending on the results of each
  play and what the players did on each play... the idea is to provide
  more of a sense of progression and improvement of your team, not always
  bringing in new players but instead improving your squad."_ The user
  doesn't yet know what all its parts should look like, so it needs a lot
  more work before it's split into branches. **Growth from play and
  TRICK OR TREAT! rebalanced are planned in `docs/REWARDS.md`** (2026-11-05);
  pickups that change a stat for good are still open. **Players skill up only
  within a run,** roguelite style; anything that lasts between runs is
  **Meta progression** (below). _Decided on the stats map, m1, 2026-11-02._
  The parts seen so far:
  - **Growth from play:** which stats grow (Heft, Hustle, Hands), from
    what (a catch, yards after it, a block held, a tap test's grade), how
    fast, and whether there's a ceiling. It needs the per-play results of
    "Results, stats and achievements" (above), so that comes first.
  - **Pickups that change a stat for good,** where today's treats and
    tricks last only a moment (`docs/PICKUPS.md`).
  - **TRICK OR TREAT! rebalanced:** plays offered more often than players;
    how rarely a player comes, and whether a growing squad still needs
    the roster screen as it is. Player bonuses in the pool too, fewer
    players in it, and rewards that grow with the yards a play gained,
    since under the long field a long play makes fewer first downs, so
    fewer TRICK OR TREAT!s. _User's note on the long field's b3,
    2026-11-04._
  - **Draw up a play** (below), with the play editor showing the defense
    as it lines up for that down.
  - **Balance:** a squad that grows across a run makes later areas
    easier, so the defense's growth by area and hard mode's second lap may
    need tuning to match.
- **Plays as rewards.** TRICK OR TREAT! offers a new play, not only a new
  player. The run then has its own playbook, which grows. esrauch's
  `MILESTONES.md` B4 already lists "New plays for the random pool as
  unlocks". _User, 2026-10-28._
  - **Draw up a play** (a reward): instead of the three play cards dealt,
    the Coach sees what the defense is lining up in and draws the play to
    beat it. The play editor opens, and the play drawn is the one called
    for that down. _User, 2026-10-31: "you get to see what the defense is
    using and then can draw up the perfect play."_ Open for its grilling:
    how it's earned and how often (once a run, once a series, a TRICK OR
    TREAT! pick); what the Coach sees of the defense (the line-up, their
    assignments, coverage); whether the editor opens in the game or as the
    dev page, and what it allows (every slot, or routes only); whether the
    play rules still apply; whether the play is kept afterwards (in the
    run's playbook, as a sketch) or gone after the down.
    The record keeps a drawn-up play like any other, with an id from when
    it's drawn (stats map p8, 2026-11-02); filing it away as a sketch is
    for this grilling.
  - **Select any play** (a reward, alongside Draw up a play): instead of
    the three play cards dealt, the Coach picks any play for that down.
    _User, 2026-10-31._ Open for its grilling, with Draw up a play: which
    plays it offers (the whole playbook, only those unlocked so far, the
    Coach's sketches too); whether the Coach sees the defense's line-up
    before picking, as with Draw up a play; how it's earned and how
    often, and whether the two are offered side by side as one reward
    pick.
- **Meta progression:** something that lasts from one run to the next,
  such as players unlocked by achievements. _User's note on a1, 2026-11-02:
  "Meta progression may come later, such as players unlocked by
  achievements."_ Players skill up only within a run (A team that grows).
- **Stats kept with your account:** the record sent to a server and kept
  with the account that played, so it follows the Coach between phones.
  The record is ready for it: each run has a random id, the build and its
  format version (stats map k1, k4, 2026-11-02).
- **Stats during a run:** the run's stats so far, from the pause menu or
  between series. Left out of the first screens (stats map, 2026-11-02).
- **Achievements for a team of one kind:** a series won with all seven of
  one kind, Golems, Ghosts or Werewolves (x1, Not now, 2026-11-03: "it
  depends on core game changes").
- **Achievements for one way only:** a series won without a pass, or
  without a rush (x9, Not now, 2026-11-03): a down doesn't always offer
  both. It comes back if Jack can run, or a handoff can be forced on a pass
  play.
- **Yards that carry over, and longer areas.** A gain past the first-down
  line carries to where it ended (now planned as the long field, above,
  `docs/LONG_FIELD.md`), and an area can be longer than 40 yards (still
  parked);
  how a series' defense and the Boss fit that is open. Today every area is
  four series of exactly 10 yards (`originOf`, `src/arcade/game.ts`), and
  the extra yards are thrown away. _User's question on w1, 2026-11-03;
  parked as g1._
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
  - The first slice is planned (round 7, above). Defenders take bolts since
    the mischief bolt (2026-11-05). Still open: defenders taking other
    kinds; more kinds; moving
    pickups and whether a path is drawn before the snap; placing them in the
    editor; pickups in practice.

## Left for a later refactor

Places we chose to leave as they are for now, to come back to once more of
the game is built on them. _User, 2026-11-06 (field events map, s5): "Let's
start adding notes about all the places we are choosing to leave behind for
a future refactor."_ Each says what was left, why, and where it's planned.

- **Lying down as a status** (Flattened). It stays each body's own `down`,
  used by tackles, pancakes, slicks, Frog Rain and Break it!'s drag; a
  field event's flatten is a knockdown, beside the statuses.
  `docs/STATUSES.md`, s2. _User: "Leave lying down for now. We will see how
  everything fits together on a later pass and maybe refactor again."_
- **Triggers for statuses:** "when this player is grabbed", "on a GREAT",
  and the like, so perks, tap tests and Boss powers can give statuses.
  Built when the first of them needs one (`docs/STATUSES.md`, s5): the
  Ethereal perk and the rare tap tests above.
- **Statuses on things other than bodies:** the ball, pickups, props
  (`docs/STATUSES.md`, s6).
- **Pickups as tiny field events,** a circle taken on touch that gives a
  status or a knockdown (`docs/STATUSES.md`, s10).
- **One run-options object:** the link options, hard mode and two-tap, and
  practice's `practice` flag with `practiceEvent`, gathered into one type
  with one set of defaults. Planned with **A dev setup mode** (V1, above);
  field events review r14, release mode review v6.
- **The saved-events check lists the Bosses again,** since it may import
  only types (field events review r6, `docs/FIELD_EVENTS.md`).
- **The render loop reads `performance.now()`** rather than animation time
  as elsewhere (field events review r19).
- **A status's looks in one place.** Slowed's heavy step is drawn in
  `render/bodies.ts`, and since field-wisps Ethereal's see-through look
  with it, but Fast's sparks still with the pickups (`render/pickups.ts`),
  where the bolt left them. Gather them (`docs/STATUSES.md`, s7).
- **A spell over a timed status of the same name:** stepping out of a spell
  ends its status, losing the rest of a timed one of the same name that it
  took the place of. Nothing gives Slowed but the taffy yet; a status list
  that keeps each source's own time would fix it when one does
  (`docs/STATUSES.md`, field-taffy as built).
- **A field event as a burst or a spell, each with its own effects:** the
  event's type has how it goes off and its effect as two fields, so it
  allows a spell that flattens, which `keepsSpellRule` (`content/spells.ts`)
  refuses everywhere instead. A union would make it unwritable, but reshapes
  the event, the editor's every change and the saved file (taffy review r4).
- **One helper for an event's phase** (before the snap, building up, on,
  after): each look (`render/taffyFlood.ts`, `render/wisps.ts`, the
  plain look) reads the countdown itself; the wisps' `spent` is one such
  read (wisps review r4). Gather it with the statuses' looks, above (taffy review
  l2).
