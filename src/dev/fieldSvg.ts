/**
 * The flat field the dev editors draw on (the play editor, the event
 * editor): an SVG in yards from the line of scrimmage, x across and y
 * upfield (drawn upward, so SVG y is −y). The turf, the yard lines, the
 * line, the first-down line and, for plays, a throw's reach.
 */
import { DEEPEST, FARTHEST_BACK } from '../arcade/content/playRules';
import { arcadeTuning } from '../arcade/content/tuning';

export const SVG = 'http://www.w3.org/2000/svg';
export const HALF = arcadeTuning.field.halfWidth;

/** A place on the field, in yards from the line (x across, y upfield). */
export interface Yards {
  readonly x: number;
  readonly y: number;
}

/** The field shown: a little past each sideline, from just behind the deepest line-up spot to just past a throw's reach. */
export const VIEW = {
  left: -HALF - 0.7,
  right: HALF + 0.7,
  back: -FARTHEST_BACK - 0.6,
  deep: DEEPEST + 1.4,
} as const;

/** A new field: an SVG with the view's box. */
export function fieldSvg(label: string): SVGSVGElement {
  const field = document.createElementNS(SVG, 'svg');
  field.classList.add('field');
  field.setAttribute(
    'viewBox',
    `${VIEW.left} ${-VIEW.deep} ${VIEW.right - VIEW.left} ${VIEW.deep - VIEW.back}`,
  );
  field.setAttribute('role', 'img');
  field.setAttribute('aria-label', label);
  return field;
}

/** The turf and its lines, as SVG markup: the line, +10, and a throw's reach if asked. */
export function fieldBase(options: { reach: boolean }): string[] {
  const parts: string[] = [];
  const line = (y: number, cls: string): string =>
    `<line class="${cls}" x1="${-HALF}" x2="${HALF}" y1="${-y}" y2="${-y}"/>`;
  parts.push(
    `<rect class="f-out" x="${VIEW.left}" y="${-VIEW.deep}" width="${VIEW.right - VIEW.left}" height="${VIEW.deep - VIEW.back}"/>`,
    `<rect class="f-turf" x="${-HALF}" y="${-VIEW.deep}" width="${2 * HALF}" height="${VIEW.deep - VIEW.back}"/>`,
  );
  for (let y = -5; y < VIEW.deep; y += 5) if (y !== 0 && y !== 10) parts.push(line(y, 'f-yard'));
  parts.push(line(0, 'f-los'), line(10, 'f-first'));
  if (options.reach) parts.push(line(DEEPEST, 'f-reach'));
  const label = (y: number, text: string, cls = ''): string =>
    `<text class="f-text ${cls}" x="${-HALF + 0.12}" y="${-y - 0.3}">${text}</text>`;
  parts.push(label(0, 'LINE'), label(10, '+10', 'gold'));
  if (options.reach) parts.push(label(DEEPEST, `THROW REACH ${DEEPEST}`, 'bad'));
  return parts;
}

/** A pointer's place on the field, in yards from the line. */
export function yardsAt(field: SVGSVGElement, ev: PointerEvent): Yards {
  const m = field.getScreenCTM();
  if (!m) return { x: 0, y: 0 };
  const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse());
  return { x: p.x, y: -p.y };
}
