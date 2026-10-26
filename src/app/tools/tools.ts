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
import { plotAt, plotOffers } from '../../core/land';
import { resizeCost, roomCost, sameRect } from '../../core/resize';
import { copyCost, cornerFor, type Layout, type PlacedLayout, placeLayout, turnLayout } from '../../core/room-layout';
import { canWorkIn } from '../../core/sim/assignments';
import { finishCost } from '../../core/sim/building';
import type { SfxName } from '../../core/sim/events';
import type { PlacePreview } from '../../core/sim/preview';
import type { Sim } from '../../core/sim/sim';
import { sameSpot } from '../../core/state/game';
import type { Item, Room, Sketch, WallSpot } from '../../core/state/types';
import { itemCenter, onWall, type Rect, Z_CORRIDOR } from '../../core/world';
import { type Marker, OV_BAD, OV_BLUE, OV_GOOD, type OverlayTile } from '../../render/overlay-codes';
import { nextPick, type Selection } from '../../render/picking';
import type { View } from '../../render/view';
import { loadDisplay } from '../../storage/display';
import { expandHint, plotHeat } from '../../ui/lib/land';
import { dragRect, itemSpot, rotToward, tileOf } from './geometry';
import {
  assignHint,
  assignProblem,
  copyRoomHint,
  DOOR_HINT,
  dragHint,
  heldHint,
  MOVE_DOOR_HINT,
  moveHint,
  moveRoomHint,
  noFitHint,
  placeHint,
  planHint,
  RESIZE_HINT,
  resizeHint,
  sketchDoorHint,
  sketchHint,
  templateHint,
  templateSketchHint,
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
  /** The sketch in the way where the tool in hand is, if one is why it cannot go there: selected if the click is. */
  private inTheWay: number | undefined;

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
  private refuse(action: string, reason = this.problem, sketch = this.inTheWay) {
    this.sfx('error');
    this.refused?.(action, reason);
    // a sketch in the way is selected, so its Erase button is to hand once the tool is put down
    if (sketch !== undefined && this.sim.sketch(sketch)) this.select({ kind: 'sketch', id: sketch });
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

  /**
   * Whether a room can be paid for, at the smallest or at what it costs as planned, saying so if not. `what` names it,
   * as a template's name does a room built from it.
   */
  private affords(type: RoomType, cost = ROOMS[type].cost, action = 'build_room', what?: string): boolean {
    const def = ROOMS[type];
    if (this.sim.s.money >= cost) return true;
    const name = what ?? `A ${def.name}${cost > def.cost ? ' this size' : ''}`;
    this.sim.emit({ type: 'toast', text: `${name} costs ${money(cost)}. You can't afford it yet.`, kind: 'bad' });
    this.refuse(action, "Can't afford it", undefined);
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

  /** Pencil rooms of a type in, as many as are drawn, for nothing. */
  startSketch(type: RoomType) {
    this.cancel();
    this.tool = { kind: 'sketch', type, phase: 'drag', start: null, rect: null, held: false, moving: null };
    this.select(null);
    this.refresh();
  }

  /**
   * Pick a sketch up to draw it again elsewhere: its floor is offered where it was, which a click keeps and a drag
   * replaces, and it goes back as it was if the tool is put down first.
   */
  moveSketch(id: number) {
    const sketch = this.sim.sketch(id);
    if (!sketch) return;
    this.cancel();
    this.sim.eraseSketch(id);
    // one that remembers a room is picked up whole, as its template is, to put down where it is clicked
    if (sketch.layout) {
      const name = sketch.template ?? ROOMS[sketch.type].name;
      this.tool = { kind: 'template', name, layout: sketch.layout, sketch: true, moving: sketch };
      this.select(null);
      this.refresh();
      return;
    }
    const rect = { x: sketch.x, y: sketch.y, w: sketch.w, h: sketch.h };
    this.tool = { kind: 'sketch', type: sketch.type, phase: 'drag', start: null, rect, held: true, moving: sketch };
    this.select(null);
    this.refresh();
  }

  /**
   * Build a sketch. Where it still fits, its blueprint opens in its rectangle with its door, and the first required
   * item in hand; where it no longer does, the room tool takes its floor up to be clicked as it is or dragged out
   * afresh. Turned down, with the sketch kept, if the room's price cannot be paid. One that remembers a room is built
   * whole, or turned down.
   */
  buildSketch(id: number) {
    const sketch = this.sim.sketch(id);
    if (!sketch) return;
    this.cancel();
    if (sketch.layout) {
      this.buildRemembered(sketch, sketch.layout);
      return;
    }
    if (!this.affords(sketch.type, ROOMS[sketch.type].cost, 'build_sketch')) return;
    const kept: Sketch = { ...sketch, door: { ...sketch.door } };
    const room = this.sim.world.sketchFits(sketch).ok ? this.sim.buildSketch(id) : null;
    const { type } = sketch;
    if (room) {
      this.tool = {
        kind: 'room',
        type,
        phase: 'plan',
        room,
        sub: nextRequired(this.sim.missingItems(room)),
        sketch: kept,
      };
    } else {
      const rect = { x: sketch.x, y: sketch.y, w: sketch.w, h: sketch.h };
      this.tool = { kind: 'room', type, phase: 'drag', start: null, rect, noFit: '', held: true, sketch: kept };
    }
    this.select(null);
    this.refresh();
  }

  /**
   * Build the room a sketch remembers, whole, where it is, and select it: turned down, with the sketch kept, with why if
   * it no longer fits there, or if the bank cannot cover it.
   */
  private buildRemembered(sketch: Sketch, layout: Layout) {
    const { fit } = this.sim.world.sketchFit(sketch);
    if (!fit.ok) {
      this.sim.emit({ type: 'toast', text: fit.reason.replace(/[^.]$/, '$&.'), kind: 'bad' });
      this.refuse('build_sketch', fit.reason, undefined);
      return;
    }
    const what = `"${sketch.template ?? ROOMS[sketch.type].name}"`;
    if (!this.affords(sketch.type, copyCost(layout), 'build_sketch', what)) return;
    const room = this.sim.buildSketch(sketch.id);
    if (!room) {
      this.refuse('build_sketch', "Can't afford it", undefined);
      return;
    }
    this.select({ kind: 'room', id: room.id });
    this.refresh();
  }

  /** Pencil the open blueprint in for later instead: torn up and refunded as Cancel does, and kept as a sketch. */
  planSketch() {
    const t = this.tool;
    if (t.kind !== 'room' || t.phase !== 'plan') return;
    const sketch = this.sim.sketchBlueprint(t.room.id);
    this.tool = { kind: 'none' };
    this.select(sketch ? { kind: 'sketch', id: sketch.id } : null);
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

  /** Put down rooms built from a template, as many as are clicked, or with `sketch`, pencil them in. */
  startTemplate(name: string, layout: Layout, sketch = false) {
    this.cancel();
    this.tool = { kind: 'template', name, layout, ...(sketch && { sketch }) };
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
    return (
      ((t.kind === 'room' || t.kind === 'sketch') && t.phase === 'drag') || (t.kind === 'resize' && t.edge !== null)
    );
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
    // a sketch built from, or picked up to move, is put back as it was
    const sketch =
      t.kind === 'room' ? t.sketch : t.kind === 'sketch' ? t.moving : t.kind === 'template' ? t.moving : null;
    this.tool = { kind: 'none' };
    if (sketch && this.sim.restoreSketch(sketch) && !this.selected) this.select({ kind: 'sketch', id: sketch.id });
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
    } else if (t.kind === 'sketch' && t.phase === 'door') {
      // back to the floor, which a click keeps as it was dragged
      this.tool = { ...t, phase: 'drag', start: null, rect: t.rect, held: true };
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
    // from the way it is shown facing, and from now on it stays the way it is turned
    held.rot = quarterTurn(this.spotFor(held)?.rot ?? held.rot);
    held.turned = true;
    this.sfx('blip');
    this.refresh();
  }

  /** Track the cursor, stretching the room being dragged out. */
  pointerMove(clientX: number, clientY: number) {
    this.cursor = this.view.groundAt(clientX, clientY);
    const landed = this.landed;
    if (landed && Math.hypot(clientX - landed.x, clientY - landed.y) >= LANDED_PX) this.landed = null;
    const t = this.tool;
    if ((t.kind === 'room' || t.kind === 'sketch') && t.phase === 'drag' && t.start && this.cursor) {
      const tile = tileOf(this.cursor);
      // floor offered as it is stays until the pointer is dragged off the tile it was pressed on
      if (!t.held || tile[0] !== t.start[0] || tile[1] !== t.start[1]) {
        t.rect = dragRect(t.start, tile);
        t.held = false;
      }
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
    if ((t.kind === 'room' || t.kind === 'sketch') && t.phase === 'drag' && this.cursor) {
      t.start = tileOf(this.cursor);
      if (!t.held || !t.rect) t.rect = dragRect(t.start, t.start);
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
    } else if (t.kind === 'template' && t.sketch) {
      this.clickTemplateSketch(clientX, clientY);
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
    } else if (t.kind === 'sketch') {
      this.clickSketch(clientX, clientY);
    } else if (t.phase === 'drag') {
      const rect = t.rect;
      t.start = null;
      t.held = false;
      if (rect && sim.world.roomRectValid(t.type, rect, undefined, t.sketch?.id).ok) {
        this.tool = { kind: 'room', type: t.type, phase: 'door', rect, ...(t.sketch && { sketch: t.sketch }) };
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
        // a sketch being built gives way if the room lands on it
        const room = (t.sketch && sim.buildSketchAt(t.sketch.id, t.rect, door)) ?? sim.createRoom(t.type, t.rect, door);
        // straight on to the first piece of required furniture
        const sub = nextRequired(sim.missingItems(room));
        this.tool = { kind: 'room', type: t.type, phase: 'plan', room, sub, ...(t.sketch && { sketch: t.sketch }) };
        this.land(clientX, clientY);
      } else this.refuse('place_door');
    } else {
      const sub = t.sub;
      if (sub?.kind === 'item') {
        const spot = this.spotFor(sub);
        // required furniture is part of the room's price and has to go inside it; extras are bought as they are placed
        const opts = { ...(sub.required && { free: true, roomId: t.room.id }), ...this.looks(sub.type) };
        if (spot && sim.placeItem(sub.type, spot.x, spot.y, spot.rot, opts)) {
          if (sub.required) {
            const next = nextRequired(sim.missingItems(t.room));
            // another of the same kind is held the way R turned this one
            t.sub =
              sub.turned && next?.kind === 'item' && next.type === sub.type
                ? { ...next, rot: sub.rot, turned: true }
                : next;
          }
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
   * A click with the sketch tool: let go of the floor dragged out, on to its door if it can go there; or put the door
   * down and pencil the room in, with the tool kept for another, or, for a sketch being moved, put down and selected.
   */
  private clickSketch(clientX: number, clientY: number) {
    const t = this.tool;
    if (t.kind !== 'sketch') return;
    const sim = this.sim;
    if (t.phase === 'drag') {
      const rect = t.rect;
      t.start = null;
      t.held = false;
      const check = rect ? sim.world.sketchRectValid(t.type, rect) : null;
      if (rect && check?.ok) {
        this.tool = { kind: 'sketch', type: t.type, phase: 'door', rect, moving: t.moving };
        this.sfx('place');
      } else {
        if (rect && rect.w * rect.h > 1) this.refuse('draw_sketch', check?.reason, check?.sketch);
        t.rect = null;
      }
      return;
    }
    if (!this.cursor) return;
    const door = sim.world.nearestDoor(t.rect, this.cursor.x, this.cursor.y);
    const sketch = sim.world.sketchDoorValid(t.rect, door).ok ? sim.addSketch(t.type, t.rect, door) : null;
    if (!sketch) {
      this.refuse('place_sketch_door');
      return;
    }
    if (t.moving) {
      this.tool = { kind: 'none' };
      this.select({ kind: 'sketch', id: sketch.id });
      return;
    }
    // the tool stays for another of the same kind
    this.tool = { kind: 'sketch', type: t.type, phase: 'drag', start: null, rect: null, held: false, moving: null };
    this.land(clientX, clientY);
  }

  /**
   * A click with a template being pencilled in: it goes down where it is shown, for nothing, with the tool kept for
   * another, or, for a sketch being moved, put down and selected.
   */
  private clickTemplateSketch(clientX: number, clientY: number) {
    const t = this.tool;
    if (t.kind !== 'template') return;
    const placed = this.placedRoom(t);
    if (!placed) return;
    const sketch = this.sim.pencilTemplate(t.name, t.layout, placed);
    if (!sketch) {
      this.refuse('pencil_template');
      return;
    }
    if (t.moving) {
      this.tool = { kind: 'none' };
      this.select({ kind: 'sketch', id: sketch.id });
      return;
    }
    this.land(clientX, clientY);
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
   * wall item hangs on the wall nearest the cursor, facing out from it, or nowhere if no wall is near. One that faces
   * something turns to face it, until R has turned it by hand.
   */
  private spotFor(held: HeldItem): { x: number; y: number; rot: number } | null {
    if (!this.cursor) return null;
    if (onWall(held.type)) return this.sim.world.nearestWall(held.type, this.cursor.x, this.cursor.y);
    const rot = held.turned ? held.rot : this.facing(this.cursor, held);
    const [x, y] = itemSpot(this.cursor, held.type, rot);
    return { x, y, rot };
  }

  /**
   * The way an item that faces something turns, held at a point: toward the nearest such item in the room there. Any
   * other item, or one held where there is nothing to face, keeps the way it is held.
   */
  private facing(cursor: Point, held: HeldItem): number {
    const faces = ITEMS[held.type].faces;
    if (!faces) return held.rot;
    const [x, y] = itemSpot(cursor, held.type, held.rot);
    const room = this.sim.world.roomAt(x, y);
    if (!room) return held.rot;
    const [cx, cy] = itemCenter({ type: held.type, x, y, rot: held.rot });
    /** How far an item's middle is from this one's. */
    const distance = (it: Item) => {
      const [ix, iy] = itemCenter(it);
      return Math.hypot(ix - cx, iy - cy);
    };
    const nearest = this.sim.s.items
      .filter((it) => it.type === faces && this.sim.world.roomOfItem(it)?.id === room.id)
      .sort((a, b) => distance(a) - distance(b))[0];
    return (nearest && rotToward(cx, cy, nearest)) ?? held.rot;
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

  /** Whether a tile is open corridor floor that a new room could take, pencilled in for none but sketch `spare`. */
  private isFree(x: number, y: number, spare?: number): boolean {
    const world = this.sim.world;
    const i = world.idx(x, y);
    const sketch = world.sketchAt(x, y);
    if (sketch && sketch.id !== spare) return false;
    return world.inside(x, y) && world.zone[i] === Z_CORRIDOR && !world.blocked[i] && !world.reserved[i];
  }

  /** Whether a room could be pencilled in over a tile: free corridor floor, or land not the game's yet, with no sketch. */
  private sketchFree(): (x: number, y: number) => boolean {
    const world = this.sim.world;
    const plots = centerOf(this.sim.s).plots;
    const owned = new Set(
      plotOffers(this.sim.s, world.building)
        .filter((o) => o.state === 'owned')
        .map((o) => o.def.id),
    );
    return (x, y) => {
      if (world.inside(x, y)) return this.isFree(x, y);
      const plot = plotAt(plots, x, y);
      return !!plot && !owned.has(plot.id) && !world.sketchAt(x, y);
    };
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
    this.inTheWay = check.sketch;
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
        this.inTheWay = check.sketch;
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
  private drawLayout(layout: Layout, drawing: Drawing, moving?: Room, pencil = false): number {
    const placed = this.placedRoom({ layout });
    if (!placed) return 0;
    const world = this.sim.world;
    // pencilled in, it goes where building it could, and in no other sketch's doorway
    const check = pencil ? world.templateSketchValid(layout, placed) : world.layoutValid(layout.type, placed, moving);
    this.problem = check.reason;
    this.inTheWay = check.sketch;
    drawing.tiles.push(...layoutTiles(placed, check.ok));
    this.view.setDoor({ door: placed.door, tone: check.ok ? 'ok' : 'bad' });
    return check.ok && !pencil ? world.windowsOnto(placed, moving).length : 0;
  }

  /** The sketch tool: the floor being dragged out, colored as a room's, or the rectangle and the door under the cursor. */
  private drawSketch(drawing: Drawing) {
    const t = this.tool;
    if (t.kind !== 'sketch') return;
    const world = this.sim.world;
    if (t.phase === 'door') {
      this.hint = sketchDoorHint(t.type);
      drawing.tiles.push(...rectTiles(t.rect, OV_BLUE));
      if (!this.cursor) return;
      const door = world.nearestDoor(t.rect, this.cursor.x, this.cursor.y);
      const check = world.sketchDoorValid(t.rect, door);
      this.problem = check.reason;
      this.view.setDoor({ door, tone: check.ok ? 'ok' : 'bad' });
      return;
    }
    this.hint = sketchHint(t.type, t.start && !t.held ? t.rect : null, !!t.moving);
    const free = this.sketchFree();
    if (t.rect) {
      const check = world.sketchRectValid(t.type, t.rect);
      this.problem = check.reason;
      this.inTheWay = check.sketch;
      drawing.tiles.push(...dragTiles(t.rect, check.ok, free));
    } else if (this.cursor) {
      const [x, y] = tileOf(this.cursor);
      drawing.tiles.push([x, y, free(x, y) ? OV_GOOD : OV_BAD]);
    }
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
    this.inTheWay = undefined;
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
    } else if (t.kind === 'template' && t.sketch) {
      view.setGhost(null);
      this.drawLayout(t.layout, drawing, undefined, true);
      this.hint = templateSketchHint(t.name, t.layout.type, copyCost(t.layout), !!t.moving);
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
    } else if (t.kind === 'sketch') {
      view.setGhost(null);
      this.drawSketch(drawing);
    } else if (t.phase === 'drag') {
      view.setGhost(null);
      const spare = t.sketch?.id;
      this.hint =
        t.held && t.rect
          ? heldHint(t.type, t.rect, roomCost(t.type, t.rect))
          : t.noFit && !t.start
            ? `${t.noFit} · Esc cancels`
            : dragHint(t.type, t.start ? t.rect : null, t.rect ? roomCost(t.type, t.rect) : 0);
      if (t.rect) {
        const check = world.roomRectValid(t.type, t.rect, undefined, spare);
        this.problem = check.reason;
        this.inTheWay = check.sketch;
        drawing.tiles.push(...dragTiles(t.rect, check.ok, (x, y) => this.isFree(x, y, spare)));
      } else if (this.cursor) {
        const [x, y] = tileOf(this.cursor);
        drawing.tiles.push([x, y, this.isFree(x, y, spare) ? OV_GOOD : OV_BAD]);
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
