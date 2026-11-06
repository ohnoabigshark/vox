# Art: voxel models and the look

How the game's 3D art is made, drawn and judged, and what a new area or set
needs. It's the one place for the art pipeline: `TECHNICAL.md` §5 covers the
renderer around it, and `THEME.md` covers who and what the art depicts. The
decisions behind it are on the art pipeline map,
https://claude.ai/artifact/5CvJdCRtTedcMrwLYx5NUt (round 1, 2026-11-03).

## What a voxel is here

A voxel is a cube in a 3D grid with a colour, or empty: a pixel with volume.
Every character and prop is a small `.voxt` text file of them. The cubes
exist only in the files: at load each model is **greedy-meshed** into an
ordinary mesh, keeping only the faces that border empty space and merging
neighbouring faces of one colour into a single quad (the Walk-on's 482
visible faces become 100 quads). The GPU draws that mesh with flat Lambert
shading and the colours baked into its vertices. There are no textures.

The pipeline, once per model at load and then every frame:

1. `assets-src/voxels/<folder>/<name>.voxt`, loaded as text by Vite (an
   edit hot-reloads the open game).
2. Parsed into a grid of palette indices (`src/voxel/voxt.ts`, `parseVoxt`).
3. Greedy-meshed (`src/voxel/mesh.ts`, pure and unit-tested).
4. Cached as geometry with vertex colours, shared by every copy
   (`src/voxel/models.ts`, `getGeometry` and `voxelMaterial`).
5. Placed: bodies posed from the sim each frame (`src/arcade/render/bodies.ts`),
   sideline props as instanced meshes (`src/render/scenery.ts`).
6. Lit and drawn (`TECHNICAL.md` §5): the pumpkin's lamp, a dim moon and
   sky, fog into the backdrop.

## The look

What keeps the style, and what a new model must keep:

- **Few cubes.** A player is 9×14×5; the biggest model is under 3,000
  cubes. Faces are a few bold blocks: two eyes, a wide grin.
- **One palette of named colours** (`src/content/palettes.ts`, `voxel`).
  Models name colours (`pumpkin`, `purpleDark`) and never write hex, so one
  edit there recolours every model, and 2D art and CSS draw from the same
  file. A new colour is added there, by name.
- **Flat shading, no textures.** A face's tone comes only from which way it
  faces, so tops, fronts and sides read as three shades.
- **The pumpkin is the light** (`src/render/gameLight.ts`): orange lamp light
  and moving shadows near the ball, dim purple dusk elsewhere.
- **Readability:**
  - Judge every model from the game camera (32° pitch, behind the play) at
    phone size, in the game's light. One shape, one rule, one telegraph: a
    kind should read from its silhouette alone.
  - Thin parts vanish: wings and the like at least 2 voxels deep.
  - Our team is gold and orange, in helmets. Every opponent is candy purple
    and never helmeted. Nothing that moves uses the field's greens.

## Sizes

One unit is a yard; a body's collision radius is about 0.4–0.6.

| Kind | Typical size | Example |
|---|---|---|
| Players | 9×14×5 at 0.08 → ~0.7 wide, 1.1 tall | `team/walkOn`, `team/ghost`, `team/werewolf`; `team/golem` at 0.09, drawn 1.45× wide |
| Defenders | 0.6–0.9 wide, 0.6–1.1 tall | `forest/*` |
| Bosses | twice a player: 17×27×9 at 0.085 (Mister Frog 17×27×17, a square footprint) → ~1.45 wide, 2.3 tall, **drawn at 2×** in play (~2.9 wide, 4.6 tall; their bodies' radius 1.45 to match) | `bosses/misterFrog`, `bosses/queen`, `bosses/king` |
| Ball | the round jack-o'-lantern at 0.15 | `team/ball` |
| Scenery props | up to 2–3 units tall | `forestProps/pine` |

## The `.voxt` format

`.voxt` is the only format the game reads, however a model was made (map
p1). It's plain text, so a model can be written, read and diffed like code:
a size, a voxel scale, a colour legend, then slices or boxes.

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

- `size W H D`, then `voxel <units per voxel>`, then `colors`: one
  character per named colour.
- `slice` grids are **front views**: slice 0 is the front (+z); rows run top
  to bottom, columns left to right. `slice 1-3` repeats one grid.
  `mirror x` means each row gives the left half _including_ the centre
  column.
- `box x0 y0 z0 x1 y1 z1 c` is inclusive, with y up from 0 and z from the
  front; `.` clears.
- Steps apply in order. The full format is at the top of
  `src/voxel/voxt.ts`.

**Model ids are paths:** `forest/chaser` is
`assets-src/voxels/forest/chaser.voxt`. Folders: `team/` (our players, the
ball), `forest/` (defenders and the Witch), `candy/` (the Candy Kingdom's
defenders), `farm/` (the Farm's crows), `bosses/` (the three Bosses),
`forestProps/`, `candyProps/` and `farmProps/` (scenery). A model's front
(slice 0) faces +z; in play, bodies turn to face where they're going.

## Two ways in

Both end as `.voxt` (map p2). The first new set tries each on at least one
model, to learn which suits what.

**A. Claude writes it** (how all 29 models so far were made). The user
describes the thing, or sends a sketch or a reference; Claude writes the
`.voxt`, previews it and iterates until it reads, and the user judges it in
the viewer.

**B. The user sculpts it** in a voxel editor that saves MagicaVoxel `.vox`,
and it comes in through the importer:

```
npm run import-vox -- model.vox <folder/name> [voxel size]
```

which writes `assets-src/voxels/<folder/name>.voxt`, snapping a new
model's every colour to the nearest named palette colour (`src/voxel/vox.ts`). MagicaVoxel's z
(up) becomes our y, and its y our depth. Check the snapped colours and the
size after importing.

**The round trip** (A, then B; art map a1): Claude writes a model, the user
tweaks it in Goxel, and it comes back.

```
npm run export-vox -- <folder/name> [out.vox]
npm run import-vox -- out.vox <folder/name>
```

Importing over a model that exists keeps its voxel size and the colours it
had, exactly, and snaps only colours added in the editor. Every model in
`assets-src/voxels/` is tested to come back unchanged
(`tests/voxel/export.test.ts`). The importer warns when a model comes
back a different size (an editor that saves only the box its voxels fill
trims empty edges, which moves the model) and when a file holds more than one
model (only the first comes in). The model comes back the same, but the file
is rewritten as one `slice` per depth. `mirror x`, `box` lines and comments
don't survive, so re-add any that matter. No real editor file has been
through it yet: the first trip through Goxel on Android replaces p3's
gravestone test.

## Making a model, step by step

1. **Write or import** `assets-src/voxels/<folder>/<name>.voxt`.
2. **Register it** in `assets/manifest.json`: for Claude's, `source:
   "Original voxel model (…), written by Claude"`, `author: "Claude"`,
   `license: "original"`; for an import, who made it and its licence.
   `npm run check-assets` fails on a file with no entry.
3. **Preview it** and iterate until it reads:
   - `npm run preview-models -- <id>` renders a turntable (front, ¾, side)
     to `previews/<id>.png`; with no ids it renders every model, plus a
     contact sheet per folder from the game camera's pitch. It drives
     Chrome, or Playwright's cached Chromium where there's no Chrome
     (`tools/browser.ts`).
   - `/dev/models.html` (on the tailnet build, `…ts.net:8443/vox/dev/models.html`)
     spins any model. **Game light** shows it under the game's light
     (`src/render/gameLight.ts`, the same numbers the game uses) on an
     area's turf; judge colours there, since the same model reads warmer and
     darker on the field than in the studio light. It leaves out the lamp's
     flicker and the fog, which starts farther away than the viewer stands.
     `?render=turntable&model=<id>` and `?render=sheet&group=<folder>` are
     the fixed images the preview tool takes; add `&light=game&turf=candy`
     for the game's light.
4. **Use it:** `getGeometry(id)` with `voxelMaterial`. A player kind goes in
   `KIND_MODEL` and a defender kind in `DEFENDER_MODEL`
   (`src/arcade/render/bodies.ts`); an area's own look for a defender kind
   goes in its `looks` (`src/arcade/content/defense.ts`).

## What a new area needs

An area's art is code today, in four files. The first new area or set
starts by turning it into data, one file per area or set, with the existing
three moved over (map p7, `docs/PLAN.md`). Until then, a new area touches:

- **Its biome**, in `type Biome` (`src/arcade/content/defense.ts`).
- **Its mood colours**: turf, turf stripe, the ground beyond
  (`src/content/palettes.ts`, `biomes`). Every area plays under the
  Forest's dusk light.
- **New named colours** for its models (`palettes.ts`, `voxel`).
- **Defender looks**: which model stands in for each defender kind; the
  rules stay the kind's (`looks` in `defense.ts`).
- **A Boss model**, about 17×27 voxels, and its power (code, such as the
  Queen's decree and `src/arcade/render/queenCrown.ts`).
- **Sideline scenery**: a placements function scattering its props along
  its stretch, and the flecks on its ground (`src/render/scenery.ts`,
  `candyPlacements` and `bandFloor`).
- **Props on the field**, with a radius for collisions (`fieldProps` in
  `defense.ts`).
- **A manifest entry** for every new file.

Music, the intro's lines and the area's rules sit beside these but aren't
art.

## 2D art

- **SVG written by Claude** for icons and UI art: tiny, scales perfectly,
  themed from the palette. The kinds' pixel portraits are generated as SVG
  from 12×12 character grids (`kindIcons.ts`).
- **Public-domain or CC0 sources** when needed: Kenney.nl, OpenGameArt.org
  and itch.io (filtered to CC0 or public domain), Google Fonts (OFL).
  Anything brought in is recoloured into our palette.
- **Raster art** (if ever unavoidable) goes in atlases, served as WebP with
  PNG fallback.
