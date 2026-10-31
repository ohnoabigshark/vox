/**
 * SNAG IT!'s sizes on screen, from `tuning.ts` (`snag.dotSize`, `ringFrom`,
 * `box`) so the test bench can set them (docs/BENCH.md, k1). The CSS reads
 * them as custom properties on the box.
 */
import { arcadeTuning } from '../content/tuning';

const sn = arcadeTuning.snag;

/** The box's custom properties: its width and its dots'. */
export function snagBoxStyle(): Record<'--snag-box' | '--snag-dot', string> {
  return { '--snag-box': `min(92vw, ${sn.box}px, 60vh)`, '--snag-dot': `${sn.dotSize}px` };
}

/** A dot's ring, as a scale of the dot: `ringFrom` as it shows (and before), down to 1 as it closes. */
export function ringScale(ring: number | null): number {
  return sn.ringFrom - (sn.ringFrom - 1) * (ring ?? 0);
}
