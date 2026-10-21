// Advice that can be followed: growth weighed against the payroll, the overdraft countdown naming the lever that works
// in time and who, a breakdown in hand that stops sticking, and no "borrow it" while the books lose money.
import { describe, expect, it } from 'vitest';

import { DAYS_PER_MONTH, INSOLVENCY_DAYS, LOAN_STEP } from '../../src/core/data';
import { an } from '../../src/core/format';
import { advice, bottleneckAdvice, newSalary } from '../../src/core/sim/advisor';
import type { SimContext } from '../../src/core/sim/context';
import {
  cashflow,
  letGoLine,
  loanLimit,
  monthEnd,
  payIntoRed,
  spareHand,
  updateInsolvency,
} from '../../src/core/sim/economy';
import { monthSoFar } from '../../src/core/sim/records';
import type { Item } from '../../src/core/state/types';
import { addStaffRoom, hire, openCenter, runUntil, toasts } from './helpers';

/** The game's own context, for calling the simulation directly. */
const ctxOf = (c: { sim: unknown }) => (c.sim as { ctx: SimContext }).ctx;

/** A center ten days into its first month, with this much taken so far and this much in the bank. */
function center(taken: number, money = 100_000) {
  const c = openCenter(1);
  const ctx = ctxOf(c);
  c.s.day = 10;
  c.s.ledger.treatment = taken;
  c.s.money = money;
  for (const st of c.s.staff) st.paidTo = 0;
  return { ...c, ctx };
}

/** Four guests waiting at the massage table, which stood staffed and busy as given over the last few days. */
function line(c: ReturnType<typeof center>, staffed: number, busy: number): Item {
  runUntil(c.sim, () => c.s.guests.length > 0, 300);
  c.s.day = 10;
  const table = c.s.items.find((i) => i.type === 'massage_table')!;
  const g = c.s.guests[0]!;
  table.serving = 0;
  table.queue = [];
  for (let i = 0; i < 4; i++) {
    c.s.guests.push({ ...g, id: 9100 + i, station: table.id, state: 'waiting', goal: 'treat' });
    table.queue.push(9100 + i);
  }
  table.staffed = staffed;
  table.busy = busy;
  // the therapist there today, whatever the last few days were
  c.therapist.state = 'atPost';
  return table;
}

describe('the bottleneck advice', () => {
  it('asks for the hire when the books carry the new wage', () => {
    const c = center(60_000);
    line(c, 0.4, 0.3);
    // nobody to work the table
    c.therapist.state = 'leaving';
    expect(bottleneckAdvice(c.ctx)?.text).toMatch(/There are more of them than Massage Therapists: hire another\.$/);
  });

  it('keeps the diagnosis and names prices when the books cannot carry another wage', () => {
    const c = center(0);
    line(c, 0.4, 0.3);
    c.therapist.state = 'leaving';
    const short = newSalary(c.s, 'therapist') - cashflow(c.s).net;
    expect(short).toBeGreaterThan(0);
    const text = bottleneckAdvice(c.ctx)?.text ?? '';
    expect(text).toMatch(
      /^Guests wait longest for the Massage Suite: 4 waiting for one Massage Table\. It stood empty 60%/,
    );
    expect(text).toMatch(
      new RegExp(
        `There are more of them than Massage Therapists\\. Another Massage Therapist would put the books \\$${short.toLocaleString('en-US')} a month in the red: raise prices, or wait for the pace to grow\\.$`,
      ),
    );
    expect(text).not.toMatch(/hire another/);
  });

  it('names a Staff Room, not another wage, when there are enough staff but breaks keep them away', () => {
    const c = center(60_000);
    line(c, 0.4, 0.3);
    expect(bottleneckAdvice(c.ctx)?.text).toMatch(
      /Its Massage Therapist keeps being called away to breaks or other work\. Build a Staff Room nearby, so their breaks are shorter\.$/,
    );
    addStaffRoom(c.sim);
    expect(bottleneckAdvice(c.ctx)?.text).toMatch(/A Staff Room nearer by would keep it going\.$/);
  });

  it('asks for nobody while a new hire is on the way, or one is out on a course or a house call', () => {
    const c = center(60_000);
    line(c, 0.4, 0.3);
    c.therapist.state = 'arriving';
    expect(bottleneckAdvice(c.ctx)?.text).toMatch(
      /A new Massage Therapist is on the way, and will take it on when they arrive\.$/,
    );
    c.therapist.state = 'away';
    c.therapist.call = { client: 'a hotel', days: 3, back: c.s.day + 2 } as never;
    expect(bottleneckAdvice(c.ctx)?.text).toMatch(
      /A Massage Therapist is away on a course or a house call, and it will be staffed again when they are back\.$/,
    );
  });

  it('weighs a new table and its practitioner against the bank, and says to save up when they are not in it', () => {
    const c = center(60_000);
    line(c, 0.95, 0.9);
    expect(bottleneckAdvice(c.ctx)?.text).toMatch(/Another Massage Table and a Massage Therapist to work it/);
    c.s.money = 3000;
    // the books are in profit, but the bank pays for the room
    c.s.ledger.treatment = 200_000;
    const text = bottleneckAdvice(c.ctx)?.text ?? '';
    expect(text).toMatch(/comes to \$[\d,]+, and the bank has \$3,000: save up for it first\.$/);
    expect(text).not.toMatch(/to work it would move them along/);
  });

  it('prices the hire at the cheapest applicant, or the standard pay with none', () => {
    const c = center(0);
    const asks = c.s.candidates.filter((x) => x.role === 'therapist').map((x) => x.salary);
    if (asks.length) expect(newSalary(c.s, 'therapist')).toBe(Math.min(...asks));
    c.s.candidates = c.s.candidates.filter((x) => x.role !== 'therapist');
    expect(newSalary(c.s, 'therapist')).toBe(1400);
  });

  it('is not given while the bank calls the overdraft in, or payday is not covered', () => {
    const c = center(60_000);
    line(c, 0.4, 0.3);
    expect(bottleneckAdvice(c.ctx)).not.toBeNull();
    c.s.insolvency = { until: c.s.day + INSOLVENCY_DAYS };
    expect(bottleneckAdvice(c.ctx)).toBeNull();
    c.s.insolvency = null;
    // nothing in the bank and nothing coming in: payday is short, and the advisor puts the money first
    c.s.money = 0;
    c.s.ledger.treatment = 0;
    c.s.loan = loanLimit(c.s);
    expect(bottleneckAdvice(c.ctx)).toBeNull();
    // with no line or comfort to speak of first, the payday is what the advisor says
    const quiet = center(0, 0);
    quiet.s.loan = loanLimit(quiet.s);
    // in the first month the pace is a few days' takings, so it names no cut yet
    expect(advice(quiet.ctx)).toMatch(
      /^Payday in \d+ days is \$[\d,]+ short, past what the bank will lend\. No new staff or rooms until the takings cover the wages\.$/,
    );
    // with a month behind it, the books losing money: the cut first
    quiet.s.months.push({ ...monthSoFar(quiet.ctx), ledger: { ...quiet.s.ledger } });
    expect(advice(quiet.ctx)).toMatch(
      /^Payday in \d+ days is \$[\d,]+ short, past what the bank will lend\. No new staff or rooms until the takings cover the wages\. The books are losing \$[\d,]+ a month\. Prices up or staff down first: /,
    );
    quiet.s.loan = 0;
    expect(advice(quiet.ctx)).toMatch(
      /^Payday in \d+ days is covered only by borrowing, \$[\d,]+ short at this pace\./,
    );
  });
});

describe('who to let go', () => {
  it('is the one whose station was busy least, in a role with two, with their wage and the books after', () => {
    const c = center(0);
    const table = c.s.items.find((i) => i.type === 'massage_table')!;
    const other = { ...table, id: 9999, busy: 0.9 };
    c.s.items.push(other);
    const second = hire(c.sim, 'therapist');
    c.therapist.post = table.id;
    table.busy = 0.31;
    second.post = other.id;
    c.therapist.salary = 2400;
    const net = cashflow(c.s).net;
    expect(spareHand(c.s)?.staff).toBe(c.therapist);
    const after = net + 2400;
    expect(letGoLine(c.s)).toBe(
      `Letting ${c.therapist.name} go ($2,400 a month, their Massage Table busy 31% of the time) ${
        after >= 0
          ? `puts the books $${after.toLocaleString('en-US')} a month in profit`
          : `cuts the loss to $${(-after).toLocaleString('en-US')} a month`
      }.`,
    );
    // nobody in a role with two: nobody named
    c.s.staff = c.s.staff.filter((st) => st !== second);
    expect(spareHand(c.s)).toBeUndefined();
    expect(letGoLine(c.s)).toBeNull();
  });
});

describe('the overdraft countdown', () => {
  it('says a price rise barely moves the pace in the days left, and names who to let go', () => {
    const c = center(0, -8000);
    c.s.loan = loanLimit(c.s);
    c.s.insolvency = { until: c.s.day + INSOLVENCY_DAYS };
    const second = hire(c.sim, 'therapist');
    c.therapist.post = c.s.items.find((i) => i.type === 'massage_table')!.id;
    second.post = 0;
    const text = advice(c.ctx);
    expect(text).toMatch(/^The bank calls the overdraft in in 10 days: /);
    expect(text).toContain(
      'A price rise helps the months ahead, but the bank judges the takings over the last month or so, so it barely moves them in 10 days; a wage comes off at once.',
    );
    expect(text).toContain(
      `Letting ${second.name} go ($${second.salary.toLocaleString('en-US')} a month, with no station of their own)`,
    );
    expect(text).not.toContain('prices up, or staff down');
  });

  it('says so when nobody is spare, and names the other way out', () => {
    const c = center(0, -8000);
    c.s.loan = loanLimit(c.s);
    c.s.insolvency = { until: c.s.day + INSOLVENCY_DAYS };
    expect(advice(c.ctx)).toContain(
      'No role has two to let one go from, so the way out is the bank above zero: sell something, or earn it.',
    );
  });

  it('is in the bank calling the overdraft in, and in its halfway reminder', () => {
    const c = center(0, 500);
    hire(c.sim, 'therapist');
    c.s.loan = loanLimit(c.s);
    c.s.day = DAYS_PER_MONTH;
    c.ctx.events.length = 0;
    monthEnd(c.ctx);
    payIntoRed(c.ctx);
    const called = toasts(c.ctx.events).find((t) => t.includes('The bank is calling the overdraft in'));
    expect(called).toContain('barely moves them in 10 days');
    expect(called).toMatch(/Letting .+ go \(\$/);
    expect(called).not.toContain('(prices up, or staff down)');
    c.ctx.events.length = 0;
    c.s.day = c.s.insolvency!.until - Math.floor(INSOLVENCY_DAYS / 2);
    updateInsolvency(c.ctx);
    const half = toasts(c.ctx.events).find((t) => t.includes('days before the bank calls the overdraft in'));
    expect(half).toContain('barely moves them in 5 days');
    expect(half).toMatch(/Letting .+ go \(\$/);
  });
});

describe('a breakdown', () => {
  it('reads "An" before a vowel', () => {
    expect(an('Air Conditioner', true)).toBe('An Air Conditioner');
    expect(an('Massage Table')).toBe('a Massage Table');
  });

  it('asks for a Caretaker with none on the payroll', () => {
    const c = center(60_000);
    const table = c.s.items.find((i) => i.type === 'massage_table')!;
    table.wear = 100;
    expect(advice(c.ctx)).toBe('A Massage Table has broken down. Hire a Caretaker to repair it.');
  });

  it('with a Caretaker, waits below the money advice, and goes unsaid while one is on it', () => {
    const c = center(60_000);
    const caretaker = hire(c.sim, 'caretaker');
    const table = c.s.items.find((i) => i.type === 'massage_table')!;
    table.wear = 100;
    expect(advice(c.ctx)).toMatch(/^A Massage Table has broken down\. Your Caretaker will get to it/);
    // the red, with a loan to be had, comes first
    c.s.money = -2000;
    expect(advice(c.ctx)).toMatch(/^You are \$2,000 in the red/);
    c.s.money = 100_000;
    // the Caretaker on the way to it
    table.claimedBy = caretaker.id;
    caretaker.job = { kind: 'repair', id: table.id };
    expect(advice(c.ctx)).not.toMatch(/broken down/);
  });
});

describe('borrowing', () => {
  it('leads with the cut, not the loan, while the books lose money', () => {
    const c = center(0, -2000);
    const text = advice(c.ctx);
    expect(text).toMatch(
      /^You are \$2,000 in the red, which costs 5% a month and worries the staff, and you are losing about/,
    );
    expect(text).toContain('Prices up or staff down first: nobody is spare in a role with two, so prices up.');
    expect(text).toContain(
      'Then a loan from the Money menu is cheaper than the red for what is left, but it only buys time',
    );
    expect(text.indexOf('first')).toBeLessThan(text.indexOf('loan'));
  });

  it('says a loan is cheaper, as before, while the books make money', () => {
    const c = center(200_000, -2000);
    expect(advice(c.ctx)).toBe(
      'You are $2,000 in the red, which costs 5% a month and worries the staff. A loan from the Money menu is cheaper.',
    );
  });

  it('has the month-end toast cut first, then borrow what is left, while the books lose money', () => {
    const c = center(0, 500);
    c.s.loan = loanLimit(c.s) - LOAN_STEP * 2;
    c.s.day = DAYS_PER_MONTH;
    c.ctx.events.length = 0;
    monthEnd(c.ctx);
    payIntoRed(c.ctx);
    expect(c.s.insolvency).toBeNull();
    const red = toasts(c.ctx.events).find((t) => t.startsWith('⚠️ You are'))!;
    expect(red).not.toContain('borrow it from the Money menu');
    expect(red).toContain('Prices up or staff down first:');
    expect(red).toContain(
      `Then borrow what is left from the Money menu (the bank will still lend $${(LOAN_STEP * 2).toLocaleString('en-US')})`,
    );
    expect(red.indexOf('first')).toBeLessThan(red.indexOf('borrow'));
  });
});
