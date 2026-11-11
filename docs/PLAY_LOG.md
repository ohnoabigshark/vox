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
  `PLAY_LOG`. It also hands models to and from the phone for Goxel, under
  `/vox-log/models` (`docs/ART.md`, The round trip), from the folder named
  by `VOX_MODELS`, and since 2026-11-11 serves the built game itself at
  `/vox/`, from `VOX_GAME`, with pages marked `no-cache` (`docs/BUGS.md`
  B11).
- **What a line holds (l2):** one line per sim event: every event the sim
  reports is a moment (a snap, a throw, a catch, a tap test's start and
  grade, a tackle, a pickup, a field event, the crows, the down's end, a
  series won), not a frame. A session opens with a `start` line, sent as the
  page loads, so ⚑ turns red at once if the log isn't there, before you've
  played a down (found in the headless check: without it, a first tap said
  "Flagged" with the log down, which r5 has since ruled out on its own).
  Each line carries:
  - `at`: the wall-clock time, from `src/clock`, in UTC (l3);
  - `session` (one per page load) and `seed` (one per run), so one run's
    lines can be picked out;
  - `build`: the commit the game was built from;
  - `link`: the link's query string (`aim=2&hard=1&snag=1&tip=1`); lines
    from before 2026-11-01's review call it `flags` (r6);
  - `setup`: the dev setup the page's runs are made with, the switches it
    supplied (changed, and not named by the link) as a link writes them
    (`hard=0&breakit=juke`), '' for none and in practice (`docs/DEV_SETUP.md`,
    map round 5, q3);
  - `practice`: true for Try it's practice;
  - the down as it was played: `series` (area, stretch, kind; `index`
    before the long field, 2026-11-04, when it was the series), the down,
    the line of scrimmage and the first-down line, and the play called;
    lines from before 2026-11-03's series-rename branch call it `drive`;
  - `phase`: where the run was just after the event: `setup` before the
    snap, `play`, a tap test (`breakit`, `snag`, `tip`), `downOver` in the
    pause after a down, `draft`, `over` or `won` (`Phase` in
    `sim/types.ts`), which says whether a line came mid-play;
  - the ball and the carrier's spot just after the event;
  - the event itself, as the sim reported it (since 2026-11-03's record
    branch, `called` carries the play's id, `batted` its target and
    `joined` the recruit's id: `docs/STATS.md`; since 2026-11-11's
    `menu-routes`, `hotRoute` says who took which hot route: the body's
    `id`, the roster `slot` and the `route`, null for back on the card's,
    `docs/PLAYER_MENU.md`). A `downEnded` line also
    carries where the line of scrimmage moved to (`next.los`, yards from the
    area's start since 2026-11-04's long field; from the series' start
    before), but not the
    next down: the game settles that after the pause, so the next down's own
    lines carry it. (A first version logged the series' down there, which
    was still the down just played; found reading the first real session.)
- **Times (l3):** UTC in the file. Times the user gives are read as New
  York time unless they say otherwise.
- **⚑ (l4):** a button beside the down and distance. A tap sends a `flag`
  line with the same context at once, even while the log is down, and once
  the log has answered pops "Flagged 11:21:07" (the phone's own time) if
  it stored the line, or "Not logging" if it didn't (review r5: it first
  went by the last send's answer, so it could say "Flagged" just after the
  log went down). That takes a moment, up to 10 s if the log never
  answers. While the log can't be reached, ⚑ is red: a gap in the log is
  never silent.
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
about every 2 s, and at once on a down's end or a flag. A send with no
answer in 10 s has failed (review r2). A failed send keeps its lines,
turns ⚑ red, and tries again after 2 s, then 4, 8, up to 60 (the rules:
retries back off). When the page is hidden (switching apps, locking the
phone, closing the tab), everything queued goes at once, without waiting
for a send already out, since a phone may freeze or close a hidden page
(review r4). Those sends ask the browser to finish them after the page has
gone (`keepalive`), which it does for up to 64 kB in all, a few seconds'
play; a longer queue, built up while the log was down, may not all make
it. The queue holds at most 5000 lines; past that the oldest go, and the
next line sent says how many were dropped.

## As built

- Checked end to end on 2026-11-01 in a phone-sized headless browser on
  the served build (an event practice link, since a run waits for its
  music, which headless Chrome never starts): a `start` line, every event
  of the down, and a `flag` line reached `play.jsonl` through Tailscale;
  with the log answering 502, ⚑ was red and a tap said "Not logging".
- Checked again after the review's fixes (5e22d4c), on the served build:
  a tap's flag line went out during the tap and its pop said "Flagged";
  with the log answering 502, and with it never answering, the pop said
  "Not logging" and ⚑ was red (after 10 s, for the one that never
  answered); hiding the page sent the down's queued lines 6 ms later.
- `vox-log` holds about 80 MB, not the 40 the map guessed.
- ⚑ shows on the start screen too, at the top right.
- The service runs from vox's main checkout (like `hermit-scheduler` from
  Hermit's), so a branch there without `tools/playLog/` stops it starting
  on its next restart, and ⚑ turns red.

## Reading it

`play.jsonl` is one JSON object per line: `grep '"kind":"flag"'` finds the
flags; `jq` picks out a session or a time window. The service answers a
GET with `{"recording":true}`, for checking it by hand (`curl
https://…ts.net:8443/vox-log/`); the game itself doesn't use it.

## Tests (scenarios, written first)

- **The lines** (`tests/arcade/playLog.test.ts`): one line per event, in
  order; the down's context comes from the state the step started in; the
  carrier's spot from the state after; a `downEnded` line carries the new
  line of scrimmage and not the next down; a flag line carries the same context with no
  event; practice is marked; positions rounded to hundredths.
- **Sending** (`tests/arcade/playLogSender.test.ts`, with a fake fetch):
  lines go as one array per send; a 204 sets the status on; a failure
  (refused, unreachable, or no answer, which the fake can also give) sets
  it off, keeps the lines and retries after a doubling wait, capped; lines
  past the cap drop the oldest and say how many.
- **The service** (`tests/tools/playLogServer.test.ts`): POST of an array
  of objects appends one line each; anything else is refused with a reason
  (not JSON, not an array, a line without `at` or `kind`); GET says it's
  recording; a blank `PLAY_LOG` refuses to start, naming it; past the size
  the file is rotated and only three old ones kept.
- **The game's wiring** (`startPlayLog`, `after()` and `flag()` in
  `src/arcade/game.ts`) has no test of its own: it is a few lines between
  the tested lines and sender, checked end to end in the headless check
  (As built). Review r7 left it so.
- **The build:** with `PLAY_LOG_URL=/vox-log/`, `dist/` holds `/vox-log/`;
  with plain `npm run build`, as Pages builds, it doesn't, and still holds
  the dev tools (checked by hand, as the rules ask).
