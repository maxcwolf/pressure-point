import { describe, expect, it } from 'vitest';

import type { Room, WallSpot } from '../../src/core/state/types';
import { roomShape, type WallBox, WINDOW_PANE, WINDOW_SILL } from '../../src/render/room-walls';
import { H_LOW, H_TALL, OUTER_LOW_TOP } from '../../src/render/shared';

/** A 4×4 room at 10,10 with its door in the south wall, and whatever windows are asked for. */
function room(windows: WallSpot[] = [], door: WallSpot = { x: 11, y: 13, dx: 0, dy: 1 }): Room {
  return { id: 1, type: 'staffroom', x: 10, y: 10, w: 4, h: 4, door, windows, done: true };
}

/** The glass in a room's walls. */
const panes = (r: Room) => roomShape(r).boxes.filter((b) => b.material === 'glass');
/** The top of a box. */
const top = (b: WallBox) => b.y0 + b.h;

const NORTH: WallSpot = { x: 11, y: 10, dx: 0, dy: -1 };
const WEST: WallSpot = { x: 10, y: 11, dx: -1, dy: 0 };
const SOUTH: WallSpot = { x: 12, y: 13, dx: 0, dy: 1 };
const EAST: WallSpot = { x: 13, y: 11, dx: 1, dy: 0 };

describe("a room's walls", () => {
  it('are tall at the back and low at the front, so you can see in', () => {
    const walls = roomShape(room()).boxes.filter((b) => b.material === 'wall');
    const north = walls.filter((b) => b.horizontal && b.fixed < 11);
    const south = walls.filter((b) => b.horizontal && b.fixed > 13);
    expect(north.map((b) => b.h)).toEqual([H_TALL]);
    expect(new Set(south.map((b) => b.h))).toEqual(new Set([H_LOW]));
  });

  it('leave a gap for the door, framed on both sides', () => {
    const { boxes, doorway } = roomShape(room());
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
    const shape = roomShape(room([SOUTH]));
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
