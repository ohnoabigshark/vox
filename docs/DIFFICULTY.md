# Harder, not busier

Hard mode's climb, reworked so the field doesn't fill up: fewer extra
defenders, each tougher. Planned by grilling on the decision map
(https://claude.ai/artifact/NPXDWvYYwQKcPhukLtXpnL), round 9, 2026-10-30;
the item numbers below are the map's.

## What changes (hard mode: the default; `?hard=0` turns it off)

- **Each series' own line-up stays** (d1): the hand-made defenses of 4 to 9
  defenders are esrauch's design. Only hard mode's extra defenders change.
- **One extra defender a zone, at most 12 on the field** (d2), instead of
  two a zone without limit. The busiest series of each zone:

  | Zone | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
  | --- | --- | --- | --- | --- | --- | --- | --- |
  | Before | 8 | 11 | 13 | 14 | 17 | 19 | 20 |
  | After | 8 | 10 | 11 | 11 | 12 | 12 | 12 |

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
and at most 12 defenders on the field. The bot seldom gets past zone 4, so
Break it!'s tightening past the Farm barely shows here.

# The long field

The long field (`docs/LONG_FIELD.md`) let a play go on past the line and
score from anywhere. With only the down's own defenders on the field, a
carrier past the Safety ran clear to the goal. One down in five scored in
normal mode, and one in eight in hard mode (bot, 40 runs). The user: "just
the first level is a little too easy, I've had a few run plays that just go
the distance". Planned by grilling on the decision map
(https://claude.ai/artifact/QA9UrG4Tammp58npg1uP7v), rounds 1 and 2,
2026-11-04. The item numbers below are the map's. This pass is the
defenders only. The curses and events are parked in `PLAN.md` (c1, c2).

## The targets (g1)

For the bot, 40 runs each:

- **Hard mode** (the default): touchdowns on about 5% of downs (12% now).
- **Normal mode:** the game beaten in 75% of runs or fewer (83% now).
  Touchdowns on about 8% of downs.
- **Areas cleared** stay near today's: 2.4 in hard mode, 2.7 in normal.

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
