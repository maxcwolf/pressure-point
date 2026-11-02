// How the Items menu groups what it lists: a room's specialty kit, what else only goes there, and what goes anywhere.
import { describe, expect, it } from 'vitest';

import { ITEM_MENU, ITEMS, ROOM_ORDER } from '../../src/core/data';
import { filterItems, itemGroup, itemSections, type Place, placeFilters } from '../../src/ui/lib/catalog';

/** Each group's heading and items, as the menu lists them under a place. */
const listed = (place: Place, kind: Parameters<typeof filterItems>[2] = 'all') =>
  itemSections(filterItems(ITEM_MENU, place, kind), place).map((s) => [s.heading, s.types] as const);

describe('the groups of the Items menu', () => {
  it("tell a technique's kit and the machines from the rest of a room's own, and from what goes anywhere", () => {
    expect(itemGroup('stone_warmer')).toBe('specialty');
    expect(itemGroup('stone_kiln')).toBe('specialty');
    expect(itemGroup('meridian_poster')).toBe('room');
    expect(itemGroup('sofa')).toBe('room');
    expect(itemGroup('plant')).toBe('general');
    expect(itemGroup('reception_desk')).toBe('general');
    expect(itemGroup('generator')).toBe('general');
  });

  it("head a room's list with its name, keeping the order they came in", () => {
    const massage = listed('massage');
    expect(massage.map(([heading]) => heading)).toEqual(['Specialty', 'Massage Suite only', 'Anywhere']);
    expect(massage[0]?.[1]).toEqual(['stretch_rack', 'stone_warmer', 'stone_kiln']);
    expect(massage[1]?.[1]).toEqual(['meridian_poster']);
    expect(massage[2]?.[1]).toContain('fire_extinguisher');
    expect(massage[2]?.[1]).not.toContain('bench');
    // a room with no specialty kit has two groups
    expect(listed('staffroom').map(([heading]) => heading)).toEqual(['Staff Room only', 'Anywhere']);
  });

  it('head everything with what each group is, the everyday furniture first and the specialty kit last', () => {
    const all = listed('all');
    expect(all.map(([heading]) => heading)).toEqual(['Not tied to a room', 'Room-specific', 'Specialty']);
    expect(all[0]?.[1][0]).toBe('reception_desk');
  });

  it('list every item once, in every place and of every kind', () => {
    const places = placeFilters(ITEM_MENU);
    expect(places).toEqual(
      expect.arrayContaining(['all', 'corridor', ...ROOM_ORDER.filter((r) => places.includes(r))]),
    );
    for (const place of places)
      for (const kind of ['all', 'equipment', 'machine', 'comfort', 'decor', 'staff', 'wall'] as const) {
        const types = filterItems(ITEM_MENU, place, kind);
        const sections = itemSections(types, place);
        expect(sections.flatMap((s) => s.types).sort()).toEqual([...types].sort());
        expect(sections.every((s) => s.types.length > 0)).toBe(true);
      }
  });

  it('need no heading for one group alone, nor anything for an empty list', () => {
    // the corridors hold nothing for a room
    expect(listed('corridor').map(([heading]) => heading)).toEqual(['']);
    expect(listed('massage', 'machine')).toEqual([['', ['stone_kiln']]]);
    expect(itemSections([], 'massage')).toEqual([]);
  });

  it('keep the order a sort gave', () => {
    const backwards = [...filterItems(ITEM_MENU, 'massage', 'all')].reverse();
    const sections = itemSections(backwards, 'massage');
    expect(sections[0]?.types).toEqual(['stone_kiln', 'stone_warmer', 'stretch_rack']);
    expect(ITEMS.stone_kiln.machine).toBeDefined();
  });
});
