// Money and reputation: income, spending, payday, loans and prices.

import { LOAN_MAX, LOAN_RATE, LOAN_STEP, PRICE_MAX, PRICE_MIN, type Priced } from '../data';
import { money } from '../format';
import { emptyLedger } from '../state/game';
import type { GameState, Ledger } from '../state/types';
import { clamp } from '../util';
import type { SimContext } from './context';
import { emit, toast } from './events';
import { closeMonth } from './records';

/** A ledger's income minus its spending. */
export function netOf(l: Ledger) {
  return incomeOf(l) - l.salaries - l.building - l.training - l.interest - l.marketing - l.fines;
}

/** A ledger's income: fees, class places, sales, house calls and bonuses. */
export function incomeOf(l: Ledger) {
  return l.consult + l.treatment + l.classes + l.vending + l.shop + l.calls + l.bonus;
}

/** Take in money, record it and show the amount floating up. */
export function earn(
  ctx: SimContext,
  amount: number,
  kind: 'consult' | 'treatment' | 'vending' | 'shop' | 'calls' | 'classes',
  x: number,
  y: number,
) {
  ctx.s.money += amount;
  ctx.s.ledger[kind] += amount;
  emit(ctx, { type: 'float', text: `+${money(amount)}`, x, y, kind: 'good' });
  if (amount >= 100) emit(ctx, { type: 'sfx', name: 'cash' });
}

/** Pay out money and record it. */
export function spend(
  ctx: SimContext,
  amount: number,
  kind: 'salaries' | 'building' | 'training' | 'interest' | 'marketing' | 'fines',
) {
  ctx.s.money -= amount;
  ctx.s.ledger[kind] += amount;
}

/** Raise or lower reputation, kept between 0 and 100. */
export function changeRep(ctx: SimContext, delta: number) {
  const s = ctx.s;
  // gains taper off as reputation climbs
  if (delta > 0) delta *= 1.15 - s.reputation / 120;
  s.reputation = clamp(s.reputation + delta, 0, 100);
}

/** Pay salaries and loan interest, close the month's books and bring in new applicants. */
export function monthEnd(ctx: SimContext) {
  const s = ctx.s;
  const wages = s.staff.filter((x) => x.state !== 'leaving').reduce((a, x) => a + x.salary, 0);
  if (wages > 0) {
    spend(ctx, wages, 'salaries');
    toast(ctx, `Payday: ${money(wages)} in salaries.`, s.money < 0 ? 'bad' : 'info');
    emit(ctx, { type: 'sfx', name: 'payday' });
  }
  const interest = Math.round(s.loan * LOAN_RATE);
  if (interest > 0) spend(ctx, interest, 'interest');
  closeMonth(ctx);
  s.history.push(netOf(s.ledger));
  if (s.history.length > 12) s.history.shift();
  s.lastLedger = s.ledger;
  s.ledger = emptyLedger();
  if (s.money < 0) toast(ctx, 'You are in the red. Heal faster!', 'bad');
}

/** Borrow one more step of the loan, if the limit allows. */
export function borrow(ctx: SimContext): boolean {
  const s = ctx.s;
  if (s.loan + LOAN_STEP > LOAN_MAX) return false;
  s.loan += LOAN_STEP;
  s.money += LOAN_STEP;
  emit(ctx, { type: 'sfx', name: 'cash' });
  return true;
}

/** Pay back up to one step of the loan from the money on hand. */
export function repay(ctx: SimContext): boolean {
  const s = ctx.s;
  const amount = Math.min(LOAN_STEP, s.loan, Math.max(0, s.money));
  if (amount <= 0) return false;
  s.loan -= amount;
  s.money -= amount;
  emit(ctx, { type: 'sfx', name: 'sell' });
  return true;
}

/** What a technique costs against standard: the overall price level, times its own. */
export function priceFor(s: GameState, m: Priced): number {
  return s.priceLevel * (s.prices[m] ?? 1);
}

/** Set a technique's own price, against standard, on top of the overall level: rounded to a tenth, within limits. */
export function setTechniquePrice(ctx: SimContext, m: Priced, level: number) {
  const own = Math.round(clamp(level, PRICE_MIN, PRICE_MAX) * 10) / 10;
  const { [m]: _old, ...others } = ctx.s.prices;
  ctx.s.prices = own === 1 ? others : { ...others, [m]: own };
}

/** Set the price level, rounded to a tenth and kept within its limits. */
export function setPrice(ctx: SimContext, level: number) {
  ctx.s.priceLevel = clamp(Math.round(level * 10) / 10, PRICE_MIN, PRICE_MAX);
}
