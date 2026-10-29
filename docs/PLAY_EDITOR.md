# The play editor

A dev page for drawing plays on a phone, trying them in the game and keeping
the good ones. Planned by grilling on the decision map
(https://claude.ai/artifact/NPXDWvYYwQKcPhukLtXpnL), rounds 1–3, 2026-10-29 (all approved);
the item numbers below are the map's. Words are as in [`CONTEXT.md`](../CONTEXT.md).

## What it is

- **A dev page, `/dev/plays.html`** (e1), beside the model viewer and the
  sound board: in the normal build, left out of `build:release`. It's for the
  Coach to author plays, not part of the game loop.
- **Drafts live in the phone's browser** (e2, e13). The page opens on a list:
  your drafts, each with its state ("1 problem", "ready to copy"), then Blank
  play and a copy of each existing play. Deleting a draft asks first, on the
  page. esrauch's plays are never changed in place; a copy is a new draft
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
- **Rules** (e4, e12): one function, beside `plays.ts`, checks the three play
  rules and returns each problem with its slot and a sentence saying how to
  fix it. The tests and the editor both use it. A broken route is red, its
  chip has a red edge, and a bar under the field shows the first problem
  ("+2 more" if there are others). Copy code is greyed and counts the
  problems; Try it always works.
- **Flip** (e15) previews the play mirrored, as the game flips it; editing is
  off while mirrored.
- **Try it** (e3, e14) opens the game in the same tab with the draft in the
  link and the "Try with" settings from the drafts list (hard and two-tap on
  by default). The draft is one of the three cards every down, marked DRAFT;
  the other two are dealt from the play pool as usual. Back returns to the
  editor. A broken or tampered link opens the game with a visible message.
  On the Queen's drive her Royal Decree bans one of the other two cards,
  never the draft (e18).
- **Copy code** (e2, e16) puts the play on the clipboard in esrauch's style
  (`route([x, y], …)`). Pasted to Claude, it goes into
  `src/arcade/content/ourPlays.ts`, which joins esrauch's `plays.ts` to make
  the play pool. His file stays untouched.

## What changes in the game

- **A run carries its own playbook** (e3): `RunState` holds the plays it can
  deal, and the sim reads plays from there instead of from `PLAYS`. With the
  play pool as the playbook and the same seed, every deal is the same as
  before, so balance is unchanged. This is also what plays as rewards needs.
- **A tried draft is in every hand,** at a seeded position among the three.

## Tests, written first (e17)

1. **Play rules:** each rule reports its slot and sentence; a legal play
   reports nothing; every play in the pool passes. Replaces the three checks
   in `tests/arcade/plays.test.ts` (and its "four plays" title, B1).
2. **Playbook in the run:** a run deals only from its playbook; with the pool
   and a fixed seed, deals match today's.
3. **Trying a draft:** a run started with a draft deals it in every hand,
   flipped or not; a handoff draft hands off to its Runner; the decree never
   bans it.
4. **The draft link:** a play survives the trip into the link and back; a
   broken link gives a visible message and no draft.
5. **Copy code:** what it writes, read back as a play, equals the draft.
6. **The editor's logic** (no screen): add, move, snap, remove and undo
   waypoints; pick the handoff; the mirrored view.

## Not in v1

Where players line up, route timing and speeds (e5, parked in `PLAN.md`);
placing pickups; sharing plays other than by Copy code.
