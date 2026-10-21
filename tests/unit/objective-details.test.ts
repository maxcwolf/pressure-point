// The numbers behind each objective: what counts this month and last, the sample a monthly goal needs, and the gap.
import { describe, expect, it } from 'vitest';

import { DAY_SECONDS } from '../../src/core/data';
import { healsToRate, MONTH_SAMPLE } from '../../src/core/sim/goals';
import { emptyLedger, emptyTally } from '../../src/core/state/game';
import type { MonthRecord, Tally } from '../../src/core/state/types';
import { openCenter } from './helpers';

/** A finished month with these counts. */
const month = (t: Partial<Tally>): MonthRecord => ({
  ...emptyTally(),
  ...t,
  ledger: openCenter(1).s.ledger,
  reputation: 50,
  money: 0,
});

describe('the numbers behind a goal', () => {
  it('for heals: in all, this month and last, and the days to go at this pace', () => {
    const { sim, s } = openCenter(1);
    s.stats.healed = 7;
    s.tally.healed = 3;
    s.day = 10;
    s.months.push(month({ healed: 4 }));
    expect(sim.objectiveDetail({ kind: 'healed', count: 13 })).toEqual([
      '7 of 13 healed in all',
      'This month 3, last month 4',
      "6 more heals to go: about 20 days at this month's pace",
    ]);
    s.tally.healed = 0;
    expect(sim.objectiveDetail({ kind: 'healed', count: 8 }).at(-1)).toBe('1 more heal to go');
    s.stats.healed = 20;
    expect(sim.objectiveDetail({ kind: 'healed', count: 8 }).at(-1)).toBe('Met');
    s.stats.healedBy = { acupuncture: 2 };
    expect(sim.objectiveDetail({ kind: 'healed', count: 5, discipline: 'acupuncture' })[0]).toBe(
      '2 of 5 healed in all',
    );
  });

  it('for a cure rate: healed and failed each month, the sample, and the heals that reach it', () => {
    const { sim, s } = openCenter(1);
    s.tally.healed = 6;
    s.tally.failed = 2;
    s.months.push(month({ healed: 9, failed: 3 }));
    expect(sim.objectiveDetail({ kind: 'cureRate', percent: 80 })).toEqual([
      'This month: 6 healed, 2 failed: 2 more treatments before the month counts',
      'Last month: 9 healed, 3 failed, 75% of 12',
      'A month counts once 10 are treated in it; this month or last may meet it',
      '2 more heals this month, with no failures, reach 80%',
    ]);
    s.tally.healed = 9;
    s.tally.failed = 1;
    expect(sim.objectiveDetail({ kind: 'cureRate', percent: 80 }).at(-1)).toBe('Met');
    expect(sim.objectiveDetail({ kind: 'cureRate', percent: 100 }).at(-1)).toBe(
      'Cannot be met this month: a failure is on the books',
    );
  });

  it('counts the heals that lift a rate, never fewer than fill the sample', () => {
    expect(healsToRate({ ...emptyTally(), healed: 6, failed: 2 }, 80)).toBe(2);
    expect(healsToRate({ ...emptyTally(), healed: 4, failed: 4 }, 75)).toBe(8);
    expect(healsToRate({ ...emptyTally(), healed: 9, failed: 1 }, 90)).toBe(0);
    expect(healsToRate(emptyTally(), 70)).toBe(MONTH_SAMPLE);
    expect(healsToRate({ ...emptyTally(), healed: 3 }, 100)).toBe(7);
  });

  it('for heals in a month: the heals and the average wait each month, and what is still short', () => {
    const { sim, s } = openCenter(1);
    const goal = { kind: 'monthHeals', count: 8, days: 5 } as const;
    s.tally.healed = 5;
    s.tally.waitCount = 8;
    s.tally.waitTotal = 8 * 4 * DAY_SECONDS;
    expect(sim.objectiveDetail(goal)).toEqual([
      'This month: 5 healed (8 needed), waiting 4.0 days on average over 8 guests',
      'Both in the same month: the heals, and the guests who left that month waiting 5 days or less on average; this month or last may meet it',
      '3 more heals this month, with the waits kept to 5 days',
    ]);
    s.months.push(month({ healed: 9, waitCount: 10, waitTotal: 10 * 7 * DAY_SECONDS }));
    expect(sim.objectiveDetail(goal)[1]).toBe(
      'Last month: 9 healed (8 needed), waiting 7.0 days on average over 10 guests',
    );
    s.tally.waitTotal = 8 * 6.5 * DAY_SECONDS;
    expect(sim.objectiveDetail(goal).at(-1)).toBe(
      '3 more heals this month, and the average wait is 1.5 days too long: shorter lines, or more hands',
    );
    s.tally.healed = 8;
    expect(sim.objectiveDetail(goal).at(-1)).toBe(
      'The heals are there, but the average wait is 1.5 days too long: shorter lines, or more hands',
    );
    s.tally.waitTotal = 8 * 5 * DAY_SECONDS;
    expect(sim.objectiveDetail(goal).at(-1)).toBe('Met');
  });

  it('for a balance: the money, the loan, the gap and the months it takes at this pace', () => {
    const { sim, s } = openCenter(1);
    s.money = 30_000;
    s.loan = 10_000;
    s.staff = [];
    s.day = 10;
    s.ledger = emptyLedger();
    s.ledger.treatment = 2000;
    // $6,000 a month at pace, less $200 interest
    expect(sim.objectiveDetail({ kind: 'balance', amount: 50_000 })).toEqual([
      'In the bank $30,000',
      'Loan $10,000',
      'Yours $20,000 of $50,000',
      "$30,000 to go: about 6 months at the books' net of $5,800 a month",
    ]);
    s.ledger.treatment = 0;
    expect(sim.objectiveDetail({ kind: 'balance', amount: 50_000 }).at(-1)).toBe(
      '$30,000 to go, and the books are headed for -$200 a month: it cannot close at this pace',
    );
    s.loan = 0;
    expect(sim.objectiveDetail({ kind: 'balance', amount: 30_000 }).at(-1)).toBe('Met');
  });

  it("for a room's prestige: the score terms of the finest room, and the points to go", () => {
    const { sim } = openCenter(1);
    const lines = sim.objectiveDetail({ kind: 'prestige', room: 'massage', level: 3 });
    expect(lines[0]).toBe('Finest Massage Suite: prestige 1 of 3');
    expect(lines[1]).toMatch(
      /^Floor beyond the smallest \+\d+\.\d, decor [+−]\d+\.\d, windows \+0\.0, litter −0\.0: score -?\d+\.\d$/,
    );
    expect(lines[2]).toBe('Each 3 points of score is a star of prestige');
    expect(lines[3]).toMatch(/^\d+\.\d more points of score to go: decor, windows or a bigger floor$/);
    expect(sim.objectiveDetail({ kind: 'prestige', room: 'reiki', level: 2 })).toEqual([
      'No finished Reiki Studio yet',
    ]);
  });

  it('for a grade: the standing points by source against the grade wanted', () => {
    const { sim } = openCenter(1);
    const lines = sim.objectiveDetail({ kind: 'grade', grade: 1 });
    expect(lines[0]).toMatch(
      /^Standing: rooms \d+, their prestige \d+, staff \d+: \d+ of 80 points for Wellness Studio$/,
    );
    expect(lines[1]).toMatch(/^\d+ points to go: more rooms, finer rooms, or more and higher-ranked staff$/);
  });

  it('for reputation, emergencies and quits: the figure against the target', () => {
    const { sim, s } = openCenter(1);
    s.reputation = 32.4;
    expect(sim.objectiveDetail({ kind: 'reputation', percent: 40 })).toEqual([
      'Reputation 32% of 40%',
      '8 points to go: heals raise it, and failures, walk-outs and guests getting worse lower it',
    ]);
    expect(sim.objectiveDetail({ kind: 'emergencies', count: 2 })).toEqual(['0 of 2 seen through']);
    s.day = 12;
    expect(sim.objectiveDetail({ kind: 'noQuits', days: 30 })).toEqual([
      '12 of 30 days',
      'Nobody has quit yet',
      '18 more days',
    ]);
  });
});
