import { describe, expect, it } from 'vitest';

import { ITEMS, SANDBOX_PLOT, SIDEWALK_Y } from '../../src/core/data';
import { accessPose, accessTile, footprint, frontOf, itemDims, rotPoint, rotVec } from '../../src/core/world';
import { addConsult, addMassage, freshSim, hire, LAYOUT } from './helpers';

/** The sandbox building's corner and front door. */
const { x0: BX0, y0: BY0, y1: ENT_IN_Y, door: ENT_X } = SANDBOX_PLOT;

describe('item geometry', () => {
  it('rotates points a quarter turn at a time and comes back round', () => {
    expect(rotPoint(2, 1, 0, 0.5, 0.5)).toEqual([0.5, 0.5]);
    expect(rotPoint(2, 1, 1, 0.5, 0.5)).toEqual([0.5, 0.5]);
    expect(rotPoint(2, 1, 1, 1.5, 0.5)).toEqual([0.5, 1.5]);
    expect(rotPoint(2, 1, 2, 0.5, 0.5)).toEqual([1.5, 0.5]);
    expect(rotVec(1, 0, 1)).toEqual([-1, 0]);
    expect(rotVec(4, 3, 7)).toEqual([3, 7]);
  });

  it('swaps width and height on odd rotations', () => {
    expect(itemDims('massage_table', 0)).toEqual([1, 2]);
    expect(itemDims('massage_table', 1)).toEqual([2, 1]);
    expect(footprint({ type: 'reception_desk', x: 10, y: 10, rot: 1 })).toEqual([
      [10, 10],
      [10, 11],
      [10, 12],
    ]);
  });

  it('keeps access spots outside the footprint at every rotation', () => {
    for (const type of ['reception_desk', 'consult_desk', 'massage_table', 'bench', 'posture_scanner'] as const) {
      for (let rot = 0; rot < 4; rot++) {
        const placed = { type, x: 10, y: 10, rot };
        const tiles = footprint(placed).map(([x, y]) => `${x},${y}`);
        const staffIdx = 0;
        expect(tiles, `${type} rot ${rot}`).not.toContain(accessTile(placed, staffIdx).join(','));
      }
    }
  });

  it('puts the massage therapist and the guest on opposite sides of the table', () => {
    const table = { type: 'massage_table' as const, x: 12, y: 5, rot: 0 };
    expect(accessTile(table, 0)).toEqual([11, 6]);
    expect(accessTile(table, 1)).toEqual([13, 6]);
    const lying = accessPose(table, 1);
    expect(lying.pose).toBe('lie');
    expect(lying.x).toBeCloseTo(12.5);
    expect(lying.y).toBeCloseTo(6);
  });

  it('finds the middle of the front edge of an item with a front, turning with it', () => {
    // a 3×1 desk at (10,10), its front first facing down the map, then turned a quarter at a time
    const expected = [
      [11.5, 11, 0],
      [10, 11.5, -Math.PI / 2],
      [11.5, 10, Math.PI],
      [11, 11.5, Math.PI / 2],
    ];
    expected.forEach(([x, y, face], rot) => {
      const front = frontOf({ type: 'reception_desk', x: 10, y: 10, rot })!;
      expect(front.x, `rot ${rot}`).toBeCloseTo(x!);
      expect(front.y, `rot ${rot}`).toBeCloseTo(y!);
      expect(Math.cos(front.face - face!), `rot ${rot}`).toBeCloseTo(1);
    });
    expect(frontOf({ type: 'plant', x: 10, y: 10, rot: 0 }), 'a plant looks the same all round').toBeNull();
  });

  it('puts the guest at a desk half a tile out from its front, at every rotation', () => {
    for (const type of ['reception_desk', 'consult_desk', 'shop_counter'] as const) {
      const guest = ITEMS[type].access.findIndex((a) => a.role === 'guest');
      for (let rot = 0; rot < 4; rot++) {
        const desk = { type, x: 10, y: 10, rot };
        const front = frontOf(desk)!;
        const [gx, gy] = accessTile(desk, guest);
        const out = (gx + 0.5 - front.x) * Math.sin(front.face) + (gy + 0.5 - front.y) * Math.cos(front.face);
        expect(out, `${type} rot ${rot}`).toBeCloseTo(0.5);
      }
    }
  });
});

describe('pathfinding', () => {
  it('finds a way from the street into the lobby', () => {
    const { world } = freshSim();
    const path = world.findPath(0, SIDEWALK_Y, ENT_X[0], ENT_IN_Y - 1);
    expect(path).not.toBeNull();
    expect(path!.at(-1)).toEqual([ENT_X[0] + 0.5, ENT_IN_Y - 0.5, 0]);
  });

  it('refuses to path onto the lawn or through the outer wall', () => {
    const { world } = freshSim();
    expect(world.findPath(0, SIDEWALK_Y, 1, 1)).toBeNull();
    // the only way in is the entrance, so every route to the far corner passes through it
    const path = world.findPath(world.w - 1, SIDEWALK_Y, BX0, BY0)!;
    expect(path.some(([x, y]) => ENT_X.includes(Math.floor(x)) && Math.floor(y) === ENT_IN_Y)).toBe(true);
  });

  it('only enters a room through its door', () => {
    const sim = freshSim();
    const room = addConsult(sim);
    const path = sim.world.findPath(15, 12, 6, 7)!;
    /** Whether a point is inside the room. */
    const inside = (x: number, y: number) => sim.world.zoneAt(Math.floor(x), Math.floor(y)) === room.id;
    const firstInside = path.find(([x, y]) => inside(x, y))!;
    expect([Math.floor(firstInside[0]), Math.floor(firstInside[1])]).toEqual([room.door.x, room.door.y]);
  });

  it('returns an empty path when already there', () => {
    expect(freshSim().world.findPath(10, 10, 10, 10)).toEqual([]);
  });

  it('finds the shortest way every time, however many searches came before', () => {
    const sim = freshSim();
    addConsult(sim);
    addMassage(sim);
    const { world } = sim;
    /** The length of a path from a tile, every step allowed by the same rules as the search. */
    const length = (sx: number, sy: number, path: readonly (readonly number[])[]) => {
      let [x, y] = [sx, sy];
      let total = 0;
      for (const [px, py] of path) {
        const [nx, ny] = [Math.floor(px!), Math.floor(py!)];
        const [dx, dy] = [nx - x, ny - y];
        expect(Math.max(Math.abs(dx), Math.abs(dy)), 'one tile at a time').toBe(1);
        if (dx && dy) expect(world.canStep(x, y, nx, y) && world.canStep(x, y, x, ny)).toBe(true);
        else expect(world.canStep(x, y, nx, ny)).toBe(true);
        total += dx && dy ? Math.SQRT2 : 1;
        [x, y] = [nx, ny];
      }
      return total;
    };
    /** The shortest distance between two tiles, by a plain search of every way there. */
    const shortest = (sx: number, sy: number, gx: number, gy: number) => {
      const dist = new Map<number, number>([[sy * world.w + sx, 0]]);
      const todo = [[sx, sy, 0]];
      while (todo.length) {
        todo.sort((a, b) => a[2]! - b[2]!);
        const [x, y, d] = todo.shift()!;
        if (x === gx && y === gy) return d!;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ] as const) {
          const [nx, ny] = [x! + dx, y! + dy];
          const ok =
            dx && dy
              ? world.canStep(x!, y!, nx, y!) &&
                world.canStep(nx, y!, nx, ny) &&
                world.canStep(x!, y!, x!, ny) &&
                world.canStep(x!, ny, nx, ny)
              : world.canStep(x!, y!, nx, ny);
          const nd = d! + (dx && dy ? Math.SQRT2 : 1);
          if (!ok || (dist.get(ny * world.w + nx) ?? Infinity) <= nd) continue;
          dist.set(ny * world.w + nx, nd);
          todo.push([nx, ny, nd]);
        }
      }
      return null;
    };
    // long and short searches in turn, from the street, the lobby and the rooms, near and far
    const spots = [
      [0, SIDEWALK_Y],
      [ENT_X[0], ENT_IN_Y - 1],
      [15, 12],
      [6, 7],
      [10, 10],
      [11, 10],
      [BX0, BY0],
      [12, 15],
    ] as const;
    for (const [sx, sy] of spots)
      for (const [gx, gy] of spots) {
        const path = world.findPath(sx, sy, gx, gy);
        const best = shortest(sx, sy, gx, gy);
        if (best === null) expect(path).toBeNull();
        else expect(length(sx, sy, path!), `${sx},${sy} to ${gx},${gy}`).toBeCloseTo(best);
      }
  });
});

describe('placing items', () => {
  it('stops offering a spot to stand on once something is built there', () => {
    const sim = freshSim();
    const before = sim.world.standSpots(10, 10, 40);
    const [x, y] = before[5]!;
    expect(sim.placeItem('plant', x, y, 0)).not.toBeNull();
    const after = sim.world.standSpots(10, 10, 40);
    expect(after).not.toContainEqual([x, y]);
    expect(after.length).toBeGreaterThan(0);
  });

  it('accepts a bench in the corridor and charges for it', () => {
    const sim = freshSim();
    const before = sim.s.money;
    expect(sim.placeItem('bench', 10, 10, 0)).not.toBeNull();
    expect(sim.s.money).toBe(before - 150);
  });

  it('rejects spots outside the building, on top of things, and in doorways', () => {
    const sim = freshSim();
    const { world } = sim;
    expect(world.canPlaceItem('plant', 1, 1, 0).ok).toBe(false);
    sim.placeItem('plant', 10, 10, 0);
    expect(world.canPlaceItem('plant', 10, 10, 0).reason).toMatch(/in the way/);
    expect(world.canPlaceItem('plant', ENT_X[0], ENT_IN_Y, 0).reason).toMatch(/doorways/);
  });

  it('keeps room furniture in the right kind of room', () => {
    const sim = freshSim();
    addConsult(sim);
    expect(sim.world.canPlaceItem('sofa', 10, 12, 0).reason).toMatch(/Staff Room/);
    expect(sim.world.canPlaceItem('bench', 6, 8, 0).reason).toMatch(/corridor/);
    expect(sim.world.canPlaceItem('sofa', 6, 8, 0).reason).toMatch(/Staff Room/);
  });

  it('will not let furniture wall anyone in', () => {
    const sim = freshSim();
    const caretaker = hire(sim, 'caretaker');
    // put them at the back of the building, then build a wall of plants across it with one gap
    Object.assign(caretaker, { x: 10.5, y: 5.5, tx: 10, ty: 5, path: null, dest: null, state: 'idle', timer: 999 });
    const row = ENT_IN_Y - 2;
    for (let x = BX0; x <= 27; x++) {
      if (x === 20) continue;
      expect(sim.placeItem('plant', x, row, 0), `plant at ${x}`).not.toBeNull();
    }
    expect(sim.world.canPlaceItem('plant', 20, row, 0).reason).toMatch(/block the way/);
    // with nobody behind it, closing the gap strands no one and is allowed
    Object.assign(caretaker, { x: 14.5, y: 16.5, tx: 14, ty: 16 });
    expect(sim.world.canPlaceItem('plant', 20, row, 0).ok).toBe(true);
  });

  it('will not build under someone stepping into a corner it would seal off', () => {
    const sim = freshSim();
    const caretaker = hire(sim, 'caretaker');
    Object.assign(caretaker, { x: 14.5, y: 16.5, tx: 14, ty: 16, path: null, dest: null, state: 'idle', timer: 999 });
    // a nook in the back corner, open only at (3,5)
    for (const [x, y] of [
      [5, 3],
      [5, 4],
      [4, 5],
    ] as const)
      expect(sim.placeItem('plant', x, y, 0), `plant at ${x},${y}`).not.toBeNull();
    // on the gap, partway across into the nook: their tile is still the gap, but they will walk on into the nook
    Object.assign(caretaker, { x: 3.5, y: 5.1, tx: 3, ty: 5, path: [[3.5, 4.5, 0]], dest: [3, 4, 0, 0, 0] });
    expect(sim.world.canPlaceItem('plant', 3, 5, 0).reason).toMatch(/block the way/);
    // standing on the gap, they just step off it the other way
    Object.assign(caretaker, { x: 3.5, y: 5.5, path: null, dest: null });
    expect(sim.placeItem('plant', 3, 5, 0)).not.toBeNull();
    expect(sim.world.findPath(3, 5, ENT_X[0], ENT_IN_Y)).not.toBeNull();
  });

  it('will not build on the tile of someone who could only step off it through a wall', () => {
    const sim = freshSim();
    const caretaker = hire(sim, 'caretaker');
    Object.assign(caretaker, { x: 14.5, y: 16.5, tx: 14, ty: 16, path: null, dest: null, state: 'idle', timer: 999 });
    addConsult(sim);
    // a one-tile nook against the Consultation Room's west wall, the room open on the far side of it
    for (const [x, y] of [
      [3, 6],
      [4, 5],
      [4, 7],
    ] as const)
      expect(sim.placeItem('plant', x, y, 0), `plant at ${x},${y}`).not.toBeNull();
    Object.assign(caretaker, { x: 4.5, y: 6.5, tx: 4, ty: 6 });
    expect(sim.world.walkable(5, 6)).toBe(true);
    expect(sim.world.canPlaceItem('plant', 4, 6, 0).reason).toMatch(/block the way/);
  });

  it('will not put up a room that leaves someone in a stretch of corridor it cuts off', () => {
    const sim = freshSim();
    const caretaker = hire(sim, 'caretaker');
    Object.assign(caretaker, { x: 3.5, y: 3.5, tx: 3, ty: 3, path: null, dest: null, state: 'idle', timer: 999 });
    expect(sim.placeItem('plant', 3, 5, 0)).not.toBeNull();
    // a Restroom along the back wall would leave the strip at x 3 open only into the room, through its wall
    const rect = { x: 4, y: 3, w: 3, h: 2 };
    const door = { x: 5, y: 4, dx: 0, dy: 1 };
    expect(sim.world.doorValid('restroom', rect, door).reason).toMatch(/block the way/);
    // with nobody in the strip, it is fine
    Object.assign(caretaker, { x: 14.5, y: 16.5, tx: 14, ty: 16 });
    expect(sim.world.doorValid('restroom', rect, door).ok).toBe(true);
  });

  it('will not let furniture cut off a room door or a piece of furniture', () => {
    const sim = freshSim();
    const room = addConsult(sim);
    const [ox, oy] = [room.door.x + room.door.dx, room.door.y + room.door.dy];
    expect(sim.world.canPlaceItem('plant', ox, oy, 0).ok).toBe(false);
    // box in the tile outside the door from its three open sides
    expect(sim.placeItem('plant', ox + 1, oy - 1, 0)).not.toBeNull();
    expect(sim.placeItem('plant', ox + 1, oy + 1, 0)).not.toBeNull();
    expect(sim.placeItem('plant', ox, oy - 1, 0)).not.toBeNull();
    expect(sim.placeItem('plant', ox, oy + 1, 0)).not.toBeNull();
    expect(sim.world.canPlaceItem('plant', ox + 1, oy, 0).reason).toMatch(/block the way/);
  });

  it('lets rugs lie under furniture but not on other rugs', () => {
    const sim = freshSim();
    expect(sim.placeItem('rug', 10, 10, 0)).not.toBeNull();
    expect(sim.world.canPlaceItem('rug', 11, 11, 0).reason).toMatch(/rug/);
    expect(sim.world.walkable(10, 10)).toBe(true);
    expect(sim.placeItem('plant', 10, 10, 0)).not.toBeNull();
    expect(sim.world.walkable(10, 10)).toBe(false);
  });
});

describe('laying out rooms', () => {
  it('enforces a minimum size', () => {
    const { world } = freshSim();
    expect(world.roomRectValid('massage', { x: 5, y: 5, w: 2, h: 3 }).reason).toMatch(/Too small/);
    expect(world.roomRectValid('restroom', { x: 5, y: 5, w: 2, h: 3 }).ok).toBe(true);
    expect(world.roomRectValid('massage', { x: 5, y: 5, w: 3, h: 3 }).ok).toBe(true);
  });

  it('will not overlap another room or cover the entrance', () => {
    const sim = freshSim();
    addConsult(sim);
    expect(sim.world.roomRectValid('massage', { x: 7, y: 7, w: 3, h: 3 }).reason).toMatch(/Overlaps/);
    expect(sim.world.roomRectValid('massage', { x: 13, y: 15, w: 3, h: 3 }).ok).toBe(false);
  });

  it('will not cut a corridor rug in two', () => {
    const sim = freshSim();
    expect(sim.placeItem('rug', 10, 10, 0)).not.toBeNull();
    // the rug covers x 10..11; a room starting at x 11 would put a wall through it
    expect(sim.world.roomRectValid('consult', { x: 11, y: 9, w: 3, h: 3 }).ok).toBe(false);
    // clear of it, or right over it, is fine
    expect(sim.world.roomRectValid('consult', { x: 12, y: 9, w: 3, h: 3 }).ok).toBe(true);
    expect(sim.world.roomRectValid('consult', { x: 9, y: 9, w: 4, h: 4 }).ok).toBe(true);
  });

  it('will not wall up the window of the room next door', () => {
    const sim = freshSim();
    const consult = addConsult(sim);
    expect(sim.toggleWindow(consult.id, { x: 8, y: 5, dx: 1, dy: 0 })).toBe('added');
    expect(sim.world.roomRectValid('staffroom', { x: 9, y: 4, w: 3, h: 3 }).reason).toMatch(/window/);
    // a tile further out, leaving the window a strip of corridor to look onto, is fine
    expect(sim.world.roomRectValid('staffroom', { x: 10, y: 4, w: 3, h: 3 }).ok).toBe(true);
  });

  it('only allows doors that open onto a corridor', () => {
    const sim = freshSim();
    const rect = { x: BX0, y: BY0, w: 3, h: 3 };
    expect(sim.world.doorValid('massage', rect, { x: BX0, y: BY0, dx: -1, dy: 0 }).reason).toMatch(/corridor/);
    expect(sim.world.doorValid('massage', rect, { x: BX0 + 2, y: BY0 + 1, dx: 1, dy: 0 }).ok).toBe(true);
  });

  it('picks the wall nearest the cursor for the door', () => {
    const { world } = freshSim();
    const rect = LAYOUT.massage.rect;
    expect(world.nearestDoor(rect, 12.5, 9.2)).toEqual({ x: 12, y: 8, dx: 0, dy: 1 });
    expect(world.nearestDoor(rect, 10.8, 6.5)).toEqual({ x: 11, y: 6, dx: -1, dy: 0 });
  });

  it('marks unfinished rooms and broken equipment as unusable', () => {
    const sim = freshSim();
    const room = sim.createRoom('massage', LAYOUT.massage.rect, LAYOUT.massage.door);
    const table = sim.placeItem('massage_table', 12, 5, 0, { free: true, roomId: room.id })!;
    expect(sim.world.usable(table)).toBe(false);
    sim.placeItem('oil_trolley', 14, 5, 0, { free: true, roomId: room.id });
    sim.finishRoom(room);
    expect(sim.world.usable(table)).toBe(true);
    table.wear = 100;
    expect(sim.world.usable(table)).toBe(false);
  });

  it('refunds half when a finished room is demolished', () => {
    const sim = freshSim();
    const room = addMassage(sim);
    const before = sim.s.money;
    sim.removeRoom(room.id, 0.5);
    expect(sim.s.money).toBe(before + 3500);
    expect(sim.s.rooms).toHaveLength(0);
    expect(sim.s.items).toHaveLength(0);
  });
});
