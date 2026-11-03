// What the center has: its rooms, items and staff, which items stand together, and the land it could buy. Questions
// only: nothing here changes the game, so any part of the simulation may ask them.

import type { ItemType, Role, RoomType } from '../data';
import { machineRoom, MODALITIES, type Modality } from '../data';
import { type PlotOffer, plotOffers } from '../land';
import type { GameState, Item } from '../state/types';
import { footprint } from '../world';
import type { SimContext } from './context';

/** Whether the center has a usable item of this type. */
export function hasItem(ctx: SimContext, t: ItemType) {
  return ctx.s.items.some((i) => i.type === t && ctx.world.usable(i));
}

/** Whether the center has a finished room of this type. */
export function hasRoom(ctx: SimContext, t: RoomType) {
  return ctx.s.rooms.some((r) => r.type === t && r.done);
}

/** Whether anyone in this role is on the payroll and staying. */
export function hasStaff(ctx: SimContext, r: Role) {
  return ctx.s.staff.some((x) => x.role === r && x.state !== 'leaving');
}

/** How many working items of a type share a room with an item. */
export function sameRoomCount(ctx: SimContext, item: Item, type: ItemType): number {
  const zone = ctx.world.zoneAt(item.x, item.y);
  if (zone <= 0) return 0;
  return ctx.s.items.filter((i) => i.type === type && ctx.world.usable(i) && ctx.world.zoneAt(i.x, i.y) === zone)
    .length;
}

/** Whether a machine technique's room has been built, so its technique can be learned and priced. Any other, true. */
export function machineBuilt(s: Pick<GameState, 'rooms'>, m: Modality): boolean {
  const machine = MODALITIES[m].machine;
  if (!machine) return true;
  const room = machineRoom(machine);
  return s.rooms.some((r) => r.done && r.type === room);
}

/** The other items standing beside an item: any of their tiles next to any of its own, corners included. */
export function itemsBeside(ctx: SimContext, it: Item): Item[] {
  const near = new Set<string>();
  for (const [x, y] of footprint(it))
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) near.add(`${x + dx},${y + dy}`);
  return ctx.s.items.filter((o) => o !== it && footprint(o).some(([x, y]) => near.has(`${x},${y}`)));
}

/** Each of the center's plots as things stand: the game's, being built on, for sale and for how much, or not yet. */
export const landOffers = (ctx: SimContext): PlotOffer[] => plotOffers(ctx.s, ctx.world.building);
