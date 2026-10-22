// The Loan tab's line on the next payday: the wages a loan must also carry, in sight before anything is borrowed.
import { describe, expect, it } from 'vitest';

import { payrollOutlook } from '../../src/core/sim/economy';
import { paydayBeside } from '../../src/ui/lib/loan';
import { openCenter } from './helpers';

describe('the next payday beside the loan', () => {
  it('gives the wages against the bank on day 0, before the center opens', () => {
    const { s } = openCenter(1);
    s.money = 3200;
    const o = payrollOutlook(s);
    expect(o.wages).toBeGreaterThan(s.money);
    expect(paydayBeside(o)).toBe(
      `Next payday in ${Math.ceil(o.daysLeft)} days: $${o.wages.toLocaleString('en-US')} in wages for the staff on the payroll now, against $3,200 in the bank. That is $${o.short.toLocaleString('en-US')} more than the bank and this month's pace will have, and the wages come again every month after.`,
    );
  });

  it('says when payday is covered', () => {
    const { s } = openCenter(1);
    s.money = 100_000;
    expect(paydayBeside(payrollOutlook(s))).toMatch(/against \$100,000 in the bank\. Covered as things stand\.$/);
  });
});
