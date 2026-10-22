// The payroll outlook: where the books are headed at their pace, whether payday is covered, and the two warnings before it.
import { describe, expect, it } from 'vitest';

import { DAYS_PER_MONTH, INSOLVENCY_DAYS, LOAN_RATE, LOAN_STEP, OVERDRAFT_RATE } from '../../src/core/data';
import { createContext } from '../../src/core/sim/context';
import {
  cashflow,
  loanLimit,
  monthlyPayroll,
  payrollOutlook,
  payrollVerdict,
  warnPayday,
} from '../../src/core/sim/economy';
import { monthSoFar } from '../../src/core/sim/records';
import { runwayNote } from '../../src/ui/components/menus/PayrollTab';
import { hire, openCenter, toasts } from './helpers';

/** A center with one therapist at $3,000 a month, owed from the start of the month, and this much in the bank. */
function center(money: number, day = 10) {
  const c = openCenter(1);
  const ctx = createContext(c.s);
  c.s.staff = [];
  c.s.loan = 0;
  const st = hire(c.sim, 'therapist');
  st.salary = 3000;
  st.paidTo = 0;
  c.s.day = day;
  c.s.money = money;
  ctx.events.length = 0;
  return { ...c, ctx, st };
}

describe('the pace of the books', () => {
  it('scales the income so far to a whole month', () => {
    const { s } = center(0, 10);
    s.ledger.treatment = 1000;
    expect(cashflow(s).income).toBe(3000);
    s.day = 15;
    expect(cashflow(s).income).toBe(2000);
  });

  it('counts the first days of the first month as a week, and averages this month with the last once there is one', () => {
    const { s, ctx } = center(0, 0.5);
    s.ledger.treatment = 100;
    expect(cashflow(s).income).toBe(400);
    s.ledger.treatment = 0;
    s.months.push({ ...monthSoFar(ctx), ledger: { ...s.ledger, treatment: 9000 } });
    s.lastLedger = { ...s.ledger, treatment: 9000 };
    expect(cashflow(s).income).toBe(Math.round(9000 / (1 + 0.5 / DAYS_PER_MONTH)));
  });

  it('is headed for the income at pace less the wages on the books and the interest', () => {
    const { s } = center(0, 10);
    s.ledger.treatment = 1000;
    s.ledger.building = 400;
    s.loan = LOAN_STEP;
    const interest = Math.round(LOAN_STEP * LOAN_RATE);
    expect(cashflow(s)).toEqual({ income: 3000, wages: 3000, interest, upkeep: 0, net: -interest });
    expect(monthlyPayroll(s)).toBe(3000);
  });
});

describe('whether payday is covered', () => {
  it('by the bank and the pace together', () => {
    const { s } = center(1000, 10);
    s.ledger.treatment = 1000;
    const o = payrollOutlook(s);
    // $3,000 at pace over 30 days, two thirds of it still to come
    expect(o).toMatchObject({ wages: 3000, daysLeft: 20, money: 1000, coming: 2000, expected: 3000, short: 0, net: 0 });
    expect(o.covered).toBe('yes');
    expect(payrollVerdict(o)).toBe(
      "Payday is covered: $3,000 in wages against $1,000 in the bank and about $2,000 more at this month's pace.",
    );
  });

  it('by borrowing, saying where the loan will stand', () => {
    const { s } = center(500, 10);
    const o = payrollOutlook(s);
    expect(o).toMatchObject({ coming: 0, short: 2500, borrow: LOAN_STEP, loanAfter: LOAN_STEP, covered: 'borrowing' });
    expect(payrollVerdict(o)).toBe(
      "Payday is covered by borrowing: $2,500 short at this month's pace, so the loan will stand at $5,000.",
    );
  });

  it('or not past what the bank will lend, with what the bank then does', () => {
    const { s } = center(500, 10);
    s.loan = loanLimit(s);
    const interest = Math.round(loanLimit(s) * LOAN_RATE);
    const o = payrollOutlook(s);
    expect(o).toMatchObject({ short: 2500, loanRoom: 0, net: -3000 - interest, covered: 'no' });
    expect(payrollVerdict(o)).toBe(
      `Payday needs $2,500 more than the bank and this month's pace will have, and the bank will lend no more: the rest goes into the red at 5% a month, and with the books losing about $${(3000 + interest).toLocaleString('en-US')} a month the bank calls the overdraft in, with ${INSOLVENCY_DAYS} days to put one of the two right: prices up, or staff down.`,
    );
    // with a step of loan room left, it says so
    s.loan = loanLimit(s) - LOAN_STEP;
    s.money = -4000;
    expect(payrollVerdict(payrollOutlook(s))).toContain(
      "Payday needs $7,000 more than the bank and this month's pace will have, and the bank will lend only $5,000 more: the rest goes into the red",
    );
    // and with the books in profit, the red clears
    s.loan = loanLimit(s);
    s.money = -5000;
    s.ledger.treatment = 1500;
    const net = 4500 - 3000 - interest - Math.round(5000 * OVERDRAFT_RATE);
    expect(net).toBeGreaterThan(0);
    expect(payrollVerdict(payrollOutlook(s))).toBe(
      `Payday needs $5,000 more than the bank and this month's pace will have, and the bank will lend no more: the rest goes into the red at 5% a month; the books make about $${net} a month, so the red clears.`,
    );
  });

  it('reads where the center stands with the bank under the verdict', () => {
    expect(runwayNote(null)).toContain('The bank judges the business');
    expect(runwayNote(INSOLVENCY_DAYS)).toBe(
      `The bank is calling the overdraft in: ${INSOLVENCY_DAYS} days to get back above zero or into profit, or the center is bankrupt.`,
    );
    expect(runwayNote(0.4)).toContain('1 day to');
  });
});

describe('the warnings before payday', () => {
  it('come as soon as the pace first says payday is not covered, once a month, with the numbers', () => {
    const { s, ctx } = center(500, 10);
    warnPayday(ctx);
    expect(toasts(ctx.events)).toEqual([
      "Payday in 20 days: $3,000 in wages against $500 in the bank and about $0 more at this month's pace. Payday is covered by borrowing: $2,500 short at this month's pace, so the loan will stand at $5,000.",
    ]);
    expect(s.paydayWarned).toBe(0);
    ctx.events.length = 0;
    s.day = 11;
    warnPayday(ctx);
    expect(toasts(ctx.events)).toEqual([]);
    // the next month is warned afresh
    s.day = DAYS_PER_MONTH + 10;
    warnPayday(ctx);
    expect(toasts(ctx.events)).toHaveLength(1);
    expect(s.paydayWarned).toBe(1);
  });

  it('stay quiet while payday is covered, and with bankruptcy off', () => {
    const { s, ctx } = center(5000, 10);
    warnPayday(ctx);
    s.money = 1000;
    s.ledger.treatment = 1000;
    warnPayday(ctx);
    expect(toasts(ctx.events)).toEqual([]);
    s.ledger.treatment = 0;
    s.bankruptcyOn = false;
    warnPayday(ctx);
    expect(toasts(ctx.events)).toEqual([]);
  });

  it('come again five days before if the bank alone will not cover the wages, with the verdict', () => {
    const { s, ctx } = center(500, DAYS_PER_MONTH - 5);
    s.ledger.treatment = 2500;
    warnPayday(ctx);
    expect(toasts(ctx.events)).toEqual([
      "Payday in 5 days: $3,000 in wages, and $500 in the bank, with about $500 more coming at this month's pace. Payday is covered by borrowing: $2,000 short at this month's pace, so the loan will stand at $5,000.",
    ]);
    // but not when the bank covers them
    ctx.events.length = 0;
    s.money = 3000;
    warnPayday(ctx);
    expect(toasts(ctx.events)).toEqual([]);
  });
});
