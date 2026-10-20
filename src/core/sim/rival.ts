// The rival across the street: a franchise that opens a few weeks in, grows steadily, holds sales that draw away
// guests who think the center charges too much, tries to hire away unhappy staff, and competes for Center of the Year.

import {
  POACH_DAYS,
  POACH_GAP_DAYS,
  POACH_MORALE,
  RIVAL_GROWTH,
  RIVAL_LEAD_DRAW,
  RIVAL_NAME,
  RIVAL_OPENS,
  RIVAL_SLOGAN,
  RIVAL_START_POINTS,
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
import { fire } from './staffing';
import { gradeFor } from './standing';

/** The most guests the rival can draw away at once. */
const MAX_DRAW = 0.6;

/** Whether the rival is open and competing. */
export const rivalOpen = (s: GameState) => s.rivalOn && s.rival.opened !== null;

/** The rival's standing points, growing every day since it opened. */
export function rivalPoints(s: GameState): number {
  const opened = s.rival.opened;
  if (opened === null) return 0;
  return Math.round(RIVAL_START_POINTS + Math.max(0, s.day - opened) * RIVAL_GROWTH);
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
  s.rival.nextSale = s.day + SALE_GAP_DAYS[0];
  s.rival.nextPoach = s.day + POACH_GAP_DAYS[0];
  toast(
    ctx,
    `🏪 A ${RIVAL_NAME} has opened across the street: "${RIVAL_SLOGAN}." It will hold sales, try to hire away unhappy staff, and compete for Center of the Year.`,
    'bad',
  );
  tipOnce(
    ctx,
    'rival',
    `Keep an eye on ${RIVAL_NAME} in the Stats menu, under Standing. Keep your staff happy, and your prices sharp while it has a sale on.`,
  );
}

/** Start a sale, or end the one on. */
function updateSale(ctx: SimContext) {
  const s = ctx.s;
  const r = s.rival;
  if (r.saleUntil && s.day >= r.saleUntil) {
    r.saleUntil = 0;
    toast(ctx, `🏪 ${RIVAL_NAME}'s sale is over.`, 'info');
  }
  if (r.saleUntil || s.day < r.nextSale) return;
  r.saleUntil = s.day + SALE_DAYS;
  r.nextSale = r.saleUntil + irnd(s, SALE_GAP_DAYS[0], SALE_GAP_DAYS[1]);
  toast(
    ctx,
    `🏪 ${RIVAL_NAME} is holding a sale: ${Math.round(SALE_DISCOUNT * 100)}% off for ${SALE_DAYS} days. Guests who think you charge too much will go there instead, unless you lower your prices in the Money menu.`,
    'bad',
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
    `⚠️ ${RIVAL_NAME} has offered ${st.name} a job. Lift their morale above ${POACH_MORALE} within ${POACH_DAYS} days, with a raise or a break, or they will take it.`,
    'bad',
    { kind: 'staff', id: st.id },
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
  updateSale(ctx);
  updatePoaching(ctx);
}
