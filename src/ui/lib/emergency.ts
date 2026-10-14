// How long is left to decide on an emergency offer.

import { OFFER_DAYS } from '../../core/data';
import { clamp } from '../../core/util';

/** Days left to decide on an offer, and that as a share of the time it was open for. */
export function offerTimeLeft(deadline: number, day: number): { days: number; share: number } {
  const days = Math.max(0, deadline - day);
  return { days, share: clamp(days / OFFER_DAYS, 0, 1) };
}

/** Time left to decide, in words. */
export function timeLeftLabel(days: number): string {
  if (days < 1) return 'less than a day left';
  const whole = Math.ceil(days);
  return `${whole} ${whole === 1 ? 'day' : 'days'} left`;
}
