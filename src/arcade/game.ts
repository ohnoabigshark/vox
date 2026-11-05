/**
 * The arcade game controller (GAMEPLAY.md, A Down and Controls): runs the
 * arcade sim at its fixed 60 Hz step, draws it from a third-person camera
 * behind and above the QB that follows the play, and takes the timing
 * game's inputs:
 *
 * - **Before the snap:** three play cards and Flip. Tap a card to call it
 *   (its routes show on the field; tap another to switch), then HIKE.
 * - **On a pass play:** THROW fires a bullet along the sweeping line.
 * - **In Break it!:** taps, anywhere (for a juke, on the arrow's side).
 *
 * Keys for a desktop: 1–3 call a card, F flips, Space hikes (then throws,
 * and taps the bar and the mash), ← and → juke, S shoos the King's crows. The music is the soundtrack only: nothing waits for the beat.
 */
import * as THREE from 'three';
import type { SfxId } from '../audio/sfx';
import { Conductor } from '../game/conductor';
import { GAME_LIGHT, setLights } from '../render/gameLight';
import { ForestScenery } from '../render/scenery';
import { View } from '../render/view';
import { Hud } from '../ui/hud';
import { arcadeTuning, DT, TIME_SCALE } from './content/tuning';
import { ArcadeBall } from './render/ball';
import { ArcadeBodies } from './render/bodies';
import { ArcadeLines, createArcadeTurf } from './render/field';
import { ArcadeFieldProps } from './render/fieldProps';
import { ArcadeFrogRain } from './render/frogRain';
import { ArcadePlainEvent } from './render/plainEvent';
import { eventEditorLink, type EventPractice } from './content/eventLink';
import { savedEventWarnings, type EventLook, type FieldEvent } from './content/fieldEvents';
import { ArcadePickups } from './render/pickups';
import { ArcadeIntro } from './render/intro';
import { ArcadeOutro } from './render/outro';
import { AREA_YARDS, BOSS_SPOT } from './sim/props';
import { AREA_SONGS, FARM_SONGS, hollowHop } from '../audio/songs';
import { WIN_TRACK_BEAT } from './content/dance';
import { areaAt } from './content/defense';
import type { Song } from '../audio/synth/render';
import { ArcadeQueenCrown } from './render/queenCrown';
import { ArcadeRoyalCrows } from './render/royalCrows';
import { ArcadeNames } from './render/names';
import { nameTags } from './ui/nameTags';
import { ArcadeRoutes } from './render/routes';
import { ArcadeSweep, litPlayers } from './render/sweep';
import { FIELD_AHEAD, FIELD_BEHIND, areaOrigin, toWorld } from './render/world';
import { carrierOf, qbOf } from './sim/ai';
import {
  SERIES_KINDS,
  stretchStart,
  createRun,
  dispatch,
  downAndDistance,
  downOn,
  frozenForTest,
  setUpSeries,
  startingRoster,
} from './sim/run';
import { rollOffer } from './sim/team';
import { FORM_STATS } from './content/team';
import { plus } from './sim/stats';
import { nextDot } from './sim/snag';
import { canThrow, step } from './sim/step';
import { now } from '../clock';
import { BUILD, PLAY_LOG_URL } from './log/build';
import { StatsKeeper } from './record/keeper';
import type { Saved, StatsStore } from './record/store';
import { modeOf, type RunRecord } from './record/types';
import { achievementsView, cardView, runView } from './ui/statsView';
import { achievement, newlyEarned } from './record/achievements';
import { StatsScreens } from '../ui/stats';
import { eventLines, flagLine, startLine, type LogMeta } from './log/playLog';
import { PlayLogSender } from './log/playLogSender';
import type {
  Action,
  ArcadeEvent,
  Player,
  RosterPlayer,
  RunState,
  StepInput,
  PickupKind,
} from './sim/types';
import { v } from './sim/vec';
import { ArcadeControls } from './ui/controls';
import { breakGrade, gradeCall, tapTestBuzz, tapTestSound } from './ui/tapTestCalls';
import { breakView, shooShowing, snagView, tipView } from './ui/testViews';
import type { Practice } from './content/playCode';
import { startingPlaybook } from './content/playPool';
import type { Play } from './content/plays';
import { trickOrTreatView } from './ui/trickOrTreat';

/** The sound of taking each kind of pickup (docs/PICKUPS.md). */
const PICKUP_SOUND: Readonly<Record<PickupKind, SfxId>> = { bolt: 'zap', slick: 'slip' };

/**
 * The sketches in the game couldn't be read: the run goes on with the play
 * pool, and the editor's list says why; the game stays quiet (map item n4).
 */
function unreadSketches(e: unknown): readonly Play[] {
  console.error('The sketches in the game could not be read for this run:', e);
  return [];
}

export interface ArcadeOptions {
  seed: number;
  /** Start with a monster team (Golem Blockers, Werewolf Runners, Ghost Catchers): ?monsters=1, for a look at them. */
  monsters?: boolean;
  /** Start at this area (1 the Forest, 2 the Candy Kingdom, 3 the third): ?area=2, for trying later areas. */
  area?: number;
  /** Go straight to the win cutscene after PLAY, with a full bench: ?win=1, for looking at it. */
  win?: boolean;
  /**
   * Video mode (?video=1, with ?win=1): the win dance without the title, held
   * still until `window.__videoStep(dt)` moves it on a frame, so a script can
   * capture evenly spaced frames (tools/video/).
   */
  video?: boolean;
  /**
   * Hard mode (a link's default: `readModes`): the zones go round until you lose, one more
   * defender each (at most 12) with stats +20 a zone, Break it! tighter
   * past the third, recruits +30 a zone (Hands slower), the sweep no faster
   * after the third, and TRICK OR TREAT! lets you set your lineup.
   */
  hard?: boolean;
  /** Two-tap throwing (a link's default: `readModes`): the first tap stops the line, the second picks how far. */
  twoTapAim?: boolean;
  /** SNAG IT! from the first series (?snag=1), not only from series 5 (docs/SNAG.md). */
  snagAlways?: boolean;
  /** ?perks=1: start holding every perk TRICK OR TREAT! offers (docs/REWARDS.md, o4). */
  startWithPerks?: boolean;
  /** The tip drill from the first series (?tip=1); with ?snag=1 too, either at random (docs/TIP.md). */
  tipAlways?: boolean;
  /** Which Frederick's Farm song candidate plays (1 Harvest Moon Hoedown, 2 Spooky Cow): ?farmSong=2. */
  farmSong?: number;
  /**
   * A practice link (?try=, the play editor's Try it): its sketch on the field
   * straight away, rep after rep, with ‹ Sketch back to the editor. A play the
   * link can't give opens the ordinary game, saying why until tapped.
   */
  practice?: Practice;
  /**
   * An event practice link (?event=, the event editor's Try it): that field
   * event every rep at the chosen series, with ‹ Events back to the editor. An
   * event the link can't give opens the ordinary game, saying why.
   */
  eventPractice?: EventPractice;
  /**
   * The play editor's sketches switched on In the game (map round 6), read
   * when each run starts and dealt alongside the play pool.
   */
  sketchesInGame?: () => Promise<readonly Play[]>;
  /** Where the run's record is kept (docs/STATS.md); none, and nothing is recorded. */
  stats?: StatsStore;
}

/** The starting team, or (with `monsters`) the same players turned into each position's monster. */
function firstRoster(monsters: boolean): RosterPlayer[] {
  const roster = startingRoster();
  if (!monsters) return roster;
  const kindFor = { blocker: 'golem', runner: 'werewolf', catcher: 'ghost' } as const;
  return roster.map((p) => {
    const kind = kindFor[p.preferred];
    return { ...p, kind, stats: plus(p.stats, FORM_STATS[kind]) };
  });
}

/**
 * The camera: behind and above the point it follows, looking down at this
 * angle (degrees) at a spot this far ahead of it. It pulls back as far as it
 * needs to show the whole width of the field, with this much to spare, at
 * the row it follows, whatever the screen's shape.
 */
const CAMERA_PITCH = 32;
/** The intro's crossfade into the first series (seconds). */
const INTRO_FADE = 1;
const LOOK_AHEAD = 7;
/** The win song's sing-along video: the win screen goes there. */
const WIN_SONG_URL = 'https://www.youtube.com/watch?v=7A2Udh11ASo';
/** If the redirect hasn't taken the page away by now, it was blocked: show the button. */
const SONG_LINK_DELAY_MS = 3000;
/** The win's card comes up once GOT JACK BACK has landed (the cutscene's words, render/outro.ts), over the dance. */
const WIN_CARD_DELAY_MS = 3500;
const WIDTH_MARGIN = 1.06;

export class ArcadeGame {
  private state: RunState;
  private seed: number;
  private readonly monsters: boolean;
  /** The area runs start at (0-based). */
  private readonly startArea: number;
  /** ?win=1: PLAY goes straight to the win cutscene. */
  private readonly jumpToWin: boolean;
  private readonly video: boolean;
  private readonly hard: boolean;
  private readonly twoTapAim: boolean;
  private readonly snagAlways: boolean;
  private readonly startWithPerks: boolean;
  private readonly tipAlways: boolean;
  /**
   * Practice: a sketch's play and its key in the play editor (‹ Sketch), or a
   * field event and the series it's tried at (‹ Events); null in an ordinary game.
   */
  private readonly practice:
    | { readonly kind: 'sketch'; readonly play: Play; readonly sketch: string | null }
    | { readonly kind: 'event'; readonly event: FieldEvent; readonly stretch: number }
    | null;
  /** Reads the play editor's sketches in the game; none without it. */
  private readonly sketchesInGame: (() => Promise<readonly Play[]>) | null;
  /** The run's record: kept as it's played, closed at Game Over or a win (docs/STATS.md). */
  private readonly stats: StatsKeeper | null;
  /** The stats screens (docs/STATS.md, v1-v5), with the record. */
  private readonly statsScreens: StatsScreens | null;
  /** What's kept, read in (the count under STATS waits for it). */
  private statsLoaded: Promise<void> | null = null;
  /** Each area's song (the Farm's is one of its candidates). */
  private readonly areaSongs: readonly Song[];
  private readonly conductor = new Conductor();
  private readonly view: View;
  private readonly bodies: ArcadeBodies;
  private readonly ball: ArcadeBall;
  private readonly sweep: ArcadeSweep;
  private readonly lines: ArcadeLines;
  private readonly routes: ArcadeRoutes;
  /** Your players' names under them before the snap (docs/REWARDS.md, notes p6). */
  private readonly names: ArcadeNames;
  /**
   * Each field event look's drawing and the sounds it goes off with: one
   * entry a look, so a new look won't compile until it has both (review r15).
   * Each drawing shows only events of its own look.
   */
  private readonly eventLooks: Readonly<
    Record<
      EventLook,
      {
        readonly draw: { update(state: RunState, origin: number, now: number): void };
        readonly sounds: readonly SfxId[];
      }
    >
  >;
  private readonly royalCrows: ArcadeRoyalCrows;
  private readonly queenCrown: ArcadeQueenCrown;
  private readonly fieldProps: ArcadeFieldProps;
  private readonly pickups: ArcadePickups;
  private readonly hud: Hud;
  private readonly controls: ArcadeControls;

  /** Yards marched in the series before this one: the field is one long strip. */
  private origin = 0;
  /** Unspent real time, carried into the next frame's fixed steps. */
  private accumulator = 0;
  private lastFrame: number | null = null;
  private paused = false;
  /** What the player pressed since the last step, applied on the next one. */
  private pending: StepInput = {};
  /** TRICK OR TREAT!: the spot first tapped for a swap. */
  private swapFrom: number | null = null;
  /** The first screen (just PLAY), until it's tapped. */
  private readonly startScreen: HTMLElement;
  /** PLAY was tapped and the music is getting ready (a second tap does nothing). */
  private starting = false;
  /** AGAIN is reading your plays for the next run: further taps wait. */
  private renewing = false;
  /** The win cutscene, after the last Boss: the end (it dances on, with no AGAIN). */
  private outro: ArcadeOutro | null = null;
  /** The way to the song if going there is blocked (toTheSong), once made. */
  private songLink: HTMLAnchorElement | null = null;
  /** The opening cutscene, while it plays (after the first PLAY). */
  private intro: ArcadeIntro | null = null;
  /** Where the camera looks (field yards, smoothed). */
  private focus = v(0, -4);
  /** The play log (docs/PLAY_LOG.md): every event sent to the droplet; null in the release build. */
  private readonly playLog: { readonly meta: LogMeta; readonly sender: PlayLogSender } | null;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly uiRoot: HTMLElement,
    options: ArcadeOptions,
  ) {
    this.seed = options.seed;
    this.monsters = options.monsters ?? false;
    this.startArea = Math.max(0, (options.area ?? 1) - 1);
    this.jumpToWin = options.win ?? false;
    this.video = options.video ?? false;
    this.hard = options.hard ?? false;
    this.twoTapAim = options.twoTapAim ?? false;
    this.snagAlways = options.snagAlways ?? false;
    this.startWithPerks = options.startWithPerks ?? false;
    this.tipAlways = options.tipAlways ?? false;
    this.sketchesInGame = options.sketchesInGame ?? null;
    const link = options.practice;
    const tryEvent = options.eventPractice;
    this.practice = link?.play.ok
      ? { kind: 'sketch', play: link.play.play, sketch: link.sketch }
      : tryEvent?.event.ok
        ? { kind: 'event', event: tryEvent.event.event, stretch: tryEvent.stretch }
        : null;
    const farm = FARM_SONGS[(options.farmSong ?? 1) - 1] ?? FARM_SONGS[0];
    this.areaSongs = [...AREA_SONGS, farm];
    this.state = this.newRun();
    this.lineUpCamera();
    this.view = new View(canvas, { fov: 50 });
    const { scene } = this.view;
    scene.add(createArcadeTurf());
    const scenery = new ForestScenery(scene, {
      halfWidth: arcadeTuning.field.halfWidth,
      nearZ: FIELD_BEHIND,
      farZ: -FIELD_AHEAD,
      endZ: -FIELD_AHEAD,
    });
    scene.add(scenery.group);
    // The pumpkin ball is the light (render/ball.ts): the moon is only a dim fill, with no shadows.
    setLights(this.view.hemi, this.view.sun, GAME_LIGHT);
    this.lines = new ArcadeLines(scene);
    this.routes = new ArcadeRoutes(scene);
    this.names = new ArcadeNames(uiRoot);
    this.eventLooks = {
      frogRain: { draw: new ArcadeFrogRain(scene), sounds: ['burst', 'hop'] },
      plain: { draw: new ArcadePlainEvent(scene), sounds: ['burst'] },
    };
    this.royalCrows = new ArcadeRoyalCrows(scene);
    this.queenCrown = new ArcadeQueenCrown(scene);
    this.fieldProps = new ArcadeFieldProps(scene);
    this.pickups = new ArcadePickups(scene);
    this.bodies = new ArcadeBodies(scene);
    this.ball = new ArcadeBall(scene);
    this.sweep = new ArcadeSweep(scene);
    this.hud = new Hud(uiRoot, {
      onAction: () => void this.onAction(),
      onCard: (hand) => this.call(hand),
      onFlip: () => this.act({ type: 'flip' }),
      onDraft: (offer) => this.act({ type: 'pick', offer }),
      onSkip: () => this.act({ type: 'skipDraft' }),
      onRoster: (spot) => this.onRoster(spot),
      onBack: () => this.backToEditor(),
      onFlag: () => this.flag(),
    });
    this.playLog = PLAY_LOG_URL ? this.startPlayLog(PLAY_LOG_URL) : null;
    this.statsScreens = options.stats ? new StatsScreens(uiRoot) : null;
    this.stats = options.stats ? this.startStats(options.stats) : null;
    if (link && !link.play.ok) this.hud.notice(`${link.play.reason} Playing without it.`);
    if (tryEvent && !tryEvent.event.ok)
      this.hud.notice(`${tryEvent.event.reason} Playing without it.`);
    if (this.practice?.kind === 'event') this.hud.setBackLabel('‹ Events');
    // Saved events the game couldn't read are left out: say so, never silently (docs/FIELD_EVENTS.md).
    if (savedEventWarnings.length > 0) this.hud.notice(savedEventWarnings.join(' · '));
    this.controls = new ArcadeControls(uiRoot, {
      onThrow: () => this.press({ throw: true }),
      onBreakTap: () => this.press({ breakTap: true }),
      onJuke: (side) => this.press({ juke: side }),
      onShoo: () => this.press({ shoo: true }),
      onSnag: (dot) => this.press({ snag: dot }),
      onTip: () => this.press({ tip: true }),
    });

    document.addEventListener('keydown', (e) => this.onKey(e));
    // The first screen: just PLAY, on the backdrop; it starts the music and the intro.
    // Practice has none: it opens on the field.
    this.startScreen = document.createElement('div');
    this.startScreen.className = 'start-screen interactive';
    const play = document.createElement('button');
    play.className = 'start-play';
    play.textContent = 'PLAY';
    play.addEventListener('click', () => void this.onAction());
    this.startScreen.append(play);
    // STATS under PLAY (v4): the stats section, over the start screen.
    const screens = this.statsScreens;
    if (screens) {
      const stats = document.createElement('button');
      stats.className = 'start-stats';
      stats.textContent = 'STATS';
      stats.addEventListener('click', () => {
        this.conductor.play('uiClick');
        screens.section(this.stats?.kept ?? { kind: 'unreadable' }, () => {});
      });
      // How many achievements you've earned (v4), once what's kept is read.
      const count = document.createElement('div');
      count.className = 'start-count';
      void this.statsLoaded?.then(() => {
        const kept = this.stats?.kept;
        if (kept?.kind === 'kept')
          count.textContent = achievementsView(kept.saved.achievements).count;
      });
      this.startScreen.append(stats, count);
    }
    if (!this.practice) uiRoot.append(this.startScreen);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'hidden') return;
      this.pause();
      // A phone may freeze or close a hidden page: send what's queued now (review r4).
      void this.playLog?.sender.sendNow();
      this.stats?.hidden();
    });

    this.bodies.sync(this.state);
    this.syncHud();
    this.view.renderer.setAnimationLoop((now) => this.frame(now));
  }

  // ── The loop ────────────────────────────────────────────────────────────

  private frame(now: number): void {
    const dt = this.lastFrame === null ? 0 : Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    // Each area has its song (the intro plays the first's; the win screen keeps the last).
    this.conductor.setSong(this.areaSong());
    // The intro plays with the game held still; when it ends it crossfades into the first series.
    if (this.intro) {
      const done = this.intro.update(dt, this.view.camera, this.view.canvas);
      this.view.render();
      // Its first frame is up: now the start screen can go.
      this.startScreen.remove();
      if (done) {
        this.intro.finish(this.view.canvas, INTRO_FADE);
        this.intro = null;
        this.syncHud();
      }
      return;
    }
    // The win cutscene: the end. It dances on for good (in video mode, a frame at a time
    // when the capture script asks).
    if (this.outro && this.video) return;
    if (this.outro) {
      this.outro.update(dt, this.view.camera);
      this.view.render();
      return;
    }
    if (this.live && !this.paused) {
      this.accumulator += dt * TIME_SCALE;
      while (this.accumulator >= DT) {
        this.stepOnce();
        this.accumulator -= DT;
      }
    }
    this.draw(dt);
  }

  private stepOnce(): void {
    const input: StepInput = { ...this.pending };
    this.pending = {};
    const prev = this.state;
    const { state, events } = step(prev, input);
    this.state = state;
    this.after(events, prev);
  }

  /**
   * Whether the game takes taps and runs: once PLAY has started the music, or
   * in practice from the start (its sound starts with the first tap, wakeSound).
   */
  private get live(): boolean {
    return this.practice !== null || this.conductor.started;
  }

  /**
   * Practice: a browser plays no sound until the page is tapped, so the first
   * tap starts it. Call from inside a tap.
   */
  private wakeSound(): void {
    if (!this.practice || this.conductor.started || this.starting) return;
    this.starting = true;
    this.conductor.start(this.areaSong()).catch((e: unknown) => {
      this.starting = false;
      this.hud.notice(`The sound couldn't start (${e instanceof Error ? e.message : String(e)}).`);
    });
  }

  /** Practice: ‹ Sketch back to the play editor, or ‹ Events back to the event editor, with what was tried open. */
  private backToEditor(): void {
    const p = this.practice;
    if (p?.kind === 'event') {
      location.assign(eventEditorLink(location.href, p.event.id));
      return;
    }
    const editor = new URL('dev/plays.html', location.href);
    if (p?.sketch) editor.hash = p.sketch;
    location.assign(editor.href);
  }

  private act(action: Action): void {
    this.wakeSound();
    if (!this.live || this.paused) return;
    const prev = this.state;
    const { state, events } = dispatch(prev, action);
    this.state = state;
    this.after(events, prev);
    this.syncHud();
  }

  /** TRICK OR TREAT!: tap two spots (field or bench) in turn to swap them. */
  private onRoster(spot: number): void {
    this.conductor.play('uiClick');
    if (this.swapFrom === null) {
      this.swapFrom = spot;
    } else {
      const from = this.swapFrom;
      this.swapFrom = null;
      if (from !== spot) this.act({ type: 'swap', a: from, b: spot });
    }
    this.syncHud();
  }

  private call(hand: number): void {
    this.conductor.play('uiClick');
    this.act({ type: 'call', hand });
  }

  /** A button press, applied on the next step (if it means anything right now). */
  private press(input: StepInput): void {
    this.wakeSound();
    if (!this.live || this.paused) return;
    this.pending = { ...this.pending, ...input };
  }

  private after(events: readonly ArcadeEvent[], prev: RunState): void {
    // A cleared area marches on: the next area's 0 is the old one's goal line (not after the last),
    // so the camera keeps its place relative to the field. Hard mode's zones come round onto the
    // same stretch of the long strip (areaOrigin), which looks the same.
    if (events.some((e) => e.type === 'seriesWon') && this.state.phase !== 'won') {
      if (this.state.series.area !== prev.series.area) {
        this.focus = v(this.focus.x, this.focus.y - AREA_YARDS);
      }
      this.origin = areaOrigin(this.state.series.area);
    }
    // The outro asks the keeper whether a played run is being recorded (its card comes, or the
    // song at once), so it starts before the keeper sees the win and closes the run.
    if (this.state.phase === 'won' && !this.outro) this.startOutro();
    this.react(events, prev);
    this.stats?.step(prev, this.state, events);
    // Pops wait out a play (h2): they show in the pause after a down, and in setup.
    const playing = this.state.phase === 'play' || frozenForTest(this.state.phase);
    this.statsScreens?.holdToasts(playing);
    if (events.length > 0 || this.state.phase !== prev.phase) this.syncHud();
    if (this.playLog && events.length > 0) {
      const lines = eventLines(prev, this.state, events, this.playLog.meta, now());
      this.playLog.sender.add(lines, { now: events.some((e) => e.type === 'downEnded') });
    }
  }

  /** The run's record (docs/STATS.md): what's kept read in; each run is recorded from PLAY or AGAIN (freshRun). */
  private startStats(store: StatsStore): StatsKeeper {
    const keeper = new StatsKeeper({
      store,
      build: BUILD,
      link: location.search.replace(/^\?/, ''),
      newId: () => crypto.randomUUID(),
      now,
      notice: (text) => this.hud.notice(text),
      onClosed: (record, before) => this.showCard(record, before),
      // Each pops at the top, in the pause after the down that earned it (h2).
      onEarned: (ids) => {
        for (const id of ids) this.statsScreens?.toast(achievement(id), this.state.hard);
      },
    });
    this.statsLoaded = keeper.load();
    return keeper;
  }

  /** The card at Game Over (v1) or a win (v3): the run's stats, the records it broke, and STATS for the rest. */
  private showCard(record: RunRecord, before: Saved | null): void {
    const screens = this.statsScreens;
    if (!screens) return;
    const view = cardView(
      record,
      before?.allTime[modeOf(record.modes)].records ?? null,
      // Stats that couldn't be read kept nothing earned: the card claims none.
      before ? newlyEarned(before.achievements, record) : [],
    );
    const stats = {
      label: 'STATS',
      onTap: () => {
        this.conductor.play('uiClick');
        screens.run(runView(record), () => {});
      },
    };
    if (record.end === 'won') {
      const song = { label: '♪ THE SONG', main: true, onTap: () => this.toTheSong() };
      window.setTimeout(() => screens.card(view, [stats, song]), WIN_CARD_DELAY_MS);
      return;
    }
    screens.card(view, [stats, { label: 'AGAIN', main: true, onTap: () => void this.onAction() }]);
  }

  /** The play log: sent where the build says (l1), its status shown on ⚑ (l4). */
  private startPlayLog(url: string): { meta: LogMeta; sender: PlayLogSender } {
    const sender = new PlayLogSender({
      post: (body, signal) =>
        fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
          signal,
          // A send can outlive the page (a reload mid-down) only under the browser's 64 kB limit.
          keepalive: body.length < 60_000,
        }),
      later: (fn, ms) => {
        const t = setTimeout(fn, ms);
        return () => clearTimeout(t);
      },
      onStatus: (status) => this.hud.setFlag(status === 'off' ? 'off' : 'plain'),
    });
    this.hud.setFlag('plain');
    const meta: LogMeta = {
      session: crypto.randomUUID().slice(0, 8),
      build: BUILD,
      link: location.search.replace(/^\?/, ''),
    };
    sender.add([startLine(this.state, meta, now())], { now: true });
    return { meta, sender };
  }

  /** ⚑ (l4): mark this moment in the play log, and say so once it's stored, or that it isn't logging (review r5). */
  private flag(): void {
    const log = this.playLog;
    if (!log) return;
    const at = now();
    void log.sender.sendNow([flagLine(this.state, log.meta, at)]).then((stored) => {
      if (!stored) this.hud.pop('Not logging', 'bad');
      else
        this.hud.pop(
          `Flagged ${new Date(at).toLocaleTimeString('en-US', { hour12: false })}`,
          'good',
        );
    });
  }

  private draw(dt: number): void {
    const { state } = this;
    this.lines.update(state.series, this.origin);
    this.routes.update(state, this.origin, this.previewPlayers());
    this.names.update(
      this.live && !this.paused ? nameTags(state) : [],
      this.origin,
      this.view.camera,
      this.view.canvas,
    );
    // Keep the views in step with the field: a recruit joining or a swap changes who's where.
    this.bodies.sync(state);
    this.bodies.update(state, this.origin, dt, litPlayers(state));
    this.ball.update(state, this.origin, this.bodies, dt, performance.now() / 1000);
    this.sweep.update(state, this.origin);
    for (const look of Object.values(this.eventLooks)) {
      look.draw.update(state, this.origin, performance.now() / 1000);
    }
    this.royalCrows.update(state, this.origin);
    this.queenCrown.update(state, this.origin, performance.now() / 1000);
    this.controls.setShoo(shooShowing(state));
    this.fieldProps.update(state, this.origin);
    this.fieldProps.animate(performance.now() / 1000);
    this.pickups.update(state, this.origin);
    this.pickups.animate(performance.now() / 1000);
    this.controls.setButtons(canThrow(state) && !this.paused);
    this.controls.setBreak(breakView(state));
    this.controls.setSnag(snagView(state));
    this.controls.setTip(tipView(state));
    this.follow(dt);
    this.view.render();
  }

  /** Before the hike, the called play's players (their routes are drawn), or null. */
  private previewPlayers(): Player[] | null {
    const { state } = this;
    return state.phase === 'setup' && state.called !== null ? state.field.players : null;
  }

  /** The third-person camera: behind and above whatever matters (the QB, the ball, the carrier). */
  private follow(dt: number): void {
    const { state } = this;
    const qb = qbOf(state);
    const carrier = carrierOf(state);
    const ball = state.field.ball;
    let want = qb ? qb.pos : v(0, state.series.los - 4);
    if (carrier) want = carrier.pos;
    else if (ball.at === 'flight') want = v(0, Math.max(want.y, ball.target.y - 8));
    else if (ball.at === 'contested') want = ball.pos;
    // The whole width is always in view, so only follow upfield.
    want = v(0, want.y);
    // In Break it! (and the catch tests) the camera eases in a little on the tackle (the catch).
    const frozen = frozenForTest(state.phase);
    const k = 1 - Math.exp(-dt * (frozen ? 2 : 4));
    this.focus = v(
      this.focus.x + (want.x - this.focus.x) * k,
      this.focus.y + (want.y - this.focus.y) * k,
    );

    const cam = this.view.camera;
    const at = toWorld(this.focus, this.origin);
    const pitch = THREE.MathUtils.degToRad(CAMERA_PITCH);
    // The horizontal half-angle the screen shows; far enough back that the field's width fits at the followed row.
    const halfAcross = Math.atan(Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * cam.aspect);
    const back =
      (arcadeTuning.field.halfWidth * WIDTH_MARGIN) / Math.tan(halfAcross) +
      LOOK_AHEAD * Math.cos(pitch);
    const look = new THREE.Vector3(at.x, 0, at.z - LOOK_AHEAD);
    cam.position.set(look.x, back * Math.sin(pitch), look.z + back * Math.cos(pitch));
    cam.lookAt(look);
    cam.updateMatrixWorld();
    // Keep the moonlight (a dim fill) around the play, and the fog ahead of the camera.
    const { sun } = this.view;
    sun.target.position.copy(look).add(new THREE.Vector3(0, 0, -6));
    sun.position.copy(sun.target.position).add(new THREE.Vector3(-12, 26, 8));
    if (this.view.scene.fog instanceof THREE.Fog) {
      this.view.scene.fog.near = back + 10;
      this.view.scene.fog.far = back + 45;
    }
  }

  // ── Feedback ────────────────────────────────────────────────────────────

  private react(events: readonly ArcadeEvent[], prev: RunState): void {
    const play = (id: Parameters<Conductor['play']>[0]): void => this.conductor.play(id);
    for (const e of events) {
      // A tap test's sounds, as the test bench plays them (ui/tapTestCalls.ts).
      const sound = tapTestSound(e);
      if (sound) play(sound);
      switch (e.type) {
        case 'banned':
          play('fumble');
          this.hud.pop('BY ROYAL DECREE!', 'bad');
          break;
        case 'snapped':
          this.hud.pop(
            `${(this.state.playbook[this.state.play.index]?.name ?? '').toUpperCase()}!`,
            'good',
          );
          break;
        case 'thrown':
          play('throw');
          this.ball.burst(90, 6);
          break;
        case 'handoff':
          play('catch');
          break;
        case 'caught':
          this.ball.burst(70, 4.5);
          play(e.contested ? 'cleanCatch' : 'catch');
          this.hud.pop(e.contested ? 'CAUGHT IT!' : 'GOT IT!', 'good');
          break;
        case 'batted':
          this.ball.burst(120, 7);
          play('fumble');
          play('chant');
          this.hud.pop(e.contested ? 'DROPPED!' : 'BLOCKED!', 'bad');
          break;
        case 'incomplete':
          play('fumble');
          this.hud.pop('INCOMPLETE', 'bad');
          break;
        case 'sacked':
          play('sack');
          this.hud.pop('SACKED!', 'bad');
          break;
        case 'joined':
          this.hud.pop(`${e.name.toUpperCase()} JOINS!`, 'good');
          break;
        // A perk says so when it changes a play (docs/REWARDS.md, notes p4); neither is used up.
        case 'magnet':
          this.hud.pop('MAGNET!', 'good', 'Candy Corn Magnet pulled it in');
          break;
        case 'secondWind':
          this.hud.pop('SECOND WIND!', 'good', 'back next series');
          break;
        case 'pancake':
          play('burst');
          break;
        case 'breakResult': {
          const call = gradeCall('bar', breakGrade(e.outcome));
          this.hud.big(call.word, call.tone);
          break;
        }
        case 'snagDot':
        case 'tipPop':
          if (tapTestBuzz(e)) navigator.vibrate?.(12);
          break;
        case 'snagResult': {
          const call = gradeCall('snag', e.grade);
          this.hud.big(call.word, call.tone);
          break;
        }
        case 'tipResult': {
          const call = gradeCall('tip', e.grade);
          this.hud.big(call.word, call.tone);
          break;
        }
        case 'crowsShooed':
        case 'crowsStruck': {
          const call = gradeCall('shoo', e.type === 'crowsShooed' ? 'great' : 'bad');
          this.hud.big(call.word, call.tone);
          break;
        }
        case 'fieldEventWentOff':
          for (const id of this.eventLooks[e.look].sounds) play(id);
          break;
        case 'eventTackled':
          // An event with no call tackles quietly: never a blank word.
          if (e.call) this.hud.big(e.call, 'bad');
          break;
        case 'pickupTaken':
          play(PICKUP_SOUND[e.kind]);
          break;
        case 'slipped':
          this.hud.big('SLIPPED!', 'bad');
          break;
        case 'outOfBounds':
          this.hud.pop('OUT OF BOUNDS', 'bad');
          break;
        case 'downEnded':
          if (e.result === 'firstDown' || e.result === 'touchdown') {
            play('touchdown');
            // Called as the down ends, not as the line is crossed (docs/LONG_FIELD.md, b2); a
            // touchdown clears its area: "Froggy's Forest Cleared!" (a practice rep clears nothing, e2).
            const call =
              e.result === 'firstDown'
                ? 'FIRST DOWN!'
                : prev.practice
                  ? 'TOUCHDOWN!'
                  : `${areaAt(prev.series.area).name} Cleared!`;
            this.hud.pop(call, 'good');
          } else if (e.result === 'tackled' || e.result === 'outOfBounds') {
            const yards = Math.round(e.gained);
            this.hud.pop(
              yards > 0 ? `+${yards} YARDS` : yards < 0 ? `LOSS OF ${-yards}` : 'NO GAIN',
              yards > 0 ? 'good' : 'bad',
            );
          }
          break;
        default:
          break;
      }
    }
  }

  private syncHud(): void {
    if (this.outro) {
      // Nothing over the win: it's the end.
      this.hud.setDowns(null);
      this.hud.setHand(null, null);
      this.hud.setDraft(null);
      this.hud.setPrompt(null, null);
      return;
    }
    if (this.intro) {
      // Nothing over the intro.
      this.hud.setDowns(null);
      this.hud.setHand(null, null);
      this.hud.setDraft(null);
      this.hud.setPrompt(null, null);
      return;
    }
    const { phase, hand, flipped, called, banned } = this.state;
    // No series name during play, and no tally after: the card says how the run went (docs/STATS.md, z2).
    const live = downOn(phase);
    this.hud.setDowns(live ? downAndDistance(this.state) : null);
    const ready = this.live && !this.paused;
    // Practice: ‹ Sketch between reps (map item t4), not mid-play.
    if (this.practice) this.hud.setBack(phase === 'setup' || phase === 'downOver');
    const cards =
      ready && phase === 'setup'
        ? hand.map((i) => {
            const p = this.state.playbook[i];
            return { name: p?.name ?? '?', blurb: p?.handoff !== undefined ? 'Run' : 'Pass' };
          })
        : null;
    this.hud.setHand(cards, called, flipped, banned);
    if (phase !== 'draft') this.swapFrom = null;
    this.hud.setDraft(
      ready && phase === 'draft' ? trickOrTreatView(this.state, this.swapFrom) : null,
    );
    if (!this.live) this.hud.setPrompt(null, null);
    else if (this.paused) this.hud.setPrompt('Paused', 'RESUME');
    else if (phase === 'setup')
      this.hud.setPrompt(called === null ? 'Pick a play' : null, called === null ? null : 'HIKE!');
    // With the stats screens, Game Over is their card (v1), and its AGAIN.
    else if (phase === 'over' && this.statsScreens) this.hud.setPrompt(null, null);
    else if (phase === 'over') this.hud.setPrompt('Game Over!', 'AGAIN');
    else if (phase === 'won') this.hud.setPrompt(null, null);
    else this.hud.setPrompt(null, null);
  }

  /** The area's song (the intro plays the first area's). */
  private areaSong(): Song {
    const songs = this.areaSongs;
    return songs[this.state.series.area % songs.length] ?? hollowHop;
  }

  private async onAction(): Promise<void> {
    this.conductor.play('uiClick');
    const { phase } = this.state;
    if (!this.live) {
      // The music starts, then the intro plays (once a game: AGAIN goes straight to the field).
      // The start screen stays up until the intro has drawn its first frame, so the field
      // never shows in between.
      if (this.starting) return;
      this.starting = true;
      await this.conductor.start(this.areaSong());
      if (this.jumpToWin) {
        this.startScreen.remove();
        this.skipToWin();
        this.syncHud();
        return;
      }
      await this.freshRun();
      this.intro = new ArcadeIntro(this.view.scene, this.uiRoot, (id) => this.conductor.play(id));
    } else if (this.paused) {
      this.paused = false;
      this.lastFrame = null;
      await this.conductor.resume();
    } else if (phase === 'setup') {
      this.act({ type: 'hike' });
    } else if (phase === 'over') {
      // AGAIN after a Game Over (a win is the end: there's no AGAIN). Reading your
      // plays takes a moment, so a second tap meanwhile mustn't start another run.
      if (this.renewing) return;
      this.renewing = true;
      try {
        this.seed++;
        await this.freshRun();
      } finally {
        this.renewing = false;
      }
      this.statsScreens?.hideCard();
      this.statsScreens?.closePanel();
    }
    this.syncHud();
  }

  /** A new run with the plays as they are now: the sketches in the game are read as each run starts (n6). */
  private async freshRun(): Promise<void> {
    const sketches = this.sketchesInGame ? await this.sketchesInGame().catch(unreadSketches) : [];
    this.state = this.newRun(sketches);
    this.stats?.start(this.state);
    this.lineUpCamera();
    this.bodies.sync(this.state);
  }

  /**
   * A new run, dealing the play pool and these sketches (practice: always the
   * Forest's first series with its one sketch, map item t3).
   */
  private newRun(sketches: readonly Play[] = []): RunState {
    const p = this.practice;
    if (p)
      return createRun(this.seed, firstRoster(this.monsters), 0, {
        twoTapAim: this.twoTapAim,
        snagAlways: this.snagAlways,
        tipAlways: this.tipAlways,
        ...(p.kind === 'sketch'
          ? { practice: p.play }
          : { eventPractice: { event: p.event, stretch: p.stretch } }),
      });
    return createRun(this.seed, firstRoster(this.monsters), this.startArea, {
      hard: this.hard,
      twoTapAim: this.twoTapAim,
      snagAlways: this.snagAlways,
      tipAlways: this.tipAlways,
      playbook: startingPlaybook(sketches),
      startWithPerks: this.startWithPerks,
    });
  }

  /** The camera on a new run: its area placed on the long strip, looking from behind the line of scrimmage. */
  private lineUpCamera(): void {
    this.origin = areaOrigin(this.state.series.area);
    this.focus = v(0, this.state.series.los - 4);
  }

  /** ?win=1: the run as if just won (on the King's series, eleven recruits on the bench), and the win cutscene. */
  private skipToWin(): void {
    const s = createRun(this.seed, firstRoster(this.monsters), arcadeTuning.run.areas - 1);
    setUpSeries(s, s.series.area, stretchStart(SERIES_KINDS.length - 1), [], true);
    // One recruit for every TRICK OR TREAT! a full run has.
    for (let i = 0; i < arcadeTuning.run.areas * SERIES_KINDS.length - 1; i++) {
      s.seriesWon = i;
      const offer = rollOffer(s)[i % 2];
      if (offer?.kind === 'player') s.bench.unshift(offer.player);
    }
    s.seriesWon = arcadeTuning.run.areas * SERIES_KINDS.length;
    s.phase = 'won';
    this.state = s;
    this.lineUpCamera();
    this.bodies.sync(s);
    this.fieldProps.update(s, this.origin);
    this.startOutro();
  }

  /** The win: the field's cast steps aside and the whole roster dances in front of the King. */
  private startOutro(): void {
    const king = toWorld(BOSS_SPOT, this.origin);
    const cast = [...this.state.roster, ...this.state.bench].map((p) => p.kind);
    this.bodies.setVisible(false);
    this.ball.setVisible(false);
    // The dance keeps the beat of the win song (We Got Jack Back, the sing-along video's).
    this.outro = new ArcadeOutro(
      this.view.scene,
      this.uiRoot,
      king,
      cast,
      (id) => this.conductor.play(id),
      WIN_TRACK_BEAT,
      !this.video,
    );
    if (this.video) {
      const outro = this.outro;
      Object.assign(window, {
        __videoStep: (dt: number): void => {
          outro.update(dt, this.view.camera);
          this.view.render();
        },
      });
    } else {
      // A played run's win shows its card, with the song a tap away (v3); ?win=1's shortcut has none.
      if (!this.stats?.recording) this.toTheSong();
    }
  }

  /**
   * The win song lives on YouTube: go straight there. If the page is still
   * here a moment later (the redirect was blocked), show a button for it.
   */
  private toTheSong(): void {
    // Once is enough for the button: ♪ THE SONG can be tapped again.
    if (this.songLink) {
      this.songLink.hidden = false;
      return;
    }
    const link = document.createElement('a');
    this.songLink = link;
    link.className = 'song-link interactive';
    link.href = WIN_SONG_URL;
    link.textContent = "Listen to 'We Got Jack Back' on YouTube";
    link.hidden = true;
    this.uiRoot.append(link);
    try {
      window.location.assign(WIN_SONG_URL);
    } catch {
      // Blocked: the button's there for it.
    }
    window.setTimeout(() => {
      if (document.visibilityState === 'visible') link.hidden = false;
    }, SONG_LINK_DELAY_MS);
  }

  private pause(): void {
    // Practice runs before its sound has started (wakeSound), so it pauses then too.
    if (!this.live || this.paused) return;
    this.paused = true;
    this.pending = {};
    this.conductor.pause();
    this.syncHud();
  }

  /** Space in SNAG IT!: a tap on the dot that's showing and closes first. */
  private snagKey(): void {
    const i = nextDot(this.state);
    if (i !== null) this.press({ snag: i });
  }

  private onKey(e: KeyboardEvent): void {
    if (e.repeat) return;
    // The intro plays through (it's short): keys wait for it.
    if (this.intro) return;
    const { phase } = this.state;
    if (e.code === 'Space') {
      e.preventDefault();
      if (phase === 'setup') this.act({ type: 'hike' });
      else if (phase === 'breakit') this.press({ breakTap: true });
      else if (phase === 'snag') this.snagKey();
      else if (phase === 'tip') this.press({ tip: true });
      else this.press({ throw: true });
    } else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
      if (phase === 'breakit') this.press({ juke: e.code === 'ArrowLeft' ? -1 : 1 });
    } else if (e.code === 'KeyS' && phase === 'play') this.press({ shoo: true });
    else if (e.code === 'KeyF' && phase === 'setup') this.act({ type: 'flip' });
    else if (phase === 'setup' && ['Digit1', 'Digit2', 'Digit3'].includes(e.code)) {
      this.call(Number(e.code.slice(-1)) - 1);
    }
  }
}
