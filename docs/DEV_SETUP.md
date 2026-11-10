# The dev setup

A dev page where the Coach sets how a run plays (each tap test on or off,
the throw type, hard mode, where it starts) and the game remembers it,
rather than typing flags into the address bar. It is the dev panel
`docs/rules.md` asks for ("Build a dev panel from the start"). Planned on
the next-job map https://claude.ai/artifact/MP8EsnMZnfgnyX9DaE7cA8, rounds 1
to 3, all approved 2026-11-10. _User (v3): "Let's do this so that it is
under the /Dev route and saves the config to local storage. We should also
have there be a default config file for all of the same toggles/values."_

## Words

- **Run options:** the switches a run is made with, one `RunOptions` value
  in code.
- **The setup:** the run options the Coach saved on the setup page, kept on
  that phone.

## What it does

- **The page** (v3, d9): `dev/setup.html`, listed on the dev index, in the
  dev pages' style. Three sections, then the buttons:
  - _Throwing & modes:_ throw (two-tap or one-tap), hard mode, the starting
    area, the seed (random or a number).
  - _Tap tests:_ each Break it! kind (the bar, MASH!, JUKE!) on or off, at
    least one staying on; SNAG IT! and the tip drill each Off, Normal or
    Always.
  - _On the field:_ pickups on or off; field events on or off; start with
    every perk; a monster team.
  - Every on/off switch is the editors' toggle (`.tog`), and the
    dropdowns and the seed box stay (map round 5, p2, 2026-11-10: "Toggles
    where the checkboxes are. Field events should also just be a toggle for
    them on or off, no extra specificity. I don't think we have a drop-down
    concept so we can keep that for now").
  - _Save & play_, _Copy link_, _Restore defaults_.
  - At the top: _"These switches change runs of the game only. Practice
    from the play and event editors ignores them."_ (d5, the user's note:
    "make sure to make it clear that the toggles only effect actual gameplay
    and not the practice modes").
- **The defaults file** (d1): `src/arcade/content/runOptions.ts` holds every
  switch with its default, and the one `RunOptions` type. The game, a link
  and the page all start from it. Today's options are read in
  `src/main.ts` and pass through about ten places each; hard mode and
  two-tap are on in a link but off in `createRun`. That ends here.
- **A saved setup applies to every new run on that phone** (d2), stored per
  site, so the tailnet build and the release each keep their own. The start
  screen shows **DEV SETUP · N changed** with **Reset** whenever the setup
  differs from the defaults; tapping the tag opens the page.
- **Layers** (d3): each switch comes from the link if the link names it,
  else the saved setup, else the defaults. Every switch is one value, so
  "off" is said, not left out. Links keep working for the tools,
  screenshots and balance runs, and a Copy link plays exactly that setup:
  it names every switch, so it plays the same on any phone (map round 5,
  q1).
- **Link-only** (d4): `win`, `video` and `farmSong`, for the sing-along
  video tool, stay off the page.
- **Practice ignores the setup** (d5): play practice and event practice
  keep their own links, as today.
- **Ships with the dev pages** in releases (d6), "fine for now" (release
  map b8).

## The order of work (o1)

1. `run-options`: the defaults file and the one type; nothing plays
   differently.
2. `dev-setup`: the page, the saved setup, the tag and the three new
   switches.

Each is tested first, reviewed and merged before the next. Gravestones
(`docs/PICKUPS.md`) come before both.

## Tests, written first

### `run-options` (d7)

1. The defaults file names every switch: hard mode and two-tap on, area 1,
   a random seed, SNAG IT! and the tip drill Normal, every Break it! kind
   on, pickups on, field events Normal, perks and the monster team off.
2. Today's links read the same: each flag in `src/main.ts` (`hard=0`,
   `aim=1`, `area`, `seed`, `snag=1`, `tip=1`, `perks=1`, `monsters`,
   `win`, `video`, `farmSong`) gives the run it gives today; old
   `hard=1&aim=2` links still play the default.
3. One set of defaults: a run made with no options plays the defaults file.
   Tests that relied on `createRun`'s off defaults say "off" explicitly.
4. Nothing plays differently: `balance:compare` reports identical to `main`.

### `dev-setup` (d8)

1. Saving: a setup saves and loads. Storage that's empty reads as nothing
   saved. Storage that can't be read shows an error on the page, and the
   game plays the defaults. A bad or unknown value is left out with a
   warning naming it.
2. Layers: for each switch, the link over the saved setup over the
   defaults (one table of cases).
3. The tag: "DEV SETUP · N changed" only when N > 0; Reset clears the
   setup and the tag goes.
4. Break it! kinds: one switched off is never dealt; the page won't let the
   last one go off.
5. SNAG IT! and the tip drill: Off, a contested ball never goes to it;
   Always, every contested ball from series 1 does.
6. Pickups off: no bolts or gravestones on the field.
7. Field events: Off, none on ordinary stretches, and Frog Rain still
   Mister Frog's; On, the same run as today (map round 5, p2: the one
   chosen event is gone).
8. Practice is untouched: play and event practice links make the same run
   with a setup saved as without, and the page says so at the top.
9. Copy link writes every switch, and reads back the same setup on a phone
   with a different setup saved (map round 5, q1).
10. A run made with a setup says so: its changed switches, as a link
    writes them, in the play log and the run's record (map round 5, q3).

Then a headless look at the page and the tag on the served build before
it's handed over.

## As built

### `run-options` (2026-11-10)

- `src/arcade/content/runOptions.ts`: `RunOptions` (seed, area, hard,
  twoTapAim, snagAlways, tipAlways, startWithPerks, monsters) and
  `RUN_DEFAULTS`; `readLink`, which returns the run options a link names
  (a `Partial`) and the link-only `win`, `video` and `farmSong`; and
  `runOptionsFrom`, which lays them over the defaults. `readModes` and
  `content/modeFlags.ts` are gone, their tests folded into
  `tests/arcade/runOptions.test.ts`.
- SNAG IT! and the tip drill stay booleans (`snagAlways`, `tipAlways`):
  Off, and the three new switches, come with `dev-setup`.
- The game takes `run: RunOptions` with its seed chosen (`src/main.ts`
  picks a random one when the link names none). `?win=1` makes its run
  `ORIGINAL_GAME`, so it can be won.
- **Practice is never hard mode and starts with no perks**, whatever it's
  given: the rule is in `createRun`, so a practice run made anywhere keeps
  it (review, d5). Practice still takes its throw from its own link, and
  SNAG IT!, the tip drill and the monster team from the run options: when
  `dev-setup` lays a saved setup into those, practice must take them from
  its link only (test 8 there).
- `createRun`'s options default from `RUN_DEFAULTS`, so a bare
  `createRun(seed)` is now hard mode with two-tap throwing. What relied on
  the old off defaults says so through `ORIGINAL_GAME`, esrauch's game
  (normal, one-tap, `?hard=0&aim=1`), defined once in `runOptions.ts`: the
  unit tests that failed without it, the balance bots, the test bench and
  `?win=1`. About 30 test files that call `createRun(seed)` bare passed
  either way and now play hard mode with two-tap, the game's default (the
  offer tests among them now roll hard mode's recruits); the spec review
  noted it, left as is.
- Test 1 named every Break it! kind, pickups and field events in the
  defaults; those three switches arrive with `dev-setup`, so its test
  grows then.
- Test 4, nothing plays differently: `balance:compare` measures against
  `main`, which doesn't have the gravestones this branch sits on, so the
  six scenarios were run with the balance tool on `gravestones` (725942c)
  and on this branch, 8 runs each: the six reports are identical, byte for
  byte. The seeded-run
  digests (`statusesSameRun`, the taffy's pick) pass unchanged.


### `dev-setup` (2026-11-10)

- **The switches** (`src/arcade/content/runOptions.ts`): SNAG IT! and the
  tip drill are `snagIt` and `tipDrill`, each `off`, `normal` or `always`;
  `breakItKinds` the Break it! kinds a tackle deals (at least one, kept in
  `BREAK_KINDS` order, which moved here from `sim/breakit.ts`);
  `pickupsOn`; `fieldEventsOn` (on is the seed's generic events, as
  always; a chosen event on every stretch was built, then taken out on
  map round 5, p2). Each switch is named once in `SWITCHES`:
  its link flag, how a link and a saved value are read, and how Copy link
  writes it. `runSwitches` gives `createRun` its part, and `RunState`
  carries each.
- **In play:** Off sends no contested ball to that catch test; with one
  Always, every contested ball from series 1 goes to it (as `?snag=1`);
  both Always pick at random. Normal is today's rule: from series 5 the
  seed sends some contested balls to a catch test and picks one, half and
  half; a pick that is Off goes to today's rule instead, so Off on one
  leaves the other on Normal exactly as it was (review fix). A tackle deals
  only the kinds on, by the same random pick (all three on is the same run
  as before). Pickups off lays none. Field events off puts none on ordinary
  stretches; a Boss's own (Frog Rain) comes either way.
- **Links** read as they did, and say more: `?snag=` and `?tip=` take
  `off`, `normal` or `always` (`1` still means always); `?breakit=bar,juke`;
  `?pickups=0`; `?events=0` (or `off`); every on/off flag also reads `on`
  and `off`; and `?hard=1`,
  `?aim=2` and `?perks=0` now name the default, so a link can override a
  saved setup. "Off is said" for the rest too (the two-axis review):
  `?seed=random` sets the seed back to random over a saved one, and
  `?monsters=0` (or `off`) turns the monster team off; bare `?monsters` and
  any other value still turn it on, as before. `?seed=` and `?area=` go
  through the same check as a saved value (a whole number from 1, the area
  at most the last), so `?seed=1.5` or `?area=99` now names nothing where
  it used to be taken (the area clamped). A value a switch doesn't take
  names nothing.
- **Copy link** (`linkFor`) names every switch, the defaults, `seed=random`
  and `monsters=0` included, so the link plays the same setup on any phone
  whatever is saved there (map round 5, q1), e.g. `?seed=random&area=1&hard=1&aim=2&snag=normal&tip=normal&breakit=bar,mash,juke&pickups=1&events=1&perks=0&monsters=0`.
- **A run says what setup it was made with** (map round 5, q3): the
  setup's changed switches, as a link writes them (`setupQuery`; '' for
  none, and in practice), are on every play log line as `setup`, beside
  `link`, and in the run's record as `setup`. The record format is 4; the
  stats store's upgrade step 3 → 4 gives older runs a blank setup. Setup
  runs still count toward stats and achievements.
- **The setup** (`src/arcade/content/savedSetup.ts`): localStorage
  `getJackBack.devSetup`, only the switches that differ from the defaults,
  as JSON. Read back switch by switch: a value no switch takes, or a name
  that isn't a switch, is left out with a warning naming it, shown on the
  page and as a notice in the game. Storage that can't be read, or isn't
  JSON, is `unreadable`: the page says why, and the game plays the defaults
  and says so in the same notice (`setupNotices`; nothing in practice).
- **Layers:** `runOptionsFor(link, setup, practice)` in `runOptions.ts`, the
  one place: the link's, else the setup's, else the defaults, switch by
  switch. `src/main.ts` calls it with `isPracticeLink` (`content/eventLink.ts`,
  tested): a `?try=` or `?event=` link, so the setup never reaches practice.
- **The tag** (`src/ui/setupTag.ts`): DEV SETUP · N changed, top centre on
  the start screen, linking to `dev/setup.html`; Reset clears the setup and
  reloads the game, so the next run plays the defaults. A Reset that fails
  says so on the tag.
- **The page** (`dev/setup.html`, `src/dev/setup/page.ts`): as designed,
  its on/off switches the editors' toggles (map round 5, p2): the `.tog`
  style and the editors' palette moved into `src/dev/controls.css`, which
  the play editor imports (the event editor through it) and the page
  links; the editors' headless screenshots are the same, byte for byte,
  before and after. The last Break it! kind on is held, its toggle
  disabled and dimmed. The page has "N changed from the defaults" under the note, a seed the link's
  check refuses refused here too (`switchFromText`), and a copy that fails showing the link to
  copy by hand. Restore defaults resets the page and clears the saved setup
  at once.
- **Tests:** `tests/arcade/devSetup.test.ts` (1–10 in the sim and the
  options), `tests/ui/setupTag.test.ts` (3), `tests/dev/setupPage.test.ts`
  (1, 4, 8, 9 and the toggles on the page), the play log, recorder, keeper
  and store tests (10), and d7 test 1 grown to the new switches.
- **Nothing plays differently with nothing saved:** the six balance
  scenarios, 8 runs each, on `run-options` (ec0b155) and on this branch
  (fe0e701, and again after the first review fix): the reports are
  identical, byte for byte. The seeded-run digests pass unchanged. The
  two-axis review's fixes touch links and messages, and map round 5 took
  only the chosen-event path out of the sim (`sim/run.ts` is run-options'
  but for the off check), so the comparison wasn't rerun.
- **The headless look** (the built game at phone size): the page, a setup
  saved, the tag on the start screen, Reset taking it away, warnings and
  an unreadable setup on the page. It led to the tag kept on one line.
  Retaken with the toggles (map round 5). A setup's warnings, like the
  saved events', show as a notice once PLAY has taken the start screen
  away.

**Answered on map round 5** (2026-11-10; these were the open questions):

1. **Copy link writes every switch** (q1, approved): built, above.
2. **The chosen field event** (q2, approved, then superseded by p2): field
   events are on or off only, and the chosen-event option is gone.
3. **A run made with a setup says so** (q3, approved): built, above.
4. **A practice link the game can't read** opens the ordinary game, as
   before, and still without the setup (q4, approved: kept as built).
