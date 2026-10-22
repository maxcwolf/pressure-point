// What the Loan tab says beside the loan: the next payday, so the wages a loan must also carry are in sight first.

import { money } from '../../core/format';
import type { PayrollOutlook } from '../../core/sim/economy';

/**
 * The next payday beside the loan, before anything is borrowed: "Next payday in 30 days: $14,400 in wages for the
 * staff on the payroll now, against $3,200 in the bank. That is $11,200 more than the bank and this month's pace will
 * have, and the wages come again every month after." A loan spent on building leaves less for the wages.
 */
export function paydayBeside(o: PayrollOutlook): string {
  const n = Math.max(1, Math.ceil(o.daysLeft));
  const pace = o.coming > 0 ? `, with about ${money(o.coming)} more coming at this month's pace` : '';
  const head = `Next payday in ${n} day${n === 1 ? '' : 's'}: ${money(o.wages)} in wages for the staff on the payroll now, against ${money(o.money)} in the bank${pace}.`;
  if (o.short <= 0) return `${head} Covered as things stand.`;
  return `${head} That is ${money(o.short)} more than the bank and this month's pace will have, and the wages come again every month after.`;
}
