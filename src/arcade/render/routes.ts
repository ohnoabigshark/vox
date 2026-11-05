/**
 * The called play's routes, drawn on the turf until the hike (GAMEPLAY.md,
 * A Down): a dotted path from each receiver through its
 * waypoints, with an arrowhead where it's going; gold for the Runners. On a
 * handoff, the Runner who'll take the ball has a bigger pumpkin-orange route
 * and a ring at its feet, so you know who's running it. With a player
 * selected (docs/SELECT.md, s2), its route is drawn bigger and every other
 * one dimmed.
 */
import * as THREE from 'three';
import { common, hexToNumber, team } from '../../content/palettes';
import { playSlot } from '../content/team';
import type { Player, RunState, Vec } from '../sim/types';
import { routeLook } from '../ui/select';
import { dist, lerp } from '../sim/vec';
import { toWorld } from './world';

/** Yards between dots. */
const SPACING = 0.6;
/** A dimmed route's share of its usual opacity. */
const DIM = 0.3;

export class ArcadeRoutes {
  private readonly group = new THREE.Group();
  private readonly dotGeo = new THREE.CircleGeometry(0.09, 10).rotateX(-Math.PI / 2);
  private readonly arrowGeo = new THREE.ConeGeometry(0.28, 0.6, 3).rotateX(-Math.PI / 2);
  private readonly pass = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.8,
  });
  private readonly run = new THREE.MeshBasicMaterial({
    color: hexToNumber(team.accent),
    transparent: true,
    opacity: 0.9,
  });
  private readonly carry = new THREE.MeshBasicMaterial({
    color: hexToNumber(common.pumpkin),
    transparent: true,
    opacity: 0.95,
  });
  private readonly bigDotGeo = new THREE.CircleGeometry(0.16, 12).rotateX(-Math.PI / 2);
  private readonly bigArrowGeo = new THREE.ConeGeometry(0.42, 0.8, 3).rotateX(-Math.PI / 2);
  private readonly ringGeo = new THREE.RingGeometry(0.55, 0.75, 28).rotateX(-Math.PI / 2);
  /** Each material dimmed, made once. */
  private readonly dimmed = new Map<THREE.MeshBasicMaterial, THREE.MeshBasicMaterial>();
  private key = '';

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
  }

  /** Before the hike, draw `players`' routes (the called play's), or nothing; `selected` is a roster slot, or null. */
  update(
    state: RunState,
    origin: number,
    players: readonly Player[] | null,
    selected: number | null,
  ): void {
    const show = state.phase === 'setup' && players !== null;
    this.group.visible = show;
    if (!show) return;
    // Every down lines up with new ids, so they (and where the field is) say when to redraw.
    const key = `${origin}|${state.series.los}|${selected}|${players.map((p) => `${p.slot}:${p.job.kind === 'route' ? p.job.to.map((w) => `${w.x},${w.y}`).join(';') : ''}`).join('|')}`;
    if (key === this.key) return;
    this.key = key;
    this.group.clear();
    const handoff = state.playbook[state.play.index]?.handoff;
    for (const p of players) {
      if (p.job.kind !== 'route') continue;
      const carries = handoff !== undefined && p.slot === playSlot(handoff, state.play.flipped);
      const look = routeLook(p.slot, selected);
      const usual = carries ? this.carry : p.role === 'runner' ? this.run : this.pass;
      const material = look === 'dim' ? this.dim(usual) : usual;
      const big = carries || look === 'bright';
      const dotGeo = big ? this.bigDotGeo : this.dotGeo;
      if (carries) {
        const ring = new THREE.Mesh(this.ringGeo, material);
        ring.position.copy(toWorld(p.pos, origin, 0.035));
        this.group.add(ring);
      }
      const path: Vec[] = [p.pos, ...p.job.to];
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1];
        const b = path[i];
        if (!a || !b) continue;
        const n = Math.max(1, Math.floor(dist(a, b) / SPACING));
        for (let k = 1; k <= n; k++) {
          const dot = new THREE.Mesh(dotGeo, material);
          dot.position.copy(toWorld(lerp(a, b, k / n), origin, 0.03));
          this.group.add(dot);
        }
      }
      const end = path[path.length - 1];
      const before = path[path.length - 2];
      if (end && before) {
        const arrow = new THREE.Mesh(big ? this.bigArrowGeo : this.arrowGeo, material);
        arrow.position.copy(toWorld(end, origin, 0.04));
        // The cone points along -z in world when unrotated; turn it to the last leg's direction.
        arrow.rotation.y = Math.atan2(-(end.x - before.x), end.y - before.y);
        this.group.add(arrow);
      }
    }
  }

  private dim(m: THREE.MeshBasicMaterial): THREE.MeshBasicMaterial {
    let d = this.dimmed.get(m);
    if (!d) {
      d = m.clone();
      d.opacity = m.opacity * DIM;
      this.dimmed.set(m, d);
    }
    return d;
  }
}
