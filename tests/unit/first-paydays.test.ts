// The first paydays in sight: what opening a center costs on its card, a month's wages against the bank and the loan
// left in the Payroll tab, and the advisor against a hire, a course or a house call with less than a month in hand.
import { describe, expect, it } from 'vitest';

import { CENTERS, FIRST_PAYDAYS, LOAN_MAX, LOAN_STEP } from '../../src/core/data';
import { advice, inHandAdvice } from '../../src/core/sim/advisor';
import type { SimContext } from '../../src/core/sim/context';
import {
  inHandLine,
  loanLimit,
  openingCosts,
  openingLine,
  paydaysInHand,
  payrollOutlook,
  shortOfAMonth,
} from '../../src/core/sim/economy';
import { monthSoFar } from '../../src/core/sim/records';
import { inHandNote } from '../../src/ui/components/menus/PayrollTab';
import { campaignCards } from '../../src/ui/lib/campaign';
import { openCenter } from './helpers';

/** The game's own context, for calling the simulation directly. */
const ctxOf = (c: { sim: unknown }) => (c.sim as { ctx: SimContext }).ctx;

/** A center in its first month paying three staff $4,000 a month in all, with this in the bank and this borrowed. */
function center(money: number, loan: number) {
  const c = openCenter(1);
  for (const [i, st] of c.s.staff.entries()) st.salary = [1000, 1500, 1500][i] ?? 0;
  c.s.money = money;
  c.s.loan = loan;
  c.s.day = 10;
  return { ...c, ctx: ctxOf(c) };
}

/** File this many months as closed, each taking in this much. */
function closeMonths(c: ReturnType<typeof center>, n: number, taken = 0) {
  for (let i = 0; i < n; i++) {
    c.s.months.push({ ...monthSoFar(c.ctx), ledger: { ...c.s.ledger, treatment: taken } });
    c.s.lastLedger = { ...c.s.ledger, treatment: taken };
  }
}

describe('what opening a center costs, on its card', () => {
  it('counts every discipline open from the start at The Orchard Estate', () => {
    const o = openingCosts(CENTERS.orchard);
    // a Receptionist, a Wellness Consultant, and a Massage Therapist, Acupuncturist, Reiki Practitioner, Sound Healer
    // and Shaman, all Trainees: 800 + 1,700 + 1,400 + 1,600 + 1,700 + 1,650 + 1,900
    expect(o).toEqual({
      disciplines: 5,
      practitioner: 'Massage Therapist',
      wages: 10_750,
      rooms: 48_000,
      money: 45_000,
      loan: LOAN_MAX,
    });
    expect(openingLine(o)).toBe(
      "Opening with a Receptionist, a Wellness Consultant and a practitioner for each of its 5 disciplines costs $10,750 a month in wages at a Trainee's pay and $48,000 for their rooms, against $45,000 to start and up to $50,000 from the bank: $47,000 left for the furniture and every payday until the takings cover the wages.",
    );
  });

  it('names the one practitioner where massage is all a center opens with', () => {
    const o = openingCosts(CENTERS.willow);
    expect(o).toMatchObject({ disciplines: 1, wages: 3_900, rooms: 11_000 });
    expect(openingLine(o)).toMatch(
      /^Opening with a Receptionist, a Wellness Consultant and a Massage Therapist costs \$3,900 a month/,
    );
  });

  it('leaves out a discipline whose room opens only at a later star', () => {
    // High Pines opens sound healing at the first star, and the Shaman's lodge at the second
    expect(openingCosts(CENTERS.highpines).disciplines).toBe(1);
  });

  it('is on every campaign card, under the blurb', () => {
    const cards = campaignCards({});
    expect(cards.find((c) => c.id === 'orchard')?.opening).toBe(openingLine(openingCosts(CENTERS.orchard)));
    expect(cards.every((c) => c.opening.startsWith('Opening with'))).toBe(true);
  });
});

describe('a month of wages in hand', () => {
  it('weighs the wages a month against the bank and what the bank will still lend', () => {
    const c = center(2_000, LOAN_MAX - LOAN_STEP);
    const h = paydaysInHand(c.s);
    expect(h).toEqual({
      wages: 4_000,
      upkeep: 0,
      money: 2_000,
      loanRoom: LOAN_STEP,
      inHand: 7_000,
      months: 1.75,
      opening: true,
    });
    expect(shortOfAMonth(h)).toBe(false);
    expect(inHandLine(h)).toBe(
      '$4,000 a month in wages, against $2,000 in the bank and $5,000 the bank will still lend: one payday in hand, with nothing coming in.',
    );
  });

  it('is short with less than a month in hand, and says the red and a loan used up as they are', () => {
    const c = center(-500, LOAN_MAX);
    const h = paydaysInHand(c.s);
    expect(h).toMatchObject({ inHand: -500, months: 0 });
    expect(shortOfAMonth(h)).toBe(true);
    expect(inHandLine(h)).toBe(
      '$4,000 a month in wages, against the bank $500 in the red and the loan used up: less than one payday in hand, with nothing coming in.',
    );
  });

  it('is the opening only until the first paydays have closed their months, and short of a month after them too', () => {
    const c = center(1_000, LOAN_MAX);
    closeMonths(c, FIRST_PAYDAYS - 1);
    expect(paydaysInHand(c.s).opening).toBe(true);
    closeMonths(c, 1);
    expect(paydaysInHand(c.s).opening).toBe(false);
    expect(shortOfAMonth(paydaysInHand(c.s))).toBe(true);
  });

  it('counts nothing as short with nobody on the payroll', () => {
    const c = center(0, LOAN_MAX);
    c.s.staff = [];
    const h = paydaysInHand(c.s);
    expect(h.months).toBe(Infinity);
    expect(shortOfAMonth(h)).toBe(false);
  });

  it('says so in the Payroll tab: through the first paydays whatever is in hand, and later only when short', () => {
    const c = center(3_000, LOAN_MAX - LOAN_STEP);
    expect(inHandNote(paydaysInHand(c.s), 2)).toBe(
      'The first paydays: $4,000 a month in wages, against $3,000 in the bank and $5,000 the bank will still lend: 2 paydays in hand, with nothing coming in. 2 paydays come before the takings have a record, so what is hired, built or sent away before then is paid for out of this.',
    );
    c.s.money = 1_000;
    c.s.loan = LOAN_MAX;
    expect(inHandNote(paydaysInHand(c.s), 1)).toMatch(
      /less than one payday in hand, with nothing coming in\. One payday comes before the takings have a record, .* That is past what the paydays can carry: until there is a month in hand, hire nobody more, send nobody on a course and turn house calls down\.$/,
    );
    closeMonths(c, FIRST_PAYDAYS);
    expect(inHandNote(paydaysInHand(c.s), 0)).toBe(
      'In hand: $4,000 a month in wages, against $1,000 in the bank and the loan used up: less than one payday in hand, with nothing coming in. That is past what the paydays can carry: until there is a month in hand, hire nobody more, send nobody on a course and turn house calls down.',
    );
    c.s.money = 9_000;
    expect(inHandNote(paydaysInHand(c.s), 0)).toBe('');
  });
});

describe('the advisor with less than a month of wages in hand', () => {
  it('asks for no hire, course or house call, with the numbers and the first paydays still to come', () => {
    const c = center(1_500, LOAN_MAX - LOAN_STEP);
    // $6,500 in hand against $4,000 a month: carried, so it says nothing
    expect(inHandAdvice(c.ctx)).toBe('');
    // $1,500 taken in ten days brings $3,000 more by payday, so the loan covers the rest of it: the next payday alone
    // is no worry, but the one after is
    c.s.money = -1_200;
    c.s.ledger.treatment = 1_500;
    expect(payrollOutlook(c.s).covered).toBe('borrowing');
    expect(inHandAdvice(c.ctx)).toBe(
      "Hire nobody more, send nobody on a course and turn house calls down until there is a month's wages in hand, $200 more: $4,000 a month in wages, against the bank $1,200 in the red and $5,000 the bank will still lend: less than one payday in hand, with nothing coming in. Each adds a wage or leaves a station empty for days, and once the loan is used up a month that heals few guests has the bank call the overdraft in. 3 of the first paydays are still to come, before the takings have a record.",
    );
  });

  it("names last month's takings once a month is on file, and the last of the first paydays", () => {
    const c = center(500, LOAN_MAX);
    closeMonths(c, 2, 3_200);
    c.s.ledger.treatment = 4_000;
    expect(inHandAdvice(c.ctx)).toMatch(
      /^Hire nobody more, .* in hand, \$3,500 more: .* less than one payday in hand, with nothing coming in\. Last month took in \$3,200\. .* One of the first paydays is still to come, before the takings have a record\.$/,
    );
  });

  it('goes on past the first paydays while there is less than a month in hand', () => {
    const c = center(500, LOAN_MAX);
    closeMonths(c, FIRST_PAYDAYS, 3_200);
    c.s.ledger.treatment = 4_000;
    expect(inHandAdvice(c.ctx)).toMatch(/call the overdraft in\.$/);
    c.s.money = 4_500;
    expect(inHandAdvice(c.ctx)).toBe('');
  });

  it('leaves a payday short past what the bank lends to the payday nudge, which names the cut', () => {
    const c = center(500, LOAN_MAX);
    expect(payrollOutlook(c.s).covered).toBe('no');
    expect(inHandAdvice(c.ctx)).toBe('');
    expect(advice(c.ctx)).toMatch(/^Payday in 20 days is \$3,500 short, past what the bank will lend\./);
  });

  it('says nothing with bankruptcy off, or while the bank is calling the overdraft in', () => {
    const off = center(500, LOAN_MAX);
    off.s.ledger.treatment = 4_000;
    expect(inHandAdvice(off.ctx)).not.toBe('');
    off.s.bankruptcyOn = false;
    expect(inHandAdvice(off.ctx)).toBe('');
    const due = center(500, LOAN_MAX);
    due.s.ledger.treatment = 4_000;
    due.s.insolvency = { until: due.s.day + 5 };
    expect(inHandAdvice(due.ctx)).toBe('');
  });

  it('comes before the advice below it, which asks for growth', () => {
    const c = center(60_000, 0);
    // carried: the advisor goes on to the next thing
    expect(advice(c.ctx)).not.toMatch(/^Hire nobody more/);
    c.s.money = 500;
    c.s.loan = loanLimit(c.s);
    c.s.ledger.treatment = 4_000;
    expect(advice(c.ctx)).toMatch(/^Hire nobody more, send nobody on a course and turn house calls down /);
  });
});
