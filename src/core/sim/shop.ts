// The Shop Counter: whether a guest stops at it on the way out, and what they spend there.

import { ITEMS, SHOP_CHANCE, SHOP_LINE_SKIP, SHOP_SPEND } from '../data';
import { random, rnd, type Rng } from '../random';
import type { Guest, Item } from '../state/types';
import { at, clamp } from '../util';
import { staffById } from './chars';
import type { SimContext } from './context';
import { reviewStars } from './feelings';
import { perkProduct } from './perks';

/** Whether an item is a Shop Counter, where guests stop to buy something on the way out. */
export const isCounter = (it: Item) => ITEMS[it.type].station?.goal === 'shop';

/** The stars a treated guest, or a class-goer, gave their visit. */
export const visitStars = (g: Guest) =>
  reviewStars(g.outcome === 'healed' || g.outcome === 'class' ? g.outcome : 'failed', g.feelings);

/** What a guest spends at the Shop Counter, by the stars they gave their visit: a round number, a little either way. */
export function shopSpend(r: Rng, stars: number): number {
  return Math.round((at(SHOP_SPEND, clamp(stars, 0, SHOP_SPEND.length - 1)) * rnd(r, 0.8, 1.2)) / 5) * 5;
}

/**
 * Whether a treated guest stops at the Shop Counter on the way out: likelier the better their visit went, and not at
 * all if every counter already has a line of `SHOP_LINE_SKIP`.
 */
export function wantsToShop(ctx: SimContext, g: Guest): boolean {
  const counters = ctx.s.items.filter((i) => isCounter(i) && ctx.world.usable(i));
  if (!counters.length) return false;
  if (Math.min(...counters.map((i) => i.queue.length)) >= SHOP_LINE_SKIP) return false;
  // an Upseller working a counter talks more of them into it
  const upsell = Math.max(...counters.map((i) => perkProduct(staffById(ctx, i.staffId), 'shop')));
  return random(ctx.s) < at(SHOP_CHANCE, clamp(visitStars(g), 0, SHOP_CHANCE.length - 1)) * upsell;
}
