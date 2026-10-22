// What a house call costs at home, as its offer card says it for each who could go.

import type { CallCost } from '../../core/sim/calls';
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
