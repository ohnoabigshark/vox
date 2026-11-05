# Harder, not busier

Hard mode's climb, reworked so the field doesn't fill up: fewer extra
defenders, each tougher. Planned by grilling on the decision map
(https://claude.ai/artifact/NPXDWvYYwQKcPhukLtXpnL), round 9, 2026-10-30;
the item numbers below are the map's.

## What changes (hard mode: the default; `?hard=0` turns it off)

- **Each series' own line-up stays** (d1): the hand-made defenses of 5 to 9
  defenders are esrauch's design. Only hard mode's extra defenders change.
- **One extra defender a zone, at most 12 in a down's defense** (d2; since
  the long field the patrols ahead don't count), instead of
  two a zone without limit. The busiest series of each zone:

  | Zone | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
  | --- | --- | --- | --- | --- | --- | --- | --- |
  | Before | 8 | 11 | 13 | 14 | 17 | 19 | 20 |
  | After | 8 | 10 | 11 | 11 | 12 | 12 | 12 |
  | Since the Forest's second Owl (f3) | 9 | 10 | 11 | 12 | 12 | 12 | 12 |

- **Break it! keeps tightening past zone 3** (d3), a step a zone (a narrower
  sweet spot, slower mash fill, a shorter juke window), down to a floor where
  a GREAT still breaks. It used to stop at the third area. The steps and the
  floor are checked with a balance run and shown to the user before merging:

  | Zone | 3 (as today) | 4 | 5 | 6 on (the floor) |
  | --- | --- | --- | --- | --- |
  | Bar's sweet spot | 6% | 5% | 4% | 3.5% |
  | A GREAT mash, taps a second on screen | 8.5 | 9.0 | 9.5 | 9.8 |
  | Juke: tap within (s, on screen) | 0.26 | 0.25 | 0.24 | 0.225 |

  The floor is for one tackler. Each extra tackler on the carrier still makes
  the test harder (`perExtraTackler`, as before), so a pile-up can go past
  it. The first floors (a 0.3 s juke window, 0.06 a tap) were raised after
  review: a GREAT there needed about 11 taps a second, or a tap faster than
  most people react.
- **Stats grow +20 a zone** (d4) in hard mode, instead of +10: fewer
  defenders, each tougher. More Hands is more reach, so more passes are
  batted. Normal mode stays at +10.

## Not now

Interceptions (d5, d6): the user's note, "turnovers are annoying in general
when you can't respond on defense", parks them with defensive play in
`PLAN.md`. GAMEPLAY.md's "No interceptions, no fumbles" stands.

## Tests, written first (d7)

1. Hard mode's extra defenders: one a zone, and never more than 12.
2. Normal mode's line-ups and stat boosts are unchanged.
3. Hard mode's stat boost is +20 a zone.
4. Break it! tightens past zone 3 and never goes past its floor.

The balance tool runs before and after: the all-human scenario, and a
hard-mode run (zones reached).

## Balance

`BALANCE_SCENARIO='{"name": "Hard, a new player every time", "hard": true,
"perks": true}' npm run balance:arcade 20`, 2026-10-30. Normal mode can't
change (its line-ups, boosts and Break it! are untouched, which the tests
pin, and the runs are seeded), so its all-human run was skipped.

| Hard mode, 20 runs | Before | Stats +15 | Stats +20 (shipped) |
| --- | --- | --- | --- |
| Series won, median | 9 | 11 | 10 |
| Series won, top tenth | 14 | 19 | 15 |
| Best run | 15 | 21 | 16 |
| Passes batted | 1% | 3% | 4% |
| Break it!: broke free | 24% | 20% | 22% |

At +15, fewer defenders made hard mode easier, so the user approved +20
(map item r1): about as hard as before, with four times the batted passes
and at most 12 defenders on the field (since the long field, at most 12 in
a down's defense, with the patrols ahead besides). The bot seldom gets past zone 4, so
Break it!'s tightening past the Farm barely shows here.

# The long field

The long field (`docs/LONG_FIELD.md`) let a play go on past the line and
score from anywhere. With only the down's own defenders on the field, a
carrier past the Safety ran clear to the goal. One down in five scored in
normal mode, and one in eight in hard mode (bot, 40 runs). The user: "just
the first level is a little too easy, I've had a few run plays that just go
the distance". Planned by grilling on the decision map
(https://claude.ai/artifact/QA9UrG4Tammp58npg1uP7v), rounds 1 to 5,
2026-11-04. The item numbers below are the map's. This pass is the
defenders only. The curses and events are parked in `PLAN.md` (c1, c2).

## The targets (g1)

For the bot, 40 runs each:

- **Normal mode:** the game beaten in 75% of runs or fewer (83% before the
  patrols).
- _Dropped (g3):_ touchdowns on about 5% of hard mode's downs, and 8% of
  normal mode's. Every area ends in a touchdown, most of them from the last
  10 yards, so the rate a down mostly counts how many downs an area takes:
  it held at 11–12% while long plays changed a lot.
- **Areas cleared** stay near today's: 2.4 in hard mode, 2.7 in normal.
- **Long plays are rare:** under 10% of downs in every area gain 20 yards
  or more (t4). The Owls meet it: 5–9% in the Forest, 0–9% elsewhere.
- _Dropped (t4):_ 10–20% of long plays scoring, which they did 64–77% of
  the time before the patrols and about half the time after the Owls. The
  user, after playing the Owls: "Long plays (20yds+) scoring 52% of the
  time isn't actually so bad considering the field length." In their 3
  runs, 2 of 59 downs went long.

These numbers are a guide. The user's play decides.

## Measuring first: `difficulty-1` (g2, f1, o2)

The balance tool learns to see long plays. The counting lives in
`tools/balanceCount.ts`, with tests:

- **Long plays:** downs gaining 20 yards or more, with how they ended. Each
  is counted as a run or a pass, and by area.
- **Tackles** by the tackler's kind, on all downs and on long plays.
- **Touchdowns** by the stretch of their line of scrimmage.
- **Yards past the last defender:** how far a carrier runs after the last
  defender in front of them is passed.
- **Hard mode's worst tenth** (series won at p10), reported in every run.
  If it falls below 2, the TRICK OR TREAT! overhaul comes before the next
  difficulty branch (o2).

The bot only throws by default (`passOnly`), so it never saw the runs going
the distance. Every comparison also runs it with handoffs
(`BOT='{"passOnly": false}'`) and with runs only (`"runOnly": true`).

## The patrols: `difficulty-2` (d1, p1–p4)

- **The stretches ahead keep their patrols.** On every down, each stretch
  past the line's own stretch has its own Scarecrows, Bats and Crows on the
  field, as its defense lists them (p1). Rushers, Covers and Safeties are
  the down's only. So are hard mode's extra defenders.
- **Where:** a patrol stands at its spot measured from its stretch's start,
  as if that stretch's defense lined up there (p2). Stretches behind the
  line have none. The line's own stretch lines up from the line, as now.
  This down's defenders can stand in the next stretch beside its patrols,
  and that's left as it is. Each patrol has its own stretch's stats.
- **How they act:** exactly as their kind does now (p3). A Scarecrow is
  planted and its tackle sure, even on a breakaway. A Bat loops its square
  from before the snap and dives within 3 yards. A Crow flies its lane and
  dives within 4. They can bat a pass or contest a catch. Hard mode's cap
  of 12 counts only the down's defense.
- **Seeded deals changed.** Each down's deal is seeded by the next body
  id, and the patrols take ids, so a seeded run (`?seed=N`) deals other
  hands than it did before the patrols. Accepted as a side effect; the
  playbook test's recorded hands were re-recorded.
- **The Candy Queendom stays as it is** (p4). Only the Queen's Court has
  patrols. If Candy's touchdown rate stands out after the patrols, round 3
  gives Gingerbread Row and Broomstick Alley some.
- **The Forest** (f2): the patrols come first. If its runs still go the
  distance, round 3 tunes its run defense. The candidates are the Intro's
  −10, the Rhino Beetle's fake (0.9 s), and help for the Owl.

## Tests, written first (t1, t2)

`difficulty-1`, the counts:

1. A down gaining 20 or more is a long play. It is counted with how it
   ended, as a run or a pass, and by area.
2. A tackle is counted for the tackler's kind, on all downs and on long
   plays.
3. A touchdown is counted for the stretch of its line of scrimmage.
4. The yards a carrier runs after the last defender in front of them is
   passed.
5. Hard mode's worst tenth is reported in every run.

`difficulty-2`, the patrols:

1. From the Forest's Intro, the field holds the down's defense plus
   Gnome Country's Scarecrow, Bat Cave's two Bats and the Pond's
   Scarecrow and Bat. Each stands at its spot from its stretch's start.
2. From the Gimmick stretch, only the Boss stretch's patrols are ahead.
   Nothing comes from the stretches behind.
3. From the Boss stretch, no patrols are ahead.
4. Hard mode's extras are only in the down's defense. Its cap of 12
   doesn't count patrols.
5. A carrier who runs into a Scarecrow ahead is tackled there, even on a
   breakaway.
6. A Bat ahead loops before the snap and dives at a carrier within 3 yards.
7. Practice and event practice have the patrols ahead too.

Balance runs before and after, against the targets. The user plays it
before it merges.

## Two Owls in the Forest: `difficulty-3` (f3, r3, t3)

Round 3 of the map, all approved, 2026-11-04.

- **Every Forest stretch lines up two Owls,** at −3.5 and 3.5, as deep as
  every Safety (`safetyDepth`), each shadowing your deepest player on its
  half (f3). That is how the
  Candy Queendom's and the Farm's Safeties already stand. The Forest had one
  in the middle, and 13–20% of its downs went 20+ yards, against 0–7%
  elsewhere. Each Forest defense has one more defender: the Clearing 5,
  Gnome Country 6, Bat Cave 7, the Pond 9. The Intro's −10 and the Rhino
  Beetle's fake stay, so the first level still starts gently near the line.
- **The goal-line Owl is parked** (r3, then t4): it was to come if long
  plays still scored more than 20% after the Owls. They score about half
  the time, but the scoring target is dropped, so it waits in `PLAN.md`
  in case breakaways come back.
- **Tests, written first** (t3): every Forest stretch lines up two Safeties
  at ±3.5; on the field each shadows the deepest player on its half; the
  Candy Queendom's and the Farm's defenses are unchanged
  (`tests/arcade/forestOwls.test.ts`). The extra Owl takes a body id, so the
  seeded deals were re-recorded again.

## Balance: the patrols (difficulty-2)

`npm run balance:arcade 40`, "A new player every time", normal and hard
mode, each with three bots: the default, which only throws
(`passOnly`); with handoffs (`BOT='{"passOnly": false}'`); and runs only
(`BOT='{"runOnly": true}'`). Run on 2026-11-04. Before is `difficulty-1`
(689b4de), after is `difficulty-2` (db6d4ec).

| | Before | After |
| --- | --- | --- |
| Long plays (20+ yards) that score, all six pooled | 71% | 50% |
| Long plays, % of the Forest's downs, pooled | 18% | 16% |
| Long plays stopped by a Bat, Crow or Scarecrow (the kinds that patrol) | 0% | 21–35% |
| Touchdowns on hard mode's downs (pass · handoffs · runs) | 12 · 11 · 11% | 12 · 12 · 11% |
| Normal mode beaten (pass · handoffs · runs) | 83 · 83 · 73% | 78 · 73 · 88% |
| Hard mode's series won at p10 (pass · handoffs · runs) | 2 · 2 · 2 | 3 · 3 · 2 |
| Touchdowns from the Boss stretch (the last 10 yards) | 51–66% | 61–74% |

What it says:

- **Bats, Crows and Scarecrows, which stopped no long plays before, now
  stop about a quarter of them.** The count is by kind, so a down's own
  count too, but before the patrols they stopped none. Long plays still
  score half the time, against a target of 10–20%.
- **The Forest is where the long plays are.** In the Candy Queendom and the
  Farm, long plays are 0–7% of downs. In the Forest they are 13–20%. The
  Forest lines up one Owl. The others line up two Safeties.
- **The touchdown rate a down hardly moved.** Every area ends in a
  touchdown, and most come from the last stretch, so the rate a down mostly
  counts how many downs an area takes.
- **Hard mode's worst runs held** at 2–3 series won (o2).
- The user played it: "definitely felt more fun".

The "broke clear of every defender" counts from these runs are left out. A
bug counted the last down's scorer, still standing in the end zone, toward
the next down (fixed in 5128f56, with a test).

## Balance: two Owls in the Forest (difficulty-3)

The same six scenarios, 40 runs each, 2026-11-04. Before is the patrols'
"after" (main at 347e6e4 plays the same); after is 167be7c.

| | Before | After |
| --- | --- | --- |
| Long plays (20+ yards), all six pooled | 234 | 164 |
| Long plays that score, pooled | 50% | 52% |
| Long plays, % of the Forest's downs (by scenario) | 13–20% | 5–9% |
| Normal mode beaten (pass · handoffs · runs) | 78 · 73 · 88% | 95 · 88 · 85% |
| Hard mode's series won a run (pass · handoffs · runs) | 6.9 · 7.0 · 6.0 | 8.2 · 8.2 · 6.5 |
| Hard mode's series won at p10 (pass · handoffs · runs) | 3 · 3 · 2 | 4 · 4 · 2 |
| Touchdowns from the Boss stretch | 61–74% | 64–80% |

What it says:

- **The Forest is in line now.** Its long plays fell from 13–20% of downs
  to 5–9%, near the other areas' 0–9%, and long plays overall fell by
  nearly a third.
- **A long play still scores half the time,** so r3's condition (over 20%)
  is met.
- **The passing runs got easier, but not in the Forest.** Its stretches
  were won about as often as before; the gains are in the Candy Queendom
  and the Farm. A likely cause, not yet measured: every series won brings a
  TRICK OR TREAT! pick, and a Forest won over several series, instead of by
  one long touchdown, sends more new players into the later areas. Forty
  runs are also noisy: each one deals other cards since the extra body id.
  _Measured since (n1, below): not the picks._

## Rounds 4 and 5: the picks, the bolt, then the release

All approved, 2026-11-04.

- **The picks are counted** (n1, m2): the balance report gives, for each
  area, the draft picks (TRICK OR TREAT!) a run has taken by its first snap
  there, averaged over the runs that reach it (`PickWatch` in
  `tools/balanceCount.ts`). It tests whether more picks explain the passing
  runs' easier later areas. Built on
  `difficulty-3` before it merges; the game doesn't change.
- **The mischief bolt: `difficulty-4`** (b1–b6), on its own branch after
  `difficulty-3` merges, measured on its own and played before it merges.
  Once the ball is snapped, whoever runs through a bolt first takes it,
  yours or a defender: the same 50% faster for 3 seconds for both sides
  (b1, the user: "Same for both."). Any defender moving on the field takes
  one, Bats and Crows included; not a planted Scarecrow, one hanging onto
  the carrier, or one lying down (b2). Slicks stay your side's trick (b3).
  Nobody steers for a bolt, and the balance counts the bolts each side
  takes (b4). Its tests (b6): a defender takes one after the snap and not
  before; a planted, hanging or downed defender doesn't; defenders still
  leave slicks; your side's pickup tests pass unchanged; the balance counts
  bolts by side.
- **Then the public release** (v1): the difficulty changes are finished
  when `difficulty-3` and `difficulty-4` have merged and the user has
  played both; the release goes out when the user says so. Normal mode
  beaten in 95% of the passing bot's runs, against 75%, doesn't hold it.
  The ideas logged on 2026-11-04 (the play-call levers, more passes
  blocked or dropped, stats for Jack) come after the release, on a map of
  their own.

## Balance: the picks (n1)

The same six scenarios, 40 runs each, 2026-11-05: main at 347e6e4 (before
the Owls) and `difficulty-3` at cd0a3dc, both with the pick count. Each
cell is the draft picks a run had taken by its first snap in the area,
averaged over the runs that got there.

| Scenario | Area 2, before → after | Area 3, before → after | Game beaten (normal) |
| --- | --- | --- | --- |
| Normal, pass | 2.5 → 2.6 | 5.4 → 5.6 | 78% → 95% |
| Normal, handoffs | 2.4 → 3.0 | 5.1 → 6.1 | 73% → 88% |
| Normal, runs | 2.2 → 2.6 | 4.9 → 5.1 | 88% → 85% |
| Hard, pass | 2.5 → 2.6 | 5.7 → 5.8 | |
| Hard, handoffs | 2.4 → 3.0 | 5.5 → 6.2 | |
| Hard, runs | 2.2 → 2.6 | 4.9 → 5.8 | |

What it says:

- **The picks don't explain the passing runs.** Where normal mode got
  easiest (pass, 78% to 95%), the Owls left the picks almost where they
  were, a fifth of a player more by the third area. The likeliest cause is
  noise: the extra Owl's body id deals every run other cards, so these are
  different games, and 31 against 38 wins of 40 is only about two
  standard errors apart: suggestive, not settled.
- **With handoffs, the Forest is ground out:** about one more pick by the
  third area, as guessed, though normal mode's wins rose there too.
- Both sets repeat the earlier runs' headline numbers exactly (the runs are
  seeded).
- No action: normal mode's 75% target doesn't hold the release (v1), and
  the bolt's runs (`difficulty-4`) measure it again.

## Balance: the mischief bolt (difficulty-4)

The same six scenarios, 40 runs each, 2026-11-05. Before is main at
051e824 (the Owls, bolts and slicks in the middle, Tight End Run and RB
Left); after is `difficulty-4` at d5637aa. The bolt adds no bodies, so
both sides are dealt the same cards: a closer comparison than the Owls'.

| | Before | After |
| --- | --- | --- |
| Bolts taken a run, yours (pass · handoffs · runs, normal) | 9.3 · 9.2 · 9.4 | 4.4 · 4.2 · 3.4 |
| Bolts taken a run, the defense's | 0 | 6.4–6.6 (normal), 6.8–7.8 (hard) |
| Normal mode beaten (pass · handoffs · runs) | 73 · 83 · 93% | 80 · 88 · 80% |
| Hard mode's series won a run (pass · handoffs · runs) | 8.6 · 6.9 · 5.9 | 7.7 · 7.9 · 6.2 |
| Hard mode's series won at p10 (pass · handoffs · runs) | 3 · 3 · 2 | 3 · 2 · 1 |
| Long plays, % of downs (normal: pass · handoffs · runs) | 4 · 7 · 10% | 4 · 7 · 7% |
| Long plays that score, pooled by mode (normal · hard) | 59 · 58% | 57 · 62% |

What it says:

- **Defenders take more bolts than you do:** about 6.5 a run against your
  4. They chase through more of the field, and a Bat or Crow crosses
  bolts on its beat. Your own bolts halve.
- **No clear direction overall.** Runs got harder (normal mode beaten
  93% to 80%, long plays 10% to 7% of downs); passing got a little easier
  in normal mode and a little harder in hard mode. The swings are within
  the noise of 40 runs.
- **Hard mode's worst runs:** with runs only, p10 fell from 2 to 1. That's
  the line o2 set for the TRICK OR TREAT! overhaul to come before the next
  difficulty branch. It is the fourth-worst of 40 runs, so one number to
  watch rather than a verdict.
- **The baseline moved since the Owls:** main with the midfield pickups
  and the two new plays has the passing bot beating normal mode 73% of
  the time, against 95% with the Owls alone. The new plays deal other
  hands, so this too is partly noise; normal mode is back under 75% with
  passes.
- The user plays the bolt before it merges.

