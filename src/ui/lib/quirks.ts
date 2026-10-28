// What a member of staff's inspector says their rare quirk has done: the treatments Healing Hands saved, the heals a
// Former Influencer posted, and who Holds Space for whom right now.

import { traitMost, traitProduct } from '../../core/data';
import type { Staff } from '../../core/state/types';

/** Someone's first name, as a line about a colleague calls them. */
export const firstName = (st: { name: string }) => st.name.split(' ')[0] ?? st.name;

/** A count with its noun, one or many. */
const counted = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * The lines under someone's quirks in their inspector, one for each rare quirk that has shown: what their Healing Hands
 * have saved, what their posts have earned, how many colleagues they Hold Space for now, and whose space speeds them up
 * now. Nothing for a quirk that has not shown yet.
 */
export function quirkNotes(st: Staff, holdingFor: readonly Staff[], holder: Staff | undefined): string[] {
  const notes: string[] = [];
  if (st.rescued) notes.push(`Healing Hands saved ${counted(st.rescued, 'treatment')}`);
  if (st.posts) {
    const rep = st.posts * traitMost(st.traits, 'rep');
    notes.push(`Posted about ${counted(st.posts, 'heal')}: +${rep} reputation`);
  }
  if (holdingFor.length) notes.push(`Holding space for ${counted(holdingFor.length, 'colleague')}`);
  if (holder) {
    const faster = Math.round((traitProduct(holder.traits, 'hold') - 1) * 100);
    notes.push(`Working ${faster}% faster: ${firstName(holder)} holds space`);
  }
  return notes;
}
