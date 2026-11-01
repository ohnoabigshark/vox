# The play log

A log of real games, so the user can say "it happened around 11:20" (or tap
⚑) and Claude can read what the game did. Decided on the decision map
https://claude.ai/artifact/M8ojJKewTknTjpmxx3eEcY (l1–l6, all approved
2026-11-01), after B6 was seen in play with nothing recording it.

## What it is

- **Where it goes (l1):** a small always-on service on the droplet,
  `vox-log`, listening on loopback (`127.0.0.1:9320`), reached by the game
  at `https://…ts.net:8443/vox-log/` through `tailscale serve`. So the build
  at `/vox/` logs, and so does the hot-reload server at `/vox-dev/`: both
  are on the same origin. The service is `tools/playLog/server.ts`, run by
  Node directly (no build step), and appends to the file named by
  `PLAY_LOG`.
- **What a line holds (l2):** one line per sim event: every event the sim
  reports is a moment (a snap, a throw, a catch, a tap test's start and
  grade, a tackle, a pickup, a field event, the crows, the down's end, a
  drive won), not a frame. A session opens with a `start` line, sent as the
  page loads, so ⚑ knows whether the log is there before the first tap
  (found in the headless check: without it, a first tap said "Flagged" with
  the log down). Each line carries:
  - `at`: the wall-clock time, from `src/clock`, in UTC (l3);
  - `session` (one per page load) and `seed` (one per run), so one run's
    lines can be picked out;
  - `build`: the commit the game was built from;
  - `flags`: the link's query string (`aim=2&hard=1&snag=1&tip=1`);
  - `practice`: true for Try it's practice;
  - the down as it was played: the drive (area, index, kind), the down,
    the line of scrimmage and the first-down line, and the play called;
  - the ball and the carrier's spot just after the event;
  - the event itself, as the sim reported it. A `downEnded` line also
    carries where the line of scrimmage moved to (`next.los`), but not the
    next down: the game settles that after the pause, so the next down's own
    lines carry it. (A first version logged the drive's down there, which
    was still the down just played; found reading the first real session.)
- **Times (l3):** UTC in the file. Times the user gives are read as New
  York time unless they say otherwise.
- **⚑ (l4):** a button beside the down and distance. A tap writes a `flag`
  line with the same context and pops "Flagged 11:21:07" (the phone's own
  time). If the log can't be reached, ⚑ turns red and a tap pops "Not
  logging": a gap in the log is never silent.
- **Which builds (l5):** only our tailnet builds. The log's address goes
  into a build only when `PLAY_LOG_URL` is set, and only
  `.claude/bin/vox-rebuild.sh` (the build at `/vox/`) and `vox-dev.sh` (the
  hot-reload server) in `/root/projects` set it. Any other build, GitHub
  Pages included, sends nothing and shows no ⚑. (It first keyed off
  `build:release`, but the Deploy workflow runs plain `npm run build`, so
  the release would have logged; review r1.) The test bench keeps its own
  log (`docs/BENCH.md`).
- **Keeping it (l6):** `/root/.local/share/vox-serve/play.jsonl`, started
  fresh once past 20 MB, the last three kept as `play.1.jsonl` to
  `play.3.jsonl`.

## How the game sends

The lines queue in the page and go in batches, a POST of a JSON array,
about every 2 s, and at once on a down's end or a flag. A failed send keeps
its lines, turns ⚑ red, and tries again after 2 s, then 4, 8, up to 60
(the rules: retries back off). The queue holds at most 5000 lines; past
that the oldest go, and the next line sent says how many were dropped.

## As built

- Checked end to end on 2026-11-01 in a phone-sized headless browser on
  the served build (an event practice link, since a run waits for its
  music, which headless Chrome never starts): a `start` line, every event
  of the down, and a `flag` line reached `play.jsonl` through Tailscale;
  with the log answering 502, ⚑ was red and a tap said "Not logging".
- `vox-log` holds about 80 MB, not the 40 the map guessed.
- ⚑ shows on the start screen too, at the top right.
- The service runs from vox's main checkout (like `hermit-scheduler` from
  Hermit's), so a branch there without `tools/playLog/` stops it starting
  on its next restart, and ⚑ turns red.

## Reading it

`play.jsonl` is one JSON object per line: `grep '"kind":"flag"'` finds the
flags; `jq` picks out a session or a time window.

## Tests (scenarios, written first)

- **The lines** (`tests/arcade/playLog.test.ts`): one line per event, in
  order; the down's context comes from the state the step started in; the
  carrier's spot from the state after; a `downEnded` line carries the new
  line of scrimmage and not the next down; a flag line carries the same context with no
  event; practice is marked; positions rounded to hundredths.
- **Sending** (`tests/arcade/playLogSender.test.ts`, with a fake fetch):
  lines go as one array per send; a 204 sets the status on; a failure sets
  it off, keeps the lines and retries after a doubling wait, capped; lines
  past the cap drop the oldest and say how many.
- **The service** (`tests/tools/playLogServer.test.ts`): POST of an array
  of objects appends one line each; anything else is refused with a reason
  (not JSON, not an array, a line without `at` or `kind`); GET says it's
  recording; a blank `PLAY_LOG` refuses to start, naming it; past the size
  the file is rotated and only three old ones kept.
- **The build:** with `PLAY_LOG_URL=/vox-log/`, `dist/` holds `/vox-log/`;
  with plain `npm run build`, as Pages builds, it doesn't, and still holds
  the dev tools (checked by hand, as the rules ask).
