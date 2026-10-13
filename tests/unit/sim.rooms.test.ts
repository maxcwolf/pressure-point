import { describe, expect, it } from 'vitest';
import { ROOMS, WINDOW_COST, WINDOW_MAX_BONUS } from '../../src/data';
import { upgradeSave, type GameState } from '../../src/state';
import { LAYOUT, addConsult, addMassage, freshSim, openCenter, run, runUntil } from './helpers';

// the standard massage suite covers x 11..14, y 5..8, with its door in the south wall at (12, 8)
const NORTH = { x: 13, y: 5, dx: 0, dy: -1 };
const EAST = { x: 14, y: 6, dx: 1, dy: 0 };
const WEST = { x: 11, y: 7, dx: -1, dy: 0 };

describe('windows', () => {
  it('can be added to a wall for a price and taken out again for half', () => {
    const { sim, s, massage } = openCenter(1);
    const before = s.money;
    expect(sim.toggleWindow(massage.id, NORTH)).toBe('added');
    expect(massage.windows).toEqual([NORTH]);
    expect(s.money).toBe(before - WINDOW_COST);
    expect(sim.toggleWindow(massage.id, NORTH)).toBe('removed');
    expect(massage.windows).toEqual([]);
    expect(s.money).toBe(before - WINDOW_COST / 2);
  });

  it('are refunded in full while the room is still a blueprint', () => {
    const sim = freshSim();
    const room = sim.createRoom('massage', LAYOUT.massage.rect, LAYOUT.massage.door);
    const before = sim.s.money;
    sim.toggleWindow(room.id, NORTH);
    sim.toggleWindow(room.id, NORTH);
    expect(sim.s.money).toBe(before);
    // tearing up the blueprint gives back any windows still in it
    sim.toggleWindow(room.id, EAST);
    sim.removeRoom(room.id, 1);
    expect(sim.s.money).toBe(before);
  });

  it('only go in the room\'s own outer walls, and never where the door is', () => {
    const { sim, massage } = openCenter(1);
    const { world } = sim;
    expect(world.windowValid(massage, NORTH).ok).toBe(true);
    expect(world.windowValid(massage, massage.door).reason).toMatch(/door/);
    // pointing along the wall rather than out through it
    expect(world.windowValid(massage, { x: 13, y: 5, dx: 1, dy: 0 }).ok).toBe(false);
    // a tile that is not in the room at all
    expect(world.windowValid(massage, { x: 20, y: 12, dx: 0, dy: -1 }).ok).toBe(false);
    expect(sim.toggleWindow(massage.id, massage.door)).toBe('');
    expect(massage.windows).toEqual([]);
  });

  it('are not allowed onto the room next door, but are onto a corridor or the outside', () => {
    const sim = freshSim();
    sim.s.money = 100_000;
    const a = sim.createRoom('massage', { x: 3, y: 3, w: 3, h: 3 }, { x: 4, y: 5, dx: 0, dy: 1 });
    sim.createRoom('staffroom', { x: 6, y: 3, w: 3, h: 3 }, { x: 7, y: 5, dx: 0, dy: 1 });
    expect(sim.world.windowValid(a, { x: 5, y: 4, dx: 1, dy: 0 }).reason).toMatch(/Another room/);
    // the building's outer wall, and the corridor
    expect(sim.world.windowValid(a, { x: 3, y: 4, dx: -1, dy: 0 }).ok).toBe(true);
    expect(sim.world.windowValid(a, { x: 3, y: 5, dx: 0, dy: 1 }).ok).toBe(true);
  });

  it('cannot be bought without the money', () => {
    const { sim, s, massage } = openCenter(1);
    s.money = WINDOW_COST - 1;
    expect(sim.toggleWindow(massage.id, NORTH)).toBe('');
    expect(massage.windows).toEqual([]);
  });

  it('raise a room\'s prestige, up to a limit', () => {
    const { sim, massage } = openCenter(1);
    const plain = sim.prestige(massage);
    const spots = [NORTH, EAST, WEST, { x: 11, y: 5, dx: 0, dy: -1 }, { x: 14, y: 8, dx: 0, dy: 1 }, { x: 14, y: 5, dx: 1, dy: 0 }];
    const levels: number[] = [];
    for (const spot of spots) {
      expect(sim.toggleWindow(massage.id, spot)).toBe('added');
      levels.push(sim.prestige(massage));
    }
    expect(levels[WINDOW_MAX_BONUS - 1]).toBeGreaterThan(plain);
    // further windows are allowed but add nothing
    expect(levels.at(-1)).toBe(levels[WINDOW_MAX_BONUS - 1]);
    expect([...levels].sort((x, y) => x - y)).toEqual(levels);
  });

  it('come back at half price when the room is demolished', () => {
    const { sim, s, massage } = openCenter(1);
    sim.toggleWindow(massage.id, NORTH);
    sim.toggleWindow(massage.id, EAST);
    const before = s.money;
    sim.removeRoom(massage.id, 0.5);
    expect(s.money).toBe(before + ROOMS.massage.cost * 0.5 + WINDOW_COST);
  });

  it('are added, empty, to rooms from older saves', () => {
    const { s } = openCenter(1);
    const old = JSON.parse(JSON.stringify(s)) as Record<string, any>;
    for (const r of old.rooms) delete r.windows;
    upgradeSave(old as GameState);
    expect((old as GameState).rooms.every((r) => Array.isArray(r.windows) && r.windows.length === 0)).toBe(true);
  });
});

describe('moving a door', () => {
  it('moves it to another wall for free, and people use the new one', () => {
    const { sim, s, massage, therapist } = openCenter(1);
    runUntil(sim, () => therapist.state === 'atPost', 120);
    const money = s.money;
    const east = { x: 14, y: 7, dx: 1, dy: 0 };
    expect(sim.moveDoor(massage.id, east)).toBe(true);
    expect(massage.door).toEqual(east);
    expect(s.money).toBe(money);
    // the old doorway is wall again: the only way in is the new one
    const path = sim.world.findPath(12, 12, 12, 7)!;
    const inside = path.find(([x, y]) => sim.world.zoneAt(Math.floor(x), Math.floor(y)) === massage.id)!;
    expect([Math.floor(inside[0]), Math.floor(inside[1])]).toEqual([14, 7]);
    run(sim, 300);
    expect(s.stats.healed + s.stats.failed).toBeGreaterThan(0);
  });

  it('refuses a wall that does not open onto a corridor', () => {
    const sim = freshSim();
    const room = sim.createRoom('massage', { x: 3, y: 3, w: 3, h: 3 }, { x: 4, y: 5, dx: 0, dy: 1 });
    // the west and north walls of this room are the building's outer walls
    expect(sim.moveDoor(room.id, { x: 3, y: 4, dx: -1, dy: 0 })).toBe(false);
    expect(sim.moveDoor(room.id, { x: 4, y: 3, dx: 0, dy: -1 })).toBe(false);
    expect(room.door).toEqual({ x: 4, y: 5, dx: 0, dy: 1 });
    expect(sim.moveDoor(room.id, { x: 5, y: 4, dx: 1, dy: 0 })).toBe(true);
  });

  it('refuses a spot with a window, with furniture in the way, or where it already is', () => {
    const { sim, massage } = openCenter(1);
    expect(sim.moveDoor(massage.id, massage.door)).toBe(false);
    sim.toggleWindow(massage.id, EAST);
    expect(sim.world.doorValid('massage', massage, EAST, massage).reason).toMatch(/window/);
    expect(sim.moveDoor(massage.id, EAST)).toBe(false);
    // the oil cart stands at (14, 5), right inside this stretch of wall
    const byCart = { x: 14, y: 5, dx: 1, dy: 0 };
    expect(sim.world.doorValid('massage', massage, byCart, massage).reason).toMatch(/Furniture/);
    expect(sim.moveDoor(massage.id, byCart)).toBe(false);
  });

  it('refuses a move that would leave the furniture unreachable', () => {
    const { sim, massage } = openCenter(1);
    // wall the therapist's side of the table off from the far corner, then try to put the door in that corner
    sim.placeItem('plant', 13, 8, 0);
    sim.placeItem('plant', 14, 7, 0);
    const corner = { x: 14, y: 8, dx: 1, dy: 0 };
    expect(sim.world.doorValid('massage', massage, corner, massage).reason).toMatch(/block the way/);
    expect(sim.moveDoor(massage.id, corner)).toBe(false);
  });
});

describe('blueprints', () => {
  it('list the required furniture still missing, in order, including duplicates', () => {
    const sim = freshSim();
    const room = sim.createRoom('consult', LAYOUT.consult.rect, LAYOUT.consult.door);
    expect(sim.missingItems(room)).toEqual(['consult_desk', 'cabinet']);
    sim.placeItem('cabinet', 5, 8, 0, { free: true, roomId: room.id });
    expect(sim.missingItems(room)).toEqual(['consult_desk']);
    sim.placeItem('consult_desk', 6, 6, 0, { free: true, roomId: room.id });
    expect(sim.missingItems(room)).toEqual([]);
    // extras do not confuse it
    sim.placeItem('plant', 8, 5, 0);
    expect(sim.missingItems(room)).toEqual([]);
  });

  it('cost nothing until built, and give back paid extras when torn up', () => {
    const sim = freshSim();
    const before = sim.s.money;
    const room = sim.createRoom('consult', LAYOUT.consult.rect, LAYOUT.consult.door);
    sim.placeItem('consult_desk', 6, 6, 0, { free: true, roomId: room.id });
    expect(sim.s.money).toBe(before);
    sim.placeItem('plant', 8, 5, 0);
    sim.toggleWindow(room.id, { x: 6, y: 5, dx: 0, dy: -1 });
    expect(sim.s.money).toBeLessThan(before);
    sim.removeRoom(room.id, 1);
    expect(sim.s.money).toBe(before);
    expect(sim.s.rooms).toHaveLength(0);
    expect(sim.s.items).toHaveLength(0);
  });

  it('are not open for business until built', () => {
    const sim = freshSim();
    sim.placeItem('reception_desk', 14, 13, 0);
    addConsult(sim);
    const room = sim.createRoom('massage', LAYOUT.massage.rect, LAYOUT.massage.door);
    sim.placeItem('massage_table', 12, 5, 0, { free: true, roomId: room.id });
    sim.placeItem('oil_trolley', 14, 5, 0, { free: true, roomId: room.id });
    run(sim, 5);
    expect(sim.s.open).toBe(false);
    sim.finishRoom(room);
    run(sim, 1);
    expect(sim.s.open).toBe(true);
    expect(addMassage).toBeDefined();
  });
});
