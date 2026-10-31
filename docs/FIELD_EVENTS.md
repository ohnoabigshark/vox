# Field events

Things that happen on the field during a down, good or bad: an area, a
moment it goes off, a warning before it does, and an effect on whoever is
in it. Frog Rain, Mister Frog's gimmick, is the first. Planned by grilling
on the decision map (https://claude.ai/artifact/9gtEaZxi3ypfNU4bfLRevA),
2026-10-31, three rounds, all approved but f5 and f8 (rejected) and f6
(changed by the Coach's note); the item numbers below are the map's.

Times are on screen, as in `GAMEPLAY.md`; the sim runs at 0.8 of that, so
`content/fieldEvents.ts` holds each one times 0.8.

## What a field event is (f1, p1–p5)

- **Four parts** (f1): an **area** on the field, when it **goes off**, a
  **warning** before it does, and an **effect** on whoever is in it.
  "Event" alone is taken: `ArcadeEvent` is everything the sim reports.
- **The area** (p1): a **lane** (down the field), a **band** (across it) or
  a **circle**, measured in yards from the line of scrimmage, so it lands
  the same distance upfield on every down. Across the field it sits on the
  **left**, in the **middle**, on the **right**, or on **either** side,
  picked from the seed each down (Frog Rain's way, so you look before you
  call a play). A lane or band on the left or right runs in from that
  sideline.
- **Going off** (p2): a set time after the snap, as a **burst**, which
  hits whoever is in it at that moment for a while (Frog Rain: flat for
  1.5 s, in the lane or not by then), or a **spell**, which lasts a while
  and affects whoever is in it as long as they are (taffy, wisps).
- **The warning** (p3): the area shows faintly from before the snap, so
  you can call a play or Flip around it, then the event's own **build-up**
  for a set time before it goes off. The editor sets how long; the art is
  each event's own, made in code (f5). _User: "Some events can be a surprise
  but we won't implement that yet, let's just plan for that to be
  possible."_ The warning is its own part of an event's data, so "hidden
  until the build-up" can be added to it later without touching the rest.
- **The effect** (p4): **flatten** (knocked down for a time; a carrier is
  tackled there), **slow** (moving at a share of their speed), or
  **ethereal** (see-through, can't be grabbed or tackled, defenders run
  through), on **your players**, the **defenders**, or **everyone**.
- **Blessing, hex or mischief** (f1, p5): an event that can only help you is
  a **blessing**, one that can only hurt you a **hex**, one that can do both
  **mischief**. Worked out from the effect and who it hits: flatten or slow
  on everyone is mischief, on your players a hex, on the defenders a
  blessing; ethereal on your players a blessing. _User: "Mischief is a
  great third word love it."_ Nothing on the field says which (f5:
  _"Events keep their own themed colors/initial graphics and you have to
  learn whether they are good and bad."_); the editor shows the word.

## What every event keeps of Frog Rain (x3)

- **Spared:** a flatten never knocks down Jack before he runs, nor a
  defender locked up with one of your players (a Rhino Beetle, `planted`).
- **The call:** an event that tackles a carrier names its call (Frog
  Rain's is **FROGGED!**).
- **Steering:** while an event that would flatten or slow the carrier is
  still to go off, the carrier picks lanes away from its area, as it keeps
  out of Frog Rain's lane today. It doesn't steer toward a blessing yet.

## In a run (f4, n1, n2)

- **Frog Rain stays Mister Frog's** (f4), on every down of his drive.
- **Generic events** (n1, n2): from drive 2, about one ordinary drive in
  three (never a Boss's) gets one, picked from the run's seed, on every
  down of that drive. Wisps and the taffy flood are generic. _User: "We will
  have generic ones and boss specific ones eventually."_ This comes with
  the taffy branch, when the generic pool gets its first event (x1).

## Keeping them (k1)

- **The defaults** are data in `src/arcade/content/fieldEvents.ts`, Frog
  Rain the first.
- **Save** on the editor writes the changes and any new event to
  `src/arcade/content/saved-events.json` through the hot-reload server, as
  the bench writes `saved-tuning.json`; the game lays them over the
  defaults as it loads. The tailnet game plays them once committed.
- **Restore defaults** puts an event back to its code. Making a saved event
  a default (so it ships in a release) is moving it into `fieldEvents.ts`,
  on request.
- **A saved event that can't be read** is left out with a warning, on the
  editor's list and as a notice in the game: never silently.

## The editor (f2, f3, x1, x2)

- **`/dev/events.html`** (f2), built like the play editor: a dev page,
  listed on Dev tools. It opens on **the list**: each event with whose it is
  (a Boss's, or generic), its kind (blessing, hex or mischief) and whether
  it's saved off its default; then New event.
- **The field** is the play editor's, about 15 px a yard, with the line, the
  first-down line and the line-up drawn. Drag the area to move it and its
  handles to size it, snapping to the half yard; a bar under the field says
  where it is in yards while you drag. Each change is one step for Undo.
- **The parts** below the field: the shape and side, when it goes off,
  burst or spell and how long, the build-up, the effect and who it hits.
  The kind's word sits by the name.
- **What it offers** (x1): only what the game can play. The first branch
  has all three shapes, burst and flatten; spell and slow come with the
  taffy branch, ethereal with the wisps. An event made on the first branch
  plays in Try it; it reaches a run with the taffy branch. An event made on
  the editor has a plain look (its area outlined, a pulse for its build-up)
  until it's given art of its own.
- **Try it** (f3, x2) opens practice, as the play editor's does: rep after
  rep from the same spot, the usual three cards to pick from each time,
  against the defense of a drive you choose, with the event going off every
  down; ‹ Events goes back between reps. The link carries the event itself,
  so it plays what's on the editor before Save, and the drive and the
  throwing (Try with two-tap or one).

## The new events (f6, f7, w1, t1, o1)

On their own branches, after this one: the taffy flood first, then the
wisps (o1).

- **Taffy flood** (f7, t1): mischief. A band across the whole field, 6 to 9
  yards ahead; it goes off 1 s after the snap and lasts 2 s; everyone in it
  moves at half speed. Pink candy ground, bubbling in its build-up; whoever
  is in it trails strings of taffy.
- **Will-o'-wisps** (f6, w1): a blessing. A circle about 4 yards across, 12
  yards ahead on either side; it goes off 1 s after the snap and lasts 3 s;
  your players in it are ethereal. _User: "Will o wisps should make an
  offensive player untackleable when in the area. Like a wisp is ethereal
  so it can make the player semi transparent when in it and defenders run
  through them."_ Pale green lights hovering from before the snap,
  brightening in the build-up.

## Tests, written first (u2, u4)

This branch (u2):

1. **Frog Rain plays exactly as now** as the first field event: its lane (a
   side from the seed, a yard behind to 16 ahead, 40% of the width), the
   frogs at 2.0 s, shadows for 0.9 s before, everyone in it flat 1.5 s, a
   carrier FROGGED!, Jack and a locked-up Rhino Beetle spared, the carrier
   steering clear. Today's Frog Rain tests pass unchanged in what they
   check.
2. **Areas:** a lane, a band and a circle each take in the points they
   should, measured from the line, on the left, middle, right, or either
   side from the seed each down.
3. **A burst** of any shape flattens whoever is in it as it goes off, on the
   side it names, and nobody else.
4. **The kind:** blessing, hex or mischief, from the effect and who it hits.
5. **Saved events:** laid over the defaults; a new one added; one that
   can't be read left out with a warning; Restore drops one back.
6. **Save:** the endpoint writes `saved-events.json` and answers errors in
   their own words, as the bench's Save does.
7. **The editor:** dragging moves the area and its handles size it,
   snapping to the half yard, with the yards shown; each change one step
   for Undo; changing the shape keeps the area where it was.
8. **Try it:** the link carries the event, the drive and the throwing;
   practice deals three cards each rep, plays that drive's defense, sets
   the event off every down, and ‹ Events opens the editor on it.

Checked by hand too, in a phone-sized browser: the editor drawn, a drag,
Try it to practice and back.

The later branches (u4):

- **Taffy:** a spell holds whoever is in it while it lasts and lets go as
  they leave; slow moves them at the share set, yours and theirs; it shows
  before the snap; from drive 2, about one ordinary drive in three gets a
  generic event from the seed, the same for the same seed, never a Boss's
  drive, every down of it; the editor offers Spell and Slow.
- **Wisps:** your players in it are ethereal: no defender grabs them (no
  Break it!), defenders pass through without a shove, a ball still reaches
  them; one already grabbed stays grabbed; leaving the circle ends it;
  defenders are never ethereal from it; the editor offers Ethereal.

## Order of work (o2, u3)

Three branches, each reviewed and merged before the next: this one, the
taffy flood, the wisps. Gravestones are planned apart (`PLAN.md`).

On `field-events`, one commit each, typecheck and tests after every step:

1. This plan, with `CONTEXT.md` and `PLAN.md`.
2. Frog Rain as the first field event (`content/fieldEvents.ts`,
   `sim/fieldEvents.ts`), with no change in play.
3. Areas of every shape and side, and bursts that flatten any of them.
4. Saved events over the defaults, and the Save endpoint.
5. The editor page: the list, the field, the parts, Undo.
6. Try it: event practice.
7. The docs reconciled; then the review, the PR and the merge. Then the
   Coach tunes Frog Rain with Save.
