// Where the money comes from: income by source, and the verdict on how much of it is healing.
import { describe, expect, it } from 'vitest';

import { emptyLedger } from '../../src/core/state/game';
import { incomeSources, incomeVerdict, shareWord } from '../../src/ui/lib/income';

/** A month's books with these takings. */
const books = (l: Partial<ReturnType<typeof emptyLedger>>) => ({ ...emptyLedger(), ...l });

describe('income by source', () => {
  it('groups the ledger into treatments, consultations, classes, house calls, sales and bonuses, with shares', () => {
    const now = books({
      treatment: 5000,
      consult: 1000,
      classes: 12000,
      calls: 4000,
      shop: 500,
      vending: 300,
      mushrooms: 200,
      bonus: 2000,
    });
    const last = books({ treatment: 8000, consult: 2000 });
    const rows = incomeSources(now, last);
    expect(rows.map((r) => [r.id, r.now, r.last, r.healing])).toEqual([
      ['treatment', 5000, 8000, true],
      ['consult', 1000, 2000, true],
      ['classes', 12000, 0, false],
      ['calls', 4000, 0, false],
      ['sales', 1000, 0, false],
      ['bonus', 2000, 0, false],
    ]);
    expect(rows.map((r) => shareWord(r.share))).toEqual(['20%', '4%', '48%', '16%', '4%', '8%']);
    expect(rows.reduce((sum, r) => sum + r.now, 0)).toBe(25000);
  });

  it('has no shares with nothing earned yet', () => {
    expect(incomeSources(emptyLedger(), emptyLedger()).every((r) => r.share === 0)).toBe(true);
    expect(incomeVerdict(emptyLedger())).toBeNull();
  });

  it('says when side income is carrying the center, and when healing is', () => {
    expect(incomeVerdict(books({ treatment: 5000, consult: 1000, classes: 12000, calls: 4000, bonus: 2000 }))).toBe(
      "Only 25% of this month's income is from healing: classes, house calls, sales and bonuses are carrying the center. Treatments are the income that grows with the center; the rest comes and goes.",
    );
    expect(incomeVerdict(books({ treatment: 9000, consult: 1000, calls: 4000 }))).toBe(
      "Healing brought in 71% of this month's income.",
    );
  });
});
