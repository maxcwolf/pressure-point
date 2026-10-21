// Dragging a room's walls: which wall the cursor takes hold of, and the shape it drags the room to.
import { describe, expect, it } from 'vitest';

import { RESIZE_HINT, resizeHint } from '../../src/app/tools/hints';
import { dragEdge, edgeNear, edgeTiles } from '../../src/app/tools/resize';

const ROOM = { x: 10, y: 10, w: 4, h: 3 };

describe('taking hold of a wall', () => {
  it('picks the wall the cursor is on or near, along its length', () => {
    expect(edgeNear(ROOM, { x: 11.5, y: 10.2 })).toBe('north');
    expect(edgeNear(ROOM, { x: 12, y: 13.4 })).toBe('south');
    expect(edgeNear(ROOM, { x: 9.6, y: 11.5 })).toBe('west');
    expect(edgeNear(ROOM, { x: 14.1, y: 12 })).toBe('east');
  });

  it('picks nothing in the middle of the floor or out beyond the ends of the walls', () => {
    expect(edgeNear(ROOM, { x: 12, y: 11.5 })).toBeNull();
    expect(edgeNear(ROOM, { x: 18, y: 10 })).toBeNull();
    expect(edgeNear(ROOM, { x: 12, y: 16 })).toBeNull();
  });
});

describe('dragging a wall', () => {
  it('moves only that wall, to the nearest grid line', () => {
    expect(dragEdge(ROOM, 'east', { x: 15.6, y: 0 })).toEqual({ x: 10, y: 10, w: 6, h: 3 });
    expect(dragEdge(ROOM, 'north', { x: 0, y: 8.4 })).toEqual({ x: 10, y: 8, w: 4, h: 5 });
    expect(dragEdge(ROOM, 'west', { x: 11.2, y: 0 })).toEqual({ x: 11, y: 10, w: 3, h: 3 });
    expect(dragEdge(ROOM, 'south', { x: 0, y: 11.9 })).toEqual({ x: 10, y: 10, w: 4, h: 2 });
  });

  it('gives back just the rectangle when handed a whole room', () => {
    const room = { ...ROOM, id: 3, door: { x: 11, y: 12, dx: 0, dy: 1 } };
    expect(dragEdge(room, 'east', { x: 15, y: 0 })).toEqual({ x: 10, y: 10, w: 5, h: 3 });
  });

  it('never closes a room up to nothing, however far the wall is pushed', () => {
    expect(dragEdge(ROOM, 'east', { x: 2, y: 0 })).toEqual({ x: 10, y: 10, w: 1, h: 3 });
    expect(dragEdge(ROOM, 'north', { x: 0, y: 40 })).toEqual({ x: 10, y: 12, w: 4, h: 1 });
  });

  it('marks the tiles along the wall in hand', () => {
    expect(edgeTiles(ROOM, 'west')).toEqual([
      [10, 10],
      [10, 11],
      [10, 12],
    ]);
    expect(edgeTiles(ROOM, 'south')).toHaveLength(4);
  });

  it('says what the new size costs or gives back', () => {
    expect(RESIZE_HINT).toMatch(/Drag a wall/);
    expect(resizeHint(ROOM, { ...ROOM, w: 5 }, 600)).toBe('4×3 → 5×3 · costs $600 · release to resize');
    expect(resizeHint(ROOM, { ...ROOM, w: 3 }, -300)).toBe('4×3 → 3×3 · gives back $300 · release to resize');
  });
});
