// How the land for sale is shown: named by side, sized in tiles, and outlined on the ground.
import type { LandSide } from '../../core/data';
import type { LandOffer } from '../../core/land';
import type { HeatTile } from '../../render/heatmap';

/** Where each side's plot is, as the Land tab names it. */
export const LAND_NAMES: Readonly<Record<LandSide, string>> = {
  west: 'Next door to the west',
  east: 'Next door to the east',
  back: 'Out the back',
};

/** How big a plot is, across by deep, in tiles. */
export function landSize(o: Pick<LandOffer, 'x0' | 'x1' | 'y0' | 'y1'>): string {
  const across = o.x1 - o.x0 + 1;
  const deep = o.y1 - o.y0 + 1;
  return `${across} × ${deep} tiles`;
}

/** The tiles of the plots for sale, to color on the ground: 1 for the one pointed at, 0 for the rest. */
export function landTiles(offers: readonly LandOffer[], pointedAt: LandSide | null): HeatTile[] {
  const out: HeatTile[] = [];
  for (const o of offers) {
    const value = o.side === pointedAt ? 1 : 0;
    for (let y = o.y0; y <= o.y1; y++) for (let x = o.x0; x <= o.x1; x++) out.push([x, y, value]);
  }
  return out;
}

/** Where to stand a For Sale sign on each plot for sale: its middle. */
export function landSignSpots(offers: readonly LandOffer[]): { x: number; z: number }[] {
  return offers.map((o) => ({ x: (o.x0 + o.x1 + 1) / 2, z: (o.y0 + o.y1 + 1) / 2 }));
}
