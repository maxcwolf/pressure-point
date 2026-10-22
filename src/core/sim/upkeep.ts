// Wear and tear: equipment wearing out, toilets getting grubby, plants drying and warm stones cooling.

import { centerOf, isWatered, ITEMS, type ItemType } from '../data';
import { tuning } from '../difficulty';
import { an, money } from '../format';
import type { Item } from '../state/types';
import { itemCenter } from '../world';
import type { SimContext } from './context';
import { spend } from './economy';
import { emit, toast } from './events';
import { downNotice } from './machines';
import { mishapCarrier } from './mishaps';
import { upgradeWear } from './upgrades';
import { stoneCooling, warmthAt } from './warmth';

/** Plants dry out and warm stones cool as time passes, the stones faster in a cold room. A Living Wall dries slower. */
export function decayItems(ctx: SimContext, dt: number) {
  for (const it of ctx.s.items) {
    if (isWatered(it.type)) it.water = Math.max(0, it.water - dt * (it.type === 'living_wall' ? 0.2 : 0.3));
    else if (it.type === 'stone_warmer')
      it.water = Math.max(0, it.water - dt * stoneCooling(warmthAt(ctx, it.x, it.y)));
  }
}

/** Add wear to an item after a use, or as much as `wear` would add. At full wear it breaks down. */
export function addWear(ctx: SimContext, it: Item, wear = ITEMS[it.type].wear ?? 0) {
  // the sea air is hard on equipment, and upgraded equipment stands up to it better
  const add = wear * (centerOf(ctx.s).wear ?? 1) * upgradeWear(it.level) * tuning(ctx.s, 'wear');
  if (!add || it.wear >= 100) return;
  it.wear = Math.min(100, it.wear + add);
  if (it.wear < 100) return;
  // broken: nobody can use it until a Caretaker has been
  ctx.world.version++;
  const [cx, cy] = itemCenter(it);
  emit(ctx, { type: 'float', text: 'Broken!', x: cx, y: cy, kind: 'bad' });
  emit(ctx, { type: 'sfx', name: 'fail' });
  // a machine's own guests have no table to go to instead, so its notice says who is left waiting
  const text = ITEMS[it.type].machine
    ? downNotice(ctx, it, 'has broken down')
    : `${an(ITEMS[it.type].name, true)} has broken down. It is out of action until a Caretaker repairs it.`;
  toast(ctx, text, 'bad', { kind: 'item', id: it.id });
}

/**
 * A day's wear on what wears by the day rather than by the use: a generator standing by, and one carrying the center
 * through a mishap, which counts as a use and burns a day's fuel.
 */
export function wearByTheDay(ctx: SimContext) {
  const carrier = mishapCarrier(ctx.s);
  for (const it of ctx.s.items) {
    const def = ITEMS[it.type];
    if (!def.dailyWear) continue;
    if (it !== carrier) {
      addWear(ctx, it, def.dailyWear);
      continue;
    }
    addWear(ctx, it, def.wear);
    if (!def.dailyCost) continue;
    spend(ctx, def.dailyCost, 'upkeep');
    const [x, y] = itemCenter(it);
    emit(ctx, { type: 'float', text: money(-def.dailyCost), x, y, kind: 'bad' });
  }
}

/** How grubby an item is after one more use. */
export function dirtier(type: ItemType, dirt: number): number {
  return Math.min(100, dirt + (ITEMS[type].dirt ?? 0));
}
