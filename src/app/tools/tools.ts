// Build tools and selection: turns pointer input into rooms, doors, windows and furniture.
//
// Building a room goes: drag out the floor, click a wall for the door, then a
// blueprint step. In the blueprint the required furniture goes in, windows and
// extras can be added, the door can be moved, and nothing is charged for the room
// until it is confirmed. A built room can have its windows changed, its door moved
// and its walls dragged in or out.
//
// This class holds the tool in hand and talks to the game and the scene. The working
// out (geometry, hints, which tiles to color) lives in the small modules beside it.

import { certificatesLeft } from '../../core/certificates';
import { centerOf, ITEMS, type ItemType, ROOMS, type RoomType, type RugPatternId } from '../../core/data';
import { money } from '../../core/format';
import { plotAt } from '../../core/land';
import { resizeCost, roomCost, sameRect } from '../../core/resize';
import { copyCost, cornerFor, type Layout, type PlacedLayout, placeLayout, turnLayout } from '../../core/room-layout';
import { canWorkIn } from '../../core/sim/assignments';
import { finishCost } from '../../core/sim/building';
import type { SfxName } from '../../core/sim/events';
import type { PlacePreview } from '../../core/sim/preview';
import type { Sim } from '../../core/sim/sim';
import { sameSpot } from '../../core/state/game';
import type { Room, WallSpot } from '../../core/state/types';
import { onWall, type Rect, Z_CORRIDOR } from '../../core/world';
import { type Marker, OV_BAD, OV_BLUE, OV_GOOD, type OverlayTile } from '../../render/overlay-codes';
import { nextPick, type Selection } from '../../render/picking';
import type { View } from '../../render/view';
import { loadDisplay } from '../../storage/display';
import { expandHint, plotHeat } from '../../ui/lib/land';
import { dragRect, itemSpot, tileOf } from './geometry';
import {
  assignHint,
  assignProblem,
  copyRoomHint,
  DOOR_HINT,
  dragHint,
  MOVE_DOOR_HINT,
  moveHint,
  moveRoomHint,
  noFitHint,
  placeHint,
  planHint,
  RESIZE_HINT,
  resizeHint,
  templateHint,
  WINDOW_HINT,
} from './hints';
import { assignTiles, dragTiles, itemTiles, layoutTiles, rectTiles } from './overlay';
import { heldItem, nextRequired, planStatus, quarterTurn } from './plan';
import type { Edge } from './resize';
import { dragEdge, edgeNear, edgeTiles } from './resize';
import type { HeldItem, PlanStatus, Point, Tool } from './types';

/**
 * How long after something goes down, in milliseconds, the preview of the next keeps out of the way, unless the pointer
 * moves this many pixels first: it would sit red on top of what just went in.
 */
const LANDED_MS = 250;
const LANDED_PX = 6;
/** How long after a click is turned down the hint's problem line pulses, in milliseconds. */
const REFUSED_MS = 600;

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
  /** Whether a drag turned down for a room that fits nowhere has said so already, since the room was picked. */
  private noFitSaid = false;
  /** What the new item in hand would change where it is about to go, while the preview is on and it fits there. */
  preview: PlacePreview | null = null;
  /** The last preview worked out, and where for, so moving within a tile does not work it out again. */
  private lastPreview: { key: string; preview: PlacePreview } | null = null;
  /** The pattern the next rug put down will have, kept from one rug to the next. */
  rugPattern: RugPatternId = 'kilim';
  private cursor: Point | null = null;
  /** Where on screen, and when, the last thing went down, while the preview of the next keeps out of the way. */
  private landed: { x: number; y: number; at: number } | null = null;
  /** How many clicks have been turned down, and when the last was, so the hint can pulse its problem line at each. */
  refusals = 0;
  private refusedAt = -Infinity;

  constructor(
    private sim: Sim,
    private view: View,
    private onChange: () => void,
    private sfx: (name: SfxName) => void,
    /** Count something the player tried that was turned down, and why, in the play statistics. */
    private refused?: (action: string, reason: string) => void,
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
    this.landed = null;
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

  /** Whether a new rug is in hand, so its pattern can be picked before it goes down. */
  get holdingRug(): boolean {
    const t = this.tool;
    if (t.kind === 'item') return t.type === 'rug';
    return t.kind === 'room' && t.phase === 'plan' && t.sub?.kind === 'item' && t.sub.type === 'rug';
  }

  /** Choose the pattern for the rugs put down from now on. */
  pickRugPattern(pattern: RugPatternId) {
    this.rugPattern = pattern;
    this.refresh();
  }

  /** What a new item of a type is put down with: a rug, its pattern. */
  private looks(type: ItemType): { pattern?: RugPatternId } {
    return type === 'rug' ? { pattern: this.rugPattern } : {};
  }

  /** Pick up an existing item to put it down somewhere else. */
  startMove(id: number) {
    this.cancel();
    const it = this.sim.world.item(id);
    if (!it) return;
    this.tool = { kind: 'move', id, type: it.type, rot: it.rot };
    this.refresh();
  }

  /**
   * Turn down what the player tried, with the error sound, and count it in the play statistics with why: the problem
   * shown under the cursor, unless there is a better reason.
   */
  private refuse(action: string, reason = this.problem) {
    this.sfx('error');
    this.refused?.(action, reason);
    // the preview shakes and the problem line pulses, so the click is seen to have been turned down as well as heard
    this.refusals++;
    this.refusedAt = performance.now();
    this.view.nudge();
  }

  /** Whether a click was turned down a moment ago, while the hint's problem line pulses for it. */
  get justRefused(): boolean {
    return performance.now() - this.refusedAt < REFUSED_MS;
  }

  /**
   * Something has just gone down where the pointer is: keep the preview of the next out of the way until the pointer
   * moves off or a moment passes, so it does not sit red on top of what just went in.
   */
  private land(clientX: number, clientY: number) {
    const landed = { x: clientX, y: clientY, at: performance.now() };
    this.landed = landed;
    setTimeout(() => {
      if (this.landed !== landed) return;
      this.landed = null;
      this.refresh();
    }, LANDED_MS);
  }

  /** Why an item would not go down: the problem where it is held, or, where it fits, that it cannot be paid for. */
  private placeProblem(type: ItemType, free = false): string {
    if (this.problem) return this.problem;
    return !free && this.sim.s.money < ITEMS[type].cost ? "Can't afford it" : '';
  }

  /** Whether a room can be paid for, at the smallest or at what it costs as planned, saying so if not. */
  private affords(type: RoomType, cost = ROOMS[type].cost): boolean {
    const def = ROOMS[type];
    if (this.sim.s.money >= cost) return true;
    this.sim.emit({
      type: 'toast',
      text: `A ${def.name} ${cost > def.cost ? 'this size ' : ''}costs ${money(cost)}. You can't afford it yet.`,
      kind: 'bad',
    });
    this.refuse('build_room', "Can't afford it");
    return false;
  }

  /**
   * Start dragging out a new room, if it can be afforded. Where it fits nowhere at its smallest, the hint says so and
   * where the room for it would come from, and a drag of it turned down says the same once.
   */
  startRoom(type: RoomType) {
    this.cancel();
    if (!this.affords(type)) return;
    const noFit = this.sim.world.roomFitsAnywhere(type) ? '' : noFitHint(type, this.sim.landOffers());
    this.tool = { kind: 'room', type, phase: 'drag', start: null, rect: null, noFit };
    this.noFitSaid = false;
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

  /** Drag the walls of a room that is already built. */
  startResize(roomId: number) {
    this.cancel();
    if (!this.sim.world.room(roomId)) return;
    this.tool = { kind: 'resize', roomId, edge: null, rect: null };
    this.refresh();
  }

  /** Pick a built room up to move it elsewhere, or to put down copies of it. */
  startMoveRoom(roomId: number, copy = false) {
    this.cancel();
    const room = this.sim.world.room(roomId);
    if (!room?.done) return;
    this.tool = { kind: 'moveRoom', roomId, layout: this.sim.roomLayout(room), copy };
    this.select(null);
    this.refresh();
  }

  /** Put down rooms built from a template, as many as are clicked. */
  startTemplate(name: string, layout: Layout) {
    this.cancel();
    this.tool = { kind: 'template', name, layout };
    this.select(null);
    this.refresh();
  }

  /** Where the room in hand would go, centered on the cursor. */
  private placedRoom(t: { layout: Layout }): PlacedLayout | null {
    return this.cursor ? placeLayout(t.layout, ...cornerFor(t.layout, this.cursor)) : null;
  }

  /** Point at the plots of land around the building to see what each costs, and click one to buy it or see it. */
  startExpand(pointed: string | null = null) {
    this.cancel();
    this.tool = { kind: 'expand', pointed };
    this.sim.seePlots();
    this.select(null);
    this.refresh();
  }

  /** The plot of land under the cursor, if any. */
  private plotUnderCursor(): string | null {
    if (!this.cursor) return null;
    const [x, y] = tileOf(this.cursor);
    return plotAt(centerOf(this.sim.s).plots, x, y)?.id ?? null;
  }

  /** Click rooms to assign a member of staff to them, with them kept selected meanwhile. */
  startAssign(staffId: number) {
    this.cancel();
    if (!this.sim.staff(staffId)) return;
    this.tool = { kind: 'assign', staffId };
    this.select({ kind: 'staff', id: staffId });
    this.refresh();
  }

  /** The built room under the cursor, if there is one. */
  private roomUnderCursor(): Room | undefined {
    if (!this.cursor) return undefined;
    const [x, y] = tileOf(this.cursor);
    const room = this.sim.world.room(this.sim.world.zoneAt(x, y));
    return room?.done ? room : undefined;
  }

  /** Whether the pointer is dragging something out (a new room's floor or a wall), so its release counts. */
  get dragging(): boolean {
    const t = this.tool;
    return (t.kind === 'room' && t.phase === 'drag') || (t.kind === 'resize' && t.edge !== null);
  }

  /** In a blueprint: take up the door, the window tool, or nothing. */
  planHold(what: 'window' | 'door' | '') {
    this.landed = null;
    const t = this.tool;
    if (t.kind !== 'room' || t.phase !== 'plan') return;
    t.sub = what ? { kind: what } : null;
    this.refresh();
  }

  /** Confirm the blueprint: the room is charged for and opens. The money may have gone on extras since it was started. */
  planBuild(): boolean {
    const t = this.tool;
    if (t.kind !== 'room' || t.phase !== 'plan' || this.sim.missingItems(t.room).length) return false;
    if (!this.affords(t.type, finishCost(t.room).cost)) return false;
    this.sim.finishRoom(t.room);
    this.tool = { kind: 'none' };
    this.select({ kind: 'room', id: t.room.id });
    this.refresh();
    return true;
  }

  /** Drop the current tool entirely. A blueprint is torn up and anything bought for it refunded. */
  cancel() {
    this.landed = null;
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

  /** Turn the item, or the room, in hand a quarter turn. */
  rotate() {
    // turning it is looking at where it goes next
    this.landed = null;
    const t = this.tool;
    if (t.kind === 'moveRoom' || t.kind === 'template') {
      t.layout = turnLayout(t.layout);
      this.sfx('blip');
      this.refresh();
      return;
    }
    const held = heldItem(t);
    // something hung on a wall faces out from it, whichever wall it is
    if (!held || onWall(held.type)) return;
    held.rot = quarterTurn(held.rot);
    this.sfx('blip');
    this.refresh();
  }

  /** Track the cursor, stretching the room being dragged out. */
  pointerMove(clientX: number, clientY: number) {
    this.cursor = this.view.groundAt(clientX, clientY);
    const landed = this.landed;
    if (landed && Math.hypot(clientX - landed.x, clientY - landed.y) >= LANDED_PX) this.landed = null;
    const t = this.tool;
    if (t.kind === 'room' && t.phase === 'drag' && t.start && this.cursor) {
      t.rect = dragRect(t.start, tileOf(this.cursor));
    }
    const room = t.kind === 'resize' ? this.sim.world.room(t.roomId) : undefined;
    if (t.kind === 'resize' && t.edge && room && this.cursor) t.rect = dragEdge(room, t.edge, this.cursor);
    if (t.kind === 'expand') t.pointed = this.plotUnderCursor();
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
    const room = t.kind === 'resize' ? this.sim.world.room(t.roomId) : undefined;
    if (t.kind === 'resize' && room && this.cursor) {
      t.edge = edgeNear(room, this.cursor);
      t.rect = t.edge ? { x: room.x, y: room.y, w: room.w, h: room.h } : null;
      this.refresh();
    }
  }

  /**
   * Left button released as a click (or at the end of dragging out a room). Returns the plot of land for sale clicked
   * with the Expand tool, if one was, to ask whether to buy it.
   */
  pointerUp(clientX: number, clientY: number): string | null {
    this.cursor = this.view.groundAt(clientX, clientY);
    const t = this.tool;
    const sim = this.sim;
    let toBuy: string | null = null;
    if (t.kind === 'none') {
      // clicking again where something is selected steps on to whatever else is there
      this.select(nextPick(this.view.pickAll(clientX, clientY), this.selected));
      if (this.selected) this.sfx('blip');
      return null;
    }
    if (t.kind === 'item') {
      const spot = this.spotFor(t);
      if (spot && sim.placeItem(t.type, spot.x, spot.y, spot.rot, this.looks(t.type))) this.land(clientX, clientY);
      else if (spot) this.refuse('place_item', this.placeProblem(t.type));
    } else if (t.kind === 'move') {
      const spot = this.spotFor(t);
      if (spot && sim.moveItem(t.id, spot.x, spot.y, spot.rot)) {
        this.tool = { kind: 'none' };
        this.select({ kind: 'item', id: t.id });
      } else if (spot) this.refuse('move_item');
    } else if (t.kind === 'window') {
      this.clickWindow(t.roomId);
    } else if (t.kind === 'door') {
      if (this.clickDoor(t.roomId)) {
        this.tool = { kind: 'none' };
        this.select({ kind: 'room', id: t.roomId });
      }
    } else if (t.kind === 'assign') {
      const room = this.roomUnderCursor();
      if (room && sim.assignRoom(t.staffId, room.id)) this.sfx('blip');
      else this.refuse('assign_room', room ? '' : 'Not on a room');
    } else if (t.kind === 'moveRoom') {
      if (this.putRoomDown(t.roomId, t.copy) && t.copy) this.land(clientX, clientY);
    } else if (t.kind === 'template') {
      // the tool stays for another
      const placed = this.placedRoom(t);
      if (placed && sim.buildTemplate(t.name, t.layout, placed)) this.land(clientX, clientY);
      else if (placed) this.refuse('build_template');
    } else if (t.kind === 'expand') {
      t.pointed = this.plotUnderCursor();
      const offer = sim.landOffers().find((o) => o.def.id === t.pointed);
      if (offer?.state === 'open') toBuy = offer.def.id;
      else if (offer?.state === 'locked') this.refuse('buy_land', 'Locked');
      else if (offer) {
        // one of the game's: put the tool down to show it in the inspector
        this.cancel();
        this.select({ kind: 'plot', id: offer.def.id });
        this.sfx('blip');
      }
    } else if (t.kind === 'resize') {
      // the wall is let go: the room takes the new shape if it can, and the tool stays for the next wall
      const room = sim.world.room(t.roomId);
      const rect = t.rect;
      t.edge = null;
      t.rect = null;
      if (room && rect && !sameRect(room, rect) && !sim.resizeRoom(room.id, rect)) this.refuse('resize_room');
    } else if (t.phase === 'drag') {
      const rect = t.rect;
      t.start = null;
      if (rect && sim.world.roomRectValid(t.type, rect).ok) {
        this.tool = { kind: 'room', type: t.type, phase: 'door', rect };
        this.sfx('place');
      } else {
        if (rect && rect.w * rect.h > 1) {
          if (t.noFit && !this.noFitSaid) {
            this.noFitSaid = true;
            sim.emit({ type: 'toast', text: t.noFit, kind: 'info', icon: 'ui-expand' });
          }
          this.refuse('draw_room');
        }
        t.rect = null;
      }
    } else if (t.phase === 'door') {
      if (!this.cursor) return null;
      const door = sim.world.nearestDoor(t.rect, this.cursor.x, this.cursor.y);
      if (sim.world.doorValid(t.type, t.rect, door).ok) {
        const room = sim.createRoom(t.type, t.rect, door);
        // straight on to the first piece of required furniture
        this.tool = { kind: 'room', type: t.type, phase: 'plan', room, sub: nextRequired(sim.missingItems(room)) };
        this.land(clientX, clientY);
      } else this.refuse('place_door');
    } else {
      const sub = t.sub;
      if (sub?.kind === 'item') {
        const spot = this.spotFor(sub);
        // required furniture is part of the room's price and has to go inside it; extras are bought as they are placed
        const opts = { ...(sub.required && { free: true, roomId: t.room.id }), ...this.looks(sub.type) };
        if (spot && sim.placeItem(sub.type, spot.x, spot.y, spot.rot, opts)) {
          if (sub.required) t.sub = nextRequired(sim.missingItems(t.room));
          this.land(clientX, clientY);
        } else if (spot) this.refuse('place_item', this.placeProblem(sub.type, sub.required));
      } else if (sub?.kind === 'window') this.clickWindow(t.room.id);
      else if (sub?.kind === 'door') {
        if (this.clickDoor(t.room.id)) t.sub = null;
      }
    }
    this.refresh();
    return toBuy;
  }

  /**
   * Put the room in hand down: moved, it is done with and selected; copied, the tool stays for another copy. Whether it
   * went down.
   */
  private putRoomDown(roomId: number, copy: boolean): boolean {
    const t = this.tool;
    const placed = t.kind === 'moveRoom' ? this.placedRoom(t) : null;
    if (!placed) return false;
    if (copy) {
      if (this.sim.copyRoom(roomId, placed)) return true;
      this.refuse('copy_room');
    } else if (this.sim.moveRoom(roomId, placed)) {
      this.tool = { kind: 'none' };
      this.select({ kind: 'room', id: roomId });
      return true;
    } else this.refuse('move_room');
    return false;
  }

  /**
   * Where the item in hand would go: its top-left tile, with the item centered on the cursor, and the way it faces. A
   * wall item hangs on the wall nearest the cursor, facing out from it, or nowhere if no wall is near.
   */
  private spotFor(held: HeldItem): { x: number; y: number; rot: number } | null {
    if (!this.cursor) return null;
    if (onWall(held.type)) return this.sim.world.nearestWall(held.type, this.cursor.x, this.cursor.y);
    const [x, y] = itemSpot(this.cursor, held.type, held.rot);
    return { x, y, rot: held.rot };
  }

  /** The stretch of the room's wall nearest the cursor. */
  private wallSpot(room: Room): WallSpot | null {
    return this.cursor ? this.sim.world.nearestDoor(room, this.cursor.x, this.cursor.y) : null;
  }
  /** Add or remove a window at the wall under the cursor. */
  private clickWindow(roomId: number) {
    const room = this.sim.world.room(roomId);
    const spot = room && this.wallSpot(room);
    if (!room || !spot || !this.sim.toggleWindow(roomId, spot)) this.refuse('window');
  }
  /** Move the door to the wall under the cursor. False if it cannot go there. */
  private clickDoor(roomId: number): boolean {
    const room = this.sim.world.room(roomId);
    const spot = room && this.wallSpot(room);
    if (room && spot && this.sim.moveDoor(roomId, spot)) return true;
    this.refuse('move_door');
    return false;
  }

  /** Whether a tile is open corridor floor that a new room could take. */
  private isFree(x: number, y: number): boolean {
    const world = this.sim.world;
    const i = world.idx(x, y);
    return world.inside(x, y) && world.zone[i] === Z_CORRIDOR && !world.blocked[i] && !world.reserved[i];
  }

  /** Ghost, footprint and the squares people will use, marked by who they are for. */
  private drawItem(held: HeldItem, roomId: number | undefined, drawing: Drawing, movingId = 0) {
    const spot = this.spotFor(held);
    if (!spot) {
      this.view.setGhost(null);
      if (onWall(held.type) && this.cursor) this.problem = 'Hang it on a wall';
      return;
    }
    const { type } = held;
    const { x, y, rot } = spot;
    const moving = this.sim.world.item(movingId);
    const check = moving
      ? this.sim.canMoveItem(moving, x, y, rot)
      : this.sim.world.canPlaceItem(type, x, y, rot, roomId);
    // one being moved is paid for already, and required furniture, the only kind held for a room, is in its price
    const free = !!moving || roomId !== undefined;
    const affordable = free || this.sim.s.money >= ITEMS[type].cost;
    const ok = check.ok && affordable;
    const placed = { type, x, y, rot };
    // something hung on a wall is shown by its ghost alone: it covers no floor
    if (!onWall(type)) {
      const { tiles, markers } = itemTiles(placed, ok);
      drawing.tiles.push(...tiles);
      drawing.markers.push(...markers);
    }
    // where it fits but the bank cannot pay for it, it shows red before the click, not only after
    this.problem = check.reason || (affordable ? '' : "Can't afford it");
    // what a new item would change, worked out once for each spot it is held over, and again once another is down
    if (!moving && ok && loadDisplay().placePreview) {
      const key = `${type}:${x},${y}:${rot}:${this.sim.s.items.length}`;
      if (this.lastPreview?.key !== key) this.lastPreview = { key, preview: this.sim.previewItem(placed) };
      this.preview = this.lastPreview.preview;
    }
    // a rug being moved keeps its own pattern; a new one has the pattern picked for it
    const pattern = type === 'rug' ? (moving ? moving.pattern : this.rugPattern) : undefined;
    this.view.setGhost({ ...placed, ok, pattern });
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

  /** The room being resized: its floor, the wall under the cursor, or the shape a wall is being dragged to. */
  private drawResize(room: Room, edge: Edge | null, rect: Rect | null, drawing: Drawing) {
    this.hint = RESIZE_HINT;
    if (edge && rect) {
      const check = this.sim.world.resizeValid(room, rect);
      const same = sameRect(room, rect);
      if (!same) {
        this.problem = check.reason;
        this.hint = resizeHint(room, rect, resizeCost(room, rect));
      }
      drawing.tiles.push(...rectTiles(rect, same || check.ok ? OV_GOOD : OV_BAD));
      return;
    }
    drawing.tiles.push(...rectTiles(room, OV_BLUE));
    const near = this.cursor && edgeNear(room, this.cursor);
    if (near) drawing.tiles.push(...edgeTiles(room, near).map(([x, y]): OverlayTile => [x, y, OV_GOOD]));
  }

  /** The rooms someone is assigned to, and the room under the cursor, marked by whether they could work there. */
  private drawAssign(staffId: number, drawing: Drawing) {
    const st = this.sim.staff(staffId);
    // let go meanwhile: nobody left to assign
    if (!st) {
      this.tool = { kind: 'none' };
      return;
    }
    const world = this.sim.world;
    this.hint = assignHint(st.name, st.rooms.length);
    const hover = this.roomUnderCursor();
    const workable = !!hover && canWorkIn(st.role, hover.type);
    if (hover && !workable) this.problem = assignProblem(st.role, hover.type);
    const assigned = st.rooms.map((id) => world.room(id)).filter((r) => r !== undefined);
    drawing.tiles.push(...assignTiles(assigned, hover, workable));
  }

  /** The room in hand: its floor where it would go, colored by whether it fits, with its furniture and door. */
  private drawRoomMove(roomId: number, copy: boolean, drawing: Drawing) {
    const t = this.tool;
    const room = this.sim.world.room(roomId);
    // demolished meanwhile: nothing left to move or copy
    if (!room || t.kind !== 'moveRoom') {
      this.tool = { kind: 'none' };
      return;
    }
    const windows = this.drawLayout(t.layout, drawing, copy ? undefined : room);
    this.hint = copy ? copyRoomHint(room.type, copyCost(t.layout), windows) : moveRoomHint(room.type, windows);
  }

  /**
   * A room about to be put down from a layout, colored by whether it fits, with its furniture and door. Returns how
   * many windows next door putting it down there would take out.
   */
  private drawLayout(layout: Layout, drawing: Drawing, moving?: Room): number {
    const placed = this.placedRoom({ layout });
    if (!placed) return 0;
    const check = this.sim.world.layoutValid(layout.type, placed, moving);
    this.problem = check.reason;
    drawing.tiles.push(...layoutTiles(placed, check.ok));
    this.view.setDoor({ door: placed.door, tone: check.ok ? 'ok' : 'bad' });
    return check.ok ? this.sim.world.windowsOnto(placed.rect, moving).length : 0;
  }

  /** Recompute overlays, ghost and hint for the current tool state. */
  refresh() {
    const t = this.tool;
    const view = this.view;
    const world = this.sim.world;
    const drawing: Drawing = { tiles: [], markers: [] };
    this.problem = '';
    this.hint = '';
    this.preview = null;
    view.setDoor(null);
    if (t.kind === 'none') {
      view.setGhost(null);
    } else if (t.kind === 'item') {
      this.hint = placeHint(t.type, certificatesLeft(this.sim.s).length);
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
    } else if (t.kind === 'assign') {
      view.setGhost(null);
      this.drawAssign(t.staffId, drawing);
    } else if (t.kind === 'moveRoom') {
      view.setGhost(null);
      this.drawRoomMove(t.roomId, t.copy, drawing);
    } else if (t.kind === 'template') {
      view.setGhost(null);
      this.hint = templateHint(t.name, copyCost(t.layout), this.drawLayout(t.layout, drawing));
    } else if (t.kind === 'resize') {
      view.setGhost(null);
      const room = world.room(t.roomId);
      if (room) this.drawResize(room, t.edge, t.rect, drawing);
    } else if (t.kind === 'expand') {
      view.setGhost(null);
      const offers = this.sim.landOffers();
      const pointed = offers.find((o) => o.def.id === t.pointed);
      this.hint = expandHint(pointed);
      if (pointed?.state === 'locked') this.problem = pointed.why;
      view.setHeat(plotHeat(offers, t.pointed), 'land');
    } else if (t.phase === 'drag') {
      view.setGhost(null);
      this.hint =
        t.noFit && !t.start
          ? `${t.noFit} · Esc cancels`
          : dragHint(t.type, t.start ? t.rect : null, t.rect ? roomCost(t.type, t.rect) : 0);
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
      this.hint = DOOR_HINT;
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
    if (this.landed) {
      // something has just gone down under the pointer: the next keeps out of the way rather than sit red on top of it
      this.problem = '';
      this.preview = null;
      view.setGhost(null);
      view.setDoor(null);
      drawing.tiles = [];
      drawing.markers = [];
    }
    view.setOverlay(drawing.tiles);
    view.setMarkers(drawing.markers);
    this.onChange();
  }
}
