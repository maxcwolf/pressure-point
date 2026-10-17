// How much work the simulation does, counted rather than timed. Counts come out the same on any machine
// and in every run of a seeded game, so a change that has every guest find a path every step, or
// rebuilds the grid while nothing is being built, fails here instead of quietly slowing the game.
import { describe, expect, it, vi } from 'vitest';

import { placeLayout } from '../../src/core/room-layout';
import type { SimContext } from '../../src/core/sim/context';
import { spawnGuest } from '../../src/core/sim/guests';
import { addPostureLab, addRestroom, addStaffRoom, addTraining, hire, openCenter, run } from './helpers';

/** The grid's expensive questions: a route, a flood fill, a fresh grid, a check nobody is walled in. */
const COSTLY = ['findPath', 'flood', 'rebuild', 'connected', 'canPlaceItem'] as const;

/** A full, staffed center that has been open long enough to be busy. */
function busyCenter(seed: number) {
  const { sim, s } = openCenter(seed);
  addStaffRoom(sim);
  addRestroom(sim);
  addTraining(sim);
  addPostureLab(sim);
  hire(sim, 'caretaker');
  hire(sim, 'consultant');
  for (const [type, x, y] of [
    ['bench', 10, 9],
    ['bench', 16, 9],
    ['tea_station', 10, 13],
    ['snack_machine', 12, 13],
    ['plant', 4, 4],
    ['bin', 22, 10],
  ] as const)
    expect(sim.placeItem(type, x, y, 0), type).not.toBeNull();
  run(sim, 300);
  return { sim, s };
}

describe('the work a busy center takes', () => {
  it.each([1, 2, 3])('stays within its budget for each minute of play (seed %i)', (seed) => {
    const { sim } = busyCenter(seed);
    const calls = Object.fromEntries(COSTLY.map((m) => [m, vi.spyOn(sim.world, m)]));
    const minutes = 10;
    run(sim, minutes * 60);
    /** Calls to one of the grid's questions in an average minute. */
    const perMinute = (m: (typeof COSTLY)[number]) => (calls[m]?.mock.calls.length ?? 0) / minutes;
    // about 40 routes and 15 flood fills a minute when this was written: twice that leaves room for the
    // game to change, while a route every step for everyone would be thousands
    expect(perMinute('findPath')).toBeLessThan(90);
    expect(perMinute('flood')).toBeLessThan(35);
    // the grid only changes when something is built, so playing on should never rebuild or re-check it
    expect(perMinute('rebuild')).toBe(0);
    expect(perMinute('connected')).toBe(0);
    expect(perMinute('canPlaceItem')).toBe(0);
  });

  it('keeps a long line at reception from searching the floor for every guest in it', () => {
    const { sim } = busyCenter(1);
    const ctx = (sim as unknown as { ctx: SimContext }).ctx;
    /** Top the center up to a hundred guests, patient enough to stay: most of them queue for the one desk. */
    const crowd = () => {
      while (sim.s.guests.length < 100) spawnGuest(ctx);
      for (const g of sim.s.guests) g.patience = 100;
    };
    crowd();
    const flood = vi.spyOn(sim.world, 'flood');
    const minutes = 3;
    for (let i = 0; i < minutes * 6; i++) {
      crowd();
      run(sim, 10);
    }
    // where to stand only changes when something is built, so it is worked out once for each spot in line: about
    // 37 a minute when this was written, and about 3300 while every guest worked theirs out afresh
    expect(flood.mock.calls.length / minutes).toBeLessThan(80);
  });

  it('asks the build checks the player hovers with without rebuilding the grid', () => {
    const { sim, s, massage } = openCenter(1);
    const { world } = sim;
    const rebuild = vi.spyOn(world, 'rebuild');
    const connected = vi.spyOn(world, 'connected');
    const { version } = world;
    const grow = { x: massage.x, y: massage.y, w: massage.w + 1, h: massage.h };
    const checks = [
      world.canPlaceItem('bench', 16, 9, 0),
      world.doorValid('staffroom', { x: 17, y: 5, w: 3, h: 3 }, { x: 18, y: 7, dx: 0, dy: 1 }),
      world.resizeValid(massage, grow),
      world.layoutValid('massage', placeLayout(sim.roomLayout(massage), 17, 5), massage),
      world.layoutValid('massage', placeLayout(sim.roomLayout(massage), 17, 5)),
    ];
    expect(checks.map((c) => c.ok)).toEqual([true, true, true, true, true]);
    // each tried its change out on grids of its own: two rebuilds of the grid a check, three for moving a room,
    // when they tried it on the game itself
    expect(rebuild).not.toHaveBeenCalled();
    expect(connected).toHaveBeenCalledTimes(checks.length);
    expect(world.version).toBe(version);
    expect(s.rooms).toContain(massage);
  });
});
