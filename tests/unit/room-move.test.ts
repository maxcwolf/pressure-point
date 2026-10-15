// Moving and copying built rooms, furniture and all.
import { describe, expect, it } from 'vitest';

import { ROOMS, WINDOW_COST } from '../../src/core/data';
import { copyCost, placeLayout, turnLayout } from '../../src/core/room-layout';
import { itemsInRoom } from '../../src/core/sim/building';
import { createContext } from '../../src/core/sim/context';
import { inconsistencies, openCenter, runUntil } from './helpers';

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
