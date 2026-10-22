// The rival across the street: a franchise that opens a few weeks in, grows steadily up to a quarter more than the
// center's own standing, holds sales that draw away guests who think the center charges too much, tries to hire away
// unhappy staff, and competes for Center of the Year. A delighted VIP, word of mouth and the award itself knock it back.

import {
  DAY_SECONDS,
  POACH_DAYS,
  POACH_GAP_DAYS,
  POACH_MORALE,
  RIVAL_AWARD_KNOCK,
  RIVAL_CEILING,
  RIVAL_GROWTH,
  RIVAL_LEAD_DRAW,
  RIVAL_NAME,
  RIVAL_OPENS,
  RIVAL_SLOGAN,
  RIVAL_START_POINTS,
  RIVAL_VIP_KNOCK,
  RIVAL_WORD_FALL,
  SALE_DAYS,
  SALE_DISCOUNT,
  SALE_DRAW,
  SALE_GAP_DAYS,
} from '../data';
import { irnd } from '../random';
import type { GameState, Staff } from '../state/types';
import { clamp } from '../util';
import type { SimContext } from './context';
import { averagePrice } from './economy';
import { emit, tipOnce, toast } from './events';
import { running } from './marketing';
import { fire } from './staffing';
import { gradeFor, standingPoints } from './standing';

/** The most guests the rival can draw away at once. */
const MAX_DRAW = 0.6;

/** Whether the rival is open and competing. */
export const rivalOpen = (s: GameState) => s.rivalOn && s.rival.opened !== null;

/** The rival's standing points, or 0 before it opens. */
export const rivalPoints = (s: GameState) => (s.rival.opened === null ? 0 : Math.round(s.rival.points));

/** The most the rival grows to: a quarter more than the center's own standing, and never less than it started at. */
export const rivalCeiling = (ctx: SimContext) =>
  Math.max(RIVAL_START_POINTS, Math.round(standingPoints(ctx).total * RIVAL_CEILING));

/** Where the rival is heading: growing toward its ceiling, held there, or losing ground to word of mouth. */
export type RivalCourse = 'growing' | 'ceiling' | 'losing';

/** Which way the rival is going, and its ceiling. */
export function rivalCourse(ctx: SimContext): { course: RivalCourse; ceiling: number } {
  const ceiling = rivalCeiling(ctx);
  if (running(ctx.s, 'word')) return { course: 'losing', ceiling };
  return { course: ctx.s.rival.points < ceiling ? 'growing' : 'ceiling', ceiling };
}

/** Take points off the rival, never below where it started, and count them. Returns the points taken off. */
function knock(s: GameState, points: number): number {
  const r = s.rival;
  const off = Math.max(0, Math.min(points, r.points - RIVAL_START_POINTS));
  r.points -= off;
  r.knocked += off;
  return off;
}

/** A setback for the rival from something the center did: a share of its points off, said in a toast. */
function setBack(ctx: SimContext, share: number, why: string) {
  if (!rivalOpen(ctx.s)) return;
  const off = Math.round(knock(ctx.s, ctx.s.rival.points * share));
  if (off > 0) toast(ctx, `${why} ${RIVAL_NAME} loses ${off} standing points.`, 'good', undefined, 'ui-rival');
}

/** A VIP left delighted: word gets round, at the rival's expense. */
export const vipSetback = (ctx: SimContext) => {
  setBack(ctx, RIVAL_VIP_KNOCK, 'A delighted VIP is telling everyone about you:');
};

/** The center won Center of the Year from the rival. */
export const awardSetback = (ctx: SimContext) => {
  setBack(ctx, RIVAL_AWARD_KNOCK, 'Center of the Year is yours:');
};

/** A second of the rival's growth: toward its ceiling, back down to it from above, or down while word of mouth runs. */
function updatePoints(ctx: SimContext) {
  const r = ctx.s.rival;
  const step = 1 / DAY_SECONDS;
  const { course, ceiling } = rivalCourse(ctx);
  if (course === 'losing') knock(ctx.s, RIVAL_WORD_FALL * step);
  else if (r.points < ceiling) r.points = Math.min(ceiling, r.points + RIVAL_GROWTH * step);
  else r.points = Math.max(ceiling, r.points - RIVAL_GROWTH * step);
  if (course === 'ceiling')
    tipOnce(
      ctx,
      'rival-ceiling',
      `${RIVAL_NAME} has stopped growing: it cannot stand more than a quarter above you. Grow, and it grows; delight a VIP, and it slips.`,
      'info',
      undefined,
      'ui-rival',
    );
  // the day the center passes it, once it has been ahead
  if (ctx.s.seenTips.includes('rival-passed')) return;
  const own = standingPoints(ctx).total;
  if (r.points > own) r.led = true;
  else if (r.led && own > r.points)
    tipOnce(
      ctx,
      'rival-passed',
      `Your standing has passed ${RIVAL_NAME}'s. Center of the Year is yours to lose.`,
      'good',
      undefined,
      'ui-rival',
    );
}

/** The rival's grade. */
export const rivalGrade = (s: GameState) => gradeFor(rivalPoints(s));

/** Whether the rival has a sale on. */
export const onSale = (s: GameState) => s.rival.saleUntil > s.day;

/**
 * The share of guests a sale draws away: all it can from a center charging full price or more, less as the center's
 * prices come down, and none once they are as low as the rival's sale prices.
 */
export function saleDraw(priceLevel: number): number {
  const sale = 1 - SALE_DISCOUNT;
  return SALE_DRAW * clamp((priceLevel - sale) / SALE_DISCOUNT, 0, 1);
}

/** The share of guests the rival draws away: more for each grade it stands above the center, and more in a sale. */
export function rivalDraw(s: GameState): number {
  if (!rivalOpen(s)) return 0;
  const lead = Math.max(0, rivalGrade(s) - s.grade) * RIVAL_LEAD_DRAW;
  const sale = onSale(s) ? saleDraw(averagePrice(s)) : 0;
  return Math.min(MAX_DRAW, lead + sale);
}

/** The member of staff the rival would try to hire away: the unhappiest of those not already made an offer. */
export function poachTarget(staff: readonly Staff[]): Staff | undefined {
  return staff
    .filter((st) => st.state !== 'leaving' && !st.offer && st.morale < POACH_MORALE)
    .sort((a, b) => a.morale - b.morale)[0];
}

/** Days left before someone takes the rival's offer, or null with no offer. */
export function offerDaysLeft(s: GameState, st: Staff): number | null {
  return st.offer ? Math.max(0, st.offer - s.day) : null;
}

/** Open across the street, once its day comes. */
function openUp(ctx: SimContext) {
  const s = ctx.s;
  s.rival.opened = s.day;
  s.rival.points = RIVAL_START_POINTS;
  s.rival.nextSale = s.day + SALE_GAP_DAYS[0];
  s.rival.nextPoach = s.day + POACH_GAP_DAYS[0];
  toast(
    ctx,
    `A ${RIVAL_NAME} has opened across the street: "${RIVAL_SLOGAN}." It will grow until it stands a quarter above you, hold sales, try to hire away unhappy staff, and compete for Center of the Year.`,
    'bad',
    undefined,
    'ui-rival',
  );
  tipOnce(
    ctx,
    'rival',
    `Keep an eye on ${RIVAL_NAME} in the Stats menu, under Standing. Keep your staff happy, and your prices sharp while it has a sale on. Delighting a VIP, word of mouth and winning Center of the Year all knock it back.`,
  );
}

/** Start a sale, or end the one on. */
function updateSale(ctx: SimContext) {
  const s = ctx.s;
  const r = s.rival;
  if (r.saleUntil && s.day >= r.saleUntil) {
    r.saleUntil = 0;
    toast(ctx, `${RIVAL_NAME}'s sale is over.`, 'info', undefined, 'ui-rival');
  }
  if (r.saleUntil || s.day < r.nextSale) return;
  r.saleUntil = s.day + SALE_DAYS;
  r.nextSale = r.saleUntil + irnd(s, SALE_GAP_DAYS[0], SALE_GAP_DAYS[1]);
  toast(
    ctx,
    `${RIVAL_NAME} is holding a sale: ${Math.round(SALE_DISCOUNT * 100)}% off for ${SALE_DAYS} days. Guests who think you charge too much will go there instead, unless you lower your prices in the Money menu.`,
    'bad',
    undefined,
    'ui-rival',
  );
}

/** Settle offers made, and now and then make a new one to whoever is unhappiest. */
function updatePoaching(ctx: SimContext) {
  const s = ctx.s;
  for (const st of [...s.staff]) {
    if (!st.offer || st.state === 'leaving') continue;
    const about = { kind: 'staff', id: st.id } as const;
    if (st.morale >= POACH_MORALE) {
      st.offer = 0;
      toast(ctx, `${st.name} has turned down ${RIVAL_NAME}'s offer.`, 'good', about);
    } else if (s.day >= st.offer && !st.busy && !st.training && !st.call) {
      s.rival.poached++;
      fire(ctx, st.id, 'poached');
    }
  }
  if (s.day < s.rival.nextPoach) return;
  s.rival.nextPoach = s.day + irnd(s, POACH_GAP_DAYS[0], POACH_GAP_DAYS[1]);
  const st = poachTarget(s.staff);
  if (!st) return;
  st.offer = s.day + POACH_DAYS;
  toast(
    ctx,
    `${RIVAL_NAME} has offered ${st.name} a job. Lift their morale above ${POACH_MORALE} within ${POACH_DAYS} days, with a raise or a break, or they will take it.`,
    'bad',
    { kind: 'staff', id: st.id },
    'ui-warning',
  );
  emit(ctx, { type: 'sfx', name: 'error' });
}

/** The rival's day: opening, sales and offers to staff. Nothing while it is switched off or the center is shut. */
export function updateRival(ctx: SimContext) {
  const s = ctx.s;
  if (!s.rivalOn) {
    // with no rival there is nobody to take an offer from, so none is left hanging
    for (const st of s.staff) st.offer = 0;
    return;
  }
  if (!s.open) return;
  if (s.rival.opened === null) {
    if (s.day >= RIVAL_OPENS) openUp(ctx);
    return;
  }
  updatePoints(ctx);
  updateSale(ctx);
  updatePoaching(ctx);
}
