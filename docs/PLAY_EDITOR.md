# The play editor

A dev page for drawing plays on a phone, trying them in the game and keeping
the good ones. Planned by grilling on the decision map
(https://claude.ai/artifact/NPXDWvYYwQKcPhukLtXpnL), rounds 1–3, 2026-10-29 (all approved);
the item numbers below are the map's. A play being drawn is a **sketch** (g7;
it was "draft" when built). Words are as in [`CONTEXT.md`](../CONTEXT.md).

## What it is

- **A dev page, `/dev/plays.html`** (e1), beside the model viewer and the
  sound board: in the normal build, left out of `build:release`. It's for the
  Coach to author plays, not part of the game loop.
- **Sketches live in the phone's browser** (e2, e13). The page opens on a list:
  your sketches, each with its state ("1 problem", "ready to copy"), then Blank
  play and a copy of each existing play. Deleting a sketch asks first, on the
  page. esrauch's plays are never changed in place; a copy is a new sketch
  (e6).
- **One screen holds the whole play** (e8): name and Flip on top, the field
  from behind the line to the throw-reach line (28 yards) at about 15 px a
  yard, then the slot chips, the Handoff row and the two buttons.
- **Slots** are named by their order in `LINEUP`, which is also how the
  chips are laid out: B1, B2 (the Blockers, never editable), R1, R2 (the
  Runners), C1 (left outside), C2 (right outside), C3 (the inside slot, right
  of centre). C2 and C3 are not in left-to-right order on the field; the
  mockup's caption said they were.
- **Drawing** (e9, e10): pick a player by tapping it or its chip; each tap on
  open field adds the next waypoint; drag a waypoint to move it, with its
  yards from the line-up shown while dragging; tap a waypoint, then Remove.
  Undo steps back through every change. Waypoints snap to the half yard; a
  copied play keeps its exact numbers until a point is moved.
- **Handoff** (e11): a row of None, R1, R2. The chosen Runner's route is the
  run's path, drawn gold. The Catchers keep their routes as decoys.
- **Rules** (e4, e12): one function, `playProblems` in
  `content/playRules.ts`, checks the three play rules and returns each
  problem with its slot and a sentence saying how to fix it. Rule 2 also
  covers a Runner or Catcher left blocking, and rule 1 a route with no points
  yet. The tests and the editor both use it. A broken route is red, its
  chip has a red edge, and a bar under the field shows the first problem
  ("+2 more" if there are others). Copy code is greyed and counts the
  problems; Try it always works.
- **Flip** (e15) previews the play mirrored, as the game flips it; editing is
  off while mirrored.
- **Try it** (e3, e14) opens the game in the same tab with the sketch in the
  link and the "Try with" settings from the sketches list (hard and two-tap on
  by default). The sketch is one of the three cards every down, marked DRAFT;
  the other two are dealt from the play pool as usual. Back returns to the
  editor. A broken or tampered link opens the game with a notice across the
  top, until tapped, and no sketch.
  On the Queen's drive her Royal Decree bans one of the other two cards,
  never the sketch (e18).
- **Copy code** (e2, e16) puts the play on the clipboard in esrauch's style
  (`route([x, y], …)`). Pasted to Claude, it goes into
  `src/arcade/content/ourPlays.ts`, which joins esrauch's `plays.ts` to make
  the play pool. His file stays untouched.

- **Kept and shown:** sketches are stored as their link text, so they're read
  back with the same checks as a Try it link; an unreadable one, or a browser
  that keeps nothing, is reported on the list. The Try with settings are
  remembered too. A problem (a failed save, a refused clipboard) stays at the
  top of the screen until tapped, clear of the buttons. Renaming isn't a step
  for Undo; every letter would be one.

## Where it lives

- `dev/plays.html`, `src/dev/playEditor/page.ts` and `page.css`: the page.
- `src/dev/playEditor/editor.ts`: what each tap does, with no screen.
- `src/dev/playEditor/sketches.ts`: sketches in localStorage.
- `src/arcade/content/playRules.ts`, `playCode.ts`, `ourPlays.ts`,
  `playPool.ts`: the rules, the link and Copy code, our plays, the pool.

## What changes in the game

- **A run carries its own playbook** (e3): `RunState` holds the plays it can
  deal, and the sim reads plays from there instead of from `PLAYS`. With the
  play pool as the playbook and the same seed, every deal is the same as
  before, so balance is unchanged. This is also what plays as rewards needs.
- **A tried sketch is in every hand,** at a seeded position among the three
  (`RunState.trial`, its index in the playbook), with a DRAFT ribbon on its
  card.

## Tests, written first (e17)

1. **Play rules:** each rule reports its slot and sentence; a legal play
   reports nothing; every play in the pool passes. Replaces the three checks
   in `tests/arcade/plays.test.ts` (and its "four plays" title, B1).
2. **Playbook in the run:** a run deals only from its playbook; with the pool
   and a fixed seed, deals match today's.
3. **Trying a sketch:** a run started with a sketch deals it in every hand,
   flipped or not; a handoff sketch hands off to its Runner; the decree never
   bans it.
4. **The sketch link:** a play survives the trip into the link and back; a
   broken link gives a visible message and no sketch.
5. **Copy code:** what it writes, read back as a play, equals the sketch.
6. **The editor's logic** (no screen): add, move, snap, remove and undo
   waypoints; pick the handoff; the mirrored view.

## Not in v1

Where players line up, route timing and speeds (e5, parked in `PLAN.md`);
placing pickups; sharing plays other than by Copy code.
