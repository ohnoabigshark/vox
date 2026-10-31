# The test bench

A dev page for playing the quick tap tests on their own, rep after rep, with
sliders and toggles for their settings, and a log of every change and every
rep so the settings that feel right can go into the game. Planned by grilling
on the decision map (https://claude.ai/artifact/FMYWpB3bDZLCCTZCJH1nNC),
2026-10-31, in two rounds; the item numbers below are the map's. All
approved but k5, where the Coach picked the other way ("I think half to
double is better for first pass").

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
  - all three Break it!s: the countdown (`breakit.ready`), each extra
    tackler (`breakit.perExtraTackler`);
  - the bar: the meter's crossing (`meterSeconds`), the earliest sweet spot
    (`earliest`), the sweet spot (`byArea[n].sweet`), "close" (`near`);
  - the mash: its time (`mashSeconds`), fill per tap (`byArea[n].mashPerTap`),
    fill that drags (`mashDrag`);
  - the juke: its window (`byArea[n].jukeWindow`), the share that breaks
    (`jukeBreakShare`), the red linger (`jukeLinger`);
  - SNAG IT!: every value in `snag`, including the three sizes that were
    CSS (k1's callout): the dot (72 px), the ring's starting size (twice the
    dot) and the box (460 px at most);
  - SHOO CROWS!: the time to shoo (`crows.window`).
- **By-area values** (the sweet spot, fill per tap, juke window) edit the
  entry for the area of the picked drive; past the Farm, the Farm's (hard
  mode tightens it from there).
- **Live:** the sim keeps a reference to each tuning block and reads its
  fields as it goes, so the bench sets the field and the next rep uses it.
  The game itself always plays `tuning.ts`.
- **Screen seconds:** a slider in seconds shows screen time (`tuning.ts`
  times 1/0.8); the log and Copy settings write the `tuning.ts` number.
- **Reach (k5):** half the shipped value to double it. Counts move in whole
  numbers; shares never pass 1.
- **The situation (k2):** the drive (1 to 20), the tacklers (1 to 3, Break
  it!), the crowd (1 to 3 defenders reaching) and the Hands gap (−40 to
  +40, SNAG IT!). A line sums them up, such as "drive 7 · 3 dots · ring
  0.80 s".
- **Toggles (k3):** Again (on: the next rep a second after the grade, if
  the Coach tapped in that one, so a bench left alone stops rather than
  logging reps nobody played; found driving the page, 2026-10-31),
  Sound, Buzz, and Timing (t1). Buttons: GO, Reset to shipped (the open
  tab), Copy settings (the open tab, as `tuning.ts` lines).
- **Kept on the phone (k4)** between visits, in its browser storage; a
  slider off its shipped value is tinted, with a tick at the shipped value.

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

## The log (l1–l3)

- **Through the hot-reload server** (`vox-dev.sh start`, then
  `…:8443/vox-dev/dev/bench.html`): a Vite plugin takes each line at
  `__bench-log` and appends it to `/root/.local/share/vox-serve/bench.jsonl`.
  The served build is files with nothing running, so there the bench plays
  but its status bar says it isn't recording, and Copy settings is the way
  out. It never claims to record when it doesn't.
- **Two kinds of line:** a settings line on each change (when the slider is
  let go), with the changed value, the test's whole settings as `tuning.ts`
  numbers and the situation; a rep line with the test, the situation, the
  timing and the grade.
- **Into the game:** when the Coach says "apply the bench", the last
  settings per test are compared with `tuning.ts` and brought back as a
  decision map, with the reps at those settings; what's approved goes in as
  one commit, with the docs that state those numbers and a balance run
  before and after.

## Tests, written first (u1)

The knobs

1. Every slider names a real value in `tuning.ts`, starts at the shipped
   value, and its reach holds it.
2. Each tab has its own sliders; the three Break it! tabs share the
   countdown and the extra tackler.
3. Moving a slider changes the next rep: the ring at 1.00 s on screen
   closes 1.00 s after its dot shows. Reset to shipped puts it back.
4. A by-area slider edits the picked drive's area: drive 7 the Candy
   Queendom's sweet spot, drive 2 the Forest's.
5. Seconds show screen time: `snag.close` 0.64 shows 0.80 s; 1.00 s stores
   0.8.
6. SNAG IT!'s sizes, now in `tuning.ts`: at the shipped values the box draws
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

12. A settings line and a rep line carry what's above.
13. The endpoint appends each line to `bench.jsonl` as one line, and turns
    away anything that isn't a log line without writing.
14. With no endpoint, or a failing one, the status says it isn't recording.
    Copy settings gives the open tab's values as `tuning.ts` lines.

Keeping them

15. Settings come back after a reload; a saved value for a slider that's
    gone is dropped, one outside its reach is pulled inside it, and storage
    that can't be read starts from the shipped values.

## Order of work (u2)

On `test-bench`, from `snag-it` (w1), one commit each: this plan; SNAG IT!'s
sizes into `tuning.ts`; the bench's core (`src/dev/bench/`); the log; the
page; the docs reconciled.

As built, 2026-10-31: those six, plus one between the sizes and the core
that moved the game's test views (`breakView`, `snagView`, whether SHOO!
shows) out of `game.ts` into `ui/testViews.ts`, and `TIME_SCALE` into
`tuning.ts`, so the bench draws from the same code as the game.
