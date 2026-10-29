import { readPractice } from './arcade/content/playCode';
import { ArcadeGame } from './arcade/game';
import { applyPaletteVars } from './ui/paletteVars';

applyPaletteVars();

const canvas = document.querySelector<HTMLCanvasElement>('#game');
const ui = document.querySelector<HTMLDivElement>('#ui');
if (!canvas || !ui) throw new Error('index.html is missing #game or #ui');

/** How long to wait for the font before starting anyway (a slow or failed load). */
const FONT_TIMEOUT_MS = 3000;

// Build the game only once Creepster is ready, so no text ever shows in a fallback font.
await Promise.race([
  document.fonts.load("1em 'Creepster'").catch(() => undefined),
  new Promise((resolve) => setTimeout(resolve, FONT_TIMEOUT_MS)),
]);

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed')) || Math.floor(Math.random() * 1e9);
// ?try=…&sketch=… is practice, from the play editor's Try it (dev/plays.html): that
// one play on the field, rep after rep, with ‹ Sketch back to the editor.
const practice = readPractice(location.search);
// ?monsters=1 starts with a monster team; ?area=2 or ?area=3 starts at that area;
// ?hard=1 is hard mode (endless zones); ?aim=2 throws with two taps (aim, then distance).
// ?win=1 goes straight from PLAY to the win cutscene (with ?video=1, frame by frame for
// the sing-along video's capture, tools/video/render.ts); ?farmSong=2 plays the second
// Frederick's Farm song candidate (Spooky Cow) instead of Harvest Moon Hoedown.
const game = new ArcadeGame(canvas, ui, {
  seed,
  monsters: params.has('monsters'),
  area: Number(params.get('area')) || 1,
  win: params.has('win'),
  video: params.has('video'),
  hard: params.get('hard') === '1',
  twoTapAim: params.get('aim') === '2',
  farmSong: Number(params.get('farmSong')) || 1,
  ...(practice ? { practice } : {}),
});

// Dev builds expose the game for debugging from the console.
if (import.meta.env.DEV) Object.assign(window, { game });
