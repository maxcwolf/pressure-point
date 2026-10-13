// Build tools and selection: turns pointer input into rooms, doors and furniture.
import { ITEMS, ROOMS, type ItemType, type RoomType } from './data';
import { OV_ACCESS, OV_BAD, OV_BLUE, OV_GOOD, type OverlayTile, type Selection, type View } from './render/view';
import { money, type Sim } from './sim';
import type { Room } from './state';
import { accessTile, footprint, inBuilding, itemDims, tileIdx, Z_CORRIDOR, type Rect } from './world';

type Tool =
  | { kind: 'none' }
  | { kind: 'item'; type: ItemType; rot: number }
  | { kind: 'room'; type: RoomType; phase: 'drag'; start: [number, number] | null; rect: Rect | null }
  | { kind: 'room'; type: RoomType; phase: 'door'; rect: Rect }
  | { kind: 'room'; type: RoomType; phase: 'items'; room: Room; queue: ItemType[]; rot: number };

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
    private sfx: (name: string) => void,
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

  startItem(type: ItemType) {
    this.cancel();
    this.tool = { kind: 'item', type, rot: 0 };
    this.select(null);
    this.refresh();
  }

  startRoom(type: RoomType) {
    this.cancel();
    const def = ROOMS[type];
    if (this.sim.s.money < def.cost) {
      this.sim.emit({ type: 'toast', text: `A ${def.name} costs ${money(def.cost)}. You can't afford it yet.`, kind: 'bad' });
      this.sfx('error');
      return;
    }
    this.tool = { kind: 'room', type, phase: 'drag', start: null, rect: null };
    this.select(null);
    this.refresh();
  }

  /** Back out of the current tool. An unfinished room is removed at no cost. */
  cancel() {
    const t = this.tool;
    if (t.kind === 'room' && t.phase === 'items') this.sim.removeRoom(t.room.id, 0);
    this.tool = { kind: 'none' };
    this.refresh();
  }

  rotate() {
    const t = this.tool;
    if (t.kind === 'item' || (t.kind === 'room' && t.phase === 'items')) {
      t.rot = (t.rot + 1) & 3;
      this.sfx('blip');
      this.refresh();
    }
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

  /** Left button released without having dragged the camera. */
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
        this.tool = { kind: 'room', type: t.type, phase: 'items', room, queue: [...ROOMS[t.type].required], rot: 0 };
      } else this.sfx('error');
    } else {
      const type = t.queue[0];
      const spot = this.itemSpot(type, t.rot);
      if (spot && sim.placeItem(type, spot[0], spot[1], t.rot, { free: true, roomId: t.room.id })) {
        t.queue.shift();
        if (!t.queue.length) {
          sim.finishRoom(t.room);
          this.tool = { kind: 'none' };
          this.select({ kind: 'room', id: t.room.id });
        }
      } else if (spot) this.sfx('error');
    }
    this.refresh();
  }

  /** Top-left tile for an item centered on the cursor. */
  private itemSpot(type: ItemType, rot: number): [number, number] | null {
    if (!this.cursor) return null;
    const [w, h] = itemDims(type, rot);
    return [Math.floor(this.cursor.x - w / 2 + 0.5), Math.floor(this.cursor.y - h / 2 + 0.5)];
  }

  private itemOverlay(type: ItemType, rot: number, roomId: number | undefined, tiles: OverlayTile[]) {
    const spot = this.itemSpot(type, rot);
    if (!spot) {
      this.view.setGhost(null);
      return;
    }
    const check = this.sim.world.canPlaceItem(type, spot[0], spot[1], rot, roomId);
    const placed = { type, x: spot[0], y: spot[1], rot };
    for (const [x, y] of footprint(placed)) tiles.push([x, y, check.ok ? OV_GOOD : OV_BAD]);
    for (let i = 0; i < ITEMS[type].access.length; i++) {
      const [x, y] = accessTile(placed, i);
      tiles.push([x, y, OV_ACCESS]);
    }
    this.problem = check.reason;
    this.view.setGhost({ ...placed, ok: check.ok });
  }

  /** Recompute overlays, ghost and hint for the current tool state. */
  refresh() {
    const t = this.tool;
    const view = this.view;
    const world = this.sim.world;
    const tiles: OverlayTile[] = [];
    this.problem = '';
    this.hint = '';
    view.setDoor(null);
    if (t.kind === 'none') {
      view.setGhost(null);
    } else if (t.kind === 'item') {
      const def = ITEMS[t.type];
      this.hint = `${def.icon} ${def.name} · ${money(def.cost)} each · click to place · R rotates · Esc when done`;
      this.itemOverlay(t.type, t.rot, undefined, tiles);
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
            tiles.push([x, y, free && check.ok ? OV_GOOD : free ? OV_ACCESS : OV_BAD]);
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
        view.setDoor({ door, ok: check.ok });
      }
    } else {
      const type = t.queue[0];
      const def = ITEMS[type];
      const total = ROOMS[t.type].required.length;
      this.hint = `${def.icon} Place the ${def.name} (${total - t.queue.length + 1} of ${total}) · R rotates · Esc cancels the room`;
      this.itemOverlay(type, t.rot, t.room.id, tiles);
    }
    view.setOverlay(tiles);
    this.onChange();
  }
}
