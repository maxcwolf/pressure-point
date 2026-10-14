// How much work the simulation does, counted rather than timed. Counts come out the same on any machine
// and in every run of a seeded game, so a change that has every guest find a path every step, or
// rebuilds the grid while nothing is being built, fails here instead of quietly slowing the game.
import { describe, expect, it, vi } from 'vitest';

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
});
