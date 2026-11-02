// What a house call costs at home, and when each who could go would set off, as its offer card says it.

import type { CallCost, CallWait } from '../../core/sim/calls';
import type { IconLine } from './icon-line';

/**
 * Who waits in the line of someone sent on a house call, and how long the worst of them has before going home worse
 * off, warned when that is sooner than the call brings them back.
 */
export function callCostNote(cost: CallCost, days: number): IconLine {
  if (!cost.waiting || cost.worstDays === null) return { text: 'Nobody waiting in their line' };
  const who = `${cost.waiting} waiting in their line`;
  const left = cost.worstDays < 1 ? 'under a day' : `${Math.floor(cost.worstDays)} day${cost.worstDays < 2 ? '' : 's'}`;
  const note = `${who}, the worst with ${left} of condition left`;
  return cost.worstDays < days ? { icon: 'ui-warning', text: note } : { text: note };
}

/** When someone sent on a house call sets off: once the treatment, class or session in hand is done, or now. */
export function callWaitNote(wait: CallWait | null): string | null {
  return wait ? `Goes once this ${wait} is done` : null;
}
