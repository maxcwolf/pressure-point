import { describe, expect, it } from 'vitest';

import { SANDBOX_PLOT } from '../../src/core/data';
import type { Room, WallSpot } from '../../src/core/state/types';
import { outerPanes } from '../../src/render/outer-walls';
import { roomShape, type WallBox, WINDOW_PANE, WINDOW_SILL } from '../../src/render/room-walls';
import { H_LOW, H_TALL, OUTER_LOW_TOP, OUTER_PANE_H, OUTER_PANE_Y0 } from '../../src/render/shared';

/** A 4×4 room at 10,10 with its door in the south wall, and whatever windows are asked for. */
function room(windows: WallSpot[] = [], door: WallSpot = { x: 11, y: 13, dx: 0, dy: 1 }): Room {
  return { id: 1, type: 'staffroom', x: 10, y: 10, w: 4, h: 4, door, windows, done: true, priority: false, vibes: 0, claimedBy: 0 };
}

/** The glass in a room's walls. */
const panes = (r: Room) => roomShape(r, SANDBOX_PLOT).boxes.filter((b) => b.material === 'glass');
/** The top of a box. */
const top = (b: WallBox) => b.y0 + b.h;

const NORTH: WallSpot = { x: 11, y: 10, dx: 0, dy: -1 };
const WEST: WallSpot = { x: 10, y: 11, dx: -1, dy: 0 };
const SOUTH: WallSpot = { x: 12, y: 13, dx: 0, dy: 1 };
const EAST: WallSpot = { x: 13, y: 11, dx: 1, dy: 0 };

describe("a room's walls", () => {
  it('are tall at the back and low at the front, so you can see in', () => {
    const walls = roomShape(room(), SANDBOX_PLOT).boxes.filter((b) => b.material === 'wall');
    const north = walls.filter((b) => b.horizontal && b.fixed < 11);
    const south = walls.filter((b) => b.horizontal && b.fixed > 13);
    expect(north.map((b) => b.h)).toEqual([H_TALL]);
    expect(new Set(south.map((b) => b.h))).toEqual(new Set([H_LOW]));
  });

  it('leave a gap for the door, framed on both sides', () => {
    const { boxes, doorway } = roomShape(room(), SANDBOX_PLOT);
    expect(doorway).toMatchObject({ horizontal: true, at: 11, tall: false, inward: -1 });
    const south = boxes.filter((b) => b.horizontal && b.fixed > 13 && b.material === 'wall');
    expect(south.map((b) => [b.a, b.b])).toEqual([
      [10, 11],
      [12, 14],
    ]);
    const posts = boxes.filter((b) => b.material === 'trim' && b.b - b.a < 0.2 && b.fixed > 13);
    expect(posts.map((b) => b.a)).toEqual([11, 11.9]);
  });

  it('have no glass without windows, and one pane per window', () => {
    expect(panes(room())).toHaveLength(0);
    expect(panes(room([NORTH, WEST, SOUTH, EAST]))).toHaveLength(4);
  });

  it('put a window in the tile it was asked for, on the right wall', () => {
    const [north] = panes(room([NORTH]));
    expect(north).toMatchObject({ horizontal: true, a: 11.06, b: 11.94 });
    const [east] = panes(room([EAST]));
    expect(east).toMatchObject({ horizontal: false, a: 11.06, b: 11.94 });
    expect(east!.fixed).toBeGreaterThan(13);
  });

  it('set a window in a far wall between a sill and a header', () => {
    const [pane] = panes(room([NORTH]));
    expect([pane!.y0, pane!.h]).toEqual([WINDOW_SILL, WINDOW_PANE]);
    expect(top(pane!)).toBeLessThan(H_TALL);
  });
});

describe('a window in a near wall', () => {
  // The near walls are cut low so you can see into the room. A window there used to be a short pane
  // standing on the low wall. At the edge of the building the outer wall hid all but the top of it.
  it('stands at the same height as one in a far wall', () => {
    const [far] = panes(room([NORTH]));
    for (const spot of [SOUTH, EAST]) {
      const [near] = panes(room([spot]));
      expect([near!.y0, near!.h]).toEqual([far!.y0, far!.h]);
    }
  });

  it("is clear of the building's low outer wall, so the whole pane shows from outside", () => {
    for (const spot of [SOUTH, EAST]) {
      const [pane] = panes(room([spot]));
      expect(pane!.y0).toBeGreaterThanOrEqual(OUTER_LOW_TOP);
    }
  });

  it('has a sill under the pane and a frame around it', () => {
    const shape = roomShape(room([SOUTH]), SANDBOX_PLOT);
    const [pane] = shape.boxes.filter((b) => b.material === 'glass');
    const sill = shape.boxes.find((b) => b.material === 'wall' && b.a === 12 && b.b === 13 && b.fixed > 13);
    expect(top(sill!)).toBeCloseTo(pane!.y0);
    const frame = shape.boxes.filter((b) => b.material === 'trim' && b.a >= 12 && b.b <= 13 && b.fixed > 13);
    // two posts, a rail under the pane and one over it
    expect(frame.filter((b) => b.b - b.a < 0.1)).toHaveLength(2);
    expect(frame.some((b) => b.y0 >= top(pane!) - 0.001)).toBe(true);
    expect(frame.some((b) => top(b) <= pane!.y0 + 0.04 && b.b - b.a === 1)).toBe(true);
  });
});

describe('a room against the building', () => {
  // The sandbox building runs from 3,3 to 27,17. A room in its back corner, and one against its front wall.
  const corner: Room = {
    id: 2,
    type: 'staffroom',
    x: 3,
    y: 3,
    w: 4,
    h: 4,
    door: { x: 6, y: 5, dx: 1, dy: 0 },
    windows: [
      { x: 4, y: 3, dx: 0, dy: -1 },
      { x: 3, y: 4, dx: -1, dy: 0 },
      { x: 5, y: 6, dx: 0, dy: 1 },
    ],
    done: true,
    priority: false,
    vibes: 0,
    claimedBy: 0,
  };
  const front: Room = {
    id: 3,
    type: 'staffroom',
    x: 10,
    y: 14,
    w: 4,
    h: 4,
    door: { x: 11, y: 14, dx: 0, dy: -1 },
    windows: [{ x: 12, y: 17, dx: 0, dy: 1 }],
    done: true,
    priority: false,
    vibes: 0,
    claimedBy: 0,
  };
  /** The boxes of a room's walls on one side: north, south, west or east. */
  const side = (r: Room, which: 'north' | 'south' | 'west' | 'east') => {
    const horizontal = which === 'north' || which === 'south';
    const { boxes } = roomShape(r, SANDBOX_PLOT);
    const mid = horizontal ? r.y + r.h / 2 : r.x + r.w / 2;
    return boxes.filter(
      (b) => b.horizontal === horizontal && (which === 'north' || which === 'west' ? b.fixed < mid : b.fixed > mid),
    );
  };

  it("has no wall of its own along the building's walls, which stand in for it", () => {
    for (const which of ['north', 'west'] as const)
      expect(side(corner, which).filter((b) => b.material === 'wall')).toEqual([]);
    expect(side(corner, 'south').some((b) => b.material === 'wall' && b.h === H_LOW)).toBe(true);
    expect(side(front, 'south').filter((b) => b.material === 'wall' && b.b - b.a !== 1)).toEqual([]);
  });

  it("sets its windows there into the building's wall, at the building's own window height", () => {
    const [north] = side(corner, 'north').filter((b) => b.material === 'glass');
    expect(north).toMatchObject({ a: 4.06, y0: OUTER_PANE_Y0, h: OUTER_PANE_H });
    expect(north!.b).toBeCloseTo(4.94);
    // on the inside face of the building's wall, not in a second wall in front of it
    expect(north!.fixed).toBeCloseTo(SANDBOX_PLOT.y0 + 0.02);
    const [west] = side(corner, 'west').filter((b) => b.material === 'glass');
    expect(west!.fixed).toBeCloseTo(SANDBOX_PLOT.x0 + 0.02);
    // at the front, in line with the building's low wall
    const [south] = side(front, 'south').filter((b) => b.material === 'glass');
    expect(south!.fixed).toBeGreaterThan(SANDBOX_PLOT.y1 + 1);
    expect(south!.y0).toBe(WINDOW_SILL);
  });

  it("leaves the building's own windows out where it runs along the back walls", () => {
    const all = outerPanes(SANDBOX_PLOT, []);
    expect(all.filter((p) => p.horizontal).map((p) => p.a)).toEqual([
      4.75, 7.75, 10.75, 13.75, 16.75, 19.75, 22.75, 25.75,
    ]);
    expect(all.filter((p) => !p.horizontal).map((p) => p.a)).toEqual([4.75, 7.75, 10.75, 13.75]);
    const around = outerPanes(SANDBOX_PLOT, [corner, front]);
    // the corner room covers 3 to 7 along both back walls, so the panes from 4.75 to 6.25 go
    expect(around.filter((p) => p.horizontal).map((p) => p.a)).toEqual([
      7.75, 10.75, 13.75, 16.75, 19.75, 22.75, 25.75,
    ]);
    expect(around.filter((p) => !p.horizontal).map((p) => p.a)).toEqual([7.75, 10.75, 13.75]);
    // a room inside the building, away from the walls, moves nothing
    expect(outerPanes(SANDBOX_PLOT, [room()])).toEqual(all);
  });
});
