// Perks as the interface puts them: who has a choice waiting, what a choice says, how far a hire is from the choice
// they are owed for settling in, and what goes with someone let go.

import { perkOf, type PerkTier, SETTLE_XP } from '../../core/data';
import { daysToChoose, settlingFor, tierRank } from '../../core/sim/perks';
import type { Candidate, PerkDue, Staff } from '../../core/state/types';

/** A promotion's rank with its article: "a Senior", "an Expert". */
const aRank = (tier: PerkTier) => `${tier === 'expert' ? 'an' : 'a'} ${tierRank(tier)}`;

/** The staff with a choice of perk waiting on its card, in payroll order. Anyone on their way out is past choosing. */
export function perkRequests(staff: readonly Staff[]): Staff[] {
  return staff.filter((st) => st.perkDue.length > 0 && st.state !== 'leaving');
}

/** The heading over a choice waiting: "Now Senior. How do they work?", or for a hire, settled in. */
export const choiceHeading = (d: PerkDue) =>
  d.settled ? 'Settled in. How do they work?' : `Now ${tierRank(d.tier)}. How do they work?`;

/** How long a choice can wait before they make it themselves. */
export function choiceDeadline(d: PerkDue, day: number): string {
  const left = daysToChoose(d, day);
  if (left <= 0) return 'They will choose for themselves today.';
  return `Choose within ${left} day${left === 1 ? '' : 's'}, or they will choose for themselves.`;
}

/** Their next choice still to be earned by settling in, as a line and how far along it is, if they are owed one. */
export function settlingNote(st: Pick<Staff, 'settling' | 'xp'>): { text: string; progress: number } | null {
  const next = [...st.settling].sort((a, b) => a.at - b.at)[0];
  if (!next) return null;
  const span = SETTLE_XP[next.tier] - (next.tier === 'expert' ? SETTLE_XP.senior : 0);
  const left = Math.max(0, next.at - st.xp);
  return {
    text: `Settling in: ${Math.ceil(left)} more experience to choose ${aRank(next.tier)} perk`,
    progress: Math.min(1, Math.max(0, 1 - left / span)),
  };
}

/** What an applicant above Experienced is owed, and when, and the perk they bring, if any: for their card. */
export function applicantPerkNote(c: Pick<Candidate, 'skill' | 'perk'>): string {
  const owed = settlingFor(c.skill, 0, c.perk);
  const [first, second] = owed;
  if (!first) return '';
  const rest = second ? `, and an Expert one ${second.at - first.at} after that` : '';
  return `Will choose ${aRank(first.tier)} perk once settled in (${first.at} experience)${rest}.`;
}

/** What the Let Go dialog says goes with them: the perks chosen here, by name. */
export function chosenHereNote(st: Pick<Staff, 'name' | 'perks' | 'brought'>): string {
  const here = st.perks.filter((p) => p !== st.brought).map((p) => perkOf(p).name);
  if (!here.length) return '';
  const names = here.length === 1 ? here[0] : `${here.slice(0, -1).join(', ')} and ${here.at(-1) ?? ''}`;
  return `${st.name}’s ${names ?? ''} ${here.length === 1 ? 'was' : 'were'} chosen here. The next one will have their own ideas.`;
}
