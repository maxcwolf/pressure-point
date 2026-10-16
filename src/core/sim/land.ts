// Land: buying the plots next door to grow the building into.

import { type PlotOffer, plotOffers } from '../land';
import type { SimContext } from './context';
import { spend } from './economy';
import { emit, toast } from './events';

/** Each of the center's plots as things stand: the game's, for sale and for how much, or not yet. */
export const landOffers = (ctx: SimContext): PlotOffer[] => plotOffers(ctx.s, ctx.world.building);

/** Buy a plot and grow the building into it. False if it is not for sale or costs too much. */
export function buyPlot(ctx: SimContext, id: string): boolean {
  const offer = landOffers(ctx).find((o) => o.def.id === id);
  if (offer?.state !== 'open') return false;
  if (ctx.s.money < offer.price) {
    toast(ctx, 'Not enough money for that land.', 'bad');
    emit(ctx, { type: 'sfx', name: 'error' });
    return false;
  }
  spend(ctx, offer.price, 'building');
  ctx.s.land.push({ plot: id, rects: offer.def.rects.map((r) => ({ ...r })) });
  ctx.world.rebuild();
  toast(ctx, `${offer.def.name} is yours, and the building has grown into it.`, 'good');
  emit(ctx, { type: 'sfx', name: 'build' });
  return true;
}
