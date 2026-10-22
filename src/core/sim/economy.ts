// Money and reputation: income, spending, payday, loans and prices.

import type { Role } from '../data';
import {
  DAYS_PER_MONTH,
  INSOLVENCY_DAYS,
  ITEMS,
  LOAN_MAX,
  LOAN_RATE,
  LOAN_STEP,
  MODALITIES,
  MODALITY_ORDER,
  OVERDRAFT_RATE,
  PRICE_MAX,
  PRICE_MIN,
  PRICE_PUT_OFF,
  type Priced,
  REP_DAMPING,
} from '../data';
import { tuning } from '../difficulty';
import { money } from '../format';
import { disciplineOn, emptyLedger, unlockedUpTo } from '../state/game';
import type { GameState, Item, Ledger, Staff } from '../state/types';
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

/** The interest a month's end charges as things stand: on the loan, and on a bank below zero. */
export const monthlyInterest = (s: GameState) =>
  Math.round(s.loan * LOAN_RATE) + Math.round(Math.max(0, -s.money) * OVERDRAFT_RATE);

/** How far through the month now running the game is, from 0 to 1. */
const monthThrough = (s: GameState) => (s.day - Math.floor(s.day / DAYS_PER_MONTH) * DAYS_PER_MONTH) / DAYS_PER_MONTH;

/** The money a center is on course to make or lose in a month: what comes in and what goes out, and the difference. */
export interface Cashflow {
  /** What a month brings in at the pace of the last month or so. */
  income: number;
  /** The wages on the books for a month, the interest a month's end charges, and what the machines cost to run. */
  wages: number;
  interest: number;
  upkeep: number;
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
  const upkeep = machineUpkeep(s);
  return { income: Math.round(income), wages, interest, upkeep, net: Math.round(income) - wages - interest - upkeep };
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

/** A member of staff who could be let go, how busy their station has been, and where the books would stand without them. */
export interface SpareHand {
  staff: Staff;
  /** Their station, if they have one, and how much of the last few days it was busy, from 0 to 1. */
  station: Item | undefined;
  busy: number;
  /** The money the center would be on course to make or lose in a month without their wage. */
  netAfter: number;
}

/** The roles that work a station, which a center can be short of or have one too many of. */
const STATION_ROLES: ReadonlySet<Role> = new Set(Object.values(ITEMS).flatMap((d) => d.station?.staff ?? []));

/** How idle a member of staff has been, for choosing who to let go: no station at all is idler than one that stood idle. */
const idleRank = (h: { station: Item | undefined; busy: number }) => (h.station ? h.busy : -1);

/**
 * The member of staff whose going the center would miss least: in a role that works a station and has two or more on
 * the books, the one whose station has been busy least over the last few days (no station at all counts as idle), the
 * dearer of two as busy. Undefined if no such role has two.
 */
export function spareHand(s: GameState): SpareHand | undefined {
  /** How many are on the books in a role. */
  const team = (r: Role) => s.staff.filter((st) => st.role === r && st.state !== 'leaving').length;
  const net = projectedCashflow(s);
  let best: SpareHand | undefined;
  for (const st of s.staff) {
    if (st.state === 'leaving' || !STATION_ROLES.has(st.role) || team(st.role) < 2) continue;
    const station = st.post ? s.items.find((i) => i.id === st.post) : undefined;
    const busy = station?.busy ?? 0;
    const r = idleRank({ station, busy });
    if (!best || r < idleRank(best) || (r === idleRank(best) && st.salary > best.staff.salary))
      best = { staff: st, station, busy, netAfter: net + st.salary };
  }
  return best;
}

/**
 * Who to let go, in a sentence: their wage, how busy their station has been, and where the books would stand without
 * them. Null if no role that works a station has two.
 */
export function letGoLine(s: GameState): string | null {
  const h = spareHand(s);
  if (!h) return null;
  const where = h.station
    ? `their ${ITEMS[h.station.type].name} busy ${Math.round(h.busy * 100)}% of the time`
    : 'with no station of their own';
  const after =
    h.netAfter >= 0
      ? `puts the books ${money(h.netAfter)} a month in profit`
      : `cuts the loss to ${money(-h.netAfter)} a month`;
  return `Letting ${h.staff.name} go (${money(h.staff.salary)} a month, ${where}) ${after}.`;
}

/**
 * What works while the bank is calling the overdraft in, with `days` left: a price rise barely moves the pace the bank
 * judges in that time, and a wage comes off at once. Who to let go, or, with nobody spare, the other way out.
 */
export function countdownLever(s: GameState, days: number): string {
  const d = `${days} day${days === 1 ? '' : 's'}`;
  const pace = `A price rise helps the months ahead, but the bank judges the takings over the last month or so, so it barely moves them in ${d}; a wage comes off at once.`;
  return `${pace} ${letGoLine(s) ?? 'No role has two to let one go from, so the way out is the bank above zero: sell something, or earn it.'}`;
}

/** Putting the books right before borrowing, while they lose money: who to let go, or prices up with nobody spare. */
export const cutFirst = (s: GameState) =>
  `Prices up or staff down first: ${letGoLine(s) ?? 'nobody is spare in a role with two, so prices up.'}`;

/** What the machines cost to run, as the payday figures read it: nothing without machines. */
const runningOf = (o: Pick<PayrollOutlook, 'upkeep'>) =>
  o.upkeep > 0 ? ` and ${money(o.upkeep)} to run the machines` : '';

/** Whether the next payday is covered: by the bank and the month's takings, by borrowing on top, or not at all. */
export type PayrollCover = 'yes' | 'borrowing' | 'no';

/** How the next payday stands, as things are going. */
export interface PayrollOutlook {
  /** The wages due, what the machines cost to run, paid with them, and the days until they are. */
  wages: number;
  upkeep: number;
  daysLeft: number;
  /** In the bank now, what the pace brings in by payday, and the two together. */
  money: number;
  coming: number;
  expected: number;
  /** What would still be missing at payday, and the loan steps that would cover it. */
  short: number;
  borrow: number;
  /** What the bank will still lend, and where the loan would stand after borrowing to cover the wages. */
  loanRoom: number;
  loanAfter: number;
  /** The money the center is on course to make or lose in a month, which decides what the bank does with the red. */
  net: number;
  covered: PayrollCover;
}

/** How the next payday stands: what is due, what the bank and the pace will have by then, and the gap. */
export function payrollOutlook(s: GameState): PayrollOutlook {
  const wages = wagesDue(s);
  const upkeep = machineUpkeep(s);
  const daysLeft = paydayOf(s) - s.day;
  const flow = cashflow(s);
  const coming = Math.round((flow.income * daysLeft) / DAYS_PER_MONTH);
  const expected = s.money + coming;
  const short = Math.max(0, wages + upkeep - expected);
  const borrow = short > 0 ? Math.ceil(short / LOAN_STEP) * LOAN_STEP : 0;
  const room = loanRoom(s);
  const covered: PayrollCover = short <= 0 ? 'yes' : borrow <= room ? 'borrowing' : 'no';
  return {
    wages,
    upkeep,
    daysLeft,
    money: s.money,
    coming,
    expected,
    short,
    borrow,
    loanRoom: room,
    loanAfter: s.loan + Math.min(borrow, room),
    net: flow.net,
    covered,
  };
}

/**
 * The payday verdict in a line: covered, covered by borrowing, or short past what the bank will lend, with what the
 * bank then does: the wages go into the red, and with the books losing money it calls the overdraft in.
 */
export function payrollVerdict(o: PayrollOutlook): string {
  if (o.covered === 'yes') {
    const pace = o.coming > 0 ? ` and about ${money(o.coming)} more at this month's pace` : '';
    return `Payday is covered: ${money(o.wages)} in wages${runningOf(o)} against ${money(o.money)} in the bank${pace}.`;
  }
  if (o.covered === 'borrowing')
    return `Payday is covered by borrowing: ${money(o.short)} short at this month's pace, so the loan will stand at ${money(o.loanAfter)}.`;
  const lends = o.loanRoom > 0 ? `the bank will lend only ${money(o.loanRoom)} more` : 'the bank will lend no more';
  const then =
    o.net < 0
      ? `, and with the books losing about ${money(-o.net)} a month the bank calls the overdraft in, with ${INSOLVENCY_DAYS} days to put one of the two right: prices up, or staff down`
      : `; the books make about ${money(o.net)} a month, so the red clears`;
  return `Payday needs ${money(o.short)} more than the bank and this month's pace will have, and ${lends}: the rest goes into the red at ${(OVERDRAFT_RATE * 100).toFixed(0)}% a month${then}.`;
}

/**
 * Warn of a payday the center is not on course to cover: once, as soon as the pace first says so, and again five days
 * before if the bank alone will not cover the wages, each with the numbers and what the bank will do. Quiet while
 * payday is covered. Run as each day begins.
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
    if (o.wages + o.upkeep <= s.money) return;
    const pace = o.coming > 0 ? `, with about ${money(o.coming)} more coming at this month's pace` : '';
    toast(
      ctx,
      `Payday in ${PAYDAY_WARNING_DAYS} days: ${money(o.wages)} in wages${runningOf(o)}, and ${money(s.money)} in the bank${pace}. ${payrollVerdict(o)}`,
      'bad',
      undefined,
      'ui-warning',
    );
    return;
  }
  if (left < PAYDAY_WARNING_DAYS || o.covered === 'yes' || s.paydayWarned === month) return;
  s.paydayWarned = month;
  toast(
    ctx,
    `Payday in ${left} days: ${money(o.wages)} in wages${runningOf(o)} against ${money(s.money)} in the bank and about ${money(o.coming)} more at this month's pace. ${payrollVerdict(o)}`,
    'bad',
    undefined,
    'ui-warning',
  );
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

/** Pay what the machines cost to run for the month, in power and parts. */
function payUpkeep(ctx: SimContext) {
  const upkeep = machineUpkeep(ctx.s);
  if (upkeep <= 0) return;
  spend(ctx, upkeep, 'upkeep');
  toast(ctx, `The machines cost ${money(upkeep)} to run this month, in power and parts.`, 'info');
}

/**
 * Charge interest, file the month's books and start the next. Then, with bankruptcy on, the bank looks at the books:
 * a center in the red that is losing money has `INSOLVENCY_DAYS` to put one of the two right, and one in the red
 * that is making money is told what the red costs.
 */
function finishMonth(ctx: SimContext) {
  const s = ctx.s;
  payUpkeep(ctx);
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
  const head = `You are ${money(-s.money)} in the red, at ${(OVERDRAFT_RATE * 100).toFixed(0)}% a month, and the staff are worried about their wages. You are ${paceOf(s)}`;
  toast(
    ctx,
    projectedCashflow(s) < 0
      ? `${head}. ${cutFirst(s)} Then borrow what is left from the Money menu (the bank will still lend ${money(loanRoom(s))}): the loan buys time, but it uses the room the next payday needs, and once it is used up a payday in the red with the books losing money has the bank call the overdraft in.`
      : `${head}, so the bank is content for now: a payday in the red past what it will lend, with the books losing money, and it calls the overdraft in.`,
    'bad',
    undefined,
    'ui-warning',
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
    `The bank is calling the overdraft in: you are ${money(-s.money)} in the red and ${paceOf(s)}. You have ${INSOLVENCY_DAYS} days to bring the bank back above zero (sell something, or earn it) or the books into profit, or the center is bankrupt. ${countdownLever(s, INSOLVENCY_DAYS)} The game is paused.`,
    'bad',
    undefined,
    'ui-warning',
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
      `${left} days before the bank calls the overdraft in: ${money(-s.money)} in the red, ${paceOf(s)}. Get above zero or into profit. ${countdownLever(s, left)}`,
      'bad',
      undefined,
      'ui-warning',
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

/** The value of a curve given as knots joined by straight lines, level beyond the first and the last. */
function along(knots: readonly (readonly [number, number])[], x: number): number {
  const first = knots[0];
  const last = knots.at(-1);
  if (!first || !last) return 0;
  if (x <= first[0]) return first[1];
  if (x >= last[0]) return last[1];
  let lo = first;
  for (const hi of knots) {
    if (x <= hi[0]) return lo[1] + ((hi[1] - lo[1]) * (x - lo[0])) / (hi[0] - lo[0]);
    lo = hi;
  }
  return last[1];
}

/**
 * The chance a new guest balks at a treatment's price once diagnosed and leaves: gentle to 1.3 and steep past it, with
 * a better name forgiving a dearer price (`PRICE_PUT_OFF`). How much a guest minds it is `mindsPrice`.
 */
export function putOffChance(price: number, reputation: number): number {
  // standard prices put no one off, however poor the center's name: there is always a price that costs no guests
  if (price <= 1) return 0;
  return along(PRICE_PUT_OFF.price, price - along(PRICE_PUT_OFF.reputation, reputation));
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
