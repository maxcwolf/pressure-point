// The balance report of `yarn balance:report`: the balance log's table, before → after, and the fairness slices,
// from a small hand-made pair of runs.
import { describe, expect, it } from 'vitest';

import type { IncomeBy } from '../balance/bot';
import {
  bankruptDay,
  cliffs,
  compareTable,
  figures,
  money,
  report,
  type Run,
  sideShare,
  spirals,
  summaryTable,
} from '../balance/report';

type Month = Run['months'][number];

/** Income of $1,000 a month: $800 from treatments and consultations, $200 from the side. */
const INCOME: IncomeBy = {
  treatment: 700,
  consult: 100,
  classes: 100,
  calls: 50,
  shop: 0,
  mushrooms: 0,
  vending: 50,
  bonus: 0,
};

/** A month with the figures the report reads, and quiet ones for the rest. */
function month(month: number, o: Partial<Month> = {}): Month {
  return {
    month,
    money: 10000,
    loan: 0,
    rep: 50,
    repLow: 50,
    stars: 0,
    grade: 0,
    staff: 3,
    rooms: 3,
    arrived: 20,
    turnedAway: 0,
    healed: 10,
    failed: 0,
    stormed: 0,
    worse: 0,
    priced: 0,
    income: 1000,
    spending: 500,
    wages: 400,
    avgWaitDays: 1,
    inside: 4,
    following: {},
    healedBy: {},
    price: 1,
    lab: false,
    scans: 0,
    incomeBy: INCOME,
    ...o,
  };
}

/** A run of so many months, with some of them changed. */
function run(seed: number, length: number, changed: Record<number, Partial<Month>>, o: Partial<Run> = {}): Run {
  return {
    center: 'willow',
    seed,
    openedDay: 0,
    starDays: [30, 300, null],
    months: Array.from({ length }, (_, i) => month(i + 1, changed[i + 1])),
    openGoals: [],
    notes: [],
    lowestMoney: 0,
    peakLoan: 0,
    goalDays: [],
    firstAdverse: null,
    adverse: [],
    warnings: [],
    bankruptDay: null,
    ...o,
  };
}

/**
 * Seed 1 survives 16 months, losing money in month 14 and falling from 50 to 25 in month 6 (a cliff), a month
 * after the rival opened. Seed 2 goes bankrupt on day 125, warned on day 120, after someone quit on day 40.
 */
const SURVIVOR = run(
  1,
  16,
  {
    6: { repLow: 25, rep: 30, worse: 4, stormed: 2, failed: 1 },
    7: { rep: 30, repLow: 10 },
    14: { income: 200, spending: 900 },
    16: { money: 22000, loan: 5000 },
  },
  { adverse: [{ what: 'rival opened', day: 140 }], firstAdverse: { what: 'rival opened', day: 140 } },
);
const BANKRUPT = run(
  2,
  4,
  {},
  {
    starDays: [45, null, null],
    adverse: [{ what: 'someone quit', day: 40 }],
    firstAdverse: { what: 'someone quit', day: 40 },
    warnings: [
      { day: 90, text: 'Payday in five days' },
      { day: 120, text: 'The bank calls the overdraft in' },
    ],
    bankruptDay: 125,
  },
);

describe('the balance report', () => {
  it('writes money in thousands with a true minus', () => {
    expect(money(17150)).toBe('$17.2k');
    expect(money(-400)).toBe('−$0.4k');
    expect(money(null)).toBe('–');
  });

  it('reads a run as the balance log does', () => {
    const f = figures(SURVIVOR);
    expect(f.stars).toBe('1.0/10.0/–');
    // months 13 to 16: three at +$500 and one at −$700
    expect(f.profit).toBe(200);
    expect(f.lossMonths).toBe(1);
    expect(f.lowestRep).toBe(10);
    expect(f.lowMonths).toBe(1);
    expect(f.bank).toBe(22000);
    expect(figures(BANKRUPT).stars).toBe('1.5/bankrupt day 125/–');
  });

  it('finds the day of bankruptcy in an older log by its note', () => {
    const { bankruptDay: _, ...old } = BANKRUPT;
    expect(bankruptDay({ ...old, notes: ['day 7: prices to 1.1', 'day 125: BANKRUPT, loan 30000'] })).toBe(125);
    expect(bankruptDay({ ...old, notes: [] })).toBeNull();
  });

  it('makes the table of a run, a center a row', () => {
    const t = summaryTable([SURVIVOR, BANKRUPT]);
    expect(t.split('\n')[2]).toBe(
      '| Willow Lane | 1.0/10.0/– · 1.5/bankrupt day 125/– | $0.2k | 0 to 1 | 10 to 50 | 0 to 1 | $10.0k to $22.0k | seed 2 day 125 |',
    );
  });

  it('compares two runs cell by cell, keeping what did not change', () => {
    const before = run(1, 16, {});
    const row = compareTable([SURVIVOR], [before]).split('\n')[2];
    expect(row).toContain('1.0/10.0/– (unchanged)');
    expect(row).toContain('$0.5k → $0.2k');
    expect(row).toContain('0 → 1');
    expect(row).toContain('none (unchanged)');
  });

  it('finds a fall of twenty points within a month, from the month before to the lowest seen', () => {
    expect(cliffs(SURVIVOR)).toEqual([
      { center: 'willow', seed: 1, month: 6, from: 50, to: 25, worse: 4, stormed: 2, failed: 1 },
      { center: 'willow', seed: 1, month: 7, from: 30, to: 10, worse: 0, stormed: 0, failed: 0 },
    ]);
    expect(cliffs(BANKRUPT)).toEqual([]);
  });

  it('weighs cliffs after adverse events against cliffs after any month', () => {
    const s = spirals([SURVIVOR, BANKRUPT]);
    // the rival opened in month 5, and months 5 to 7 have cliffs; the quit, in month 2 of a 4-month run, has none
    expect(s.kinds).toEqual([
      { what: 'rival opened', events: 1, followed: 1 },
      { what: 'someone quit', events: 1, followed: 0 },
    ]);
    expect(s.all).toMatchObject({ events: 2, followed: 1 });
    // windows from month 2: 13 in the survivor (4, 5, 6 and 7 reach a cliff), 1 in the bankrupt run
    expect(s.base).toEqual({ months: 14, followed: 4 });
  });

  it('gives the side incomes as a share of income', () => {
    expect(sideShare(SURVIVOR, 12)).toBe(0.2);
    expect(sideShare(SURVIVOR, 48)).toBeNull();
    // a game that stopped just short of closing month 17 stands in with month 16
    expect(sideShare(SURVIVOR, 17)).toBe(0.2);
  });

  it('prints survival, the last warning before a loss, and flags a loss without one', () => {
    const r = report([SURVIVOR, BANKRUPT]);
    expect(r).toContain('| Willow Lane | 1 | survived | rival opened, day 140 | – | – |');
    expect(r).toContain(
      '| Willow Lane | 2 | **bankrupt day 125** | someone quit, day 40 | 85 | 5 days before: “The bank calls the overdraft in” (1 in the last 30 days) |',
    );
    const unwarned = report([{ ...BANKRUPT, warnings: [{ day: 90, text: 'Payday in five days' }] }]);
    expect(unwarned).toContain('35 days before: “Payday in five days” ⚠ none in the last 10 days');
    expect(report([{ ...BANKRUPT, warnings: [] }])).toContain('**none** ⚠');
    // the news of the bankruptcy on its own day is not a warning of it
    expect(report([{ ...BANKRUPT, warnings: [{ day: 125, text: 'Bankrupt' }] }])).toContain('**none** ⚠');
    expect(r).toContain('| Willow Lane | 2 | 1 of 2 |');
    expect(r).toContain('| Willow Lane | 20% · – | – · – | – · – |');
  });
});
