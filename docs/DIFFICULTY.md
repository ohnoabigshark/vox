# Harder, not busier

Hard mode's climb, reworked so the field doesn't fill up: fewer extra
defenders, each tougher. Planned by grilling on the decision map
(https://claude.ai/artifact/NPXDWvYYwQKcPhukLtXpnL), round 9, 2026-10-30;
the item numbers below are the map's.

## What changes (hard mode, `?hard=1`)

- **Each drive's own line-up stays** (d1): the hand-made defenses of 4 to 9
  defenders are esrauch's design. Only hard mode's extra defenders change.
- **One extra defender a zone, at most 12 on the field** (d2), instead of
  two a zone without limit. The busiest drive of each zone:

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
| Drives won, median | 9 | 11 | 10 |
| Drives won, top tenth | 14 | 19 | 15 |
| Best run | 15 | 21 | 16 |
| Passes batted | 1% | 3% | 4% |
| Break it!: broke free | 24% | 20% | 22% |

At +15, fewer defenders made hard mode easier, so the user approved +20
(map item r1): about as hard as before, with four times the batted passes
and at most 12 defenders on the field. The bot seldom gets past zone 4, so
Break it!'s tightening past the Farm barely shows here.
