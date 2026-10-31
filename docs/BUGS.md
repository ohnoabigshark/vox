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
