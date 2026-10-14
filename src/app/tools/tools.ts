// Build tools and selection: turns pointer input into rooms, doors, windows and furniture.
//
// Building a room goes: drag out the floor, click a wall for the door, then a
// blueprint step. In the blueprint the required furniture goes in, windows and
// extras can be added, the door can be moved, and nothing is charged for the room
// until it is confirmed.
//
// This class holds the tool in hand and talks to the game and the scene. The working
// out (geometry, hints, which tiles to color) lives in the small modules beside it.

import { type ItemType, ROOMS, type RoomType } from '../../core/data';
import { money } from '../../core/format';
import type { SfxName } from '../../core/sim/events';
import type { Sim } from '../../core/sim/sim';
import { sameSpot } from '../../core/state/game';
import type { Room, WallSpot } from '../../core/state/types';
import { inBuilding, tileIdx, Z_CORRIDOR } from '../../core/world';
import { type Marker, OV_BAD, OV_BLUE, OV_GOOD, type OverlayTile } from '../../render/overlay-codes';
import type { Selection } from '../../render/picking';
import type { View } from '../../render/view';
import { dragRect, itemSpot, tileOf } from './geometry';
import { doorHint, dragHint, MOVE_DOOR_HINT, moveHint, placeHint, planHint, WINDOW_HINT } from './hints';
import { dragTiles, itemTiles, rectTiles } from './overlay';
import { heldItem, nextRequired, planStatus, quarterTurn } from './plan';
import type { HeldItem, PlanStatus, Point, Tool } from './types';

/** What a refresh has worked out so far: the tiles and icons to draw over the floor. */
interface Drawing {
  tiles: OverlayTile[];
  markers: Marker[];
}

export class Tools {
  tool: Tool = { kind: 'none' };
  /** One-line instruction shown while a tool is active. */
  hint = '';
  /** Why the current placement is invalid, if it is. */
  problem = '';
  private cursor: Point | null = null;

  constructor(
    private sim: Sim,
    private view: View,
    private onChange: () => void,
    private sfx: (name: SfxName) => void,
  ) {}

  /** Whether a tool is in hand. */
  get active() {
    return this.tool.kind !== 'none';
  }
  /** What is currently selected, if anything. */
  get selected(): Selection | null {
    return this.view.selected;
  }
  /** Change the selection, or clear it with null. */
  select(sel: Selection | null) {
    this.view.selected = sel;
    this.onChange();
  }

  /** The open blueprint, if there is one. */
  get plan(): PlanStatus | null {
    const t = this.tool;
    if (t.kind !== 'room' || t.phase !== 'plan') return null;
    return planStatus(t.room, this.sim.missingItems(t.room), t.sub);
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

  /** Whether a room can be paid for, saying so if not. */
  private affords(type: RoomType): boolean {
    const def = ROOMS[type];
    if (this.sim.s.money >= def.cost) return true;
    this.sim.emit({
      type: 'toast',
      text: `A ${def.name} costs ${money(def.cost)}. You can't afford it yet.`,
      kind: 'bad',
    });
    this.sfx('error');
    return false;
  }

  /** Start dragging out a new room, if it can be afforded. */
  startRoom(type: RoomType) {
    this.cancel();
    if (!this.affords(type)) return;
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

  /** Confirm the blueprint: the room is charged for and opens. The money may have gone on extras since it was started. */
  planBuild(): boolean {
    const t = this.tool;
    if (t.kind !== 'room' || t.phase !== 'plan' || this.sim.missingItems(t.room).length) return false;
    if (!this.affords(t.type)) return false;
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

  /** Turn the item in hand a quarter turn. */
  rotate() {
    const held = heldItem(this.tool);
    if (!held) return;
    held.rot = quarterTurn(held.rot);
    this.sfx('blip');
    this.refresh();
  }

  /** Track the cursor, stretching the room being dragged out. */
  pointerMove(clientX: number, clientY: number) {
    this.cursor = this.view.groundAt(clientX, clientY);
    const t = this.tool;
    if (t.kind === 'room' && t.phase === 'drag' && t.start && this.cursor) {
      t.rect = dragRect(t.start, tileOf(this.cursor));
    }
    if (this.active) this.refresh();
  }

  /** Left button pressed: anchor the corner of a room being dragged out. */
  pointerDown(clientX: number, clientY: number) {
    this.cursor = this.view.groundAt(clientX, clientY);
    const t = this.tool;
    if (t.kind === 'room' && t.phase === 'drag' && this.cursor) {
      t.start = tileOf(this.cursor);
      t.rect = dragRect(t.start, t.start);
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
      const spot = this.spotFor(t);
      if (spot && sim.placeItem(t.type, spot[0], spot[1], t.rot)) this.onChange();
      else if (spot) this.sfx('error');
    } else if (t.kind === 'move') {
      const spot = this.spotFor(t);
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
        this.tool = { kind: 'room', type: t.type, phase: 'plan', room, sub: nextRequired(sim.missingItems(room)) };
      } else this.sfx('error');
    } else {
      const sub = t.sub;
      if (sub?.kind === 'item') {
        const spot = this.spotFor(sub);
        // required furniture is part of the room's price and has to go inside it; extras are bought as they are placed
        const opts = sub.required ? { free: true, roomId: t.room.id } : {};
        if (spot && sim.placeItem(sub.type, spot[0], spot[1], sub.rot, opts)) {
          if (sub.required) t.sub = nextRequired(sim.missingItems(t.room));
        } else if (spot) this.sfx('error');
      } else if (sub?.kind === 'window') this.clickWindow(t.room.id);
      else if (sub?.kind === 'door') {
        if (this.clickDoor(t.room.id)) t.sub = null;
      }
    }
    this.refresh();
  }

  /** Where the item in hand would go: its top-left tile, with the item centered on the cursor. */
  private spotFor(held: HeldItem) {
    return this.cursor ? itemSpot(this.cursor, held.type, held.rot) : null;
  }

  /** The stretch of the room's wall nearest the cursor. */
  private wallSpot(room: Room): WallSpot | null {
    return this.cursor ? this.sim.world.nearestDoor(room, this.cursor.x, this.cursor.y) : null;
  }
  /** Add or remove a window at the wall under the cursor. */
  private clickWindow(roomId: number) {
    const room = this.sim.world.room(roomId);
    const spot = room && this.wallSpot(room);
    if (!room || !spot || !this.sim.toggleWindow(roomId, spot)) this.sfx('error');
  }
  /** Move the door to the wall under the cursor. False if it cannot go there. */
  private clickDoor(roomId: number): boolean {
    const room = this.sim.world.room(roomId);
    const spot = room && this.wallSpot(room);
    if (room && spot && this.sim.moveDoor(roomId, spot)) return true;
    this.sfx('error');
    return false;
  }

  /** Whether a tile is open corridor floor that a new room could take. */
  private isFree(x: number, y: number): boolean {
    const world = this.sim.world;
    const i = tileIdx(x, y);
    return inBuilding(x, y) && world.zone[i] === Z_CORRIDOR && !world.blocked[i] && !world.reserved[i];
  }

  /** Ghost, footprint and the squares people will use, marked by who they are for. */
  private drawItem(held: HeldItem, roomId: number | undefined, drawing: Drawing, movingId = 0) {
    const spot = this.spotFor(held);
    if (!spot) {
      this.view.setGhost(null);
      return;
    }
    const { type, rot } = held;
    const moving = this.sim.world.item(movingId);
    const check = moving
      ? this.sim.canMoveItem(moving, spot[0], spot[1], rot)
      : this.sim.world.canPlaceItem(type, spot[0], spot[1], rot, roomId);
    const placed = { type, x: spot[0], y: spot[1], rot };
    const { tiles, markers } = itemTiles(placed, check.ok);
    drawing.tiles.push(...tiles);
    drawing.markers.push(...markers);
    this.problem = check.reason;
    this.view.setGhost({ ...placed, ok: check.ok });
  }

  /** Marker for the window tool on one room. */
  private drawWindow(room: Room) {
    this.view.setGhost(null);
    const spot = this.wallSpot(room);
    if (!spot) return;
    if (room.windows.some((w) => sameSpot(w, spot))) this.view.setDoor({ door: spot, tone: 'remove' });
    else {
      const check = this.sim.world.windowValid(room, spot);
      this.problem = check.reason;
      this.view.setDoor({ door: spot, tone: check.ok ? 'ok' : 'bad' });
    }
  }
  /** Marker for moving one room's door. */
  private drawDoor(room: Room) {
    this.view.setGhost(null);
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
    const drawing: Drawing = { tiles: [], markers: [] };
    this.problem = '';
    this.hint = '';
    view.setDoor(null);
    if (t.kind === 'none') {
      view.setGhost(null);
    } else if (t.kind === 'item') {
      this.hint = placeHint(t.type);
      this.drawItem(t, undefined, drawing);
    } else if (t.kind === 'move') {
      this.hint = moveHint(t.type);
      this.drawItem(t, undefined, drawing, t.id);
    } else if (t.kind === 'window') {
      const room = world.room(t.roomId);
      if (room) {
        this.hint = WINDOW_HINT;
        this.drawWindow(room);
      }
    } else if (t.kind === 'door') {
      const room = world.room(t.roomId);
      if (room) {
        this.hint = MOVE_DOOR_HINT;
        this.drawDoor(room);
      }
    } else if (t.phase === 'drag') {
      view.setGhost(null);
      this.hint = dragHint(t.type, t.start ? t.rect : null);
      if (t.rect) {
        const check = world.roomRectValid(t.type, t.rect);
        this.problem = check.reason;
        drawing.tiles.push(...dragTiles(t.rect, check.ok, (x, y) => this.isFree(x, y)));
      } else if (this.cursor) {
        const [x, y] = tileOf(this.cursor);
        drawing.tiles.push([x, y, this.isFree(x, y) ? OV_GOOD : OV_BAD]);
      }
    } else if (t.phase === 'door') {
      view.setGhost(null);
      this.hint = doorHint(t.type);
      drawing.tiles.push(...rectTiles(t.rect, OV_BLUE));
      if (this.cursor) {
        const door = world.nearestDoor(t.rect, this.cursor.x, this.cursor.y);
        const check = world.doorValid(t.type, t.rect, door);
        this.problem = check.reason;
        view.setDoor({ door, tone: check.ok ? 'ok' : 'bad' });
      }
    } else {
      const sub = t.sub;
      this.hint = planHint(sub, this.sim.missingItems(t.room).length);
      if (!sub) view.setGhost(null);
      else if (sub.kind === 'item') this.drawItem(sub, sub.required ? t.room.id : undefined, drawing);
      else if (sub.kind === 'window') this.drawWindow(t.room);
      else this.drawDoor(t.room);
    }
    view.setOverlay(drawing.tiles);
    view.setMarkers(drawing.markers);
    this.onChange();
  }
}
