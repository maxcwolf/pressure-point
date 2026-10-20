// Fixes from the October 2026 gameplay audit: pay by the day, an overdraft that costs, prices that stop at their limit,
// refunds in the right month's books, and a visit that cannot come not holding up the calendar.
import { describe, expect, it } from 'vitest';

import { DAYS_PER_MONTH, LOAN_RATE, LOAN_STEP, OVERDRAFT_RATE, PRICE_MAX } from '../../src/core/data';
import { createContext } from '../../src/core/sim/context';
import { loanLimit, monthEnd, recoup, spend, warnPayday } from '../../src/core/sim/economy';
import { updateVisits } from '../../src/core/sim/visits';
import { hire, openCenter, run, toasts } from './helpers';

/** A center with nobody on the payroll and no loan, so only what a test adds shows in the books. */
function bare() {
  const center = openCenter(1);
  const ctx = createContext(center.s);
  center.s.staff = [];
  center.s.loan = 0;
  return { ...center, ctx };
}

describe('pay by the day', () => {
  it('pays a new hire for the days since they joined, not a whole month', () => {
    const { s, sim, ctx } = bare();
    s.day = 25;
    const st = hire(sim, 'therapist');
    st.salary = 3000;
    s.money = 50_000;
    s.day = DAYS_PER_MONTH;
    monthEnd(ctx);
    // 5 days of 30
    expect(s.lastLedger.salaries).toBe(500);
    expect(st.paidTo).toBe(s.day);
  });

  it('pays a full month to someone who was there all of it, month after month', () => {
    const { s, sim, ctx } = bare();
    const st = hire(sim, 'therapist');
    st.salary = 3000;
    s.day = DAYS_PER_MONTH + 0.02;
    monthEnd(ctx);
    expect(s.lastLedger.salaries).toBe(3000);
    s.day = DAYS_PER_MONTH * 2 - 0.01;
    monthEnd(ctx);
    expect(s.lastLedger.salaries).toBe(3000);
  });

  it('pays someone let go for the days they worked, and nothing more at payday', () => {
    const { s, sim, ctx } = bare();
    const st = hire(sim, 'therapist');
    st.salary = 3000;
    s.money = 50_000;
    s.day = 15;
    sim.fire(st.id);
    expect(s.ledger.salaries).toBe(1500);
    expect(s.money).toBe(48_500);
    // they are still walking out at payday, and are not paid twice
    s.day = 30;
    monthEnd(ctx);
    expect(s.lastLedger.salaries).toBe(1500);
  });
});

describe('an overdraft', () => {
  it('costs interest every month', () => {
    const { s, ctx } = bare();
    s.money = -10_000;
    monthEnd(ctx);
    expect(s.lastLedger.interest).toBe(Math.round(10_000 * OVERDRAFT_RATE));
  });

  it('costs nothing in the black', () => {
    const { s, ctx } = bare();
    s.money = 10_000;
    monthEnd(ctx);
    expect(s.lastLedger.interest).toBe(0);
  });
});

describe('a payday the bank cannot cover', () => {
  /** A center with one therapist owed a full month at $3,000, and this much in the bank. */
  function short(money: number) {
    const c = bare();
    const st = hire(c.sim, 'therapist');
    st.salary = 3000;
    c.s.day = DAYS_PER_MONTH;
    c.s.money = money;
    return { ...c, st };
  }

  it('stops the game and asks to borrow what is missing, in loan steps', () => {
    const { s, sim, ctx } = short(500);
    monthEnd(ctx);
    expect(s.payrollDue).toEqual({ wages: 3000, loan: LOAN_STEP });
    expect(s.bankrupt).toBe(false);
    // nothing is paid, and no time passes, until it is answered
    expect(s.money).toBe(500);
    const day = s.day;
    run(sim, 5);
    expect(s.day).toBe(day);
  });

  it('pays the wages and carries on when the loan is taken', () => {
    const { s, sim, ctx } = short(500);
    monthEnd(ctx);
    expect(sim.takePayrollLoan()).toBe(true);
    expect(s.payrollDue).toBeNull();
    expect(s.loan).toBe(LOAN_STEP);
    // and the month's interest on the new loan comes out of what is left
    expect(s.money).toBe(500 + LOAN_STEP - 3000 - Math.round(LOAN_STEP * LOAN_RATE));
    expect(s.lastLedger.salaries).toBe(3000);
    expect(s.bankrupt).toBe(false);
  });

  it('loses the game when the loan is refused', () => {
    const { s, sim, ctx } = short(500);
    monthEnd(ctx);
    expect(sim.refusePayrollLoan()).toBe(true);
    expect(s.bankrupt).toBe(true);
    expect(s.payrollDue).toBeNull();
  });

  it('loses the game at once when the bank would not lend enough', () => {
    const { s, ctx } = short(500);
    s.loan = loanLimit(s);
    monthEnd(ctx);
    expect(s.bankrupt).toBe(true);
    expect(s.payrollDue).toBeNull();
  });

  it('pays as usual when the bank covers the wages', () => {
    const { s, ctx } = short(3000);
    monthEnd(ctx);
    expect(s.payrollDue).toBeNull();
    expect(s.money).toBe(0);
  });

  it('is warned of five days before, and not when the wages are covered', () => {
    const { s, ctx } = short(500);
    s.day = DAYS_PER_MONTH - 5;
    const events = ctx.events;
    events.length = 0;
    warnPayday(ctx);
    expect(toasts(events).join()).toContain('Payday in 5 days');
    s.money = 100_000;
    events.length = 0;
    warnPayday(ctx);
    expect(toasts(events)).toEqual([]);
  });

  it('stops time for good once bankrupt', () => {
    const { s, sim, ctx } = short(500);
    monthEnd(ctx);
    sim.refusePayrollLoan();
    const day = s.day;
    run(sim, 5);
    expect(s.day).toBe(day);
  });
});

describe('prices', () => {
  it('stop at the limit however the overall level and a technique stack', () => {
    const { sim } = openCenter(1);
    sim.setPrice(PRICE_MAX);
    sim.setTechniquePrice('swedish', PRICE_MAX);
    expect(sim.priceFor('swedish')).toBe(PRICE_MAX);
  });
});

describe('a refund', () => {
  it('comes off this month’s costs when they were paid this month', () => {
    const { s, ctx } = bare();
    spend(ctx, 1500, 'training');
    recoup(ctx, 1500, 'training');
    expect(s.ledger.training).toBe(0);
    expect(s.ledger.bonus).toBe(0);
  });

  it('comes in as income, not a cost below zero, when it was paid in a month already closed', () => {
    const { s, ctx } = bare();
    spend(ctx, 1500, 'training');
    s.ledger = { ...s.ledger, training: 0 };
    recoup(ctx, 1500, 'training');
    expect(s.ledger.training).toBe(0);
    expect(s.ledger.bonus).toBe(1500);
  });
});

describe('a visitor who cannot get in', () => {
  it('is given up on after a few days, and the next visit is put off', () => {
    const { s, ctx } = bare();
    // no finished rooms, so there is nothing to show anyone
    for (const r of s.rooms) r.done = false;
    s.visitsOn = true;
    s.open = true;
    s.day = 100;
    s.nextInspection = 1e9;
    s.visitNotice = { visit: 'vip', name: 'Pat', title: 'a critic', cares: 'decor', arrives: 100 };
    updateVisits(ctx);
    expect(s.visitNotice).not.toBeNull();
    s.day = 104;
    updateVisits(ctx);
    expect(s.visitNotice).toBeNull();
    expect(s.nextVip).toBeGreaterThan(104);
  });
});
