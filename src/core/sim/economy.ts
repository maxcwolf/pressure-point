// Money and reputation: income, spending, payday, loans and prices.

import {
  DAYS_PER_MONTH,
  INSOLVENCY_DAYS,
  LOAN_MAX,
  LOAN_RATE,
  LOAN_STEP,
  MODALITIES,
  MODALITY_ORDER,
  OVERDRAFT_RATE,
  PRICE_MAX,
  PRICE_MIN,
  type Priced,
  REP_DAMPING,
} from '../data';
import { tuning } from '../difficulty';
import { money } from '../format';
import { disciplineOn, emptyLedger, unlockedUpTo } from '../state/game';
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

/** How much of a gain lands at a reputation: all of it below the midpoint, less and less above, nothing at 100. */
export function gainDamping(rep: number): number {
  const { mid, top, gainAtTop } = REP_DAMPING;
  if (rep <= mid) return 1;
  if (rep <= top) return 1 - (1 - gainAtTop) * ((rep - mid) / (top - mid));
  return gainAtTop * ((100 - rep) / (100 - top));
}

/** How much of a loss lands at a reputation: all of it above the midpoint, less and less below, nothing at 0. */
export function lossDamping(rep: number): number {
  const { mid, floor, lossAtFloor } = REP_DAMPING;
  if (rep >= mid) return 1;
  if (rep >= floor) return lossAtFloor + (1 - lossAtFloor) * ((rep - floor) / (mid - floor));
  return lossAtFloor * (rep / floor);
}

/**
 * Raise or lower reputation, kept between 0 and 100. A gain is damped as reputation climbs and a loss as it falls,
 * both to nothing at the ends, and a gain comes faster or slower as the difficulty sets.
 */
export function changeRep(ctx: SimContext, delta: number) {
  const s = ctx.s;
  if (delta > 0) delta *= gainDamping(s.reputation) * tuning(s, 'reputation');
  else delta *= lossDamping(s.reputation);
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

/** What the staff on the books, those leaving aside, are paid in a month. */
export function monthlyPayroll(s: GameState): number {
  let total = 0;
  for (const st of s.staff) if (st.state !== 'leaving') total += st.salary;
  return total;
}

/** The interest a month's end charges as things stand: on the loan, and on a bank below zero. */
export const monthlyInterest = (s: GameState) =>
  Math.round(s.loan * LOAN_RATE) + Math.round(Math.max(0, -s.money) * OVERDRAFT_RATE);

/** How far through the month now running the game is, from 0 to 1. */
const monthThrough = (s: GameState) => (s.day - Math.floor(s.day / DAYS_PER_MONTH) * DAYS_PER_MONTH) / DAYS_PER_MONTH;

/** The money a center is on course to make or lose in a month: what comes in and what goes out, and the difference. */
export interface Cashflow {
  /** What a month brings in at the pace of the last month or so. */
  income: number;
  /** The wages on the books for a month, and the interest a month's end charges. */
  wages: number;
  interest: number;
  net: number;
}

/**
 * The money the center is on course to make or lose in a month, as things stand: what it has taken in over the last
 * month or so (this month so far and the last finished one, over the days they cover), less the wages on the books
 * and the interest. Building, training, marketing and fines are left out: a one-off outlay is not a losing business,
 * and the bank judges the business.
 */
export function cashflow(s: GameState): Cashflow {
  const through = monthThrough(s);
  const taken = incomeOf(s.ledger);
  // in the first month there is no last one to go by, and nothing to go by at all in its first week
  const income =
    s.months.length > 0 ? (taken + incomeOf(s.lastLedger)) / (1 + through) : taken / Math.max(through, 0.25);
  const wages = monthlyPayroll(s);
  const interest = monthlyInterest(s);
  return { income: Math.round(income), wages, interest, net: Math.round(income) - wages - interest };
}

/** The money the center is on course to make or lose in a month, as things stand. */
export const projectedCashflow = (s: GameState) => cashflow(s).net;

/** Days until the bank calls the overdraft in and the center is bankrupt, or null while it is not on course to. */
export function daysUntilBankrupt(s: GameState): number | null {
  return s.insolvency ? Math.max(0, s.insolvency.until - s.day) : null;
}

/** How many days the bank has been in the red, or null while it is not. */
export const daysInRed = (s: GameState) => (s.redSince === null ? null : Math.max(0, s.day - s.redSince));

/** Whether the bank has been in the red for a month or more. */
export const longInRed = (s: GameState) => (daysInRed(s) ?? -1) >= DAYS_PER_MONTH;

/** What the bank would still lend: the loan's limit less what is owed. */
export const loanRoom = (s: GameState) => Math.max(0, loanLimit(s) - s.loan);

/**
 * Whether the bank is about to call the overdraft in, or would if a payday came now: the center in the red deeper
 * than the loan still to be had would clear and, at the pace of the last month or so, losing money.
 */
export const insolvent = (s: GameState) => s.money + loanRoom(s) < 0 && projectedCashflow(s) < 0;

/** The pace of the books, in a few words: making or losing so much a month. */
function paceOf(s: GameState): string {
  const net = projectedCashflow(s);
  return net < 0 ? `losing about ${money(-net)} a month` : `making about ${money(net)} a month`;
}

/**
 * A few days before payday, say so if the bank will not cover the wages: what it will do (lend, or let the wages go
 * into the red), and if the red would be with the books losing money, that the bank would then call the overdraft in.
 * Run as each day begins.
 */
export function warnPayday(ctx: SimContext) {
  const s = ctx.s;
  if (!s.bankruptcyOn || Math.ceil(paydayOf(s) - s.day) !== PAYDAY_WARNING_DAYS) return;
  const wages = wagesDue(s);
  if (wages <= s.money) return;
  const head = `⚠️ Payday in ${PAYDAY_WARNING_DAYS} days: ${money(wages)} in wages, and ${money(s.money)} in the bank.`;
  const lends = s.loan + loanFor(s, wages) <= loanLimit(s);
  const red = money(s.money - wages);
  const what = lends
    ? `The bank will lend the rest, or the wages can go into the red, to ${red}, at ${(OVERDRAFT_RATE * 100).toFixed(0)}% a month.`
    : `The bank will lend no more, so the wages go into the red, to ${red}, at ${(OVERDRAFT_RATE * 100).toFixed(0)}% a month.`;
  const losing = projectedCashflow(s) < 0;
  const then = losing
    ? ` You are ${paceOf(s)}: in the red past what the bank will lend, with the books losing money, it calls the overdraft in, and you have ${INSOLVENCY_DAYS} days to put one of the two right. Prices up, or staff down.`
    : ` You are ${paceOf(s)}, so the red would clear.`;
  toast(ctx, `${head} ${what}${then}`, 'bad');
}

/**
 * Pay the wages and close the month's books. A bank that cannot cover them stops the game and says so: with a loan
 * still to be had, to borrow the difference or pay the wages into the red; past the loan, that the wages go into the
 * red. The center is bankrupt only if it then sits in the red with the books losing money for `INSOLVENCY_DAYS`.
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
  s.payrollDue = { wages, loan: s.loan + loan <= loanLimit(s) ? loan : 0 };
  emit(ctx, { type: 'sfx', name: 'error' });
}

/** The loan, in whole steps, that would cover wages from the money in the bank. */
const loanFor = (s: GameState, wages: number) => Math.ceil((wages - s.money) / LOAN_STEP) * LOAN_STEP;

/** Pay out a payday's wages. */
function payWages(ctx: SimContext, wages: number) {
  if (wages <= 0) return;
  spend(ctx, wages, 'salaries');
  toast(ctx, `Payday: ${money(wages)} in salaries.`, 'info');
  emit(ctx, { type: 'sfx', name: 'payday' });
}

/**
 * Charge interest, file the month's books and start the next. Then, with bankruptcy on, the bank looks at the books:
 * a center in the red that is losing money has `INSOLVENCY_DAYS` to put one of the two right, and one in the red
 * that is making money is told what the red costs.
 */
function finishMonth(ctx: SimContext) {
  const s = ctx.s;
  const interest = monthlyInterest(s);
  if (interest > 0) spend(ctx, interest, 'interest');
  closeMonth(ctx);
  s.history.push(netOf(s.ledger));
  if (s.history.length > 12) s.history.shift();
  s.lastLedger = s.ledger;
  s.ledger = emptyLedger();
  if (s.money >= 0) return;
  if (!s.bankruptcyOn) {
    toast(ctx, 'You are in the red. Heal faster!', 'bad');
    return;
  }
  if (insolvent(s)) {
    callInOverdraft(ctx);
    return;
  }
  const head = `⚠️ You are ${money(-s.money)} in the red, at ${(OVERDRAFT_RATE * 100).toFixed(0)}% a month, and the staff are worried about their wages. You are ${paceOf(s)}`;
  toast(
    ctx,
    projectedCashflow(s) < 0
      ? `${head}, and the bank will still lend ${money(loanRoom(s))}: borrow it from the Money menu, since once the loan is used up a payday in the red with the books losing money has the bank call the overdraft in.`
      : `${head}, so the bank is content for now: a payday in the red past what it will lend, with the books losing money, and it calls the overdraft in.`,
    'bad',
  );
}

/**
 * The bank calls the overdraft in: the center has `INSOLVENCY_DAYS` to bring the bank back above zero or the books
 * into profit, or it is bankrupt. The days start paused, since they pass in seconds and the warning could otherwise
 * go by unseen.
 */
function callInOverdraft(ctx: SimContext) {
  const s = ctx.s;
  s.insolvency = { until: s.day + INSOLVENCY_DAYS };
  s.speed = 0;
  toast(
    ctx,
    `⚠️ The bank is calling the overdraft in: you are ${money(-s.money)} in the red and ${paceOf(s)}. You have ${INSOLVENCY_DAYS} days to bring the bank back above zero (sell something, or earn it) or the books into profit (prices up, or staff down), or the center is bankrupt. The game is paused.`,
    'bad',
  );
  emit(ctx, { type: 'sfx', name: 'error' });
}

/**
 * Each day: keep track of how long the bank has been in the red, and while the bank is calling the overdraft in, let
 * the center off as soon as it is back above zero or the books are in profit, remind it halfway, and declare it
 * bankrupt when the days run out with neither put right. Run as each day begins.
 */
export function updateInsolvency(ctx: SimContext) {
  const s = ctx.s;
  if (s.money < 0) s.redSince ??= s.day;
  else s.redSince = null;
  const due = s.insolvency;
  if (!due) return;
  if (!insolvent(s)) {
    s.insolvency = null;
    toast(
      ctx,
      s.money + loanRoom(s) >= 0
        ? 'The bank is back within what it will carry, and the overdraft is no longer being called in.'
        : `The books are back in profit, ${paceOf(s)}, and the bank is no longer calling the overdraft in. The red still costs ${(OVERDRAFT_RATE * 100).toFixed(0)}% a month.`,
      'good',
    );
    return;
  }
  const left = Math.ceil(due.until - s.day);
  if (left === Math.floor(INSOLVENCY_DAYS / 2))
    toast(
      ctx,
      `⚠️ ${left} days before the bank calls the overdraft in: ${money(-s.money)} in the red, ${paceOf(s)}. Get above zero or into profit.`,
      'bad',
    );
  if (s.day >= due.until) goBankrupt(ctx);
}

/** Take the loan that covers the wages waiting on payday, pay them and go on. False if none is waiting. */
export function takePayrollLoan(ctx: SimContext): boolean {
  const s = ctx.s;
  const due = s.payrollDue;
  if (!due || due.loan <= 0) return false;
  s.payrollDue = null;
  s.loan += due.loan;
  s.money += due.loan;
  emit(ctx, { type: 'sfx', name: 'cash' });
  toast(ctx, `Borrowed ${money(due.loan)} to cover the wages.`, 'info');
  payWages(ctx, due.wages);
  finishMonth(ctx);
  return true;
}

/**
 * Pay the wages waiting on payday into the red, whether the bank's loan was turned down or it would lend no more.
 * False if no payday is waiting.
 */
export function payIntoRed(ctx: SimContext): boolean {
  const s = ctx.s;
  const due = s.payrollDue;
  if (!due) return false;
  s.payrollDue = null;
  payWages(ctx, due.wages);
  finishMonth(ctx);
  return true;
}

/** The bank has called the overdraft in: the staff walk out and the game is lost. */
function goBankrupt(ctx: SimContext) {
  const s = ctx.s;
  s.insolvency = null;
  s.bankrupt = true;
  toast(ctx, `${money(-s.money)} in the red, and the bank has called it in. The staff walk out.`, 'bad');
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
 * discipline that is switched on. Locked ones are left out, since the player cannot see or price them.
 */
export function averagePrice(s: GameState): number {
  const offered = MODALITY_ORDER.filter(
    (m) => MODALITIES[m].star <= unlockedUpTo(s) && disciplineOn(s, MODALITIES[m].discipline),
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
