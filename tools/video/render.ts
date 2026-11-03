/**
 * The sing-along video for "We Got Jack Back" (1920×1080 MP4 for YouTube):
 * the win cutscene's dance, looped under the whole song, with each lyric
 * line at the bottom as it's sung.
 *
 *   npx tsx tools/video/render.ts        →  previews/video/weGotJackBack.mp4
 *
 * 1. Capture: the game in video mode (?win=1&video=1) in headless Chrome,
 *    stepped frame by frame through one loop of the dance (LOOP_BEATS beats
 *    of the track), plus a little more: the extra frames are crossfaded over
 *    the first few, so the loop's seam doesn't jump (the embers are random).
 * 2. Lyrics: each line drawn in the game's font onto a transparent strip, in
 *    the browser, timed by media/weGotJackBack.timings.json (made on
 *    /dev/lyrics.html).
 * 3. Encode (needs ffmpeg): the loop repeated for the song's length, offset so
 *    the dancers land on the song's beats, the lyric strips over it at their
 *    times, and the song: H.264 and AAC.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'vite';
import { launchToolBrowser } from '../browser';
import { LOOP_BEATS, WIN_TRACK_BEAT as WIN_TRACK } from '../../src/arcade/content/dance';

const ROOT = new URL('../..', import.meta.url).pathname;
const OUT = join(ROOT, 'previews/video');
const FRAMES = join(OUT, 'frames');
const LYRICS = join(OUT, 'lyrics');
const SONG = join(ROOT, 'media/weGotJackBack.mp3');
const TIMINGS = join(ROOT, 'media/weGotJackBack.timings.json');
const W = 1920;
const H = 1080;
/** The lyric strip at the bottom. */
const STRIP_H = 300;
const FPS = 30;
/** Frames crossfaded at the loop's seam, and how long the dance warms up first (embers). */
const SEAM = 15;
const WARM_UP = 3;

interface Timings {
  readonly lines: readonly { text: string; start: number | null; end: number | null }[];
}

const loopSeconds = (LOOP_BEATS * 60) / WIN_TRACK.bpm;
/** Frames in one loop: the loop is played back at exactly loopSeconds, so this is a little off 30 fps. */
const loopFrames = Math.round(loopSeconds * FPS);

const hasFfmpeg = (): boolean => {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

const timings: Timings | null = existsSync(TIMINGS)
  ? (JSON.parse(readFileSync(TIMINGS, 'utf8')) as Timings)
  : null;

const server = await createServer({ root: ROOT, server: { port: 0 }, logLevel: 'error' });
await server.listen();
const address = server.httpServer?.address();
const port = typeof address === 'object' && address ? address.port : 5173;
const browser = await launchToolBrowser([
  '--autoplay-policy=no-user-gesture-required',
  '--mute-audio',
]);

try {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error(`page error: ${e.message}`));
  // tsx names the functions in code passed to page.evaluate with a __name helper the page lacks.
  await page.addInitScript('window.__name = (f) => f');
  await page.goto(`http://localhost:${port}/?win=1&video=1&seed=7`);
  await page.locator('.start-play').click();
  await page.waitForFunction(() => '__videoStep' in window, undefined, { timeout: 120_000 });

  // ── 1. The dance loop ──────────────────────────────────────────────────────
  rmSync(FRAMES, { recursive: true, force: true });
  mkdirSync(FRAMES, { recursive: true });
  const dt = loopSeconds / loopFrames;
  // Warm up to a loop boundary on the beat: LOOP_BEATS * k beats past the first beat.
  const loops = Math.ceil((WARM_UP - WIN_TRACK.firstBeat) / loopSeconds);
  const start = WIN_TRACK.firstBeat + loops * loopSeconds;
  await page.evaluate(
    ({ start }) => {
      const w = window as unknown as { __videoStep: (dt: number) => void };
      for (let t = 0; t < start - 1e-6; t += 1 / 60) w.__videoStep(Math.min(1 / 60, start - t));
    },
    { start },
  );
  for (let i = 0; i < loopFrames + SEAM; i++) {
    const png = await page.evaluate(
      async ({ i, dt, loopFrames, seam }) => {
        const w = window as unknown as {
          __videoStep: (dt: number) => void;
          __heads?: ImageBitmap[];
        };
        if (i > 0) w.__videoStep(dt);
        else w.__videoStep(0);
        const gl = document.querySelector('canvas');
        if (!gl) throw new Error('no canvas');
        // The first frames are kept, to blend the extra ones over at the seam.
        if (i < seam) {
          w.__heads ??= [];
          w.__heads[i] = await createImageBitmap(gl);
          return null;
        }
        const out = document.createElement('canvas');
        out.width = gl.width;
        out.height = gl.height;
        const ctx = out.getContext('2d');
        if (!ctx) throw new Error('no 2d');
        ctx.drawImage(gl, 0, 0);
        if (i >= loopFrames) {
          // Past the loop: this is frame i - loopFrames again, a loop later. Fade the
          // first frame in over it, so the end runs smoothly into the start.
          const j = i - loopFrames;
          const head = w.__heads?.[j];
          if (head) {
            ctx.globalAlpha = (j + 1) / (seam + 1);
            ctx.drawImage(head, 0, 0);
          }
        }
        return out.toDataURL('image/png').split(',')[1] ?? '';
      },
      { i, dt, loopFrames, seam: SEAM },
    );
    if (png === null) continue;
    // The blended seam frames replace the loop's first ones.
    const n = i >= loopFrames ? i - loopFrames : i;
    writeFileSync(join(FRAMES, `${String(n).padStart(4, '0')}.png`), Buffer.from(png, 'base64'));
  }
  console.log(
    `dance loop: ${loopFrames} frames, ${loopSeconds.toFixed(3)} s (${LOOP_BEATS} beats at ${WIN_TRACK.bpm} BPM)`,
  );

  // ── 2. The lyric strips ────────────────────────────────────────────────────
  if (!timings) {
    console.log(
      `No timings yet (${TIMINGS}): time the lyrics on /dev/lyrics.html, then run again.`,
    );
  } else {
    rmSync(LYRICS, { recursive: true, force: true });
    mkdirSync(LYRICS, { recursive: true });
    const lines = timings.lines;
    for (let i = -1; i < lines.length; i++) {
      const png = await page.evaluate(
        async ({ now, next, w, h }) => {
          await document.fonts.load("96px 'Creepster'");
          const c = document.createElement('canvas');
          c.width = w;
          c.height = h;
          const ctx = c.getContext('2d');
          if (!ctx) throw new Error('no 2d');
          ctx.textAlign = 'center';
          ctx.textBaseline = 'alphabetic';
          ctx.lineJoin = 'round';
          /** Draw a line in the game's style: ink outline, a hard pixel shadow, a fill. */
          const say = (text: string, size: number, y: number, fill: string): void => {
            let px = size;
            ctx.font = `${px}px 'Creepster'`;
            while (ctx.measureText(text).width > w * 0.9 && px > 24) {
              px -= 2;
              ctx.font = `${px}px 'Creepster'`;
            }
            const edge = Math.max(4, px * 0.12);
            ctx.lineWidth = edge * 2;
            ctx.strokeStyle = '#2b2140';
            ctx.fillStyle = '#2b2140';
            ctx.strokeText(text, w / 2 + edge, y + edge);
            ctx.fillText(text, w / 2 + edge, y + edge);
            ctx.strokeText(text, w / 2, y);
            ctx.fillStyle = fill;
            ctx.fillText(text, w / 2, y);
          };
          if (now) say(now, 96, h - 130, '#ff8a1f');
          if (next) say(next, 50, h - 50, '#f7f1e3');
          return c.toDataURL('image/png').split(',')[1] ?? '';
        },
        {
          now: i < 0 ? '' : (lines[i]?.text ?? ''),
          next: lines[i + 1]?.text ?? '',
          w: W,
          h: STRIP_H,
        },
      );
      writeFileSync(
        join(LYRICS, `${i < 0 ? 'blank' : String(i).padStart(3, '0')}.png`),
        Buffer.from(png, 'base64'),
      );
    }
  }
} finally {
  await browser.close();
  await server.close();
}

// ── 3. Encode ────────────────────────────────────────────────────────────────
if (!timings) process.exit(0);
if (!hasFfmpeg()) {
  console.log('ffmpeg is needed to encode the video: sudo apt install ffmpeg, then run again.');
  process.exit(0);
}

// The lyric track: a concat list of strips, each shown from its line's start until the
// next line starts (or its own end, if there's a gap), the blank strip between.
const songSeconds = Number(
  execFileSync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'csv=p=0',
    SONG,
  ])
    .toString()
    .trim(),
);
const shown: { file: string; from: number; to: number }[] = [];
const lines = timings.lines;
lines.forEach((line, i) => {
  if (line.start === null) return;
  const nextStart = lines.slice(i + 1).find((l) => l.start !== null)?.start ?? line.start + 4;
  const to = line.end !== null ? Math.min(line.end, nextStart) : nextStart;
  shown.push({ file: `${String(i).padStart(3, '0')}.png`, from: line.start, to });
});
const list: string[] = ['ffconcat version 1.0'];
let at = 0;
for (const s of shown) {
  if (s.from > at + 0.01) list.push(`file blank.png`, `duration ${(s.from - at).toFixed(3)}`);
  list.push(`file ${s.file}`, `duration ${(s.to - s.from).toFixed(3)}`);
  at = s.to;
}
list.push(
  `file blank.png`,
  `duration ${Math.max(0.1, songSeconds - at).toFixed(3)}`,
  'file blank.png',
);
writeFileSync(join(LYRICS, 'lyrics.ffconcat'), list.join('\n'));

// The dance loop as a clip, played at exactly the loop's length, then repeated; started
// partway in, so the loop's first frame (a downbeat) lands on the song's first beat.
const loopClip = join(OUT, 'danceLoop.mp4');
execFileSync('ffmpeg', [
  '-y',
  '-v',
  'error',
  '-framerate',
  String(loopFrames / loopSeconds),
  '-i',
  join(FRAMES, '%04d.png'),
  '-c:v',
  'libx264',
  '-crf',
  '12',
  '-pix_fmt',
  'yuv420p',
  loopClip,
]);
const lead = (loopSeconds - (WIN_TRACK.firstBeat % loopSeconds)) % loopSeconds;
const out = join(OUT, 'weGotJackBack.mp4');
execFileSync(
  'ffmpeg',
  [
    '-y',
    '-v',
    'error',
    '-stream_loop',
    '-1',
    '-ss',
    lead.toFixed(3),
    '-i',
    loopClip,
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    join(LYRICS, 'lyrics.ffconcat'),
    '-i',
    SONG,
    '-filter_complex',
    `[0:v]fps=${FPS},setpts=PTS-STARTPTS[dance];[1:v]fps=${FPS},format=rgba[words];` +
      `[dance][words]overlay=0:${H - STRIP_H}:shortest=0[v]`,
    '-map',
    '[v]',
    '-map',
    '2:a',
    '-t',
    songSeconds.toFixed(3),
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '18',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-movflags',
    '+faststart',
    out,
  ],
  { stdio: 'inherit' },
);
console.log(`video: ${out} (${songSeconds.toFixed(1)} s)`);
