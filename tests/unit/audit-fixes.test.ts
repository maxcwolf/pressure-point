// Fixes from the October 2026 gameplay audit: pay by the day, an overdraft that costs, prices that stop at their limit,
// refunds in the right month's books, and a visit that cannot come not holding up the calendar.
import { describe, expect, it } from 'vitest';

import {
  DAYS_PER_MONTH,
  LOAN_RATE,
  LOAN_STEP,
  MODALITIES,
  MODALITY_ORDER,
  OVERDRAFT_RATE,
  PAYROLL_GRACE_DAYS,
  PRICE_MAX,
} from '../../src/core/data';
import { createContext } from '../../src/core/sim/context';
import {
  averagePrice,
  loanLimit,
  monthEnd,
  recoup,
  spend,
  updatePayroll,
  warnPayday,
} from '../../src/core/sim/economy';
import { updateEmergency } from '../../src/core/sim/emergencies';
import { campaignBlocker } from '../../src/core/sim/marketing';
import { saleDraw, updateRival } from '../../src/core/sim/rival';
import { reachSoul, retrieved } from '../../src/core/sim/souls';
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

  it('stops the game and asks to borrow what is missing, in loan steps', () => {
    const { s, sim, ctx } = short(500);
    monthEnd(ctx);
    expect(s.payrollDue).toEqual({ wages: 3000, loan: LOAN_STEP, until: null });
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

  it('gives a few days to find the money when the bank would not lend enough, and the game goes on', () => {
    const { s, sim, ctx } = short(500);
    s.loan = loanLimit(s);
    monthEnd(ctx);
    expect(s.payrollDue).toEqual({ wages: 3000, loan: 0, until: s.day + PAYROLL_GRACE_DAYS });
    expect(s.bankrupt).toBe(false);
    // no dialog stops the game: time passes
    const day = s.day;
    run(sim, 5);
    expect(s.day).toBeGreaterThan(day);
  });

  it('pays the wages as soon as the money is found within those days', () => {
    const { s, ctx } = short(500);
    s.loan = loanLimit(s);
    monthEnd(ctx);
    s.money = 4000;
    expect(updatePayroll(ctx)).toBe(true);
    expect(s.payrollDue).toBeNull();
    expect(s.money).toBe(1000 - Math.round(s.loan * LOAN_RATE));
    expect(s.lastLedger.salaries).toBe(3000);
  });

  it('turns into a loan to accept if the bank would lend it after all', () => {
    const { s, ctx } = short(500);
    s.loan = loanLimit(s);
    monthEnd(ctx);
    s.loan = 0;
    expect(updatePayroll(ctx)).toBe(false);
    expect(s.payrollDue).toEqual({ wages: 3000, loan: LOAN_STEP, until: null });
  });

  it('loses the game when the days run out', () => {
    const { s, ctx } = short(500);
    s.loan = loanLimit(s);
    monthEnd(ctx);
    s.day += PAYROLL_GRACE_DAYS - 0.5;
    updatePayroll(ctx);
    expect(s.bankrupt).toBe(false);
    s.day += 1;
    updatePayroll(ctx);
    expect(s.bankrupt).toBe(true);
    expect(s.payrollDue).toBeNull();
  });

  it('is not enforced with bankruptcy switched off: the bank just goes into the red', () => {
    const { s, ctx } = short(500);
    s.bankruptcyOn = false;
    s.loan = loanLimit(s);
    monthEnd(ctx);
    expect(s.payrollDue).toBeNull();
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
