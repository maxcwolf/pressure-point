// The one-line instruction shown for each tool.

import { ITEMS, type ItemType, ROOM_TILE_COST, ROOMS, type RoomType, WINDOW_COST } from '../../core/data';
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
