// The lot every center stands on: the size of the grid, the street along its front, and where a building can stand.
// Every lot is as deep as the others, with the street in the same place; how wide it is is each center's own.

/** How deep every lot is, from the back to the far side of the road, and how wide one is unless its center says. */
export const H = 24;
export const LOT_W = 32;

/** The pavement and the road along the front of every lot. */
export const SIDEWALK_Y = 20;
export const ROAD_Y: readonly [number, number] = [21, 22];

/** A rectangle of tiles, inclusive at both ends. */
export interface Rect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** Land bought next to the building: which of the center's plots it was, and the tiles it covers. */
export interface Land {
  /** The plot's id, or 'strip' for a strip along a whole side, as land was sold before each center had its plots. */
  plot: string;
  /** The tiles it covers, kept with it so the building keeps its shape whatever becomes of the plot. */
  rects: Rect[];
}

/** Where a center's building stands on its lot: the inside of its walls, inclusive, and the two tiles of its front door. */
export interface Plot extends Rect {
  /** The front door's two tiles, along the front wall (row y1). */
  door: readonly [number, number];
}

/** The original lot: a big building across the middle. */
export const SANDBOX_PLOT: Plot = { x0: 3, x1: 27, y0: 3, y1: 17, door: [14, 15] };

/** The sides a building can grow on: never the front, which faces the street. */
export type LandSide = 'west' | 'east' | 'back';
export const LAND_SIDES: readonly LandSide[] = ['west', 'east', 'back'];

/** How far a building can grow: its west wall's lowest x, its east wall's highest, and its back wall's lowest y. */
export type LandLimits = Readonly<Record<LandSide, number>>;
/** The edges of a lot so wide, as far as any building can grow toward them. */
export const landLimitsFor = (width: number): LandLimits => ({ west: 1, east: width - 2, back: 1 });
/** How many tiles deep a plot of land is, at most; the last plot on a side takes what is left, if that is not much more. */
export const LAND_STEP = 4;
/** What a tile of land costs. */
export const LAND_TILE_PRICE = 250;
/** The first star at which land comes up for sale. */
export const LAND_STAR = 1;

/** The row just outside the front door, where the path to the pavement starts. */
export const outsideDoor = (p: Plot) => p.y1 + 1;

/** Whether a building fits a lot so wide: inside the grid, clear of the pavement, with its door on its front wall. */
export function plotFits(p: Plot, width = LOT_W): boolean {
  const [d0, d1] = p.door;
  return (
    p.x0 >= 1 &&
    p.x1 <= width - 2 &&
    p.y0 >= 1 &&
    p.x0 < p.x1 &&
    p.y0 < p.y1 &&
    outsideDoor(p) < SIDEWALK_Y &&
    d1 === d0 + 1 &&
    d0 > p.x0 &&
    d1 < p.x1
  );
}
