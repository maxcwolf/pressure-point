// Fixes from the October 2026 gameplay audit: pay by the day, an overdraft that costs and a bank that calls it in only
// from a center that is losing money, prices that stop at their limit,
// refunds in the right month's books, and a visit that cannot come not holding up the calendar.
import { describe, expect, it } from 'vitest';

import {
  DAYS_PER_MONTH,
  INSOLVENCY_DAYS,
  LOAN_RATE,
  LOAN_STEP,
  MODALITIES,
  MODALITY_ORDER,
  OVERDRAFT_RATE,
  PRICE_MAX,
  RED_MONTH_MORALE,
  RED_MORALE,
} from '../../src/core/data';
import { createContext } from '../../src/core/sim/context';
import {
  averagePrice,
  cashflow,
  daysInRed,
  daysUntilBankrupt,
  loanLimit,
  monthEnd,
  payIntoRed,
  projectedCashflow,
  recoup,
  spend,
  updateInsolvency,
  warnPayday,
} from '../../src/core/sim/economy';
import { updateEmergency } from '../../src/core/sim/emergencies';
import { campaignBlocker } from '../../src/core/sim/marketing';
import { saleDraw, updateRival } from '../../src/core/sim/rival';
import { reachSoul, retrieved } from '../../src/core/sim/souls';
import { fairPay, moraleTarget } from '../../src/core/sim/staffing';
import { hasMechanic } from '../../src/core/sim/upgrades';
import { updateVisits } from '../../src/core/sim/visits';
import { disciplineOn, unlockedUpTo } from '../../src/core/state/game';
import { hire, openCenter, run, toasts } from './helpers';

/** A center as `openCenter` makes it, with the context made as well. */
function bare2() {
  const center = openCenter(1);
  return { ...center, ctx: createContext(center.s) };
}

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
  /** The same, with a month of takings on the books that outrun the wages. */
  function earning(money: number) {
    const c = short(money);
    c.s.ledger.treatment = 6000;
    return c;
  }

  it('stops the game and asks to borrow what is missing, in loan steps, or to pay into the red', () => {
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

  it('pays the wages into the red when the loan is turned down, with the overdraft interest', () => {
    const { s, sim, ctx } = earning(500);
    monthEnd(ctx);
    expect(sim.payIntoRed()).toBe(true);
    expect(s.payrollDue).toBeNull();
    expect(s.loan).toBe(0);
    expect(s.lastLedger.salaries).toBe(3000);
    expect(s.money).toBe(500 - 3000 - Math.round(2500 * OVERDRAFT_RATE));
    expect(s.bankrupt).toBe(false);
    expect(s.insolvency).toBeNull();
  });

  it('says so, and offers no loan, when the bank will lend no more', () => {
    const { s, sim, ctx } = earning(500);
    s.loan = loanLimit(s);
    monthEnd(ctx);
    expect(s.payrollDue).toEqual({ wages: 3000, loan: 0 });
    expect(sim.takePayrollLoan()).toBe(false);
    expect(sim.payIntoRed()).toBe(true);
    expect(s.money).toBe(500 - 3000 - Math.round(s.loan * LOAN_RATE) - Math.round(2500 * OVERDRAFT_RATE));
    expect(s.bankrupt).toBe(false);
  });

  it('projects the books from the last month or so: takings against wages and interest, not building', () => {
    const { s } = short(500);
    // at the end of the first month, its takings are the pace
    s.day = DAYS_PER_MONTH - 0.001;
    s.ledger.treatment = 6000;
    s.ledger.building = 50_000;
    expect(cashflow(s)).toEqual({ income: 6000, wages: 3000, interest: 0, net: 3000 });
    // in the red, and with a loan, the interest counts against it
    s.money = -1000;
    s.loan = 10_000;
    const interest = Math.round(1000 * OVERDRAFT_RATE) + Math.round(10_000 * LOAN_RATE);
    expect(projectedCashflow(s)).toBe(6000 - 3000 - interest);
    // with a month on file, the two months are averaged over the days they cover
    s.money = 500;
    s.loan = 0;
    s.months = [{ ...s.tally, ledger: { ...s.ledger, treatment: 3000 }, reputation: 50, money: 0 }];
    s.lastLedger = { ...s.ledger, treatment: 3000 };
    s.day = DAYS_PER_MONTH + 15;
    expect(cashflow(s).income).toBe(Math.round((6000 + 3000) / 1.5));
    // and the first week of the first month is not taken for a month's pace
    s.months = [];
    s.day = 3;
    s.ledger.treatment = 600;
    expect(cashflow(s).income).toBe(600 / 0.25);
  });

  it('has the bank call the overdraft in when the wages go into the red with the books losing money', () => {
    const { s, sim, ctx } = short(500);
    s.loan = loanLimit(s);
    const events = ctx.events;
    events.length = 0;
    monthEnd(ctx);
    payIntoRed(ctx);
    expect(s.money).toBeLessThan(0);
    expect(s.insolvency).toEqual({ until: s.day + INSOLVENCY_DAYS });
    expect(daysUntilBankrupt(s)).toBe(INSOLVENCY_DAYS);
    expect(toasts(events).join()).toContain('calling the overdraft in');
    // the days start paused, so the warning is not missed
    expect(s.speed).toBe(0);
    // but no dialog stops the game: once played on, time passes
    const day = s.day;
    run(sim, 5);
    expect(s.day).toBeGreaterThan(day);
    expect(s.bankrupt).toBe(false);
  });

  it('does not call the overdraft in while the loan still to be had would clear the red', () => {
    const { s, ctx } = short(500);
    s.loan = loanLimit(s) - LOAN_STEP;
    const events = ctx.events;
    events.length = 0;
    monthEnd(ctx);
    payIntoRed(ctx);
    expect(s.money).toBeLessThan(0);
    expect(s.money + LOAN_STEP).toBeGreaterThan(0);
    expect(s.insolvency).toBeNull();
    expect(toasts(events).join()).toContain(`the bank will still lend $${LOAN_STEP.toLocaleString('en-US')}`);
  });

  it('is content with a center in the red whose books make money', () => {
    const { s, ctx } = earning(500);
    s.loan = loanLimit(s);
    const events = ctx.events;
    events.length = 0;
    monthEnd(ctx);
    payIntoRed(ctx);
    expect(s.money).toBeLessThan(0);
    expect(s.insolvency).toBeNull();
    expect(daysUntilBankrupt(s)).toBeNull();
    expect(toasts(events).join()).toContain('the bank is content for now');
  });

  it('lets the center off as soon as the bank is back above zero, or the books in profit', () => {
    const { s, sim, ctx } = short(500);
    s.loan = loanLimit(s);
    monthEnd(ctx);
    sim.payIntoRed();
    expect(s.insolvency).not.toBeNull();
    s.money = 100;
    updateInsolvency(ctx);
    expect(s.insolvency).toBeNull();
    expect(s.bankrupt).toBe(false);
    // or, still in the red, with the books in profit
    s.money = -2000;
    s.insolvency = { until: s.day + 2 };
    s.ledger.treatment = 5000;
    updateInsolvency(ctx);
    expect(s.insolvency).toBeNull();
    expect(s.bankrupt).toBe(false);
  });

  it('loses the game when the days run out with the center still in the red and losing money', () => {
    const { s, sim, ctx } = short(500);
    s.loan = loanLimit(s);
    monthEnd(ctx);
    sim.payIntoRed();
    s.day += INSOLVENCY_DAYS - 0.5;
    updateInsolvency(ctx);
    expect(s.bankrupt).toBe(false);
    s.day += 1;
    updateInsolvency(ctx);
    expect(s.bankrupt).toBe(true);
    expect(s.insolvency).toBeNull();
  });

  it('is not enforced with bankruptcy switched off: the bank just goes into the red', () => {
    const { s, ctx } = short(500);
    s.bankruptcyOn = false;
    s.loan = loanLimit(s);
    monthEnd(ctx);
    expect(s.payrollDue).toBeNull();
    expect(s.insolvency).toBeNull();
    expect(s.bankrupt).toBe(false);
    expect(s.money).toBeLessThan(0);
    expect(s.lastLedger.salaries).toBe(3000);
  });

  it('pays as usual when the bank covers the wages', () => {
    const { s, ctx } = short(3000);
    monthEnd(ctx);
    expect(s.payrollDue).toBeNull();
    expect(s.money).toBe(0);
  });

  it('is warned five days before, with what the bank will do, and not when the wages are covered', () => {
    const { s, ctx } = short(500);
    s.day = DAYS_PER_MONTH - 5;
    const events = ctx.events;
    events.length = 0;
    warnPayday(ctx);
    expect(toasts(events).join()).toContain('Payday in 5 days: $3,000 in wages, and $500 in the bank.');
    expect(toasts(events).join()).toContain('The bank will lend the rest');
    expect(toasts(events).join()).toContain('it calls the overdraft in');
    // with the loan used up and the books in profit, the red would clear
    s.loan = loanLimit(s);
    s.ledger.treatment = 5000;
    events.length = 0;
    warnPayday(ctx);
    expect(toasts(events).join()).toContain('The bank will lend no more');
    expect(toasts(events).join()).toContain('so the red would clear');
    s.money = 100_000;
    events.length = 0;
    warnPayday(ctx);
    expect(toasts(events)).toEqual([]);
  });

  it('keeps track of how long the bank has been in the red, and the staff worry more the longer it is', () => {
    const { s, ctx, st } = short(500);
    const before = moraleTarget(ctx, st);
    s.money = -100;
    updateInsolvency(ctx);
    expect(daysInRed(s)).toBe(0);
    expect(moraleTarget(ctx, st)).toBe(before - RED_MORALE);
    s.day += DAYS_PER_MONTH;
    updateInsolvency(ctx);
    expect(daysInRed(s)).toBe(DAYS_PER_MONTH);
    expect(moraleTarget(ctx, st)).toBe(before - RED_MONTH_MORALE);
    // back above zero, the worry goes
    s.money = 100;
    updateInsolvency(ctx);
    expect(daysInRed(s)).toBeNull();
    expect(moraleTarget(ctx, st)).toBe(before);
    // and with bankruptcy off, the red worries nobody
    s.money = -100;
    s.bankruptcyOn = false;
    updateInsolvency(ctx);
    expect(moraleTarget(ctx, st)).toBe(before);
  });

  it('has the staff ask for a raise to stay after a month in the red, however fair their pay', () => {
    const { s, sim, st } = short(500);
    st.state = 'idle';
    st.salary = fairPay(st);
    st.morale = 40;
    s.money = -100;
    s.redSince = s.day - DAYS_PER_MONTH;
    sim.drain();
    run(sim, 1);
    expect(st.raiseAsked).toBe(true);
    expect(toasts(sim.drain()).join()).toContain('wants a raise to');
  });

  it('stops time for good once bankrupt', () => {
    const { s, sim, ctx } = short(500);
    s.loan = loanLimit(s);
    monthEnd(ctx);
    sim.payIntoRed();
    s.day = s.insolvency!.until;
    updateInsolvency(ctx);
    expect(s.bankrupt).toBe(true);
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

describe('prices set to nonsense', () => {
  it('are ignored, rather than turning every fee into NaN', () => {
    const { sim, s } = openCenter(1);
    sim.setPrice(1.3);
    sim.setPrice(Number.NaN);
    expect(s.priceLevel).toBe(1.3);
    sim.setTechniquePrice('swedish', Number.NaN);
    expect(s.prices).toEqual({});
  });

  it('and a campaign for part of a month or no number of months is refused', () => {
    const { s } = openCenter(1);
    expect(campaignBlocker(s, 'word', 1.5)).not.toBe('');
    expect(campaignBlocker(s, 'word', Number.NaN)).not.toBe('');
    expect(campaignBlocker(s, 'word', 1)).toBe('');
  });
});

describe('the rival’s sale', () => {
  it('draws on what the techniques on offer cost, not on the overall level alone', () => {
    const { sim, s } = openCenter(1);
    // half price overall, but every technique the player can see at double: treatments cost standard
    sim.setPrice(0.5);
    const offered = MODALITY_ORDER.filter(
      (m) => MODALITIES[m].star <= unlockedUpTo(s) && disciplineOn(s, MODALITIES[m].discipline),
    );
    expect(offered.length).toBeGreaterThan(0);
    expect(offered.length).toBeLessThan(MODALITY_ORDER.length);
    for (const m of offered) sim.setTechniquePrice(m, 2);
    expect(saleDraw(s.priceLevel)).toBe(0);
    expect(averagePrice(s)).toBeCloseTo(1);
    expect(saleDraw(averagePrice(s))).toBeGreaterThan(0);
  });

  it('leaves no job offer hanging when the rival is switched off', () => {
    const { s, ctx, therapist } = bare2();
    therapist.offer = s.day + 5;
    s.rivalOn = false;
    updateRival(ctx);
    expect(therapist.offer).toBe(0);
  });
});

describe('one thing to decide on at a time', () => {
  it('offers no emergency while a stress outbreak is on offer', () => {
    const { sim, s, ctx } = bare();
    s.stars = 1;
    s.nextEmergency = 0;
    s.open = true;
    expect(sim.offerOutbreak()).toBe(true);
    updateEmergency(ctx);
    expect(s.offer).toBeNull();
  });
});

describe('a Mechanic who is leaving', () => {
  it('no longer counts as one, so an upgrade cannot be paid for with nobody to install it', () => {
    const { sim, s } = bare();
    const caretaker = hire(sim, 'caretaker');
    caretaker.general.push('mechanics');
    expect(hasMechanic(s)).toBe(true);
    sim.fire(caretaker.id);
    expect(hasMechanic(s)).toBe(false);
  });
});

describe('a soul retrieval', () => {
  it('is called off when the one asked for has cheered up since', () => {
    const { sim, s, ctx } = bare();
    const shaman = hire(sim, 'shaman');
    const therapist = hire(sim, 'therapist');
    therapist.morale = 20;
    therapist.soulAsked = true;
    shaman.job = { kind: 'soul', id: therapist.id };
    therapist.morale = 90;
    expect(reachSoul(ctx, shaman)).toBe(false);
    expect(therapist.soulAsked).toBe(false);
    expect(s.staff).toContain(therapist);
  });

  it('ends the unhappiness that had them on the way out', () => {
    const { sim, ctx } = bare();
    const shaman = hire(sim, 'shaman');
    const therapist = hire(sim, 'therapist');
    therapist.unhappyT = 100;
    retrieved(ctx, shaman, therapist);
    expect(therapist.unhappyT).toBe(0);
  });
});
