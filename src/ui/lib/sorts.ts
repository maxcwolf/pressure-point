// The orders the lists in the menus can be put in, picked from the Sort by list above each: items and rooms by price
// or what they do, staff and applicants by rank, pay or how they are, and the casebook and the regulars by their
// figures.

import {
  type ConditionId,
  conditionOf,
  ITEMS,
  type ItemType,
  ROLE_ORDER,
  ROOM_ORDER,
  ROOMS,
  type RoomType,
  traitOf,
} from '../../core/data';
import { copyCost } from '../../core/room-layout';
import type { Candidate, CaseRecord, Regular, Staff } from '../../core/state/types';
import type { Template } from '../../core/templates';
import { cureShare, seen } from './casebook';

/** The lists that can be sorted, each remembering its own order. */
export type SortList = 'items' | 'rooms' | 'templates' | 'staff' | 'applicants' | 'casebook' | 'regulars';

/** One order a list can be put in: what the Sort by list calls it, and how two entries compare, if not as they come. */
export interface SortOrder<T> {
  id: string;
  name: string;
  /** Below zero where `a` goes first. Entries that compare the same keep the order they came in. */
  compare?: Compare<T>;
}

/** The order picked, or a list's first, its usual one, if nothing is picked or the pick is not one of its orders. */
export function orderOf<T>(orders: readonly SortOrder<T>[], id: string | undefined): SortOrder<T> {
  const first = orders[0];
  if (!first) throw new Error('a list that can be sorted needs an order to be in');
  return orders.find((o) => o.id === id) ?? first;
}

/** A list in the order picked. */
export function sorted<T>(list: readonly T[], orders: readonly SortOrder<T>[], id: string | undefined): T[] {
  const { compare } = orderOf(orders, id);
  // sorting is stable, so entries the order cannot tell apart stay as they came
  return compare ? [...list].sort(compare) : [...list];
}

/** How two entries compare: below zero where `a` goes first. */
type Compare<T> = (a: T, b: T) => number;

/** By a name, A to Z. */
const alphabetical =
  <T>(of: (x: T) => string): Compare<T> =>
  (a, b) =>
    of(a).localeCompare(of(b));
/** The most of something first, anything without it last. */
const most =
  <T>(of: (x: T) => number | undefined): Compare<T> =>
  (a, b) =>
    (of(b) ?? 0) - (of(a) ?? 0);
/** The least of something first. */
const least =
  <T>(of: (x: T) => number): Compare<T> =>
  (a, b) =>
    of(a) - of(b);
/** By the first order, and where that cannot tell two apart, by the next. */
const inTurn =
  <T>(...compares: Compare<T>[]): Compare<T> =>
  (a, b) => {
    for (const compare of compares) {
      const by = compare(a, b);
      if (by) return by;
    }
    return 0;
  };

/**
 * How loud an item is: below zero where it soothes the noise around it, above where it makes noise, whether all the
 * time, while a session plays or while its machine runs.
 */
function loudness(type: ItemType): number {
  const def = ITEMS[type];
  return def.noise ?? def.sessionNoise ?? def.machine?.runNoise ?? def.machine?.rattle ?? 0;
}

/** The Items menu's orders. */
export const ITEM_SORTS: readonly SortOrder<ItemType>[] = [
  { id: 'usual', name: 'Usual order' },
  { id: 'name', name: 'Name', compare: alphabetical((t) => ITEMS[t].name) },
  { id: 'cheap', name: 'Cheapest first', compare: least((t) => ITEMS[t].cost) },
  { id: 'dear', name: 'Priciest first', compare: most((t) => ITEMS[t].cost) },
  { id: 'decor', name: 'Most decor', compare: most((t) => ITEMS[t].decor) },
  { id: 'quiet', name: 'Quietest first', compare: least(loudness) },
  { id: 'earns', name: 'Earns the most', compare: most((t) => ITEMS[t].sale) },
];

/** The Rooms menu's orders. */
export const ROOM_SORTS: readonly SortOrder<RoomType>[] = [
  { id: 'usual', name: 'Usual order' },
  { id: 'name', name: 'Name', compare: alphabetical((t) => ROOMS[t].name) },
  { id: 'cheap', name: 'Cheapest first', compare: least((t) => ROOMS[t].cost) },
  { id: 'dear', name: 'Priciest first', compare: most((t) => ROOMS[t].cost) },
];

/** The orders of the room templates saved. */
export const TEMPLATE_SORTS: readonly SortOrder<Template>[] = [
  { id: 'saved', name: 'Saved first' },
  { id: 'name', name: 'Name', compare: alphabetical((t) => t.name) },
  { id: 'room', name: 'Room', compare: least((t) => ROOM_ORDER.indexOf(t.layout.type)) },
  { id: 'cheap', name: 'Cheapest first', compare: least((t) => copyCost(t.layout)) },
];

/**
 * Energy or morale in tenths, as the bars show it: a list in order of one keeps still while the figures creep, rather
 * than two of the staff swapping places under the pointer each time one passes the other.
 */
const band = (value: number) => Math.floor(value / 10);

/** The Staff menu's orders. */
export const STAFF_SORTS: readonly SortOrder<Staff>[] = [
  { id: 'hired', name: 'Hired first' },
  { id: 'name', name: 'Name', compare: alphabetical((st) => st.name) },
  { id: 'role', name: 'Role', compare: least((st) => ROLE_ORDER.indexOf(st.role)) },
  {
    id: 'rank',
    name: 'Highest rank',
    compare: inTurn(
      most((st) => st.skill),
      most((st) => st.xp),
    ),
  },
  { id: 'salary', name: 'Highest salary', compare: most((st) => st.salary) },
  { id: 'energy', name: 'Lowest energy', compare: least((st) => band(st.energy)) },
  { id: 'morale', name: 'Lowest morale', compare: least((st) => band(st.morale)) },
  { id: 'knows', name: 'Knows the most', compare: most((st) => st.quals.length + st.general.length) },
];

/** How an applicant's quirks weigh up: one for each that helps, two for a rare one, less one for each that costs. */
const quirks = (c: Candidate) => c.traits.reduce((sum, t) => sum + (traitOf(t).rare ? 2 : traitOf(t).bad ? -1 : 1), 0);

/** The Hire menu's orders, of the applicants for a role. */
export const APPLICANT_SORTS: readonly SortOrder<Candidate>[] = [
  { id: 'applied', name: 'Applied first' },
  { id: 'rank', name: 'Highest rank', compare: most((c) => c.skill) },
  { id: 'cheap', name: 'Lowest salary', compare: least((c) => c.salary) },
  { id: 'knows', name: 'Knows the most', compare: most((c) => c.quals.length) },
  { id: 'quirks', name: 'Best quirks', compare: most(quirks) },
];

/** A row of the casebook: a condition, and how visits with it ended. */
export type CaseRow = [ConditionId, CaseRecord];

/** The casebook's orders. */
export const CASEBOOK_SORTS: readonly SortOrder<CaseRow>[] = [
  { id: 'seen', name: 'Most seen', compare: most(([, c]) => seen(c)) },
  { id: 'name', name: 'Name', compare: alphabetical(([id]) => conditionOf(id).name) },
  // a condition nobody has been treated for yet has no cure rate, and goes last either way
  { id: 'worst', name: 'Lowest cure rate', compare: least(([, c]) => cureShare(c) ?? 101) },
  { id: 'best', name: 'Highest cure rate', compare: most(([, c]) => cureShare(c) ?? -1) },
  { id: 'stormed', name: 'Most stormed out', compare: most(([, c]) => c.stormed) },
  { id: 'priced', name: 'Most put off by price', compare: most(([, c]) => c.priced) },
  { id: 'worse', name: 'Most got worse', compare: most(([, c]) => c.worse) },
];

/** The regulars' orders. */
export const REGULAR_SORTS: readonly SortOrder<Regular>[] = [
  { id: 'loyal', name: 'Most loyal', compare: most((r) => r.loyalty) },
  { id: 'fickle', name: 'Least loyal', compare: least((r) => r.loyalty) },
  { id: 'visits', name: 'Most visits', compare: most((r) => r.visits) },
  { id: 'due', name: 'Due back soonest', compare: least((r) => r.due) },
  { id: 'name', name: 'Name', compare: alphabetical((r) => r.name) },
];
