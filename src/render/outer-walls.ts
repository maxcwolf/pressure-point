// The windows in the building's tall back walls, which make way for any room built against them.
// Nothing here draws anything, so it can be tested without a renderer.

import type { Plot } from '../core/data';
import type { Room } from '../core/state/types';
import { alongOuterWall } from './room-walls';

/** One of the building's windows: which back wall it is in, and where it starts and ends along it. */
export interface OuterPane {
  /** True for the north wall, which runs along x; false for the west wall. */
  horizontal: boolean;
  a: number;
  b: number;
}

/** How wide each of the building's windows is, and how far apart they start. */
const PANE_W = 1.5;
const PANE_EVERY = 3;

/** The building's windows in its back walls, leaving out any where a room runs along the wall instead. */
export function outerPanes(plot: Plot, rooms: readonly Room[]): OuterPane[] {
  const panes: OuterPane[] = [];
  /** Whether a stretch of a back wall has a room against it. */
  const covered = (horizontal: boolean, a: number, b: number) =>
    rooms.some((r) => {
      const along = alongOuterWall(r, plot);
      if (horizontal) return along.north && r.x < b && r.x + r.w > a;
      return along.west && r.y < b && r.y + r.h > a;
    });
  for (const horizontal of [true, false]) {
    const start = horizontal ? plot.x0 : plot.y0;
    const end = (horizontal ? plot.x1 : plot.y1) + 1;
    for (let t = start + 2; t < end - 1; t += PANE_EVERY) {
      const a = t - 0.25;
      const b = a + PANE_W;
      if (!covered(horizontal, a, b)) panes.push({ horizontal, a, b });
    }
  }
  return panes;
}
