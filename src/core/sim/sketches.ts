// Rooms pencilled in for later: drawn on the floor for nothing, erased, and built when the player is ready. A sketch
// is not a room: nothing that reads the rooms sees it, and it blocks nobody's way. It only keeps anything else from
// being built over it (build-rules.ts). One pencilled in from a template remembers the room, and is built whole.

import { ITEMS, ROOMS, type RoomType } from '../data';
import { roomCost } from '../resize';
import { copyCost, type Layout, type PlacedLayout, placeLayout } from '../room-layout';
import type { GameState, Room, Sketch, WallSpot } from '../state/types';
import type { Rect, World } from '../world';
import { buildLayout, createRoom, removeRoom } from './building';
import type { SimContext } from './context';
import { emit, tipOnce } from './events';

/** The first-time tip as the first sketch goes down. */
export const SKETCH_TIP =
  "Pencilled in. Click it and press Build here when you're ready. Nothing is charged until then.";

/**
 * What building a sketch would cost: its room at its size, as the drag and the blueprint price it, or, for one that
 * remembers a room, that room whole, furniture and windows and all, as its template prices it.
 */
export const sketchCost = (sk: Pick<Sketch, 'type' | 'w' | 'h' | 'layout'>) =>
  sk.layout && knownLayout(sk.layout) ? copyCost(sk.layout) : roomCost(sk.type, sk);

/** Whether this version knows every piece of furniture a layout holds, and so can price it. */
export const knownLayout = (l: Layout) => l.items.every((it) => Object.hasOwn(ITEMS, it.type));

/** What building every sketch would cost. */
export const sketchesCost = (s: Pick<GameState, 'sketches'>) => s.sketches.reduce((sum, sk) => sum + sketchCost(sk), 0);

/** Whether a sketch inside the building no longer fits where it is, or its doorway is blocked: not one waiting for land. */
export function noLongerFits(world: Pick<World, 'sketchFit'>, sk: Sketch): boolean {
  const { standing } = world.sketchFit(sk);
  return standing === 'doorway' || standing === 'unfit';
}

/** How many of the sketches no longer fit where they are. */
export const unfitCount = (world: Pick<World, 's' | 'sketchFit'>) =>
  world.s.sketches.filter((sk) => noLongerFits(world, sk)).length;

/** The sketch with this id, if there is one. */
export const sketchById = (s: Pick<GameState, 'sketches'>, id: number) => s.sketches.find((sk) => sk.id === id);

/** Put a sketch on the floor, and say what it is for the first time one goes down. The view repaints the floor. */
function putDown(
  ctx: SimContext,
  type: RoomType,
  r: Rect,
  door: WallSpot,
  remembers?: { layout: Layout; template: string },
): Sketch {
  const sketch: Sketch = {
    id: ctx.s.nextId++,
    type,
    x: r.x,
    y: r.y,
    w: r.w,
    h: r.h,
    door: { ...door },
    day: Math.floor(ctx.s.day),
    // a copy, so the template can change or go without the sketch changing with it
    ...(remembers && { layout: structuredClone(remembers.layout), template: remembers.template }),
  };
  ctx.s.sketches.push(sketch);
  // nothing has moved, but the floor has a sketch to paint
  ctx.world.version++;
  emit(ctx, { type: 'sfx', name: 'place' });
  tipOnce(ctx, 'sketch', SKETCH_TIP, 'info', undefined, ROOMS[type].icon);
  return sketch;
}

/** Pencil a room in, for nothing. Null if it cannot go there, or its door cannot. */
export function addSketch(ctx: SimContext, type: RoomType, r: Rect, door: WallSpot): Sketch | null {
  if (!ctx.world.sketchRectValid(type, r).ok || !ctx.world.sketchDoorValid(r, door).ok) return null;
  return putDown(ctx, type, r, door);
}

/**
 * Pencil a template in, for nothing, where building it could go today: the sketch remembers its layout as it was put
 * down, and its name. Null if it cannot go there.
 */
export function pencilTemplate(ctx: SimContext, name: string, layout: Layout, placed: PlacedLayout): Sketch | null {
  if (!ctx.world.templateSketchValid(layout, placed).ok) return null;
  return putDown(ctx, layout.type, placed.rect, placed.door, { layout, template: name });
}

/** Forget the room a sketch remembers, leaving its floor and door pencilled in. False if it remembers none. */
export function forgetTemplate(ctx: SimContext, id: number): boolean {
  const sketch = sketchById(ctx.s, id);
  if (!sketch?.layout) return false;
  delete sketch.layout;
  delete sketch.template;
  // its furniture and windows come off the floor
  ctx.world.version++;
  emit(ctx, { type: 'sfx', name: 'blip' });
  return true;
}

/** Rub a sketch out. False if there is no such sketch. */
export function eraseSketch(ctx: SimContext, id: number): boolean {
  const at = ctx.s.sketches.findIndex((sk) => sk.id === id);
  if (at < 0) return false;
  ctx.s.sketches.splice(at, 1);
  ctx.world.version++;
  emit(ctx, { type: 'sfx', name: 'blip' });
  return true;
}

/**
 * Build a sketch where it is: it gives way to a blueprint of its room in its rectangle, with its door, paid for when
 * the blueprint is. Null, with the sketch kept, if the room no longer fits there.
 */
export function buildSketch(ctx: SimContext, id: number): Room | null {
  const sketch = sketchById(ctx.s, id);
  if (!sketch || !ctx.world.sketchFits(sketch).ok) return null;
  if (sketch.layout) return buildWhole(ctx, sketch, sketch.layout);
  ctx.s.sketches = ctx.s.sketches.filter((sk) => sk !== sketch);
  return createRoom(ctx, sketch.type, sketch, sketch.door);
}

/**
 * Build the room a sketch remembers, furniture, windows and all, where it is, as building its template there would:
 * paid for at once, and open at once. Null, with the sketch kept, if the bank cannot cover it.
 */
function buildWhole(ctx: SimContext, sketch: Sketch, layout: Layout): Room | null {
  const at = ctx.s.sketches.indexOf(sketch);
  // out of its own way first, as nothing may be built over a sketch
  ctx.s.sketches.splice(at, 1);
  const name = `"${sketch.template ?? ROOMS[layout.type].name}"`;
  const room = buildLayout(ctx, layout, placeLayout(layout, sketch.x, sketch.y), {
    cost: name,
    built: `${name} built`,
  });
  if (!room) ctx.s.sketches.splice(at, 0, sketch);
  return room;
}

/**
 * Start a blueprint for a sketch's room on floor of the player's choosing, as when the sketch no longer fits where it
 * is: the sketch gives way if the room lands on any of its floor, and is kept if not. Null if there is no such sketch.
 */
export function buildSketchAt(ctx: SimContext, id: number, r: Rect, door: WallSpot): Room | null {
  const sketch = sketchById(ctx.s, id);
  if (!sketch) return null;
  const covers = sketch.x < r.x + r.w && r.x < sketch.x + sketch.w && sketch.y < r.y + r.h && r.y < sketch.y + sketch.h;
  if (covers) ctx.s.sketches = ctx.s.sketches.filter((sk) => sk !== sketch);
  return createRoom(ctx, sketch.type, r, door);
}

/**
 * Put a sketch back as it was, as when the blueprint it gave way to is cancelled. False, and it stays gone, if its
 * floor has been taken meanwhile.
 */
export function restoreSketch(ctx: SimContext, sketch: Sketch): boolean {
  if (sketchById(ctx.s, sketch.id) || !ctx.world.sketchRectValid(sketch.type, sketch).ok) return false;
  ctx.s.sketches.push({ ...sketch, door: { ...sketch.door } });
  ctx.world.version++;
  return true;
}

/**
 * Pencil a blueprint in for later instead: it is torn up as Cancel tears it up, its windows and extras refunded, and a
 * sketch of it keeps its floor and door. Null if there is no such blueprint.
 */
export function sketchBlueprint(ctx: SimContext, roomId: number): Sketch | null {
  const room = ctx.world.room(roomId);
  if (!room || room.done) return null;
  const { type, door } = room;
  const rect = { x: room.x, y: room.y, w: room.w, h: room.h };
  removeRoom(ctx, roomId, 1);
  return putDown(ctx, type, rect, door);
}
