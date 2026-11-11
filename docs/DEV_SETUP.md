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
  - _On the field:_ pickups on or off; field events Off, Normal or one
    chosen event; start with every perk; a monster team.
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
  screenshots and balance runs, and a Copy link plays exactly that setup.
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
7. Field events: Off, none on ordinary stretches; one chosen, that event on
   every ordinary stretch. Frog Rain stays Mister Frog's either way.
8. Practice is untouched: play and event practice links make the same run
   with a setup saved as without, and the page says so at the top.
9. Copy link writes every changed switch, and reading it back gives the
   same setup.

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

