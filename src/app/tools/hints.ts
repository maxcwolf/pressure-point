// The one-line instruction shown for each tool.

import {
  type IconId,
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
import { nameInSentence, type PlotOffer } from '../../core/land';
import { coveredSize } from '../../core/resize';
import type { Rect } from '../../core/world';
import { legend } from './squares';
import type { PlanSub, Tool } from './types';

export const WINDOW_HINT = `Windows · ${money(WINDOW_COST)} each · click a wall to add one, or a window to remove it · Esc when done`;
export const MOVE_DOOR_HINT = 'Click a wall to move the door there · Esc cancels';
export const RESIZE_HINT = `Drag a wall in or out · free up to one tile more each way than the smallest, ${money(ROOM_TILE_COST)} a tile past that, half back when given up · Esc when done`;

/** The hint while a wall is being dragged: the room's size now and as dragged, and what that costs or gives back. */
export function resizeHint(from: Rect, to: Rect, cost: number): string {
  const price = cost > 0 ? `costs ${money(cost)}` : cost < 0 ? `gives back ${money(-cost)}` : 'no charge';
  return `${from.w}×${from.h} → ${to.w}×${to.h} · ${price} · release to resize`;
}

/** What R does to an item in hand: turns it, or, for one that turns itself to face something, turns it by hand instead. */
function turnHint(type: ItemType): string {
  const faces = ITEMS[type].faces;
  return faces ? `faces the ${ITEMS[faces].name}, or R turns it` : 'R rotates';
}

/** The hint for placing a new item. */
export function placeHint(type: ItemType, left = 0): string {
  const def = ITEMS[type];
  if (type === 'certificate') return `${def.name} · ${left} to hang · click a wall to hang it · Esc when done`;
  if (def.mount === 'wall') return `${def.name} · ${money(def.cost)} each · click a wall to hang it · Esc when done`;
  if (def.where === 'outdoors')
    return `${def.name} · ${money(def.cost)} each · click the grounds beside a path or the pavement · ${turnHint(type)} · Esc when done${legend(type)}`;
  return `${def.name} · ${money(def.cost)} each · click to place · ${turnHint(type)} · Esc when done${legend(type)}`;
}

/** The hint for moving an item that is already placed. */
export function moveHint(type: ItemType): string {
  const def = ITEMS[type];
  if (def.mount === 'wall') return `Moving the ${def.name} · click a wall to hang it · Esc cancels`;
  return `Moving the ${def.name} · click to put it down · ${turnHint(type)} · Esc cancels${legend(type)}`;
}

/**
 * The hint for dragging out a room: its minimum size, the size its price covers and the price, or once the drag is
 * under way, its current size and what it costs at that size (`cost`), with the floor past what the price covers.
 */
export function dragHint(type: RoomType, dragged: Rect | null, cost = 0): string {
  const def = ROOMS[type];
  const covered = coveredSize(type);
  if (dragged) {
    const floor = cost > def.cost ? ` (${money(cost - def.cost)} of it for floor past ${covered})` : '';
    return `${def.name} · ${dragged.w}×${dragged.h} · ${money(cost)}${floor} · release to confirm`;
  }
  return `${def.name} · drag out the floor (at least ${def.minShort}×${def.minLong}; ${money(def.cost)} up to ${covered}, ${money(ROOM_TILE_COST)} a tile past that) · Esc cancels`;
}

/**
 * Why a room fits nowhere in the building at its smallest, and where the room for it would come from: the cheapest plot
 * for sale, the plot the builders are still at, the next plot to come up for sale, or the rooms there are once every
 * plot is the game's. Said as the room is picked, and again as a drag of it is turned down.
 */
export function noFitHint(type: RoomType, offers: readonly PlotOffer[]): string {
  const def = ROOMS[type];
  const open = offers.filter((o) => o.state === 'open').sort((a, b) => a.price - b.price)[0];
  const building = offers.find((o) => o.state === 'building');
  const locked = offers.find((o) => o.state === 'locked');
  const head = `Nowhere in the building fits a ${def.name} (at least ${def.minShort}×${def.minLong}).`;
  if (open) return `${head} Expand, beside Rooms, sells ${nameInSentence(open.name)} for ${money(open.price)}.`;
  if (building)
    return `${head} The builders are still at work on ${nameInSentence(building.name)}, ${building.daysLeft} day${building.daysLeft === 1 ? '' : 's'} to go.`;
  if (locked) return `${head} ${locked.name} ${locked.why.replace(/^Comes/, 'comes')}.`;
  return `${head} Every plot is yours: move a room, make one smaller or knock one down to make space.`;
}

/** The hint for choosing where a new room's door goes. */
export const DOOR_HINT = 'Now click a wall to place the door · Esc cancels';

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
    ? `Place the ${def.name} inside the room · ${turnHint(sub.type)}${legend(sub.type)}`
    : `${def.name} · ${money(def.cost)} each · click to place · ${turnHint(sub.type)} · Esc puts it down${legend(sub.type)}`;
}

/** The hint while assigning someone to rooms: who, and how many rooms they have so far. */
export function assignHint(name: string, rooms: number): string {
  const now = rooms === 0 ? 'works anywhere' : rooms === 1 ? 'works in 1 room' : `works in ${rooms} rooms`;
  return `${name} ${now} · click a room to assign them to it, or again to take it away · Esc when done`;
}

/** Why someone cannot be assigned to a kind of room. */
export function assignProblem(role: Role, type: RoomType): string {
  return `There is no work for a ${ROLES[role].name} in a ${ROOMS[type].name}`;
}

/** A phrase saying how many windows next door putting a room down where it is takes out, or nothing if none. */
const takesOut = (windows: number) =>
  windows ? ` · takes out ${windows === 1 ? 'a window' : `${windows} windows`} next door` : '';

/** The hint while a room is picked up to move it, and the windows next door putting it down here takes out. */
export function moveRoomHint(type: RoomType, windows = 0): string {
  return `Moving the ${ROOMS[type].name}${takesOut(windows)} · click to put it down · R turns it · Esc cancels`;
}

/** The hint while putting down rooms from a template, with what each costs, and the windows next door one takes out. */
export function templateHint(name: string, cost: number, windows = 0): string {
  return `Building "${name}" · ${money(cost)} each${takesOut(windows)} · click to build one · R turns it · Esc when done`;
}

/** The hint while putting down copies of a room, with what each costs, and the windows next door one takes out. */
export function copyRoomHint(type: RoomType, cost: number, windows = 0): string {
  return `Copying the ${ROOMS[type].name} · ${money(cost)} each${takesOut(windows)} · click to build a copy · R turns it · Esc when done`;
}

/** The icon shown before the hint for the tool in hand: what is being placed, moved or built, or the job being done. */
export function toolIcon(tool: Tool): IconId | null {
  switch (tool.kind) {
    case 'none':
      return null;
    case 'item':
    case 'move':
      return ITEMS[tool.type].icon;
    case 'window':
      return 'ui-window';
    case 'door':
      return 'ui-door';
    case 'resize':
      return 'ui-resize';
    case 'assign':
      return 'ui-pin';
    case 'moveRoom':
    case 'template':
      return ROOMS[tool.layout.type].icon;
    case 'expand':
      return 'ui-expand';
    case 'room': {
      if (tool.phase !== 'plan' || !tool.sub) return ROOMS[tool.type].icon;
      const sub = tool.sub;
      return sub.kind === 'item' ? ITEMS[sub.type].icon : sub.kind === 'window' ? 'ui-window' : 'ui-door';
    }
  }
}
