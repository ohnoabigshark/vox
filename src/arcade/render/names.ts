/**
 * Names on the field (docs/REWARDS.md, playtest notes p6): before the snap,
 * each of your seven has its full name on a small tag just under its feet,
 * placed on the screen over the 3D view each frame (as the intro's speech
 * bubbles are). Which tags show is `nameTags`.
 */
import type * as THREE from 'three';
import type { NameTag } from '../ui/nameTags';
import { toScreen, toWorld } from './world';
import './names.css';

/** How far under the feet the tag sits, in screen pixels. */
const BELOW = 6;

export class ArcadeNames {
  private readonly layer = document.createElement('div');
  /** One tag element per body id, made as needed and kept. */
  private readonly tags = new Map<number, HTMLElement>();

  constructor(ui: HTMLElement) {
    this.layer.className = 'arcade-names';
    // Under the HUD: the cards and buttons draw over a name, never the other way.
    ui.prepend(this.layer);
  }

  update(
    tags: readonly NameTag[],
    origin: number,
    camera: THREE.PerspectiveCamera,
    canvas: HTMLCanvasElement,
  ): void {
    const shown = new Set<number>();
    for (const tag of tags) {
      let el = this.tags.get(tag.id);
      if (!el) {
        el = document.createElement('span');
        el.className = 'arcade-name';
        this.layer.append(el);
        this.tags.set(tag.id, el);
      }
      if (el.textContent !== tag.name) el.textContent = tag.name;
      // The selected player's name: in front of any it overlaps, bigger (docs/SELECT.md, s4).
      el.classList.toggle('selected', tag.selected);
      const p = toScreen(toWorld(tag.at, origin, 0), camera, canvas);
      el.style.left = `${p.x}px`;
      el.style.top = `${p.y + BELOW}px`;
      el.hidden = false;
      shown.add(tag.id);
    }
    for (const [id, el] of this.tags) if (!shown.has(id)) el.hidden = true;
  }
}
