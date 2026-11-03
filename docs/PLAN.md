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

Open, for when the first new theme or set is planned:

- **What a set is:** its areas, its players and its defenders, or any of
  them alone; whether sets mix (a pop-culture team in a holiday area); how
  a player picks one (a menu, unlocks); and its word in `CONTEXT.md`.
- **The holiday line:** which holiday comes next, and whether each is a
  run of its own or one run passes through several.
- **Pop culture and the public build:** characters, names and looks owned
  by others can't go in the public release as they are, so how close a
  set comes to its source (an homage in the spirit of it, or original
  characters) is decided per set.
- **The art pipeline:** many sets make a set's art (colours, models,
  props, defender looks) a candidate for data rather than code (art
  pipeline map p7, https://claude.ai/artifact/5CvJdCRtTedcMrwLYx5NUt).

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
  `?snag=1` SNAG IT! from the first series, `?area=N`, `?seed=N`,
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
  edit. With it, the run's `practice` flag and `practiceEvent` (field
  events, review r14) become one practice union, as the game already has. Hard mode and two-tap throwing already travel as a pair (`Modes`
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
  or a tackle for a loss on 1st down makes it 2nd & 12. Today losses do move
  the line back, but never behind where the series started (`endDown` in
  `sim/run.ts`: "Never behind the series' start (there's no room for the
  QB)"), so a loss on the series' first snap leaves 2nd & 10. Open for its
  grilling: what that "no room" was (the camera, the field behind, the
  previous series' props and pickups), and how far back a series may go.
  _User, 2026-10-30._
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
  is [`docs/STATS.md`](STATS.md). Four branches, each reviewed and merged
  before the next:
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
- **Gravestones instead of oil slicks.** The trick on the field becomes a
  gravestone, with the same effect: whoever runs through it trips and lies
  down a moment, and a carrier is tackled there (today **SLIPPED!**,
  `docs/PICKUPS.md` k6). _User, 2026-10-31: "change oil slicks to
  gravestones. same effect as it currently has."_ Open: its call on screen
  and its name in `CONTEXT.md`; its model and sound. **Decided** on the
  field events map (v1, 2026-10-31), for when it's built, on its own:
  the same effect and numbers; the call **TRIPPED!**; a stumble and a thud
  for the sound; "gravestone" everywhere (`CONTEXT.md`, the docs,
  `PickupKind` `'gravestone'`), nothing left saying slick; and _"Can we
  make the trigger area a little larger as part of this work."_ (how much
  larger, its radius against the slick's today, decided then).
- **The art pipeline** (`docs/ART.md`; map round 1,
  https://claude.ai/artifact/5CvJdCRtTedcMrwLYx5NUt, 2026-11-03):
  - **Proving the editor path** (p3): the user makes a small gravestone in
    Goxel's Android app and saves it as `.vox` to Google Drive; Claude
    imports it (`npm run import-vox`) and reports what broke. Whether the
    Android app saves `.vox` is unchecked, so the first step is a look at
    its export menu.
  - **A `.voxt` → `.vox` exporter** (p4), so a model Claude wrote opens in
    the editor for touch-ups and comes back through the importer. Parked
    until p3 shows importing works.
  - **An area's art as data** (p7): the first step of building the first
    new area or set is moving what an area looks like (mood colours,
    defender looks, props, their scatter) and the team's models into one
    data file per area or set, with the three areas moved over, so the
    shape comes from a real second example.
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
  decree when both apply (`state.banned` holds one card today).
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
  more work before it's split into branches. **Players skill up only
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
    the roster screen as it is.
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
  line carries to where it ended, and an area can be longer than 40 yards;
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
  - The first slice is planned (round 7, above). Still open: defenders
    taking them (the user: "only offense for now"); more kinds; moving
    pickups and whether a path is drawn before the snap; placing them in the
    editor; pickups in practice.
