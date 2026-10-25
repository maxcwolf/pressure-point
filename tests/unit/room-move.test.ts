// Moving and copying built rooms, furniture and all.
import { describe, expect, it } from 'vitest';

import { copyRoomHint, moveRoomHint, templateHint } from '../../src/app/tools/hints';
import { Tools } from '../../src/app/tools/tools';
import { ROOM_TILE_COST, ROOMS, WINDOW_COST } from '../../src/core/data';
import { copyCost, placeLayout, turnLayout } from '../../src/core/room-layout';
import { itemsInRoom } from '../../src/core/sim/building';
import { createContext } from '../../src/core/sim/context';
import type { View } from '../../src/render/view';
import { addStaffRoom, inconsistencies, openCenter, runUntil, toasts } from './helpers';

/** Floor in the standard test center that nothing is built on: where the Staff Room and Restroom would go. */
const FREE = { x: 17, y: 5 };

describe('moving a room', () => {
  it('takes its furniture, windows and state along, keeps its id, and costs nothing', () => {
    const { sim, s, massage, therapist } = openCenter(1);
    sim.toggleWindow(massage.id, { x: 11, y: 6, dx: -1, dy: 0 });
    const table = s.items.find((i) => i.type === 'massage_table')!;
    table.wear = 40;
    massage.vibes = 25;
    sim.assignRoom(therapist.id, massage.id);
    const money = s.money;
    const ids = itemsInRoom(createContext(s), massage).map((i) => i.id);
    expect(sim.moveRoom(massage.id, placeLayout(sim.roomLayout(massage), FREE.x, FREE.y))).toBe(true);
    expect(massage).toMatchObject({ x: FREE.x, y: FREE.y, w: 4, h: 4, vibes: 25 });
    expect(massage.door).toEqual({ x: 18, y: 8, dx: 0, dy: 1 });
    expect(massage.windows).toEqual([{ x: 17, y: 6, dx: -1, dy: 0 }]);
    expect(itemsInRoom(createContext(s), massage).map((i) => i.id)).toEqual(ids);
    expect(table).toMatchObject({ x: 18, y: 5, wear: 40 });
    expect(therapist.rooms).toEqual([massage.id]);
    expect(s.money).toBe(money);
    expect(sim.world.zoneAt(11, 5), 'the old floor is corridor again').toBe(0);
  });

  it('can be turned on the way, and staff and guests carry on in it', () => {
    const { sim, s, massage, therapist } = openCenter(2);
    runUntil(sim, () => therapist.state === 'atPost', 200);
    const turned = turnLayout(sim.roomLayout(massage));
    expect(sim.moveRoom(massage.id, placeLayout(turned, FREE.x, FREE.y))).toBe(true);
    expect([massage.w, massage.h]).toEqual([4, 4]);
    expect(massage.door.dx).toBe(-1);
    expect(inconsistencies(sim)).toEqual([]);
    const healed = s.stats.healed;
    runUntil(sim, () => s.stats.healed > healed, 900);
    expect(inconsistencies(sim)).toEqual([]);
  });

  it('cannot go over another room, outside the building, or where it would block the way, and stays put', () => {
    const { sim, massage, consult } = openCenter(3);
    const layout = sim.roomLayout(massage);
    expect(sim.moveRoom(massage.id, placeLayout(layout, consult.x, consult.y))).toBe(false);
    expect(sim.moveRoom(massage.id, placeLayout(layout, 0, 0))).toBe(false);
    expect(sim.world.layoutValid('massage', placeLayout(layout, consult.x, consult.y), massage).reason).toBe(
      'Overlaps another room',
    );
    expect(massage).toMatchObject({ x: 11, y: 5 });
  });

  it('can shuffle over onto part of its own floor', () => {
    const { sim, massage } = openCenter(4);
    expect(sim.moveRoom(massage.id, placeLayout(sim.roomLayout(massage), 12, 5))).toBe(true);
    expect(massage.x).toBe(12);
  });
});

describe('copying a room', () => {
  it('builds a finished copy with new furniture, for what building it would cost', () => {
    const { sim, s, massage } = openCenter(5);
    sim.toggleWindow(massage.id, { x: 11, y: 6, dx: -1, dy: 0 });
    const layout = sim.roomLayout(massage);
    // a 4×4 suite, all of its floor in the price
    expect(copyCost(layout)).toBe(ROOMS.massage.cost + WINDOW_COST);
    const money = s.money;
    const copy = sim.copyRoom(massage.id, placeLayout(layout, FREE.x, FREE.y))!;
    expect(copy).toBeTruthy();
    expect(copy.id).not.toBe(massage.id);
    expect(copy).toMatchObject({ type: 'massage', done: true, x: FREE.x, y: FREE.y, vibes: 0 });
    expect(copy.windows).toHaveLength(1);
    expect(sim.missingItems(copy)).toEqual([]);
    const items = itemsInRoom(createContext(s), copy);
    expect(items.map((i) => i.type).sort()).toEqual(['massage_table', 'oil_trolley']);
    expect(items.every((i) => i.wear === 0)).toBe(true);
    expect(s.money).toBe(money - copyCost(layout));
    expect(massage).toMatchObject({ x: 11, y: 5 });
    expect(copy.bought).toBeUndefined();
    expect(sim.roomRefund(copy, 0.5)).toBe(sim.roomRefund(massage, 0.5));
  });

  it('charges for floor past what the price covers, and gives it back at half as the original does', () => {
    const { sim, s, massage } = openCenter(5);
    s.money = 100_000;
    // a 4×5 suite, four tiles past the 4×4 its price covers
    expect(sim.resizeRoom(massage.id, { ...massage, h: 5 })).toBe(true);
    const layout = sim.roomLayout(massage);
    expect(copyCost(layout)).toBe(ROOMS.massage.cost + 4 * ROOM_TILE_COST);
    const copy = sim.copyRoom(massage.id, placeLayout(layout, FREE.x, FREE.y))!;
    expect(copy.bought).toBe(4);
    expect(sim.roomRefund(copy, 0.5)).toBe(sim.roomRefund(massage, 0.5));
  });

  it('cannot be built without the money, or where the room cannot go', () => {
    const { sim, s, massage, consult } = openCenter(6);
    const layout = sim.roomLayout(massage);
    expect(sim.copyRoom(massage.id, placeLayout(layout, consult.x, consult.y))).toBeNull();
    s.money = 100;
    const rooms = s.rooms.length;
    expect(sim.copyRoom(massage.id, placeLayout(layout, FREE.x, FREE.y))).toBeNull();
    expect(s.rooms).toHaveLength(rooms);
    expect(s.money).toBe(100);
  });
});

describe('putting a room down against windows next door', () => {
  /** On the suite's east wall, looking out onto the corridor where a copy at 15,5 goes. */
  const EAST = { x: 14, y: 6, dx: 1, dy: 0 };
  /** A clock on the suite's west wall, which a copy at 15,5 hangs where the window above comes through. */
  const CLOCK = { x: 11, y: 6, rot: 3 };

  it('keeps a window that looks into a copy: it comes through into the copy', () => {
    const { sim, s, massage } = openCenter(7);
    expect(sim.toggleWindow(massage.id, EAST)).toBe('added');
    const layout = sim.roomLayout(massage);
    const placed = placeLayout(layout, 15, 5);
    expect(sim.world.roomRectValid('massage', placed.rect).ok, 'a room drawn there is fine too').toBe(true);
    expect(sim.world.layoutValid('massage', placed).ok).toBe(true);
    expect(sim.world.windowsOnto(placed)).toEqual([]);
    const money = s.money;
    sim.drain();
    const copy = sim.copyRoom(massage.id, placed)!;
    expect(copy).toBeTruthy();
    expect(massage.windows).toEqual([EAST]);
    // the copy keeps its own window on its far wall, which looks onto corridor
    expect(copy.windows).toEqual([{ x: 18, y: 6, dx: 1, dy: 0 }]);
    expect(s.money).toBe(money - copyCost(layout));
    expect(toasts(sim.drain()).some((t) => t.includes('window'))).toBe(false);
    // nothing can hang where it comes through the copy's wall
    expect(sim.world.wallFace({ x: 15, y: 6, dx: -1, dy: 0 }).reason).toBe('There is a window there');
    expect(inconsistencies(sim)).toEqual([]);
  });

  it('takes out a window where a copy hangs something, for half its price back, and says so', () => {
    const { sim, s, massage } = openCenter(7);
    expect(sim.toggleWindow(massage.id, EAST)).toBe('added');
    expect(sim.placeItem('wall_clock', CLOCK.x, CLOCK.y, CLOCK.rot)).toBeTruthy();
    const layout = sim.roomLayout(massage);
    const placed = placeLayout(layout, 15, 5);
    expect(sim.world.windowsOnto(placed)).toEqual([EAST]);
    const money = s.money;
    sim.drain();
    expect(sim.copyRoom(massage.id, placed)).toBeTruthy();
    expect(massage.windows).toEqual([]);
    expect(s.money).toBe(money - copyCost(layout) + Math.round(WINDOW_COST / 2));
    expect(toasts(sim.drain())).toContain(
      `The Massage Suite's window onto it was taken out and sold for $${Math.round(WINDOW_COST / 2)}.`,
    );
    expect(inconsistencies(sim)).toEqual([]);
  });

  it('keeps a window that looks into a moved room', () => {
    const { sim, s, massage } = openCenter(8);
    const staffroom = addStaffRoom(sim);
    // on the Staff Room's west wall, looking onto the corridor the suite moves into
    expect(sim.toggleWindow(staffroom.id, { x: 17, y: 6, dx: -1, dy: 0 })).toBe('added');
    const placed = placeLayout(sim.roomLayout(massage), 13, 5);
    expect(sim.world.windowsOnto(placed, massage)).toEqual([]);
    const money = s.money;
    expect(sim.moveRoom(massage.id, placed)).toBe(true);
    expect(massage.x).toBe(13);
    expect(staffroom.windows).toEqual([{ x: 17, y: 6, dx: -1, dy: 0 }]);
    expect(s.money).toBe(money);
  });

  it("keeps a moved room's own windows that end up looking into the room next door", () => {
    const { sim, massage } = openCenter(9);
    const staffroom = addStaffRoom(sim);
    expect(sim.toggleWindow(massage.id, EAST)).toBe('added');
    // the suite's east wall goes up against the Staff Room's west wall at x 17
    expect(sim.moveRoom(massage.id, placeLayout(sim.roomLayout(massage), 13, 5))).toBe(true);
    expect(massage.windows).toEqual([{ x: 16, y: 6, dx: 1, dy: 0 }]);
    expect(sim.world.zoneAt(17, 6)).toBe(staffroom.id);
  });

  it('warns in the hint before the click', () => {
    const { sim, massage } = openCenter(10);
    expect(sim.toggleWindow(massage.id, EAST)).toBe('added');
    /** Ignore a call to the scene. */
    const nothing = () => undefined;
    const view = { selected: null, setOverlay: nothing, setMarkers: nothing, setGhost: nothing, setDoor: nothing };
    /** The cursor is on the ground wherever the pointer says. */
    const groundAt = (x: number, y: number) => ({ x, y });
    const tools = new Tools(sim, { ...view, groundAt } as unknown as View, nothing, nothing);
    tools.startMoveRoom(massage.id, true);
    // centered on the cursor: a 4×4 suite's corner goes two tiles up and left of it
    tools.pointerMove(17, 7);
    expect(tools.problem).toBe('');
    expect(tools.hint, 'the window comes through, so nothing is said').toBe(
      copyRoomHint('massage', copyCost(sim.roomLayout(massage))),
    );
    tools.cancel();
    expect(sim.placeItem('wall_clock', CLOCK.x, CLOCK.y, CLOCK.rot)).toBeTruthy();
    tools.startMoveRoom(massage.id, true);
    tools.pointerMove(17, 7);
    expect(tools.hint).toBe(copyRoomHint('massage', copyCost(sim.roomLayout(massage)), 1));
    expect(tools.hint).toContain('takes out a window next door');
    // well clear of it, nothing is said
    tools.pointerMove(19, 7);
    expect(tools.hint).toBe(copyRoomHint('massage', copyCost(sim.roomLayout(massage))));
  });

  it('words the hints with the windows taken out', () => {
    expect(moveRoomHint('massage', 2)).toContain('Moving the Massage Suite · takes out 2 windows next door ·');
    expect(templateHint('Suite', 3000, 1)).toContain('$3,000 each · takes out a window next door ·');
    expect(copyRoomHint('massage', 3000)).not.toContain('takes out');
  });
});
