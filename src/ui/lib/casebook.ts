// The casebook's figures, worked out from how visits with one condition ended.

import type { CaseRecord } from '../../core/state/types';

/** How many came with a condition and left, however they left. */
export const seen = (c: CaseRecord) => c.healed + c.failed + c.stormed + c.sent + c.priced;

/** The share of a condition's treatments that worked, as a whole percentage, or null before any were given. */
export function cureShare(c: CaseRecord): number | null {
  const treated = c.healed + c.failed;
  return treated ? Math.round((c.healed / treated) * 100) : null;
}

/** A review's stars, filled and empty. */
export const starText = (stars: number) => '★'.repeat(stars) + '☆'.repeat(Math.max(0, 5 - stars));
