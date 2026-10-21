// Money and reputation: income, spending, payday, loans and prices.

import {
  DAYS_PER_MONTH,
  LOAN_MAX,
  LOAN_RATE,
  LOAN_STEP,
  MODALITIES,
  MODALITY_ORDER,
  OVERDRAFT_RATE,
  PAYROLL_GRACE_DAYS,
  PRICE_MAX,
  PRICE_MIN,
  type Priced,
} from '../data';
import { tuning } from '../difficulty';
import { money } from '../format';
import { disciplineOn, emptyLedger, unlockedUpTo } from '../state/game';
import type { GameState, Ledger, Staff } from '../state/types';
import { clamp } from '../util';
import type { SimContext } from './context';
import { emit, toast } from './events';
import { machineBuilt, machineUpkeep } from './machines';
import { closeMonth } from './records';

/** A ledger's income minus its spending. */
export function netOf(l: Ledger) {
  return incomeOf(l) - l.salaries - l.building - l.training - l.interest - l.marketing - l.fines - l.upkeep;
}

/** A ledger's income: fees, class places, sales over and under the counter, house calls and bonuses. */
export function incomeOf(l: Ledger) {
  return l.consult + l.treatment + l.classes + l.vending + l.shop + l.mushrooms + l.calls + l.bonus;
}

/** Where money comes in from, as the books keep it. */
export type Income = 'consult' | 'treatment' | 'vending' | 'shop' | 'mushrooms' | 'calls' | 'classes' | 'bonus';

/** Where money goes out to, as the books keep it. */
export type Cost = 'salaries' | 'building' | 'training' | 'interest' | 'marketing' | 'fines' | 'upkeep';

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

/** Days before payday that the center is warned the wages will not be covered. */
const PAYDAY_WARNING_DAYS = 5;

/** The day the month now running ends and wages are due. */
const paydayOf = (s: GameState) => (Math.floor(s.day / DAYS_PER_MONTH) + 1) * DAYS_PER_MONTH;

/** What the next payday will come to, as things stand. */
export function wagesDue(s: GameState): number {
  const payday = paydayOf(s);
  let total = 0;
  for (const st of s.staff) {
    if (st.state === 'leaving') continue;
    total += Math.round((st.salary * clamp(Math.round(payday - st.paidTo), 0, DAYS_PER_MONTH)) / DAYS_PER_MONTH);
  }
  return total;
}

/** A few days before payday, say so if the bank will not cover the wages. Run as each day begins. */
export function warnPayday(ctx: SimContext) {
  const s = ctx.s;
  if (!s.bankruptcyOn || Math.ceil(paydayOf(s) - s.day) !== PAYDAY_WARNING_DAYS) return;
  const wages = wagesDue(s);
  // the machines' power and parts are paid on payday too, once the wages are
  const upkeep = machineUpkeep(s);
  if (wages + upkeep <= s.money) return;
  const running = upkeep ? ` and ${money(upkeep)} to run the machines` : '';
  toast(
    ctx,
    `⚠️ Payday in ${PAYDAY_WARNING_DAYS} days: ${money(wages)} in wages${running}, and ${money(Math.max(0, s.money))} in the bank. Past that you will have to borrow, or you lose.`,
    'bad',
  );
}

/**
 * Pay the wages and close the month's books. A bank that cannot cover them stops the game and asks to borrow the
 * difference; if the bank would not lend that much, or the loan is refused, the center is bankrupt.
 */
export function monthEnd(ctx: SimContext) {
  const s = ctx.s;
  // those leaving were paid up to the day they went
  let wages = 0;
  for (const st of s.staff) if (st.state !== 'leaving') wages += settlePay(ctx, st);
  // with bankruptcy switched off, the bank just goes into the red
  if (wages <= 0 || wages <= s.money || !s.bankruptcyOn) {
    payWages(ctx, wages);
    finishMonth(ctx);
    return;
  }
  const loan = loanFor(s, wages);
  if (s.loan + loan <= loanLimit(s)) {
    s.payrollDue = { wages, loan, until: null };
    return;
  }
  // the bank would not lend enough: a few days to find the money some other way, starting paused, since a few days
  // pass in seconds and the warning could otherwise go by unseen
  s.payrollDue = { wages, loan: 0, until: s.day + PAYROLL_GRACE_DAYS };
  s.speed = 0;
  toast(
    ctx,
    `⚠️ Payday: ${money(wages)} in wages, ${money(Math.max(0, s.money))} in the bank, and the bank will not lend the rest. The game is paused. You have ${PAYROLL_GRACE_DAYS} days to find it: sell something, or earn it. Or the center is bankrupt.`,
    'bad',
  );
  emit(ctx, { type: 'sfx', name: 'error' });
}

/** The loan, in whole steps, that would cover wages from the money in the bank. */
const loanFor = (s: GameState, wages: number) => Math.ceil((wages - s.money) / LOAN_STEP) * LOAN_STEP;

/**
 * Wages overdue because the bank would not lend enough: paid as soon as the money is there, put to the player as a
 * loan if the bank would lend it after all, and bankruptcy if the days run out. True if the wages were paid.
 */
export function updatePayroll(ctx: SimContext): boolean {
  const s = ctx.s;
  const due = s.payrollDue;
  if (!due) return false;
  const until = due.until;
  // a payday waiting on an answer about a loan is not this
  if (until === null) return false;
  if (s.money >= due.wages) {
    s.payrollDue = null;
    payWages(ctx, due.wages);
    finishMonth(ctx);
    return true;
  }
  const loan = loanFor(s, due.wages);
  if (s.loan + loan <= loanLimit(s)) s.payrollDue = { wages: due.wages, loan, until: null };
  else if (s.day >= until) goBankrupt(ctx, due.wages);
  return false;
}

/** Pay out a payday's wages. */
function payWages(ctx: SimContext, wages: number) {
  if (wages <= 0) return;
  spend(ctx, wages, 'salaries');
  toast(ctx, `Payday: ${money(wages)} in salaries.`, 'info');
  emit(ctx, { type: 'sfx', name: 'payday' });
}

/** Pay what the machines cost to run for the month, in power and parts. */
function payUpkeep(ctx: SimContext) {
  const upkeep = machineUpkeep(ctx.s);
  if (upkeep <= 0) return;
  spend(ctx, upkeep, 'upkeep');
  toast(ctx, `The machines cost ${money(upkeep)} to run this month, in power and parts.`, 'info');
}

/** Pay the machines' running costs, charge interest, file the month's books and start the next. */
function finishMonth(ctx: SimContext) {
  const s = ctx.s;
  payUpkeep(ctx);
  const interest = Math.round(s.loan * LOAN_RATE) + Math.round(Math.max(0, -s.money) * OVERDRAFT_RATE);
  if (interest > 0) spend(ctx, interest, 'interest');
  closeMonth(ctx);
  s.history.push(netOf(s.ledger));
  if (s.history.length > 12) s.history.shift();
  s.lastLedger = s.ledger;
  s.ledger = emptyLedger();
  if (s.money < 0) toast(ctx, 'You are in the red. Heal faster!', 'bad');
}

/** Take the loan that covers the wages waiting on payday, pay them and go on. False if none is waiting. */
export function takePayrollLoan(ctx: SimContext): boolean {
  const s = ctx.s;
  const due = s.payrollDue;
  if (due?.until !== null) return false;
  s.payrollDue = null;
  s.loan += due.loan;
  s.money += due.loan;
  emit(ctx, { type: 'sfx', name: 'cash' });
  toast(ctx, `Borrowed ${money(due.loan)} to cover the wages.`, 'info');
  payWages(ctx, due.wages);
  finishMonth(ctx);
  return true;
}

/** Turn the loan down: with the wages unpaid, the center is bankrupt. False if no payday is waiting. */
export function refusePayrollLoan(ctx: SimContext): boolean {
  const due = ctx.s.payrollDue;
  if (due?.until !== null) return false;
  goBankrupt(ctx, due.wages);
  return true;
}

/** The wages cannot be paid: the staff walk out and the game is lost. */
function goBankrupt(ctx: SimContext, wages: number) {
  ctx.s.payrollDue = null;
  ctx.s.bankrupt = true;
  toast(ctx, `${money(wages)} in wages, and no way to pay them. The staff walk out.`, 'bad');
  emit(ctx, { type: 'sfx', name: 'fail' });
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

/**
 * What treatments cost on average against standard, across the techniques the center can offer: unlocked, and in a
 * discipline that is switched on, and a machine's own once its room is built. Locked ones are left out, since the
 * player cannot see or price them.
 */
export function averagePrice(s: GameState): number {
  const offered = MODALITY_ORDER.filter(
    (m) => MODALITIES[m].star <= unlockedUpTo(s) && disciplineOn(s, MODALITIES[m].discipline) && machineBuilt(s, m),
  );
  if (!offered.length) return s.priceLevel;
  return offered.reduce((sum, m) => sum + priceFor(s, m), 0) / offered.length;
}

/** Set a technique's own price, against standard, on top of the overall level: rounded to a tenth, within limits. */
export function setTechniquePrice(ctx: SimContext, m: Priced, level: number) {
  if (!Number.isFinite(level)) return;
  const own = Math.round(clamp(level, PRICE_MIN, PRICE_MAX) * 10) / 10;
  const { [m]: _old, ...others } = ctx.s.prices;
  ctx.s.prices = own === 1 ? others : { ...others, [m]: own };
}

/** Set the price level, rounded to a tenth and kept within its limits. */
export function setPrice(ctx: SimContext, level: number) {
  if (!Number.isFinite(level)) return;
  ctx.s.priceLevel = clamp(Math.round(level * 10) / 10, PRICE_MIN, PRICE_MAX);
}
