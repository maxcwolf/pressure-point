// Building: placing, moving and selling items, and creating, changing and removing rooms.

import { ITEMS, type ItemType, ROOMS, type RoomType, WINDOW_COST } from '../data';
import { money } from '../format';
import { sameSpot } from '../state/game';
import type { Guest, Item, Room, Staff, WallSpot } from '../state/types';
import { itemCenter, type Rect } from '../world';
import { System } from './system';

/** How an item is being placed: without charge, or as furniture for a particular room. */
export interface PlaceOptions {
  free?: boolean;
  roomId?: number;
}

export class Building extends System {
  /** Rebuild the grids and reroute everyone after the layout changes. */
  private worldChanged() {
    this.world.rebuild();
    this.sim.movement.repathAll();
  }

  /** Buy an item and put it down, if it fits and can be afforded. */
  placeItem(type: ItemType, x: number, y: number, rot: number, opts: PlaceOptions = {}): Item | null {
    const def = ITEMS[type];
    if (!this.world.canPlaceItem(type, x, y, rot, opts.roomId).ok) return null;
    if (!opts.free && this.s.money < def.cost) {
      this.sim.events.toast(`Not enough money for a ${def.name}.`, 'bad');
      this.sim.events.emit({ type: 'sfx', name: 'error' });
      return null;
    }
    const it: Item = {
      id: this.s.nextId++,
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
      claimedBy: 0,
    };
    this.s.items.push(it);
    if (!opts.free) this.sim.economy.spend(def.cost, 'building');
    this.worldChanged();
    this.sim.events.emit({ type: 'sfx', name: 'place' });
    return it;
  }

  /** Start a new room as a blueprint, not yet paid for. */
  createRoom(type: RoomType, r: Rect, door: Room['door']): Room {
    const room: Room = { id: this.s.nextId++, type, x: r.x, y: r.y, w: r.w, h: r.h, door, windows: [], done: false };
    this.s.rooms.push(room);
    this.worldChanged();
    this.sim.events.emit({ type: 'sfx', name: 'place' });
    return room;
  }

  /** Turn a blueprint into a built room and pay for it. */
  finishRoom(room: Room) {
    room.done = true;
    this.sim.economy.spend(ROOMS[room.type].cost, 'building');
    this.world.version++;
    this.sim.events.toast(`${ROOMS[room.type].name} built!`, 'good');
    this.sim.events.emit({ type: 'sfx', name: 'build' });
  }

  /** The items inside a room. */
  private itemsInRoom(room: Room) {
    return this.s.items.filter((it) => this.world.zoneAt(it.x, it.y) === room.id);
  }

  /** Can this item be picked up and put down here instead? */
  canMoveItem(it: Item, x: number, y: number, rot: number) {
    const zone = this.world.zoneAt(it.x, it.y);
    const at = this.s.items.indexOf(it);
    // judge the new spot as if the item had already been lifted out
    this.s.items.splice(at, 1);
    this.world.rebuild(true);
    const check = this.world.canPlaceItem(it.type, x, y, rot, zone > 0 ? zone : undefined);
    this.s.items.splice(at, 0, it);
    this.world.rebuild(true);
    return check;
  }

  /** Move an item for free. Furniture that belongs to a room has to stay in that room. */
  moveItem(id: number, x: number, y: number, rot: number): boolean {
    const it = this.world.item(id);
    if (!it || !this.canMoveItem(it, x, y, rot).ok) return false;
    const users = this.usersOf(new Set([id]));
    it.x = x;
    it.y = y;
    it.rot = rot;
    this.world.rebuild();
    this.resetUsers(users);
    this.sim.events.emit({ type: 'sfx', name: 'place' });
    return true;
  }

  /** The guests and staff using, waiting on or heading for any of these items. */
  private usersOf(ids: Set<number>) {
    return {
      guests: this.s.guests.filter((g) => ids.has(g.claimItem) || ids.has(g.station)),
      staff: this.s.staff.filter(
        (st) =>
          ids.has(st.post) || ids.has(st.claimItem) || (!!st.job && st.job.kind !== 'litter' && ids.has(st.job.id)),
      ),
    };
  }

  /** Free these people from what they were using and have them start over. */
  private resetUsers({ guests, staff }: { guests: Guest[]; staff: Staff[] }) {
    for (const g of guests) {
      this.sim.claims.release(g);
      this.sim.guests.reset(g);
    }
    for (const st of staff) {
      this.sim.claims.release(st);
      if (st.state !== 'leaving') this.sim.staffing.idle(st);
    }
    for (const it of this.s.items) {
      it.users = it.users.map((u) => (this.sim.chars.char(u) ? u : 0));
    }
    this.sim.movement.repathAll();
  }

  /** Remove items and patch up anyone who was using them. */
  private removeItems(gone: Item[]) {
    const ids = new Set(gone.map((i) => i.id));
    const users = this.usersOf(ids);
    this.s.items = this.s.items.filter((i) => !ids.has(i.id));
    this.world.rebuild();
    for (const g of users.guests) g.claimItem = 0;
    for (const st of users.staff) {
      st.claimItem = 0;
      if (st.job && st.job.kind !== 'litter') st.job = null;
    }
    this.resetUsers(users);
  }

  /** Remove a room. `refund` is the fraction of its cost returned (0 while still a blueprint). */
  removeRoom(roomId: number, refund: number) {
    const room = this.world.room(roomId);
    if (!room) return;
    const items = this.itemsInRoom(room);
    // a blueprint has not been paid for yet, but any extras bought for it have
    let back = room.done ? ROOMS[room.type].cost * refund : 0;
    for (const it of items) back += ITEMS[it.type].cost * refund;
    back += room.windows.length * WINDOW_COST * refund;
    this.s.rooms = this.s.rooms.filter((r) => r !== room);
    this.removeItems(items);
    if (back > 0) {
      this.s.money += back;
      this.s.ledger.building -= back;
      if (room.done) this.sim.events.toast(`${ROOMS[room.type].name} demolished. ${money(back)} recovered.`, 'info');
      this.sim.events.emit({ type: 'sfx', name: 'sell' });
    }
  }

  /** Required furniture a room still lacks, in the order it is asked for. */
  missingItems(room: Room): ItemType[] {
    const have = this.itemsInRoom(room).map((i) => i.type);
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
  toggleWindow(roomId: number, spot: WallSpot): 'added' | 'removed' | '' {
    const room = this.world.room(roomId);
    if (!room) return '';
    const at = room.windows.findIndex((w) => sameSpot(w, spot));
    if (at >= 0) {
      room.windows.splice(at, 1);
      // a blueprint's windows come back in full; a built room's at half, like everything else
      const back = Math.round(WINDOW_COST * (room.done ? 0.5 : 1));
      this.s.money += back;
      this.s.ledger.building -= back;
      this.world.version++;
      this.sim.events.emit({ type: 'sfx', name: 'sell' });
      return 'removed';
    }
    if (!this.world.windowValid(room, spot).ok) return '';
    if (this.s.money < WINDOW_COST) {
      this.sim.events.toast('Not enough money for a window.', 'bad');
      this.sim.events.emit({ type: 'sfx', name: 'error' });
      return '';
    }
    room.windows.push({ ...spot });
    this.sim.economy.spend(WINDOW_COST, 'building');
    this.world.version++;
    this.sim.events.emit({ type: 'sfx', name: 'place' });
    return 'added';
  }

  /** Move a room's door to another stretch of its wall, for free. */
  moveDoor(roomId: number, door: WallSpot): boolean {
    const room = this.world.room(roomId);
    if (!room || sameSpot(room.door, door)) return false;
    if (!this.world.doorValid(room.type, room, door, room).ok) return false;
    room.door = { ...door };
    this.worldChanged();
    this.sim.events.emit({ type: 'sfx', name: 'place' });
    return true;
  }

  /** Whether an item can be sold. A room has to keep one of each thing it requires. */
  canSell(it: Item): boolean {
    const room = this.world.roomOfItem(it);
    if (!room) return true;
    const def = ROOMS[room.type];
    if (!def.required.includes(it.type)) return true;
    return this.itemsInRoom(room).filter((o) => o.type === it.type).length > 1;
  }

  /** Sell an item for half of what it cost. */
  sellItem(id: number) {
    const it = this.world.item(id);
    if (!it || !this.canSell(it)) return;
    const back = Math.round(ITEMS[it.type].cost * 0.5);
    this.removeItems([it]);
    this.s.money += back;
    this.s.ledger.building -= back;
    this.sim.events.emit({ type: 'sfx', name: 'sell' });
    const [cx, cy] = itemCenter(it);
    if (back > 0) this.sim.events.emit({ type: 'float', text: `+${money(back)}`, x: cx, y: cy, kind: 'good' });
  }
}
