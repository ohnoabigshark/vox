/**
 * Statuses (docs/STATUSES.md): conditions a body carries for a while, read
 * by the rules whatever gave them. Which there are, whether each helps or
 * hurts the body that has it, and the kind (blessing, hex or mischief) that
 * follows from that and who it lands on. The sim's side, giving and
 * wearing them, is `sim/status.ts`.
 */
import { assertNever } from '../../assertNever';

/** The statuses there are. Slowed and Ethereal come with the taffy flood and the wisps. */
export type StatusName = 'fast';

/** Whether something helps the body it lands on or hurts it. */
export type Polarity = 'helps' | 'hurts';

/** Who something lands on: your players, the defenders, or everyone. */
export type Who = 'yours' | 'theirs' | 'everyone';

/** A source's kind: one that can only help you, only hurt you, or do both. */
export type SourceKind = 'blessing' | 'hex' | 'mischief';

/**
 * Blessing, hex or mischief (s4), for a field event or a pickup alike: what
 * helps is a blessing on your players and a hex on the defenders, what
 * hurts the other way round, and either on everyone is mischief.
 */
export function kindOf(polarity: Polarity, who: Who): SourceKind {
  const helps = helpsIt(polarity);
  switch (who) {
    case 'yours':
      return helps ? 'blessing' : 'hex';
    case 'theirs':
      return helps ? 'hex' : 'blessing';
    case 'everyone':
      return 'mischief';
    default:
      return assertNever(who);
  }
}

function helpsIt(polarity: Polarity): boolean {
  switch (polarity) {
    case 'helps':
      return true;
    case 'hurts':
      return false;
    default:
      return assertNever(polarity);
  }
}
