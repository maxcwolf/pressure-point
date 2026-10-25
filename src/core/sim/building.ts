// Building: placing, moving and selling items, and creating, changing and removing rooms.

import { certificatesLeft } from '../certificates';
import {
  ITEMS,
  type ItemType,
  ROOM_TILE_COST,
  ROOMS,
  type RoomType,
  type RugPatternId,
  SPRINKLER_COST,
  SPRINKLER_STAR,
  type ThermostatSetting,
  WINDOW_COST,
} from '../data';
import { money } from '../format';
import { carryWallSpot, carryWindows, coveredSize, looksOnto, paidTiles, resizeCost, resizeTiles } from '../resize';
import { copyCost, type Layout, layoutOf, type PlacedLayout } from '../room-layout';
import { itemStart, roomStart, sameSpot, unlockedUpTo } from '../state/game';
import type { Guest, Item, Room, Staff, WallSpot } from '../state/types';
import { footprint, itemCenter, onWall, type Rect, wallSpotsOf } from '../world';
import { forgetRoom } from './assignments';
import { charById } from './chars';
import { release } from './claims';
import type { SimContext } from './context';
import { decorFor, withDecor } from './decor';
import { recoup, spend } from './economy';
import { emit, toast } from './events';
import { goWait, resetGuest } from './guests';
import { halt, repathAll } from './movement';
import { inLine } from './queues';
import { staffIdle } from './staffing';
import { backToStudy } from './training';
import { upgradeSpent } from './upgrades';

/** How an item is being placed: without charge, or as furniture for a particular room. */
export interface PlaceOptions {
  free?: boolean;
  roomId?: number;
  /** A rug's pattern. */
  pattern?: RugPatternId;
}

/** Rebuild the grids and reroute everyone after the layout changes. */
function worldChanged(ctx: SimContext) {
  ctx.world.rebuild();
  sweepCovered(ctx);
  repathAll(ctx);
}

/** Litter that something now stands on could never be reached to be cleared, so it goes with the change. */
function sweepCovered(ctx: SimContext) {
  if (ctx.s.litter.some((l) => !ctx.world.walkable(l.x, l.y)))
    ctx.s.litter = ctx.s.litter.filter((l) => ctx.world.walkable(l.x, l.y));
}

/** A brand-new item, not yet in the game. */
function newItem(ctx: SimContext, type: ItemType, x: number, y: number, rot: number, pattern?: RugPatternId): Item {
  // a certificate is for the oldest award not yet hung
  const trophy = type === 'certificate' ? certificatesLeft(ctx.s)[0] : undefined;
  return {
    ...(type === 'rug' && pattern && pattern !== 'kilim' && { pattern }),
    ...(trophy && { trophy: { ...trophy } }),
    id: ctx.s.nextId++,
    type,
    x,
    y,
    rot,
    users: ITEMS[type].access.map(() => 0),
    queue: [],
    serving: 0,
    staffId: 0,
    progress: 0,
    // a hamper starts empty; everything else starts watered, or hot
    water: type === 'linen_hamper' ? 0 : 100,
    ...itemStart(),
  };
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
  const it = newItem(ctx, type, x, y, rot, opts.pattern);
  ctx.s.items.push(it);
  if (!opts.free) {
    spend(ctx, def.cost, 'building');
    // the price floats off it, as a refund does when it is sold
    const [cx, cy] = itemCenter(it);
    if (def.cost > 0) emit(ctx, { type: 'float', text: money(-def.cost), x: cx, y: cy, kind: 'bad' });
  }
  worldChanged(ctx);
  emit(ctx, { type: 'sfx', name: 'place' });
  return it;
}

/** Change a rug's pattern, for free: it is for looks alone. */
export function setRugPattern(ctx: SimContext, id: number, pattern: RugPatternId) {
  const it = ctx.world.item(id);
  if (it?.type !== 'rug') return;
  if (pattern === 'kilim') delete it.pattern;
  else it.pattern = pattern;
  // nothing has moved, but the view has a rug to draw afresh
  ctx.world.version++;
}

/** Set a heater or air conditioner's thermostat, or with `every` the thermostat of every one of its kind. */
export function setThermostat(ctx: SimContext, id: number, setting: ThermostatSetting, every = false) {
  const it = ctx.world.item(id);
  if (!it || !ITEMS[it.type].thermostat) return;
  for (const one of every ? ctx.s.items.filter((x) => x.type === it.type) : [it]) {
    if (setting === 'auto') delete one.thermostat;
    else one.thermostat = setting;
  }
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
    ...roomStart(),
    // decorated as the last rooms of its kind were, if every room like them was given a look
    ...decorFor(ctx.s.roomDecor, type),
  };
  ctx.s.rooms.push(room);
  worldChanged(ctx);
  emit(ctx, { type: 'sfx', name: 'place' });
  return room;
}

/**
 * What finishing a blueprint costs: the room's price, which covers floor up to one tile more each way than its
 * smallest, and the floor past that at the price a resize charges. `tiles` is that floor, less any already paid for
 * by resizing the blueprint.
 */
export function finishCost(room: Room): { cost: number; tiles: number } {
  const tiles = Math.max(0, paidTiles(room.type, room) - (room.bought ?? 0));
  return { cost: ROOMS[room.type].cost + tiles * ROOM_TILE_COST, tiles };
}

/** Turn a blueprint into a built room and pay for it, its floor past what its price covers included. */
export function finishRoom(ctx: SimContext, room: Room) {
  const { cost, tiles } = finishCost(room);
  room.done = true;
  // floor paid for is given back as floor bought by resizing is, when the room is shrunk or sold
  if (tiles) room.bought = (room.bought ?? 0) + tiles;
  spend(ctx, cost, 'building');
  ctx.world.version++;
  const name = ROOMS[room.type].name;
  toast(
    ctx,
    tiles
      ? `${name} built! ${money(cost)}, ${money(tiles * ROOM_TILE_COST)} of it for ${tiles} tiles of floor past ${coveredSize(room.type)}.`
      : `${name} built!`,
    'good',
    { kind: 'room', id: room.id },
  );
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

/** The other items standing beside an item: any of their tiles next to any of its own, corners included. */
export function itemsBeside(ctx: SimContext, it: Item): Item[] {
  const near = new Set<string>();
  for (const [x, y] of footprint(it))
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) near.add(`${x + dx},${y + dy}`);
  return ctx.s.items.filter((o) => o !== it && footprint(o).some(([x, y]) => near.has(`${x},${y}`)));
}

/** Can this item be picked up and put down here instead? */
export function canMoveItem(ctx: SimContext, it: Item, x: number, y: number, rot: number) {
  const zone = ctx.world.zoneAt(it.x, it.y);
  const at = ctx.s.items.indexOf(it);
  // an item that is not in the game has nothing to move, and splicing at -1 would lift out the last one instead
  if (at < 0) return { ok: false, reason: 'That item is gone' };
  if (ctx.s.blazes.some((b) => b.item === it.id)) return { ok: false, reason: 'It is on fire' };
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
  sweepCovered(ctx);
  resetUsers(ctx, users);
  emit(ctx, { type: 'sfx', name: 'place' });
  return true;
}

/** The guests and staff using, waiting on or heading for any of these items: the guests in the order of their lines. */
export function usersOf(ctx: SimContext, ids: Set<number>) {
  /** Where a guest stands in their line: the one being seen ahead of the rest, and anyone in none behind. */
  const place = (g: Guest) => {
    const st = ctx.world.item(g.station);
    if (!st) return Number.MAX_SAFE_INTEGER;
    return st.serving === g.id ? -1 : st.queue.indexOf(g.id);
  };
  return {
    guests: ctx.s.guests.filter((g) => ids.has(g.claimItem) || ids.has(g.station)).sort((a, b) => place(a) - place(b)),
    staff: ctx.s.staff.filter(
      (st) => ids.has(st.post) || ids.has(st.claimItem) || (!!st.job && st.job.kind !== 'litter' && ids.has(st.job.id)),
    ),
  };
}

/**
 * Free these people from what they were using and have them start over. A line whose station still stands is kept
 * as it was: anyone waiting in it keeps their place, and anyone called to it or being seen there goes back to its
 * front. Anyone whose station has gone joins another line, in the order they stood in theirs.
 */
function resetUsers(ctx: SimContext, { guests, staff }: { guests: Guest[]; staff: Staff[] }) {
  for (const g of guests) {
    const station = ctx.world.item(g.station);
    if (station && (inLine(g) || station.serving === g.id)) {
      if (station.serving === g.id) {
        station.serving = 0;
        station.progress = 0;
        station.queue.unshift(g.id);
      }
      halt(g);
      goWait(ctx, g);
      continue;
    }
    release(ctx, g);
    resetGuest(ctx, g);
  }
  for (const st of staff) {
    release(ctx, st);
    // someone on a course carries on with it at a desk, if one can still be reached
    if (st.state === 'leaving') continue;
    if (st.training) backToStudy(ctx, st);
    else staffIdle(ctx, st);
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
  // whatever was burning on them burns no more
  ctx.s.blazes = ctx.s.blazes.filter((b) => !ids.has(b.item));
  // a fire whose last flames went with what was sold is out, with nothing put out
  if (!ctx.s.blazes.length && ctx.s.fire && !ctx.s.fire.out) ctx.s.fire = { ...ctx.s.fire, out: true };
  ctx.world.rebuild();
  // a seat on something that is going has nothing left to give back; a seat elsewhere is released as usual
  for (const st of users.staff) if (st.job && st.job.kind !== 'litter') st.job = null;
  resetUsers(ctx, users);
}

/** What removing a room gives back: `refund` of whatever was paid for it, its extras, their upgrades and its windows. */
export function roomRefund(ctx: SimContext, room: Room, refund: number) {
  // a blueprint has not been paid for yet, but any extras bought for it have
  let back = room.done ? ROOMS[room.type].cost * refund : 0;
  // the required furniture came free with the room, so only what is left over was bought
  const free = [...ROOMS[room.type].required];
  for (const it of itemsInRoom(ctx, room)) {
    back += upgradeSpent(it) * refund;
    const at = free.indexOf(it.type);
    if (at >= 0) free.splice(at, 1);
    else back += ITEMS[it.type].cost * refund;
  }
  // floor bought by resizing it was paid for too, and so were its sprinklers
  back += (room.bought ?? 0) * ROOM_TILE_COST * refund;
  if (room.sprinklers) back += SPRINKLER_COST * refund;
  return back + room.windows.length * WINDOW_COST * refund;
}

/** Remove a room. `refund` is the fraction of its cost returned (0 while still a blueprint). */
export function removeRoom(ctx: SimContext, roomId: number, refund: number) {
  const room = ctx.world.room(roomId);
  if (!room) return;
  const items = itemsInRoom(ctx, room);
  const back = roomRefund(ctx, room, refund);
  ctx.s.rooms = ctx.s.rooms.filter((r) => r !== room);
  forgetRoom(ctx, room.id);
  removeItems(ctx, items);
  if (back > 0) {
    recoup(ctx, back, 'building');
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
    recoup(ctx, back, 'building');
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

/** Why sprinklers cannot be fitted in a room now, if they cannot: not unlocked yet, there already, or too dear. */
export function sprinklerBlocker(ctx: SimContext, room: Room): string | null {
  if (room.sprinklers) return 'Sprinklers fitted';
  if (unlockedUpTo(ctx.s) < SPRINKLER_STAR) return `Sprinklers unlock at star ${SPRINKLER_STAR}`;
  if (!room.done) return 'Finish the room first';
  if (ctx.s.money < SPRINKLER_COST) return `Sprinklers cost ${money(SPRINKLER_COST)}`;
  return null;
}

/**
 * Fit sprinklers in a finished room, from the star that unlocks them: a fire there is put out on its own, before it
 * can spread, though the room is soaked doing it. False if they cannot be fitted.
 */
export function fitSprinklers(ctx: SimContext, roomId: number): boolean {
  const room = ctx.world.room(roomId);
  if (!room) return false;
  const blocker = sprinklerBlocker(ctx, room);
  if (blocker) {
    if (!room.sprinklers) toast(ctx, `${blocker}.`, 'bad');
    emit(ctx, { type: 'sfx', name: 'error' });
    return false;
  }
  spend(ctx, SPRINKLER_COST, 'building');
  room.sprinklers = true;
  ctx.world.version++;
  emit(ctx, { type: 'sfx', name: 'cash' });
  toast(
    ctx,
    `Sprinklers fitted in the ${ROOMS[room.type].name}. A fire there will go out on its own before it spreads, though the room will need mopping after.`,
    'good',
    { kind: 'room', id: room.id },
    'item-fire-extinguisher',
  );
  return true;
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
 * Give a room a new shape. Floor added past what the room's price covers is paid for, and floor paid for that is
 * taken away half refunded; the door and windows move with their walls, and a window whose stretch of wall is gone, or that would look into another room, is refunded
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
  const hung = itemsInRoom(ctx, room).filter((it) => onWall(it.type));
  const { bought } = resizeTiles(room, r);
  Object.assign(room, { x: r.x, y: r.y, w: r.w, h: r.h, door, windows: [], bought });
  ctx.world.rebuild(true);
  // only now can a window be judged against the room's new walls and its new neighbors
  for (const w of carried) if (ctx.world.windowValid(room, w).ok) room.windows.push(w);
  const sold = rehang(ctx, room, hung, r);
  const back = (windows - room.windows.length) * Math.round(WINDOW_COST / 2) + sold - Math.min(cost, 0);
  if (cost > 0) spend(ctx, cost, 'building');
  if (back > 0) {
    recoup(ctx, back, 'building');
  }
  worldChanged(ctx);
  emit(ctx, { type: 'sfx', name: 'build' });
  return true;
}

/**
 * Hang a room's wall items again once its walls have moved, each carried along with its wall as a window is, and take
 * down any whose stretch of wall is gone or taken. Returns what those fetch when sold.
 */
function rehang(ctx: SimContext, room: Room, hung: readonly Item[], to: Rect): number {
  const all = ctx.s.items;
  ctx.s.items = all.filter((it) => !hung.includes(it));
  const kept = new Set<Item>();
  for (const it of hung) {
    const [first] = wallSpotsOf(it);
    const spot = first && carryWallSpot(first, to);
    if (!spot || !ctx.world.canPlaceItem(it.type, spot.x, spot.y, it.rot, room.id).ok) continue;
    it.x = spot.x;
    it.y = spot.y;
    ctx.s.items.push(it);
    kept.add(it);
  }
  ctx.s.items = all;
  return takeDown(
    ctx,
    hung.filter((it) => !kept.has(it)),
  );
}

/** Take things down off the walls and sell them back, saying so. Returns what they fetched. */
function takeDown(ctx: SimContext, gone: readonly Item[]): number {
  if (!gone.length) return 0;
  const back = gone.reduce((sum, it) => sum + sellBack(it), 0);
  removeItems(ctx, [...gone]);
  const [one] = gone;
  toast(
    ctx,
    one && gone.length === 1
      ? `The ${ITEMS[one.type].name} had no wall left to hang on, so it was sold for ${money(back)}.`
      : `${gone.length} things had no wall left to hang on, so they were sold for ${money(back)}.`,
    'info',
  );
  return back;
}

/** Take down and sell anything hung on a stretch of wall that is no longer there, as when the building grows over it. */
export function takeDownLoose(ctx: SimContext) {
  const loose = ctx.s.items.filter((it) => onWall(it.type) && wallSpotsOf(it).some((w) => !ctx.world.wallFace(w).ok));
  const back = takeDown(ctx, loose);
  if (back <= 0) return;
  recoup(ctx, back, 'building');
}

/** Keep only the windows that can go in a room where it now stands, and say how many could not. */
function keepWindows(ctx: SimContext, room: Room, windows: readonly WallSpot[]): number {
  room.windows = [];
  ctx.world.rebuild(true);
  for (const w of windows) if (ctx.world.windowValid(room, w).ok) room.windows.push({ ...w });
  return windows.length - room.windows.length;
}

/**
 * Take out the windows of the rooms next door that look onto where a room has been put down, and say so. Each gives
 * back what taking it out by hand would: half its price, or all of it in a blueprint.
 */
function closeWindowsOnto(ctx: SimContext, room: Room) {
  let n = 0;
  let back = 0;
  let from: Room | undefined;
  for (const other of ctx.s.rooms) {
    if (other === room) continue;
    const kept = other.windows.filter((w) => !looksOnto(w, room));
    const gone = other.windows.length - kept.length;
    if (!gone) continue;
    other.windows = kept;
    n += gone;
    back += gone * Math.round(WINDOW_COST * (other.done ? 0.5 : 1));
    from = other;
  }
  if (!n || !from) return;
  ctx.world.version++;
  recoup(ctx, back, 'building');
  toast(
    ctx,
    n === 1
      ? `The ${ROOMS[from.type].name}'s window onto it was taken out and sold for ${money(back)}.`
      : `${n} windows next door that looked onto it were taken out and sold for ${money(back)}.`,
    'info',
  );
}

/**
 * Pick a built room up, furniture and all, and put it down elsewhere, turned if wanted, for free. Everyone using it
 * starts over, and a window that would now look into another room, its own or one next door, is refunded at half.
 * False if it cannot go there.
 */
export function moveRoom(ctx: SimContext, roomId: number, placed: PlacedLayout): boolean {
  const room = ctx.world.room(roomId);
  if (!room?.done) return false;
  const items = itemsInRoom(ctx, room);
  if (items.length !== placed.items.length || !ctx.world.layoutValid(room.type, placed, room).ok) return false;
  const users = usersOf(ctx, new Set(items.map((it) => it.id)));
  Object.assign(room, placed.rect, { door: { ...placed.door } });
  // the layout lists the furniture in the order the room's items were in
  items.forEach((it, i) => Object.assign(it, placed.items[i]));
  const lost = keepWindows(ctx, room, placed.windows);
  refundWindows(ctx, lost);
  closeWindowsOnto(ctx, room);
  worldChanged(ctx);
  resetUsers(ctx, users);
  emit(ctx, { type: 'sfx', name: 'build' });
  return true;
}

/** Give back half the price of windows that had to go. */
function refundWindows(ctx: SimContext, count: number) {
  const back = count * Math.round(WINDOW_COST / 2);
  if (back <= 0) return;
  recoup(ctx, back, 'building');
}

/**
 * Build a copy of a room, furniture, windows and all, at a spot. It costs what building it from scratch would, and
 * opens at once; any window next door that looks onto it is taken out. Returns the new room, or null if it cannot go
 * there or cannot be afforded.
 */
export function copyRoom(ctx: SimContext, roomId: number, placed: PlacedLayout): Room | null {
  const from = ctx.world.room(roomId);
  if (!from?.done) return null;
  const name = ROOMS[from.type].name;
  return buildLayout(ctx, layoutOf(from, itemsInRoom(ctx, from)), placed, {
    cost: `A copy of the ${name}`,
    built: `${name} copied`,
  });
}

/**
 * Build a room from a layout, furniture, windows and all, at a spot, for what building it from scratch would cost.
 * It opens at once. `say` words the messages: what it costs ("A copy of the Massage Suite costs...") and that it was
 * built ("Massage Suite copied for..."). Returns the new room, or null if it cannot go there or cannot be afforded.
 */
export function buildLayout(
  ctx: SimContext,
  layout: Layout,
  placed: PlacedLayout,
  say: { cost: string; built: string },
): Room | null {
  if (!ctx.world.layoutValid(layout.type, placed).ok) return null;
  const cost = copyCost(layout);
  if (ctx.s.money < cost) {
    toast(ctx, `${say.cost} costs ${money(cost)}. You can't afford it.`, 'bad');
    emit(ctx, { type: 'sfx', name: 'error' });
    return null;
  }
  const room: Room = {
    id: ctx.s.nextId++,
    type: layout.type,
    ...placed.rect,
    door: { ...placed.door },
    windows: [],
    done: true,
    priority: false,
    vibes: 0,
    claimedBy: 0,
    // its floor past what its price covers is paid for in the copy's cost, and comes back as floor bought by resizing does
    ...(paidTiles(layout.type, layout) > 0 && { bought: paidTiles(layout.type, layout) }),
    ...withDecor({}, layout),
  };
  ctx.s.rooms.push(room);
  // a certificate is earned, not built: a copy of a room leaves its certificates behind
  for (const it of placed.items.filter((i) => i.type !== 'certificate'))
    ctx.s.items.push(newItem(ctx, it.type, it.x, it.y, it.rot, it.pattern));
  const lost = keepWindows(ctx, room, placed.windows);
  spend(ctx, cost - lost * WINDOW_COST, 'building');
  toast(ctx, `${say.built} for ${money(cost - lost * WINDOW_COST)}.`, 'good', { kind: 'room', id: room.id });
  closeWindowsOnto(ctx, room);
  worldChanged(ctx);
  emit(ctx, { type: 'sfx', name: 'build' });
  return room;
}

/** Whether an item can be sold. A room has to keep as many of each thing as it requires. */
export function canSell(ctx: SimContext, it: Item): boolean {
  const room = ctx.world.roomOfItem(it);
  if (!room) return true;
  // a room that requires two of something, as a Sound Bath Studio does its mats, has to keep both
  const needs = ROOMS[room.type].required.filter((t) => t === it.type).length;
  if (!needs) return true;
  return itemsInRoom(ctx, room).filter((o) => o.type === it.type).length > needs;
}

/** What selling an item gives back: half of what it cost, its upgrades included. */
export function sellBack(it: Item): number {
  return Math.round((ITEMS[it.type].cost + upgradeSpent(it)) * 0.5);
}

/** Sell an item for half of what it cost, its upgrades included. */
export function sellItem(ctx: SimContext, id: number) {
  const it = ctx.world.item(id);
  if (!it || !canSell(ctx, it)) return;
  const back = sellBack(it);
  removeItems(ctx, [it]);
  recoup(ctx, back, 'building');
  emit(ctx, { type: 'sfx', name: 'sell' });
  const [cx, cy] = itemCenter(it);
  if (back > 0) emit(ctx, { type: 'float', text: `+${money(back)}`, x: cx, y: cy, kind: 'good' });
}
