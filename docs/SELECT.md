# Selecting a player

Before the snap, tap one of your seven to see who they are, what their
route is and how they're growing; and a switch for the names on the field.
Planned on the map https://claude.ai/artifact/8PEvNHSLuK3X92urZb2usp
(round 1, all approved 2026-11-05). It follows names on the field
(`docs/REWARDS.md`, notes p6) and B7 (`docs/BUGS.md`). _User: "pressing on
a player selects them and highlights just their route and shows a lil card
about that player that pops up somewhere near the top of the screen"._

## What it does

- **The names switch** (n1-n3): a small **Aa** button in the top right,
  left of ⚑, before the snap only. It shows or hides the names of your
  seven. It starts on, and the phone remembers it (`src/settings.ts`).
- **Selecting** (s1): before the snap, a tap on or near one of your seven
  (the nearest, within about a thumb's width on screen) selects them. A
  tap on them again, on Jack, on a defender or on empty field, or ✕ on
  their card, clears it; so does HIKE!. One at a time. It stays through
  calling another card and through Flip: it is kept as the roster slot,
  which the same player keeps (`lineUpTeam`).
- **Their route** (s2): bright and a little bigger; every other route
  dimmed. A Blocker has no route, so every route dims.
- **Their card** (s3): at the top, under ⚑ and the downs, in place of
  "Pick a play": Your team's player card, a little smaller (photo, name,
  kind and position, the three bars with the key stat's orange label and
  the green growth since the last TRICK OR TREAT!), with ✕.
- **Together** (s4): the switch decides only whether the other names
  show; a selected player's name always shows, at the front and bigger.
- Selecting is drawing only, not a sim action: it never changes a play,
  the record or the play log.

## Tests (n6), written first

1. `nameTags`: all seven with the switch on; none with it off; with a
   player selected, theirs is marked selected and shows even with the
   switch off; none after HIKE!.
2. The hit test picks the nearest of your seven within reach, and nothing
   for a tap out of reach of all of them; Jack and defenders are never
   picked, and a tap on them picks nobody, even with one of your seven
   within reach (tested at the game's reach, on a phone's scale).
3. Selecting: a tap on a player selects them; on the same one again, or on
   nothing, clears it; on another moves it.
4. The selection survives calling a card and Flip (the same roster player),
   and is gone once the phase isn't setup.
5. Routes: with a player selected, theirs is bright and the rest dim; with
   nobody selected, all as today. Also as drawn (`routesDrawn.test.ts`,
   review x11): the selected route in the big dots, a Blocker dimming them
   all, and a handoff's ring dimming with its route.
6. The card: name, kind, position, stats with the key stat and the gains,
   the same as Your team's for that player.
7. The setting saves and loads, defaulting to on, and an old saved setting
   without it reads as on.

Then the game is looked at running in a headless browser before it's handed
over: the check B7 lacked.

## As built (2026-11-05, `player-select`)

- `ui/select.ts`: the hit test (`fieldPoints`, `slotAt`), over every body
  on the field, so a tap nearest Jack or a defender is on nobody (review
  x1); what a tap does
  (`tapSelect`), `keptSelection` (only before the snap) and `routeLook`;
  `selectedCard` is Your team's card through `fieldCard` in
  `ui/trickOrTreat.ts`, which Your team's rows share.
- The game listens for a press on the canvas before the snap (the HUD lets
  taps through, `#ui`); the reach is 40 CSS pixels from a body's middle
  (`TAP_REACH` in `ui/select.ts`, `BODY_MIDDLE` in `game.ts`).
- Routes dim to 30% of their opacity; the selected route uses the big dots
  and arrow, as the handoff Runner's does. On a handoff the ring dims with
  its route.
- The card is the roster card's dark panel, not the bone of the mockup, so
  it matches Your team. The HUD's pixel font draws **Aa** as "AA".
- Checked in a headless browser on the served build (seed 3): selecting,
  the switch off, ✕, and HIKE! clearing it all.
