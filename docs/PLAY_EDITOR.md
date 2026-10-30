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
- **Try it opens practice** (round 4, t1–t6, replacing e3's in-game trial,
  e14 and e18): the field straight away, with no PLAY screen, intro or other
  cards. The sketch is the only card, already called, so its routes show;
  HIKE runs a **rep**. When the play ends, the result shows for the usual
  moment, then the next rep lines up at the same spot: 1st & 10 from the same
  line, the same defense, the sketch called, Flip as it was left. No drives,
  no TRICK OR TREAT!, no Game Over. A browser plays no sound until the page is
  tapped, so the first tap (HIKE, Flip or the card) starts the sound and the
  music; t1 said the first HIKE, and any first tap does the same job.
- **The defense** (t3) is Froggy's Forest's first drive, the one a run
  starts against. Hard mode changes nothing there, so "Try with" has only
  Two-tap.
- **‹ Sketch** (t4), top left between reps (before HIKE and while a result
  shows, not mid-play), opens the editor on the sketch. The practice link
  carries the sketch's key for it. A broken or tampered link opens the
  ordinary game with a notice across the top, until tapped.
- **Where players line up** (round 5, l1–l7, 2026-10-30): each play carries
  its own line-up, and a play without one uses the standard line-up
  (`LINEUP`), so esrauch's plays, older sketches and old links are unchanged.
  Drag a Runner or Catcher to move it: it snaps to the half yard and shows how
  far it is from the middle and from the line while you drag. A touch that
  moves less than half a yard is a tap. Blockers can't be moved or picked
  (l1). A move changes only the route's first leg: its waypoints stay where
  they are on the field (l4). Each move is one step for Undo. The drag stops
  at the line (half a yard behind it), the sidelines, and 6 yards back; two
  players less than a yard apart, or one on Jack, is a problem like a broken
  route (l5, the rule `lineUp`). Flip mirrors the line-up with the routes. A
  handoff Runner can line up anywhere for now (l6, parked).
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
- `src/dev/playEditor/sketches.ts`: sketches in localStorage; ones saved as
  drafts before the rename are read from the old key until the first save moves
  them.
- `src/arcade/content/playRules.ts`, `playCode.ts`, `ourPlays.ts`,
  `playPool.ts`: the rules, the link and Copy code, our plays, the pool.

## What changes in the game

- **A run carries its own playbook** (e3): `RunState` holds the plays it can
  deal, and the sim reads plays from there instead of from `PLAYS`. With the
  play pool as the playbook and the same seed, every deal is the same as
  before, so balance is unchanged. This is also what plays as rewards needs.
- **A practice run** (`createRun`'s `practice` option, `RunState.practice`):
  the sketch is its whole playbook and is called at every setup, and
  `nextDown` lines up the same spot again instead of moving on.

## Tests, written first (e17)

1. **Play rules:** each rule reports its slot and sentence; a legal play
   reports nothing; every play in the pool passes. Replaces the three checks
   in `tests/arcade/plays.test.ts` (and its "four plays" title, B1).
2. **Playbook in the run:** a run deals only from its playbook; with the pool
   and a fixed seed, deals match today's.
3. **Practice** (t7, replacing the in-game trial's tests): a practice run
   deals only the sketch, already called, at 1st & 10; after every kind of
   ending (a gain, a first down, incomplete, a sack, on any down) the next
   rep is 1st & 10 at the same line, the sketch called, Flip kept, never
   TRICK OR TREAT! or Game Over; a handoff sketch hands off to its Runner.
4. **The practice link:** a play and its sketch's key survive the trip into
   the link and back; a broken play gives a visible message instead of a
   play (the game then opens as usual, with no ‹ Sketch).
5. **Copy code:** what it writes, read back as a play, equals the sketch.
6. **The editor's logic** (no screen): add, move, snap, remove and undo
   waypoints; pick the handoff; the mirrored view.
7. **Sketches carry over** from the drafts key, once, never overwriting it.
8. **Line-ups** (l8): a play's line-up survives the link and Copy code (which
   writes it only when it differs from standard); a play without one reads
   as standard; a link with a bad one says why. The game and practice line
   players up where the play says, Flip giving the mirror picture, and the
   pool's plays line up as before. The `lineUp` rule: behind the line, inside
   the sidelines, no more than 6 back, a yard apart and off Jack, Blockers
   where they always stand; every play in the pool passes. The editor: a drag
   moves a Runner or Catcher, snapped and stopped at the limits, its
   waypoints staying put on the field; Blockers can't be moved; Undo puts it
   back.

## Not in v1

Route timing and speeds (e5), moving the Blockers (l1) and a handoff
Runner far from Jack (l6), all parked in `PLAN.md`;
placing pickups; sharing plays other than by Copy code.
