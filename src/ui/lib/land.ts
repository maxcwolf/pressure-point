// How land is shown: a plot's size, its tiles outlined on the ground, the middle of it, and the hint as the Expand tool
// points at it.

import type { PlotDef } from '../../core/data';
import { money } from '../../core/format';
import { type PlotOffer, plotTiles } from '../../core/land';
import type { HeatTile } from '../../render/heatmap';

/** How big a plot is: across by deep, or in tiles for one that is not a plain rectangle. */
export function plotSize(def: Pick<PlotDef, 'rects'>): string {
  const [only] = def.rects;
  if (def.rects.length === 1 && only) return `${only.x1 - only.x0 + 1} × ${only.y1 - only.y0 + 1} tiles`;
  return `${plotTiles(def).length} tiles`;
}

/** How a plot not yet the game's is colored on the ground: brightest pointed at, dimmest while not for sale. */
export const PLOT_POINTED = 1;
export const PLOT_LOCKED = 0.5;
export const PLOT_OPEN = 0;

/** The tiles of the plots not yet the game's, to color on the ground, the one pointed at brightest. */
export function plotHeat(offers: readonly PlotOffer[], pointedAt: string | null): HeatTile[] {
  const out: HeatTile[] = [];
  for (const o of offers) {
    if (o.state === 'owned') continue;
    const value = o.def.id === pointedAt ? PLOT_POINTED : o.state === 'locked' ? PLOT_LOCKED : PLOT_OPEN;
    for (const [x, y] of plotTiles(o.def)) out.push([x, y, value]);
  }
  return out;
}

/** The center of a plot, for the camera to glide to. */
export function plotMiddle(def: Pick<PlotDef, 'rects'>): [x: number, y: number] {
  const tiles = plotTiles(def);
  const x = tiles.reduce((sum, [tx]) => sum + tx, 0) / tiles.length;
  const y = tiles.reduce((sum, [, ty]) => sum + ty, 0) / tiles.length;
  return [x + 0.5, y + 0.5];
}

/** The hint while the Expand tool is in hand: the plot pointed at and what it costs, or how to use the tool. */
export function expandHint(o: PlotOffer | undefined): string {
  if (!o) return '🏡 Expand · point at a plot of land to see what it costs · Esc when done';
  const what = `🏡 ${o.def.name} · ${plotSize(o.def)}`;
  if (o.state === 'owned') return `${what} · yours`;
  if (o.state === 'locked') return `${what} · ${money(o.price)}`;
  return `${what} · ${money(o.price)} · click to buy`;
}
