# The long field

The play goes on past the first-down line, losses count on any down, and
any down can score by reaching the end of the area. _User, 2026-11-04: "having
the ball carrier continue past the first down marker after they get a first
down instead of ending the play immediately. that means on any play, a
player on the field could score (make it to the end of the level/area) if
they are not tackled, making the power ups on the field matter more if they
are past the first down marker."_

Planned by grilling on the decision map
(https://claude.ai/artifact/5qLrncweSw1w5DgFZgo7JU), 2026-11-04, in rounds.
The item numbers below are the map's.

## Today

- **Each series is its own field.** The sim measures yards from the series'
  start: the line of scrimmage at 0, the first-down line at 10
  (`sim/types.ts`). An area is four series of exactly 10 yards: Intro,
  Challenge, Gimmick and Boss. Each has its own defense, and the Boss's has
  its gimmick (`seriesDefense`). The renderer lays them end to end on one
  long strip of turf (`originOf` in `game.ts`, `render/world.ts`).
- **A carrier over the first-down line ends the down** (`step.ts`), and the
  yards past it are thrown away.
- **A loss stops at the series' start** (`endDown` in `sim/run.ts`: "Never
  behind the series' start (there's no room for the QB)"). So a sack on 1st
  down costs nothing.
- **The field holds only this series' props and pickups,** and the Boss
  stands in his end zone only on his own series.
- **Scrolling already works.** The turf runs 30 yards behind the run's start
  and 150 ahead, and the camera follows the carrier upfield (`follow` in
  `game.ts`).

## The design

### The field (a1–a3, r1–r3)

- **An area is one 40-yard field** (a1, r1). The sim measures yards along
  the whole area. Its four **stretches** are its 10-yard parts, named Intro,
  Challenge, Gimmick and Boss. Their names (A Quiet Clearing, Gnome
  Country…) become the stretches' names. The goal line is at 40, with the
  end zone past it.
- **First downs follow football's rule** (a1, rejected for it: _"Lets go
  with football rules for now as the guiding principle."_):
  - A series is 10 yards from wherever it starts, so yards past the
    first-down line carry over.
  - Every series gains at least 10, so an area takes at most four series,
    and fewer when plays go long.
- **Each down faces the defense of the stretch its line of scrimmage is in**
  (r1). A snap from 0–10 faces the Intro's defense. A snap from 30–40 faces
  the Boss's, with his gimmick (Frog Rain, the decree, the crows). So:
  - The defense can change between downs of one series.
  - A loss back over a stretch's line brings the earlier defense back.
  - A touchdown from outside the Boss's stretch skips him.
- **The stretch number replaces the series number** (r2). It is the
  stretch of the down's line of scrimmage, counted through the run: the
  Forest 1–4, the Candy Queendom 5–8, the Farm 9–12. Everything tuned
  against the series number keeps its meaning: catch tests from 5, SNAG
  IT!'s dots, the tip drill, the pace past 10. It is also what each down
  records for the stats. Game Over's "how far" names the stretch.
- **& Goal** (r3): a series that starts within 10 yards of the goal line is
  "& Goal", and its line to gain is the goal line. The gold line is drawn on
  the goal line, as the Boss's series draws it today. _User's note: "I like
  the gold line at the end zone tho, can we keep that?"_
- **The whole area's props and pickups are on the field from its first
  down** (a2), laid where they are today (per stretch, from the run's seed,
  `docs/PICKUPS.md` k2). The Boss stands in his end zone the whole time. He
  is solid, so a carrier going for the goal line goes round him. His gimmick
  runs only on downs from his stretch (r1). A pickup taken stays gone (k3).
- **Losses count on any down** (a3), 1st included, back to a floor 10
  yards behind the area's start. A sack stays 2 yards, so a sack on 1st &
  10 makes 2nd & 12. There is turf behind every area's start.

### The play (b1–b4, c1–c2)

- **Past the first-down line the play goes on** (b1). The carrier runs
  until it is tackled (a Break it! BAD, a Safety, SLIPPED!, FROGGED!, the
  crows), runs out of bounds, or crosses the goal line. A down that ends at
  or past the line to gain wins the series (B6's rule, `endDown`).
- **The call comes at the end of the down** (b2, rejected for it: _"I don't
  want to be too disruptive while watching the play unfold."_):
  - FIRST DOWN! with its cheer when the down ends past the line.
  - The area's Cleared! over the goal line.
  - +N YARDS or LOSS OF N otherwise.
  - Nothing pops as the carrier crosses.
- **One TRICK OR TREAT! a first down** (b3, rejected for one for the down).
  Under football's rule a down wins at most one series anyway, and a
  touchdown gets one too. That is at most four an area, as today, and fewer
  after long plays. _User's note: rewards may grow with the yards a play
  gains, in the TRICK OR TREAT! overhaul (`PLAN.md`, A team that grows)._
- **A touchdown on any down clears the area** (b4), including from the
  Intro's stretch, skipping the Boss. The Cleared! call and the next area
  follow as today. On the Farm in normal mode it is the win (GOT JACK BACK).
- **Only this down's defense is on the field** (c1). The stretches ahead
  hold props, pickups and the Boss, but no defenders. A breakaway is
  stopped by the Safeties (deep, sure tackles), anyone fast enough to chase
  it, and Break it!'s two a down. _User's note: "We will need to adjust
  this/defenses in general if it becomes too easy to get past the
  defense."_ **Since the patrols** (`docs/DIFFICULTY.md`, "The long
  field", 2026-11-04): each stretch ahead keeps its Scarecrows, Bats and
  Crows on the field. The rest of its defense is still the down's only.
- **Carriers still don't steer for pickups** (c2, k7). Bolts and slicks past
  the line come into play on their own.

### The camera and the deep routes (d1–d2)

- **The camera follows as today. The area's end zone is drawn on every
  down** (d1), not only on the Boss's series.
- **A receiver off the top of the screen is left to it** (d2). A route ends
  at its last waypoint (the deepest in the pool is 26 yards). A ball goes at
  most 30 yards past the line of scrimmage (`throw.maxAhead`), so a receiver
  beyond that is out of the play.

### Elsewhere (e1–e2)

- **Balance runs before and after** (e1): touchdowns a run, yards a down,
  series won and the win rate, recorded here. Nothing is tuned until the
  Coach has played it.
- **Practice plays on too** (e2): a rep goes on past the line, and the next
  rep lines up at the same spot. There are still no pickups (k8).

## Order of work (o1)

1. **This plan,** committed first. It moves the notes' ideas into `PLAN.md`.
2. **Part 1, the area's field** (`long-field-1`):
   - The sim measures yards along the area.
   - All props and pickups, and the Boss, are out from the area's first
     down (a2).
   - The end zone is drawn on every down (d1).
   - Losses count on any down (a3).
   - Series and their lines stay as today, so the only change in play is
     that losses on a series' first snap cost yards.
   - The Coach plays it before it merges.
3. **Part 2, football's downs and the long play** (`long-field-2`):
   - Football's first downs and the stretches (a1, r1–r3).
   - The play going on (b1, b2).
   - Touchdowns from anywhere (b4) and practice playing on (e2).
   - The balance runs before and after (e1).
   - The Coach plays it before it merges.

Each part has its tests first, then typecheck, tests and lint after every
step. The docs are reconciled and the two-axis review is run before its PR.

## Part 1's tests, written first (o2)

Built 2026-11-04 on `long-field-1`, in `tests/arcade/longField.test.ts`:
the area's field (e0ac0fb; 7 passed on its first run, a regression test),
losses on any down (063d843; 1–3 red without it), the end zone on every
down (b23100a; screenshots of practice on series 1 and 3). In code:
`AREA_YARDS`, `propsForArea`, `areaPropsWithBoss` (`sim/props.ts`),
`pickupsForArea`, `areaOrigin` (`render/world.ts`), `series.furthestBack`.
The Farm's pumpkin patch, scenery behind the King, now shows the whole
Farm, since he does.

1. A sack on 1st & 10 at the area's start sets 2nd & 12, with the line of
   scrimmage 2 yards behind the start.
2. A tackle for a loss on 1st down moves the line back by the loss. A loss
   that would go further than 10 yards behind the area's start stops there.
3. A sack on the Challenge's 1st down at 10 moves the line to 8, back in the
   Intro's stretch. It is still the Challenge's series: 2nd & 12.
4. From the area's first down the field holds all four stretches' props
   and pickups and the Boss. For the same seed, they are laid where today's
   series-by-series laying puts them.
5. A pickup taken in one stretch stays gone at later downs and series. The
   rest stay put.
6. Each series still starts and ends where it does today, measured along
   the area (Intro 0–10 … Boss 30–40), in normal and hard mode. Hard mode's
   fourth zone lines up like the Forest.
7. Practice still lines every rep up at the same spot, with no pickups.

The end zone drawn on every down (d1) is checked in a phone-sized
screenshot.

## Balance, before and after (e1)

`npm run balance:arcade 40`, 2026-11-04. Before is main at c5198d7 (part 1
merged); after is `long-field-2` at 03331bf. Normal mode is "A new player
every time" (it takes one of the two TRICK OR TREAT! players each time);
hard mode is `{"hard": true, "perks": true}`, played until the run is
lost. The bot calls only passes and throws to the line or past it; it
doesn't aim for pickups.

| | Normal before | Normal after | Hard before | Hard after |
| --- | --- | --- | --- | --- |
| Areas cleared a run | 2.75¹ | 2.67 | 2.45¹ | 2.40 |
| Beat the game | 75% | 83% | — | — |
| Series won a run (TRICK OR TREAT!s) | 11.0 | 7.3 | 9.8 | 7.5 |
| Hard mode series won, p10 · median · p90 | | | 5 · 9 · 15 | 2 · 8 · 13 |
| Yards a down | 5.7 | 8.2 | 4.6 | 5.7 |
| Yards a pass play | 5.7 | 8.3 | 4.6 | 5.7 |
| Downs ending in a touchdown | not counted | 20% | not counted | 12% |
| Down length | 4.5 s | 5.5 s | 4.6 s | 5.5 s |

¹ Before, an area was always four series, so areas cleared is series won ÷
4 (the tool didn't count touchdowns then).

What it says, before the Coach has played it:
- **About as far, a little more often to the end.** Normal mode beats the
  game 83% of the time against 75%, and both modes clear about the same
  number of areas a run.
- **Long plays score.** One down in five ends in a touchdown in normal
  mode, one in eight in hard mode. Yards a pass play are up by half in
  normal mode.
- **Fewer players.** Fewer series a run means fewer TRICK OR TREAT!s:
  about 3.7 fewer in normal mode and 2.3 fewer in hard. Hard mode's
  spread widens (p10 down from 5 to 2), likely from the thinner squads
  meeting late zones. This is what your note on b3 parks for the TRICK OR
  TREAT! overhaul (`PLAN.md`).
- **The Boss's stretch is easiest to win from.** A down from it scores
  whenever it gains the yards, so 77–93% of them win a series in normal
  mode. Hard mode's third zone is the exception at 44%.

Nothing is tuned yet (e1): your play comes first, then your note on c1
(the defenses) if breakaways are too easy.

## Part 2's tests, written first (p1)

Approved on the map's round 3 (p1), which also confirmed this design as
written. In `tests/arcade/longFieldPlay.test.ts` unless named:

1. **Football's first downs:** a first down ending at 14 sets 1st & 10 from
   14, the line at 24; one ending at 33 sets 1st & Goal, the line to gain
   (and the gold line) on the goal line.
2. **Defense by stretch:** a down from 14 lines up the Challenge's defense,
   from 21 the Gimmick's, from 32 the Boss's with his gimmick; a loss from
   21 back to 18 brings the Challenge's back.
3. **The stretch number:** catch tests start on the Candy Queendom's first
   stretch (5) however many series it took; a down from 22 there is 7.
4. **The play goes on:** a carrier over the line keeps running, with no
   event at the crossing; tackled at 17, a first down, one series won, one
   TRICK OR TREAT!.
5. **Out of bounds past the line** is a first down where the carrier went
   out.
6. **A touchdown from anywhere:** from the Intro's stretch over the goal
   line clears the area, skips the Boss, one TRICK OR TREAT!, the next area
   from its 0; on the Farm in normal mode, the win.
7. **The record** (`tests/arcade/record/recorder.test.ts`): a touchdown is
   recorded as one with its yards; a won series, even on the Boss's
   stretch, is a first down.
8. **Practice:** a rep goes on past the line; the next lines up at the same
   spot.

Built 2026-11-04 on `long-field-2`. Test 5 passes for a different reason
than before: the sideline now calls it, where the line used to. The
recorder's touchdown test passed before the change (a result it was handed
went through), its first-down twin failed. "How far" on Game Over and the
stats names the stretch (Candy Queendom · Broomstick Alley), its test red
first. Older tests that pinned the play stopping at the line were
updated: a SNAG IT! or tip drill OK past the line is now tackled there
(the down still wins the series), and the King's second pair of crows can
now reach a carrier who has run on past the line.

In code: `stretchOf` and the reworked `setUpSeries` (a start in yards),
`setUpDown` (the stretch each down), `endDown` (`touchdown`), `nextDown`,
`checkCarrier` (`sim/step.ts`), the Safeties kept inside the end zone
(`lineUpDefense`), `downAndDistance`. The rename that came first:
`Series.stretch`, `stretchNumber`, `stretchAt`, `bossStretch`,
`catchTests.fromStretch`; saved records keep `index` and `seriesNumber`.
