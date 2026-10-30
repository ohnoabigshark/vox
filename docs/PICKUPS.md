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
  bolt** and one **oil slick**, laid from the run's seed the way props are
  (`sim/props.ts`), so a seeded run lays them out the same every time. Never
  in the middle lane, against a sideline or on a prop (a Boss included: it
  stands in the middle lane). Each stretch keeps clear of its own props and
  its neighbours', so a pickup seen ahead lies in the same place when its
  drive comes. They
  show before the snap, so you can call a play, or Flip it, to run through a
  bolt and clear of a slick.
- **Taken** (k3): the first of your players to run through a pickup takes it,
  and it's gone: it doesn't come back at the next down or the next drive (the
  map said "for the rest of the drive"; a pickup used up ahead would otherwise
  reappear when that drive starts). The rest stay put.
- **Who** (k4, the user's note on k3 and k4: "Only offense for now"): only
  your team takes them, Jack and the carrier included. Defenders run over
  them and leave them be. Jack stands in the middle until he runs, and
  pickups are never in the middle lane, so in practice it's a scrambling or
  handoff carrier, not Jack in the pocket. A player lined up on a pickup (it
  showed before the snap) takes it the moment the play starts.
- **One of each, nearly always:** each kind gets 40 tries to find a clear
  spot in its stretch; if every try lands on a prop, that kind is left out
  of that stretch. In 12,000 stretches tried (1,000 seeds) none was.
- **The bolt** (k5): whoever takes it runs 50% faster for 3 seconds, trailing
  sparks, with a zap. Both numbers are in `tuning.ts`.
- **The slick** (k6): whoever runs through it slips and lies on the turf for
  a moment, as Frog Rain flattens. A carrier who slips is tackled there:
  **SLIPPED!** A Catcher lying down can't catch (the existing rule for anyone
  down).
- **Nobody steers for them** (k7): routes run as drawn, and carriers and
  defenders pick their lanes as they do today.
- **Not in practice or the editor** (k8): practice has none, so a rep tests
  the play by itself.

## Tests, written first (k9)

1. **Placement:** a seeded run lays the same pickups every time, one of each
   per stretch, clear of the middle lane, the sidelines and props.
2. **The bolt:** running through it speeds that player by half for 3 seconds,
   then back; it's taken, and nobody else gets it.
3. **The slick:** a player who runs through it lies down; a carrier is
   tackled there (SLIPPED!); a defender runs over it and it stays.
4. **The drive:** taken pickups stay gone at the next down and the next
   drive; the rest stay put.
5. **Practice** has none.

The balance tool (`npm run balance:arcade`) runs before and after.

## On screen

A bolt is a gold zigzag of voxels, hovering and turning, drawn 1.7 times its
voxels' size so it reads from the camera; a slick is a flat ink puddle with a
purple sheen. Both are built from boxes in `render/pickups.ts` (no model
file), merged once into one geometry each, so a pickup is one draw call. Taking a bolt zaps (`zap`), a slick whoops (`slip`), and a carrier who
slips gets SLIPPED!
