// The casebook's figures, worked out from how visits with one condition ended.

import { type ConditionId, conditionOf, type Modality } from '../../core/data';
import type { CaseRecord } from '../../core/state/types';

/** How many came with a condition and left, however they left. */
export const seen = (c: CaseRecord) => c.healed + c.failed + c.stormed + c.sent + c.priced + c.worse;

/** The share of a condition's treatments that worked, as a whole percentage, or null before any were given. */
export function cureShare(c: CaseRecord): number | null {
  const treated = c.healed + c.failed;
  return treated ? Math.round((c.healed / treated) * 100) : null;
}

/** A review's stars, filled and empty. */
export const starText = (stars: number) => '★'.repeat(stars) + '☆'.repeat(Math.max(0, 5 - stars));

/** How many guests have been put off by the price of a technique, from the casebook's conditions it treats. */
export function pricedFor(casebook: Partial<Record<ConditionId, CaseRecord>>, modality: Modality): number {
  let n = 0;
  for (const [id, c] of Object.entries(casebook) as [ConditionId, CaseRecord][])
    if (conditionOf(id).modality === modality) n += c.priced;
  return n;
}
