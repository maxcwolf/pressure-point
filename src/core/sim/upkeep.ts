// Wear and tear: equipment wearing out, plants drying and warm stones cooling.

import { ITEMS } from '../data';
import type { Item } from '../state/types';
import { itemCenter } from '../world';
import type { SimContext } from './context';
import { emit, toast } from './events';

/** Plants dry out and warm stones cool as time passes. */
export function decayItems(ctx: SimContext, dt: number) {
  for (const it of ctx.s.items) {
    if (it.type === 'plant') it.water = Math.max(0, it.water - dt * 0.3);
    else if (it.type === 'stone_warmer') it.water = Math.max(0, it.water - dt * 0.08);
  }
}

/** Add wear to an item after a use. At full wear it breaks down. */
export function addWear(ctx: SimContext, it: Item) {
  const add = ITEMS[it.type].wear ?? 0;
  if (!add || it.wear >= 100) return;
  it.wear = Math.min(100, it.wear + add);
  if (it.wear < 100) return;
  // broken: nobody can use it until a Janitor has been
  ctx.world.version++;
  const [cx, cy] = itemCenter(it);
  emit(ctx, { type: 'float', text: 'Broken!', x: cx, y: cy, kind: 'bad' });
  emit(ctx, { type: 'sfx', name: 'fail' });
  toast(ctx, `A ${ITEMS[it.type].name} has broken down. It is out of action until a Janitor repairs it.`, 'bad');
}
