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
  floor are set after a balance run and shown to the user before merging.
- **Stats grow +15 a zone** (d4) in hard mode, instead of +10: fewer
  defenders, each tougher. More Hands is more reach, so more passes are
  batted. Normal mode stays at +10.

## Not now

Interceptions (d5, d6): the user's note, "turnovers are annoying in general
when you can't respond on defense", parks them with defensive play in
`PLAN.md`. GAMEPLAY.md's "No interceptions, no fumbles" stands.

## Tests, written first (d7)

1. Hard mode's extra defenders: one a zone, and never more than 12.
2. Normal mode's line-ups and stat boosts are unchanged.
3. Hard mode's stat boost is +15 a zone.
4. Break it! tightens past zone 3 and never goes past its floor.

The balance tool runs before and after: the all-human scenario, and a
hard-mode run (zones reached).
