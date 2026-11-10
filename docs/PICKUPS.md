# Tricks and treats

Pickups on the field: things a player takes by running through them. A
**treat** helps, a **trick** hurts (`CONTEXT.md`). Planned by grilling on the
decision map (https://claude.ai/artifact/NPXDWvYYwQKcPhukLtXpnL), round 7,
2026-10-30 (all approved); the item numbers below are the map's.

## The first slice (k1)

One treat and one trick, standing still and placed by the game. Moving
pickups, more kinds and placing them in the editor are later rounds
(`PLAN.md`).

- **Where** (k2): each 10-yard stretch of the field gets one **lightning
  bolt** and one **gravestone** (an oil slick until 2026-11-10, below), laid from the run's seed the way props are
  (`sim/props.ts`), so a seeded run lays them out the same every time.
  Anywhere in from the sidelines, the middle lane included, but never on a
  prop, or on the Boss standing just past an area's goal line. _The middle
  was left out until the user, 2026-11-05: "we can have bolts and slicks in
  the midfield too. not sure why I excluded that previously."_ Each stretch
  keeps clear of its own props and
  its neighbours', so a pickup seen ahead lies in the same place when its
  series comes. Since the long field (`docs/LONG_FIELD.md`, a2) an area's
  every stretch is laid out from its first series. They
  show before the snap, so you can call a play, or Flip it, to run through a
  bolt and clear of a gravestone.
- **Taken** (k3): the first body allowed to take it (k4) that runs through a
  pickup takes it, and it's gone for everyone: it doesn't come back at the next down or the next series (the
  map said "for the rest of the drive"; a pickup used up ahead would otherwise
  reappear when that series starts). The rest stay put.
- **Who** (k4, the user's note on k3 and k4: "Only offense for now"; since
  2026-11-05 the bolt is mischief, below): your team takes them, the carrier
  included, but never Jack: he stands
  still where the ball is spotted, so a gravestone under him couldn't be dodged,
  and a bolt would do nothing. (Added by Claude with the midfield and
  confirmed by the user, 2026-11-05.) Defenders run over gravestones and leave
  them be, but take bolts (the mischief bolt, below). A player lined up on a pickup (it showed before the snap) takes
  it the moment the play starts. Since the midfield that includes a
  Blocker beside the ball, who goes down at the snap, and a handoff's
  Runner, tackled there before the play starts (TRIPPED!). Flip moves the
  Runner, not the Blockers.
- **One of each, nearly always:** each kind gets 40 tries to find a clear
  spot in its stretch; if every try lands on a prop, that kind is left out
  of that stretch. In 12,000 stretches tried (1,000 seeds) none was, again
  with the middle open (2026-11-05).
- **The bolt** (k5): whoever takes it runs 50% faster for 3 seconds, trailing
  sparks, with a zap. Both numbers are in `tuning.ts`. Since 2026-11-06 the
  speed is the **Fast** status the bolt gives (`docs/STATUSES.md`):
  `pickups.bolt.time` is how long, `statuses.fast.faster` how much.
- **The gravestone** (k6, the slick until 2026-11-10): whoever runs through
  it trips and lies on the turf for a moment (1.2 s,
  `pickups.gravestone.time`), as Frog Rain flattens. A carrier who trips is
  tackled there: **TRIPPED!** A Catcher lying down can't catch (the existing rule for anyone
  down).
- **Reach:** a player takes a pickup when its body comes within the
  pickup's reach of its middle: 0.75 yards for a bolt
  (`pickups.bolt.radius`; it was 0.5 until the user asked for 50% more,
  2026-10-30) and a yard for a gravestone (`pickups.gravestone.radius`,
  next-job map g1), so a route or lane that brushes past one takes it.
- **Nobody steers for them** (k7): routes run as drawn, and carriers and
  defenders pick their lanes as they do today.
- **Not in practice or the editor** (k8): practice has none, so a rep tests
  the play by itself.

## Tests, written first (k9)

1. **Placement:** a seeded run lays the same pickups every time, one of each
   per stretch, clear of the sidelines, props and each area's Boss, and
   sometimes in the middle lane. Jack never takes one.
2. **The bolt:** running through it speeds that player by half for 3 seconds,
   then back; it's taken, and nobody else gets it.
3. **The gravestone:** a player who runs through it lies down; a carrier is
   tackled there (TRIPPED!); a defender runs over it and it stays.
4. **The series:** taken pickups stay gone at the next down and the next
   series; the rest stay put.
5. **Practice** has none.

The balance tool (`npm run balance:arcade`) runs before and after.

## Balance

`npm run balance:arcade 40`, the "All human (never upgrade)" scenario only
(each scenario takes about 25 minutes on the droplet), 2026-10-30. The bot
never aims for or away from pickups (k7):

| | before | after |
| --- | --- | --- |
| Series won (of 12) | 8.5 | 8.3 |
| Beat the game | 35% | 30% |
| Yards a down | 4.5 | 4.7 |
| Yards a pass play | 4.6 | 4.8 |
| Passes of 10+ yards | 13% | 16% |

Within the noise of 40 runs (the win rate is 14 runs against 12): bolts add
a little to passes, slicks (now gravestones) take a little away. The bot calls handoffs only
when it has no pass card, 9 a scenario, too few to read.

Opening the middle (2026-11-05) went in without a balance run, at the
user's word. A probe of 500 seeds, three areas, a snap from every yard:
7% of snaps then had a slick (now a gravestone, which reaches further) under a Blocker beside the ball, and 13%
under a Blocker or a Runner lined up a yard off the middle.

## The mischief bolt (difficulty map b1–b6)

_User, 2026-11-04: "we turn the lightning bolt power ups to be 'mischief'
class where either side can take them, but only once the snap starts."_
Approved on the difficulty map, round 4, built on `difficulty-4`.

- **Either side, after the snap** (b1): once the ball is snapped, whoever
  runs through a bolt first takes it, yours or a defender, and it's gone for
  everyone. A defender gets the same 50% for 3 seconds, trailing the same
  sparks, with the zap (the user: "Same for both."). Before the snap nobody
  takes one, so a Bat looping over a bolt while you call the play leaves it.
  When one of yours and a defender reach the same bolt in the same step,
  yours takes it.
- **Which defenders** (b2): any on the move, Bats and Crows in the air
  included; not a planted Scarecrow, one hanging onto the carrier, or one
  lying down. The Boss is a prop, not a defender, and never takes one.
- **Gravestones stay your side's trick** (b3, said of slicks then).
- **Nobody steers for them** (b4, k7 stays): a defender takes one only when
  its chase crosses it. The balance report counts bolts taken by each side
  (`BoltWatch` in `tools/balanceCount.ts`).
- **Your record** counts only your pickups: `pickupTaken` names the side
  that took it, and a defender's bolt isn't one of yours.
- **Tests** (b6, `tests/arcade/mischiefBolt.test.ts`): a defender takes one
  after the snap, half as fast again, and it wears off; it's gone for your
  players too; a Bat before the snap leaves it; a planted, hanging or downed
  defender leaves it (fails if any of the three is dropped); a defender
  leaves a gravestone; the record and the balance count by side.

## Gravestones (next-job map, 2026-11-10)

The oil slick became a gravestone, with the same effect. _User,
2026-10-31: "change oil slicks to gravestones. same effect as it currently
has."_ Decided on the field events map (v1, 2026-10-31) and on the next-job
map (https://claude.ai/artifact/MP8EsnMZnfgnyX9DaE7cA8, rounds 1 to 3, all
approved):

- **Same effect and numbers** (v1): down 1.2 s, a carrier tackled there.
- **The call is TRIPPED!**; the sound a stumble and a thud (`trip`); the word
  "gravestone" everywhere (`PickupKind`, the `tripped` event, the docs,
  `CONTEXT.md`), nothing left saying slick but the history.
- **A yard's reach** (g1), up from the slick's 0.75, its own
  `pickups.gravestone.radius`; the bolt keeps its 0.75. Placement measures
  each kind by its own reach (`pickupRadius` in `sim/pickups.ts`).
- **The model** (g2, g4): a short rounded headstone carved RIP on a mossy
  mound, written by Claude (`assets-src/voxels/pickups/gravestone.voxt`),
  approved as is, and replaced by the user's Goxel pass if one comes back.
- **A saved `pickups.slick.time`** plays as `pickups.gravestone.time` (g3),
  and the old shared `pickups.radius` as `pickups.bolt.radius` (`RENAMED`
  in `content/savedTuning.ts`). Saved under both names, the new one plays
  and the old one is named in a warning.
- **The run's record** keeps each down's pickup kinds, so a saved record's
  slicks become gravestones as it loads (the stats store's format 3,
  `record/store.ts`). Nothing counts pickups by kind yet; the play log's
  old lines keep saying `slipped`.
- **Tests** (g5): the slick's tests renamed; a gravestone reaches a yard and
  a bolt still ¾; the carried-over saved settings; a format-2 record
  brought up to 3. The two pinned seeded-run
  digests (`statusesSameRun`, the taffy's pick) were re-pinned: at the
  slick's reach, with the old names, both give main's again, so the reach is
  the only change in play.

## On screen

A bolt is a gold zigzag of voxels, hovering and turning, drawn 1.7 times its
voxels' size so it reads from the camera, built from boxes in
`render/pickups.ts` and merged into one geometry. A gravestone is a voxel
model (`pickups/gravestone`), its carved face to the camera, each leaning a
little its own way (from where it lies). It is drawn **true to size** (the
user, 2026-11-10, after playing: "make the gravestones both true to size and
slightly brighter"): stretched as wide and deep as what it trips, twice its
reach (2 yards), and kept 0.9 yards high (`gravestoneShape` in
`render/pickups.ts`), in its own lighter stone (`graveStone`,
`graveStoneDark` in `palettes.ts`). Round 4's g6 had asked whether to mark
the reach with a ring instead; the user chose this. Taking a bolt zaps (`zap`), a gravestone stumbles and
thuds (`trip`), and a carrier who trips gets TRIPPED!
