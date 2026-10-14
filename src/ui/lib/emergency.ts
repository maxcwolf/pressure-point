// How long is left to decide on an emergency offer.

import { OFFER_DAYS } from '../../core/data';
import { clamp } from '../../core/util';

/** Days left to decide on an offer, and that as a share of the time it was open for. */
export function offerTimeLeft(deadline: number, day: number): { days: number; share: number } {
  const days = Math.max(0, deadline - day);
  return { days, share: clamp(days / OFFER_DAYS, 0, 1) };
}

/**
 * Days left, counting a part day as a day. A whole number of days that comes out a hair over, as subtracting one
 * fractional day from another can, still counts as that number.
 */
export function wholeDaysLeft(days: number): number {
  return Math.max(0, Math.ceil(days - 1e-9));
}

/** Time left to decide, in words. */
export function timeLeftLabel(days: number): string {
  if (days < 1) return 'less than a day left';
  const whole = wholeDaysLeft(days);
  return `${whole} ${whole === 1 ? 'day' : 'days'} left`;
}
