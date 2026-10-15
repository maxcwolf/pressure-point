// The one-line instruction shown for each tool.

import {
  ITEMS,
  type ItemType,
  type Role,
  ROLES,
  ROOM_TILE_COST,
  ROOMS,
  type RoomType,
  WINDOW_COST,
} from '../../core/data';
import { money } from '../../core/format';
import type { Rect } from '../../core/world';
import { legend } from './squares';
import type { PlanSub } from './types';

export const WINDOW_HINT = `🪟 Windows · ${money(WINDOW_COST)} each · click a wall to add one, or a window to remove it · Esc when done`;
export const MOVE_DOOR_HINT = '🚪 Click a wall to move the door there · Esc cancels';
export const RESIZE_HINT = `↔️ Drag a wall in or out · ${money(ROOM_TILE_COST)} a tile added, half back for a tile taken away · Esc when done`;

/** The hint while a wall is being dragged: the room's size now and as dragged, and what that costs or gives back. */
export function resizeHint(from: Rect, to: Rect, cost: number): string {
  const price = cost > 0 ? `costs ${money(cost)}` : cost < 0 ? `gives back ${money(-cost)}` : 'no charge';
  return `↔️ ${from.w}×${from.h} → ${to.w}×${to.h} · ${price} · release to resize`;
}

/** The hint for placing a new item. */
export function placeHint(type: ItemType): string {
  const def = ITEMS[type];
  return `${def.icon} ${def.name} · ${money(def.cost)} each · click to place · R rotates · Esc when done${legend(type)}`;
}

/** The hint for moving an item that is already placed. */
export function moveHint(type: ItemType): string {
  const def = ITEMS[type];
  return `${def.icon} Moving the ${def.name} · click to put it down · R rotates · Esc cancels${legend(type)}`;
}

/** The hint for dragging out a room: its minimum size, or its current size once the drag is under way. */
export function dragHint(type: RoomType, dragged: Rect | null): string {
  const def = ROOMS[type];
  if (dragged) return `${def.icon} ${def.name} · ${dragged.w}×${dragged.h} · release to confirm`;
  return `${def.icon} ${def.name} · drag out the floor (at least ${def.minShort}×${def.minLong}) · Esc cancels`;
}

/** The hint for choosing where a new room's door goes. */
export function doorHint(type: RoomType): string {
  return `${ROOMS[type].icon} Now click a wall to place the door · Esc cancels`;
}

/** The hint while a blueprint is open, for whatever is in hand. */
export function planHint(sub: PlanSub, missing: number): string {
  if (!sub)
    return missing
      ? 'Pick the missing furniture from the blueprint panel'
      : 'Everything needed is in. Add windows or extras, or press Build room (Enter)';
  if (sub.kind === 'window') return WINDOW_HINT;
  if (sub.kind === 'door') return MOVE_DOOR_HINT;
  const def = ITEMS[sub.type];
  return sub.required
    ? `${def.icon} Place the ${def.name} inside the room · R rotates${legend(sub.type)}`
    : `${def.icon} ${def.name} · ${money(def.cost)} each · click to place · R rotates · Esc puts it down${legend(sub.type)}`;
}

/** The hint while assigning someone to rooms: who, and how many rooms they have so far. */
export function assignHint(name: string, rooms: number): string {
  const now = rooms === 0 ? 'works anywhere' : rooms === 1 ? 'works in 1 room' : `works in ${rooms} rooms`;
  return `📌 ${name} ${now} · click a room to assign them to it, or again to take it away · Esc when done`;
}

/** Why someone cannot be assigned to a kind of room. */
export function assignProblem(role: Role, type: RoomType): string {
  return `There is no work for a ${ROLES[role].name} in a ${ROOMS[type].name}`;
}

/** The hint while a room is picked up to move it. */
export function moveRoomHint(type: RoomType): string {
  return `${ROOMS[type].icon} Moving the ${ROOMS[type].name} · click to put it down · R turns it · Esc cancels`;
}

/** The hint while putting down rooms from a template, with what each costs. */
export function templateHint(name: string, type: RoomType, cost: number): string {
  return `${ROOMS[type].icon} Building "${name}" · ${money(cost)} each · click to build one · R turns it · Esc when done`;
}

/** The hint while putting down copies of a room, with what each costs. */
export function copyRoomHint(type: RoomType, cost: number): string {
  return `${ROOMS[type].icon} Copying the ${ROOMS[type].name} · ${money(cost)} each · click to build a copy · R turns it · Esc when done`;
}
