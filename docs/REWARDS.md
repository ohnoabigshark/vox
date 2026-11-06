# Rewards: growth from play and a new offer

Your squad improves over a run, mostly by playing, rather than by always
bringing in new players. _User, 2026-11-01: "the idea is to provide more of
a sense of progression and improvement of your team, not always bringing in
new players but instead improving your squad."_

Planned by grilling on the decision map
(https://claude.ai/artifact/AUGh5MeCe8ZZJfxSBQdYVT), 2026-11-05, in three
rounds and a confirmation (c1). The item numbers below are the map's.

## Today

- **TRICK OR TREAT! offers only players:** two new players of different
  kinds after every first down and every touchdown; take one, no skip
  (`rollOffer`, `sim/team.ts`). The roster and bench share its screen.
- **Stats never change during a run** except by a new player taking a slot.
- **esrauch's perk pool is still in the code, never offered:** the `Perk`
  union and `applyPerk` (`sim/types.ts`, `sim/team.ts`). He offered it on
  2026-10-21, cut it to a player plus a stat boost, then to players only,
  because "the stat boost was confusing next to the new player"
  (`MILESTONES.md`, 2026-10-22).
- **Every run deals from all 13 plays** (`PLAY_POOL` plus the sketches in
  the game, `game.ts`).

## What changes

### Growth from play (part 1)

- **Only the seven on the field grow,** from what each did on that down
  (g2). Jack, the bench and practice never grow (z3); a benched player
  keeps what it gained.
- **What grows which stat,** with the starting sizes (g2, z1), all in
  `tuning.ts`:

  | What happens                               | Who                        | Gain                          |
  | ------------------------------------------ | -------------------------- | ----------------------------- |
  | A catch                                    | the catcher                | +8 Hands                      |
  | GREAT on SNAG IT! or the tip drill         | the catcher                | +7 Hands more                 |
  | Yards after a catch                        | the catcher                | +1 Hustle a yard              |
  | A rush of 10 yards or more                 | the carrier                | +10 Hustle, +1 a yard past 10 |
  | GREAT on Break it!                         | the carrier                | +10 Hustle                    |
  | A pancake                                  | the blocker                | +8 Heft                       |
  | A block held on a down that ends in a gain | each Blocker who held one  | +3 Heft                       |

  The catch sizes were +15 and +15 until 2026-11-06, halved because Hands
  (catch reach) grew too fast: a busy Catcher reached the 150 ceiling,
  with nearly four times ordinary reach, by area 3 or 4 (the user's note;
  map https://claude.ai/artifact/HcAVyNiXGEU8NCVJmYGTkJ, h1).

  A **block held** means a Blocker was touching a defender at any moment
  of a down that ends with a gain (c1). Pancakes come only
  from weight (`resolveContact`, `sim/step.ts`), so the block held gives a
  light Blocker a way to grow too.
- **The aim** (g3): a busy starter catches up with the recruits in the
  stat it uses, about a Farm recruit's main stat (140) by the Farm, about
  +45 an area. The user: "I will want to offer recruits much more rarely
  than we do today, so play needs to carry the stats." The sizes were set
  from the play log: the user's 11 runs since the long field average about
  7 downs, 3.5 catches, 2.5 rushes and 7 pancakes an area.
- **No stat grows past 150** (z2), a hard stop just above the best Farm
  recruit. Hands is reach (`handsReach`); the user: Hands is "mostly solved
  by the tap events we have on passes". **Hard mode** uses the same sizes
  and ceiling (h1).
- **Each gain is a sim event,** so the play log and the record see it.
- **Your team** (v2, g4): after every TRICK OR TREAT! pick, a screen of its
  own shows the field by position and the bench, a +N beside each player
  for what they gained since the last TRICK OR TREAT!, and the gain drawn
  green on a player's bars when tapped; then PLAY ON. Hard mode's swaps
  move here. The playbook is not shown (v2). On the field nothing shows
  (GAMEPLAY.md's pillar 4).
- In part 1 TRICK OR TREAT! still offers two new players, without the
  roster under them.

### The new offer (part 2)

- **Three cards under "Take one"** (o1, v1), stacked full width, each
  **New Play!**, **New Player!** or **Perk!**, each drawn at random: a play
  about 3 in 5, a player 1 in 5, a perk 1 in 5. No card twice in one offer;
  two players are of different kinds; nothing you hold is offered. When
  plays and perks run out, all three are players.
- **Skip** (x1) takes nothing and goes on to Your team. The button is the
  existing `hud-skip` and `skipDraft`.
- **The starting playbook** (k1, o3): esrauch's five (Slants, Deep Shot,
  Curl & Flat, Dive, Sweep) plus your sketches in the game. Every other
  play in the code can be won, a play added to `ourPlays.ts` later
  included. Practice is unchanged.
- **The perks** (k6, o4): Second Wind (once a series a BAD Break it! is a
  drag) and Candy Corn Magnet (a pass that would fall incomplete gets twice
  the catch reach), as esrauch built them. `?perks=1` starts a run holding
  both.
- **Words** (n1): the card type `Perk` becomes **offer card**, so `Perk`
  means just the perks. `CONTEXT.md` gains growth, perk, Your team and
  Skip.

## Order of work (p1)

Each part is a branch of its own, tests watched red first, balance runs
before and after, and the user plays it before it merges.

1. **`rewards-growth`:** growth from play and the Your team screen.
2. **`rewards-offer`:** the three cards, the starting playbook, the perks
   and `?perks=1`, Skip, the rename.

Growth goes first: the offer makes new players rare, which alone would
leave the squad weaker.

**Balance** (b1, b2): 40 runs each of normal and hard, from `main` and from
the branch. The report adds each player's gain per area, which is what z1 is
tuned with. The bot takes a new player if offered, then a play, then a perk,
and never skips. The numbers are a check; how it plays to the user decides.

## Tests, written first

**Part 1** (t1):

1. A catch grows the catcher's Hands by the catch size, and nobody else's.
2. A GREAT on SNAG IT! or the tip drill adds the bigger bump; OK and BAD
   add only the catch's.
3. Yards after a catch grow the catcher's Hustle by the yard.
4. A rush of 10 yards or more grows the carrier's Hustle; a 9-yard rush
   doesn't.
5. A GREAT on Break it! grows the carrier's Hustle.
6. A pancake grows the blocker's Heft; a block held on a down that gains
   grows it a little; on a down that loses, it doesn't.
7. No stat grows past 150.
8. The bench and Jack never grow; a benched player keeps what it gained.
9. A gain shows in the next down's play (a heavier, faster or surer body).
10. Practice never grows anyone.
11. The same seed and the same taps give the same growth.
12. Each gain is a sim event, so the play log and the record see it.
13. Your team shows each player's gains since the last TRICK OR TREAT!;
    PLAY ON goes on; hard mode's swaps work there (end-to-end).

**Part 2** (t2):

1. An offer is three cards, no two alike, and two players are never of the
   same kind.
2. A play already in your playbook, or a perk you hold, is never offered.
3. When plays and perks have run out, all three cards are players.
4. Over many seeds, the cards come out near 3 in 5 plays, 1 in 5 players,
   1 in 5 perks.
5. A play you take can be dealt on the next down.
6. A perk you take works as built (Second Wind's drag, the Magnet's reach).
7. Skip changes nothing and goes on to Your team.
8. A run starts with esrauch's five plus your sketches in the game;
   practice is unchanged.
9. `?perks=1` starts a run holding both perks.
10. The same seed and the same picks give the same offers.

## As built: part 1 (`rewards-growth`, 2026-11-05)

- **Where growth happens:** `sim/growth.ts`. `noteGrowth` folds each
  step's and each action's events into the down's tally (`RunState.tally`,
  by field slot) and, on `downEnded`, puts the gains on the roster
  (`applyGains`), each a `grew` event. A block held is noted where contact
  is resolved (`noteHeld` in `resolveContact`), since it isn't an event.
  `RunState.gains` keeps each player's gains since the last TRICK OR
  TREAT!, by id; leaving the draft clears it.
- **Your team is the draft once the pick is made** (`phase: 'draft'`, no
  offer), hard mode's old "Set your lineup" screen with a new title and
  PLAY ON (`skipDraft`). Each row shows its bars, as the roster always
  did: a gain is the green stretch at the end of a bar, with a green +N
  beside it (review d1: the user "really did like the green stretch on the
  bar"). There's no total beside the player. The mockup had the bars open
  on a tap; showing them on every row was simpler and already built.
- **Test 13 is unit tests, not end-to-end:** vox has no browser suite, so
  `tests/arcade/yourTeam.test.ts` covers the screen's view and the flow,
  and the user's play covers the rest. Its hard-mode swap test passed on
  its first run: the swaps already worked there.
- **The record keeps no stats,** so it passes `grew` by; the play log has
  every gain.
- **The balance report gives the busiest player and the team,** not each
  player's gain per area as b2 said: the busiest is what z1 aims at, and
  seven numbers a player would be noise (review d2).

### Balance, part 1

`npm run balance:compare 40` on 2026-11-05: main (e8d8a52) against
`rewards-growth` (8c665db). The report's new line gives, for each area,
the median over the runs of the most one player grew there (all its stats)
and the team's total.

| Scenario    | Series won, main → branch | Beat the game / median series | Busiest player's growth, areas 1–3 |
| ----------- | ------------------------- | ----------------------------- | ---------------------------------- |
| normal-pass | 8.7 → 9.2                 | 80% → 95%                     | +45, +51, +45                      |
| normal-mix  | 7.5 → 7.8                 | 88% → 95%                     | +50, +48, +45                      |
| normal-run  | 7.2 → 7.3                 | 80% → 98%                     | +56, +54, +40                      |
| hard-pass   | 7.7 → 10.4                | median 8 → 11                 | +45, +47, +46                      |
| hard-mixed  | 7.9 → 10.8                | median 8 → 10                 | +50, +54, +47                      |
| hard-run    | 6.2 → 9.8                 | median 6 → 10                 | +56, +63, +40                      |

- **The sizes land on z1's aim,** about +45 an area for the busiest
  player, and less in hard mode's later laps (the ceiling, and fewer downs
  an area).
- **Growth alone makes the game easier,** as expected: part 1 keeps a new
  player at every TRICK OR TREAT!, and part 2 makes them rare. Whether
  the two together feel right is for the user's play (b1), not these
  numbers.

## As built: part 2 (`rewards-offer`, 2026-11-05)

- **Offer cards** (n1): `OfferCard` is a play, a recruit or a perk; `Perk`
  is only the perks; the pick event is `picked`. The HUD's card face is
  `OfferFace`, one per kind.
- **The draw** (`rollOffer`, `sim/team.ts`): `offer.cards` cards, each kind
  rolled by `offer.odds` among the kinds with any left, then a card of
  that kind at random: a play from the pool not in the playbook, a perk
  not held (`holdsPerk`), a player of a kind not yet on offer.
- **Skip is `skipDraft` on the offer** (x1): it clears the offer, so Your
  team comes up; `skipDraft` on Your team is PLAY ON.
- **The starting playbook** (`startingPlaybook`, `content/playPool.ts`) is
  `createRun`'s default and what the game passes with its sketches.
  Event practice keeps the whole pool: an old test caught it starting
  with five, and practice is unchanged (o3).
- **`?perks=1`** is read in `main.ts` and passed to `createRun`'s
  `startWithPerks` (named `perks` until review v6).
- **The screen:** first built as cards stacked full width, a play drawn
  small; p5, below, made them side by side, swiped. A play card shows the
  play (`playDrawing`, as on the stats screen) and "Pass play" or "Run
  play"; a perk card its icon and what it does.

### Playtest notes, part 2 (map https://claude.ai/artifact/GLb2gi5djSAvcndrBwzfp2)

The user played `rewards-offer` and sent notes, each ruled on the map with
a mockup:

- **p2, the key stat** (c69295a): the stat a position leans on keeps an
  orange label, and its bar is drawn like the others. The orange bar had
  been painting over the green growth stretch.
- **p4, perks say when they work** (c69295a): a Magnet save sends a
  `magnet` event and pops MAGNET!; Second Wind pops SECOND WIND!, "back
  next series". Perks last the run (q1).
- **p5, the offer's cards** (60aa55d, from p1 and q2): side by side,
  swiped across, a dot for each; a play card shows the play drawn the
  card's width; Skip is always at the bottom, and nothing scrolls up and
  down. The cards sit centred between "Take one" and Skip (842153f, the
  user's note after p5).
- **p6, names on the field** (977f812, from p3): your seven's full names
  under their feet until HIKE!, never Jack or the defense. **Scope the
  user accepted onto this branch** ("another idea that I will want to
  explore on this branch"). Long names side by side may touch, a known
  risk; first names are the likely next step.

### Balance, part 2

`npm run balance:compare 40` on 2026-11-05: main (ad179d1, part 1)
against `rewards-offer` (032dc4d). The bot takes a player if offered,
then a play, then a perk (`botPick`), and never skips.

| Scenario    | Series won, part 1 → part 2 | Beat the game / median series | Before rewards (e8d8a52) |
| ----------- | --------------------------- | ----------------------------- | ------------------------ |
| normal-pass | 9.2 → 8.5                   | 95% → 93%                     | 8.7, 80%                 |
| normal-mix  | 7.8 → 7.8                   | 95% → 90%                     | 7.5, 88%                 |
| normal-run  | 7.3 → 7.0                   | 98% → 90%                     | 7.2, 80%                 |
| hard-pass   | 10.4 → 9.2                  | median 11 → 10                | 7.7, median 8            |
| hard-mixed  | 10.8 → 9.2                  | median 10 → 10                | 7.9, median 8            |
| hard-run    | 9.8 → 10.2                  | median 10 → 11                | 6.2, median 6            |

- **Part 2 takes back about half of what part 1 gave,** but the game
  stays easier for the bot than before the rewards. How it plays to the
  user decides (b1).
- **Growth holds up** with players rare: the busiest player still grows
  about +45 to +60 an area. In the Forest the running bot's busiest grows
  +79, since with five plays it hands off to the same two Runners more.
- **Picks:** by each area the bot has taken about 3 cards, 6 by the third.
  The main side's pick counts read 0, since it doesn't send `picked`.

## Parked

In `PLAN.md`, Later: Jack's stats and upgrades (k3); boost cards (k2);
rarity by yards and a candy shop (w1); a card that takes a play out (o2);
the playbook on Your team (v2); fewer defenders if play can't carry the
stats (g3); a BAD tap test wiping out a player's gains (t1); a tap event
for Jack against a sack (z2); pickups that raise a stat for good (s3); meta
progression (s1). Draw up a play and Select any play are rewards in this
system, grilled and built after both parts (k5).
