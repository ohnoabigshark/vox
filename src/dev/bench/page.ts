/**
 * The test bench page (dev/bench.html, docs/BENCH.md): a tab per tap test,
 * the game's own test screen over a plain stage, and below it the
 * situation, the sliders and the toggles. Every slider let go and every rep
 * is logged (log.ts); the status line says whether that's being recorded.
 */
import './page.css';
import { unlockAudio } from '../../audio/context';
import { getMixer } from '../../audio/mixer';
import { RENDER_RATE } from '../../audio/music';
import { SfxPlayer, prepareSfx, type SfxId } from '../../audio/sfx';
import type { ArcadeEvent } from '../../arcade/sim/types';
import { ArcadeControls } from '../../arcade/ui/controls';
import { breakView, shooShowing, snagView } from '../../arcade/ui/testViews';
import { now } from '../../clock';
import { applyPaletteVars } from '../../ui/paletteVars';
import { browserStorage } from '../playEditor/sketches';
import { Bench } from './bench';
import { benchStore, type Kept, type Toggles } from './keep';
import {
  BENCH_TESTS,
  applySettings,
  copyText,
  fromScreen,
  knobsFor,
  pathOf,
  pathsOf,
  reachOf,
  round,
  defaultValue,
  showValue,
  toScreen,
  withValue,
  withoutPaths,
  type BenchTest,
  type Settings,
} from './knobs';
import { httpLog, repLine, settingsLine, type LogLine } from './log';
import { summary, timingText, type Grade, type RepResult, type Situation } from './reps';

const TAB: Readonly<Record<BenchTest, string>> = {
  bar: 'Bar',
  mash: 'Mash',
  juke: 'Juke',
  snag: 'SNAG IT!',
  shoo: 'SHOO',
};

/** The grade in one big word, as the game calls it. */
function word(r: RepResult): string {
  if (r.test === 'shoo') return r.grade === 'great' ? 'SHOOED!' : 'CROWS!';
  return { great: 'GREAT!', ok: 'OK', bad: 'BAD' }[r.grade];
}

/** The situation's sliders (k2): which tests each is for, and its range. */
const SITUATION: readonly {
  key: keyof Situation;
  label: string;
  min: number;
  max: number;
  step: number;
  tests: readonly BenchTest[];
}[] = [
  {
    key: 'drive',
    label: 'Drive',
    min: 1,
    max: 20,
    step: 1,
    tests: ['bar', 'mash', 'juke', 'snag'],
  },
  { key: 'tacklers', label: 'Tacklers', min: 1, max: 3, step: 1, tests: ['bar', 'mash', 'juke'] },
  { key: 'crowd', label: 'Defenders reaching', min: 1, max: 3, step: 1, tests: ['snag'] },
  {
    key: 'handsGap',
    label: 'Hands gap (yours − theirs)',
    min: -40,
    max: 40,
    step: 5,
    tests: ['snag'],
  },
];

const TOGGLES: readonly { key: keyof Toggles; label: string }[] = [
  { key: 'again', label: 'Again' },
  { key: 'sound', label: 'Sound' },
  { key: 'buzz', label: 'Buzz' },
  { key: 'timing', label: 'Timing' },
];

async function main(): Promise<void> {
  applyPaletteVars();
  const app = document.getElementById('app');
  if (!app) throw new Error('no #app');
  app.innerHTML = `
    <header class="b-head"><h1>Test bench</h1><a href="./">Dev tools</a></header>
    <nav class="b-tabs" role="tablist">${BENCH_TESTS.map(
      (t) => `<button role="tab" data-test="${t}">${TAB[t]}</button>`,
    ).join('')}</nav>
    <p class="b-status" role="status">Checking the log…</p>
    <div class="b-stage"><div class="b-word" hidden></div><p class="b-idle">Tap GO</p></div>
    <p class="b-timing"></p>
    <p class="b-summary"></p>
    <div class="b-row">
      <button class="b-go">GO</button>
      <button class="b-reset">Reset to defaults</button>
      <button class="b-copy">Copy settings</button>
    </div>
    <textarea class="b-copied" readonly hidden rows="8"></textarea>
    <div class="b-row b-toggles">${TOGGLES.map(
      (t) => `<label><input type="checkbox" data-toggle="${t.key}" /> ${t.label}</label>`,
    ).join('')}</div>
    <section class="b-situation"></section>
    <section class="b-knobs"></section>`;
  const q = <T extends HTMLElement>(sel: string): T => {
    const el = app.querySelector<T>(sel);
    if (!el) throw new Error(`bench page missing ${sel}`);
    return el;
  };
  const status = q('.b-status');
  const stage = q('.b-stage');
  const big = q('.b-word');
  const idle = q('.b-idle');
  const timingEl = q('.b-timing');
  const summaryEl = q('.b-summary');
  const situationEl = q('.b-situation');
  const knobsEl = q('.b-knobs');
  const copied = q<HTMLTextAreaElement>('.b-copied');
  const copyButton = q('.b-copy');

  const store = benchStore(browserStorage());
  const loaded = await store.load();
  let kept: Kept = loaded.kept;
  let problem = loaded.problem;
  let settings: Settings = kept.settings;
  applySettings(settings);

  // ── The log: whether it's being recorded is always on show (never fail silently). ──
  const log = httpLog(`${import.meta.env.BASE_URL}__bench-log`);
  let recording: boolean | null = null;
  const showStatus = (): void => {
    const rec =
      recording === null
        ? 'Checking the log…'
        : recording
          ? '● Recording to the log'
          : 'Not recording: the log works on the hot-reload server (/vox-dev/dev/bench.html). Copy settings still works.';
    status.textContent = problem ? `${rec} · ${problem}` : rec;
    status.classList.toggle('off', recording === false || problem !== null);
  };
  const record = (line: LogLine): void => {
    void log.record(line).then((ok) => {
      if (ok === recording) return;
      recording = ok;
      showStatus();
    });
  };
  void log.probe().then((ok) => {
    recording = ok;
    showStatus();
  });
  const save = (): void => {
    kept = { ...kept, settings };
    store.save(kept).then(
      () => {
        if (problem === null) return;
        problem = null;
        showStatus();
      },
      (e: unknown) => {
        problem = e instanceof Error ? e.message : String(e);
        showStatus();
      },
    );
  };
  showStatus();

  // ── Sound: started by the first tap (browsers allow nothing sooner). ──
  let sfx: SfxPlayer | null = null;
  let starting = false;
  const wakeSound = (): void => {
    if (sfx || starting) return;
    starting = true;
    unlockAudio()
      .then(async (ctx) => {
        sfx = new SfxPlayer(ctx, getMixer(ctx), await prepareSfx(RENDER_RATE));
      })
      .catch((e: unknown) => {
        problem = `Sound couldn't start: ${e instanceof Error ? e.message : String(e)}`;
        showStatus();
      });
  };
  const play = (id: SfxId): void => {
    if (kept.toggles.sound) sfx?.play(id);
  };
  const react = (e: ArcadeEvent): void => {
    switch (e.type) {
      case 'snagDot':
        play(e.hit ? 'catch' : 'fumble');
        if (e.hit && kept.toggles.buzz) navigator.vibrate?.(12);
        break;
      case 'brokeTackle':
      case 'dragged':
      case 'crowsShooed':
      case 'crowsStruck':
        play('burst');
        break;
      default:
        break;
    }
  };

  // ── The bench and the test screen. ──
  const bench = new Bench({
    test: kept.test,
    situation: kept.situation,
    again: kept.toggles.again,
  });
  const controls = new ArcadeControls(stage, {
    onThrow: () => undefined,
    onBreakTap: () => bench.press({ breakTap: true }),
    onJuke: (side) => bench.press({ juke: side }),
    onShoo: () => bench.press({ shoo: true }),
    onSnag: (dot) => bench.press({ snag: dot }),
  });
  let bigTimer = 0;
  const showWord = (r: RepResult): void => {
    big.textContent = word(r);
    big.className = `b-word ${r.grade}`;
    big.hidden = false;
    window.clearTimeout(bigTimer);
    bigTimer = window.setTimeout(() => (big.hidden = true), 900);
  };

  // ── Tabs, the situation and the sliders. ──
  const test = (): BenchTest => bench.options.test;
  const showSummary = (): void => {
    summaryEl.textContent = summary(test(), kept.situation);
  };
  const renderTabs = (): void => {
    for (const b of app.querySelectorAll<HTMLButtonElement>('[data-test]')) {
      b.setAttribute('aria-selected', String(b.dataset.test === test()));
    }
  };
  const renderSituation = (): void => {
    situationEl.innerHTML = '';
    for (const s of SITUATION.filter((x) => x.tests.includes(test()))) {
      const row = slider(
        s.label,
        String(kept.situation[s.key]),
        s.min,
        s.max,
        s.step,
        kept.situation[s.key],
      );
      row.input.addEventListener('input', () => {
        const situation = { ...kept.situation, [s.key]: Number(row.input.value) };
        kept = { ...kept, situation };
        bench.options.situation = situation;
        row.output.textContent = row.input.value;
        // A by-area slider edits the new drive's area.
        if (s.key === 'drive') renderKnobs();
        showSummary();
        save();
      });
      situationEl.append(row.label);
    }
  };
  const renderKnobs = (): void => {
    knobsEl.innerHTML = '';
    const drive = kept.situation.drive;
    for (const knob of knobsFor(test())) {
      const path = pathOf(knob, drive);
      const byDefault = defaultValue(path);
      const reach = reachOf(knob, path);
      const step = knob.unit === 'seconds' ? 0.01 : reach.step;
      const value = (): number => settings[path] ?? byDefault;
      const row = slider(
        knob.label,
        showValue(knob, value()),
        toScreen(knob, reach.min),
        toScreen(knob, reach.max),
        step,
        toScreen(knob, value()),
      );
      const tick = document.createElement('span');
      tick.className = 'b-tick';
      tick.style.left = `${((byDefault - reach.min) / (reach.max - reach.min)) * 100}%`;
      row.track.append(tick);
      const note = document.createElement('small');
      const showNote = (): void => {
        note.textContent = `${path} ${round(value())} · default ${round(byDefault)}`;
        row.label.classList.toggle('changed', value() !== byDefault);
      };
      showNote();
      row.label.append(note);
      row.input.addEventListener('input', () => {
        settings = withValue(settings, path, fromScreen(knob, Number(row.input.value)));
        applySettings(settings);
        row.output.textContent = showValue(knob, value());
        showNote();
        showSummary();
        save();
      });
      row.input.addEventListener('change', () =>
        record(settingsLine(test(), kept.situation, settings, path, now())),
      );
      knobsEl.append(row.label);
    }
  };
  const showTab = (): void => {
    renderTabs();
    renderSituation();
    renderKnobs();
    showSummary();
    copied.hidden = true;
  };

  for (const b of app.querySelectorAll<HTMLButtonElement>('[data-test]')) {
    b.addEventListener('click', () => {
      const t = b.dataset.test as BenchTest;
      bench.options.test = t;
      bench.rep = null;
      kept = { ...kept, test: t };
      save();
      showTab();
    });
  }
  for (const box of app.querySelectorAll<HTMLInputElement>('[data-toggle]')) {
    const key = box.dataset.toggle as keyof Toggles;
    box.checked = kept.toggles[key];
    box.addEventListener('change', () => {
      kept = { ...kept, toggles: { ...kept.toggles, [key]: box.checked } };
      bench.options.again = kept.toggles.again;
      save();
    });
  }
  q('.b-go').addEventListener('click', () => bench.go());
  q('.b-reset').addEventListener('click', () => {
    settings = withoutPaths(settings, knobsFor(test()).flatMap(pathsOf));
    applySettings(settings);
    save();
    renderKnobs();
    showSummary();
    record(
      settingsLine(
        test(),
        kept.situation,
        settings,
        knobsFor(test()).map((k) => pathOf(k, kept.situation.drive)),
        now(),
      ),
    );
  });
  copyButton.addEventListener('click', () => {
    const text = copyText(test(), kept.situation.drive, settings);
    navigator.clipboard.writeText(text).then(
      () => {
        copied.hidden = true;
        copyButton.textContent = 'Copied';
        window.setTimeout(() => (copyButton.textContent = 'Copy settings'), 1200);
      },
      () => {
        // No clipboard here: show the text to copy by hand.
        copied.value = text;
        copied.hidden = false;
        copied.select();
      },
    );
  });
  window.addEventListener('pointerdown', wakeSound, { capture: true });
  window.addEventListener('keydown', (e) => {
    wakeSound();
    if (e.repeat || e.target instanceof HTMLInputElement) return;
    if (e.code === 'Enter') bench.go();
    else if (e.code === 'Space') {
      e.preventDefault();
      const t = test();
      if (t === 'snag') {
        const s = bench.rep?.state;
        const dots = s?.snag?.dots ?? [];
        const i = dots.findIndex((d) => d.result === null && (s?.time ?? 0) >= d.appearsAt);
        if (i >= 0) bench.press({ snag: i });
      } else if (t === 'shoo') bench.press({ shoo: true });
      else bench.press({ breakTap: true });
    } else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
      bench.press({ juke: e.code === 'ArrowLeft' ? -1 : 1 });
    }
  });
  showTab();

  // ── The loop. ──
  let last = performance.now();
  let reps = 0;
  const frame = (t: number): void => {
    const { events, finished } = bench.tick((t - last) / 1000);
    last = t;
    if (bench.reps !== reps) {
      // A new rep: the game's cue for it (the grab, or the crows landing; SNAG IT! has none).
      reps = bench.reps;
      if (test() === 'shoo') play('hop');
      else if (test() !== 'snag') play('burst');
    }
    for (const e of events) react(e);
    if (finished) {
      showWord(finished);
      record(repLine(finished, now()));
    }
    const rep = bench.rep;
    const state = rep && !rep.result ? rep.state : null;
    controls.setBreak(state ? breakView(state) : null);
    controls.setSnag(state ? snagView(state) : null);
    controls.setShoo(state ? shooShowing(state) : false);
    idle.hidden = state !== null || (rep?.result != null && kept.toggles.again);
    const grade: Grade | null = rep?.result?.grade ?? null;
    // SNAG IT!'s readout fills in dot by dot; the others' once the grade is in.
    const shown = rep && kept.toggles.timing && (rep.result || rep.test === 'snag');
    timingEl.textContent = shown
      ? `${timingText(rep.timing)}${grade ? ` → ${grade.toUpperCase()}` : ''}`
      : '';
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/** A labelled slider: its label (the row), the value shown, the input, and the track (for the tick). */
function slider(
  name: string,
  shown: string,
  min: number,
  max: number,
  step: number,
  value: number,
): {
  label: HTMLLabelElement;
  output: HTMLOutputElement;
  input: HTMLInputElement;
  track: HTMLElement;
} {
  const label = document.createElement('label');
  label.className = 'b-slider';
  const title = document.createElement('span');
  title.textContent = name;
  const output = document.createElement('output');
  output.textContent = shown;
  const track = document.createElement('span');
  track.className = 'b-track';
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  track.append(input);
  label.append(title, output, track);
  return { label, output, input, track };
}

void main().catch((e: unknown) => {
  document.body.textContent = `The test bench couldn't start: ${e instanceof Error ? e.message : String(e)}`;
});
