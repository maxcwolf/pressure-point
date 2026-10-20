// Money and reputation: income, spending, payday, loans and prices.

import {
  DAYS_PER_MONTH,
  LOAN_MAX,
  LOAN_RATE,
  LOAN_STEP,
  OVERDRAFT_RATE,
  PRICE_MAX,
  PRICE_MIN,
  type Priced,
  UNPAID_MORALE,
} from '../data';
import { tuning } from '../difficulty';
import { money } from '../format';
import { emptyLedger } from '../state/game';
import type { GameState, Ledger, Staff } from '../state/types';
import { clamp } from '../util';
import type { SimContext } from './context';
import { emit, toast } from './events';
import { closeMonth } from './records';

/** A ledger's income minus its spending. */
export function netOf(l: Ledger) {
  return incomeOf(l) - l.salaries - l.building - l.training - l.interest - l.marketing - l.fines;
}

/** A ledger's income: fees, class places, sales over and under the counter, house calls and bonuses. */
export function incomeOf(l: Ledger) {
  return l.consult + l.treatment + l.classes + l.vending + l.shop + l.mushrooms + l.calls + l.bonus;
}

/** Where money comes in from, as the books keep it. */
export type Income = 'consult' | 'treatment' | 'vending' | 'shop' | 'mushrooms' | 'calls' | 'classes' | 'bonus';

/** Where money goes out to, as the books keep it. */
export type Cost = 'salaries' | 'building' | 'training' | 'interest' | 'marketing' | 'fines';

/**
 * Take in money and record it. Given where it was taken, the amount floats up there, with the till's ring for a large
 * sum; a prize or reward, which has no one place, comes in quietly.
 */
export function earn(ctx: SimContext, amount: number, kind: Income, x?: number, y?: number) {
  ctx.s.money += amount;
  ctx.s.ledger[kind] += amount;
  if (x === undefined || y === undefined) return;
  emit(ctx, { type: 'float', text: `+${money(amount)}`, x, y, kind: 'good' });
  if (amount >= 100) emit(ctx, { type: 'sfx', name: 'cash' });
}

/** Pay out money and record it. */
export function spend(ctx: SimContext, amount: number, kind: Cost) {
  ctx.s.money -= amount;
  ctx.s.ledger[kind] += amount;
}

/** Get back money paid out, as for something sold or a course cut short: it comes off what that cost this month. */
export function recoup(ctx: SimContext, amount: number, kind: Cost) {
  const s = ctx.s;
  s.money += amount;
  // only this month's spending can be taken back out of this month's books: what was paid in an earlier month, and
  // closed with it, comes back as income instead of a cost below zero
  const back = Math.min(amount, Math.max(0, s.ledger[kind]));
  s.ledger[kind] -= back;
  s.ledger.bonus += amount - back;
}

/** Add money to the bank or take it away, off the books: the console's money cheat, which is no income or cost. */
export function adjustMoney(ctx: SimContext, amount: number) {
  ctx.s.money += amount;
}

/** Raise or lower reputation, kept between 0 and 100. */
export function changeRep(ctx: SimContext, delta: number) {
  const s = ctx.s;
  // gains taper off as reputation climbs, and come faster or slower as the difficulty sets
  if (delta > 0) delta *= (1.15 - s.reputation / 120) * tuning(s, 'reputation');
  s.reputation = clamp(s.reputation + delta, 0, 100);
}

/** The most the bank will lend: more or less than usual, as the difficulty sets, in whole steps. */
export const loanLimit = (s: GameState) => Math.round((LOAN_MAX * tuning(s, 'loans')) / LOAN_STEP) * LOAN_STEP;

/** What a member of staff has earned since they were last paid: a month's salary at most, in whole days. */
export function owedPay(s: GameState, st: Staff): number {
  const days = clamp(Math.round(s.day - st.paidTo), 0, DAYS_PER_MONTH);
  return Math.round((st.salary * days) / DAYS_PER_MONTH);
}

/** Work out what a member of staff is owed up to today and mark them paid, leaving it to the caller to pay it. */
function settlePay(ctx: SimContext, st: Staff): number {
  const owed = owedPay(ctx.s, st);
  st.paidTo = ctx.s.day;
  return owed;
}

/** Pay a member of staff who is going what they have earned since payday, so leaving early costs no more than staying. */
export function payOff(ctx: SimContext, st: Staff) {
  const owed = settlePay(ctx, st);
  if (owed > 0) spend(ctx, owed, 'salaries');
}

/** Pay salaries and loan interest, close the month's books and bring in new applicants. */
export function monthEnd(ctx: SimContext) {
  const s = ctx.s;
  // those leaving were paid up to the day they went
  let wages = 0;
  for (const st of s.staff) if (st.state !== 'leaving') wages += settlePay(ctx, st);
  if (wages > 0) {
    spend(ctx, wages, 'salaries');
    const short = s.money < 0;
    toast(
      ctx,
      short
        ? `Payday: ${money(wages)} in salaries, and the bank is in the red.`
        : `Payday: ${money(wages)} in salaries.`,
      short ? 'bad' : 'info',
    );
    emit(ctx, { type: 'sfx', name: 'payday' });
    // staff who are paid out of an overdraft worry about their jobs
    if (short) for (const st of s.staff) st.morale = Math.max(0, st.morale - UNPAID_MORALE);
  }
  const interest = Math.round(s.loan * LOAN_RATE) + Math.round(Math.max(0, -s.money) * OVERDRAFT_RATE);
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
  if (s.loan + LOAN_STEP > loanLimit(s)) return false;
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

/** What a technique costs against standard: the overall price level, times its own, kept within the same limits. */
export function priceFor(s: GameState, m: Priced): number {
  return clamp(s.priceLevel * (s.prices[m] ?? 1), PRICE_MIN, PRICE_MAX);
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
