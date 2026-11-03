// Payday and the bank: paying the wages and closing the month's books, borrowing to cover a payday the bank cannot,
// and the bank calling the overdraft in.

import { INSOLVENCY_DAYS, LOAN_STEP, OVERDRAFT_RATE } from '../data';
import { money } from '../format';
import { emptyLedger } from '../state/game';
import type { GameState } from '../state/types';
import type { SimContext } from './context';
import {
  countdownLever,
  cutFirst,
  insolvent,
  lend,
  loanLimit,
  loanRoom,
  machineUpkeep,
  monthlyInterest,
  netOf,
  paceOf,
  projectedCashflow,
  settlePay,
  spend,
} from './economy';
import { emit, toast } from './events';
import { quarterEnded } from './news';
import { paperToast, printIssue } from './paper';
import { closeMonth } from './records';

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

/** Pay out a payday's wages. The payday that closes a quarter prints the town paper, its headlines on top of the message. */
function payWages(ctx: SimContext, wages: number) {
  const paper = quarterEnded(ctx.s) ? printIssue(ctx) : null;
  if (wages <= 0) {
    if (paper) paperToast(ctx, paper, `${paper.name} is out.`);
    return;
  }
  spend(ctx, wages, 'salaries');
  if (paper) paperToast(ctx, paper, `Payday: ${money(wages)} in salaries.`);
  else toast(ctx, `Payday: ${money(wages)} in salaries.`, 'info');
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
  lend(ctx, due.loan);
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
