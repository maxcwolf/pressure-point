// The payroll outlook: where this month's books are headed, whether payday is covered, and the two warnings before it.
import { describe, expect, it } from 'vitest';

import { DAYS_PER_MONTH, LOAN_RATE, LOAN_STEP, PAYROLL_GRACE_DAYS } from '../../src/core/data';
import { createContext } from '../../src/core/sim/context';
import {
  daysUntilBankrupt,
  loanLimit,
  monthlyPayroll,
  payrollOutlook,
  payrollVerdict,
  projectedCashflow,
  projectedIncome,
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

describe("this month's pace", () => {
  it('scales the income so far to a whole month', () => {
    const { s } = center(0, 10);
    s.ledger.treatment = 1000;
    expect(projectedIncome(s)).toBe(3000);
    s.day = 15;
    expect(projectedIncome(s)).toBe(2000);
  });

  it('lets last month stand in for the first couple of days, where there was one', () => {
    const { s, ctx } = center(0, 0.5);
    s.ledger.treatment = 100;
    expect(projectedIncome(s)).toBe(3000);
    s.ledger.treatment = 0;
    s.months.push({ ...monthSoFar(ctx), ledger: { ...s.ledger, treatment: 9000 } });
    expect(projectedIncome(s)).toBe(9000);
    s.day = 2;
    expect(projectedIncome(s)).toBe(0);
  });

  it('is headed for the income at pace less wages, interest and the money already spent', () => {
    const { s } = center(0, 10);
    s.ledger.treatment = 1000;
    s.ledger.building = 400;
    s.loan = LOAN_STEP;
    const flow = projectedCashflow(s);
    expect(flow).toEqual({
      soFar: 1000,
      income: 3000,
      wages: 3000,
      interest: Math.round(LOAN_STEP * LOAN_RATE),
      spent: 400,
      net: 3000 - 3000 - Math.round(LOAN_STEP * LOAN_RATE) - 400,
    });
    expect(monthlyPayroll(s)).toBe(3000);
  });
});

describe('whether payday is covered', () => {
  it('by the bank and the pace together', () => {
    const { s } = center(1000, 10);
    s.ledger.treatment = 1000;
    const o = payrollOutlook(s);
    // $3,000 at pace over 30 days, two thirds of it still to come
    expect(o).toMatchObject({ wages: 3000, daysLeft: 20, money: 1000, coming: 2000, expected: 3000, short: 0 });
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

  it('or not at all, with what is left to borrow and the days to earn it', () => {
    const { s } = center(500, 10);
    s.loan = loanLimit(s);
    const o = payrollOutlook(s);
    expect(o).toMatchObject({ short: 2500, loanRoom: 0, covered: 'no' });
    expect(payrollVerdict(o)).toBe('Payday needs $2,500 more: sell, or earn it in 20 days, or the center is bankrupt.');
    s.loan = loanLimit(s) - LOAN_STEP;
    s.money = -4000;
    expect(payrollVerdict(payrollOutlook(s))).toBe(
      'Payday needs $7,000 more: borrow (the bank will lend $5,000 more), sell, or earn it in 20 days, or the center is bankrupt.',
    );
  });
});

describe('the days until the money runs out', () => {
  it('end at the first payday the bank will not carry, plus the grace days', () => {
    const { s } = center(500, 10);
    s.loan = loanLimit(s);
    expect(daysUntilBankrupt(s)).toBe(20 + PAYROLL_GRACE_DAYS);
    // one step of loan room carries one more payday, with nothing coming in
    s.loan = loanLimit(s) - LOAN_STEP;
    expect(daysUntilBankrupt(s)).toBe(20 + DAYS_PER_MONTH + PAYROLL_GRACE_DAYS);
  });

  it('never come while the pace pays the wages, with bankruptcy off, or with nobody on the payroll', () => {
    const { s } = center(500, 10);
    s.ledger.treatment = 2000;
    expect(daysUntilBankrupt(s)).toBeNull();
    s.ledger.treatment = 0;
    s.bankruptcyOn = false;
    expect(daysUntilBankrupt(s)).toBeNull();
    s.bankruptcyOn = true;
    s.staff = [];
    expect(daysUntilBankrupt(s)).toBeNull();
    expect(runwayNote(null)).toBe('At this pace the money does not run out in the next year.');
    expect(runwayNote(22.4)).toBe('At this pace the money runs out in 23 days, grace days included.');
  });
});

describe('the warnings before payday', () => {
  it('come as soon as the pace first says payday is not covered, once a month, with the numbers', () => {
    const { s, ctx } = center(500, 10);
    warnPayday(ctx);
    expect(toasts(ctx.events)).toEqual([
      "⚠️ Payday in 20 days: $3,000 in wages against $500 in the bank and about $0 more at this month's pace. Payday is covered by borrowing: $2,500 short at this month's pace, so the loan will stand at $5,000.",
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
      "⚠️ Payday in 5 days: $3,000 in wages, and $500 in the bank, with about $500 more coming at this month's pace. Payday is covered by borrowing: $2,000 short at this month's pace, so the loan will stand at $5,000.",
    ]);
    // but not when the bank covers them
    ctx.events.length = 0;
    s.money = 3000;
    warnPayday(ctx);
    expect(toasts(ctx.events)).toEqual([]);
  });
});
