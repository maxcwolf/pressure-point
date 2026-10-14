// Resizing a built room: its walls move, its door and windows go with them, and the change is paid for.
import { describe, expect, it } from 'vitest';

import { ROOM_TILE_COST, WINDOW_COST } from '../../src/core/data';
import { carryWallSpot, resizeCost, tilesChanged } from '../../src/core/resize';
import { addMassage, addStaffRoom, buildRoom, freshSim, inconsistencies, run } from './helpers';

/** A game with plenty of money and a Massage Suite at 11,5 (4×4, door in the south wall at 12). */
function withSuite() {
  const sim = freshSim();
  sim.s.money = 100_000;
  const suite = addMassage(sim);
  return { sim, suite };
}

describe('moving a wall', () => {
  it('carries a door or window along with its wall, or drops it if the wall no longer reaches', () => {
    const south = { x: 12, y: 8, dx: 0, dy: 1 };
    expect(carryWallSpot(south, { x: 11, y: 5, w: 4, h: 6 })).toEqual({ x: 12, y: 10, dx: 0, dy: 1 });
    expect(carryWallSpot(south, { x: 13, y: 5, w: 3, h: 4 })).toBeNull();
    const west = { x: 11, y: 6, dx: -1, dy: 0 };
    expect(carryWallSpot(west, { x: 9, y: 5, w: 6, h: 4 })).toEqual({ x: 9, y: 6, dx: -1, dy: 0 });
    expect(carryWallSpot(west, { x: 9, y: 7, w: 6, h: 3 })).toBeNull();
  });

  it('charges for tiles added and gives half back for tiles taken away', () => {
    const room = { x: 11, y: 5, w: 4, h: 4 };
    expect(tilesChanged(room, { x: 11, y: 5, w: 4, h: 5 })).toEqual({ added: 4, removed: 0 });
    expect(resizeCost(room, { x: 11, y: 5, w: 4, h: 5 })).toBe(4 * ROOM_TILE_COST);
    expect(resizeCost(room, { x: 11, y: 5, w: 4, h: 3 })).toBe(-4 * (ROOM_TILE_COST / 2));
    // a wall out on one side and in on another
    expect(tilesChanged(room, { x: 11, y: 6, w: 4, h: 4 })).toEqual({ added: 4, removed: 4 });
  });
});

describe('resizing a room', () => {
  it('moves its walls and door, and charges for the floor it gains', () => {
    const { sim, suite } = withSuite();
    const money = sim.s.money;
    expect(sim.resizeRoom(suite.id, { x: 11, y: 5, w: 4, h: 6 })).toBe(true);
    expect(suite).toMatchObject({ x: 11, y: 5, w: 4, h: 6, door: { x: 12, y: 10, dx: 0, dy: 1 } });
    expect(sim.s.money).toBe(money - 8 * ROOM_TILE_COST);
    expect(sim.world.zoneAt(13, 10)).toBe(suite.id);
    // and back again, for half
    expect(sim.resizeRoom(suite.id, { x: 11, y: 5, w: 4, h: 4 })).toBe(true);
    expect(sim.s.money).toBe(money - 4 * ROOM_TILE_COST);
    expect(sim.world.zoneAt(13, 10)).toBe(0);
  });

  it('keeps working: guests are still treated in a suite that has grown', () => {
    const { sim, suite } = withSuite();
    sim.placeItem('reception_desk', 14, 13, 0);
    expect(sim.resizeRoom(suite.id, { x: 10, y: 4, w: 6, h: 5 })).toBe(true);
    expect(inconsistencies(sim)).toEqual([]);
    expect(sim.world.connected()).toBe(true);
    run(sim, 30);
    expect(inconsistencies(sim)).toEqual([]);
  });

  it('will not leave its furniture, or the spots it is used from, outside', () => {
    const { sim, suite } = withSuite();
    // the oil cart stands against the east wall
    expect(sim.world.resizeValid(suite, { x: 11, y: 5, w: 3, h: 4 }).reason).toMatch(/furniture has to stay inside/);
    expect(sim.resizeRoom(suite.id, { x: 11, y: 5, w: 3, h: 4 })).toBe(false);
    expect(suite).toMatchObject({ x: 11, y: 5, w: 4, h: 4 });
  });

  it('keeps its minimum size, inside the building, off other rooms', () => {
    const { sim, suite } = withSuite();
    addStaffRoom(sim);
    expect(sim.world.resizeValid(suite, { x: 11, y: 6, w: 4, h: 2 }).reason).toMatch(/Too small/);
    expect(sim.world.resizeValid(suite, { x: 11, y: 2, w: 4, h: 7 }).reason).toMatch(/inside the building/);
    expect(sim.world.resizeValid(suite, { x: 11, y: 5, w: 7, h: 4 }).reason).toMatch(/Overlaps another room/);
    expect(sim.world.resizeValid(suite, suite).reason).toMatch(/Drag a wall/);
  });

  it('will not cut off its door, or swallow something standing in the corridor', () => {
    const sim = freshSim();
    sim.s.money = 100_000;
    // a long staff room with its door at the east end of the south wall
    const room = buildRoom(sim, 'staffroom', { x: 17, y: 5, w: 5, h: 3 }, { x: 21, y: 7, dx: 0, dy: 1 }, [
      ['sofa', 17, 5],
    ]);
    expect(sim.world.resizeValid(room, { x: 17, y: 5, w: 4, h: 3 }).reason).toMatch(/cut off the door/);
    sim.placeItem('plant', 18, 9, 0);
    expect(sim.world.resizeValid(room, { x: 17, y: 5, w: 5, h: 5 }).reason).toMatch(/in the way/);
  });

  it('takes its windows along, refunding half for any whose wall is gone', () => {
    const sim = freshSim();
    sim.s.money = 100_000;
    const room = buildRoom(sim, 'staffroom', { x: 17, y: 5, w: 5, h: 3 }, { x: 18, y: 7, dx: 0, dy: 1 }, [
      ['sofa', 17, 5],
    ]);
    expect(sim.toggleWindow(room.id, { x: 19, y: 5, dx: 0, dy: -1 })).toBe('added');
    expect(sim.toggleWindow(room.id, { x: 21, y: 5, dx: 0, dy: -1 })).toBe('added');
    expect(sim.toggleWindow(room.id, { x: 21, y: 6, dx: 1, dy: 0 })).toBe('added');
    const money = sim.s.money;
    // the east wall comes in a tile: the north window at 21 has no wall left, the east one moves with its wall
    expect(sim.resizeRoom(room.id, { x: 17, y: 5, w: 4, h: 3 })).toBe(true);
    expect(room.windows).toEqual([
      { x: 19, y: 5, dx: 0, dy: -1 },
      { x: 20, y: 6, dx: 1, dy: 0 },
    ]);
    expect(sim.s.money).toBe(money + 3 * (ROOM_TILE_COST / 2) + WINDOW_COST / 2);
  });

  it('is refused when the new floor cannot be paid for', () => {
    const { sim, suite } = withSuite();
    sim.s.money = 100;
    expect(sim.resizeRoom(suite.id, { x: 11, y: 5, w: 4, h: 6 })).toBe(false);
    expect(suite.h).toBe(4);
    expect(sim.s.money).toBe(100);
  });
});
