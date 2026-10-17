// How a station has been doing over the last few days, for its inspector.

import type { Item } from '../../core/state/types';

/** How busy a station has been and how often it stood staffed, in a line, or nothing before it has been tracked. */
export function busyNote(it: Pick<Item, 'busy' | 'staffed'>): string | null {
  if (it.busy === undefined || it.staffed === undefined) return null;
  /** A share as a percentage. */
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  return `Over the last few days: busy ${pct(it.busy)} of the time, staffed ${pct(it.staffed)}`;
}
