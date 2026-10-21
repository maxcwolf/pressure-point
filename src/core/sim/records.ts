// The monthly record: guests counted as they arrive and leave, and each month filed when its books close.

import { DAY_SECONDS, MODALITIES, QUICK_DAYS } from '../data';
import { conditionOf } from '../data';
import { emptyTally } from '../state/game';
import type { Guest, MonthRecord } from '../state/types';
import type { SimContext } from './context';
import { followVisit } from './demand';
import { feel, writeReview } from './feelings';

/** How many finished months are kept. */
export const MONTHS_KEPT = 12;

/** How a visit ended, as far as the record is concerned. */
export type VisitEnd = 'healed' | 'failed' | 'stormed' | 'priced' | 'sent' | 'worse';

/** Count a guest arriving. */
export function countArrival(ctx: SimContext) {
  ctx.s.stats.arrived++;
  ctx.s.tally.arrived++;
}

/** Count a guest who would have come but found the center full, and went elsewhere. */
export function countTurnedAway(ctx: SimContext) {
  ctx.s.stats.turnedAway++;
  if (ctx.s.tally.turnedAway !== undefined) ctx.s.tally.turnedAway++;
}

/** Count how a guest's visit ended, how long they waited, and who healed them; enter it in the casebook, and file their review. */
export function countVisit(ctx: SimContext, g: Guest, end: VisitEnd) {
  // a class-goer came for a class, not a treatment, so only their review counts
  if (g.classDay) {
    writeReview(ctx, g, end);
    return;
  }
  const { stats, tally, casebook } = ctx.s;
  stats[end]++;
  tally[end]++;
  const record = (casebook[g.condition] ??= { healed: 0, failed: 0, stormed: 0, sent: 0, priced: 0, worse: 0 });
  record[end]++;
  if (end === 'healed' && g.waited < QUICK_DAYS * DAY_SECONDS) feel(g, 'quick');
  writeReview(ctx, g, end);
  // a guest put off by the prices leaves straight after the consultation, before any wait for a treatment
  if (end !== 'priced') {
    tally.waitTotal += g.waited;
    tally.waitCount++;
    // a month begun before patience was kept goes without it, rather than count only some of its guests
    if (tally.patienceTotal !== undefined) tally.patienceTotal += Math.max(0, Math.min(100, g.lowest ?? g.patience));
  }
  followVisit(ctx, g, end);
  if (end === 'healed') {
    const d = MODALITIES[conditionOf(g.condition).modality].discipline;
    tally.healedBy[d] = (tally.healedBy[d] ?? 0) + 1;
    stats.healedBy[d] = (stats.healedBy[d] ?? 0) + 1;
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
