# Get Jack Back: Technical

This doc covers how we build it: the stack, the architecture, the simulation, rendering, UI, audio, and how assets get made and sourced. It builds on [THEME.md](THEME.md) and [GAMEPLAY.md](GAMEPLAY.md); progress lives in [MILESTONES.md](MILESTONES.md).

Items marked **▲ Decision** are recommendations that are still open to change.

---

## 1. Goals and Constraints

- **A web game that loads from a URL.** It plays in a mobile browser, in portrait, with one thumb. Desktop browsers work too (mouse = thumb, plus a few keys).
- **Web app only for now,** with no native wrapper.
- **Performance budget:**
  - A steady **60 fps on a mid-range phone** (about 3 years old).
  - **First load under ~5 MB.** A first screen that can be played within a few seconds on 4G.
  - Low battery drain: no needless work while paused.
- **Minimal dependencies.** No game engine. Every runtime dependency has to justify itself in this doc.
- **UI polish is a top priority,** on equal footing with gameplay.
- **Deterministic rules.** The same seed and the same inputs always play out the same way, so the rules can be unit-tested and balanced headlessly.

---

## 2. Stack

| Layer | Choice | Why |
|---|---|---|
| Language | **TypeScript** (strict mode) | Safety for a codebase that's mostly Claude-written. |
| 3D | **three.js** | Mature, small enough, and no engine lock-in. |
| UI overlay | **Plain DOM + CSS** | No dependency, crisp text, and the best tools for polish (CSS animation). We'll adopt **Preact** only if menus get complex enough to need it. |
| Audio | **Web Audio API**, used directly | Synthesized music and effects, rendered at load. |
| Build / dev | **Vite** | Instant hot reload, TypeScript out of the box, static output. |
| Tests | **Vitest** | Same config as Vite, and fast. |
| Dev tooling | **playwright-core** (dev only) | Headless model previews and screenshots, driving the system Chrome. |

**Runtime dependencies: `three`. That's the whole list.** Preact (about 3 KB) is the only one we've pre-approved adding. Development-only dependencies can be added more freely, since they never ship to players.

---

## 3. Architecture

### The simulation is separate from rendering

```
          ┌───────────────────┐   state + events   ┌────────────┐
 input ──▶│    Simulation     │───────────────────▶│  Renderer  │──▶ three.js canvas
 (taps)   │ (pure TS: step(), │                    │  (reads,   │
          │  dispatch(), 60 Hz│                    │  never     │──▶ DOM overlay
          │  fixed step)      │                    │  writes)   │
          └───────────────────┘                    └────────────┘
                                                         │
                                                         └──▶ Audio (music, SFX)
```

- **The simulation** (`src/arcade/sim/`) is pure TypeScript with no three.js, DOM or `Math.random`. It advances with **`step(state, input) → { state, events }`** at a **fixed 60 steps a second** (`DT`), and actions between steps (calling a play, Flip, HIKE, TRICK OR TREAT picks) go through **`dispatch(state, action)`**, which is pure too. Every random choice comes from `rngFor(seed, ...labels)` (`sim/random.ts`), so a run is reproducible from its seed.
- **The controller** (`src/arcade/game.ts`) runs the sim from `requestAnimationFrame` with an accumulator: real time × `TIME_SCALE` (0.8, so the game plays a little slower than the sim's own numbers and balance runs are unaffected) is spent in whole fixed steps. Taps are queued and applied on the next step.
- **The renderer** (`src/arcade/render/`, `src/ui/`, `src/arcade/ui/`) never changes the game state. It reads the state every frame and reacts to events (`thrown`, `caught`, `grabbed`, `breakResult`, `downEnded`…) with sounds, pops and particles.
- **Benefits:** the rules are unit-testable, runs are deterministic, the balance tool plays whole runs without a browser, and the art can be redone without touching the rules.

### Phases

`RunState.phase` drives everything:

| Phase | What's happening |
|---|---|
| `setup` | Before the snap: three cards dealt, a card called (its routes drawn), Flip, HIKE!. |
| `play` | The down is live: the sweep, THROW, the ball in the air, the carrier running. |
| `breakit` | The carrier is grabbed: the play is frozen for a Break it! test. |
| `downOver` | A short pause showing what happened, then the next down (or drive). |
| `draft` | TRICK OR TREAT! between drives: the offer, the roster and the bench. |
| `over` / `won` | Game over, or all three areas cleared. |

### No ECS framework

The scale is sixteen-odd circle bodies on one field, so plain typed objects and arrays are enough.

---

## 4. The Simulation

**Coordinates are yards:** `x` across the field (±`field.halfWidth`, 9.1), `y` upfield. Each drive starts at `y = 0` with the first-down line at 10; the renderer's `origin` adds up earlier drives so the field is one continuous strip.

**Bodies** are circles (`Player` and `Defender`, both `Body`) with position, velocity, radius and the physics their stats give them (`sim/bodies.ts`): **Heft → mass** (×1.25 per step of 10 over 50), **Hustle → top speed**, **Hands → reach** for the ball. Stats are on a 50 scale (GAMEPLAY.md, *Your Team*); `sim/stats.ts` has the small arithmetic (`plus`, `even`).

**One step in play** (the order is in `step.ts`'s header):
1. **THROW** fires a bullet along the sweeping aim line.
2. The carrier picks the emptiest lane every so often (`ai.ts`, `chooseLane`); on a handoff it leans toward its planned route (`field.runPath`, `carrier.pathPull`).
3. Everyone moves toward their target (`ai.ts`) at their own speed; overlaps are pushed apart by weight (`physics.ts`).
4. **Frog Rain** (Mister Frog's drive): the frogs come down once a down (the countdown runs only while the play is live), flattening everyone in the lane; a carrier in it is FROGGED (tackled). **The King's crows** (his drive, `royalCrows`): they fly at the ball, land on its holder, and strike (a sack or a tackle) unless SHOO! comes first.
5. **Contact:** on a handoff, blockers drive the defenders they're on back (`physics.ts`, `driveBlocks`, by the Heft gap); a much heavier blocker pancakes the defender it's on (less so on a pass); Break it!'s difficulty is per area (`breakit.byArea`); a defender touching the carrier starts **Break it!**; running into a planted Scarecrow is a tackle, and so is a grab after the down's two Break it!s (`field.breaks`, `breakit.perDown`).
6. A carrier dragging tacklers goes down when the drag runs out.
7. **The pocket:** once its sweeps are done with the ball still at the QB, it's a sack.
8. **The bullet** in the air (`ball.ts`): who it reaches first, if anyone.
9. The carrier over the first-down line wins the drive; over the sideline, it's down there.

**Where each rule lives:**

| File | What it holds |
|---|---|
| `types.ts` | `RunState`, bodies, the ball's states, `Tackle`, `Action`, `StepInput`, `ArcadeEvent`, roster and perk types. |
| `run.ts` | `createRun`, drives and downs (`setUpDrive`, `setUpDown` deals three cards from the run's playbook; in practice its one play, already called), `dispatch` (call, Flip, hike, and TRICK OR TREAT's pick, swap, skipDraft), `endDown`, `nextDown` (in practice, the same spot again; otherwise the offer after a won drive), `downAndDistance`, `cloneRun` (the copy `step` and `dispatch` change, sharing the read-only playbook). The hike hands off on a handoff card. |
| `step.ts` | The 60 Hz step above; `canThrow`, `giveBall`, Break it! resolution, the pocket, the drag, tackles. |
| `ai.ts` | Each body's target. Blockers stand between a rusher and the QB; route runners follow their waypoints; once someone has the ball, each helper takes **its own** threat (`carryBlocks`), and on a handoff the Catchers keep running their routes as decoys. Rushers charge the QB, Covers trail their mark, the Owl hangs deep, Bats loop. **The play fake:** for a moment after a handoff the defense keeps playing the pass. `chooseLane`, `assignMarks`. |
| `physics.ts` | Moving and pushing apart by weight. Scarecrows can't be moved; teammates give way to the carrier; bodies lying down get nudged aside; blocked defenders are slowed; nobody but the carrier is shoved out of bounds. |
| `ball.ts` | The sweep (`sweepAngle`, `scanTime`, `pocketTime`, faster each area), the bullet (`bulletEnd`, `flightTime`), and `contact`: the nearest eligible catcher in reach catches it, a defender in reach bats it (a contest goes to the better Hands, ties to you); Blockers and the QB are never eligible, and a Rhino Beetle locked up with a player can't reach it. `aimContact` walks `contact` along the aim line with everyone frozen, for the line's stop point and the lit receiver. |
| `breakit.ts` | The three tests (the bar, MASH!, JUKE!), each sized by the Heft or Hustle gap and narrowed by extra tacklers, with its countdown; `judgeBreakIt` gives break, drag or tackle. |
| `team.ts` | The roster and bench: `startingRoster`, `playerStats` (own stats + perks), `fieldedStats`, the offer (`rollOffer`: two new players of different kinds, sized by zone), `bestSpot` (where a new player goes), `applyPerk` (the old perks, unused for now), spots (`BENCH_START`, `atSpot`, `setSpot`). |
| `bodies.ts` | Stats into physics, and lining both teams up for a down. |
| `pickups.ts` | Tricks and treats (fork, `docs/PICKUPS.md`): `pickupsForDrive` lays a lightning bolt and an oil slick per 10-yard stretch from the seed, each stretch clear of a fixed set of props (its own and its neighbours') so a pickup seen ahead doesn't move when its drive comes. Taking one is `takePickups` in `step.ts`; `RunState.taken` keeps them gone. |
| `props.ts` | Props on the field: laid per 10-yard stretch from the seed (`propsForDrive`), solid circles; `steerAround` (a body turns away from one in its path), `clearOfProps` (a target or waypoint inside one moves to its edge), `pushOutOfProps` (after the shoves). |
| `random.ts`, `vec.ts`, `stats.ts` | Seeded randomness, 2D vectors, stat arithmetic. |

**Determinism:** `step` and `dispatch` copy the state (`cloneRun`: a `structuredClone` of everything but the read-only playbook, which is shared) and return a new one; the input state is never modified. A test runs long seeded runs and checks the invariants (no NaNs, nobody off the field but the carrier).

---

## 5. 3D Rendering

- **Camera:** third person, behind and above the play, pitched **32°** with a 50° field of view, **pulled back exactly far enough to show both sidelines** at the row it follows, whatever the screen's shape (`game.ts`, `follow`). It follows the QB, the ball in flight and the carrier upfield, easing in during Break it!.
- **Lighting: the pumpkin is the light.** A warm point light inside the pumpkin ball casts the shadows, so they swing as it flies; the moon (`View.sun`) and the sky (`View.hemi`) are only dim fills. Fog thickens past the play.
- **Materials:** flat-shaded with **vertex colors**; no textures on voxel models. Ghosts use an unlit material so their white sheet reads in any light.
- **Voxel meshes:** greedy meshing keeps only visible faces as a few big quads; repeated models share geometry (`getGeometry` caches it), and many copies of a static prop go through an `InstancedMesh`. The turf strip is one instanced mesh.
- **What's drawn** (`src/arcade/render/`):
  - `world.ts`: yards → world (one unit a yard).
  - `field.ts`: the turf strip and the drive's lines (scrimmage, the gold first-down line).
  - `bodies.ts`: every player (its kind's model in the team helmet; Golems stretched wide and low, the one linebacker build; Ghosts hovering) and defender, turning to face where they're going and tipping over when down; the rings: gold under the carrier, each receiver's catch range (green open, red covered, gold when the aim line stops on it), and every defender's purple reach.
  - `ball.ts`, `embers.ts`: the pumpkin (it is the QB: there's no QB model), its light, and an instanced pool of embers that drift off it, trail it in flight and burst on throws and catches (the intro and outro each make their own `Embers` around their own Jack).
  - `sweep.ts`: the sweeping aim line, stopping at the first catch or block a throw now would meet (`aimNow`, from the sim's `aimContact`), and the receiver it stops on (`litPlayers`).
  - `routes.ts`: the called play's routes before the snap.
  - `frogRain.ts`: Mister Frog's lane on the turf, its shadows filling in, and the shower of frogs.
  - `pickups.ts`: the bolts (hovering, turning) and slicks, built from voxel boxes in code, and the sparks behind anyone at a bolt's speed (fork).
  - `fieldProps.ts`: the props on the field, rebuilt when a new drive lays its own; on the last drive, the pumpkin patch behind the King.
  - `royalCrows.ts`: the King's two pairs of crows (`field.crows`, in the order they go): on his arms and shoulders, flying at the ball, flapping over the holder.
  - `queenCrown.ts`: the Queen's crown glowing purple, pulsing slowly (just for looks).
  - `outro.ts`: the win cutscene: the whole roster dancing around Jack in front of the King, GOT JACK BACK (the field's own bodies and ball are hidden meanwhile).
  - `intro.ts` / `intro.css`: the opening cutscene, staged on the turf behind the start with its own camera; speech bubbles pinned over the speakers; GET. JACK. BACK.; `finish` freezes the last frame (`canvas.toDataURL`) into an overlay that fades out over the first drive.
- **Shared with the dev pages:** `src/render/view.ts` (renderer, scene, lights) and `src/render/scenery.ts` (`ForestScenery`: the forest floor, fog, props along the field, the tree line on the Boss drive).
- **Mobile performance:** the pixel ratio is capped at 2; keep draw calls low (target under ~100) and don't allocate in the frame loop.

---

## 6. UI Overlay (DOM)

**Plain DOM and CSS, layered over the WebGL canvas.** The canvas fills the screen and a DOM root sits over it; the overlay doesn't block taps by default (`pointer-events: none`), and only real controls accept them.

- **`src/ui/hud.ts`** (`Hud`): the drive banner and down and distance at the top; the prompt and the context button (PLAY, HIKE!, RESUME, AGAIN); the hand of three play cards and Flip; `pop()` for results and `big()` for Break it!'s GREAT / OK / BAD; and the **TRICK OR TREAT!** overlay: the two New Player! cards (each a player card), and the roster with the field down the left by position and the bench (no limit, newest first) down the right, each player a photo box, stat bars and a note.
- **`src/arcade/ui/controls.ts`**: THROW, SHOO!, and the Break it! panel (the countdown, the bar, the mash meter, the juke buttons).
- **`src/arcade/ui/trickOrTreat.ts`**: turns the run state into what the overlay shows (the two New Player! cards as player cards, the roster rows, the ★ on a preferred position). **`kindIcons.ts`**: each kind's 12×12 pixel portrait as inline SVG.
- **The look is retro pixel:** square corners, hard ink outlines, flat offset shadows, outlined text, segmented bars, scanlines on dark panels; the tokens are at the top of `src/ui/base.css` (`--edge`, `--text-edge`, `--scanlines`). Animations stay smooth.
- **Font:** Creepster (OFL, self-hosted in `assets/fonts`), loaded before the game is built so no text ever shows in a fallback font.
- **Colors** come from `src/content/palettes.ts` as CSS custom properties (`ui/paletteVars.ts`), so 2D and 3D always match.
- **Phone layout:** safe-area insets, `100dvh`, large thumb targets at the bottom; the TRICK OR TREAT! panel scrolls on short screens.

---

## 7. Input and Haptics

- **Every input is a tap on a DOM control:** a card, Flip, HIKE!, THROW, the Break it! panel (anywhere on it; the juke's ◀ and ▶), the offer, the roster.
- **Keys for a desktop:** 1–3 call a card, F flips, Space hikes (then throws, and taps the bar and the mash), ← and → juke, S shoos the King's crows.
- **Stopping browser gestures:** `touch-action: none` on the game surface, and no double-tap zoom, pull-to-refresh, text selection or long-press menu.
- **Haptics** (`navigator.vibrate`) are planned for the snap, throws, catches and hits. iOS Safari doesn't support vibration, so nothing may depend on it.

---

## 8. Audio

Everything goes through **one `AudioContext`**, with a small mixer: `master → (music bus, SFX bus, UI bus)`, each with its own gain and a light compressor on the master (`audio/mixer.ts`, levels in `src/content/tuning.ts`).

- **The music is the soundtrack and juice, never a clock.** `Conductor` (`src/game/conductor.ts`) starts a song on the PLAY tap (browsers only start audio from a gesture) and loops it; nothing in play waits for the beat. `setSong` switches songs: the game asks every frame for the area's song (`AREA_SONGS`, the Farm's from `FARM_SONGS`; the win screen keeps the Farm's); a new one starts in step with the beat clock, silent, and the two crossfade over two bars from the next bar line (`MusicPlayer.start`'s `fadeIn`, `fadeOut`). Pausing suspends the context; RESUME carries on.
- **Songs are data,** not audio files: patterns per stem in a compact notation (`audio/synth/notes.ts`), rendered to `AudioBuffer`s with an `OfflineAudioContext` at load and played as seamless loops. All songs share one grid (`SONG_GRID`: 120 BPM, 8-bar loops, A minor), so any two can crossfade at any moment.
- **Sound effects** are sfxr-style parameter sets (`audio/sfx.ts`), rendered at load, with voice limits and small random pitch variation. The game plays them through `Conductor.play(id)` from its event handler.
- **Samples** (public-domain or CC0) are allowed for things synthesis does badly: crowds, cheers, voices.

---

## 9. Content and Data

All game content is **typed data**, kept apart from the engine code.

```
src/arcade/content/
  tuning.ts    // arcadeTuning: every number the sim uses (field, body, contact, throw, sweep, breakit, carrier, defense, drive, run)
  team.ts      // roster roles, the standard line-up and lineUpSpot (a play's own, or standard), BASE_STATS, FORM_STATS (each kind's trade), POSITION_STAT, BENCH_SIZE, radii
  plays.ts     // PLAYS: each card's assignments (block, or a route of waypoints); handoff cards name the Runner
  ourPlays.ts  // OUR_PLAYS: plays kept from the play editor, apart from esrauch's (fork)
  playPool.ts  // PLAY_POOL: PLAYS then OUR_PLAYS; with your sketches in the game, a run's playbook (fork)
  playRules.ts // playProblems: the play rules, used by the tests and the play editor (fork)
  playCode.ts  // a play (and its line-up) in a practice link (?try=), and as plays.ts source for Copy code (fork)
  defense.ts   // DEFENDERS (each kind's stats, radius, reach bonus, planted) and FOREST: the area's drives and spots
  perks.ts     // ZONE_OFFER (a new player's total, by zone), names
src/content/
  palettes.ts  // every color: common, team, voxel (model colors), biomes
  tuning.ts    // the beat-clock page's and the mixer's numbers
```

- **Palettes have a single source of truth** (`src/content/palettes.ts`): it feeds the voxel colors, the CSS custom properties and the SVG icons.
- **Content tests** keep it honest: every play keeps the play rules in `content/playRules.ts` (its routes stay in range, every Runner gets past the line, its players line up behind the line and apart; `tests/arcade/playRules.test.ts`), and so on.

---

## 10. Drives and the Defense

- **Each area is data** in `content/defense.ts`: `FOREST`, `CANDY_KINGDOM` and `FARM`, listed in play order in `AREAS` (`areaAt(n)`). An area has an Intro, a Challenge, a Gimmick and a Boss (the same twelve drives every run), each a set of defenders at spots relative to the line of scrimmage, and flags for its Boss's gimmick (`frogRain`, `decree`: the Queen's Royal Decree sets `state.banned`, the hand's banned card, at each deal, and `call` refuses it). Every area adds `defense.perArea` to every defender's stats.
- **An area's look:** its `biome` (`forest`, `candy` or `farm`) picks the turf colours (`render/field.ts`), the floor and the sideline props (`render/scenery.ts`), each along the area's own stretch of the long field (`biomeAtYard`); its `looks` give a kind of defender its own model there (the Candy Kingdom's Covers are Gingerbread Men, its Safeties Witches), with the kind's rule unchanged.
- **The Bosses** aren't defenders: on its drive (`boss`) each is a prop in the middle of the end zone (`BOSSES`, `BOSS_SPOT` in `sim/props.ts`); on the run's last drive (`home`) `render/fieldProps.ts` lays the pumpkin patch behind the King.
- **A new defender kind** is an entry in `DEFENDERS`, a case in `ai.ts`'s `defenderTarget` if it moves in a new way, a model in `render/bodies.ts`'s `DEFENDER_MODEL`, and a balance check.

---

## 11. Asset Pipeline: Voxel Models

### The text voxel format (`.voxt`), written by Claude

A plain-text format that Claude can write, read and diff: a size, a voxel scale, a color legend, then slices or boxes.

```
# example.voxt
size 5 5 7
voxel 0.1
colors
  w bone       # names resolve to palettes.ts `voxel`
  k ink
slice 0
  .....
  .w.w.
  ...
```

- Colors are **named palette entries**, never raw hex, so changing a palette recolors everything.
- Helpers: `mirror x`, inclusive `box x0 y0 z0 x1 y1 z1 c` (`.` clears). The full format is at the top of `src/voxel/voxt.ts`.

### MagicaVoxel (`.vox`) imports

`npm run import-vox -- model.vox <folder/name>` converts a `.vox` into `.voxt`, snapping every color to the nearest named palette color, so everything in the game is one format.

### Build and runtime

- **`.voxt` is the runtime format.** Vite loads every `.voxt` under `assets-src/voxels/` as text (so edits hot-reload); it's parsed and greedy-meshed once at load into cached geometry (`src/voxel/`).
- **Model ids are paths:** `forest/chaser` is `assets-src/voxels/forest/chaser.voxt`. Folders: `team/` (our players, the ball), `forest/` (defenders and the Witch), `candy/` (the Candy Kingdom's defenders), `bosses/` (the three Bosses), `forestProps/` and `candyProps/` (scenery).
- **Orientation:** a model's front (slice 0) faces +z. In play, bodies turn to face where they're going.

### Preview loop (how Claude sees its work)

- **`npm run preview-models [ids…]`** (`tools/voxels/preview.ts`) renders each model headlessly to **PNG turntables** in `previews/`, plus a **contact sheet** per folder seen from the game camera's pitch.
- **`/dev/models.html`** does the same interactively in the browser.

---

## 12. Asset Pipeline: 2D Art

- **SVG written by Claude** for icons and UI art: tiny, scales perfectly, themed from the palette. The kinds' pixel portraits are generated as SVG from 12×12 character grids (`kindIcons.ts`).
- **Public-domain or CC0 sources** when needed: Kenney.nl, OpenGameArt.org and itch.io (filtered to CC0 or public domain), Google Fonts (OFL). Anything brought in is recolored into our palette.
- **Raster art** (if ever unavoidable) goes in atlases, served as WebP with PNG fallback.

---

## 13. Asset Pipeline: Sound and Music

| Asset | Made how | Format |
|---|---|---|
| Music | **Claude writes the song data** (patterns, stems) | `.ts` data, rendered at load |
| Most SFX | **Claude writes sfxr-style parameter sets** | `.ts` data, rendered at load |
| Organic SFX (crowd, voices) | **Public-domain or CC0 samples** | MP3 |

- **How Claude checks audio:** `npm run render-audio` (`tools/audio/render.ts`) renders a song, stem or SFX to WAV with a waveform PNG, and reports peak and loudness and a loop-seam check. **A human listens before anything ships.**
- **`/dev/audio.html`** plays every SFX and every song stem, and crossfades between songs.
- **The sing-along video:** `npx tsx tools/video/render.ts` → `previews/video/weGotJackBack.mp4` (1920×1080, H.264/AAC). It runs the game in video mode (`?win=1&video=1`: the win dance with no title, stepped by `window.__videoStep(dt)`), captures one `LOOP_BEATS` loop of it (crossfading a few extra frames over the first, so the seam doesn't jump), draws each lyric line onto a transparent strip in the game's font, and has ffmpeg repeat the loop under the song (offset so its downbeat lands on the song's first beat), with the strips over it at their times. `npx tsx tools/video/tempo.ts` measures a track's tempo and first beat (`content/dance.ts`, `WIN_TRACK_BEAT`).
- **`/dev/lyrics.html`** times the lyrics of a recorded track by tapping along (for the sing-along video): Space stamps each line's start, Enter a gap's start, Backspace undoes; it saves in localStorage and downloads `weGotJackBack.timings.json`.

---

## 14. Licensing and Credits

- **Every asset file has an entry** in `assets/manifest.json`: source, author, license, and any changes we made.
- **Allowed licenses:** CC0, public domain, OFL (fonts), and anything else only after explicit review. Claude-created assets are marked as original.
- **The build checks this:** `tools/check-assets.ts` fails if any asset file has no manifest entry, or has a license that isn't allowed.
- ▲ A credits screen generated from the manifest.

---

## 15. Saving and Settings

- **localStorage**, holding small versioned JSON (`src/settings.ts` has the settings shell).
- ▲ Best run, light unlocks, and settings (music and SFX volume, reduced motion, haptics). No accounts and no backend.
- ▲ Saving a run in progress: the state is small and serializable, so it's cheap. Recommended, so a phone call doesn't end a good run.

---

## 16. Packaging and Deployment

- **A static site:** `vite build` produces HTML, JS and assets. `.github/workflows/deploy.yml` deploys `main` to **GitHub Pages through GitHub Actions** (Pages must be set to *Source: GitHub Actions*).
- ▲ **An installable PWA:** a web app manifest (portrait, icon, theme color) and a small service worker for offline play. Not built yet.
- **Known iOS limitations:** no vibration, stricter audio unlock rules, and storage the OS can clear. We design around all three.

---

## 17. Tooling and Testing

- **TypeScript strict mode** (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), ESLint and Prettier.
- **Unit tests (Vitest)** in `tests/`, mirroring `src/`: the sim's rules (catches, contests, blocks, pancakes, Break it!, the pocket, downs and drives, perks, the roster and bench, crowding), content checks, the voxel parser and mesher, audio data, palettes.
- **Headless balance runs:** `npm run balance:arcade [runs]` (`tools/arcade-balance.ts`) plays whole runs through the sim with a bot and reports drives won, how downs end, each play type's spread of gains, Break it! results by kind, and where runs get stopped. The bot plays like a practised player by default; `BOT='{…}'` changes its knobs and `BALANCE_SCENARIO='{…}'` runs one custom scenario. It's slow (seconds a run), so use a few dozen runs per comparison.
- **Dev pages** (in the normal build so they can be tried on phones; `npm run build:release` leaves them out): `/dev/` (an index), `models.html`, `audio.html`, `beat.html` (the beat clock and calibration), `lyrics.html`, and `plays.html` (the play editor, docs/PLAY_EDITOR.md).
- **Device testing:** a regular check on a real mid-range Android phone and a real iPhone. Desktop emulation isn't enough for touch and feel.

---

## 18. Accessibility

- **Playing on mute** works: nothing depends on sound.
- **Teams differ by shape *and* color** (helmets and gold for us, candy purple and no helmets for them); check palettes for color-blind safety.
- ▲ **Reduced motion:** less shake, gentler bursts, following `prefers-reduced-motion`.
- **Large touch targets** and readable text at phone scale.

---

## 19. Project Layout

```
/
├─ index.html
├─ dev/                    // dev pages: index, models, audio, beat, lyrics, plays
├─ src/
│  ├─ main.ts              // waits for the font, then builds the game (with your sketches in the game)
│  ├─ clock.ts             // now(): the one place our code reads the wall clock (fork)
│  ├─ arcade/
│  │  ├─ game.ts           // the controller: loop, camera, input, HUD sync, feedback
│  │  ├─ content/          // tuning, team, plays, defense, perks
│  │  ├─ sim/              // the pure rules (§4)
│  │  ├─ render/           // three.js views of the sim (§5)
│  │  └─ ui/               // THROW and Break it!, TRICK OR TREAT!'s view, kind portraits
│  ├─ render/              // View (renderer, lights) and ForestScenery
│  ├─ ui/                  // the HUD, base styles, fonts, palette CSS variables
│  ├─ game/conductor.ts    // music and SFX
│  ├─ audio/               // mixer, synth, songs, SFX
│  ├─ beat/                // the beat clock (for the music and the dev beat page)
│  ├─ voxel/               // .voxt parser, mesher, model cache, .vox import
│  ├─ content/             // palettes, shared tuning
│  ├─ sim/rng.ts           // the seeded generator under arcade/sim/random.ts
│  ├─ settings.ts
│  └─ dev/                 // dev page scripts
├─ assets-src/             // voxels/, svg/, samples/
├─ assets/                 // fonts and manifest.json
├─ tools/                  // balance, screenshots, model previews, audio render, asset checks
└─ tests/
```

---

## 20. Out of Scope (for now)

Multiplayer, accounts and backends, analytics, localization (we keep text minimal so it stays possible later), native wrappers, and monetization.

---

## 21. Working Notes: How to Pick This Up Again

Everything a future session (human or Claude) needs to carry on without the original conversation. The design lives in THEME.md and GAMEPLAY.md, and progress in MILESTONES.md.

### State of play (2026-10-22)

- **Built:** the whole loop: drives of four downs over three areas, three play cards with Flip and HIKE!, the sweep and THROW, handoffs with the play fake, Break it! (bar, MASH!, JUKE!), the pumpkin ball as QB and light, TRICK OR TREAT! (two new players to choose from, the roster and bench), the four kinds' models, the retro pixel UI, and the practised balance bot.
- **Next:** flesh out the levels, defenders and Bosses (GAMEPLAY.md, *The Defense*; MILESTONES.md).
- **Loose ends:** `main` isn't pushed (the user pushes with `git -C /home/esr/Code/vox push origin main`); Pages must be switched to *Source: GitHub Actions*; an iPhone test and a listen to the waiting song loops are pending.

### Environment

- **Node 24 LTS** (`.nvmrc`). Vite 8, Vitest 5, ESLint 10, TypeScript 5 strict.
- **System Chrome** (`/usr/bin/google-chrome`) is driven by `playwright-core` (`channel: 'chrome'`) for every headless tool; WebGL runs headless via `--use-angle=swiftshader --enable-unsafe-swiftshader`.
- **Dev server:** `npm run dev` (`vite --host`, port 5173). On a phone on the same Wi-Fi: `http://<this machine>:5173/` and `/dev/`. `.claude/launch.json` has a `dev` config for the Claude desktop Browser pane.
- **URL options:** `?seed=N` fixes the run's seed; `?monsters=1` starts with Golem Blockers, Werewolf Runners and Ghost Catchers; `?area=2` or `?area=3` starts the run at that area's first drive (as if the areas before were won; the team is still the starting seven). `?win=1` goes straight from PLAY to the win cutscene (eleven recruits on the bench). `?hard=1` is hard mode (`RunState.hard`: endless zones, `driveDefense`'s extra defenders, `tuning.hard` recruits with `slowHands`, the sweep capped at the last area, `setsLineup`; the field wraps every three zones, `originOf` in game.ts). `?aim=2` is two-tap throwing (`RunState.twoTapAim`, `field.aim`, `aimDistance` / `lobTarget` in sim/ball.ts, a `lob` flight resolved only where it lands; `tuning.twoTap`). `?farmSong=2` plays the second Frederick's Farm song candidate (Spooky Cow, `FARM_SONGS`) instead of Harvest Moon Hoedown. `?try=…&sketch=…` is practice, from the play editor's Try it (`readPractice` in `content/playCode.ts`, `RunState.practice`): no PLAY screen or intro, that one play called rep after rep from the same spot on the Forest's first drive, sound from the first tap, and ‹ Sketch back to the editor between reps; a link it can't read opens the ordinary game with a notice until tapped. They combine, e.g. `?area=2&monsters=1`, except that practice ignores `?area=` and `?hard=`. In dev builds the game is `window.game`.
- **Git:** commit messages end with the `Co-Authored-By` line from the session instructions. Commit after a verified step; never push.

### Commands

| Command | What it does |
|---|---|
| `npm run check` | Lint, Prettier check, typecheck, tests, asset-license check. **Run before every commit.** |
| `npm run build` / `build:release` | The build with dev pages included (for phone testing) / without them. |
| `npm run balance:arcade [runs]` | Headless balance runs (§17). E.g. `BOT='{"runOnly":true}' BALANCE_SCENARIO='{"name":"runs"}' npm run balance:arcade 24`. |
| `npm run preview-models [ids…]` | Headless PNG turntables → `previews/<id>.png`, plus a contact sheet per folder. |
| `npm run screenshot [seed] [setup\|call\|play] [query] [name]` | A headless phone-size (375×812 @2x) capture → `previews/game.png`, `game-call.png` (a card called, routes drawn) or `game-play.png` (just after HIKE!). |
| `npm run render-audio [song:id \| stem:song/stem \| sfx:id …]` | WAVs and waveform PNGs in `previews/audio/`, with levels and a loop-seam check. |
| `npm run import-vox -- file.vox folder/name [voxelSize]` | Convert a MagicaVoxel model into `.voxt`. |

`previews/` is gitignored output: look at the PNGs with an image viewer (Claude: the Read tool). **Headless browser checks cost a lot of tokens: only run them when the user asks**; otherwise run `npm run check` and offer a browser check.

### How to make a voxel model

1. **Write `assets-src/voxels/<folder>/<name>.voxt`** (format in §11 and `src/voxel/voxt.ts`):
   - `size W H D`, then `voxel <units per voxel>`, then `colors` (one character per named color from `palettes.ts`'s `voxel` table; add new colors there, never inline hex).
   - `slice` grids are **front views**: slice 0 is the front (+z); rows run top to bottom, columns left to right. `mirror x` means each row gives the left half *including* the centre column.
   - `box` is inclusive, with y up from 0 and z from the front.
2. **Register it** in `assets/manifest.json` (`source: "Original voxel model (…), written by Claude"`, `author: "Claude"`, `license: "original"`).
3. **Preview it** (`npm run preview-models -- <id>`) and look at both the turntable and the folder's contact sheet; iterate until it reads.
4. **Use it:** `getGeometry(id)` with `voxelMaterial`; a player kind goes in `KIND_MODEL`, a defender in `DEFENDER_MODEL` (`render/bodies.ts`).

**Sizing** (one unit is a yard; a body's collision radius is about 0.4–0.6):

| Kind | Typical size | Example |
|---|---|---|
| Players | 9×14×5 at 0.08 → ~0.7 wide, 1.1 tall | `team/walkOn`, `team/ghost`, `team/werewolf`; `team/golem` at 0.09, drawn 1.45× wide |
| Defenders | 0.6–0.9 wide, 0.6–1.1 tall | `forest/*` |
| Bosses | twice a player: 17×27×9 at 0.085 (Mister Frog 17×27×17, a square footprint) → ~1.45 wide, 2.3 tall, **drawn at 2×** in play (~2.9 wide, 4.6 tall; their bodies' radius 1.45 to match) | `bosses/misterFrog`, `bosses/queen`, `bosses/king` |
| Ball | the round jack-o'-lantern at 0.15 | `team/ball` |
| Scenery props | up to 2–3 units tall | `forestProps/pine` |

**Readability rules:**
- **Judge every model from the game camera** (32° pitch, behind the play) at phone size. One shape, one rule, one telegraph: a kind should read from its silhouette alone.
- **Thin parts vanish:** make wings and similar at least 2 voxels deep.
- **Faces:** simple and spaced out; prefer a few bold blocks (two eyes, a wide grin).
- **Color rules:** **our team is gold and orange in helmets**; **every opponent is candy purple and never helmeted**. Never reuse the field's greens on anything that moves.

### How to make audio

- **Songs** are TypeScript data (`src/audio/songs/*.ts`), one string per bar per stem: melodic tokens (`A3`, `A3+C4+E4`, `-` hold, `.` rest) or drum steps (`x`, `X` accent, `.`). `steps` per bar is 8 or 16 (**12 for a triplet swing**). `validateSong` reports errors by stem and bar. Every song shares `SONG_GRID` (120 BPM, 4/4, 8 bars) in A minor, so any two crossfade at any moment; the synth's voices include a theremin, banjo, fiddle, calliope, glockenspiel, tuba, choir, piano, sax, clap, brushes, cowbell, and effects (a frog croak, a crow caw, a coffin creak, cauldron bubbles, a wolf howl, a moo); keep new songs near the others' loudness (about −17 to −14 dB RMS).
- **SFX** are entries in `SFX` (`src/audio/sfx.ts`): wave or noise, frequency slide, attack/decay, an optional filter sweep, arpeggio notes, `maxVoices`, `jitter`.
- **Check** with `npm run render-audio`: songs peak around −3 dBFS with a clean loop seam; effects roughly −7 to −16 dBFS peak. **A human must listen** before calling anything done.

### Testing changes

- **Rule changes:** add or adjust a sim test first. `tests/arcade/helpers.ts` has `playState(players, defenders)` (a down already snapped with exactly these bodies: the QB at (0, −4) with the ball, players from id 2, defenders from id 100, scrimmage 0, first down 10), plus `run(state, seconds, input)`, `carry`, `stand`, `throwAt` (times the sweep so the next THROW goes at a point), `tapAt` and `untilGrabbed` for Break it!, `body` and `ofType`. `forceBreakKind` (in `step.ts`) picks the next Break it! test.
- **Balance changes:** compare a few dozen runs of `npm run balance:arcade` before and after, with the same scenario and bot.
- **Visual changes:** `npm run check`, then a look in the browser (the user's, or a headless one when asked).

### Gotchas

- **Prettier ignores `*.md` and `*.voxt`.** Python or sed edits to `.ts` files get reformatted by `npm run format`, so don't match on line-wrapped text after a format.
- **ESLint:** non-null assertions are allowed only in `tests/**` and `src/voxel/**`; unused parameters must start with `_`.
- **Assets:** every file under `assets/` or `assets-src/` needs a manifest entry (`.gitkeep` and `manifest.json` are ignored).
- **Dev pages ship in the normal build.** Links between them must be **relative**, because Pages serves the site under `/vox/`.
- **Audio** can't start before a user gesture: songs and SFX are pre-rendered at load without a context, and the `AudioContext` is created on the PLAY tap.

---

## 22. Refactor Opportunities *(noted 2026-10-22)*

Each of these needs a bigger change than a local cleanup:

1. **Flatten the layout.** The game lives in `src/arcade/` while pieces it relies on sit beside it: `render/{view,scenery}.ts`, `game/conductor.ts`, `sim/rng.ts`, `content/{tuning,palettes}.ts`, `ui/hud.ts`. Lift `arcade/` up to `src/` (or move the rest in) and fold the two tuning files together.
2. **Split `arcade/game.ts`** (about 470 lines): the loop, the follow camera, input, the HUD sync and the event feedback (sounds and pops). The camera and `react()` would each stand alone.
3. **Give the roster screen its own component.** `ui/hud.ts` also builds TRICK OR TREAT!'s roster (field and bench columns, stat bars, recruit card) and `hud.css` carries its styles; a `roster.ts` / `roster.css` pair would keep the HUD small.
4. **Make the AI's "where to go" queries pure.** `playerTarget` advances a route's waypoint and `defenderTarget` a Bat's patrol while answering, and `carryBlocks` caches assignments in a module-level variable. Decide assignments once a step and store them in the state (e.g. `field.blocks`), and advance waypoints in a separate pass.
5. **Name the spots.** Roster spots are an implicit number (0–6 the field, 7 up the bench; `BENCH_START`), and the `place` action calls its spot `slot`. A typed spot (`{ on: 'field' | 'bench', i }`) would make swaps self-explanatory.
6. **One word for a player's kind.** It's `Form` in the types, `kind` on `RosterPlayer`, `form` on `Player`, and `FORM_STATS` in content. Pick `Kind` everywhere.
7. **Remember how the ball changed hands.** Whether a down is a handoff is worked out from `state.playbook[state.play.index].handoff` in several places; a flag set at the hike would say it once.
8. **Speed up the sim.** `step()` deep-copies the whole state every step, which makes balance runs slow (seconds a run, much more with the bot's throw look-ahead). Copy-on-write for the field, or a mutable step with explicit snapshots for tests, would make them far faster.
9. **Split the balance tool and the big test file.** `tools/arcade-balance.ts` (about 500 lines) mixes the bot, the scenarios and the report; `tests/arcade/sim.test.ts` (about 700 lines) covers everything. Split each by topic.
