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
import { ForestScenery } from '../render/scenery';
import { View } from '../render/view';
import { Hud } from '../ui/hud';
import { arcadeTuning, DT, TIME_SCALE } from './content/tuning';
import { ArcadeBall } from './render/ball';
import { ArcadeBodies } from './render/bodies';
import { ArcadeLines, createArcadeTurf } from './render/field';
import { ArcadeFieldProps } from './render/fieldProps';
import { ArcadeFrogRain } from './render/frogRain';
import { ArcadePickups } from './render/pickups';
import { ArcadeIntro } from './render/intro';
import { ArcadeOutro } from './render/outro';
import { BOSS_SPOT } from './sim/props';
import { AREA_SONGS, FARM_SONGS, hollowHop } from '../audio/songs';
import { WIN_TRACK_BEAT } from './content/dance';
import { areaAt } from './content/defense';
import type { Song } from '../audio/synth/render';
import { ArcadeQueenCrown } from './render/queenCrown';
import { ArcadeRoyalCrows } from './render/royalCrows';
import { ArcadeRoutes } from './render/routes';
import { ArcadeSweep, litPlayers } from './render/sweep';
import { FIELD_AHEAD, FIELD_BEHIND, toWorld } from './render/world';
import { carrierOf, qbOf } from './sim/ai';
import {
  DRIVE_KINDS,
  createRun,
  dispatch,
  downAndDistance,
  downOn,
  driveNumber,
  frozenForTest,
  setUpDrive,
  startingRoster,
} from './sim/run';
import { rollOffer } from './sim/team';
import { FORM_STATS } from './content/team';
import { plus } from './sim/stats';
import { nextDot } from './sim/snag';
import { canThrow, step } from './sim/step';
import type {
  Action,
  ArcadeEvent,
  Drive,
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
import { PLAY_POOL } from './content/playPool';
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
  /** SNAG IT! from the first drive (?snag=1), not only from drive 5 (docs/SNAG.md). */
  snagAlways?: boolean;
  /** The tip drill from the first drive (?tip=1); with ?snag=1 too, either at random (docs/TIP.md). */
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
   * The play editor's sketches switched on In the game (map round 6), read
   * when each run starts and dealt alongside the play pool.
   */
  sketchesInGame?: () => Promise<readonly Play[]>;
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
/** The intro's crossfade into the first drive (seconds). */
const INTRO_FADE = 1;
/** With the pumpkin ball as the light, the moon and the sky are only a dim fill, so the field stays readable. */
const MOON_FILL = 0.45;
const SKY_FILL = 0.75;
const LOOK_AHEAD = 7;
/** The win song's sing-along video: the win screen goes there. */
const WIN_SONG_URL = 'https://www.youtube.com/watch?v=7A2Udh11ASo';
/** If the redirect hasn't taken the page away by now, it was blocked: show the button. */
const SONG_LINK_DELAY_MS = 3000;
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
  private readonly tipAlways: boolean;
  /** Practice: the sketch's play, and its key in the editor for ‹ Sketch; null in an ordinary game. */
  private readonly practice: { readonly play: Play; readonly sketch: string | null } | null;
  /** Reads the play editor's sketches in the game; none without it. */
  private readonly sketchesInGame: (() => Promise<readonly Play[]>) | null;
  /** Each area's song (the Farm's is one of its candidates). */
  private readonly areaSongs: readonly Song[];
  private readonly conductor = new Conductor();
  private readonly view: View;
  private readonly bodies: ArcadeBodies;
  private readonly ball: ArcadeBall;
  private readonly sweep: ArcadeSweep;
  private readonly lines: ArcadeLines;
  private readonly routes: ArcadeRoutes;
  private readonly frogRain: ArcadeFrogRain;
  private readonly royalCrows: ArcadeRoyalCrows;
  private readonly queenCrown: ArcadeQueenCrown;
  private readonly fieldProps: ArcadeFieldProps;
  private readonly pickups: ArcadePickups;
  private readonly hud: Hud;
  private readonly controls: ArcadeControls;

  /** Yards marched in the drives before this one: the field is one long strip. */
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
  /** The opening cutscene, while it plays (after the first PLAY). */
  private intro: ArcadeIntro | null = null;
  /** Where the camera looks (field yards, smoothed). */
  private focus = v(0, -4);

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
    this.tipAlways = options.tipAlways ?? false;
    this.sketchesInGame = options.sketchesInGame ?? null;
    const link = options.practice;
    this.practice = link?.play.ok ? { play: link.play.play, sketch: link.sketch } : null;
    const farm = FARM_SONGS[(options.farmSong ?? 1) - 1] ?? FARM_SONGS[0];
    this.areaSongs = [...AREA_SONGS, farm];
    this.state = this.newRun();
    this.origin = this.startOrigin();
    this.view = new View(canvas, { fov: 50 });
    const { scene } = this.view;
    scene.add(createArcadeTurf());
    const scenery = new ForestScenery(scene, this.view, {
      halfWidth: arcadeTuning.field.halfWidth,
      nearZ: FIELD_BEHIND,
      farZ: -FIELD_AHEAD,
      endZ: -FIELD_AHEAD,
    });
    scene.add(scenery.group);
    // The pumpkin ball is the light (render/ball.ts): the moon is only a dim fill, with no shadows.
    this.view.sun.castShadow = false;
    this.view.sun.intensity = MOON_FILL;
    this.view.hemi.intensity = SKY_FILL;
    this.lines = new ArcadeLines(scene);
    this.routes = new ArcadeRoutes(scene);
    this.frogRain = new ArcadeFrogRain(scene);
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
      onBack: () => this.backToSketch(),
    });
    if (link && !link.play.ok) this.hud.notice(`${link.play.reason} Playing without it.`);
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
    if (!this.practice) uiRoot.append(this.startScreen);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.pause();
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
    // The intro plays with the game held still; when it ends it crossfades into the first drive.
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

  /** Practice: ‹ Sketch, back to the play editor with the sketch open. */
  private backToSketch(): void {
    const editor = new URL('dev/plays.html', location.href);
    if (this.practice?.sketch) editor.hash = this.practice.sketch;
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
    // A won drive marches on: the new drive's 0 is the old one's first-down line (not after the
    // last). Hard mode's zones come round onto the same stretch of field (originOf).
    if (events.some((e) => e.type === 'driveWon') && this.state.phase !== 'won') {
      this.origin = this.originOf(this.state.drive);
    }
    if (this.state.phase === 'won' && !this.outro) this.startOutro();
    this.react(events, prev);
    if (events.length > 0 || this.state.phase !== prev.phase) this.syncHud();
  }

  private draw(dt: number): void {
    const { state } = this;
    this.lines.update(state.drive, this.origin);
    this.routes.update(state, this.origin, this.previewPlayers());
    // Keep the views in step with the field: a recruit joining or a swap changes who's where.
    this.bodies.sync(state);
    this.bodies.update(state, this.origin, dt, litPlayers(state));
    this.ball.update(state, this.origin, this.bodies, dt, performance.now() / 1000);
    this.sweep.update(state, this.origin);
    this.frogRain.update(state, this.origin);
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
    let want = qb ? qb.pos : v(0, state.drive.los - 4);
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
          play('burst');
          if (this.state.field.fieldEvent?.event.look === 'frogRain') play('hop');
          break;
        case 'eventTackled':
          this.hud.big(e.call, 'bad');
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
          if (e.result === 'firstDown') {
            play('touchdown');
            // Beating a Boss clears its area: "Froggy's Forest Cleared!".
            this.hud.pop(
              prev.drive.kind === 'boss'
                ? `${areaAt(prev.drive.area).name} Cleared!`
                : 'FIRST DOWN!',
              'good',
            );
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
      this.hud.setTop('', null);
      this.hud.setHand(null, null);
      this.hud.setDraft(null);
      this.hud.setPrompt(null, null);
      return;
    }
    if (this.intro) {
      // Nothing over the intro.
      this.hud.setTop('', null);
      this.hud.setHand(null, null);
      this.hud.setDraft(null);
      this.hud.setPrompt(null, null);
      return;
    }
    const { phase, drivesWon, hand, flipped, called, banned } = this.state;
    // No drive name during play: only the tally once the run is over.
    const banner =
      phase === 'over' || phase === 'won'
        ? `${drivesWon} ${drivesWon === 1 ? 'drive' : 'drives'} won`
        : '';
    const live = downOn(phase);
    this.hud.setTop(banner, live ? downAndDistance(this.state) : null);
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
    else if (phase === 'over') this.hud.setPrompt('Game Over!', 'AGAIN');
    else if (phase === 'won') this.hud.setPrompt(null, null);
    else this.hud.setPrompt(null, null);
  }

  /** The area's song (the intro plays the first area's). */
  private areaSong(): Song {
    const songs = this.areaSongs;
    return songs[this.state.drive.area % songs.length] ?? hollowHop;
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
      this.focus = v(0, -4);
    }
    this.syncHud();
  }

  /** A new run with the plays as they are now: the sketches in the game are read as each run starts (n6). */
  private async freshRun(): Promise<void> {
    const sketches = this.sketchesInGame ? await this.sketchesInGame().catch(unreadSketches) : [];
    this.state = this.newRun(sketches);
    this.origin = this.startOrigin();
    this.bodies.sync(this.state);
  }

  /**
   * A new run, dealing the play pool and these sketches (practice: always the
   * Forest's first drive with its one sketch, map item t3).
   */
  private newRun(sketches: readonly Play[] = []): RunState {
    if (this.practice)
      return createRun(this.seed, firstRoster(this.monsters), 0, {
        twoTapAim: this.twoTapAim,
        snagAlways: this.snagAlways,
        tipAlways: this.tipAlways,
        practice: this.practice.play,
      });
    return createRun(this.seed, firstRoster(this.monsters), this.startArea, {
      hard: this.hard,
      twoTapAim: this.twoTapAim,
      snagAlways: this.snagAlways,
      tipAlways: this.tipAlways,
      playbook: [...PLAY_POOL, ...sketches],
    });
  }

  private startOrigin(): number {
    return this.originOf(this.state.drive);
  }

  /**
   * Where a drive's 0 sits on the long field: its area's stretch, then its
   * drives before it. The field only has the three areas, so hard mode's
   * endless zones come round onto the same stretches (they look the same).
   */
  private originOf(drive: Drive): number {
    const area = drive.area % arcadeTuning.run.areas;
    return (driveNumber({ area, index: drive.index }) - 1) * arcadeTuning.drive.distance;
  }

  /** ?win=1: the run as if just won (on the King's drive, eleven recruits on the bench), and the win cutscene. */
  private skipToWin(): void {
    const s = createRun(this.seed, firstRoster(this.monsters), arcadeTuning.run.areas - 1);
    setUpDrive(s, s.drive.area, DRIVE_KINDS.length - 1, [], true);
    // One recruit for every TRICK OR TREAT! a full run has.
    for (let i = 0; i < arcadeTuning.run.areas * DRIVE_KINDS.length - 1; i++) {
      s.drivesWon = i;
      const offer = rollOffer(s)[i % 2];
      if (offer?.kind === 'recruit') s.bench.unshift(offer.player);
    }
    s.drivesWon = arcadeTuning.run.areas * DRIVE_KINDS.length;
    s.phase = 'won';
    this.state = s;
    this.origin = this.originOf(s.drive);
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
      this.toTheSong();
    }
  }

  /**
   * The win song lives on YouTube: go straight there. If the page is still
   * here a moment later (the redirect was blocked), show a button for it.
   */
  private toTheSong(): void {
    const link = document.createElement('a');
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
