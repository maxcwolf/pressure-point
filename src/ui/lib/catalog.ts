// Deciding what the build and hire menus offer.

import { type Discipline, DISCIPLINES, type ItemDef, type Role, ROLE_ORDER, ROLES, ROOMS } from '../../core/data';

/** Whether something tied to a discipline is on offer: anything with no discipline always is. */
export function available(d: Discipline | undefined, enabled: (d: Discipline) => boolean): boolean {
  return !d || enabled(d);
}

/** The roles that can be hired: a discipline's role appears once it is switched on and its room can be built. */
export function hireableRoles(stars: number, enabled: (d: Discipline) => boolean): Role[] {
  return ROLE_ORDER.filter((r) => {
    const d = ROLES[r].discipline;
    return !d || (enabled(d) && stars >= (ROOMS[DISCIPLINES[d].room].unlock ?? 0));
  });
}

/** Where an item may be placed, in words. */
export function placeLabel(item: ItemDef): string {
  if (item.where === 'corridor') return 'Corridor';
  if (item.where === 'any') return 'Anywhere';
  return ROOMS[item.where].name;
}

/** Whether an item's home is on offer: corridor items always are, room items when their room's discipline is. */
export function itemOffered(item: ItemDef, enabled: (d: Discipline) => boolean): boolean {
  if (item.where === 'corridor' || item.where === 'any') return true;
  return available(ROOMS[item.where].discipline, enabled);
}
