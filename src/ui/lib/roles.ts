// The jobs the Staff menu can be narrowed to: each role someone on the staff holds, with how many hold it.

import { type Role, ROLE_ORDER, ROLES } from '../../core/data';
import type { Staff } from '../../core/state/types';

/** A role someone on the staff holds, and how many of them hold it. */
export interface Headcount {
  role: Role;
  count: number;
}

/** Each role someone on the staff holds, in the game's usual order of roles, with how many hold it. */
export const headcounts = (staff: readonly Staff[]): Headcount[] =>
  ROLE_ORDER.map((role) => ({ role, count: staff.filter((st) => st.role === role).length })).filter((h) => h.count);

/** The role the list is narrowed to, or null for everyone: one nobody holds any more falls back to everyone. */
export const shownRole = (staff: readonly Staff[], asked: Role | null): Role | null =>
  asked && staff.some((st) => st.role === asked) ? asked : null;

/** The job filter's choices: everyone, then each role someone holds, each with its headcount. */
export const jobChoices = (staff: readonly Staff[]) => [
  { id: 'all', name: `All (${staff.length})` },
  ...headcounts(staff).map((h) => ({ id: h.role, name: `${ROLES[h.role].name} (${h.count})` })),
];
