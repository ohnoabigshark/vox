# Results, stats and achievements

The game keeps a **record** of each run: the result of every play and every
tap test, who did what, and which plays were called. It is kept in memory
during the run, saved as the run goes, and closed when the run ends. The run's
stats, the all-time stats and the achievements are all read from it.

Planned by grilling on the decision map
https://claude.ai/artifact/1jesxDVCarUMEPTMDcwqfR, in seven rounds from
2026-11-02 to 2026-11-03. The item ids in brackets (p5, k2, x13) are that
map's, and each item's mockups and reasoning are there. The user asked for it
on 2026-10-31: _"result recording. we need to do this after each play, each
quick time event. the reason being I want to add achievements and stats."_

Code names in this doc are the ones the rename gives them (r1): `series`
where esrauch's code said `drive`.

## Words

These go into [`CONTEXT.md`](../CONTEXT.md) with the rename (w1, w2, e3).

- **Drive:** an area's march up the field, four series ending in the end
  zone. A drive is won with a touchdown, which clears the area, and it fails
  if any of its series does. A drive is as many plays as its series take, up
  to sixteen. _Avoid:_ "drive" for one series (esrauch's word for it).
- **Series:** four downs to gain 10 yards. Winning one is a **first down**;
  winning the Boss's, the area's last series, is a **touchdown**. Every area
  is four series of exactly 10 yards: yards past the first-down line don't
  carry over (g1). _Since the long field (2026-11-04, `docs/LONG_FIELD.md`)
  yards carry over, a touchdown is the ball over the goal line from any
  down, and what this plan calls the series number is the stretch number;
  a record's `reached.index` and `seriesNumber` hold the stretch, the
  furthest the run got._
- **Level:** an area, as the user says it ("we will eventually add more
  levels"). Level, area and drive name the same stretch of a run. The
  **series number** is a series' count in the run (the Candy Queendom's
  first series is 5); SNAG IT! grows with it. It was the glossary's "level"
  until 2026-11-03.
- **Rush:** a play where a Runner carries the ball from the handoff; the
  carrier's run after a catch belongs to the pass. A **run** is still a
  whole game. **Jack** throws every pass; there is no QB player.
- **Result:** what one play or one tap test came to, as the record keeps it.
- **Plays** (a count, on the screens): the downs played, one play a down.
  The screens say plays, not downs (the user, 2026-11-05); a **first down**
  keeps its name. Not the run's **Plays** tab, which lists each play
  called. In code the count is still `downs`.
- **Target:** who a pass was meant for (t1, below).
- **Air yards:** from the line of scrimmage to where a pass was caught,
  downfield only (p4). **Yards after the catch:** from there to where the
  play ended.
- **Yards after contact:** from where the carrier was first grabbed to where
  the play ended (p9).
- **Tackle for loss:** a rush or a catch brought down behind the line of
  scrimmage, by a tackle, a field event or a trick. A sack is a sack, never
  also a tackle for loss (p10, p3).

## The record

**Built from the sim's events** (a2, a3). A pure recorder in
`src/arcade/record/` takes each step's events and the state around them, fed
from the same place as the play log (`after()` in `src/arcade/game.ts`). The
sim knows nothing about stats. Where an event lacks something a result needs,
the event gains a field; the sim gains no counters. The record is kept apart
from the play log: the log is for finding bugs, the record is part of the
game.

Three events gain fields, and each player an id:

- `called` carries the play's **id** as well as its name (p5). A built-in
  play's id is fixed (`slants`); a sketch's is its sketch key (`s<time>`).
- `batted` carries the **target** (t1): the player who had a hand to it and
  lost it, or null when none of yours could reach it. A catch's target is
  the catcher. An `incomplete` never has one: by the sim's own rules
  (`contact` and `lobLanding` in `src/arcade/sim/ball.ts`) a ball an
  eligible player can reach is caught or contested, so an incomplete is
  always a throwaway. (Found building it, 2026-11-03; t1 had `incomplete`
  gain a target too.)
- Every `RosterPlayer` has an `id` (y1): the starting seven 1 to 7, then
  each recruit the team's size as it joins, which `joined` carries. The
  team only grows, so ids never repeat; names can.

**A play's result** (p1, p3, p4, p9, p10):

- the situation: series number, down, yards to go, line of scrimmage
- the call: the play's id, and whether it was flipped
- the kind, by what happened, not by the play's name: **pass**, **rush** or
  **sack**
- the outcome (first down, touchdown, tackled, incomplete, batted, sacked,
  out of bounds) and the yards gained
- who: the passer (Jack), the target and the catcher, the carrier, the
  tackler
- for a pass: air yards and yards after the catch; for a rush or a catch:
  yards after contact (none if never grabbed), and whether it was a tackle
  for loss
- along the way: tackles broken, drags, pancakes and by whom, field events,
  pickups taken (yours only: a defender's bolt isn't counted), crows
- its tap tests

**A tap test's result** (p2): the test, the player, the grade, and each tap's
hit or miss (`snagDot`, `tipPop`). Not the taps' timing. A **tackle broken**
is one BREAK, however many tacklers it sent flying (d1): `brokeTackle` is
emitted once per tackler, so it isn't counted directly.

**Players** (y1, y2, s2). Each player gets an id for the run when it joins,
so a recruit's stats are its own and not those of the player it replaced. A
player who leaves keeps their stats. Jack is a player in the record with a
fixed id. Players skill up only within a run (a1's note), so there are no
all-time stats per player.

Each player's stats for the run, counted for whoever did it, whatever their
kind or position (a Golem in a Catcher's spot gets catches):

- Jack: passes thrown and completed, passing yards, air yards, the longest
  pass, sacks taken
- catching: times targeted, catches, receiving yards, yards after the catch,
  the longest catch
- rushing: rushes, rushing yards, the longest rush
- contact: tackles broken, yards after contact, tackles for loss taken
- blocking: pancakes
- tap tests: their grades
- first downs gained

**Plays** (p5–p8). The record keeps its own copy of each play called in the
run, once per run, so editing or deleting a play later changes nothing in
it. A play is the same play by its id: a sketch redrawn mid-run is the same
play, and its stats carry on. A play from Draw up a play, when that's built,
gets an id when drawn and is kept like any other. The **most used** play is
the one called most; the **most successful** gains the most yards per call
among plays called at least 3 times, a tie going to the one called more
(p7).

**The run's stats** (s1, w1):

- how far: the drive reached (its area's name) and the series, whether the
  run was won (normal mode only), plays run, first downs, touchdowns
- passing: passes and completions, completion rate, passing yards, air
  yards, the longest pass play
- rushing: rushes, rushing yards, yards per rush, the longest rush; rushes
  against passes
- contact: tackles broken, yards after contact
- against you: sacks, tackles for loss, incompletes, batted passes
- blocking: pancakes
- tap tests: how many of each grade, for each test
- plays: the most used and the most successful
- the rest: pickups taken (yours), field events that went off, crows shooed

## Keeping it

**On the phone** (k1, k4). The record lives in the browser's storage, behind
an async store, and is never sent anywhere. Each run has a random id
(`crypto.randomUUID`), and each saved record carries the build and its format
version, so it could go to a server one day without changes (parked:
**Stats kept with your account**).

**Saving** (k2). The run in progress is saved after every down and when the
page is hidden, and closed at Game Over or a win. A run never closed (the
tab went away) is closed the next time the game opens, marked unfinished,
and counted in the totals with what it reached.

**How much** (k3). Every play of the last 20 runs; older runs keep their
summary (the run's stats, how far it got, its team). The saved format
carries a version, and older ones are brought up by numbered upgrade steps,
replayed in a test from the first format.

**Failing** (the rules' "never fail silently"). Storage that is unavailable
or unreadable shows a notice; the game still plays.

**What counts** (c1). Every real run is recorded, with the modes it was
played in (hard or not, two-tap or one, which tap tests are on), link
options included. A run made with a dev setup counts too, and its record
says so: `setup` holds the setup's changed switches as a link writes them,
'' for none (format 4, `docs/DEV_SETUP.md`, map round 5, q3). Practice (Try
it), the test bench and an event's practice link are drills and are never
recorded.

**All time** (s3), hard and normal kept apart:

- runs played, won, and the furthest reached
- totals of everything in the run's stats
- records, each kept with the run it came from: the longest pass play, the
  longest rush; the most yards, first downs and tackles broken in a run; the
  best completion rate in a run (at least 10 passes)
- best single-player runs: the most receiving yards, rushing yards and
  pancakes by one player in one run, with their name

## The screens

Drawn on the map; each gets its scenarios before its code. Nothing on screen
says "drive".

- **Game Over** (v1): a card over the dimmed field: how far (the area and
  the series), first downs, touchdowns, passing, rushing, the longests,
  tackles broken, RECORD on any all-time record broken, and the run's
  achievements; STATS above AGAIN.
- **A run's stats** (v2): one screen with tabs Players (first), Team and
  Plays. Players: a row each, tap for all their stats; one who left stays.
  Plays: each play called, its calls and yards a call, most used and most
  successful marked; tap for its drawing from the record's copy. Passing is
  Jack's line, and rushing reads "Rushing" and "Longest rush" (e3). The
  play cards keep "Run" and "Pass".
- **Winning** (v3), normal mode only: the same card titled "You got Jack
  back!", with the song as a button rather than going to YouTube on its
  own.
- **The start screen** (v4): STATS under PLAY.
- **The stats section** (v5): tabs All time, Runs and Achievements, with a
  Hard / Normal switch for the first two, Hard first. Runs newest first;
  past the last 20, only a run's Team tab.

## Achievements

Defined in one file, each an id, a name, what earns it and its check over the
record (h3). When an update adds one, the saved runs are checked for it once;
one that needs plays can only find runs among the last 20. One list for both
modes; earning one in hard mode marks it "hard", and earning it there later
adds the mark (h1). Each is earned once per phone and kept for good, with
the run and the date (m1). One earned mid-run pops at the top in the pause
after the down, about 3 s, never mid-play, one after another; one for the
whole run shows on the run's card (h2).

| Achievement | Earned by | Mode |
| --- | --- | --- |
| Air Mail (x3) | completing a pass of more than 20 air yards | both |
| Unbreakable (x15) | breaking two tackles on one play, the most a down allows | both |
| Do or Die (x10) | a first down or a touchdown on fourth down (u5) | both |
| Pancake Breakfast (x8) | five pancakes in one drive | both |
| Perfect Drive (x4) | GREAT on every tap test in a drive won, at least three | both |
| Spread the Love (x18) | a catch or a rush by five different players in one drive, won or not (u6) | both |
| Clean Sheet (x17) | winning a drive without an incomplete, a sack or a tackle for loss | both |
| Stone Hands (x14) | every pass to a Golem in one run caught, at least five | both |
| Sweet Tooth, Down on the Farm (x6, u7) | reaching the Candy Queendom; reaching Frederick's Farm (on the first snap there) | both |
| Jack's Back (x5) | winning a run | normal |
| Home Grown (x2) | winning a run without taking a TRICK OR TREAT! player (perks allowed) | normal |
| Flawless Run (x4) | GREAT on every tap test in a run won | normal |
| Rock Steady (x13) | winning a run where every pass was thrown to a Golem; a throwaway breaks it | normal |

Only normal mode wins: hard mode goes round the areas again until Game Over
(`run.ts`, `!state.hard`). The four "win a run" achievements stay
normal-mode only, since more levels will come (e2's note). Do or Die counts a
touchdown on fourth down (u5), and Spread the Love any drive, won or not
(u6), decided 2026-11-03. The achievements branch's scenarios are u4 on
the map.

## Order of work

Each a branch of its own, reviewed and merged before the next (f1, r3):

1. **`series-rename`:** esrauch's `drive` becomes `series` in the code and in
   the docs that describe the game as it is (r1, r2), tagged
   `pre-series-rename` before it opens. The user plays some rounds as a smoke
   test before it merges.
2. **`record`:** the events' new fields and the players' ids, the recorder, the store, the run's
   stats, all-time totals and records. Nothing new on screen but the notice.
   Its scenarios are f2's, below.
3. **`stats-screens`:** v1–v5.
4. **`achievements`:** the file, the pop, the hard mark, checking saved runs,
   the list above.

The record branch's scenarios (f2), written first and watched go red:

- **A pass play:** the situation, the call by id and flip, kind pass, Jack,
  target and catcher, air yards, yards after the catch, the outcome and
  yards; an incomplete has no air yards and no target; a batted pass keeps
  its target.
- **A rush:** the carrier, the yards, yards after contact from the first
  grab; a carrier never grabbed has none.
- **Sacks and losses:** a sack is its own kind; a rush or a catch brought
  down behind the line is a tackle for loss; a sack isn't.
- **Tap tests:** each with its test, player, grade and taps; tackles broken
  counted once per BREAK, with two tacklers too.
- **Plays:** a play's copy kept once a run however often it's called; a
  sketch redrawn mid-run keeps its id; most used, and most successful with
  at least 3 calls, ties to the one called more.
- **Players:** a recruit gets its own id and its stats aren't the replaced
  player's; a player who leaves keeps theirs; Jack has a fixed id.
- **The store** (a fake with failures): saved after each down and on hide;
  closed at Game Over and a win; a run left open is closed on the next
  start, unfinished, and counted; past 20 runs the oldest keep only their
  summary; all-time totals and records updated at close, hard and normal
  apart; each run has a random id, the build and the format version; the
  upgrade steps replayed from the first format; storage unavailable or
  unreadable shows a notice, never silence.
- **What counts:** a real run with link options is recorded with its modes;
  practice, the bench and an event's practice link never are.

## As built

The `record` branch, 2026-11-03. Everything is in `src/arcade/record/`:

- `types.ts`: the record's shape, `RECORD_FORMAT` (4 since the dev setup; the steps are in `store.ts`), and Jack's id (0).
- `recorder.ts`: `RunRecorder`, pure, fed each step's events with the
  state before and after; `recordable`, the one rule for which runs count.
- `stats.ts`: `runStats`, `playerStats` and `playsStats`, read from a
  record whenever wanted, so each stat is defined once.
- `allTime.ts`: `summaryOf` (what a run keeps past the last 20) and
  `addRun` (a run added to its mode's all time as it closes).
- `store.ts`: `statsStore` over the browser's storage, two keys:
  `getJackBack.stats.open` for the run in progress and `getJackBack.stats`
  for the closed runs and all time. Older formats come up through
  `src/upgrade.ts`, shared with the test bench.
- `achievements.ts`: the achievements, `earnedBy`, and what's earned
  (`earn`, `newlyEarned`, `catchUp`).
- `keeper.ts`: `StatsKeeper`, the game's side: it starts a recorder for
  each real run, saves after each down and on hide, and closes at Game
  Over or a win. `game.ts` calls it; `main.ts` passes the store.

Settled while building, beyond the map:

- **An incomplete has no target.** By the sim's rules (`contact`,
  `lobLanding`) a ball one of yours can reach is caught or contested, so
  an incomplete is a throwaway; only `batted` carries a target (t1 had both).
- **Who tackled them is the defender's kind** (`tackledBy`): a defender is
  new each down, so there's no one to name.
- **A tackle for loss is where the ball lay**, behind the line. (Until the
  long field's part 1, 2026-11-04, the line couldn't go back past the
  series' start, and the game counted such a loss as 0 yards.)
- **A down's `los` is yards from the area's start** since the long field
  (`docs/LONG_FIELD.md`), from the series' start before it. Records from
  before then mean the other; nothing reads them back.
- **A rush is a handoff with no throw;** a sack is a sack whoever caused it
  (the pocket, the King's crows).
- **Yards are kept as the sim measures them,** to the fraction; the screens
  round them.
- **A run with no down played isn't a run:** it isn't saved or closed (the
  start screen, `?win=1`'s shortcut).
- **Stats that can't be read are never written over:** the notice says so
  and the run isn't kept. A run left open that can't be read is let go,
  with a notice.
- **Each player's stats count what they did as the carrier,** so tackles
  broken, yards after contact and tackles for loss taken go to whoever
  had the ball.

### The screens

The `stats-screens` branch, 2026-11-03, from q6's scenarios:
`src/arcade/ui/statsView.ts` says what each screen shows, pure and tested;
`src/ui/stats.ts` draws it (`stats.css`), and `src/ui/playDrawing.ts`
draws a play small. Settled while building:

- **RECORD marks a record broken:** one there before the run, beaten. A
  first run in a mode breaks none. The card waits for the run to close
  and compares it with what was kept before; a run that couldn't be kept
  still gets its card.
- **The card also shows** the plays run (beside how far), the run's
  yards, and a single player's best run as its own row when it broke a
  record (best receiving, rushing or blocking run).
- **The stats section says which it is:** loading, can't be read, or no
  runs yet. A mode that's been won shows Won as its furthest.
- **A run's tabs** are Team, Players and Plays, Players open (v2's
  mockup); Players has a row for each who did anything (q6).
- **The win's card comes up 3.5 s into the dance,** once GOT JACK BACK has
  landed; `?win=1`'s shortcut, which plays no run, goes to the song as
  before.
- **Hard mode's second time round** says so: "Candy Queendom · round 2 ·
  series 1".
- **Plays are listed most called first;** Jack's row shows his name alone.
- **The stats section keeps its tab** when switching Hard and Normal.
- **"N drives won" is gone** from the top of the screen (z2).

### Achievements

The `achievements` branch, 2026-11-03, from u4's scenarios.
`src/arcade/record/achievements.ts` defines the fourteen, each a check
over the record, either for mid-run (`down`: checked after each down, and
popped) or for the whole run (`run`: checked as it closes, on the card).
Settled while building:

- **They're kept in the saved stats,** from format 2 on: the earned ones
  (the first run to earn each and when, and the hard mark) and which
  achievements have been looked for in the saved runs. Format 1 comes up
  through the first real upgrade step, so a phone with saved runs earns
  from its last 20 on its first load of this build.
- **A pop is for what's new to this phone,** or newly earned in hard mode,
  once a run each; the card lists everything the run newly earned, popped
  or not.
- **Flawless Run and Rock Steady need at least one** tap test, or pass:
  a win with none of either would earn them for nothing.
- **Hard / Normal hides on the Achievements tab:** they're one list (h1).
- **Pops wait out a play:** held from the snap until the down is over; one
  cut short shows again after it. One earned on a run's last down (the
  winning touchdown, or the down that ended it) shows on the card only.
- **Clean Sheet counts a batted pass as an incomplete,** which it is.
- **Stats that can't be read pop nothing,** and the card claims nothing
  earned: nothing would be kept.

## Parked

In [`PLAN.md`](PLAN.md), Later: meta progression (m1), stats kept with your
account (k4), stats during a run, the one-kind-team achievements (x1), the
one-way-only achievements (x9), yards that carry over and longer areas (g1),
and filing a drawn-up play away as a sketch (p8).
