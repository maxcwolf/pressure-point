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

/** Days before payday that the center is warned again if the bank alone will not cover the wages. */
const PAYDAY_WARNING_DAYS = 5;

/** The day the month now running began. */
const monthStartOf = (s: GameState) => Math.floor(s.day / DAYS_PER_MONTH) * DAYS_PER_MONTH;

/** The day the month now running ends and wages are due. */
export const paydayOf = (s: GameState) => monthStartOf(s) + DAYS_PER_MONTH;

/** What the staff on the books, those leaving aside, are paid in a month. */
export function monthlyPayroll(s: GameState): number {
  let total = 0;
  for (const st of s.staff) if (st.state !== 'leaving') total += st.salary;
  return total;
}

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

/** How many days of a month must have gone before its own pace of income is trusted over last month's. */
const PACE_DAYS = 2;

/**
 * This month's income at its pace so far, scaled to a whole month. The first day or two tell little, so until then
 * last month's income stands in for it, where there was one.
 */
export function projectedIncome(s: GameState): number {
  const gone = s.day - monthStartOf(s);
  const last = s.months.at(-1);
  if (gone < PACE_DAYS && last) return incomeOf(last.ledger);
  return Math.round((incomeOf(s.ledger) / Math.max(gone, 1)) * DAYS_PER_MONTH);
}

/** Where this month's books are headed, at this month's pace. */
export interface Cashflow {
  /** Income so far, and what the month will bring at this pace. */
  soFar: number;
  income: number;
  /** The wages due at payday, the interest the loan will cost then, and what else has been spent so far. */
  wages: number;
  interest: number;
  spent: number;
  /** The net the month is headed for: the income at this pace less all three. */
  net: number;
}

/** Where this month's books are headed: the income at this month's pace, less wages, interest and the known costs. */
export function projectedCashflow(s: GameState): Cashflow {
  const l = s.ledger;
  const soFar = incomeOf(l);
  const income = projectedIncome(s);
  const wages = wagesDue(s);
  const interest = Math.round(s.loan * LOAN_RATE) + Math.round(Math.max(0, -s.money) * OVERDRAFT_RATE);
  const spent = l.salaries + l.building + l.training + l.marketing + l.fines + l.interest;
  return { soFar, income, wages, interest, spent, net: income - wages - interest - spent };
}

/** Whether the next payday is covered: by the bank and the month's takings, by borrowing on top, or not at all. */
export type PayrollCover = 'yes' | 'borrowing' | 'no';

/** How the next payday stands, as things are going. */
export interface PayrollOutlook {
  /** The wages due, and the days until they are. */
  wages: number;
  daysLeft: number;
  /** In the bank now, what the month's pace brings in by payday, and the two together. */
  money: number;
  coming: number;
  expected: number;
  /** What would still be missing at payday, and the loan steps that would cover it. */
  short: number;
  borrow: number;
  /** What the bank will still lend, and where the loan would stand after borrowing to cover the wages. */
  loanRoom: number;
  loanAfter: number;
  covered: PayrollCover;
}

/** How the next payday stands: what is due, what the bank and this month's pace will have by then, and the gap. */
export function payrollOutlook(s: GameState): PayrollOutlook {
  const wages = wagesDue(s);
  const daysLeft = paydayOf(s) - s.day;
  const coming = Math.round((projectedIncome(s) * daysLeft) / DAYS_PER_MONTH);
  const expected = s.money + coming;
  const short = Math.max(0, wages - expected);
  const borrow = short > 0 ? Math.ceil(short / LOAN_STEP) * LOAN_STEP : 0;
  const loanRoom = Math.max(0, loanLimit(s) - s.loan);
  const covered: PayrollCover = short <= 0 ? 'yes' : borrow <= loanRoom ? 'borrowing' : 'no';
  return {
    wages,
    daysLeft,
    money: s.money,
    coming,
    expected,
    short,
    borrow,
    loanRoom,
    loanAfter: s.loan + Math.min(borrow, loanRoom),
    covered,
  };
}

/** Days as they read in a warning: whole days, and never less than one. */
const daysWord = (days: number) => {
  const n = Math.max(1, Math.ceil(days));
  return `${n} day${n === 1 ? '' : 's'}`;
};

/** The payday verdict in a line: covered, covered by borrowing, or short, and by how much. */
export function payrollVerdict(o: PayrollOutlook): string {
  if (o.covered === 'yes') {
    const pace = o.coming > 0 ? ` and about ${money(o.coming)} more at this month's pace` : '';
    return `Payday is covered: ${money(o.wages)} in wages against ${money(o.money)} in the bank${pace}.`;
  }
  if (o.covered === 'borrowing')
    return `Payday is covered by borrowing: ${money(o.short)} short at this month's pace, so the loan will stand at ${money(o.loanAfter)}.`;
  const ways =
    o.loanRoom > 0 ? `borrow (the bank will lend ${money(o.loanRoom)} more), sell, or earn it` : 'sell, or earn it';
  return `Payday needs ${money(o.short)} more: ${ways} in ${daysWord(o.daysLeft)}, or the center is bankrupt.`;
}

/**
 * Days until the center runs out of road, as things stand: payday after payday at the wages on the books, with this
 * month's pace of income coming in and the loan to fall back on, until one cannot be covered and the grace days run
 * out. Null while that never comes within a year, or with bankruptcy switched off.
 */
export function daysUntilBankrupt(s: GameState): number | null {
  if (!s.bankruptcyOn) return null;
  const monthly = monthlyPayroll(s);
  const income = projectedIncome(s);
  const limit = loanLimit(s);
  let cash = s.money;
  let loan = s.loan;
  // the payday coming is what is owed so far; after it, a whole month each time
  let wages = wagesDue(s);
  let coming = (income * (paydayOf(s) - s.day)) / DAYS_PER_MONTH;
  for (let m = 0; m < 12; m++) {
    cash += coming;
    if (cash < wages) {
      const need = Math.ceil((wages - cash) / LOAN_STEP) * LOAN_STEP;
      if (loan + need > limit) return paydayOf(s) + m * DAYS_PER_MONTH - s.day + PAYROLL_GRACE_DAYS;
      loan += need;
      cash += need;
    }
    cash -= wages + Math.round(loan * LOAN_RATE);
    wages = monthly;
    coming = income;
  }
  return null;
}

/**
 * Warn of a payday the center is not on course to cover: once, as soon as this month's pace first says so, and again
 * five days before if the bank alone will not cover the wages, each with the numbers. Quiet while payday is covered.
 * Run as each day begins.
 */
export function warnPayday(ctx: SimContext) {
  const s = ctx.s;
  if (!s.bankruptcyOn) return;
  const o = payrollOutlook(s);
  if (o.wages <= 0) return;
  const left = Math.ceil(o.daysLeft);
  const month = Math.floor(s.day / DAYS_PER_MONTH);
  if (left === PAYDAY_WARNING_DAYS) {
    s.paydayWarned = month;
    if (o.wages <= s.money) return;
    const pace = o.coming > 0 ? `, with about ${money(o.coming)} more coming at this month's pace` : '';
    toast(
      ctx,
      `⚠️ Payday in ${PAYDAY_WARNING_DAYS} days: ${money(o.wages)} in wages, and ${money(s.money)} in the bank${pace}. ${payrollVerdict(o)}`,
      'bad',
    );
    return;
  }
  if (left < PAYDAY_WARNING_DAYS || o.covered === 'yes' || s.paydayWarned === month) return;
  s.paydayWarned = month;
  toast(
    ctx,
    `⚠️ Payday in ${left} days: ${money(o.wages)} in wages against ${money(s.money)} in the bank and about ${money(o.coming)} more at this month's pace. ${payrollVerdict(o)}`,
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

/** Charge interest, file the month's books and start the next. */
function finishMonth(ctx: SimContext) {
  const s = ctx.s;
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
