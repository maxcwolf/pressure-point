// The lot every center stands on: the size of the grid, the street along its front, and where a building can stand.

export const W = 32;
export const H = 24;

/** The pavement and the road along the front of every lot. */
export const SIDEWALK_Y = 20;
export const ROAD_Y: readonly [number, number] = [21, 22];

/** Where a center's building stands on its lot: the inside of its walls, inclusive, and the two tiles of its front door. */
export interface Plot {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** The front door's two tiles, along the front wall (row y1). */
  door: readonly [number, number];
}

/** The original lot: a big building across the middle. */
export const SANDBOX_PLOT: Plot = { x0: 3, x1: 27, y0: 3, y1: 17, door: [14, 15] };

/** The row just outside the front door, where the path to the pavement starts. */
export const outsideDoor = (p: Plot) => p.y1 + 1;

/** Whether a building fits its lot: inside the grid, clear of the pavement, with its door on its front wall. */
export function plotFits(p: Plot): boolean {
  const [d0, d1] = p.door;
  return (
    p.x0 >= 1 &&
    p.x1 <= W - 2 &&
    p.y0 >= 1 &&
    p.x0 < p.x1 &&
    p.y0 < p.y1 &&
    outsideDoor(p) < SIDEWALK_Y &&
    d1 === d0 + 1 &&
    d0 > p.x0 &&
    d1 < p.x1
  );
}
