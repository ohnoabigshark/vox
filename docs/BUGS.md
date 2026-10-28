# Bugs

Numbered; each with dated decisions.

## B1. The plays test is titled "the four plays"; there are five

`tests/arcade/plays.test.ts` says `describe('the four plays', …)`, and
`PLAYS` holds five (Slants, Deep Shot, Curl & Flat, Dive, Sweep). Found
2026-10-28 while reading how plays work. Upstream's; fix it here or send it
back to esrauch.

## B2. A long sim test times out on the droplet

`tests/arcade/sim.test.ts`, "keeps its invariants through long runs", takes
about 6.2 s on the droplet's shared vCPU against vitest's default 5 s
timeout, so `npm run check` fails here on a clean upstream checkout. It passes
with `--testTimeout=60000`. Found 2026-10-28. Options: give that test its own
timeout, or raise it in `vite.config.ts`'s `test` block.
