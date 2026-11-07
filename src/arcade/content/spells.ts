/**
 * The rule that ties how a field event goes off to its effect
 * (docs/FIELD_EVENTS.md, round 5): a spell gives a status, since a
 * knockdown is a moment's, so a burst's. Every burst-or-spell question asks
 * here (the review's r4). The event's type still allows a spell that
 * flattens; making it a union of the two is left for a later refactor
 * (docs/PLAN.md).
 *
 * It imports only types, so the saved-events check can use it without
 * reaching the saved file (savedEvents.ts).
 */
import { assertNever } from '../../assertNever';
import type { FieldEvent } from './fieldEvents';
import type { EventStatus } from './statuses';

type HowItGoesOff = Pick<FieldEvent, 'goesOffAs' | 'effect'>;

/** The status a spell holds whoever is in it with; null for a burst, or for a spell that breaks the rule. */
export function spellStatus(event: HowItGoesOff): EventStatus | null {
  switch (event.goesOffAs) {
    case 'burst':
      return null;
    case 'spell':
      return event.effect.kind === 'status' ? event.effect.status : null;
    default:
      return assertNever(event.goesOffAs);
  }
}

/** Whether an event keeps the rule: a burst may have any effect, a spell must give a status. */
export function keepsSpellRule(event: HowItGoesOff): boolean {
  switch (event.goesOffAs) {
    case 'burst':
      return true;
    case 'spell':
      return spellStatus(event) !== null;
    default:
      return assertNever(event.goesOffAs);
  }
}
