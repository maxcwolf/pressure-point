// What the interface says about a complaint: what went wrong, what asking the guest back does, and when they are due.

import { COMP_SHARE, COMPLAINT_DAYS, MODALITIES } from '../../core/data';
import type { Complaint } from '../../core/state/types';

/** A count of days, in words: "1 day", "9 days". */
const dayCount = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;

/** What went wrong, in a line: who left, how, and after how long, with the treatment they were waiting for if any. */
export function complaintSaid(c: Complaint): string {
  const days = dayCount(Math.max(1, Math.round(c.waited)));
  const treatment = c.modality && MODALITIES[c.modality].name;
  if (c.end === 'accident') return `${c.name} went home after an accident in the waiting area.`;
  if (c.end === 'worse')
    return treatment
      ? `${c.name} went home worse off after ${days} waiting for ${treatment}.`
      : `${c.name} went home worse off after ${days} waiting.`;
  return treatment
    ? `${c.name} stormed out of the ${treatment} line after ${days}.`
    : `${c.name} stormed out after ${days} waiting.`;
}

/** The reputation healing a guest asked back wins back, to a tenth. */
export const complaintBack = (c: Pick<Complaint, 'cost'>) => Math.round(c.cost * COMP_SHARE * 10) / 10;

/** What asking a guest back does, for the tooltip on Make it right. */
export const makeItRightNote = (c: Pick<Complaint, 'cost'>) =>
  `Free, first in line. Healed: +${complaintBack(c)} reputation back. Let down again: the usual loss, and no second chance.`;

/** Where a complaint stands: how long it has left for an answer, or when its guest is due back. */
export function complaintNote(c: Pick<Complaint, 'day' | 'due'>, day: number): string {
  if (c.due !== undefined) return c.due <= day ? 'Asked back: on their way' : 'Asked back: due tomorrow';
  const left = Math.max(1, Math.ceil(c.day + COMPLAINT_DAYS - day));
  return `Lapses in ${dayCount(left)}`;
}

/** The card for every complaint still open: "Ada Twinge left a complaint", or "Ada Twinge and 2 more left complaints". */
export function complaintCard(open: readonly Pick<Complaint, 'name'>[]): string {
  const first = open[0]?.name ?? '';
  return open.length === 1 ? `${first} left a complaint` : `${first} and ${open.length - 1} more left complaints`;
}
