// Fire cover: which rooms have a Fire Extinguisher near the door, what one in hand would cover, and how the floor, the
// hint and a room's inspector say so before the health inspector does.
import { describe, expect, it } from 'vitest';

import { reachEdge } from '../../src/app/tools/overlay';
import { EXTINGUISHER_REACH } from '../../src/core/data';
import { createContext } from '../../src/core/sim/context';
import { canCatchFire, doorCovered, fireCover, heldCover, inReach, worksAt } from '../../src/core/sim/fire-cover';
import { extinguisherNear } from '../../src/core/sim/visits';
import { fireEffects, roomList } from '../../src/ui/lib/fire';
import { fireTiles, previewMode } from '../../src/ui/lib/overlays';
import { addRestroom, addStaffRoom, openCenter } from './helpers';

describe('fire cover', () => {
  it('reaches a door from anywhere in the square around it, as far as the reach either way, and no further', () => {
    const door = { x: 12, y: 8 };
    expect(inReach(12 + EXTINGUISHER_REACH, 8 - EXTINGUISHER_REACH, door)).toBe(true);
    expect(inReach(12 + EXTINGUISHER_REACH + 1, 8, door)).toBe(false);
    expect(inReach(12, 8 + EXTINGUISHER_REACH + 1, door)).toBe(false);
  });

  it('is the inspector’s own rule: a room covered is one the inspector passes', () => {
    const { sim, s, massage, consult } = openCenter(1);
    const ctx = createContext(s);
    expect(fireCover(ctx).map((c) => c.covered)).toEqual([false, false]);
    // the Massage Suite's door is 8 tiles away, the Consultation Room's 12
    expect(sim.placeItem('fire_extinguisher', 20, 10, 0)).not.toBeNull();
    const cover = fireCover(ctx);
    expect(cover.find((c) => c.room.id === massage.id)?.covered).toBe(true);
    expect(cover.find((c) => c.room.id === consult.id)?.covered).toBe(false);
    for (const c of cover) expect(c.covered).toBe(extinguisherNear(ctx, c.room));
  });

  it('says what one in hand would cover, and what one moved would leave without', () => {
    const { sim, s, massage, consult } = openCenter(1);
    const ctx = createContext(s);
    expect(heldCover(fireCover(ctx, { x: 10, y: 10 }))).toEqual({
      gains: [consult.id, massage.id],
      losses: [],
      left: 0,
      rooms: 2,
    });
    const ext = sim.placeItem('fire_extinguisher', 20, 10, 0);
    if (!ext) throw new Error('no extinguisher');
    // moved out of the Massage Suite's reach, it leaves it with none
    expect(heldCover(fireCover(ctx, { x: 23, y: 10, moving: ext.id }))).toEqual({
      gains: [],
      losses: [massage.id],
      left: 2,
      rooms: 2,
    });
    // held where it stands, it changes nothing
    expect(heldCover(fireCover(ctx, { x: 20, y: 10, moving: ext.id }))).toMatchObject({
      gains: [],
      losses: [],
      left: 1,
    });
  });

  it('counts sprinklers, but not an extinguisher in a flooded room', () => {
    const { sim, s, massage } = openCenter(1);
    massage.sprinklers = true;
    expect(fireCover(createContext(s)).find((c) => c.room.id === massage.id)?.covered).toBe(true);
    massage.sprinklers = false;
    const restroom = addRestroom(sim);
    const ctx = createContext(s);
    s.litter.push({ x: 22, y: 5, flood: restroom.id } as (typeof s.litter)[number]);
    expect(worksAt(ctx, 22, 6)).toBe(false);
    expect(worksAt(ctx, 13, 10)).toBe(true);
  });

  it('knows a room with a machine that can catch fire', () => {
    const { s, massage, consult } = openCenter(1);
    expect(canCatchFire('stone_kiln')).toBe(true);
    expect(canCatchFire('massage_table')).toBe(false);
    expect(fireCover(createContext(s)).some((c) => c.risky)).toBe(false);
    // a Hot Stone Kiln where the table stands, for the sake of the room it is in
    const table = s.items.find((it) => it.type === 'massage_table');
    if (table) table.type = 'stone_kiln';
    const cover = fireCover(createContext(s));
    expect(cover.find((c) => c.room.id === massage.id)?.risky).toBe(true);
    expect(cover.find((c) => c.room.id === consult.id)?.risky).toBe(false);
  });

  it('covers a door from extinguishers staying or coming with a room, not those leaving with it', () => {
    const { sim, s, massage } = openCenter(1);
    const ctx = createContext(s);
    const door = { x: 12, y: 8 };
    expect(doorCovered(ctx, door)).toBe(false);
    expect(doorCovered(ctx, door, { bringing: [{ x: 14, y: 6 }] })).toBe(true);
    expect(doorCovered(ctx, door, { sprinklers: true })).toBe(true);
    expect(sim.placeItem('fire_extinguisher', 14, 6, 0)).not.toBeNull();
    expect(doorCovered(ctx, door)).toBe(true);
    expect(doorCovered(ctx, door, { leaving: massage.id })).toBe(false);
  });
});

describe('the Fire safety overlay', () => {
  it('shows for an extinguisher in hand, and stays chosen whatever is in hand', () => {
    const { sim } = openCenter(1);
    expect(previewMode(sim.previewItem({ type: 'fire_extinguisher', x: 13, y: 10, rot: 0 }), null)).toBe('fire');
    expect(previewMode(sim.previewItem({ type: 'fire_extinguisher', x: 13, y: 10, rot: 0 }), 'calm')).toBe('fire');
    expect(previewMode(sim.previewItem({ type: 'plant', x: 13, y: 10, rot: 0 }), 'fire')).toBe('fire');
  });

  it('colors each room by its cover, and the floor an extinguisher reaches faintly', () => {
    const { sim, massage } = openCenter(1);
    const staff = addStaffRoom(sim);
    expect(sim.placeItem('fire_extinguisher', 13, 10, 0)).not.toBeNull();
    const tiles = new Map(fireTiles(sim).map(([x, y, v]) => [`${x},${y}`, v]));
    expect(tiles.get(`${massage.x + 1},${massage.y + 1}`)).toBe(1);
    // the Staff Room's door is 8 tiles from it, so it is covered too
    expect(tiles.get(`${staff.x},${staff.y}`)).toBe(1);
    // the corridor beside it is within reach, faintly good; far off it is left clear
    const near = tiles.get('13,11') ?? 0.5;
    expect(near).toBeGreaterThan(0.5);
    expect(near).toBeLessThan(1);
    expect(tiles.has(`${13 + EXTINGUISHER_REACH + 1},11`)).toBe(false);
  });

  it('counts one in hand where it is held, and one being moved not where it stands', () => {
    const { sim, massage } = openCenter(1);
    const ext = sim.placeItem('fire_extinguisher', 13, 10, 0);
    if (!ext) throw new Error('no extinguisher');
    /** How the middle of the Massage Suite shows, with an extinguisher held somewhere or none. */
    const inMassage = (held?: Parameters<typeof fireTiles>[1]) =>
      new Map(fireTiles(sim, held).map(([x, y, v]) => [`${x},${y}`, v])).get(`${massage.x + 1},${massage.y + 1}`);
    expect(inMassage()).toBe(1);
    expect(inMassage({ x: 30, y: 12, moving: ext.id })).toBe(0);
  });
});

describe('fire cover in words', () => {
  it('names the rooms an extinguisher would cover, and counts what is left', () => {
    const { sim, s, consult, massage } = openCenter(1);
    const note = { kind: 'extinguisher' as const, gains: [consult.id, massage.id], losses: [], left: 1, rooms: 3 };
    expect(fireEffects(s.rooms, note).map((e) => [e.text, e.tone])).toEqual([
      ['Covers the Consultation Room and the Massage Suite', 'good'],
      ['1 room still with none', 'bad'],
    ]);
    const restroom = addRestroom(sim);
    const staff = addStaffRoom(sim);
    expect(roomList(s.rooms, [consult.id, massage.id, restroom.id, staff.id])).toBe(
      'the Consultation Room, the Massage Suite, the Restroom and 1 more',
    );
    expect(
      fireEffects(s.rooms, { kind: 'extinguisher', gains: [], losses: [massage.id], left: 0, rooms: 2 }).map(
        (e) => e.text,
      ),
    ).toEqual(['Leaves the Massage Suite with none', 'Every room has one near its door']);
    expect(fireEffects(s.rooms, { kind: 'extinguisher', gains: [], losses: [], left: 2, rooms: 2 })[0]?.text).toBe(
      'Covers no room without one',
    );
    // with no room built there is nothing to say
    expect(fireEffects([], { kind: 'extinguisher', gains: [], losses: [], left: 0, rooms: 0 })).toEqual([]);
  });

  it('says whether a door has one near it, and what having none costs', () => {
    expect(fireEffects([], { kind: 'door', covered: true, machine: false })[0]?.tone).toBe('good');
    expect(fireEffects([], { kind: 'door', covered: false, machine: false })[0]?.text).toBe(
      'No Fire Extinguisher near the door: the health inspector fines that',
    );
    expect(fireEffects([], { kind: 'door', covered: false, machine: true })[0]?.text).toBe(
      'No Fire Extinguisher near the door: a fire here would spread',
    );
  });

  it('outlines the edge of the reach once round', () => {
    const edge = reachEdge(0, 0, 2);
    expect(edge).toHaveLength(16);
    expect(new Set(edge.map(([x, y]) => `${x},${y}`)).size).toBe(16);
    expect(edge.every(([x, y]) => Math.max(Math.abs(x), Math.abs(y)) === 2)).toBe(true);
  });
});
