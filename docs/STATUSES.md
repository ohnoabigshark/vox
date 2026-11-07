# Statuses

A **status** is a condition a body carries for a while, which the rules
read wherever they need it: Ethereal, Slowed, Fast. Anything can give one,
whether a field event, a pickup, or later a perk, a tap test or a Boss, and
the rules never ask what gave it. That makes a status a part that composes:
the taffy flood is a field event whose spell gives Slowed to everyone, and
the lightning bolt is a pickup that gives Fast to whoever takes it.

_User, 2026-11-06: "the ethereal effect, that's a status/effect that can be
applied to players (potentially more objects in the future) generally, the
idea being that future blessings/hexes/mischiefs or other game interactions
could trigger it. or perhaps if we added a perk that triggered it on a
single player when they get tackled. we want to start designing some of
these features as composable so they can be applied in more ways than just
their initial implementation."_

Planned on the field events map, round 2
(https://claude.ai/artifact/1H2idLc7kQhhn3quA7TshS, 2026-11-06, s1–s10, all
approved). The item numbers below are the map's. The field events that use
statuses, the taffy flood and the will-o'-wisps, are in
[`FIELD_EVENTS.md`](FIELD_EVENTS.md), round 5.

## The parts

| Part       | What it is                                                                 |
| ---------- | -------------------------------------------------------------------------- |
| **Status** | a condition on a body for a time: Ethereal, Slowed, Fast                   |
| **Source** | what gives a status: a field event, a pickup; later a perk, a tap test, a Boss |
| **Who**    | yours, theirs or everyone                                                  |
| **Kind**   | blessing, hex or mischief, worked out from the status and who it lands on  |

## What a status is (s1)

Each body keeps a list of the statuses it has, each with the time it has
left. The first three:

- **Ethereal:** it can't be grabbed or tackled; defenders run through it
  without a shove; drawn see-through. Built with the wisps.
- **Slowed:** top speed times a share, half by default. Built with the
  taffy flood.
- **Fast:** top speed times 1.5. The lightning bolt's, moved onto statuses
  first (s2).

The rules ask the body, never the source: "is it Ethereal?", "what's its
top speed after its statuses?".

## What moves onto it now, and what doesn't (s2)

- **The bolt's speed becomes Fast,** as a pure refactor: the same seed gives
  the same run, event for event, and `balance:compare` gives the same report.
  It was its own field on every body, `boltLeft`.
- **Lying on the turf stays as it is** (`down` on every body). It's how a
  tackle, a pancake, a slick, Frog Rain and Break it!'s drag all leave a
  body, so it's the body's own state, not a condition given to it. A source
  can still knock a body down: that's a **knockdown**, a field event's
  flatten, beside giving a status. _User: "Leave lying down for now. We will
  see how everything fits together on a later pass and maybe refactor
  again."_ (In `PLAN.md`, "Left for a later refactor".)

## Stacking (s3)

- The same status given again keeps the **longer** time left, not the sum:
  two bolts in a row are still 3 s of Fast (the bolt's way today).
- Speed statuses **multiply:** Fast and Slowed together are 1.5 × 0.5 = 0.75
  of top speed.
- A spell's status (the taffy, the wisps) lasts while the body is in its
  area and the spell is on, and ends as it steps out.
- Ethereal stops new grabs and tackles; a defender already hanging on stays
  on.

## Blessing, hex or mischief (s4)

Each status either **helps** the body that has it or **hurts** it, and so
does a knockdown. A source's kind follows from that and who it lands on, by
one rule, for field events and pickups alike:

|                             | on yours | on theirs | on everyone |
| --------------------------- | -------- | --------- | ----------- |
| helps (Fast, Ethereal)      | blessing | hex       | mischief    |
| hurts (Slowed, a knockdown) | hex      | blessing  | mischief    |

Checked: the taffy (Slowed, everyone) is mischief, the wisps (Ethereal,
yours) a blessing, Frog Rain (a knockdown, everyone) mischief, the bolt
(Fast, either side) mischief.

## Sources (s5)

One shape, "give status S to these bodies, for this long", used by field
events (a burst: for a time; a spell: while they're in it) and pickups (the
bolt). Perks, tap tests and Boss powers use the same shape when the first of
them needs it. There are no **triggers** ("when this player is grabbed", "on
a GREAT") until something uses one; they're in `PLAN.md`, "Left for a later
refactor".

## Who has them (s6)

Bodies only for now: your players and the defenders. The status list holds
nothing only a body has, so the ball, a pickup or a prop can carry one
later. Field events still spare Jack before he runs (`FIELD_EVENTS.md`, x3).

## How it shows (s7)

Each status draws its own look on the body, whatever gave it: Ethereal
see-through, Fast the bolt's sparks (as today), Slowed a heavy, dragging
step. A source may add its own touch on top, such as the taffy's strings.
You learn a status once and know it everywhere.

## The sim says so (s8)

The sim reports a status gained and a status ended: who, which status, what
gave it. The sounds, the play log and the record see them; achievements can
count them later.

## Order of work (s9)

Three branches, each tests first, reviewed and merged before the next; the
last two played by you before they merge:

1. **`statuses`:** the status list on bodies; Fast, with the bolt moved onto
   it and no change in play; stacking; the kind rule; the reported events.
2. **`field-taffy`:** Slowed, spells, a field event giving a status, generic
   events picked per stretch, and the taffy flood (`FIELD_EVENTS.md`).
3. **`field-wisps`:** Ethereal and the wisps.

### `statuses`' tests, written first

1. **The bolt as Fast:** a seeded run gives the same events, step for step,
   as before; a bolt taken gives Fast for its 3 s, at 1.5 × top speed, on
   either side.
2. **Stacking:** the same status twice keeps the longer time left. (Two
   speed statuses multiplying is tested with Slowed, on `field-taffy`:
   until then Fast is the only one.)
3. **The kind rule:** the table above, for each status and each who.
4. **Reported:** gaining a status and its running out are each one event,
   naming the body, the status and its source.

## What could compose next (s10)

Written down, none built; each comes back as its own map:

- **A pickup as a tiny field event:** a circle, taken on touch, giving a
  status: the slick a knockdown, the bolt Fast.
- **Tap-test grades as sources:** a GREAT gives Fast for a moment.
- **Rare tap tests with stronger effects:** _user's note on s5: "It would be
  cool if we had certain special/rare quick events that could trigger more
  powerful effects."_
- **Perks with triggers:** a player who's grabbed turns Ethereal for a
  moment and slips free.
- **Boss powers from the same parts:** Thanksgiving's rat and its chewed
  card (two players slip at the snap), Biscuit's bite.
- **Statuses on the ball and on pickups** (s6).

## As built (2026-11-06, branch `statuses`)

- **The code:** `sim/status.ts` gives, wears and reads statuses
  (`giveStatus`, `wearStatuses`, `hasStatus`, `speedShare`); which there
  are, whether each helps or hurts, and `kindOf` are `content/statuses.ts`.
  Each body's list is `statuses` (`sim/types.ts`), each with its time left
  and its source. Field events' `eventKind` goes through `kindOf`, a
  flatten (a knockdown) hurting.
- **The numbers:** Fast's speed-up moved from `pickups.bolt.faster` to
  `statuses.fast.faster` (0.5); the bolt keeps how long, `pickups.bolt.time`
  (3 s).
- **Wearing off** happens where the bolt's did, each body's in `moveBodies`,
  so statuses don't wear down while play stands still for Break it! or a
  catch test, as the bolt didn't.
- **At the whistle:** each down lines up new bodies, so a status still on
  then ends there, unreported: the play log shows its `statusGained` and no
  `statusEnded`.
- **Every give is reported** (the review's r2, the user's "I think we
  should report every give"): `statusGained` carries `changed`, false when
  the body already had the status for longer and kept that time and source.
  `statusEnded` names the source too (r1).
- **The kind's type** is `SourceKind`, in `content/statuses.ts` with `Who`
  and `kindOf` (r3): it names a field event's or a pickup's kind alike.
- **Review:** https://claude.ai/artifact/6hsrTkzrfbGh7r2nwNo7jS (r1–r4
  fixed; l1, a status on at the whistle ending unreported, left for
  `field-taffy`'s tests; l2 left).
- **The same run:** four hard-mode runs, driven by their seeds alone, give
  the same events and positions, step for step, as on `main`
  (`tests/arcade/statusesSameRun.test.ts`, digests taken on `main`
  adb458b; a bolt 5% slower fails it). `balance:compare` (10 runs a
  scenario, main adb458b against 3ec7de3) gives the same report in all six
  scenarios, line for line.

## As built: `field-taffy` (2026-11-07)

- **Slowed** is the second status: top speed times `statuses.slowed.share`
  (0.5). With Fast, the two multiply to 0.75 (`speedShare`).
- **`statusPolarity`** is back in `content/statuses.ts` (Fast helps, Slowed
  hurts), now that a field event gives a status; `eventKind` reads it.
- **A source** is a pickup or a field event, by id; `sameSource` in
  `sim/status.ts` is the one place two sources count as the same.
- **`endStatus`** ends a status before its time, reported, but only the one
  from the source named: if another source's took its place (s3), it stays.
  A spell uses it as a body steps out or the spell ends.
- **A spell and a timed status of the same name:** a body that already had
  Slowed for a while from elsewhere and steps into the taffy takes the
  spell's (the longer), and stepping out ends it, losing what was left of
  the other. Nothing gives Slowed but the taffy yet (`PLAN.md`, "Left for a
  later refactor"). One whose own is longer keeps it, and the spell doesn't
  give it again each step: a give that would change nothing isn't made
  (`givingChanges`, taffy review r2).
- **Which a field event may give** is `EventStatus` in
  `content/statuses.ts`: Slowed, for now (taffy review r3). Fast stays the
  bolt's; the wisps add Ethereal.
- **How Slowed shows** (s7): `render/bodies.ts` gives any Slowed body a
  slow, deep bob, leaning into it. Fast's sparks are still drawn with the
  pickups (`render/pickups.ts`); see `PLAN.md`.
- **Test 5b** (statuses review, l1): a body stepping out of the taffy while
  it's on gets `statusEnded`, naming the taffy.

