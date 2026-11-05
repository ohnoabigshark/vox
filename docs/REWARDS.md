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
  | A catch                                    | the catcher                | +15 Hands                     |
  | GREAT on SNAG IT! or the tip drill         | the catcher                | +15 Hands more                |
  | Yards after a catch                        | the catcher                | +1 Hustle a yard              |
  | A rush of 10 yards or more                 | the carrier                | +10 Hustle, +1 a yard past 10 |
  | GREAT on Break it!                         | the carrier                | +10 Hustle                    |
  | A pancake                                  | the blocker                | +8 Heft                       |
  | A block held on a down that ends in a gain | each Blocker who held one  | +3 Heft                       |

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

## Parked

In `PLAN.md`, Later: Jack's stats and upgrades (k3); boost cards (k2);
rarity by yards and a candy shop (w1); a card that takes a play out (o2);
the playbook on Your team (v2); fewer defenders if play can't carry the
stats (g3); a BAD tap test wiping out a player's gains (t1); a tap event
for Jack against a sack (z2); pickups that raise a stat for good (s3); meta
progression (s1). Draw up a play and Select any play are rewards in this
system, grilled and built after both parts (k5).
