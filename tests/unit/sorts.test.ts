import { describe, expect, it } from 'vitest';

import { typingIn } from '../../src/app/keyboard';
import { ITEM_MENU, ITEMS } from '../../src/core/data';
import type { CaseRecord, Staff } from '../../src/core/state/types';
import {
  APPLICANT_SORTS,
  CASEBOOK_SORTS,
  type CaseRow,
  ITEM_SORTS,
  orderOf,
  REGULAR_SORTS,
  ROOM_SORTS,
  sorted,
  STAFF_SORTS,
  TEMPLATE_SORTS,
} from '../../src/ui/lib/sorts';

/** A member of staff with only what the orders read. */
const staff = (name: string, more: Partial<Staff> = {}) =>
  ({
    name,
    role: 'therapist',
    skill: 1,
    xp: 0,
    salary: 1000,
    energy: 80,
    morale: 80,
    quals: [],
    general: [],
    ...more,
  }) as Staff;

/** A casebook row for a condition, with these visits. */
const row = (id: CaseRow[0], more: Partial<CaseRecord> = {}): CaseRow => [
  id,
  { healed: 0, failed: 0, stormed: 0, sent: 0, priced: 0, worse: 0, ...more },
];

describe('sorting the lists in the menus', () => {
  it('names every order of a list differently, the usual one first', () => {
    for (const orders of [
      ITEM_SORTS,
      ROOM_SORTS,
      TEMPLATE_SORTS,
      STAFF_SORTS,
      APPLICANT_SORTS,
      CASEBOOK_SORTS,
      REGULAR_SORTS,
    ] as const) {
      expect(new Set(orders.map((o) => o.id)).size).toBe(orders.length);
      expect(new Set(orders.map((o) => o.name)).size).toBe(orders.length);
    }
    expect(ITEM_SORTS[0]?.compare).toBeUndefined();
    expect(STAFF_SORTS[0]?.compare).toBeUndefined();
  });

  it('keeps a list in its usual order until another is picked, or if the one picked is gone', () => {
    expect(orderOf(ITEM_SORTS, undefined).id).toBe('usual');
    expect(orderOf(ITEM_SORTS, 'no-such-order').id).toBe('usual');
    expect(sorted(ITEM_MENU, ITEM_SORTS, undefined)).toEqual(ITEM_MENU);
  });

  it('puts items in order of price either way, without touching the list it was given', () => {
    const before = [...ITEM_MENU];
    const cheap = sorted(ITEM_MENU, ITEM_SORTS, 'cheap').map((t) => ITEMS[t].cost);
    const dear = sorted(ITEM_MENU, ITEM_SORTS, 'dear').map((t) => ITEMS[t].cost);
    expect(cheap).toEqual([...cheap].sort((a, b) => a - b));
    expect(dear).toEqual([...dear].sort((a, b) => b - a));
    expect(ITEM_MENU).toEqual(before);
  });

  it('puts what soothes the noise first and what makes it last, quietest first', () => {
    const quiet = sorted(ITEM_MENU, ITEM_SORTS, 'quiet');
    expect(ITEMS[quiet[0]!].noise).toBeLessThan(0);
    expect(ITEMS[quiet.at(-1)!].noise ?? ITEMS[quiet.at(-1)!].sessionNoise).toBeGreaterThan(0);
  });

  it('puts the items that earn first, and the rest after in their usual order', () => {
    const earns = sorted(ITEM_MENU, ITEM_SORTS, 'earns');
    const selling = ITEM_MENU.filter((t) => ITEMS[t].sale);
    expect(earns.slice(0, selling.length).every((t) => ITEMS[t].sale)).toBe(true);
    expect(earns.slice(selling.length)).toEqual(ITEM_MENU.filter((t) => !ITEMS[t].sale));
  });

  it('orders staff by rank, then by how near the next rank they are', () => {
    const list = [staff('Ada', { skill: 2, xp: 10 }), staff('Bo', { skill: 3 }), staff('Cy', { skill: 2, xp: 40 })];
    expect(sorted(list, STAFF_SORTS, 'rank').map((st) => st.name)).toEqual(['Bo', 'Cy', 'Ada']);
    expect(sorted(list, STAFF_SORTS, 'name').map((st) => st.name)).toEqual(['Ada', 'Bo', 'Cy']);
  });

  it('keeps staff with about the same energy where they are, so the rows do not swap as it creeps', () => {
    const list = [staff('Ada', { energy: 47 }), staff('Bo', { energy: 42 }), staff('Cy', { energy: 31 })];
    expect(sorted(list, STAFF_SORTS, 'energy').map((st) => st.name)).toEqual(['Cy', 'Ada', 'Bo']);
  });

  it('puts conditions nobody has been treated for yet last, by either cure rate', () => {
    const rows = [row('slump'), row('band', { healed: 1, failed: 3 }), row('knotted', { healed: 3, failed: 1 })];
    expect(sorted(rows, CASEBOOK_SORTS, 'worst').map(([id]) => id)).toEqual(['band', 'knotted', 'slump']);
    expect(sorted(rows, CASEBOOK_SORTS, 'best').map(([id]) => id)).toEqual(['knotted', 'band', 'slump']);
  });
});

describe('the Sort by dropdown and the keyboard', () => {
  it('leaves the arrow keys to a dropdown with the keyboard, and its open list, rather than moving the camera', () => {
    expect(typingIn({ tagName: 'SELECT' })).toBe(true);
    expect(typingIn({ tagName: 'OPTION' })).toBe(true);
    expect(typingIn({ tagName: 'BUTTON' })).toBe(false);
  });
});
