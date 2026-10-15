// Wear and tear: equipment wearing out, toilets getting grubby, plants drying and warm stones cooling.

import { centerOf, ITEMS, type ItemType } from '../data';
import { tuning } from '../difficulty';
import type { Item } from '../state/types';
import { itemCenter } from '../world';
import type { SimContext } from './context';
import { emit, toast } from './events';
import { upgradeWear } from './upgrades';
import { stoneCooling, warmthAt } from './warmth';

/** Plants dry out and warm stones cool as time passes, the stones faster in a cold room. */
export function decayItems(ctx: SimContext, dt: number) {
  for (const it of ctx.s.items) {
    if (it.type === 'plant') it.water = Math.max(0, it.water - dt * 0.3);
    else if (it.type === 'stone_warmer')
      it.water = Math.max(0, it.water - dt * stoneCooling(warmthAt(ctx, it.x, it.y)));
  }
}

/** Add wear to an item after a use. At full wear it breaks down. */
export function addWear(ctx: SimContext, it: Item) {
  // the sea air is hard on equipment, and upgraded equipment stands up to it better
  const add = (ITEMS[it.type].wear ?? 0) * (centerOf(ctx.s).wear ?? 1) * upgradeWear(it.level) * tuning(ctx.s, 'wear');
  if (!add || it.wear >= 100) return;
  it.wear = Math.min(100, it.wear + add);
  if (it.wear < 100) return;
  // broken: nobody can use it until a Caretaker has been
  ctx.world.version++;
  const [cx, cy] = itemCenter(it);
  emit(ctx, { type: 'float', text: 'Broken!', x: cx, y: cy, kind: 'bad' });
  emit(ctx, { type: 'sfx', name: 'fail' });
  toast(ctx, `A ${ITEMS[it.type].name} has broken down. It is out of action until a Caretaker repairs it.`, 'bad', {
    kind: 'item',
    id: it.id,
  });
}

/** How grubby an item is after one more use. */
export function dirtier(type: ItemType, dirt: number): number {
  return Math.min(100, dirt + (ITEMS[type].dirt ?? 0));
}
