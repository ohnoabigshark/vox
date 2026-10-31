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

## B3. A full mash in the Forest takes 11 taps, not 10

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
