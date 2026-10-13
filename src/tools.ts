// Build tools and selection: turns pointer input into rooms, doors, windows and furniture.
//
// Building a room goes: drag out the floor, click a wall for the door, then a
// blueprint step. In the blueprint the required furniture goes in, windows and
// extras can be added, the door can be moved, and nothing is charged for the room
// until it is confirmed.
import { type AccessRole, ITEMS, type ItemType, ROOMS, type RoomType, WINDOW_COST } from './core/data';
import { money } from './core/format';
import type { SfxName } from './core/sim/events';
import { type Sim } from './core/sim/sim';
import { sameSpot } from './core/state/game';
import { type Room, type WallSpot } from './core/state/types';
import { accessTile, footprint, inBuilding, itemDims, type Rect, tileIdx, Z_CORRIDOR } from './core/world';
import {
  type Marker,
  OV_BAD,
  OV_BLUE,
  OV_FREE,
  OV_GOOD,
  OV_GUEST,
  OV_STAFF,
  type OverlayTile,
  type Selection,
  type View,
} from './render/view';

/** What is in hand while a blueprint is open. */
type PlanSub =
  null | { kind: 'item'; type: ItemType; rot: number; required: boolean } | { kind: 'window' } | { kind: 'door' };

type Tool =
  | { kind: 'none' }
  | { kind: 'item'; type: ItemType; rot: number }
  | { kind: 'move'; id: number; type: ItemType; rot: number }
  | { kind: 'room'; type: RoomType; phase: 'drag'; start: [number, number] | null; rect: Rect | null }
  | { kind: 'room'; type: RoomType; phase: 'door'; rect: Rect }
  | { kind: 'room'; type: RoomType; phase: 'plan'; room: Room; sub: PlanSub }
  // on a room that is already built
  | { kind: 'window'; roomId: number }
  | { kind: 'door'; roomId: number };

/** Who a square next to a piece of furniture is for. */
const STAFF_ROLES: AccessRole[] = ['staff', 'rest', 'study'];
export const STAFF_ICON = '🧑‍⚕️';
export const GUEST_ICON = '🧍';

/** The state of an open blueprint, for the panel that shows it. */
export interface PlanStatus {
  room: Room;
  missing: ItemType[];
  /** What is in hand: 'door', 'window', an item type, or '' for nothing. */
  holding: string;
  ready: boolean;
}

export class Tools {
  tool: Tool = { kind: 'none' };
  /** One-line instruction shown while a tool is active. */
  hint = '';
  /** Why the current placement is invalid, if it is. */
  problem = '';
  private cursor: { x: number; y: number } | null = null;

  constructor(
    private sim: Sim,
    private view: View,
    private onChange: () => void,
    private sfx: (name: SfxName) => void,
  ) {}

  get active() {
    return this.tool.kind !== 'none';
  }
  get selected(): Selection | null {
    return this.view.selected;
  }
  select(sel: Selection | null) {
    this.view.selected = sel;
    this.onChange();
  }

  /** The open blueprint, if there is one. */
  get plan(): PlanStatus | null {
    const t = this.tool;
    if (t.kind !== 'room' || t.phase !== 'plan') return null;
    const missing = this.sim.missingItems(t.room);
    const sub = t.sub;
    return {
      room: t.room,
      missing,
      holding: !sub ? '' : sub.kind === 'item' ? sub.type : sub.kind,
      ready: missing.length === 0,
    };
  }

  /** Pick something to place. With a blueprint open it is added to the blueprint's session instead of replacing it. */
  startItem(type: ItemType) {
    const t = this.tool;
    if (t.kind === 'room' && t.phase === 'plan') {
      t.sub = { kind: 'item', type, rot: 0, required: this.sim.missingItems(t.room).includes(type) };
      this.refresh();
      return;
    }
    this.cancel();
    this.tool = { kind: 'item', type, rot: 0 };
    this.select(null);
    this.refresh();
  }

  /** Pick up an existing item to put it down somewhere else. */
  startMove(id: number) {
    this.cancel();
    const it = this.sim.world.item(id);
    if (!it) return;
    this.tool = { kind: 'move', id, type: it.type, rot: it.rot };
    this.refresh();
  }

  startRoom(type: RoomType) {
    this.cancel();
    const def = ROOMS[type];
    if (this.sim.s.money < def.cost) {
      this.sim.emit({
        type: 'toast',
        text: `A ${def.name} costs ${money(def.cost)}. You can't afford it yet.`,
        kind: 'bad',
      });
      this.sfx('error');
      return;
    }
    this.tool = { kind: 'room', type, phase: 'drag', start: null, rect: null };
    this.select(null);
    this.refresh();
  }

  /** Add and remove windows on a room that is already built. */
  startWindows(roomId: number) {
    this.cancel();
    if (!this.sim.world.room(roomId)) return;
    this.tool = { kind: 'window', roomId };
    this.refresh();
  }

  /** Move the door of a room that is already built. */
  startMoveDoor(roomId: number) {
    this.cancel();
    if (!this.sim.world.room(roomId)) return;
    this.tool = { kind: 'door', roomId };
    this.refresh();
  }

  /** In a blueprint: take up the door, the window tool, or nothing. */
  planHold(what: 'window' | 'door' | '') {
    const t = this.tool;
    if (t.kind !== 'room' || t.phase !== 'plan') return;
    t.sub = what ? { kind: what } : null;
    this.refresh();
  }

  /** Confirm the blueprint: the room is charged for and opens. */
  planBuild(): boolean {
    const t = this.tool;
    if (t.kind !== 'room' || t.phase !== 'plan' || this.sim.missingItems(t.room).length) return false;
    this.sim.finishRoom(t.room);
    this.tool = { kind: 'none' };
    this.select({ kind: 'room', id: t.room.id });
    this.refresh();
    return true;
  }

  /** Drop the current tool entirely. A blueprint is torn up and anything bought for it refunded. */
  cancel() {
    const t = this.tool;
    if (t.kind === 'room' && t.phase === 'plan') this.sim.removeRoom(t.room.id, 1);
    this.tool = { kind: 'none' };
    this.refresh();
  }

  /** Put down whatever is in hand, but keep an open blueprint open. Used when a menu is opened. */
  setAside() {
    const t = this.tool;
    if (t.kind === 'room' && t.phase === 'plan') {
      t.sub = null;
      this.refresh();
    } else this.cancel();
  }

  /** Esc or right-click: put down what is in hand; with empty hands, leave the tool. */
  back() {
    const t = this.tool;
    if (t.kind === 'room' && t.phase === 'plan' && t.sub) {
      t.sub = null;
      this.refresh();
    } else this.cancel();
  }

  rotate() {
    const t = this.tool;
    const held =
      t.kind === 'item' || t.kind === 'move'
        ? t
        : t.kind === 'room' && t.phase === 'plan' && t.sub?.kind === 'item'
          ? t.sub
          : null;
    if (!held) return;
    held.rot = (held.rot + 1) & 3;
    this.sfx('blip');
    this.refresh();
  }

  pointerMove(clientX: number, clientY: number) {
    this.cursor = this.view.groundAt(clientX, clientY);
    const t = this.tool;
    if (t.kind === 'room' && t.phase === 'drag' && t.start && this.cursor) {
      const cx = Math.floor(this.cursor.x);
      const cy = Math.floor(this.cursor.y);
      t.rect = {
        x: Math.min(t.start[0], cx),
        y: Math.min(t.start[1], cy),
        w: Math.abs(cx - t.start[0]) + 1,
        h: Math.abs(cy - t.start[1]) + 1,
      };
    }
    if (this.active) this.refresh();
  }

  pointerDown(clientX: number, clientY: number) {
    this.cursor = this.view.groundAt(clientX, clientY);
    const t = this.tool;
    if (t.kind === 'room' && t.phase === 'drag' && this.cursor) {
      const x = Math.floor(this.cursor.x);
      const y = Math.floor(this.cursor.y);
      t.start = [x, y];
      t.rect = { x, y, w: 1, h: 1 };
      this.refresh();
    }
  }

  /** Left button released as a click (or at the end of dragging out a room). */
  pointerUp(clientX: number, clientY: number) {
    this.cursor = this.view.groundAt(clientX, clientY);
    const t = this.tool;
    const sim = this.sim;
    if (t.kind === 'none') {
      this.select(this.view.pick(clientX, clientY));
      if (this.selected) this.sfx('blip');
      return;
    }
    if (t.kind === 'item') {
      const spot = this.itemSpot(t.type, t.rot);
      if (spot && sim.placeItem(t.type, spot[0], spot[1], t.rot)) this.onChange();
      else if (spot) this.sfx('error');
    } else if (t.kind === 'move') {
      const spot = this.itemSpot(t.type, t.rot);
      if (spot && sim.moveItem(t.id, spot[0], spot[1], t.rot)) {
        this.tool = { kind: 'none' };
        this.select({ kind: 'item', id: t.id });
      } else if (spot) this.sfx('error');
    } else if (t.kind === 'window') {
      this.clickWindow(t.roomId);
    } else if (t.kind === 'door') {
      if (this.clickDoor(t.roomId)) {
        this.tool = { kind: 'none' };
        this.select({ kind: 'room', id: t.roomId });
      }
    } else if (t.phase === 'drag') {
      const rect = t.rect;
      t.start = null;
      if (rect && sim.world.roomRectValid(t.type, rect).ok) {
        this.tool = { kind: 'room', type: t.type, phase: 'door', rect };
        this.sfx('place');
      } else {
        if (rect && rect.w * rect.h > 1) this.sfx('error');
        t.rect = null;
      }
    } else if (t.phase === 'door') {
      if (!this.cursor) return;
      const door = sim.world.nearestDoor(t.rect, this.cursor.x, this.cursor.y);
      if (sim.world.doorValid(t.type, t.rect, door).ok) {
        const room = sim.createRoom(t.type, t.rect, door);
        // straight on to the first piece of required furniture
        this.tool = { kind: 'room', type: t.type, phase: 'plan', room, sub: this.nextRequired(room) };
      } else this.sfx('error');
    } else {
      const sub = t.sub;
      if (sub?.kind === 'item') {
        const spot = this.itemSpot(sub.type, sub.rot);
        // required furniture is part of the room's price and has to go inside it; extras are bought as they are placed
        const opts = sub.required ? { free: true, roomId: t.room.id } : {};
        if (spot && sim.placeItem(sub.type, spot[0], spot[1], sub.rot, opts)) {
          if (sub.required) t.sub = this.nextRequired(t.room);
        } else if (spot) this.sfx('error');
      } else if (sub?.kind === 'window') this.clickWindow(t.room.id);
      else if (sub?.kind === 'door') {
        if (this.clickDoor(t.room.id)) t.sub = null;
      }
    }
    this.refresh();
  }

  /** The next piece of required furniture to hand over, or nothing once it is all in. */
  private nextRequired(room: Room): PlanSub {
    const next = this.sim.missingItems(room)[0];
    return next ? { kind: 'item', type: next, rot: 0, required: true } : null;
  }

  private wallSpot(room: Room): WallSpot | null {
    return this.cursor ? this.sim.world.nearestDoor(room, this.cursor.x, this.cursor.y) : null;
  }
  private clickWindow(roomId: number) {
    const room = this.sim.world.room(roomId);
    const spot = room && this.wallSpot(room);
    if (!room || !spot || !this.sim.toggleWindow(roomId, spot)) this.sfx('error');
  }
  private clickDoor(roomId: number): boolean {
    const room = this.sim.world.room(roomId);
    const spot = room && this.wallSpot(room);
    if (room && spot && this.sim.moveDoor(roomId, spot)) return true;
    this.sfx('error');
    return false;
  }

  /** Top-left tile for an item centered on the cursor. */
  private itemSpot(type: ItemType, rot: number): [number, number] | null {
    if (!this.cursor) return null;
    const [w, h] = itemDims(type, rot);
    return [Math.floor(this.cursor.x - w / 2 + 0.5), Math.floor(this.cursor.y - h / 2 + 0.5)];
  }

  /** Ghost, footprint and the squares people will use, marked by who they are for. */
  private itemOverlay(
    type: ItemType,
    rot: number,
    roomId: number | undefined,
    tiles: OverlayTile[],
    markers: Marker[],
    movingId = 0,
  ) {
    const spot = this.itemSpot(type, rot);
    if (!spot) {
      this.view.setGhost(null);
      return;
    }
    const moving = this.sim.world.item(movingId);
    const check = moving
      ? this.sim.canMoveItem(moving, spot[0], spot[1], rot)
      : this.sim.world.canPlaceItem(type, spot[0], spot[1], rot, roomId);
    const placed = { type, x: spot[0], y: spot[1], rot };
    for (const [x, y] of footprint(placed)) tiles.push([x, y, check.ok ? OV_GOOD : OV_BAD]);
    ITEMS[type].access.forEach((a, i) => {
      const [x, y] = accessTile(placed, i);
      const staff = STAFF_ROLES.includes(a.role);
      tiles.push([x, y, staff ? OV_STAFF : OV_GUEST]);
      markers.push({ x, y, icon: staff ? STAFF_ICON : GUEST_ICON });
    });
    this.problem = check.reason;
    this.view.setGhost({ ...placed, ok: check.ok });
  }

  /** A line for the hint saying what the colored squares mean, when the item has any. */
  private legend(type: ItemType): string {
    const roles = ITEMS[type].access.map((a) => STAFF_ROLES.includes(a.role));
    const parts = [];
    if (roles.includes(true)) parts.push(`${STAFF_ICON} purple square: staff`);
    if (roles.includes(false)) parts.push(`${GUEST_ICON} orange square: guests`);
    return parts.length ? ` · ${parts.join(' · ')}` : '';
  }

  /** Marker and hint for the window tool on one room. */
  private windowOverlay(room: Room) {
    this.view.setGhost(null);
    this.hint = `🪟 Windows · ${money(WINDOW_COST)} each · click a wall to add one, or a window to remove it · Esc when done`;
    const spot = this.wallSpot(room);
    if (!spot) return;
    if (room.windows.some((w) => sameSpot(w, spot))) this.view.setDoor({ door: spot, tone: 'remove' });
    else {
      const check = this.sim.world.windowValid(room, spot);
      this.problem = check.reason;
      this.view.setDoor({ door: spot, tone: check.ok ? 'ok' : 'bad' });
    }
  }
  private doorOverlay(room: Room) {
    this.view.setGhost(null);
    this.hint = '🚪 Click a wall to move the door there · Esc cancels';
    const spot = this.wallSpot(room);
    if (!spot || sameSpot(spot, room.door)) return;
    const check = this.sim.world.doorValid(room.type, room, spot, room);
    this.problem = check.reason;
    this.view.setDoor({ door: spot, tone: check.ok ? 'ok' : 'bad' });
  }

  /** Recompute overlays, ghost and hint for the current tool state. */
  refresh() {
    const t = this.tool;
    const view = this.view;
    const world = this.sim.world;
    const tiles: OverlayTile[] = [];
    const markers: Marker[] = [];
    this.problem = '';
    this.hint = '';
    view.setDoor(null);
    if (t.kind === 'none') {
      view.setGhost(null);
    } else if (t.kind === 'item') {
      const def = ITEMS[t.type];
      this.hint = `${def.icon} ${def.name} · ${money(def.cost)} each · click to place · R rotates · Esc when done${this.legend(t.type)}`;
      this.itemOverlay(t.type, t.rot, undefined, tiles, markers);
    } else if (t.kind === 'move') {
      const def = ITEMS[t.type];
      this.hint = `${def.icon} Moving the ${def.name} · click to put it down · R rotates · Esc cancels${this.legend(t.type)}`;
      this.itemOverlay(t.type, t.rot, undefined, tiles, markers, t.id);
    } else if (t.kind === 'window') {
      const room = world.room(t.roomId);
      if (room) this.windowOverlay(room);
    } else if (t.kind === 'door') {
      const room = world.room(t.roomId);
      if (room) this.doorOverlay(room);
    } else if (t.phase === 'drag') {
      const def = ROOMS[t.type];
      view.setGhost(null);
      this.hint = `${def.icon} ${def.name} · drag out the floor (at least ${def.minShort}×${def.minLong}) · Esc cancels`;
      if (t.rect) {
        const check = world.roomRectValid(t.type, t.rect);
        this.problem = check.reason;
        for (let y = t.rect.y; y < t.rect.y + t.rect.h; y++) {
          for (let x = t.rect.x; x < t.rect.x + t.rect.w; x++) {
            const i = tileIdx(x, y);
            const free = inBuilding(x, y) && world.zone[i] === Z_CORRIDOR && !world.blocked[i] && !world.reserved[i];
            tiles.push([x, y, free && check.ok ? OV_GOOD : free ? OV_FREE : OV_BAD]);
          }
        }
        if (t.start) this.hint = `${def.icon} ${def.name} · ${t.rect.w}×${t.rect.h} · release to confirm`;
      } else if (this.cursor) {
        const x = Math.floor(this.cursor.x);
        const y = Math.floor(this.cursor.y);
        const i = tileIdx(x, y);
        const free = inBuilding(x, y) && world.zone[i] === Z_CORRIDOR && !world.blocked[i] && !world.reserved[i];
        tiles.push([x, y, free ? OV_GOOD : OV_BAD]);
      }
    } else if (t.phase === 'door') {
      view.setGhost(null);
      this.hint = `${ROOMS[t.type].icon} Now click a wall to place the door · Esc cancels`;
      for (let y = t.rect.y; y < t.rect.y + t.rect.h; y++)
        for (let x = t.rect.x; x < t.rect.x + t.rect.w; x++) tiles.push([x, y, OV_BLUE]);
      if (this.cursor) {
        const door = world.nearestDoor(t.rect, this.cursor.x, this.cursor.y);
        const check = world.doorValid(t.type, t.rect, door);
        this.problem = check.reason;
        view.setDoor({ door, tone: check.ok ? 'ok' : 'bad' });
      }
    } else {
      const sub = t.sub;
      if (!sub) {
        view.setGhost(null);
        this.hint = this.sim.missingItems(t.room).length
          ? 'Pick the missing furniture from the blueprint panel'
          : 'Everything needed is in. Add windows or extras, or press Build room (Enter)';
      } else if (sub.kind === 'item') {
        const def = ITEMS[sub.type];
        this.hint = sub.required
          ? `${def.icon} Place the ${def.name} inside the room · R rotates${this.legend(sub.type)}`
          : `${def.icon} ${def.name} · ${money(def.cost)} each · click to place · R rotates · Esc puts it down${this.legend(sub.type)}`;
        this.itemOverlay(sub.type, sub.rot, sub.required ? t.room.id : undefined, tiles, markers);
      } else if (sub.kind === 'window') this.windowOverlay(t.room);
      else this.doorOverlay(t.room);
    }
    view.setOverlay(tiles);
    view.setMarkers(markers);
    this.onChange();
  }
}
