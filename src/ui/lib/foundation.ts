// What the Foundation's card and the third star say: the gifts still to make, and what a gift leaves for payday.

import { money } from '../../core/format';
import type { PayrollOutlook } from '../../core/sim/economy';

/** Gifts in order, as "$100,000, then $200,000". */
export const giftList = (prices: readonly number[]) => prices.map((p) => money(p)).join(', then ');

/**
 * What a gift leaves in the bank against the next payday: "The bank would keep $40,000, enough for the next payday as
 * things stand." or "...: $8,000 short of the next payday in 12 days, as things stand." A gift is gone for good, so the
 * wages it would leave unpaid are in sight first.
 */
export function giftNote(o: PayrollOutlook, price: number): string {
  const after = o.money - price;
  const short = o.wages + o.upkeep - (after + o.coming);
  if (short <= 0) return `The bank would keep ${money(after)}, enough for the next payday as things stand.`;
  const n = Math.max(1, Math.ceil(o.daysLeft));
  return `The bank would keep ${money(after)}: ${money(short)} short of the next payday in ${n} day${n === 1 ? '' : 's'}, as things stand.`;
}
