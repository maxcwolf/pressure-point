// Building: placing, moving and selling items, and creating, changing and removing rooms.

import { ITEMS, type ItemType, ROOMS, type RoomType, WINDOW_COST } from '../data';
import { money } from '../format';
import { carryWallSpot, carryWindows, resizeCost } from '../resize';
import { sameSpot } from '../state/game';
import type { Guest, Item, Room, Staff, WallSpot } from '../state/types';
import { itemCenter, type Rect } from '../world';
import { charById } from './chars';
import { release } from './claims';
import type { SimContext } from './context';
import { spend } from './economy';
import { emit, toast } from './events';
import { resetGuest } from './guests';
import { repathAll } from './movement';
import { staffIdle } from './staffing';

/** How an item is being placed: without charge, or as furniture for a particular room. */
export interface PlaceOptions {
  free?: boolean;
  roomId?: number;
}

/** Rebuild the grids and reroute everyone after the layout changes. */
function worldChanged(ctx: SimContext) {
  ctx.world.rebuild();
  repathAll(ctx);
}

/** Buy an item and put it down, if it fits and can be afforded. */
export function placeItem(
  ctx: SimContext,
  type: ItemType,
  x: number,
  y: number,
  rot: number,
  opts: PlaceOptions = {},
): Item | null {
  const def = ITEMS[type];
  if (!ctx.world.canPlaceItem(type, x, y, rot, opts.roomId).ok) return null;
  if (!opts.free && ctx.s.money < def.cost) {
    toast(ctx, `Not enough money for a ${def.name}.`, 'bad');
    emit(ctx, { type: 'sfx', name: 'error' });
    return null;
  }
  const it: Item = {
    id: ctx.s.nextId++,
    type,
    x,
    y,
    rot,
    users: def.access.map(() => 0),
    queue: [],
    serving: 0,
    staffId: 0,
    progress: 0,
    water: 100,
    wear: 0,
    dirt: 0,
    claimedBy: 0,
  };
  ctx.s.items.push(it);
  if (!opts.free) spend(ctx, def.cost, 'building');
  worldChanged(ctx);
  emit(ctx, { type: 'sfx', name: 'place' });
  return it;
}

/** Start a new room as a blueprint, not yet paid for. */
export function createRoom(ctx: SimContext, type: RoomType, r: Rect, door: Room['door']): Room {
  const room: Room = {
    id: ctx.s.nextId++,
    type,
    x: r.x,
    y: r.y,
    w: r.w,
    h: r.h,
    door,
    windows: [],
    done: false,
    priority: false,
  };
  ctx.s.rooms.push(room);
  worldChanged(ctx);
  emit(ctx, { type: 'sfx', name: 'place' });
  return room;
}

/** Turn a blueprint into a built room and pay for it. */
export function finishRoom(ctx: SimContext, room: Room) {
  room.done = true;
  spend(ctx, ROOMS[room.type].cost, 'building');
  ctx.world.version++;
  toast(ctx, `${ROOMS[room.type].name} built!`, 'good', { kind: 'room', id: room.id });
  emit(ctx, { type: 'sfx', name: 'build' });
}

/** How many working items of a type share a room with an item. */
export function sameRoomCount(ctx: SimContext, item: Item, type: ItemType): number {
  const zone = ctx.world.zoneAt(item.x, item.y);
  if (zone <= 0) return 0;
  return ctx.s.items.filter((i) => i.type === type && ctx.world.usable(i) && ctx.world.zoneAt(i.x, i.y) === zone)
    .length;
}

/** The items inside a room. */
export function itemsInRoom(ctx: SimContext, room: Room) {
  return ctx.s.items.filter((it) => ctx.world.zoneAt(it.x, it.y) === room.id);
}

/** Can this item be picked up and put down here instead? */
export function canMoveItem(ctx: SimContext, it: Item, x: number, y: number, rot: number) {
  const zone = ctx.world.zoneAt(it.x, it.y);
  const at = ctx.s.items.indexOf(it);
  // an item that is not in the game has nothing to move, and splicing at -1 would lift out the last one instead
  if (at < 0) return { ok: false, reason: 'That item is gone' };
  // judge the new spot as if the item had already been lifted out
  ctx.s.items.splice(at, 1);
  ctx.world.rebuild(true);
  const check = ctx.world.canPlaceItem(it.type, x, y, rot, zone > 0 ? zone : undefined);
  ctx.s.items.splice(at, 0, it);
  ctx.world.rebuild(true);
  return check;
}

/** Move an item for free. Furniture that belongs to a room has to stay in that room. */
export function moveItem(ctx: SimContext, id: number, x: number, y: number, rot: number): boolean {
  const it = ctx.world.item(id);
  if (!it || !canMoveItem(ctx, it, x, y, rot).ok) return false;
  const users = usersOf(ctx, new Set([id]));
  it.x = x;
  it.y = y;
  it.rot = rot;
  ctx.world.rebuild();
  resetUsers(ctx, users);
  emit(ctx, { type: 'sfx', name: 'place' });
  return true;
}

/** The guests and staff using, waiting on or heading for any of these items. */
export function usersOf(ctx: SimContext, ids: Set<number>) {
  return {
    guests: ctx.s.guests.filter((g) => ids.has(g.claimItem) || ids.has(g.station)),
    staff: ctx.s.staff.filter(
      (st) => ids.has(st.post) || ids.has(st.claimItem) || (!!st.job && st.job.kind !== 'litter' && ids.has(st.job.id)),
    ),
  };
}

/** Free these people from what they were using and have them start over. */
function resetUsers(ctx: SimContext, { guests, staff }: { guests: Guest[]; staff: Staff[] }) {
  for (const g of guests) {
    release(ctx, g);
    resetGuest(ctx, g);
  }
  for (const st of staff) {
    release(ctx, st);
    if (st.state !== 'leaving') staffIdle(ctx, st);
  }
  for (const it of ctx.s.items) {
    it.users = it.users.map((u) => (charById(ctx, u) ? u : 0));
  }
  repathAll(ctx);
}

/** Remove items and patch up anyone who was using them. */
function removeItems(ctx: SimContext, gone: Item[]) {
  const ids = new Set(gone.map((i) => i.id));
  const users = usersOf(ctx, ids);
  ctx.s.items = ctx.s.items.filter((i) => !ids.has(i.id));
  ctx.world.rebuild();
  // a seat on something that is going has nothing left to give back; a seat elsewhere is released as usual
  for (const st of users.staff) if (st.job && st.job.kind !== 'litter') st.job = null;
  resetUsers(ctx, users);
}

/** What removing a room gives back: `refund` of whatever was paid for it, its extras and its windows. */
export function roomRefund(ctx: SimContext, room: Room, refund: number) {
  // a blueprint has not been paid for yet, but any extras bought for it have
  let back = room.done ? ROOMS[room.type].cost * refund : 0;
  // the required furniture came free with the room, so only what is left over was bought
  const free = [...ROOMS[room.type].required];
  for (const it of itemsInRoom(ctx, room)) {
    const at = free.indexOf(it.type);
    if (at >= 0) free.splice(at, 1);
    else back += ITEMS[it.type].cost * refund;
  }
  return back + room.windows.length * WINDOW_COST * refund;
}

/** Remove a room. `refund` is the fraction of its cost returned (0 while still a blueprint). */
export function removeRoom(ctx: SimContext, roomId: number, refund: number) {
  const room = ctx.world.room(roomId);
  if (!room) return;
  const items = itemsInRoom(ctx, room);
  const back = roomRefund(ctx, room, refund);
  ctx.s.rooms = ctx.s.rooms.filter((r) => r !== room);
  removeItems(ctx, items);
  if (back > 0) {
    ctx.s.money += back;
    ctx.s.ledger.building -= back;
    if (room.done) toast(ctx, `${ROOMS[room.type].name} demolished. ${money(back)} recovered.`, 'info');
    emit(ctx, { type: 'sfx', name: 'sell' });
  }
}

/** Required furniture a room still lacks, in the order it is asked for. */
export function missingItems(ctx: SimContext, room: Room): ItemType[] {
  const have = itemsInRoom(ctx, room).map((i) => i.type);
  const missing: ItemType[] = [];
  for (const type of ROOMS[room.type].required) {
    const at = have.indexOf(type);
    if (at >= 0) have.splice(at, 1);
    else missing.push(type);
  }
  return missing;
}

/**
 * Add a window to a stretch of wall, or take out the one already there.
 * Returns what happened, or '' if it could not be done.
 */
export function toggleWindow(ctx: SimContext, roomId: number, spot: WallSpot): 'added' | 'removed' | '' {
  const room = ctx.world.room(roomId);
  if (!room) return '';
  const at = room.windows.findIndex((w) => sameSpot(w, spot));
  if (at >= 0) {
    room.windows.splice(at, 1);
    // a blueprint's windows come back in full; a built room's at half, like everything else
    const back = Math.round(WINDOW_COST * (room.done ? 0.5 : 1));
    ctx.s.money += back;
    ctx.s.ledger.building -= back;
    ctx.world.version++;
    emit(ctx, { type: 'sfx', name: 'sell' });
    return 'removed';
  }
  if (!ctx.world.windowValid(room, spot).ok) return '';
  if (ctx.s.money < WINDOW_COST) {
    toast(ctx, 'Not enough money for a window.', 'bad');
    emit(ctx, { type: 'sfx', name: 'error' });
    return '';
  }
  room.windows.push({ ...spot });
  spend(ctx, WINDOW_COST, 'building');
  ctx.world.version++;
  emit(ctx, { type: 'sfx', name: 'place' });
  return 'added';
}

/** Move a room's door to another stretch of its wall, for free. */
export function moveDoor(ctx: SimContext, roomId: number, door: WallSpot): boolean {
  const room = ctx.world.room(roomId);
  if (!room || sameSpot(room.door, door)) return false;
  if (!ctx.world.doorValid(room.type, room, door, room).ok) return false;
  room.door = { ...door };
  worldChanged(ctx);
  emit(ctx, { type: 'sfx', name: 'place' });
  return true;
}

/**
 * Give a room a new shape. Tiles added are paid for and tiles taken away half refunded; the door and windows move
 * with their walls, and a window whose stretch of wall is gone, or that would look into another room, is refunded
 * at half. False if the room cannot take that shape or the change cannot be afforded.
 */
export function resizeRoom(ctx: SimContext, roomId: number, r: Rect): boolean {
  const room = ctx.world.room(roomId);
  if (!room || !ctx.world.resizeValid(room, r).ok) return false;
  const door = carryWallSpot(room.door, r);
  if (!door) return false;
  const cost = resizeCost(room, r);
  if (cost > 0 && ctx.s.money < cost) {
    toast(ctx, `Not enough money: that costs ${money(cost)}.`, 'bad');
    emit(ctx, { type: 'sfx', name: 'error' });
    return false;
  }
  const windows = room.windows.length;
  const carried = carryWindows(room, r);
  Object.assign(room, { x: r.x, y: r.y, w: r.w, h: r.h, door, windows: [] });
  ctx.world.rebuild(true);
  // only now can a window be judged against the room's new walls and its new neighbors
  for (const w of carried) if (ctx.world.windowValid(room, w).ok) room.windows.push(w);
  const back = (windows - room.windows.length) * Math.round(WINDOW_COST / 2) - Math.min(cost, 0);
  if (cost > 0) spend(ctx, cost, 'building');
  if (back > 0) {
    ctx.s.money += back;
    ctx.s.ledger.building -= back;
  }
  worldChanged(ctx);
  emit(ctx, { type: 'sfx', name: 'build' });
  return true;
}

/** Whether an item can be sold. A room has to keep one of each thing it requires. */
export function canSell(ctx: SimContext, it: Item): boolean {
  const room = ctx.world.roomOfItem(it);
  if (!room) return true;
  const def = ROOMS[room.type];
  if (!def.required.includes(it.type)) return true;
  return itemsInRoom(ctx, room).filter((o) => o.type === it.type).length > 1;
}

/** Sell an item for half of what it cost. */
export function sellItem(ctx: SimContext, id: number) {
  const it = ctx.world.item(id);
  if (!it || !canSell(ctx, it)) return;
  const back = Math.round(ITEMS[it.type].cost * 0.5);
  removeItems(ctx, [it]);
  ctx.s.money += back;
  ctx.s.ledger.building -= back;
  emit(ctx, { type: 'sfx', name: 'sell' });
  const [cx, cy] = itemCenter(it);
  if (back > 0) emit(ctx, { type: 'float', text: `+${money(back)}`, x: cx, y: cy, kind: 'good' });
}
