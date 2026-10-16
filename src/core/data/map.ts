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
  /** Its door and the paving out to it, for a building of its own, kept with it like its tiles. */
  entrance?: Entrance;
  path?: Rect[];
  /** The game day the builders finish, while they are still at work: the building grows into it then. */
  ready?: number;
  /** What the player has named it, if they have. */
  name?: string;
}

/** A plot of land a center sells next to its building, drawn for it. */
/** The four ways a wall can face, out of a building or a room. */
export type Side = 'north' | 'south' | 'east' | 'west';

/** A door in a building's outer wall, two tiles wide: the first of its tiles inside, and the way out through it. */
export interface Entrance {
  side: Side;
  /** The first tile inside it; the second is the next along the wall, east of it or south of it. */
  x: number;
  y: number;
}

export interface PlotDef {
  id: string;
  name: string;
  /** What it is, in a few words. */
  blurb: string;
  /**
   * The tiles it covers. Each plot shares a wall with the building, or with the plot it comes after, unless it stands
   * apart as a building of its own, with an entrance.
   */
  rects: readonly Rect[];
  price: number;
  /** The star that puts it up for sale: 0 for from the start. */
  star: number;
  /** A plot that has to be bought first, the one it adjoins. */
  after?: string;
  /** The door of a plot that stands apart, as a building of its own. */
  entrance?: Entrance;
  /** The paving laid from its door to the pavement, or to other paving, once it is built. */
  path?: readonly Rect[];
}

/** Where a center's building stands on its lot: the inside of its walls, inclusive, and the two tiles of its front door. */
export interface Plot extends Rect {
  /** The front door's two tiles, along the front wall (row y1). */
  door: readonly [number, number];
}

/** The original lot: a big building across the middle. */
export const SANDBOX_PLOT: Plot = { x0: 3, x1: 27, y0: 3, y1: 17, door: [14, 15] };

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
