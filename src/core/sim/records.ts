// The monthly record: guests counted as they arrive and leave, and each month filed when its books close.

import { MODALITIES } from '../data';
import { conditionOf } from '../data';
import { emptyTally } from '../state/game';
import type { Guest, MonthRecord } from '../state/types';
import type { SimContext } from './context';

/** How many finished months are kept. */
export const MONTHS_KEPT = 12;

/** How a visit ended, as far as the record is concerned. */
export type VisitEnd = 'healed' | 'failed' | 'stormed' | 'priced';

/** Count a guest arriving. */
export function countArrival(ctx: SimContext) {
  ctx.s.stats.arrived++;
  ctx.s.tally.arrived++;
}

/** Count how a guest's visit ended, how long they waited, and who healed them. */
export function countVisit(ctx: SimContext, g: Guest, end: VisitEnd) {
  const { stats, tally } = ctx.s;
  stats[end]++;
  tally[end]++;
  tally.waitTotal += g.waited;
  tally.waitCount++;
  if (end === 'healed') {
    const d = MODALITIES[conditionOf(g.condition).modality].discipline;
    tally.healedBy[d] = (tally.healedBy[d] ?? 0) + 1;
  }
}

/** File the month just ended with its books, keeping the last twelve, and start counting afresh. */
export function closeMonth(ctx: SimContext) {
  const s = ctx.s;
  s.months.push(monthSoFar(ctx));
  if (s.months.length > MONTHS_KEPT) s.months.splice(0, s.months.length - MONTHS_KEPT);
  s.tally = emptyTally();
}

/** This month so far, in the same shape as a finished one. */
export function monthSoFar(ctx: SimContext): MonthRecord {
  const s = ctx.s;
  return {
    ...s.tally,
    healedBy: { ...s.tally.healedBy },
    ledger: { ...s.ledger },
    reputation: s.reputation,
    money: s.money,
  };
}
