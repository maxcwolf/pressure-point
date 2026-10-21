import { describe, expect, it } from 'vitest';

import { dragRect, itemSpot, tileOf } from '../../src/app/tools/geometry';
import {
  copyRoomHint,
  doorHint,
  dragHint,
  MOVE_DOOR_HINT,
  moveHint,
  moveRoomHint,
  placeHint,
  planHint,
  WINDOW_HINT,
} from '../../src/app/tools/hints';
import { dragTiles, itemTiles, layoutTiles, rectTiles } from '../../src/app/tools/overlay';
import { heldItem, nextRequired, planStatus, quarterTurn } from '../../src/app/tools/plan';
import { isStaffRole, legend, useSquares } from '../../src/app/tools/squares';
import { Tools } from '../../src/app/tools/tools';
import type { Tool } from '../../src/app/tools/types';
import { ROOMS } from '../../src/core/data';
import { money } from '../../src/core/format';
import { copyCost } from '../../src/core/room-layout';
import type { Room } from '../../src/core/state/types';
import { OV_BAD, OV_BLUE, OV_FREE, OV_GOOD, OV_GUEST, OV_STAFF } from '../../src/render/overlay-codes';
import type { View } from '../../src/render/view';
import { freshSim, LAYOUT, openCenter, toasts } from './helpers';

const ROOM: Room = {
  id: 7,
  type: 'restroom',
  x: 5,
  y: 5,
  w: 3,
  h: 2,
  door: { x: 5, y: 6, dx: 0, dy: 1 },
  windows: [],
  done: false,
  priority: false,
  vibes: 0,
  claimedBy: 0,
};

describe('cursor geometry', () => {
  it('finds the tile under a point', () => {
    expect(tileOf({ x: 3.9, y: 4.1 })).toEqual([3, 4]);
    expect(tileOf({ x: 0, y: 0 })).toEqual([0, 0]);
  });

  it('makes the same rectangle whichever way it is dragged', () => {
    expect(dragRect([2, 3], [5, 7])).toEqual({ x: 2, y: 3, w: 4, h: 5 });
    expect(dragRect([5, 7], [2, 3])).toEqual({ x: 2, y: 3, w: 4, h: 5 });
    expect(dragRect([5, 3], [2, 7])).toEqual({ x: 2, y: 3, w: 4, h: 5 });
  });

  it('makes a single tile from a press that has not moved', () => {
    expect(dragRect([4, 4], [4, 4])).toEqual({ x: 4, y: 4, w: 1, h: 1 });
  });

  it('centers an item on the cursor', () => {
    // a plant is one tile, so it sits on the tile under the cursor
    expect(itemSpot({ x: 10.2, y: 6.8 }, 'plant', 0)).toEqual([10, 6]);
    // a reception desk is three tiles wide, so it starts one tile to the left
    expect(itemSpot({ x: 10.5, y: 6.5 }, 'reception_desk', 0)).toEqual([9, 6]);
  });

  it('follows the item when it is turned', () => {
    expect(itemSpot({ x: 10.5, y: 6.5 }, 'reception_desk', 1)).toEqual([10, 5]);
  });
});

describe('the squares people use furniture from', () => {
  it('counts working, resting and studying as staff squares, and everything else as guest squares', () => {
    expect(['staff', 'rest', 'study'].map((r) => isStaffRole(r as 'staff'))).toEqual([true, true, true]);
    expect(['guest', 'seat', 'toilet', 'drink', 'eat'].map((r) => isStaffRole(r as 'guest'))).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it('gives a massage table one square for the therapist and one for the guest', () => {
    const squares = useSquares({ type: 'massage_table', x: 10, y: 10, rot: 0 });
    expect(squares.map((s) => s.staff).sort()).toEqual([false, true]);
  });

  it('moves the squares with the item and turns them with it', () => {
    const here = useSquares({ type: 'bench', x: 10, y: 10, rot: 0 });
    const there = useSquares({ type: 'bench', x: 13, y: 12, rot: 0 });
    expect(there.map((s) => [s.x - 3, s.y - 2])).toEqual(here.map((s) => [s.x, s.y]));
    const turned = useSquares({ type: 'bench', x: 10, y: 10, rot: 1 });
    expect(turned.map((s) => [s.x, s.y])).not.toEqual(here.map((s) => [s.x, s.y]));
  });

  it('explains the colors only for the kinds of square an item has, naming who works it', () => {
    expect(legend('massage_table')).toBe(' · purple square: Massage Therapist · orange square: guests');
    expect(legend('sofa')).toBe(' · purple square: staff');
    expect(legend('bench')).toBe(' · orange square: guests');
    expect(legend('plant')).toBe('');
  });
});

describe('hints', () => {
  it('names the item, its price and how to place it', () => {
    expect(placeHint('plant')).toContain('Potted Plant · $');
    expect(placeHint('plant')).toContain('click to place · R rotates · Esc when done');
    expect(moveHint('bench')).toContain('Moving the Bench · click to put it down');
  });

  it('asks for a minimum size until the drag starts, then reports the size', () => {
    expect(dragHint('massage', null)).toMatch(/Massage Suite · drag out the floor \(at least \d+×\d+\) · Esc cancels/);
    expect(dragHint('massage', { x: 0, y: 0, w: 4, h: 5 })).toContain('Massage Suite · 4×5 · release to confirm');
    expect(doorHint('massage')).toContain('click a wall to place the door');
  });

  it('follows what is in hand while a blueprint is open', () => {
    expect(planHint(null, 2)).toBe('Pick the missing furniture from the blueprint panel');
    expect(planHint(null, 0)).toContain('Everything needed is in');
    expect(planHint({ kind: 'window' }, 0)).toBe(WINDOW_HINT);
    expect(planHint({ kind: 'door' }, 0)).toBe(MOVE_DOOR_HINT);
    expect(planHint({ kind: 'item', type: 'toilet', rot: 0, required: true }, 1)).toContain('inside the room');
    expect(planHint({ kind: 'item', type: 'plant', rot: 0, required: false }, 1)).toContain('Esc puts it down');
  });
});

describe('floor overlays', () => {
  it('covers every tile of a rectangle', () => {
    expect(rectTiles({ x: 2, y: 3, w: 2, h: 2 }, OV_BLUE)).toEqual([
      [2, 3, OV_BLUE],
      [3, 3, OV_BLUE],
      [2, 4, OV_BLUE],
      [3, 4, OV_BLUE],
    ]);
  });

  it('colors a dragged room green when it is allowed, yellow when not yet, and red where something is in the way', () => {
    /** Everything is free except the tile at 3,3. */
    const isFree = (x: number, y: number) => !(x === 3 && y === 3);
    const rect = { x: 2, y: 3, w: 2, h: 1 };
    expect(dragTiles(rect, true, isFree)).toEqual([
      [2, 3, OV_GOOD],
      [3, 3, OV_BAD],
    ]);
    expect(dragTiles(rect, false, isFree)).toEqual([
      [2, 3, OV_FREE],
      [3, 3, OV_BAD],
    ]);
  });

  it('draws an item as its footprint plus a marked square for everyone who uses it', () => {
    const fits = itemTiles({ type: 'massage_table', x: 10, y: 10, rot: 0 }, true);
    expect(fits.tiles.filter((t) => t[2] === OV_GOOD).length).toBeGreaterThan(0);
    expect(fits.tiles.filter((t) => t[2] === OV_STAFF)).toHaveLength(1);
    expect(fits.tiles.filter((t) => t[2] === OV_GUEST)).toHaveLength(1);
    // the staff square shows who works it: here, a massage therapist
    expect(fits.markers.map((m) => m.icon).sort()).toEqual(['marker-guest', 'role-therapist']);
    expect(itemTiles({ type: 'reception_desk', x: 10, y: 10, rot: 0 }, true).markers.map((m) => m.icon)).toContain(
      'role-receptionist',
    );
    const blocked = itemTiles({ type: 'massage_table', x: 10, y: 10, rot: 0 }, false);
    expect(blocked.tiles.filter((t) => t[2] === OV_BAD).length).toBeGreaterThan(0);
    expect(blocked.tiles.some((t) => t[2] === OV_GOOD)).toBe(false);
  });

  it('draws only the footprint for an item nobody stands at', () => {
    const { tiles, markers } = itemTiles({ type: 'plant', x: 4, y: 4, rot: 0 }, true);
    expect(tiles).toEqual([[4, 4, OV_GOOD]]);
    expect(markers).toEqual([]);
  });
});

describe('blueprints', () => {
  it('hands over required furniture one piece at a time, then nothing', () => {
    expect(nextRequired(['toilet', 'sink'])).toEqual({ kind: 'item', type: 'toilet', rot: 0, required: true });
    expect(nextRequired([])).toBeNull();
  });

  it('reports what is missing and what is in hand', () => {
    expect(planStatus(ROOM, ['sink'], { kind: 'item', type: 'sink', rot: 0, required: true })).toEqual({
      room: ROOM,
      missing: ['sink'],
      holding: 'sink',
      ready: false,
    });
    expect(planStatus(ROOM, [], { kind: 'window' })).toMatchObject({ holding: 'window', ready: true });
    expect(planStatus(ROOM, [], null)).toMatchObject({ holding: '', ready: true });
  });

  it('finds the item that R would turn', () => {
    const placing: Tool = { kind: 'item', type: 'plant', rot: 2 };
    expect(heldItem(placing)).toBe(placing);
    const moving: Tool = { kind: 'move', id: 3, type: 'bench', rot: 1 };
    expect(heldItem(moving)).toBe(moving);
    const sub = { kind: 'item', type: 'sink', rot: 0, required: true } as const;
    expect(heldItem({ kind: 'room', type: 'restroom', phase: 'plan', room: ROOM, sub })).toBe(sub);
  });

  it('has nothing to turn with a wall tool or empty hands', () => {
    expect(heldItem({ kind: 'none' })).toBeNull();
    expect(heldItem({ kind: 'window', roomId: 7 })).toBeNull();
    expect(heldItem({ kind: 'room', type: 'restroom', phase: 'plan', room: ROOM, sub: { kind: 'door' } })).toBeNull();
    expect(heldItem({ kind: 'room', type: 'restroom', phase: 'drag', start: null, rect: null })).toBeNull();
  });

  it('turns through four quarter turns and back to the start', () => {
    expect([0, 1, 2, 3].map(quarterTurn)).toEqual([1, 2, 3, 0]);
  });
});

describe('building a blueprint', () => {
  /** Ignore a call to the scene. */
  const nothing = () => undefined;
  /** A finished Consultation Room blueprint, open in the build tools, with a stand-in for the scene. */
  function openBlueprint() {
    const sim = freshSim();
    const room = sim.createRoom('consult', LAYOUT.consult.rect, LAYOUT.consult.door);
    sim.placeItem('consult_desk', 6, 6, 0, { free: true, roomId: room.id });
    sim.placeItem('cabinet', 5, 8, 0, { free: true, roomId: room.id });
    const view = { selected: null, setOverlay: nothing, setMarkers: nothing, setGhost: nothing, setDoor: nothing };
    const tools = new Tools(sim, view as unknown as View, nothing, nothing);
    tools.tool = { kind: 'room', type: 'consult', phase: 'plan', room, sub: null };
    return { sim, room, tools };
  }

  it('builds the room and charges for it', () => {
    const { sim, room, tools } = openBlueprint();
    const before = sim.s.money;
    expect(tools.planBuild()).toBe(true);
    expect(room.done).toBe(true);
    expect(sim.s.money).toBe(before - ROOMS.consult.cost);
  });

  it('refuses to build once the money has been spent elsewhere, and says why', () => {
    const { sim, room, tools } = openBlueprint();
    sim.drain();
    sim.s.money = ROOMS.consult.cost - 1;
    expect(tools.planBuild()).toBe(false);
    expect(room.done).toBe(false);
    expect(sim.s.money).toBe(ROOMS.consult.cost - 1);
    expect(toasts(sim.drain()).some((t) => t.includes("can't afford"))).toBe(true);
  });
});

describe('moving and copying a room', () => {
  /** Ignore a call to the scene. */
  const nothing = () => undefined;
  /** A center with its rooms built, and the build tools on it, where the cursor is wherever the pointer says. */
  function withTools() {
    const c = openCenter(1);
    const view = {
      selected: null,
      setOverlay: nothing,
      setMarkers: nothing,
      setGhost: nothing,
      setDoor: nothing,
      /** The cursor is on the ground wherever the pointer says. */
      groundAt: (x: number, y: number) => ({ x, y }),
    };
    const tools = new Tools(c.sim, view as unknown as View, nothing, nothing);
    return { ...c, tools, view };
  }

  it('picks the room up, turns it with R, and puts it down where clicked, selected', () => {
    const { sim, massage, tools, view } = withTools();
    tools.startMoveRoom(massage.id);
    expect(tools.hint).toContain('Moving the Massage Suite');
    tools.rotate();
    // a 4×4 room centered on the cursor has its corner two tiles up and left
    tools.pointerMove(19, 7);
    expect(tools.problem).toBe('');
    tools.pointerUp(19, 7);
    expect(massage).toMatchObject({ x: 17, y: 5 });
    expect(massage.door.dx, 'turned: the door on the bottom wall is now on the left').toBe(-1);
    expect(tools.tool.kind).toBe('none');
    expect(view.selected).toEqual({ kind: 'room', id: massage.id });
    expect(sim.world.zoneAt(11, 5)).toBe(0);
  });

  it('says why a room cannot go somewhere, and stays in hand', () => {
    const { massage, consult, tools } = withTools();
    tools.startMoveRoom(massage.id);
    tools.pointerMove(consult.x + 2, consult.y + 2);
    expect(tools.problem).toBe('Overlaps another room');
    tools.pointerUp(consult.x + 2, consult.y + 2);
    expect(tools.tool.kind).toBe('moveRoom');
    expect(massage).toMatchObject({ x: 11, y: 5 });
  });

  it('keeps copying until put away, with the price in the hint', () => {
    const { s, sim, massage, tools } = withTools();
    tools.startMoveRoom(massage.id, true);
    expect(tools.hint).toContain(money(copyCost(sim.roomLayout(massage))));
    const rooms = s.rooms.length;
    tools.pointerMove(19, 7);
    tools.pointerUp(19, 7);
    expect(s.rooms).toHaveLength(rooms + 1);
    expect(tools.tool.kind).toBe('moveRoom');
    tools.back();
    expect(tools.tool.kind).toBe('none');
  });

  it('colors the floor where it would go, with its furniture in blue', () => {
    const placed = {
      rect: { x: 0, y: 0, w: 2, h: 1 },
      door: { x: 0, y: 0, dx: 0, dy: -1 },
      windows: [],
      items: [{ type: 'plant' as const, x: 1, y: 0, rot: 0 }],
    };
    expect(layoutTiles(placed, true)).toEqual([
      [0, 0, OV_GOOD],
      [1, 0, OV_BLUE],
    ]);
    expect(layoutTiles(placed, false)[0]).toEqual([0, 0, OV_BAD]);
  });

  it('has hints for moving and for copying', () => {
    expect(moveRoomHint('massage')).toContain('R turns it');
    expect(copyRoomHint('massage', 3000)).toContain('$3,000 each');
  });
});

describe('refusals', () => {
  /** Ignore a call to the scene. */
  const nothing = () => undefined;

  it('say an item that fits but cannot be paid for is refused for the money', () => {
    const { sim } = openCenter(1);
    const refusals: [string, string][] = [];
    const view = {
      selected: null,
      setOverlay: nothing,
      setMarkers: nothing,
      setGhost: nothing,
      setDoor: nothing,
      /** The cursor is on the ground wherever the pointer says. */
      groundAt: (x: number, y: number) => ({ x, y }),
    };
    const tools = new Tools(sim, view as unknown as View, nothing, nothing, (action, reason) =>
      refusals.push([action, reason]),
    );
    tools.startItem('plant');
    // the first spot where a plant fits
    let spot: [number, number] | undefined;
    for (let y = 0; y < sim.world.h && !spot; y++)
      for (let x = 0; x < sim.world.w && !spot; x++) {
        tools.pointerMove(x + 0.5, y + 0.5);
        if (tools.problem === '') spot = [x + 0.5, y + 0.5];
      }
    expect(spot).toBeDefined();
    sim.s.money = 0;
    tools.pointerUp(...spot!);
    expect(refusals).toEqual([['place_item', "Can't afford it"]]);
  });
});
