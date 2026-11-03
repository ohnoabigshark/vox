/**
 * A play drawn small (docs/STATS.md, v2's Plays tab): where each of the
 * seven lines up, the Blockers square and the rest round, and each route
 * from there, over the line of scrimmage. Yards upfield go up the drawing.
 */
import { lineUpSpot } from '../arcade/content/team';
import type { Play } from '../arcade/content/plays';

const NS = 'http://www.w3.org/2000/svg';
/** The drawing's yards: across the field, and from behind the line to well past it. */
const HALF = 10;
const BACK = 7;
const AHEAD = 22;

const el = <K extends keyof SVGElementTagNameMap>(
  name: K,
  attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] => {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
};

export function playDrawing(play: Play): SVGSVGElement {
  // y up the field is up the drawing: SVG's y runs down, so it's negated.
  const svg = el('svg', {
    viewBox: `${-HALF} ${-AHEAD} ${2 * HALF} ${AHEAD + BACK}`,
    role: 'img',
    'aria-label': `${play.name}, drawn`,
  });
  svg.append(
    el('rect', { x: -HALF, y: -AHEAD, width: 2 * HALF, height: AHEAD + BACK, fill: '#2f5d34' }),
    el('line', { x1: -HALF, y1: 0, x2: HALF, y2: 0, stroke: 'white', 'stroke-width': 0.25 }),
  );
  play.slots.forEach((assignment, slot) => {
    const at = lineUpSpot(play, slot);
    const handoff = play.handoff === slot;
    if (assignment.kind === 'route') {
      const points = [at, ...assignment.to.map((w) => ({ x: at.x + w.x, y: at.y + w.y }))];
      svg.append(
        el('polyline', {
          points: points.map((p) => `${p.x},${-p.y}`).join(' '),
          fill: 'none',
          stroke: handoff ? '#ff8a1f' : '#f7f1e3',
          'stroke-width': 0.35,
          'stroke-linejoin': 'round',
        }),
      );
    }
    svg.append(
      assignment.kind === 'block'
        ? el('rect', { x: at.x - 0.6, y: -at.y - 0.6, width: 1.2, height: 1.2, fill: '#2b2140' })
        : el('circle', { cx: at.x, cy: -at.y, r: 0.65, fill: handoff ? '#ff8a1f' : '#a259ff' }),
    );
  });
  // Jack, behind the line.
  svg.append(
    el('circle', {
      cx: 0,
      cy: 4,
      r: 0.75,
      fill: '#ff8a1f',
      stroke: '#2b2140',
      'stroke-width': 0.2,
    }),
  );
  return svg;
}
