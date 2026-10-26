// Land: buying the plots next door, the builders' days of work on each, and the building growing into it after.

import { ITEMS } from '../data';
import { buildDays, nameInSentence, plotGroundAt, type PlotOffer, plotOffers } from '../land';
import { footprint } from '../world';
import { takeDownLoose } from './building';
import type { SimContext } from './context';
import { spend } from './economy';
import { emit, toast } from './events';

/** How long a plot's name can be. */
export const PLOT_NAME_MAX = 32;

/** Each of the center's plots as things stand: the game's, being built on, for sale and for how much, or not yet. */
export const landOffers = (ctx: SimContext): PlotOffer[] => plotOffers(ctx.s, ctx.world.building);

/** Buy a plot and set the builders to work on it. False if it is not for sale or costs too much. */
export function buyPlot(ctx: SimContext, id: string): boolean {
  const offer = landOffers(ctx).find((o) => o.def.id === id);
  if (offer?.state !== 'open') return false;
  if (ctx.s.money < offer.price) {
    toast(ctx, 'Not enough money for that land.', 'bad');
    emit(ctx, { type: 'sfx', name: 'error' });
    return false;
  }
  // nothing can stand on a plot before it is the game's, but a plot drawn since a save was made could reach under it
  const inTheWay = ctx.s.items.find(
    (it) =>
      ITEMS[it.type].where === 'outdoors' &&
      footprint(it).some(([x, y]) => plotGroundAt([offer.def], x, y) !== undefined),
  );
  if (inTheWay) {
    toast(ctx, `Move the ${ITEMS[inTheWay.type].name} off that land first.`, 'bad', { kind: 'item', id: inTheWay.id });
    emit(ctx, { type: 'sfx', name: 'error' });
    return false;
  }
  spend(ctx, offer.price, 'building');
  ctx.s.sawPlots = true;
  const days = buildDays(offer.def);
  const { def } = offer;
  ctx.s.land.push({
    plot: id,
    rects: def.rects.map((r) => ({ ...r })),
    ...(def.entrance && { entrance: { ...def.entrance }, path: (def.path ?? []).map((r) => ({ ...r })) }),
    ready: ctx.s.day + days,
  });
  // nothing on the floor has moved, but a sketch on the plot now waits for the builders rather than the sale
  ctx.world.version++;
  toast(ctx, `${offer.name} is yours. The builders are at work on it, and will be done in ${days} days.`, 'good');
  emit(ctx, { type: 'sfx', name: 'build' });
  return true;
}

/** Once the builders are done with a plot, the fence comes down and the building grows into it. */
export function updateLand(ctx: SimContext) {
  const done = ctx.s.land.filter((l) => l.ready !== undefined && ctx.s.day >= l.ready);
  if (!done.length) return;
  for (const l of done) delete l.ready;
  ctx.world.rebuild();
  // the building has grown past what was hung on its old outer wall
  takeDownLoose(ctx);
  for (const offer of landOffers(ctx).filter((o) => done.some((l) => l.plot === o.def.id)))
    toast(
      ctx,
      offer.def.entrance
        ? `Work on ${nameInSentence(offer.name)} is done: it has a door of its own, and a path out to it.`
        : `Work on ${nameInSentence(offer.name)} is done, and the building has grown into it.`,
      'good',
    );
  emit(ctx, { type: 'sfx', name: 'build' });
}

/**
 * Name a plot of the game's, or give it back the name it came with if the new one is blank. A plot the game has only
 * because strips bought before plots cover it is noted as land of its own, with no tiles, to keep its name.
 */
export function renamePlot(ctx: SimContext, id: string, name: string): boolean {
  let land = ctx.s.land.find((l) => l.plot === id);
  if (!land) {
    if (landOffers(ctx).find((o) => o.def.id === id)?.state !== 'owned') return false;
    land = { plot: id, rects: [] };
    ctx.s.land.push(land);
  }
  const trimmed = name.trim().slice(0, PLOT_NAME_MAX);
  if (trimmed) land.name = trimmed;
  else delete land.name;
  return true;
}
