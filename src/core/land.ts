// The plots of land next to a building, which it can grow into: on the west, the east or at the back. The building
// stays a rectangle, so each plot runs the whole length of the side it is on.

import { centerOf, LAND_LIMITS, LAND_STEP, LAND_TILE_PRICE, type LandLimits, type LandSide, type Plot } from './data';
import type { GameState } from './state/types';

/** A plot of land for sale: the side it is on, the tiles it covers, and what it costs. */
export interface LandOffer {
  side: LandSide;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** How many tiles deep it is, out from the wall. */
  depth: number;
  price: number;
}

/** How far the building can grow at this center. */
export const landLimits = (s: GameState): LandLimits => ({ ...LAND_LIMITS, ...centerOf(s).land });

/** How many tiles of lawn there are between a side of the building and the edge of the lot. */
export function roomToGrow(plot: Plot, side: LandSide, limits: LandLimits): number {
  if (side === 'west') return plot.x0 - limits.west;
  if (side === 'east') return limits.east - plot.x1;
  return plot.y0 - limits.back;
}

/**
 * The next plot of land on a side, or null if there is no room for one at least two tiles deep. A plot is LAND_STEP
 * deep, except that the last on a side takes the rest when only a tile more is left, rather than leave a sliver.
 */
export function nextPlot(plot: Plot, side: LandSide, limits: LandLimits): LandOffer | null {
  const room = roomToGrow(plot, side, limits);
  if (room < 2) return null;
  const depth = room <= LAND_STEP + 1 ? room : LAND_STEP;
  const rect =
    side === 'west'
      ? { x0: plot.x0 - depth, x1: plot.x0 - 1, y0: plot.y0, y1: plot.y1 }
      : side === 'east'
        ? { x0: plot.x1 + 1, x1: plot.x1 + depth, y0: plot.y0, y1: plot.y1 }
        : { x0: plot.x0, x1: plot.x1, y0: plot.y0 - depth, y1: plot.y0 - 1 };
  const tiles = (rect.x1 - rect.x0 + 1) * (rect.y1 - rect.y0 + 1);
  return { side, ...rect, depth, price: tiles * LAND_TILE_PRICE };
}

/** The building grown by a plot of land on one side. The front, and its door, stay where they are. */
export function grownBy(plot: Plot, offer: Pick<LandOffer, 'x0' | 'x1' | 'y0' | 'y1'>): Plot {
  return {
    ...plot,
    x0: Math.min(plot.x0, offer.x0),
    x1: Math.max(plot.x1, offer.x1),
    y0: Math.min(plot.y0, offer.y0),
  };
}

/** The building on its lot after the plots bought, in the order they were bought. */
export function plotWith(base: Plot, bought: readonly LandSide[], limits: LandLimits): Plot {
  let plot = base;
  for (const side of bought) {
    const offer = nextPlot(plot, side, limits);
    if (offer) plot = grownBy(plot, offer);
  }
  return plot;
}
