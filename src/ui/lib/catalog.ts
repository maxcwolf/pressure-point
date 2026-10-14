// Deciding what the build and hire menus offer.

import {
  type Discipline,
  DISCIPLINES,
  type ItemDef,
  ITEMS,
  type ItemType,
  MODALITIES,
  type Role,
  ROLE_ORDER,
  ROLES,
  ROOM_ORDER,
  ROOMS,
  type RoomType,
} from '../../core/data';

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

/** What an item is for, to filter the Items menu by. */
export type ItemKind = 'equipment' | 'comfort' | 'decor' | 'staff';

/** The kinds of item, in the order the Items menu offers them. */
export const ITEM_KINDS: readonly { id: ItemKind; label: string }[] = [
  { id: 'equipment', label: 'Desks and equipment' },
  { id: 'comfort', label: 'Guest comforts' },
  { id: 'decor', label: 'Decor' },
  { id: 'staff', label: 'For staff' },
];

/** What guests use an item for, when they use it to sit, drink, eat, play or go. */
const GUEST_USES = new Set(['seat', 'drink', 'eat', 'play', 'toilet']);

/** What an item is for: a station or treatment equipment, a comfort for guests, decor, or something for staff. */
export function itemKind(type: ItemType): ItemKind {
  const def = ITEMS[type];
  if (def.station || Object.values(MODALITIES).some((m) => m.equipment === type)) return 'equipment';
  if (def.where === 'staffroom' || def.where === 'training') return 'staff';
  if (def.access.some((a) => GUEST_USES.has(a.role)) || type === 'bin') return 'comfort';
  return def.decor ? 'decor' : 'comfort';
}

/** Where to look for items: everywhere, the corridors, or one kind of room. */
export type Place = 'all' | 'corridor' | RoomType;

/** Whether an item can go in a place. Items that go anywhere fit every place. */
export function fitsPlace(item: ItemDef, place: Place): boolean {
  if (place === 'all' || item.where === 'any') return true;
  return item.where === place;
}

/** The places worth filtering by: everywhere, the corridors, and each room that has items of its own. */
export function placeFilters(types: readonly ItemType[]): Place[] {
  const rooms = ROOM_ORDER.filter((r) => types.some((t) => ITEMS[t].where === r));
  return ['all', 'corridor', ...rooms];
}

/** What to call a place in the filter. */
export function placeName(place: Place): string {
  if (place === 'all') return 'Everywhere';
  if (place === 'corridor') return 'Corridors';
  return ROOMS[place].name;
}

/** The items that fit a place and are of a kind. */
export function filterItems(types: readonly ItemType[], place: Place, kind: ItemKind | 'all'): ItemType[] {
  return types.filter((t) => fitsPlace(ITEMS[t], place) && (kind === 'all' || itemKind(t) === kind));
}
