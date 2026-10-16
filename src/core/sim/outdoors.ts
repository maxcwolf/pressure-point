// Out of doors: the paths between the center's buildings, and the weather on anyone walking them.

import { centerOf, IDEAL_TEMP, OUTDOOR_BAND } from '../data';
import { onPath } from '../footprint';
import type { SimContext } from './context';
import { feel } from './feelings';
import { mishapOn } from './mishaps';
import { outdoorTemp } from './warmth';

/** Whether the weather is bad enough to mind, out of doors: a storm, or well past the cool or warm of a fine day. */
export function badWeather(ctx: SimContext): boolean {
  if (mishapOn(ctx.s)?.id === 'storm') return true;
  return ctx.s.weatherOn && Math.abs(outdoorTemp(centerOf(ctx.s).climate, ctx.s.day) - IDEAL_TEMP) > OUTDOOR_BAND;
}

/** Guests walking the paths between buildings in bad weather mind it. The pavement they come along is another matter. */
export function updateOutdoors(ctx: SimContext) {
  const fp = ctx.world.building;
  if (!fp.paths.length || !badWeather(ctx)) return;
  for (const g of ctx.s.guests) if (onPath(fp, g.tx, g.ty)) feel(g, 'out-in-weather');
}
