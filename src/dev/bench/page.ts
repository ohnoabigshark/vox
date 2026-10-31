/**
 * The test bench page (dev/bench.html, docs/BENCH.md): a tab per tap test,
 * the game's own test screen over a plain stage, and below it the
 * situation, the sliders and the toggles. Each tab saves its own sliders
 * into the game (save.ts). Every rep and every save is logged (log.ts); the
 * status line says whether that's being recorded.
 */
import './page.css';
import savedFile from '../../arcade/content/saved-tuning.json' with { type: 'json' };
import { checkSaved } from '../../arcade/content/savedTuning';
import { savedTuningWarnings, tuningDefaults } from '../../arcade/content/tuning';
import { unlockAudio } from '../../audio/context';
import { getMixer } from '../../audio/mixer';
import { RENDER_RATE } from '../../audio/music';
import { SfxPlayer, prepareSfx, type SfxId } from '../../audio/sfx';
import type { ArcadeEvent } from '../../arcade/sim/types';
import { ArcadeControls } from '../../arcade/ui/controls';
import { nextDot } from '../../arcade/sim/snag';
import { gradeCall, tapTestSound } from '../../arcade/ui/tapTestCalls';
import { breakView, shooShowing } from '../../arcade/ui/testViews';
import { now } from '../../clock';
import { applyPaletteVars } from '../../ui/paletteVars';
import { browserStorage } from '../playEditor/sketches';
import { Bench } from './bench';
import { BENCH_LOG_PATH, BENCH_SAVE_PATH } from './endpoints';
import { benchStore, type Kept, type Toggles } from './keep';
import {
  BENCH_TESTS,
  applySettings,
  fromScreen,
  knobsFor,
  pathOf,
  reachOf,
  defaultValue,
  toScreen,
  withValue,
  type BenchTest,
  type Settings,
} from './knobs';
import { httpLog, repLine, saveLine, type LogLine } from './log';
import { fractionOf, rowView } from './row';
import { slider } from './slider';
import {
  httpSaver,
  restoredTab,
  saveLabel,
  saveStatus,
  savedAfter,
  tabsWithUnsaved,
  unsaved,
  unsavedOffScreen,
  type SaveState,
} from './save';
import { SITUATION_SLIDERS, summary, timingText, type Grade, type RepResult } from './reps';

const TAB: Readonly<Record<BenchTest, string>> = {
  bar: 'Bar',
  mash: 'Mash',
  juke: 'Juke',
  snag: 'SNAG IT!',
  shoo: 'SHOO',
};

/** The grade in one big word, as the game calls it. */
function word(r: RepResult): string {
  return gradeCall(r.test, r.grade).word;
}

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
    <p class="b-saved" role="status"></p>
    <div class="b-stage"><div class="b-word" hidden></div><p class="b-idle">Tap GO</p></div>
    <p class="b-timing"></p>
    <p class="b-summary"></p>
    <div class="b-row">
      <button class="b-go">GO</button>
      <button class="b-save">Saved</button>
      <button class="b-reset">Restore defaults</button>
    </div>
    <p class="b-also" hidden></p>
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
  const saveButton = q<HTMLButtonElement>('.b-save');
  const savedEl = q('.b-saved');
  const alsoEl = q('.b-also');

  const store = benchStore(browserStorage());
  const loaded = await store.load();
  let kept: Kept = loaded.kept;
  let problem =
    [loaded.problem, ...savedTuningWarnings].filter((x) => x !== null).join(' · ') || null;
  // What the game plays (r-s5): the bench opens at it, and Save writes it.
  let saved: Settings = checkSaved(savedFile, tuningDefaults).settings;
  // What the sliders are at now.
  let settings: Settings = saved;
  applySettings(settings);

  // ── The log: whether it's being recorded is always on show (never fail silently). ──
  const log = httpLog(`${import.meta.env.BASE_URL}${BENCH_LOG_PATH}`);
  let recording: boolean | null = null;
  const showStatus = (): void => {
    const rec =
      recording === null
        ? 'Checking the log…'
        : recording
          ? '● Recording to the log'
          : 'Not recording: the log works on the hot-reload server (/vox-dev/dev/bench.html).';
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
  // The tab, the situation and the toggles, kept on the phone (k4).
  const keep = (): void => {
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
    // The game's sound for each tap test event (ui/tapTestCalls.ts).
    const sound = tapTestSound(e);
    if (sound) play(sound);
    if (e.type === 'snagDot' && e.hit && kept.toggles.buzz) navigator.vibrate?.(12);
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
    onTip: () => bench.press({ tip: true }),
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
    const marked = tabsWithUnsaved(saved, settings);
    for (const b of app.querySelectorAll<HTMLButtonElement>('[data-test]')) {
      b.setAttribute('aria-selected', String(b.dataset.test === test()));
      b.classList.toggle('unsaved', marked.includes(b.dataset.test as BenchTest));
    }
  };

  // ── Save (docs/BENCH.md, Saving): each tab's own, through the hot-reload server. ──
  const saver = httpSaver(`${import.meta.env.BASE_URL}${BENCH_SAVE_PATH}`);
  let saveState: SaveState = { server: { kind: 'checking' }, error: null };
  let saving = false;
  const renderSave = (): void => {
    const changes = unsaved(saved, settings, test()).length;
    saveButton.textContent = saveLabel(changes);
    saveButton.disabled = saveState.server.kind !== 'up' || changes === 0 || saving;
    const { text, bad } = saveStatus(saveState);
    savedEl.textContent = text;
    savedEl.classList.toggle('off', bad);
    // Unsaved values no row on screen shows (another area's, b10).
    const also = unsavedOffScreen(saved, settings, test(), kept.situation.drive);
    alsoEl.hidden = also.length === 0;
    alsoEl.textContent = `Also unsaved: ${also.join(', ')}`;
    renderTabs();
  };
  void saver.probe().then((r) => {
    saveState = { ...saveState, server: r };
    renderSave();
  });
  saveButton.addEventListener('click', () => {
    // The tab saved is the one open at the tap, even if another is open when the reply comes.
    const tab = test();
    const next = savedAfter(saved, settings, tab);
    saving = true;
    renderSave();
    saver
      .save(next)
      .then(
        (r) => {
          saved = next;
          saveState = {
            server: { kind: 'up', inServedGame: r.inServedGame, savedAt: now() },
            error: null,
          };
          record(saveLine(tab, next, now()));
        },
        (e: unknown) => {
          saveState = { ...saveState, error: e instanceof Error ? e.message : String(e) };
        },
      )
      .finally(() => {
        saving = false;
        renderKnobs();
        renderSave();
      });
  });
  // Moves not saved are gone on leaving (r-s5): ask first, where the browser lets us.
  window.addEventListener('beforeunload', (e) => {
    if (tabsWithUnsaved(saved, settings).length > 0) e.preventDefault();
  });
  const renderSituation = (): void => {
    situationEl.innerHTML = '';
    for (const sit of SITUATION_SLIDERS.filter((x) => x.tests.includes(test()))) {
      const range = { min: sit.min, max: sit.max, step: sit.step };
      const row = slider(sit.label, range, {
        onMove: (v) => {
          const situation = { ...kept.situation, [sit.key]: v };
          kept = { ...kept, situation };
          bench.setSituation(situation);
          show();
          // A by-area slider edits the new drive's area, so what's off screen changes too.
          if (sit.key === 'drive') {
            renderKnobs();
            renderSave();
          }
          showSummary();
          keep();
        },
      });
      const show = (): void =>
        row.show({
          value: kept.situation[sit.key],
          shown: String(kept.situation[sit.key]),
          at: fractionOf(kept.situation[sit.key], range),
        });
      show();
      situationEl.append(row.el);
    }
  };
  // The sliders behind More (r-p2) stay open or shut for the visit.
  let moreOpen = false;
  const renderKnobs = (): void => {
    knobsEl.innerHTML = '';
    const drive = kept.situation.drive;
    const behind = knobsFor(test()).filter((k) => k.more);
    const moreButton = document.createElement('button');
    moreButton.className = 'b-more';
    const moreEl = document.createElement('div');
    moreEl.className = 'b-knobs-more';
    const showMore = (): void => {
      const changed = behind.filter(
        (k) => rowView(k, pathOf(k, drive), saved, settings).unsaved,
      ).length;
      moreButton.textContent = moreOpen
        ? 'Fewer'
        : `More: ${behind.length} sliders${changed > 0 ? ` · ${changed} unsaved` : ''}`;
      moreButton.setAttribute('aria-expanded', String(moreOpen));
      moreEl.hidden = !moreOpen;
    };
    moreButton.addEventListener('click', () => {
      moreOpen = !moreOpen;
      showMore();
    });
    for (const knob of knobsFor(test())) {
      const path = pathOf(knob, drive);
      const reach = reachOf(knob, path);
      const range = {
        min: toScreen(knob, reach.min),
        max: toScreen(knob, reach.max),
        step: knob.unit === 'seconds' ? 0.01 : reach.step,
      };
      const set = (v: number): void => {
        settings = withValue(settings, path, v);
        applySettings(settings);
        show();
        showMore();
        showSummary();
        renderSave();
      };
      const row = slider(knob.label, range, {
        onMove: (v) => set(fromScreen(knob, v)),
        onReset: () => set(defaultValue(path)),
      });
      const show = (): void => {
        const view = rowView(knob, path, saved, settings);
        row.show({
          value: toScreen(knob, settings[path] ?? defaultValue(path)),
          ...view,
        });
      };
      show();
      (knob.more ? moreEl : knobsEl).append(row.el);
    }
    if (behind.length > 0) {
      showMore();
      knobsEl.append(moreButton, moreEl);
    }
  };
  const showTab = (): void => {
    renderSave();
    renderSituation();
    renderKnobs();
    showSummary();
  };

  for (const b of app.querySelectorAll<HTMLButtonElement>('[data-test]')) {
    b.addEventListener('click', () => {
      const t = b.dataset.test as BenchTest;
      bench.showTest(t);
      kept = { ...kept, test: t };
      keep();
      showTab();
    });
  }
  for (const box of app.querySelectorAll<HTMLInputElement>('[data-toggle]')) {
    const key = box.dataset.toggle as keyof Toggles;
    box.checked = kept.toggles[key];
    box.addEventListener('change', () => {
      kept = { ...kept, toggles: { ...kept.toggles, [key]: box.checked } };
      bench.setAgain(kept.toggles.again);
      keep();
    });
  }
  q('.b-go').addEventListener('click', () => bench.go());
  q('.b-reset').addEventListener('click', () => {
    settings = restoredTab(settings, test());
    applySettings(settings);
    renderKnobs();
    renderSave();
    showSummary();
  });
  window.addEventListener('pointerdown', wakeSound, { capture: true });
  window.addEventListener('keydown', (e) => {
    wakeSound();
    if (
      e.repeat ||
      e.target instanceof HTMLInputElement ||
      (e.target instanceof Element && e.target.closest('[role="slider"]'))
    ) {
      return;
    }
    if (e.code === 'Enter') bench.go();
    else if (e.code === 'Space') {
      e.preventDefault();
      const t = test();
      if (t === 'snag') {
        const i = bench.rep ? nextDot(bench.rep.state) : null;
        if (i !== null) bench.press({ snag: i });
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
      record(repLine(finished, settings, now()));
    }
    const rep = bench.rep;
    const state = rep && !rep.result ? rep.state : null;
    controls.setBreak(state ? breakView(state) : null);
    controls.setSnag(bench.snagView());
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

void main().catch((e: unknown) => {
  document.body.textContent = `The test bench couldn't start: ${e instanceof Error ? e.message : String(e)}`;
});
