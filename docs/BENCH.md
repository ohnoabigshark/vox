# The test bench

A dev page for playing the quick tap tests on their own, rep after rep, with
sliders and toggles for their settings, and a Save that puts the settings
that feel right into the game, over defaults that are always kept. Planned
by grilling on the decision map
(https://claude.ai/artifact/FMYWpB3bDZLCCTZCJH1nNC), 2026-10-31, in two
rounds; the item numbers below are the map's. All approved but k5, where
the Coach picked the other way ("I think half to double is better for first
pass").

**Reworked** after the Coach played it, on a second map
(https://claude.ai/artifact/5CQu4vpY5qoESmL7YzwLJF), 2026-10-31, in two
rounds: Save instead of the log of every change (s1–s8), sliders that move
only by their knob (u1–u4), a log of reps and saves (l3), and fewer SNAG
IT! sliders (p2). Its item numbers are below with an `r` in front (r-s1)
where they would clash with the first map's. Where the rework replaces
something, the old text is marked _replaced_.

## What's on it (b1–b3)

- **The five tap tests,** one tab each: Break it!'s bar, mash and juke,
  SNAG IT!, and SHOO CROWS!. The throw's aim line and two-tap marker are
  left out: they're aiming on the field.
- **The real tests on a plain stage,** drawn from the same views as the
  game (`ui/testViews.ts`). Each rep is a run from `createRun`
  with the test started directly (`startBreakIt` with its kind forced,
  `startSnag` with a contest made up from the situation, or the crows landed
  on the QB), stepped at 60 Hz with the Coach's taps, so hits, misses and
  grades come from the game's own code. The screen is the game's own
  `ArcadeControls`, CSS and sounds, over a plain stage: no field, no 3D.
- **`dev/bench.html`,** listed on the Dev tools page, in the served build
  like the other dev pages and left out of `npm run build:release`. One go
  at a test is a **rep**, as in the play editor's practice.

## The knobs (k1–k5)

- **One slider per value in `tuning.ts`** that the test uses, named in game
  words, with the `tuning.ts` name and number in small print beneath:
  - all three Break it!s: the countdown (`countdown.ready`, which SNAG IT!
    shares too, docs/SNAG.md cd-c8), each extra tackler
    (`breakit.perExtraTackler`);
  - the bar: the meter's crossing (`meterSeconds`), the earliest sweet spot
    (`earliest`), the sweet spot (`byArea[n].sweet`), "close" (`near`);
  - the mash: its time (`mashSeconds`), fill per tap (`byArea[n].mashPerTap`),
    fill that drags (`mashDrag`);
  - the juke: its window (`byArea[n].jukeWindow`), the share that breaks
    (`jukeBreakShare`), the red linger (`jukeLinger`);
  - SNAG IT!: the shared countdown (`countdown.ready`, first, docs/SNAG.md
    cd-c4) and every value in `snag`, including the three sizes that were
    CSS (k1's callout): the dot (72 px), the ring's starting size (twice the
    dot) and the box (460 px at most). Pared by r-p2: seven shown (the
    countdown, the ring's close, the hit window, the next dot's share, the
    dot size, the ring's starting size, dots at most apart) and the rest,
    which shape how SNAG IT! changes over a run (and the box's linger after
    the grade), behind **More**. _Replaced:_ the call, the fourth shown,
    which the countdown replaced (cd-c7). The Coach likes
    SNAG IT! as it plays (r-p1); changes to it go on their own branch (r-p3);
  - SHOO CROWS!: the time to shoo (`crows.window`).
- **By-area values** (the sweet spot, fill per tap, juke window) edit the
  entry for the area of the picked drive; past the Farm, the Farm's (hard
  mode tightens it from there).
- **Live:** the sim keeps a reference to each tuning block and reads its
  fields as it goes, so the bench sets the field and the next rep uses it.
  The game plays `tuning.ts` with the saved settings on top (Saving, below).
- **Screen seconds:** a slider in seconds shows screen time (`tuning.ts`
  times 1/0.8); the log and the saved file write the `tuning.ts` number.
- **Reach (k5):** half the default to double it. Counts move in whole
  numbers; shares never pass 1.
- **The situation (k2):** the drive (1 to 20), the tacklers (1 to 3, Break
  it!), the crowd (1 to 3 defenders reaching) and the Hands gap (−40 to
  +40, SNAG IT!). A line sums them up, such as "drive 7 · 3 dots · ring
  0.80 s".
- **Toggles (k3):** Again (on: the next rep a second after the grade, if
  the Coach tapped in that one, so a bench left alone stops rather than
  logging reps nobody played; found driving the page, 2026-10-31, and
  approved as r-n1), Sound, Buzz, and Timing (t1). Buttons: GO, and Save
  and Restore defaults (below). _Replaced:_ Reset to shipped, and Copy
  settings (r-l2: Save does its job).
- **Kept on the phone (k4):** the situation, the toggles and the open tab.
  _Replaced (r-s5):_ the sliders were kept there too; now the bench opens
  at what the game plays, and moves not saved are gone on leaving (the page
  asks first where the browser lets it).
- **Default** is the word for a `tuning.ts` value, on screen and in
  `CONTEXT.md` (r-u4); it was "shipped".

## Saving (r-s1, r-s3–s8)

- **Saved settings** live in `src/arcade/content/saved-tuning.json`: only
  the values off their defaults, by `tuning.ts` path (`"snag.close": 0.56`).
  `tuning.ts` keeps the defaults. One function lays the saved values over
  the defaults, and the game, the balance bot and the bench all play
  through it; a value not in the file plays its default, and a missing or
  empty file plays `tuning.ts` exactly. A saved value for a setting that
  doesn't exist, or that isn't a number, is left out with a warning naming
  it.
- **Save per tab** (r-s8): each tab's Save writes that tab's values off
  default and leaves the other tabs' saved values alone; a value moved back
  to its default leaves the file. The two sliders the Break it! tabs share
  (the countdown, the extra tackler) are one value each, so they save and
  restore as one: saved on Bar, they show saved on Mash and Juke.
- **Restore defaults** (r-s4) sets the open tab's sliders to their
  defaults, as unsaved changes; Save then makes the game play them.
- **Save writes, never commits** (r-s7). The hot-reload game
  (`…:8443/vox-dev/?hard=1&aim=2`) plays a save on its next load; the
  served game (`/vox/`) rebuilds from commits, so it gets a save once the
  file is committed, at the Coach's word. While the file differs from the
  last commit the bench says "Saved · not in the served game yet" (the
  server asks git), and Claude names an uncommitted save when it finishes
  something.
- **Where Save works** (r-s6): through the hot-reload server, which writes
  the file. On the served copy Save is greyed with "Saving needs the
  hot-reload server". A failed save shows in red and keeps the changes.
- **What a tab shows:** Save counts its unsaved changes ("Save 2
  changes"), the tab's button carries a dot while there are any, and a
  saved tab says when it saved.

## The sliders (r-u1–u4)

- **Grab the knob** (r-u1): a slider moves only by dragging its knob; a
  touch on the track does nothing, and a swipe that starts off the knob
  scrolls the page. The value updates as it moves. Built on pointer events,
  since the browser's range input jumps to the touch. (The Coach's first
  session logged eight slider moves in ten seconds, down the page in
  order: slips while scrolling, by the look of it.)
- **Bigger** (r-u2): a 32 px knob with a 48 px grab area, a 10 px track,
  taller rows.
- **↺ on each** (r-u3) sets that slider to its default, as an unsaved
  change; faded while it's there already.
- **A row shows** (r-u4) a tick at the default, "saved" in the small print
  when the saved value isn't the default, and a tint with UNSAVED when it
  has moved since the last save.

## Timing (t1)

One measure per test, in screen seconds, shown after each tap when Timing is
on and written in the rep's log line:

- **bar:** where the marker was from the middle of the sweet spot ("late
  +0.05 s");
- **mash:** taps, taps a second, and how full it got;
- **juke:** the reaction to the arrow, out of the window, and a wrong side;
- **SNAG IT!:** each dot, early or late of its ring closing, filling in
  dot by dot (a dot still to play shows as …); the others show once the
  grade is in;
- **SHOO CROWS!:** the reaction to the landing, out of the window.

## The log (l1, r-l3)

- **Through the hot-reload server** (`vox-dev.sh start`, then
  `…:8443/vox-dev/dev/bench.html`): a Vite plugin takes each line at
  `__bench-log` and appends it to `/root/.local/share/vox-serve/bench.jsonl`.
  The served build is files with nothing running, so there the bench plays
  but its status bar says it isn't recording. It never claims to record
  when it doesn't.
- **Two kinds of line** (r-l3): a rep line with the test, the situation,
  the timing, the grade, and the tab's settings off default, so every rep
  says what it was played at; a save line with what was saved. _Replaced:_
  a settings line on every slider let go.
- **Into the game:** Save (above). _Replaced:_ "apply the bench", which
  brought the logged settings back as a decision map.

## Tests, written first (u1)

The knobs

1. Every slider names a real value in `tuning.ts`, starts at its default,
   and its reach holds it.
2. Each tab has its own sliders; the three Break it! tabs share the
   countdown and the extra tackler.
3. Moving a slider changes the next rep: the ring at 1.00 s on screen
   closes 1.00 s after its dot shows. Back at its default, it drops out.
4. A by-area slider edits the picked drive's area: drive 7 the Candy
   Queendom's sweet spot, drive 2 the Forest's.
5. Seconds show screen time: `snag.close` 0.64 shows 0.80 s; 1.00 s stores
   0.8.
6. SNAG IT!'s sizes, now in `tuning.ts`: at the defaults the box draws
   as before (dot 72 px, ring from twice the dot, the same box); a changed
   value draws at it.

The situation

7. The dot count follows it: drive 17 gives 5; drive 5 with a crowd of 2
   gives 3; drive 5 with Hands +20 stays 2; drive 9 with Hands −20 gives 4.
   The summary line says the same.
8. Two tacklers make the bar's sweet spot 0.6 of its size, as in the game.

The reps

9. Each tab starts its test at once: bar, mash and juke always that kind;
   SNAG IT! its box; SHOO the crows on the holder.
10. Timing comes from real taps: a SNAG IT! tap 0.05 s after its ring
    closes reads +0.05 and a hit; the bar, the mash, the juke and the shoo
    each give their measure.
11. With Again on, the next rep starts a second after the grade; off, it
    waits for GO.

The log

12. A rep line carries what's above (with its settings since M).
13. The endpoint appends each line to `bench.jsonl` as one line, and turns
    away anything that isn't a log line without writing.
14. With no endpoint, or a failing one, the status says it isn't recording.
    (Its Copy settings half went with Copy settings, r-l2.)

Keeping them

15. _Replaced by G below._ Settings come back after a reload; a saved
    value for a slider that's gone is dropped, one outside its reach is
    pulled inside it, and storage that can't be read starts from the
    defaults.

## Tests for the rework, written first (r-w2)

Tests 1–14 stay, reworded above for the defaults, the rep line's settings
and Copy settings gone.

Saved settings in the game

- **A.** With no saved file, or an empty one, the game plays `tuning.ts`
  exactly; with `snag.close` saved at 0.56 the ring closes in 0.70 s on
  screen and every other value is its default.
- **B.** A saved value for a setting that doesn't exist, or that isn't a number,
  is left out, with a warning that names it.
- **C.** `tuning.ts` lays the saved file over the defaults as it loads, so
  whatever loads it plays the save: the game, the bench, and the balance
  bot, which reads `arcadeTuning` through the sim. (Reworded by review b6:
  the test runs a bench rep, not the bot, which nothing tests; the bot's
  script runs every scenario as it's imported.)

Save and Restore

- **D.** Save on a tab writes that tab's values off default and leaves the other
  tabs' saved values alone; a value moved back to default leaves the file;
  defaults saved on every tab leave `{}`.
- **E.** The countdown saved on Bar shows saved on Mash and Juke; Restore
  defaults on Juke resets it everywhere.
- **F.** The server writes the file only for a valid settings object and turns
  anything else away without writing; it never commits (after a Save git
  shows the file changed and the last commit unchanged); it says whether the
  saved file differs from the last commit.
- **G.** After a reload the bench opens at what the game plays; moves not saved
  are gone; the situation, the toggles and the open tab come back.
- **H.** Save counts the tab's unsaved changes and the tab's button has a dot
  while there are any; "Saved · not in the served game yet" while the file
  differs from the last commit; a failed save shows in red and keeps the
  changes; with no server Save is greyed and says why.
- **I.** Restore defaults sets the open tab's sliders to their defaults, as
  unsaved changes.

The sliders

- **J.** A touch on the track off the knob changes nothing, and neither does a
  swipe that starts there; dragging the knob changes the value as it moves.
- **K.** ↺ sets one slider to its default as an unsaved change, and is faded at
  the default.
- **L.** A row shows the tick at the default, "saved" when the saved value isn't
  the default, and UNSAVED with a tint when it has moved since the last
  save.

The log, and SNAG IT!'s cut

- **M.** A rep line carries the tab's settings off default; a save line what was
  saved; moving a slider writes nothing.
- **N.** SNAG IT! shows seven sliders and the other eleven behind More, which
  opens them.

r-u2's sizes are checked by eye in a phone-sized screenshot, not a test.

## Order of work (u2)

On `test-bench`, from `snag-it` (w1), one commit each: this plan; SNAG IT!'s
sizes into `tuning.ts`; the bench's core (`src/dev/bench/`); the log; the
page; the docs reconciled.

As built, 2026-10-31: those six, plus one between the sizes and the core
that moved the game's test views (`breakView`, `snagView`, whether SHOO!
shows) out of `game.ts` into `ui/testViews.ts`, and `TIME_SCALE` into
`tuning.ts`, so the bench draws from the same code as the game.

The rework (r-w1), on `test-bench` before its review, one commit each:
this plan; saved settings in the game (A–C); Save and Restore on the bench
(D–I); the sliders (J–L); the log's new lines and Copy settings gone (M);
SNAG IT!'s cut (N); the docs reconciled.

As built, 2026-10-31: those, plus a commit before Save that renamed
"shipped" to "default" in the bench's code. Found on the way:

- **Tests play the defaults** whatever is saved: `tests/setup.ts` lays an
  empty save before every test file. With a saved ring close and no setup,
  six SNAG IT! and bench tests failed.
- **The server must not load `tuning.ts` when its config loads.** Vite
  restarts the dev server when a file the config loaded changes, and the
  config reached `saved-tuning.json` through both plugins, so every save
  reloaded the page and lost the other tabs' unsaved moves. Both plugins
  now load the game's modules per request (`ssrLoadModule`); a test reads
  Vite's own list of the config's files and fails if either file is on it.
- **One check for a saved entry** (`checkSaved` in `savedTuning.ts`): the
  game uses it as it loads, the server before it writes.
- **The JSON import carries `with { type: 'json' }`.** The Vite config
  warning about the native config loader was there before, and is still
  there.

## After review (2026-10-31)

The code review of the three branches
(https://claude.ai/artifact/Vsos1v7scqrzaxsL4j3mJB, all Fix now) changed
the bench like this:

- **Save says when** it saved, "Saved 04:12 · not in the served game yet"
  (b2), and a save's log line names the tab saved, even after a switch
  (b3).
- **Also unsaved:** under Save, any unsaved value no row shows, another
  area's by-area value, by slider and area (b10).
- **A save server with an error** says so in its words; only a missing
  server reads "Saving needs the hot-reload server" (b11).
- **Both endpoints always answer**, through `tools/endpoint.ts` (b1); their
  paths are in `src/dev/bench/endpoints.ts`, which imports nothing (b7).
- **SNAG IT!'s last dot is seen:** the box stays `snag.linger` after the
  grade, timed by the bench (a1); `snag.linger` has a slider behind More.
- **Shared with the game:** the next dot to tap (`nextDot`, a5), a drive's
  area (`driveAt`, a7), and the grade words, a Break it! outcome's grade
  and the tap tests' sounds (`ui/tapTestCalls.ts`, b8).
- **Tidier:** the slider widget in `slider.ts` (b12), `Bench` changes its
  own settings (b12), the situation's ranges in one table (b7), the tests'
  time zone and locale pinned in the test script.
- **Test C** says what it proves: whatever loads `tuning.ts` plays the save
  (b6).
