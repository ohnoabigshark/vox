# The tip drill

A second catch test beside SNAG IT!: the ball pops up off the receiver's
hands and the Coach taps as it drops back onto them, juggling it until it's
held. Planned by grilling on the decision map
(https://claude.ai/artifact/PHeREqJNv3izp9eLinmcz4), 2026-10-31, three
rounds, all approved but g4 (the name; the Coach kept "tip drill"); the
item numbers below are the map's. It was parked in `PLAN.md` as option C
of the SNAG IT! map. _User: "I've actually really enjoyed snag it and want
another catch tap event."_

Times are on screen, as in `GAMEPLAY.md`; the sim runs at 0.8 of that, so
`tuning.ts` holds each one times 0.8.

## When (t2, t3, g5)

- **A contested ball** (`docs/SNAG.md`, When) from drive 5 picks SNAG IT!
  or the tip drill at random, half and half, from the run's seeded random
  numbers, as Break it! picks among its three kinds. Before drive 5,
  contests are settled as they always were.
- **One setting says when both start:** `catchTests.fromDrive` (was
  `snag.fromDrive`).
- **`?tip=1`** makes every contested ball a tip drill from the first drive,
  as `?snag=1` does for SNAG IT!; with both, each picks at random from the
  first drive. The parked dev setup mode will replace these with switches.

## The drill (t1, t5, u1)

- **The freeze and the countdown** are SNAG IT!'s: the play stops with the
  ball a yard short of the receiver's hands, then the shared countdown
  (`countdown.ready`, 2 s), which says **GET READY FOR THE TIP DRILL!**
  (w1: "GET READY TO" and a noun doesn't read).
- **The drop:** in SNAG IT!'s box, a bar of hands sits near the bottom. As
  the countdown ends the ball pops straight up off them and falls back,
  speeding up as it falls, its shadow on the hands growing as it comes.
  The Coach taps anywhere in the box (or presses Space) as it meets the
  hands. Pips in the corner show each pop's result.
- **The pops** (g2): the first is 1.0 s in the air, each later one 0.8
  times the last (1.0, 0.8, 0.64, 0.51, 0.41 s), and so about two-thirds
  as high. **The next pop leaves the hands at the tap** (u1), so the rhythm
  follows the Coach's thumb.
- **Each tap** (g1, g2): within 0.07 s of the ball meeting the hands is
  **clean** (the hands flash green); within 0.14 s, a **bobble** (yellow,
  the ball wobbles). Anything else is a **drop** (red): a tap earlier than
  that, so mashing fails, or no tap by 0.14 s after. The windows are the
  same on every pop; the pops getting quicker is the difficulty.
- **The parked drift** (t1's option B: each pop lands somewhere new along
  the hands) waits until the drop has been played. _User: "Let's see how
  the initial concept plays and maybe we add drift later."_

## How many, and how fast (g3)

- **The count** is SNAG IT!'s dot rule plus one, held to 2 to 5: the level
  (one more every four drives from drive 5), one more for each defender
  after the first reaching for the ball, one fewer or more for a 20-point
  Hands gap. So 3 pops at drive 5, 2 when the receiver's Hands beat the
  defender's by 20, 4 with two defenders in reach or at drive 9, 5 from
  drive 13.
- **The pace:** past drive 10 every pop is shorter by the same share as
  SNAG IT!'s rings close quicker, down to the same floor, reached at drive
  18 (the first pop 0.625 s there).
- **Both rules are written once,** in `catchTests` in `tuning.ts`, and
  SNAG IT! plays exactly as before the move.

## The grade (t4, g1)

- **GREAT** (every tap clean): caught, and every contesting defender is
  knocked flying, as SNAG IT!'s GREAT.
- **OK** (a bobble, no drop): caught, and tackled on the spot.
- **BAD** (a drop): the drill ends at once, and the ball is batted down.
- **It is harsher than SNAG IT!,** which forgives one miss: a bot that
  drops one tap in twenty and bobbles one in five gets BAD on about 14% of
  3-pop drills and GREAT on about 42%, where SNAG IT!'s bot (one dot in ten
  missed) gets BAD on about 3% of 3-dot tests and GREAT on about 73%. The
  bench is where that's judged.
- The box stays `catchTests.linger` (0.3 s) after the grade, as SNAG IT!'s
  does. Sounds are the existing ones: the catch sound for a clean tap or a
  bobble, the fumble sound for a drop.
- **Outside Break it!'s two a down,** as SNAG IT! is.

## The bench (g6)

A **TIP DRILL!** tab with five sliders, in order: the countdown, the first
pop's time in the air, each pop's share of the last, the clean window and
the bobble window. Its situation sliders are SNAG IT!'s (the drive, the
defenders in reach, the Hands gap), which set the pops. Behind More: the
box's linger and when the catch tests start. The count and pace rules stay
on SNAG IT!'s tab, where they're tuned for both.

## The balance bot (t5)

It plays the tip drill: clean three taps in four, a bobble one in five, a
drop one in twenty. It has no tests (its script runs as it's imported), so
it's checked by a balance run, recorded here.

**As run, 2026-10-31** (`main` before the branch, against the branch, the
same seeds; the runs are slow here, so they're small):

| | Normal, 12 runs, before | after | Hard, 6 runs, before | after |
| --- | --- | --- | --- | --- |
| Drives won (normal: of 12; hard: median) | 11.6 | 11.6 | 11 | 9 |
| Contested balls | 4 | 4 | 9 | 7 |
| SNAG IT! (GREAT / OK / BAD) | 4: 1 / 3 / 0 | 1: 1 / 0 / 0 | 9: 6 / 3 / 0 | 2: 1 / 1 / 0 |
| Tip drill (GREAT / OK / BAD) | | 3: 3 / 0 / 0 | | 5: 2 / 2 / 1 |

- **What it shows:** the pick works in a real run (both tests come up), the
  bot plays the drill to its grade, and nothing in the run breaks. The tip
  drill's 2 / 2 / 1 is close to what its numbers predicted (about 42%
  GREAT, 14% BAD).
- **What it can't show:** whether the tip drill is too hard. Seven tip
  drills is far too few, and in these runs Break it!'s BAD moved from 16%
  to 26% (normal) and 18% to 27% (hard) on code the branch didn't change:
  the throws the runs pick diverge, so 12 runs swing that much by chance.
  Judge it on the bench and in play; a larger run needs more time than a
  session here gives it.

## Tests, written first (u2)

1. **The pick:** from drive 5 a contested ball starts SNAG IT! or the tip
   drill; the same seed always gives the same pick, and over many seeds
   about half are each. Before drive 5, neither. `?snag=1` alone always
   gives SNAG IT! from drive 1, `?tip=1` alone the tip drill, both either.
2. **The count:** 3 pops at drive 5; 2 with the receiver's Hands 20
   better; 4 with two defenders in reach; 4 at drive 9, 5 from 13; never
   under 2 or over 5.
3. **The pace:** pops of 1.0, 0.8 and 0.64 s on screen; past drive 10
   each shorter by SNAG IT!'s share, the first 0.625 s from drive 18.
   SNAG IT!'s own timings are unchanged by the move to shared settings.
4. **The countdown:** the first pop starts as `countdown.ready` ends; a
   tap during the countdown does nothing.
5. **A tap:** within 0.07 s of a landing is clean, within 0.14 s a bobble;
   an earlier tap is a drop, and no tap by 0.14 s after is a drop. The
   next pop starts at the tap.
6. **The grade:** all clean is a catch with the contesting defenders
   knocked flying; a bobble and no drop, a catch and a tackle there; a drop
   ends the drill at once, batted down.
7. **The count of Break it!s:** a down with a tip drill still has its two
   Break it!s.
8. **The view:** "GET READY FOR THE TIP DRILL!" and the seconds left in the
   countdown; the ball's height at moments of a pop; the pips' results; the
   box staying for the linger.
9. **The bench:** the tab's five sliders in order, More's two, SNAG IT!'s
   situation sliders; a rep plays a tip drill with its situation's pops,
   and Save writes the tab's values.

The look is checked in a phone-sized screenshot before the Coach plays it.

## Order of work (u3)

On the `tip-drill` branch, one commit each, typecheck and tests after
every step:

1. This plan, with `PLAN.md` and `CONTEXT.md`.
2. Shared catch-test settings (`catchTests`): when they start, the count
   and the pace. No change in play.
3. The tip drill in the sim: the pick, the pops, the taps, the grade,
   `?tip=1`.
4. On screen: the box, the ball, the hands and shadow, the pips, the
   countdown, the sounds.
5. The bench tab.
6. The balance bot, with a run before and after.
7. The docs reconciled: `GAMEPLAY.md`, `TECHNICAL.md`, `BENCH.md`,
   `SNAG.md`.
