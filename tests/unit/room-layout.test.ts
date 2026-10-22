// A room's layout: picked up, turned and put down, with everything in it turning together.
import { describe, expect, it } from 'vitest';

import { ITEMS, ROOM_TILE_COST, ROOMS, WINDOW_COST } from '../../src/core/data';
import { copyCost, cornerFor, type Layout, placeLayout, turnLayout } from '../../src/core/room-layout';
import { accessTile, footprint } from '../../src/core/world';

/** A 4×3 Massage Suite with its door on the bottom wall, a window on the left, and a table and trolley. */
const SUITE: Layout = {
  type: 'massage',
  w: 4,
  h: 3,
  door: { x: 1, y: 2, dx: 0, dy: 1 },
  windows: [{ x: 0, y: 1, dx: -1, dy: 0 }],
  items: [
    { type: 'massage_table', x: 1, y: 0, rot: 0 },
    { type: 'oil_trolley', x: 3, y: 0, rot: 0 },
  ],
};

/** Where a tile of a room `h` tiles tall ends up when the room is turned a quarter turn. */
const turnTile = ([x, y]: [number, number], h: number): [number, number] => [h - 1 - y, x];

/** A list of tiles in a fixed order, to compare as sets. */
const sorted = (tiles: [number, number][]) => [...tiles].sort((a, b) => a[0] - b[0] || a[1] - b[1]);

describe('turning a layout', () => {
  it('swaps its width and height, and carries the door and windows round with their walls', () => {
    const turned = turnLayout(SUITE);
    expect([turned.w, turned.h]).toEqual([3, 4]);
    // the bottom wall becomes the left wall, and the left wall the top
    expect(turned.door).toEqual({ x: 0, y: 1, dx: -1, dy: 0 });
    expect(turned.windows).toEqual([{ x: 1, y: 0, dx: 0, dy: -1 }]);
  });

  it('turns each piece of furniture with the room, the squares it is used from included', () => {
    const turned = turnLayout(SUITE);
    SUITE.items.forEach((it, i) => {
      const after = turned.items[i]!;
      expect(after.rot).toBe(1);
      expect(sorted(footprint(after))).toEqual(sorted(footprint(it).map((t) => turnTile(t, SUITE.h))));
      for (let a = 0; a < ITEMS[it.type].access.length; a++)
        expect(accessTile(after, a)).toEqual(turnTile(accessTile(it, a), SUITE.h));
    });
  });

  it('comes back to where it started after four turns', () => {
    expect(turnLayout(turnLayout(turnLayout(turnLayout(SUITE))))).toEqual(SUITE);
  });
});

describe('putting a layout down', () => {
  it('moves everything by where its corner goes', () => {
    const placed = placeLayout(SUITE, 10, 20);
    expect(placed.rect).toEqual({ x: 10, y: 20, w: 4, h: 3 });
    expect(placed.door).toEqual({ x: 11, y: 22, dx: 0, dy: 1 });
    expect(placed.windows).toEqual([{ x: 10, y: 21, dx: -1, dy: 0 }]);
    expect(placed.items[0]).toEqual({ type: 'massage_table', x: 11, y: 20, rot: 0 });
  });

  it('centers it on the cursor', () => {
    expect(cornerFor(SUITE, { x: 12.2, y: 8.9 })).toEqual([10, 7]);
  });
});

describe('what a copy costs', () => {
  it('is the room with its required furniture, then the extras and the windows', () => {
    // 4×3: three tiles of floor beyond the smallest 3×3, at what a resize charges
    const room = ROOMS.massage.cost + 3 * ROOM_TILE_COST;
    expect(copyCost(SUITE)).toBe(room + WINDOW_COST);
    const extra: Layout = { ...SUITE, items: [...SUITE.items, { type: 'plant', x: 0, y: 0, rot: 0 }] };
    expect(copyCost(extra)).toBe(room + WINDOW_COST + ITEMS.plant.cost);
    expect(copyCost({ ...SUITE, w: 3, h: 3 }), 'the smallest comes with the price').toBe(
      ROOMS.massage.cost + WINDOW_COST,
    );
  });
});
