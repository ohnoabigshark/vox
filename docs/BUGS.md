# Bugs

Numbered; each with dated decisions.

## B1. The plays test is titled "the four plays"; there are five

`tests/arcade/plays.test.ts` says `describe('the four plays', …)`, and
`PLAYS` holds five (Slants, Deep Shot, Curl & Flat, Dive, Sweep). Found
2026-10-28 while reading how plays work. Upstream's; fix it here or send it
back to esrauch.

**2026-10-29: fixed** on the `play-editor` branch: the test file is replaced by
`tests/arcade/playRules.test.ts`, which checks every play in the pool.

## B2. A long sim test times out on the droplet

`tests/arcade/sim.test.ts`, "keeps its invariants through long runs", takes
about 6.2 s on the droplet's shared vCPU against vitest's default 5 s
timeout, so `npm run check` fails here on a clean upstream checkout. It passes
with `--testTimeout=60000`. Found 2026-10-28. Options: give that test its own
timeout, or raise it in `vite.config.ts`'s `test` block.

**2026-10-29: fixed** on the `play-editor` branch (map item e19): first with
a timeout on that one test; then, when a second sim test ("teammates spread
out") turned out to take 4.6-4.9 s here too, with `testTimeout: 20_000` for
every test in `vite.config.ts`. `npm run check` passes on the droplet.

## B3. A full mash in the Forest takes 11 taps, not 10 (fixed)

The mash adds `perTap` to `fill` and breaks at `fill >= 1`
(`judgeBreakIt`, `sim/breakit.ts`). In the Forest `perTap` is 0.1, and ten
tenths add up to 0.9999999999999999 in floating point, so the tenth tap
leaves it just short and the eleventh breaks it. Other values can do the
same. Found 2026-10-31 by the test bench's tests (its summary counts taps as
the game fills them, so it says 11). Not fixed on the `test-bench` branch,
which doesn't change play. Options: count taps as a whole number and compare
`taps * perTap` with a small allowance, or round `fill` as it's added.

- 2026-10-31: fix it on a small branch of its own after `test-bench`
  (decision n2 on the bench rework map), since it changes play.
- 2026-11-04: **fixed** on the `b3-mash-taps` branch, the first option's
  allowance without its tap count: the mash reaches full, and drags, when
  its fill is within a billionth of the mark (`filledTo` in
  `sim/breakit.ts`). A full mash in the Forest takes ten taps, and the
  bench's readout says 10.

## B4. SNAG IT! on the test bench sometimes shows only its first two dots (fixed)

Seen once by the Coach on Android Chrome, 2026-10-31 03:37–03:38 UTC, on
the hot-reload bench: drive 10, three tacklers, 3 defenders reaching,
Hands gap −25 (five dots), all settings at their defaults. In four reps in
a row the log has dots 1 and 2 tapped (hit, or a late miss) and dots 3–5
never tapped; the Coach saw the readout say more dots were coming while
none showed. On opening the bench again it worked, so it's intermittent.

Not reproduced in headless Chromium with that exact situation: untapped,
tapped early, tapped on the ring, and with touch on an emulated phone,
scrolled or not, dots 3–5 showed and graded; all 30 dot positions measured
fell inside the stage, at phone and laptop sizes.

- 2026-10-31: logged, not fixed. If it comes back, a screenshot or screen
  recording while dots 3–5 should be up, and the time, to match the log.
- 2026-10-31, fixed: the Coach reproduced it (drive 1, 3 reaching, Hands
  gap −25: 3 dots shown of 5) after a rep with fewer dots. The box tells one
  SNAG IT! from the next by when it started (`SnagView.id`), and every bench
  rep is a fresh run whose SNAG IT! starts at the same moment, so the box
  kept the last rep's dots: a rep with more dots than the one before had no
  element for the extra ones. Headless runs that opened straight into the
  five-dot situation never had a smaller rep before, so never saw it. The
  bench now gives each rep's box the rep's number as its id
  (`Bench.snagView`); the game, where each SNAG IT! starts at its own
  moment, was never affected. A test fails with the old id; a headless run
  of a 3-dot rep then a 5-dot one shows all five.

## B5. A defender could end up just past the sideline after the whistle (fixed)

Found on the `release-mode` branch, 2026-10-31, when our first wide play,
Clear Out (a handoff run along the sideline), joined the play pool: the
long-run invariants test saw a defender 0.02 yards out of bounds during the
pause after a down. Two moves skipped the clamp that keeps everyone but the
carrier on the field (`physics.ts`): a knocked-down body sliding, and a
block on a handoff driving its man back. During play the later
`separate()` clamped them anyway, but after the whistle only `moveBodies`
runs. No play before Clear Out went near enough the sideline to show it.

- 2026-10-31, fixed: one `keepInBounds` in `physics.ts`, now used by every
  move, the slide and the block drive included. Two tests fail without it.

## B6. A SNAG IT! catch in the end zone doesn't score; the drive goes on (fixed)

Reported by the user, 2026-11-01: a catch in the end zone off SNAG IT! gave
"1st & Goal" and another play, though the receiver was already in the end
zone. Their guess: any tap test after a catch skips the touchdown check.

Not reproduced yet. Read from the code, the likely cause is the catch tests'
OK grade: `catchGraded` in `sim/step.ts` (shared by SNAG IT! and the tip
drill) calls `tackle()` straight away, which ends the down as `tackled` at
the receiver's spot without asking `checkCarrier` whether that spot is past
the line. GREAT calls `checkCarrier` and should score. So an OK catch past
the line, in the end zone on a Boss drive or past the first-down line on an
ordinary one, would move the line of scrimmage past it but not win the
drive. To confirm with a failing test before fixing.

- 2026-11-01, fixed: confirmed by two tests (SNAG IT! and the tip drill),
  which fail on the old code with the down ended as `tackled`. On OK,
  `catchGraded` now asks `checkCarrier` first, as GREAT does, and tackles only
  if the catch didn't win the drive. Not explained: the user saw "1st & Goal",
  where a tackle uses up a down and should show "2nd & Goal".
- 2026-11-01, seen again by the user on an ordinary drive: 1st & 10, a
  10-yard pass, and the next down was 2nd & 1 with the line already past the
  marker (the screen never shows less than 1). Not a catch test this time:
  seven ways of ending a down tackled the carrier without asking whether
  they were past the line, and only `checkCarrier`, last in each step, asked.
  One is reproduced by a test: Break it!'s DRAG ends where it hauls the
  carrier to, and when that spot is just past the line the drag tackles in
  the very step the carrier crosses. Fixed on `past-the-line` (decision map
  M8ojJKewTknTjpmxx3eEcY, b1): `endDown` itself turns a tackle or out of
  bounds at or past the line into a first down, so every path follows one
  rule. The catch tests keep their own check, so a catch past the line
  scores without a tackle shown first.

## B7. Names on the field never showed (fixed)

The names under your players before the snap (`docs/REWARDS.md`, notes p6,
977f812, merged in PR #39) never appeared in play. `ArcadeNames` put its
layer into the UI root before the Hud was built, and the Hud's constructor
set `root.innerHTML`, wiping it, so every tag went on a detached element.
`nameTags` (the pure part) was tested; the layer was never looked at on a
screen. Found by the user, 2026-11-05: "I'm not seeing them on what we have
on the tailnet server".

**2026-11-05: fixed** on `names-fix` (ddd1966): the Hud adds its markup with
`insertAdjacentHTML('beforeend', …)`, keeping what the root already holds.
Checked in a headless browser against the served build: before the fix
there was no `.arcade-names` element on the page; after it, the seven names
show at the first down. `tests/ui/uiRoot.test.ts` keeps that check: it
builds the names layer and the Hud in one root, as the game does, and runs
in happy-dom (a dev dependency, for that file only; the other tests have no
DOM). It failed with the old `innerHTML` and passes with the fix (review of
`names-fix`, rules: prove a bug-fix test catches the bug). Seen with it:
full names at the line overlap (the risk p6 accepted).

## B8. The stat bars stop at 100, but stats grow to 150

Reported by the user, 2026-11-06: "our player stats bars seem to be based
off a cap of 100 when the stats can go to 150 meaning we don't accurately
show per play gains on the bar."

The bars fill against `BAR_MAX = 100` (`statBars` in `src/ui/hud.ts`), set
before growth from play existed. Growth stops at `growth.ceiling`, 150
(`content/tuning.ts`, `docs/REWARDS.md`). So from 100 up, a bar is full and
stays full. A gain that ends above 100 is clamped too: its green stretch
starts at `share(value - delta)` and is cut off at the bar's end
(`overflow: hidden` in `hud.css`), so it shows shorter than the gain, or not
at all. The segments are drawn 10 to a bar, one per 10 points of the old
0–100 scale (`.hud-stat-bar::after`).

- 2026-11-06: logged, not fixed. To fix before the next release. Likely fix:
  the bar's top comes from `growth.ceiling`, defined in one place, with 15
  segments so each is still 10 points. An ordinary 50 then fills a third
  rather than half, which changes how every bar looks (Your team, the offer
  cards, the selected player's card), so it gets a before-and-after mockup
  first. A test pins it: a stat of 120 with +15 draws its fill at 80% and
  its gain from 70% to 80%.
