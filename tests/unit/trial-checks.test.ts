// The build checks ask "what if?" of the grid while the player hovers. Whatever happens partway through, the game
// they are asked about must come out of them exactly as it went in.
import { describe, expect, it, vi } from 'vitest';

import { placeLayout } from '../../src/core/room-layout';
import { openCenter } from './helpers';

/** Floor in the standard test center that nothing is built on. */
const FREE = { x: 17, y: 5 };

/** A center, and a way to see whether its rooms, furniture and grid are still as they were. */
function center() {
  const { sim, s, massage } = openCenter(1);
  const { world } = sim;
  const rooms = s.rooms;
  const items = s.items;
  const saved = JSON.stringify({ rooms, items });
  const grid = { zone: world.zone.slice(), blocked: world.blocked.slice(), reserved: world.reserved.slice() };
  const doors = [...world.doors].sort();
  /** Check the rooms, the furniture and the grid are just as they were. */
  const unchanged = () => {
    expect(s.rooms).toBe(rooms);
    expect(s.items).toBe(items);
    expect(JSON.stringify({ rooms: s.rooms, items: s.items })).toBe(saved);
    expect(world.zone).toEqual(grid.zone);
    expect(world.blocked).toEqual(grid.blocked);
    expect(world.reserved).toEqual(grid.reserved);
    expect([...world.doors].sort()).toEqual(doors);
  };
  return { sim, world, massage, unchanged };
}

describe('a build check that fails partway through', () => {
  /** Have the check that nobody is cut off throw, as a bug in it would. */
  const breakIt = (world: { connected: () => boolean }) =>
    vi.spyOn(world, 'connected').mockImplementation(() => {
      throw new Error('broken');
    });

  it('leaves the furniture as it was when placing an item', () => {
    const { world, unchanged } = center();
    breakIt(world);
    expect(() => world.canPlaceItem('bench', 16, 9, 0)).toThrow('broken');
    unchanged();
  });

  it('leaves the rooms as they were when choosing a door', () => {
    const { world, unchanged } = center();
    breakIt(world);
    expect(() =>
      world.doorValid('staffroom', { x: FREE.x, y: FREE.y, w: 3, h: 3 }, { x: 18, y: 7, dx: 0, dy: 1 }),
    ).toThrow('broken');
    unchanged();
  });

  it('leaves the room its own shape when resizing it', () => {
    const { world, massage, unchanged } = center();
    breakIt(world);
    expect(() => world.resizeValid(massage, { x: massage.x, y: massage.y, w: massage.w + 1, h: massage.h })).toThrow(
      'broken',
    );
    unchanged();
  });

  it('leaves the rooms and furniture where they were when moving a room', () => {
    const { sim, world, massage, unchanged } = center();
    breakIt(world);
    const placed = placeLayout(sim.roomLayout(massage), FREE.x, FREE.y);
    expect(() => world.layoutValid('massage', placed, massage)).toThrow('broken');
    unchanged();
  });
});
