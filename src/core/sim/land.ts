// More land: buying the plot next door to grow the building into.

import { LAND_SIDES, LAND_STAR, type LandSide } from '../data';
import { landLimits, type LandOffer, nextPlot } from '../land';
import { unlockedUpTo } from '../state/game';
import type { GameState } from '../state/types';
import type { SimContext } from './context';
import { spend } from './economy';
import { emit, toast } from './events';

/** Whether land is for sale yet: from the first star. */
export const landForSale = (s: GameState) => unlockedUpTo(s) >= LAND_STAR;

/** The plots for sale now, one per side with room for one. None before the first star. */
export function landOffers(ctx: SimContext): LandOffer[] {
  if (!landForSale(ctx.s)) return [];
  const limits = landLimits(ctx.s);
  // the land for sale runs the whole length of a side, so the building is still a rectangle
  const { bounds, door } = ctx.world.building;
  return LAND_SIDES.map((side) => nextPlot({ ...bounds, door }, side, limits)).filter((o) => o !== null);
}

/** Buy the plot for sale on a side and grow the building into it. False if none is for sale or it costs too much. */
export function buyLand(ctx: SimContext, side: LandSide): boolean {
  const offer = landOffers(ctx).find((o) => o.side === side);
  if (!offer) return false;
  if (ctx.s.money < offer.price) {
    toast(ctx, 'Not enough money for that land.', 'bad');
    emit(ctx, { type: 'sfx', name: 'error' });
    return false;
  }
  spend(ctx, offer.price, 'building');
  ctx.s.land.push({ plot: 'strip', rects: [{ x0: offer.x0, x1: offer.x1, y0: offer.y0, y1: offer.y1 }] });
  ctx.world.rebuild();
  toast(ctx, 'The land is yours, and the building has grown into it.', 'good');
  emit(ctx, { type: 'sfx', name: 'build' });
  return true;
}
