// The windows in the building's tall outer walls, the ones across the building from the camera, which make way for
// any room built against them. Nothing here draws anything, so it can be tested without a renderer.

import type { Plot } from '../core/data';
import type { Room } from '../core/state/types';
import { alongOuterWall } from './room-walls';
import { nearSides, type Side, type Sides } from './turn';

/** One of the building's windows: which outer wall it is in, and where it starts and ends along it. */
export interface OuterPane {
  side: Side;
  /** True for the north and south walls, which run along x. */
  horizontal: boolean;
  a: number;
  b: number;
}

/** How wide each of the building's windows is, and how far apart they start. */
const PANE_W = 1.5;
const PANE_EVERY = 3;

/** The walls in the order their windows are laid out. */
const SIDES: readonly Side[] = ['north', 'west', 'south', 'east'];

/**
 * The building's windows in its tall outer walls, the ones not facing the camera, leaving out any where a room runs
 * along the wall instead, and the entrance in the front wall.
 */
export function outerPanes(plot: Plot, rooms: readonly Room[], near: Sides = nearSides(0)): OuterPane[] {
  const panes: OuterPane[] = [];
  /** Whether a stretch of a wall has a room against it. */
  const covered = (side: Side, a: number, b: number) =>
    rooms.some((r) => {
      if (!alongOuterWall(r, plot)[side]) return false;
      return side === 'north' || side === 'south' ? r.x < b && r.x + r.w > a : r.y < b && r.y + r.h > a;
    });
  /** Whether a stretch of the front wall runs into the entrance. */
  const entrance = (side: Side, a: number, b: number) => side === 'south' && a < plot.door[1] + 1 && b > plot.door[0];
  for (const side of SIDES) {
    if (near[side]) continue;
    const horizontal = side === 'north' || side === 'south';
    const start = horizontal ? plot.x0 : plot.y0;
    const end = (horizontal ? plot.x1 : plot.y1) + 1;
    for (let t = start + 2; t < end - 1; t += PANE_EVERY) {
      const a = t - 0.25;
      const b = a + PANE_W;
      if (!covered(side, a, b) && !entrance(side, a, b)) panes.push({ side, horizontal, a, b });
    }
  }
  return panes;
}
