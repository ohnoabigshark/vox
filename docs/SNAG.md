# SNAG IT!

A Break it!-style test on a contested catch: dots pop up one after another
in a box, each with a ring closing onto it, and the Coach taps each dot as
its ring closes. Planned by grilling on the decision map
(https://claude.ai/artifact/CBJBqJWHoyfuaHbQwn38dT), 2026-10-30, all
approved; the item numbers below are the map's. It replaces the parked
"Break it! test on catches" in `PLAN.md`.

**The countdown** came after, on a second map
(https://claude.ai/artifact/1i9hg9Dsw59gbsAj4aeTYR), 2026-10-31, two
rounds, all approved: its items are cd-c1 to cd-c10 below (the second
map's c1 to c10), where they would clash with the first map's.

Times are on screen, as in `GAMEPLAY.md`; the sim runs at 0.8 of that, so
`tuning.ts` holds each one times 0.8.

## When (c2, c3, c6)

- **A contested ball** is one that one of your players and a defender could
  both get to: on a bullet, a receiver's reach and a defender's reach both
  cover the ball where it is; on a lob (`?aim=2`), a receiver inside the
  catch circle and a defender who can reach the landing spot. Today the
  code settles it at once (`contact` and `lobLanding` in `sim/ball.ts`): on a
  bullet the better Hands wins, on a lob the nearer one. With SNAG IT! on,
  every contested ball goes to the test instead, whichever way today's rule
  would have gone. An uncontested catch, a batted ball nobody of yours could
  reach, and an incomplete are unchanged.
- **From drive 5.** A level is the drive's number in the run (Froggy's
  Forest is drives 1–4, the Candy Queendom 5–8, Frederick's Farm 9–12, hard
  mode's fourth zone 13–16, and so on). From drive 5, in normal and hard
  mode alike; before it, contests are settled as today.
- **`?snag=1`** turns it on from the first drive, to try it without playing
  four drives first. It stands in for the dev panel's "force the next
  contest" button (u1): vox has no dev panel, and its URL options are how it
  forces states (`TECHNICAL.md` §21). Practice follows the same rule, so a
  rep only meets SNAG IT! with `?snag=1`.

## The test (c1, s2, s3, s5, s6)

- **The freeze:** the play stops with Jack hanging a yard short of the
  receiver's hands, and a **countdown** opens it, as it does Break it!:
  "GET READY TO SNAG IT! 2… 1…" in the box, two seconds, the same
  countdown and the same setting as the bar's, the mash's and the juke's
  (cd-c1, cd-c3, cd-c8). As it ends, the first dot comes, with SNAG IT!
  as the box's title (cd-c7). A tap during it does nothing. _Replaced:_
  "SNAG IT! is called for half a second. There is no 'get ready'
  countdown: the first ring is the warning." On the test bench the Coach
  read the first ring wrong, as a countdown of the time left.
- **The dots:** then the dots come, one after another, each 0.5 s after the
  last. Each dot's ring starts at twice the dot's size and closes onto it in
  0.8 s.
- **A hit** is a tap on the dot within 0.15 s either side of its ring
  closing. A tap on it earlier is a miss (so mashing every dot as it shows
  fails), and so is no tap by 0.15 s after. A tap on empty grass does
  nothing. A dot goes once it's hit or missed.
- **Faster later:** past drive 10, the ring closes 0.04 s sooner each drive,
  and the gap between dots shrinks in step (it stays five-eighths of the
  close), down to a floor of 0.5 s to close and 0.3 s apart (drive 18).
- **The box** sits where the bar test does, a little bigger: a square
  92% of the screen's width (at most 460 pixels, and at most 60% of the
  screen's height, so it fits a phone held sideways or a laptop), centred
  at the same height. The dots are 72 pixels across. Each new dot is at least about a
  dot and a half from the two before it, and at most half the box from the
  last, so the thumb's next move is short and readable. The three sizes (the dot,
  the ring's start, the box's 460 pixels) are in `tuning.ts`, so the test
  bench (`BENCH.md`) can set them.

## How many dots (s1)

- **The level:** 2 on drives 5–8, then one more every four drives (an area; `moreEvery`): 3 on
  9–12, 4 on 13–16, 5 from 17.
- **The crowd:** one more for each defender after the first whose reach
  covers the ball.
- **Hands:** one fewer when the receiver's Hands beat the best contesting
  defender's by 20 or more; one more when theirs beat the receiver's by 20
  or more.
- **Always 2 to 5.** Before drive 5 (only with `?snag=1`) the level gives 2.

## The grade (c4, s4, s7)

- **GREAT** (every dot hit): caught, and every defender contesting it is
  knocked flying, so the receiver runs free (a GREAT break's moment where
  nobody can grab it).
- **OK** (one miss): caught, and tackled on the spot. The yards count.
- **BAD** (two or more misses): batted down by the defender: incomplete.
- Each hit pops its dot green, with the catch sound and a short buzz
  (where the phone can: iPhones can't); each miss cracks it red, with the
  fumble sound. The grade is called in the middle of the screen, as Break
  it!'s is, then the catch (or the bat) plays out with today's sounds.
  On a keyboard, Space taps the dot that closes first.
- **Second Wind** (the perk that turns a BAD Break it! into an OK) doesn't
  apply: SNAG IT! isn't a Break it!.

## Outside Break it!'s count (c5)

SNAG IT! isn't one of Break it!'s two a down, as SHOO CROWS! isn't. There's
at most one catch a down, so it needs no limit of its own.

## Checking it (s8)

The numbers above are first guesses. The balance runs
(`tools/arcade-balance.ts`) get a bot that plays SNAG IT!, missing about one
dot in ten (as it gets a Break it! BAD about one time in ten), and report how
often a contested ball is caught, so a run with SNAG IT! can be compared with
one without. The numbers get tuned from those and from the Coach's play.

- **The bot throws into contested balls** now (review a3, from commit
  8b03608): it counts a SNAG IT! as a catch when it looks ahead at a throw
  (`predictsCatch`), as a Coach who can win SNAG IT! would. So a run with
  SNAG IT! and one without differ in the throws the bot picks, not only in
  how contested balls end; compare them knowing that.
- **The box stays 0.3 s after the grade** (`snag.linger`, review a1), so the
  last dot's pop or crack is seen; the play goes on meanwhile.

## Tests, written first

The map's u2 put the test scenarios to the Coach before the tests; the Coach
handed over the build on 2026-10-30 ("free reign to put together snag it into
something playable"), so they are recorded here instead.

1. **The count:** 2 dots at drive 5, 3 at drive 9, 5 at drive 17 and after;
   one more for a second defender in reach; one fewer when the receiver's
   Hands beat the defender's by 20, one more the other way; never under 2 or
   over 5.
2. **The timing:** dots appear 0.5 s apart (screen) and close 0.8 s after
   appearing; past drive 10 both shrink each drive, to the floor.
3. **When:** a contested bullet and a contested lob each start SNAG IT! from
   drive 5, whichever way today's rule would have gone; before drive 5, and
   for uncontested balls, nothing changes; `?snag=1` starts it on drive 1.
4. **Hits and misses:** a tap within the window hits; an early tap misses;
   no tap misses once the window has passed; a tap on a dot not yet showing
   does nothing.
5. **The grade:** all hit is a catch with the contesting defenders knocked
   down; one miss is a catch and a tackle there; two misses is a batted
   ball.
6. **The count of Break it!s:** a down with SNAG IT! still has its two
   Break it!s.

## The countdown: tests, written first (cd-c10)

1. After the freeze, SNAG IT!'s first dot appears when the countdown ends:
   1.6 in sim seconds, 2.0 s on screen; every later dot moves back by the
   same amount.
2. During the countdown the view says "GET READY TO SNAG IT!" with whole
   seconds left (2, then 1), and shows no dot; as it ends, the title is
   SNAG IT! and dot 1 is up.
3. A tap during the countdown hits nothing and costs nothing.
4. One setting, `countdown.ready` (named `tapTests.ready` until review
   c3), sets both: moved, it moves the mash's
   countdown and SNAG IT!'s first dot alike. The bench shows its slider on
   the bar, mash, juke and SNAG IT! tabs, first in each (cd-c4), and saving
   it on one tab saves it for all four. `breakit.ready` and `snag.call`
   are gone.
5. The balance bot still plays SNAG IT! and Break it! and grades them
   (their existing tests, unchanged).

The look is checked in a phone-sized screenshot.

- **Not SHOO CROWS!** (cd-c9): it's a reaction to the crows landing in
  live play, and a countdown would say when they land.
- **Break it!'s chain countdown** (half a second for a grab hard on another,
  `breakit.chainReady`) stays Break it!'s own: SNAG IT! can't chain.
- **Order of work** (cd-c5): on `snag-countdown`, from `test-bench`, one
  commit each: this plan; the countdown moved into `tapTests` (since renamed `countdown`, review c3; no change in
  play); SNAG IT!'s countdown in the sim, the view and the box, with the
  call removed and the bench's slider; the docs reconciled.
