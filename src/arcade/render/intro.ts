/**
 * The opening cutscene (THEME.md, The Story), played once after the first
 * PLAY with the music already going: Jack (the pumpkin) waits on the turf
 * behind the start of the field; three football players bounce-walk on;
 * Jack asks "Can you help me get back to my patch?", one answers "Ok"; they
 * pick him up and carry him off; then GET JACK BACK, one word at a time.
 * Embers drift off Jack the whole time, burst when he's picked up, and
 * burst behind each word of the title.
 * The game then crossfades into the first series (game.ts). It can't be skipped (it's short).
 *
 * It's staged on the turf behind the start, with its own camera looking
 * away from the field, so the first series waiting there stays out of view.
 */
import * as THREE from 'three';
import { getGeometry, voxelMaterial } from '../../voxel/models';
import { Embers } from './embers';
import { toScreen } from './world';
import './intro.css';

/** Where it's staged (world): on the turf behind the start of the field. */
const STAGE = new THREE.Vector3(0, 0, 20);
/** The camera: in front of the stage (toward the field), a little above, looking at it. */
const CAMERA_OFFSET = new THREE.Vector3(0, 4.8, -18);
const LOOK_HEIGHT = 1.1;

/** The timeline (seconds). */
const T = {
  enter: 0.6,
  arrive: 2.4,
  ask: 2.6,
  answer: 5.2,
  pickUp: 6.5,
  leave: 7.1,
  gone: 9.0,
  words: [9.2, 9.8, 10.4],
  end: 11.8,
} as const;

/** The camera looks toward +z, so the screen's right is world −x. Players come on from the right. */
const OFFSCREEN_RIGHT = -6.5;
const OFFSCREEN_LEFT = 7;
/** Where the three stop beside Jack (world x, z offsets from the stage). */
const SPOTS = [
  { x: -1.4, z: 0.2 },
  { x: -2.4, z: -0.5 },
  { x: -3.2, z: 0.4 },
];
/** Jack floats this high, and rides this high on a player's head. */
const JACK_HOVER = 0.35;
const JACK_CARRIED = 1.55;

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
const ease = (x: number): number => x * x * (3 - 2 * x);

export class ArcadeIntro {
  private readonly group = new THREE.Group();
  private readonly jack: THREE.Mesh;
  private readonly players: THREE.Mesh[];
  private readonly light = new THREE.PointLight(0xffa64d, 40, 14, 1.6);
  private readonly root: HTMLElement;
  private readonly ask: HTMLElement;
  private readonly answer: HTMLElement;
  private readonly words: HTMLElement[];
  private readonly look = new THREE.Vector3();
  private readonly embers: Embers;
  private t = 0;
  private spoken = 0;
  private lifted = false;

  constructor(
    private readonly scene: THREE.Scene,
    ui: HTMLElement,
    /** Plays a sound effect (the words land with a thump). */
    private readonly sound: (id: 'burst' | 'hop') => void,
  ) {
    this.jack = new THREE.Mesh(
      getGeometry('team/ball'),
      new THREE.MeshBasicMaterial({ vertexColors: true }),
    );
    this.players = SPOTS.map(() => {
      const p = new THREE.Mesh(getGeometry('team/walkOn'), voxelMaterial);
      p.castShadow = true;
      // Models face +z; the camera looks along +z, so turn them round to face it.
      p.rotation.y = Math.PI;
      return p;
    });
    this.jack.rotation.y = Math.PI;
    this.group.add(this.jack, this.light, ...this.players);
    scene.add(this.group);
    this.embers = new Embers(scene);

    this.root = document.createElement('div');
    this.root.className = 'intro';
    this.root.innerHTML = `
      <div class="intro-bubble intro-ask">Can you help me get back to my patch?</div>
      <div class="intro-bubble intro-answer">Ok</div>
      <div class="intro-title"><span>GET</span><span>JACK</span><span>BACK</span></div>`;
    ui.append(this.root);
    const q = (sel: string): HTMLElement => {
      const el = this.root.querySelector<HTMLElement>(sel);
      if (!el) throw new Error(`intro missing ${sel}`);
      return el;
    };
    this.ask = q('.intro-ask');
    this.answer = q('.intro-answer');
    this.words = [...this.root.querySelectorAll<HTMLElement>('.intro-title span')];
  }

  /** Advance and pose everything; true once it's over (time to crossfade). */
  update(dt: number, camera: THREE.PerspectiveCamera, canvas: HTMLCanvasElement): boolean {
    this.t += dt;
    const t = this.t;
    camera.position.copy(STAGE).add(CAMERA_OFFSET);
    this.look.copy(STAGE).setY(LOOK_HEIGHT);
    camera.lookAt(this.look);
    camera.updateMatrixWorld();
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.near = 24;
      this.scene.fog.far = 70;
    }

    // The players: on from the right, a pause, then off to the left with Jack.
    const arrive = ease(clamp01((t - T.enter) / (T.arrive - T.enter)));
    const leave = ease(clamp01((t - T.leave) / (T.gone - T.leave)));
    const walking = (t > T.enter && t < T.arrive) || (t > T.leave && t < T.gone);
    this.players.forEach((p, i) => {
      const spot = SPOTS[i] ?? { x: 0, z: 0 };
      const x =
        OFFSCREEN_RIGHT + (spot.x - OFFSCREEN_RIGHT) * arrive + (OFFSCREEN_LEFT - spot.x) * leave;
      // A bounce in the step, and a little waddle.
      const step = walking ? Math.abs(Math.sin(t * 9 + i * 1.3)) : 0;
      p.position.set(STAGE.x + x, 0.18 * step, STAGE.z + spot.z);
      p.rotation.z = walking ? 0.12 * Math.sin(t * 9 + i * 1.3) : 0;
    });

    // Jack: floating and bobbing, then lifted onto the first player's head and carried off.
    const carrier = this.players[0];
    const lift = ease(clamp01((t - T.pickUp) / (T.leave - T.pickUp)));
    if (carrier) {
      const floatAt = new THREE.Vector3(STAGE.x, JACK_HOVER + 0.08 * Math.sin(t * 3), STAGE.z);
      const headAt = new THREE.Vector3(
        carrier.position.x,
        carrier.position.y + JACK_CARRIED,
        carrier.position.z,
      );
      this.jack.position.copy(floatAt).lerp(headAt, lift);
    }
    this.light.position.copy(this.jack.position).setY(this.jack.position.y + 0.6);

    // Embers off Jack all the while; a burst as he's lifted.
    const glow = this.jack.position.clone().setY(this.jack.position.y + 0.6);
    if (t < T.gone) this.embers.stream(glow, 90, dt, 0.9, 0.5);
    if (!this.lifted && t >= T.pickUp) {
      this.lifted = true;
      this.embers.burst(glow, 80, 5);
    }

    // The speech bubbles, over the speakers' heads.
    this.place(this.ask, this.jack.position, 1.5, camera, canvas, t >= T.ask && t < T.answer);
    if (carrier) {
      this.place(this.answer, carrier.position, 1.9, camera, canvas, t >= T.answer && t < T.pickUp);
    }

    // GET JACK BACK: each word lands with a thump.
    const landed = T.words.filter((w) => t >= w).length;
    this.words.forEach((w, i) => w.classList.toggle('show', i < landed));
    if (landed > this.spoken) {
      this.spoken = landed;
      if (t < T.end) {
        this.sound('burst');
        // A burst of embers behind each word as it lands, a little lower each time.
        this.embers.burst(new THREE.Vector3(STAGE.x, 3.4 - landed * 0.7, STAGE.z), 90, 6);
      }
    }
    this.embers.update(dt);
    return t >= T.end;
  }

  /** Put a bubble over a point (world), or hide it. */
  private place(
    el: HTMLElement,
    at: THREE.Vector3,
    above: number,
    camera: THREE.PerspectiveCamera,
    canvas: HTMLCanvasElement,
    show: boolean,
  ): void {
    el.classList.toggle('show', show);
    if (!show) return;
    const p = toScreen(at.clone().setY(at.y + above), camera, canvas);
    el.style.left = `${p.x}px`;
    el.style.top = `${p.y}px`;
  }

  /**
   * End it: the last frame (just rendered, so the canvas still holds it) and
   * the title freeze into an overlay that fades out over the first series.
   */
  finish(canvas: HTMLCanvasElement, fadeSeconds: number): void {
    this.scene.remove(this.group);
    this.embers.dispose();
    const still = document.createElement('img');
    still.className = 'intro-still';
    still.src = canvas.toDataURL();
    this.root.prepend(still);
    this.ask.classList.remove('show');
    this.answer.classList.remove('show');
    this.root.style.transition = `opacity ${fadeSeconds}s ease`;
    // Next frame, so the transition has a start.
    requestAnimationFrame(() => {
      this.root.style.opacity = '0';
    });
    setTimeout(() => this.root.remove(), fadeSeconds * 1000 + 100);
  }
}
