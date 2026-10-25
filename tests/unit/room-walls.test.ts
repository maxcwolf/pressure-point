import { describe, expect, it } from 'vitest';

import { SANDBOX_PLOT } from '../../src/core/data';
import { buildingWindows, footprintOf } from '../../src/core/footprint';
import { windowsInto } from '../../src/core/resize';
import type { Room, WallSpot } from '../../src/core/state/types';
import { roomShape, type WallBox, WINDOW_PANE, WINDOW_SILL } from '../../src/render/room-walls';
import { H_LOW, H_TALL, OUTER_PANE_H, OUTER_PANE_Y0, OUTER_T } from '../../src/render/shared';

/** The sandbox's building, as it starts. */
const BUILDING = footprintOf(SANDBOX_PLOT);

/** A 4×4 room at 10,10 with its door in the south wall, and whatever windows are asked for. */
function room(windows: WallSpot[] = [], door: WallSpot = { x: 11, y: 13, dx: 0, dy: 1 }): Room {
  return {
    id: 1,
    type: 'staffroom',
    x: 10,
    y: 10,
    w: 4,
    h: 4,
    door,
    windows,
    done: true,
    priority: false,
    vibes: 0,
    claimedBy: 0,
  };
}

/** The glass in a room's walls. */
const panes = (r: Room) => roomShape(r, BUILDING).boxes.filter((b) => b.material === 'glass');
/** The top of a box. */
const top = (b: WallBox) => b.y0 + b.h;

const NORTH: WallSpot = { x: 11, y: 10, dx: 0, dy: -1 };
const WEST: WallSpot = { x: 10, y: 11, dx: -1, dy: 0 };
const SOUTH: WallSpot = { x: 12, y: 13, dx: 0, dy: 1 };
const EAST: WallSpot = { x: 13, y: 11, dx: 1, dy: 0 };

describe("a room's walls", () => {
  it('are tall at the back and low at the front, so you can see in', () => {
    const walls = roomShape(room(), BUILDING).boxes.filter((b) => b.material === 'wall');
    const north = walls.filter((b) => b.horizontal && b.fixed < 11);
    const south = walls.filter((b) => b.horizontal && b.fixed > 13);
    expect(north.map((b) => b.h)).toEqual([H_TALL]);
    expect(new Set(south.map((b) => b.h))).toEqual(new Set([H_LOW]));
  });

  it('leave a gap for the door, framed on both sides', () => {
    const { boxes, doorway } = roomShape(room(), BUILDING);
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
  // The near walls are cut low so you can see into the room. A window there used to stand up out of the low wall, a
  // tile high, like a fence; then it was cut with its wall, but drawn whole as a see-through ghost of itself, which
  // still stood in front of the people in the room. Now it is cut with its wall: its glass along the top of the stub.
  it('is cut with its wall, its glass along the top of the stub', () => {
    for (const spot of [SOUTH, EAST]) {
      const shape = roomShape(room([spot]), BUILDING);
      const [pane] = shape.boxes.filter((b) => b.material === 'glass');
      expect(pane).toMatchObject({ y0: H_LOW });
      expect(shape.boxes.some((b) => b.ghost)).toBe(false);
      // nothing stands up out of the low wall
      const near = shape.boxes.filter((b) => b.a >= 11.9 && b.b <= 13.1 && b.fixed > 13);
      expect(Math.max(...near.map(top))).toBeLessThan(H_LOW + 0.12);
    }
  });

  it('has the low wall run on, solid, under it', () => {
    const shape = roomShape(room([SOUTH]), BUILDING);
    const under = shape.boxes.find((b) => b.material === 'wall' && b.a === 12 && b.b === 13 && b.fixed > 13);
    expect(under).toMatchObject({ y0: 0, h: H_LOW });
    const frame = shape.boxes.filter((b) => b.material === 'trim' && b.y0 === H_LOW && b.a >= 11.9 && b.b <= 13.1);
    expect(frame.length).toBeGreaterThan(0);
  });
});

describe('windows side by side', () => {
  it('are one wide window, with a bar where they meet', () => {
    const two = roomShape(room([NORTH, { ...NORTH, x: 12 }]), BUILDING).boxes;
    const glass = two.filter((b) => b.material === 'glass');
    expect(glass).toHaveLength(1);
    expect(glass[0]).toMatchObject({ a: 11.06, b: 12.94 });
    expect(two.some((b) => b.material === 'trim' && b.a < 12 && b.b > 12 && b.b - b.a < 0.05)).toBe(true);
  });
});

describe('a window next door that looks onto a room', () => {
  /** A room just west of the test room, its east wall against the test room's west wall. */
  const beside = (windows: WallSpot[]): Room => ({
    ...room(windows),
    id: 2,
    x: 6,
    door: { x: 7, y: 13, dx: 0, dy: 1 },
  });

  it("is a window in the room's own wall too, so it shows through both", () => {
    const through = windowsInto(room(), [room(), beside([{ x: 9, y: 11, dx: 1, dy: 0 }])]);
    expect(through).toEqual([WEST]);
    expect(roomShape(room(), BUILDING, undefined, [], through)).toEqual(roomShape(room([WEST]), BUILDING));
  });

  it("is one window with the room's own there too", () => {
    expect(roomShape(room([WEST]), BUILDING, undefined, [], [WEST])).toEqual(roomShape(room([WEST]), BUILDING));
  });

  it('only counts where it looks onto the room', () => {
    // the room beside's north wall looks onto corridor, and its west wall onto the outside
    const away = beside([
      { x: 7, y: 10, dx: 0, dy: -1 },
      { x: 6, y: 11, dx: -1, dy: 0 },
    ]);
    expect(windowsInto(room(), [room(), away])).toEqual([]);
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
    const { boxes } = roomShape(r, BUILDING);
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

  it("hangs its windows there in the building's wall, just like the building's own", () => {
    const north = side(corner, 'north');
    const [pane] = north.filter((b) => b.material === 'pane');
    expect(pane).toMatchObject({ a: 4.06, y0: OUTER_PANE_Y0, h: OUTER_PANE_H });
    expect(pane!.b).toBeCloseTo(4.94);
    // on the inside face of the building's wall, not in a second wall in front of it
    expect(pane!.fixed).toBeCloseTo(SANDBOX_PLOT.y0 + 0.015);
    // a white frame, as the building's windows have, and the room's own trim on the ledge
    expect(north.some((b) => b.material === 'frame')).toBe(true);
    expect(north.some((b) => b.material === 'trim' && b.b - b.a > 1)).toBe(true);
    const [west] = side(corner, 'west').filter((b) => b.material === 'pane');
    expect(west!.fixed).toBeCloseTo(SANDBOX_PLOT.x0 + 0.015);
    // at the front, where the building's wall is cut low, as a strip of glass along the top of the wall's teal cap
    const [south] = side(front, 'south').filter((b) => b.material === 'pane');
    expect(south!.fixed).toBeCloseTo(SANDBOX_PLOT.y1 + 1 + OUTER_T / 2);
    expect(south).toMatchObject({ y0: H_LOW + 0.12 });
    expect(south!.ghost).toBeFalsy();
  });

  it("leaves the building's own windows out where it runs along the outer walls", () => {
    const all = buildingWindows(BUILDING, []);
    const around = buildingWindows(BUILDING, [corner, front]);
    // the corner room covers 3 to 7 along both back walls; the front room's stretch was already kept clear for the
    // entrance beside it
    const gone = all.filter((w) => !around.some((v) => v.side === w.side && v.a === w.a));
    expect(gone.map((w) => `${w.side} ${w.a}`).sort()).toEqual(['north 4', 'west 5']);
    // a room inside the building, away from the walls, moves nothing
    expect(buildingWindows(BUILDING, [room()])).toEqual(all);
  });
});
