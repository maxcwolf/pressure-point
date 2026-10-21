// Deciding what the build and hire menus offer.

import { itemOpen } from '../../core/campaign';
import {
  type ConditionDef,
  CONDITIONS,
  DISCIPLINES,
  goesIn,
  type ItemDef,
  ITEMS,
  type ItemType,
  MODALITIES,
  type Offering,
  type Role,
  ROLE_ORDER,
  ROLES,
  ROOM_ORDER,
  ROOMS,
  roomsFor,
  type RoomType,
} from '../../core/data';

/** The ailments a machine room's machine cures, which no other room does. */
export function machineCures(type: RoomType): ConditionDef[] {
  const machines = ROOMS[type].required.filter((t) => ITEMS[t].machine);
  return CONDITIONS.filter((c) => {
    const machine = MODALITIES[c.modality].machine;
    return machine !== undefined && machines.includes(machine);
  });
}

/** The item that keeps a room locked until karma unlocks it, if one does: the Carousel of Rebirth's carousel. */
export function roomKarmaLock(type: RoomType, upTo: number, unlocked: readonly ItemType[]): ItemType | undefined {
  return ROOMS[type].required.find((t) => !itemOpen(ITEMS[t], upTo, unlocked));
}

/** Whether something tied to a discipline, or the Qi Gong classes, is on offer: anything tied to neither always is. */
export function available(d: Offering | undefined, enabled: (d: Offering) => boolean): boolean {
  return !d || enabled(d);
}

/** What switches a room off in Settings, if anything: its discipline, or what else it offers. */
export const roomOffering = (type: RoomType): Offering | undefined => ROOMS[type].discipline ?? ROOMS[type].offering;

/**
 * The roles that can be hired: a discipline's role, or one tied to a room, appears once it is switched on and its room
 * can be built.
 */
export function hireableRoles(stars: number, enabled: (d: Offering) => boolean): Role[] {
  return ROLE_ORDER.filter((r) => {
    const d = ROLES[r].discipline;
    const room = d ? DISCIPLINES[d].room : ROLES[r].room;
    if (!room) return true;
    return available(roomOffering(room), enabled) && stars >= (ROOMS[room].unlock ?? 0);
  });
}

/** Where an item may be placed, in words: on a wall too, for something hung on one. */
export function placeLabel(item: ItemDef): string {
  if (item.mount === 'wall') {
    if (item.where === 'corridor') return 'Corridor wall';
    if (item.where === 'any') return 'Any wall';
    return `${roomsFor(item)
      .map((r) => ROOMS[r].name)
      .join(' or ')} wall`;
  }
  if (item.where === 'corridor') return 'Corridor';
  if (item.where === 'any') return 'Anywhere';
  return roomsFor(item)
    .map((r) => ROOMS[r].name)
    .join(' or ');
}

/** Whether an item's home is on offer: corridor items always are, room items when their room's discipline is. */
export function itemOffered(item: ItemDef, enabled: (d: Offering) => boolean): boolean {
  if (item.where === 'corridor' || item.where === 'any') return true;
  return roomsFor(item).some((r) => available(roomOffering(r), enabled));
}

/** What an item is for, to filter the Items menu by. */
export type ItemKind = 'equipment' | 'machine' | 'comfort' | 'decor' | 'staff' | 'wall';

/** The kinds of item, in the order the Items menu offers them. */
export const ITEM_KINDS: readonly { id: ItemKind; label: string }[] = [
  { id: 'equipment', label: 'Desks and equipment' },
  { id: 'machine', label: 'Machines' },
  { id: 'comfort', label: 'Guest comforts' },
  { id: 'decor', label: 'Decor' },
  { id: 'staff', label: 'For staff' },
  { id: 'wall', label: 'On the walls' },
];

/** What guests use an item for, when they use it to sit, drink, eat, play or go. */
const GUEST_USES = new Set(['seat', 'drink', 'eat', 'play', 'toilet']);

/**
 * What an item is for: something to hang on a wall, a treatment machine, a station or treatment equipment, a comfort
 * for guests, decor, or something for staff.
 */
export function itemKind(type: ItemType): ItemKind {
  const def = ITEMS[type];
  if (def.mount === 'wall') return 'wall';
  if (def.machine) return 'machine';
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
  return place === 'corridor' ? item.where === 'corridor' : goesIn(item, place);
}

/** The places worth filtering by: everywhere, the corridors, and each room that has items of its own. */
export function placeFilters(types: readonly ItemType[]): Place[] {
  const rooms = ROOM_ORDER.filter((r) => types.some((t) => roomsFor(ITEMS[t]).includes(r)));
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
