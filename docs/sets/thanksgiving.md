# Thanksgiving: _Tom to the Table_

The second set (`?set=2`), after Halloween's _Get Jack Back_: the same
football, a new story, cast and three areas, in its own compartment
(`docs/PLAN.md`, Direction, "Sets", c1–c8). Designed with the user on the
Thanksgiving decision map, https://claude.ai/artifact/RaN6fDRKSF4JXWhmUwAY1r,
rounds 1–9, all 2026-11-06; the item ids below are that map's. This is the
spec the set is built from. Nothing here is built yet except the models
(drafts, `assets-src/voxels/thanksgiving/`); the build waits for Halloween's
move into `src/sets/halloween/`.

## The story

- **Tom is the ball and the QB,** as Jack is: a roast turkey, golden and
  glazed, cooked throughout the run (h1, h4). He glows a little so you can
  find him.
- **The rest of dinner carries him from the store to the table** before the
  family sits down (h1). The win: Tom lands on the platter and the feast is
  served. Game over: Tom hits the floor.
- **The tone** is a cartoon chase (g4): food, family, football. Original
  characters and no brands. No costumes or characters drawn from Pilgrims
  or Native peoples, since those come with history that isn't a joke.
- **No cutscenes or songs of its own yet** (j5, j6, rejected: _"We don't
  need a story or videos for this yet. That can be another pass."_). It
  opens and ends without a cutscene and plays Halloween's songs. Parked for
  that pass (see "Later" below).
- **The holiday multiverse** waits until the user describes it (g7).

## The team

Bareheaded: no helmets (n1, overturning i1). The team reads apart from the
defenders by colour, warm food against the critters' purple.

| Kind | Thanksgiving | Model |
| --- | --- | --- |
| Human | the Dinner Roll: a domed golden bun with a pat of butter on top | `thanksgiving/team/dinnerRoll` |
| Golem | the Cast-Iron Pan: a round black skillet, its handle off the top of its head | `thanksgiving/team/castIronPan` |
| Ghost | Mashed Potatoes: a white heap with gravy pooled on top, floating on drips (n2, in place of the Gravy Boat) | `thanksgiving/team/mashedPotatoes` |
| Werewolf | the Corn on the Cob: a tall cob with husk leaves flaring like fur | `thanksgiving/team/cornOnTheCob` |
| the ball | Tom | `thanksgiving/team/tom` |

Mashed Potatoes is drawn unlit in play, as the Ghost is, so it stays white.

## The defenders: kitchen critters

Cartoon purple, never helmeted, one look per kind for the whole run (i2, n3).

| Kind | Critter | Model |
| --- | --- | --- |
| Rusher | the Raccoon | `thanksgiving/critters/raccoon` |
| Cover | the Mouse | `thanksgiving/critters/mouse` |
| Zone | the Spider; its web is drawn on the turf where the Scarecrow's reach ring is | `thanksgiving/critters/spider` |
| Safety | the Opossum, hanging back, playing dead until the ball comes | `thanksgiving/critters/opossum` |
| Bat | the Housefly | `thanksgiving/critters/housefly` |
| Crow | the Ant, marching its lane | `thanksgiving/critters/ant` |

## The Bosses

Twice a player's size, candy purple with bright accents, as Halloween's
Bosses are (o3).

| Area | Boss | Model |
| --- | --- | --- |
| The Grocery Dash | **the Seagull**, in through the sliding doors, wings half spread, an orange beak with a stolen fry in it | `thanksgiving/bosses/seagull` |
| The Kitchen | **the Big Cheese**, a rat in a white apron, standing on a yellow wheel of cheese with a bite out of it | `thanksgiving/bosses/bigCheese` |
| The Dinner Table | **Biscuit**, the family dog, sitting up and begging: floppy ears, a red collar with a gold tag | `thanksgiving/bosses/biscuit` |

## The areas

Each plays like the Halloween area beside it, stretch for stretch (i3–i5).

### The Grocery Dash (like the Forest)

| Stretch | What's on it | Plays like |
| --- | --- | --- |
| Aisle One | a sleepy start: a Raccoon, two Mice, Opossums deep | A Quiet Clearing |
| The Cereal Aisle | the Challenge: more of them, a Spider's web | Gnome Country |
| The Deli Counter | the Gimmick: Houseflies looping their squares over the meat | Bat Cave |
| Checkout Lane | the Boss: **the Seagull** | Mister Frog's Pond |

- **The Boss's gimmick: Cart Stampede** (i3, j1), Frog Rain with carts: a
  lane in from a sideline lights up before the snap, then runaway shopping
  carts roll through it and flatten everyone in it, both teams. The call is
  **CARTED!**
- **The look:** linoleum tiles for turf, shelves along the sidelines,
  stacked cans and an orange pyramid on the field.

### The Kitchen (like the Candy Queendom)

| Stretch | What's on it | Plays like |
| --- | --- | --- |
| The Pantry | a sleepy start | Gumdrop Lane |
| The Countertop | the Challenge | Gingerbread Row |
| Over the Sink | the Gimmick: a crowd of Mice, two Opossums deep | Broomstick Alley |
| The Stove | the Boss: **the Big Cheese** | The Queen's Court |

- **The Boss's gimmick: the chewed card** (j1, from the user's note: _"a
  rat and he munches on the cards, causing 2 random players to slip at the
  start of the play"_). Before each down the Big Cheese chews one of your
  three play cards, and it shows on the card. You can still call it. If
  you do, two of your seven, picked at random (never Tom, who is the ball
  and the QB), slip at the snap and lie
  on the turf as long as the gravy spill keeps them down. A risk you
  choose, where the Queen's ban takes a card away. New gimmick code.
- **The look:** a tile floor, counters along the sidelines, pots, a mixing
  bowl and a rolling pin on the field.

### The Dinner Table (like the Farm: the last area, ending at home)

| Stretch | What's on it | Plays like |
| --- | --- | --- |
| The Kids' Table | a sleepy start | The Back Forty |
| The Good China | the Challenge: Spiders' webs among the plates | The Cornrows |
| The Ant Trail | the Gimmick: three Ants marching their lanes across the tablecloth | A Murder of Crows |
| The Head of the Table | the Boss: **Biscuit** the family dog, sitting up in front of the empty platter | The King's Patch |

- **Biscuit is in the way,** as the King is: a big body in front of the end
  zone to get Tom around.
- **The Boss's gimmick: Biscuit's bite** (i5, j2, k1). Before every down
  whose line of scrimmage is in the Head of the Table, with a big
  **CHOMP!** and before the hand is dealt, Biscuit bites one more of your
  seven who isn't bitten yet, at random. A bitten player is frozen for
  every down left in the area (the user, k1: _"ALL plays for downs where
  biscuit disables a player have that player disabled, not just a single
  play. It's a punishing mechanic."_):
  - his route goes nowhere: he stands where his slot lines up and doesn't
    run, block, catch or take a handoff; a pass to him goes past him;
  - he's still a body on the field, which defenders and your players steer
    round like a prop;
  - a handoff card whose Runner is bitten can't be called, stamped
    **BITTEN** as the Queen stamps BANNED;
  - the bench doesn't come in; a fourth down there plays four of seven
    frozen. If you reach the Head of the Table on a later down of a series,
    there are fewer downs there and fewer bites. With the Wishbone's extra
    down, that down has five.
  - Everyone is healed for the next area when hard mode goes round again.
  - Drawn: no route line before the snap, a bite out of his model, his name
    tag greyed (mockup on the map, k1). New gimmick code.
- **The look:** the tablecloth is the turf; candlesticks, the salt and
  pepper and a pie stand on it (i5, k2); the end zone is the empty
  platter. Tom lands on the platter to win.

## The words on screen

| What | Halloween | Thanksgiving |
| --- | --- | --- |
| The draft's screen | TRICK OR TREAT! | **SECONDS!** |
| Treat pickup: a burst of speed | the lightning bolt | **a mug of hot cider** |
| Trick pickup: the player slips and goes down | the oil slick, SLIPPED! | **a gravy spill**, SLIPPED! |
| The Boss lane's call | FROGGED! | **CARTED!** |

## Perks

Thanksgiving offers two perks of its own (j4), written in its folder behind
the same interface as its gimmicks (j3, c3); Second Wind and Candy Corn
Magnet stay Halloween's.

- **Gravy Train** (common): every catch gives the catcher a burst of
  speed, as the hot cider does, for the run after it.
- **The Wishbone** (rare): once a run, a failed fourth down doesn't end it:
  the wishbone snaps and you get one more down.

## Building it

- **Order** (g6, j7): Halloween's move first, in pieces, each proven
  unchanged by the same-runs digest, `balance:compare`, the wall test and
  before-and-after screenshots (PR #45); then Thanksgiving in
  `src/sets/thanksgiving/`. On hold until the field-events branches
  (statuses, the taffy flood, the wisps) are merged, at the user's ask.
- **Models** (k2): Tom, the team, the critters and the Bosses are drafted.
  Next the props, area by area.
- **Colours and the manifest, for now:** the drafts name colours from the
  shared palette, Halloween's area colours among them (`gingerbread` for the
  roast and the roll, `acornStem` for the gravy), and are listed in the
  shared `assets/manifest.json`. When the set gets its folder, c5 gives it
  its own named colours (a test then keeps its models to them) and c6 its
  own manifest, and the drafts move to those.
  They travel to Goxel and back through the models page,
  `…ts.net:8443/vox-log/models` (`docs/ART.md`, The round trip).
- **The cut list if the date runs late** (g6): the third area, then new
  gimmick code (reuse Halloween's three blocks as they are). New songs are
  already deferred.
- **The aim:** playable on the tailnet build by Thanksgiving, 2026-11-26.

## Later

Parked for a later pass, after the gameplay and the artwork (j5, j6):

- **The opening:** Tom sits in a shopping cart in the store; his team hops
  up; he asks _"Can you get me to the table before I go cold?"_, one
  answers _"Ok!"_, and they carry him off as TOM TO THE TABLE slams in a
  word at a time. Jack's scenes (`render/intro.ts`) are staged the same way.
- **The ending:** Tom lands on the platter in front of Biscuit, the whole
  team dances round him, and DINNER IS SERVED slams in.
- **Tom's glow as steam,** where Jack throws embers: puffs off him, bursting
  when he's picked up and behind each word.
- **Four songs** in the game's synth: Aisle Shuffle, Kitchen Stomp,
  Tablecloth Two-Step and Dinner Is Served; maybe a marching-band feel, for
  the parades and the football on TV.
- **Biscuit lunging** at Tom as he passes (i5), beyond the bite.
- **A palette pass** (p1, the user: _"I think we are gonna want to mess
  with the color palette a bit for this. That change can come later"_):
  Thanksgiving's own colours, which c5's per-set palette is the place for.
