# The player's menu

Before the snap, a selected player gets a strip of buttons for what they can
do on this play. The first slice is the strip itself; the second is the
first thing it does, a **hot route**. Planned on the map
https://claude.ai/artifact/6qjgoC72xLeSWPXw2VCDpJ, rounds 1 to 3, approved
2026-11-11. _User, 2026-11-10: "per play perks that could be activated on
some menu that displays when they are selected. the start of this idea can
just be the shell of the menu itself … one play activated perks are one
idea, route changes are another, audibles are another." 2026-11-11: "one
thing to consider with the player menu is the ability to change their
route … we will need it once we start adding capabilities to the player
menu."_

## Words

- **The player's menu:** the strip of buttons a selected player gets before
  the snap.
- **Hot route:** a route a player is given for this down only, in place of
  the card's.

## What it does

- **Where** (a1): a strip just above the play cards, while one of your seven
  is selected before the snap (`docs/SELECT.md`). It goes when the selection
  goes: ✕, a tap elsewhere, HIKE!. _User: "Yeah I like c"._
- **The slots** (a2): Route, Perk and Audible, each greyed until it works. A
  greyed slot does nothing. Perk and Audible are planned later.
- **Who sees it** (a3): only with the dev setup's **Player menu** switch,
  off by default, until Route works; then the switch goes and every run has
  the menu.
- **A hot route** (a5, a6, c1): each tap of Route gives the player the next
  route in a loop: as drawn, Go, Slant, Out, Post, Corner, Curl, then as
  drawn again. Their route on the field changes at once; there's no list
  and the button stays "Route" (b6, rejected: _"Tapping route just goes
  through a linked list of the route changes. We don't need a card we can
  just show the route on the screen"_). A route that would leave the field
  from where they stand is skipped. It lasts this down only; the card stays
  as drawn.
- **Who can take one** (b1): Catchers, and a Runner on a passing play. Route
  is greyed for Blockers and for the Runner who takes a handoff.
- **The routes** (b2), in yards from where the player stands, for a player
  on the right: Go, 16 straight up; Slant, 2 up then in to 12; Out, 5 up,
  out 5 and up to 14; Post, 8 up then in to 16; Corner, 8 up then out to 16;
  Curl, 10 up and back. Each keeps the rules every play keeps
  (`playProblems`, `content/playRules.ts`).
- **Which way is out** (b3): toward the player's own sideline; a player
  lined up in the middle counts as on the right, or on the left with Flip.
- **Flip and cards** (b4): Flip mirrors hot routes and keeps them; calling a
  card, another or the same one, drops them all.
- **Free** (b5): any number of changes, until HIKE!.
- **Recorded** (b7): a hot route is a game action, like calling a card, so a
  recorded run replays it and the play log says who took which.

## The order of work (a4)

1. `player-menu`: the strip, its three greyed slots and the dev setup
   switch. Nothing plays differently.
2. `menu-routes`: hot routes; Route works, and the switch goes.

Each is tested first, reviewed, and merged once the user has tried it.

## Tests, written first

### `player-menu` (c2)

1. The switch: Player menu on the dev setup page, off by default, read like
   the other switches (the link over the saved setup over the defaults,
   `?menu=1`), and Copy link writes it. Practice ignores it, as it ignores
   the rest of the setup.
2. When it shows: with the switch on, selecting one of your seven before the
   snap shows the strip; ✕, a tap elsewhere and HIKE! clear it, as they
   clear the card. With the switch off it never shows.
3. What it holds: Route, Perk and Audible, all greyed in this slice; a tap
   on one does nothing and sends nothing to the game.
4. Nothing plays differently: the seeded-run digests and the balance reports
   match, with the switch on or off.

Then a headless look at the strip on the served build.

### `menu-routes` (c3)

1. Who: Route works for Catchers and a Runner on a passing play; greyed for
   Blockers and the Runner who takes a handoff.
2. The loop: each tap moves to the next route (as drawn, Go, Slant, Out,
   Post, Corner, Curl, as drawn), skipping any that would leave the field.
3. The routes: each, from every spot it's offered at, keeps `playProblems`;
   Out goes toward the player's own sideline, a left and a right player
   mirror each other, and the middle counts as right, or left with Flip.
4. They run it: after HIKE!, the player follows the hot route's waypoints.
5. Flip and cards: Flip mirrors hot routes and keeps them; calling another
   card, or the same one, drops them all.
6. One down: next down the card plays as drawn.
7. Free until HIKE!: any number of changes before the snap, none after.
8. Recorded: a recorded run replays to the same result, and the play log has
   a line saying who took which hot route.
9. Balance unchanged: the bots never use it, so the reports match.

## As built

### `player-menu` (2026-11-11)

- **The switch** (`src/arcade/content/runOptions.ts`): `playerMenu`, flag
  `menu` (`?menu=0|1`, or `on`/`off`), off in `RUN_DEFAULTS`; a toggle,
  Player menu, under On the field on `dev/setup.html`. It is the HUD's, not
  the game's: `RunSwitches` leaves it out, so `createRun` never sees it.
  Like every switch, a run's record and play log name it when the saved
  setup supplied it (`docs/DEV_SETUP.md`, q3).
- **The strip** (`src/arcade/ui/playerMenu.ts`, `playerMenu(on, selected)`):
  null with the switch off or nobody selected, otherwise the slots `route`,
  `perk` and `audible` (a union, so slice 2 can tell Route apart; the HUD
  gives their labels), each `works: false`. The game passes the selection
  as it shows (`selectionNow`, null but before the snap, `beforeSnap`), so
  HIKE!, the intro, the outro and a pause hide the strip. ✕ and a tap on
  the field change the selection through one function, `selectionAfter`
  (`ui/select.ts`), so the strip goes with the card.
- **On screen** (`Hud.setPlayerMenu`, `.hud-menu` in `src/ui/hud.css`):
  three bone buttons with ink edges, as the play cards and Flip are, in the
  hand's three columns, about 10px above the cards (4px past `.hud-bottom`'s
  6px top padding). It is placed over the field,
  out of the HUD's flow, so the cards and the camera's fit never move. A
  greyed slot is the banned card's grey and is a disabled button: a tap does
  nothing and sends nothing to the game. The strip takes taps
  (`interactive`), so a tap on it doesn't reach the field or clear the
  selection: checked in a headless browser (Hollis selected, then a tap on
  Route; the card and the strip stay), since that depends on what's under
  the finger, which a unit test can't see.
- **Tests:** `tests/arcade/playerMenu.test.ts` (c2 1–4) and
  `tests/ui/playerMenu.test.ts` (the HUD's strip, 2 and 3); the every-switch
  fixtures in `runOptions.test.ts`, `devSetup.test.ts` and
  `setupPage.test.ts` grew the new switch.
- **Nothing plays differently:** the six balance scenarios, 8 runs each, on
  `player-menu-plan` (b0dfb5e) and on this branch gave identical reports,
  byte for byte, and the seeded-run digests pass unchanged.
- **The headless look** (phone size, seed 3, a local build of the branch,
  not the served one): the strip with Hollis Hollow selected, none with
  nobody selected, and none with the switch off. It sits on the empty turf
  above the cards and covers nothing.
- **Review:** first inline (the fork that built it can't start reviewers),
  which changed the greyed text's colour to `color-mix`, as the rest of
  `hud.css` writes it. Then the two-axis review, with separate reviewers:
  ✕ and the field taps tested through `selectionAfter`, which the game now
  calls; a seeded-run digest with the switch on and off; the slots as a
  union; this section's distances and comments corrected.
