/**
 * Everyone on the arcade field as voxel models, except the QB: there's none
 * to draw, the pumpkin ball throws itself. Each of your players is its
 * kind's model (a Human walk-on, a Ghost's sheet, a Golem's stones, a
 * Werewolf's fur), all in the team helmet, and the same build whatever
 * position it plays, except Golems: they're the only ones built like
 * linebackers (wide and low), so a broad body is always a Golem. Ghosts
 * float a little. Defenders are the forest set. Everyone turns to face where
 * they're going, and tips over when they're down.
 *
 * Rings on the turf: gold under the carrier; under each receiver before the
 * catch, its catch range (the ring's edge is its reach: a bullet coming
 * inside it is caught), green when no defender could reach a ball there,
 * red when one could, gold while the aim line is over it; and a purple ring
 * around every defender showing how far it reaches for the ball (a
 * Scarecrow's arms reach furthest), until someone catches it.
 */
import * as THREE from 'three';
import { common, hexToNumber, team } from '../../content/palettes';
import { getGeometry, modelHeight, voxelMaterial } from '../../voxel/models';
import { areaAt } from '../content/defense';
import { engaged } from '../sim/ball';
import type { Body, DefenderKind, Form, Player, RunState } from '../sim/types';
import { dist } from '../sim/vec';
import { toWorld } from './world';

const DEFENDER_MODEL: Readonly<Record<DefenderKind, string>> = {
  rusher: 'forest/blitzer',
  cover: 'forest/chaser',
  zone: 'forest/waller',
  safety: 'forest/safety',
  bat: 'forest/picker',
  crow: 'farm/crow',
};

/** A Witch on her broom (the Candy Kingdom's Safety) rides a little above the turf. */
const WITCH_HOVER = 0.5;

/** A Golem's linebacker build: its model stretched (x/z wide, y tall). Everyone else is drawn as modelled. */
const GOLEM_SHAPE = { wide: 1.45, tall: 0.95 };

/** Each kind of player's model, all in the team helmet. */
const KIND_MODEL: Readonly<Record<Form, string>> = {
  human: 'team/walkOn',
  ghost: 'team/ghost',
  golem: 'team/golem',
  werewolf: 'team/werewolf',
};
/** A Ghost's look: its model's own colours (a white sheet, the team helmet), unlit. */
const GHOST_MATERIAL = new THREE.MeshBasicMaterial({ vertexColors: true });

/** A player of this kind as it's drawn on the field: its model (a Ghost unlit, a Golem built wide), facing +z. */
export function playerMesh(kind: Form): THREE.Mesh {
  const mesh = new THREE.Mesh(
    getGeometry(KIND_MODEL[kind]),
    kind === 'ghost' ? GHOST_MATERIAL : voxelMaterial,
  );
  mesh.castShadow = true;
  if (kind === 'golem') mesh.scale.set(GOLEM_SHAPE.wide, GOLEM_SHAPE.tall, GOLEM_SHAPE.wide);
  return mesh;
}
/** Ghosts float a little off the turf. */
const GHOST_HOVER = 0.18;

const WALK_ON = 'team/walkOn';
const WALK_ON_HEIGHT = modelHeight(WALK_ON);
const OPEN = hexToNumber(common.slimeGreen);
const COVERED = hexToNumber(common.danger);
const CARRIER = hexToNumber(team.accent);
const COVERAGE = hexToNumber(common.candyPurple);

interface View {
  readonly root: THREE.Group;
  readonly body: THREE.Mesh;
  readonly ring: THREE.Mesh;
  /** A defender's reach for the ball (null for your players). */
  readonly reach: THREE.Mesh | null;
  /** What it was built to look like (kind and position): when either changes, it's rebuilt. */
  readonly look: string;
  /** How far above the turf it rides (a Witch on her broom). */
  readonly hover: number;
  yaw: number;
}

/** A body's model: a player's kind, or a defender's kind as this area draws it (a Gingerbread Man Cover…). */
const modelOf = (state: RunState, b: Body): string =>
  b.side === 'team'
    ? KIND_MODEL[b.form]
    : (areaAt(state.series.area).looks[b.kind] ?? DEFENDER_MODEL[b.kind]);

/** What a body looks like: its model and, for a player, the position it plays. */
const lookOf = (state: RunState, b: Body): string =>
  b.side === 'team' ? `${modelOf(state, b)}/${b.role}` : modelOf(state, b);

export class ArcadeBodies {
  private readonly views = new Map<number, View>();
  private readonly ringGeo = new THREE.RingGeometry(0.55, 0.7, 28).rotateX(-Math.PI / 2);
  /** A receiver's catch range: a unit ring (its outer edge at 1), scaled to the player's reach. */
  private readonly catchGeo = new THREE.RingGeometry(0.86, 1, 40).rotateX(-Math.PI / 2);
  /** A unit ring, scaled to each defender's reach. */
  private readonly reachGeo = new THREE.RingGeometry(0.94, 1, 48).rotateX(-Math.PI / 2);
  private readonly ringMats = new Map<number, THREE.MeshBasicMaterial>();

  constructor(private readonly scene: THREE.Scene) {}

  /** Make the views match the bodies on the field: new ones, gone ones, and changed ones (called every frame). */
  sync(state: RunState): void {
    const bodies: Body[] = [...state.field.players, ...state.field.defenders];
    const looks = new Map(bodies.map((b) => [b.id, lookOf(state, b)]));
    // Gone, or now someone else in that spot (a recruit joined, two players swapped): rebuild.
    for (const [id, v] of this.views) {
      if (looks.get(id) === v.look) continue;
      this.scene.remove(v.root, v.ring);
      if (v.reach) this.scene.remove(v.reach);
      this.views.delete(id);
    }
    for (const b of bodies) {
      // There's no QB to draw: the pumpkin throws itself (render/ball.ts).
      if (b.side === 'team' && b.role === 'qb') continue;
      if (!this.views.has(b.id)) this.views.set(b.id, this.create(state, b));
    }
  }

  /** `lit`: the receivers the sweeping line is over right now (render/sweep.ts). */
  update(state: RunState, origin: number, dt: number, lit: ReadonlySet<number> = new Set()): void {
    const carrierId = state.field.ball.at === 'carried' ? state.field.ball.by : null;
    const live = state.phase === 'play' || state.phase === 'setup';
    for (const b of [...state.field.players, ...state.field.defenders]) {
      const view = this.views.get(b.id);
      if (!view) continue;
      view.root.position.copy(toWorld(b.pos, origin));
      // Turn to face where it's going (models face +z), smoothly.
      if (Math.hypot(b.vel.x, b.vel.y) > 0.4) {
        const want = Math.atan2(b.vel.x, -b.vel.y);
        let d = want - view.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        view.yaw += d * Math.min(1, dt * 12);
      }
      view.root.rotation.y = view.yaw;
      view.body.rotation.z = b.down > 0 ? Math.PI / 2 : 0;
      // A little bob while running.
      const speed = Math.hypot(b.vel.x, b.vel.y);
      const hover =
        b.side === 'team' && b.form === 'ghost'
          ? GHOST_HOVER + 0.05 * Math.sin(state.time * 4 + b.id)
          : view.hover;
      view.body.position.y =
        b.down > 0
          ? 0.2
          : hover + Math.abs(Math.sin(state.time * 14 + b.id)) * Math.min(0.12, speed * 0.03);

      view.ring.position.set(view.root.position.x, 0.02, view.root.position.z);
      view.ring.scale.setScalar(1);
      view.ring.geometry = this.ringGeo;
      if (view.reach && b.side === 'defense') {
        // It bats down a bullet coming inside its reach: unless it's down, the ball's been
        // caught, or it's a Rhino Beetle locked up at the line (the ball goes past those).
        view.reach.visible = live && carrierId === null && b.down <= 0 && !engaged(state, b);
        view.reach.position.set(view.root.position.x, 0.015, view.root.position.z);
        view.reach.scale.setScalar(b.reach);
      }
      if (b.side === 'team' && b.id === carrierId) {
        view.ring.visible = true;
        view.ring.material = this.ringMat(CARRIER);
      } else if (b.side === 'team' && live && carrierId === null && b.job.kind === 'route') {
        view.ring.visible = true;
        // Lit up gold while the line is over it: that's the moment to throw.
        const isLit = lit.has(b.id);
        view.ring.material = this.ringMat(isLit ? CARRIER : open(state, b) ? OPEN : COVERED);
        // Its catch range: a bullet coming inside this ring is caught (Hands is reach).
        view.ring.geometry = this.catchGeo;
        view.ring.scale.setScalar(b.reach);
      } else {
        view.ring.visible = false;
      }
    }
  }

  /** The world position of a body's head (for the carried ball). */
  headOf(id: number): THREE.Vector3 | null {
    const v = this.views.get(id);
    if (!v) return null;
    return v.root.position.clone().setY(WALK_ON_HEIGHT * v.body.scale.y + 0.15);
  }

  /** Show or hide everyone (the win cutscene has its own cast). */
  setVisible(visible: boolean): void {
    for (const v of this.views.values()) {
      v.root.visible = visible;
      v.ring.visible = visible && v.ring.visible;
      if (v.reach) v.reach.visible = visible && v.reach.visible;
    }
  }

  /** Everything drawn (for the crossfade between series, render/crossfade.ts). */
  objects(): THREE.Object3D[] {
    return [...this.views.values()].flatMap((v) => [v.root, v.ring, ...(v.reach ? [v.reach] : [])]);
  }

  private create(state: RunState, b: Body): View {
    const model = modelOf(state, b);
    // A Ghost is unlit: its white sheet (and team helmet) look the same whatever the light, so it reads at a glance.
    const ghost = b.side === 'team' && b.form === 'ghost';
    const body = new THREE.Mesh(getGeometry(model), ghost ? GHOST_MATERIAL : voxelMaterial);
    body.castShadow = true;
    if (b.side === 'team' && b.form === 'golem') {
      body.scale.set(GOLEM_SHAPE.wide, GOLEM_SHAPE.tall, GOLEM_SHAPE.wide);
    }
    const root = new THREE.Group();
    root.add(body);
    const ring = new THREE.Mesh(this.ringGeo, this.ringMat(OPEN));
    ring.visible = false;
    this.scene.add(root, ring);
    const reach =
      b.side === 'defense' ? new THREE.Mesh(this.reachGeo, this.ringMat(COVERAGE)) : null;
    if (reach) this.scene.add(reach);
    // Your team faces upfield, the defense faces you.
    return {
      root,
      body,
      ring,
      reach,
      look: lookOf(state, b),
      hover: model === 'forest/witch' ? WITCH_HOVER : 0,
      yaw: b.side === 'team' ? Math.PI : 0,
    };
  }

  private ringMat(color: number): THREE.MeshBasicMaterial {
    let m = this.ringMats.get(color);
    if (!m) {
      m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 });
      this.ringMats.set(color, m);
    }
    return m;
  }
}

/** Open: no defender could reach a ball coming down on this player right now. */
function open(state: RunState, p: Player): boolean {
  return state.field.defenders.every((d) => d.down > 0 || dist(d.pos, p.pos) > d.reach + 0.5);
}
