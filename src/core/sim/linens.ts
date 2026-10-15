// Fresh linens: each session soils a treatment table's linens a little, until a Janitor changes them for fresh ones
// from a hamper, where the used set goes. When the hamper fills, a Janitor launders the lot.

import { DIRT_CLEAN, HAMPER_LAUNDER, HAMPER_SIZE, ITEMS, LINENS_PENALTY, LINENS_STALE } from '../data';
import type { Guest, Item } from '../state/types';
import { clamp } from '../util';
import type { SimContext } from './context';
import { tipOnce } from './events';
import { feel } from './feelings';
import { dirtier } from './upkeep';

/** Whether an item is a table with linens on it. */
export const hasLinens = (it: Item) => !!ITEMS[it.type].linens;

/** Whether a table's linens are stale: guests notice, and results suffer. */
export const staleLinens = (it: Item) => hasLinens(it) && it.dirt >= LINENS_STALE;

/** How much a table's linens take off the chance of a treatment working: nothing until they want changing. */
export const linensPenalty = (it: Item) =>
  hasLinens(it) ? clamp((it.dirt - DIRT_CLEAN) / (100 - DIRT_CLEAN), 0, 1) * LINENS_PENALTY : 0;

/** Whether an item is a linen hamper. */
export const isHamper = (it: Item) => it.type === 'linen_hamper';

/** Whether a hamper is full enough to want laundering. */
export const wantsLaundering = (it: Item) => isHamper(it) && it.water >= HAMPER_LAUNDER;

/** Whether a hamper is full right up, so no more linens can be changed from it. */
export const hamperFull = (it: Item) => isHamper(it) && it.water >= HAMPER_SIZE;

/** A hamper with room for another soiled set, if there is one. */
export const hamperWithRoom = (ctx: SimContext) => ctx.s.items.find((it) => isHamper(it) && !hamperFull(it));

/** A session on a table soils its linens a little more, and a guest lying on stale ones notices. */
export function useLinens(ctx: SimContext, it: Item, g: Guest) {
  if (!hasLinens(it)) return;
  if (staleLinens(it)) feel(g, 'stale-linens');
  it.dirt = dirtier(it.type, it.dirt);
  if (!staleLinens(it)) return;
  tipOnce(
    ctx,
    'linens',
    hamperWithRoom(ctx)
      ? 'The linens on a treatment table are stale. Guests notice, and treatments work less often. A Janitor will be along to change them.'
      : 'The linens on a treatment table are stale, and there is nowhere to get fresh ones. Place a Linen Hamper, and a Janitor will change them.',
    'bad',
    { kind: 'item', id: it.id },
  );
}

/** Change a table's linens for a fresh set, the soiled one going into a hamper. False if every hamper is full. */
export function changeLinens(ctx: SimContext, it: Item): boolean {
  const hamper = hamperWithRoom(ctx);
  if (!hamper) return false;
  it.dirt = 0;
  hamper.water += 1;
  if (hamperFull(hamper))
    tipOnce(
      ctx,
      'hamper-full',
      'A Linen Hamper is full. Until a Janitor launders it, no more linens can be changed from it. A second hamper helps.',
      'bad',
      { kind: 'item', id: hamper.id },
    );
  return true;
}

/** Launder a hamper's linens, emptying it. */
export function launder(it: Item) {
  it.water = 0;
}
