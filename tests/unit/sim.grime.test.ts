// Toilets get grubby with use, put guests off when filthy, and Caretakers clean them.
import { describe, expect, it } from 'vitest';

import { DIRT_CLEAN, DIRT_FILTHY, FILTHY_DECOR, FILTHY_PATIENCE, ITEMS, PLAY_PATIENCE } from '../../src/core/data';
import { decorOf } from '../../src/core/sim/ambience';
import { needRelief } from '../../src/core/sim/guests';
import { jobSeconds } from '../../src/core/sim/staffing';
import { dirtier } from '../../src/core/sim/upkeep';
import { newGame } from '../../src/core/state/game';
import type { GameState, Item } from '../../src/core/state/types';
import { upgradeSave } from '../../src/core/state/upgrade';
import { staffStatus } from '../../src/ui/lib/status';
import { addRestroom, addStaffRoom, hire, openCenter, runUntil } from './helpers';

/** A toilet with this much grime. */
const toilet = (dirt: number) => ({ type: 'toilet', dirt, water: 100 }) as Item;

describe('grime', () => {
  it('builds up with each use of a toilet, up to filthy, and not on things that stay clean', () => {
    const add = ITEMS.toilet.dirt ?? 0;
    expect(add).toBeGreaterThan(0);
    expect(dirtier('toilet', 0)).toBe(add);
    expect(dirtier('toilet', 95)).toBe(100);
    expect(dirtier('sink', 30)).toBe(30);
  });

  it('turns a filthy toilet into a blot on its surroundings', () => {
    expect(decorOf(toilet(0))).toBe(0);
    expect(decorOf(toilet(DIRT_FILTHY - 1))).toBe(0);
    expect(decorOf(toilet(DIRT_FILTHY))).toBe(FILTHY_DECOR);
  });

  it('costs a guest patience at a filthy toilet instead of giving it back', () => {
    expect(needRelief('toilet', 0)).toBeGreaterThan(0);
    expect(needRelief('toilet', DIRT_FILTHY)).toBe(-FILTHY_PATIENCE);
    expect(needRelief('drink', 100)).toBeGreaterThan(0);
    expect(needRelief('play', 0)).toBe(PLAY_PATIENCE);
  });

  it('takes a Caretaker longer to clean than to sweep, and less time than a repair', () => {
    expect(jobSeconds('clean')).toBeGreaterThan(jobSeconds('litter'));
    expect(jobSeconds('clean')).toBeLessThan(jobSeconds('repair'));
  });

  it('starts at nothing for toilets in saves from before grime existed', () => {
    const s = newGame();
    const old = JSON.parse(JSON.stringify(s)) as GameState;
    old.items = [{ ...toilet(0) }];
    delete (old.items[0] as Partial<Item>).dirt;
    upgradeSave(old);
    expect(old.items[0]?.dirt).toBe(0);
  });
});

describe('a toilet in play', () => {
  it('gets dirtier as guests use it', () => {
    const { sim, s, consultant } = openCenter(5);
    addRestroom(sim);
    // with nobody to see them, guests wait in line, which is when they look for a toilet
    sim.fire(consultant.id);
    const loo = s.items.find((i) => i.type === 'toilet')!;
    runUntil(sim, () => s.guests.some((g) => g.state === 'waiting'), 300);
    for (const g of s.guests) g.bladder = 100;
    runUntil(sim, () => loo.dirt > 0, 120);
    expect(loo.dirt).toBe(ITEMS.toilet.dirt);
  });

  it('gets the advisor asking for a Caretaker once it is filthy', () => {
    const { sim, s } = openCenter(2);
    addRestroom(sim);
    addStaffRoom(sim);
    s.items.find((i) => i.type === 'toilet')!.dirt = DIRT_FILTHY;
    expect(sim.advice()).toMatch(/toilets are filthy/);
  });

  it('is cleaned by a Caretaker, who says so', () => {
    const { sim, s } = openCenter(2);
    addRestroom(sim);
    const loo = s.items.find((i) => i.type === 'toilet')!;
    loo.dirt = DIRT_CLEAN;
    const caretaker = hire(sim, 'caretaker');
    runUntil(sim, () => caretaker.job?.kind === 'clean', 120);
    expect(staffStatus(caretaker, sim)).toBe('Cleaning a toilet');
    runUntil(sim, () => loo.dirt === 0, 120);
  });
});

describe('litter something is put down on', () => {
  const SPOTS = [
    [22, 3],
    [24, 3],
    [26, 3],
    [22, 6],
  ] as const;

  it('is swept up with the change, so a Caretaker is never left trying to reach it', () => {
    const { sim, s } = openCenter(1);
    for (const [x, y] of SPOTS) s.litter.push({ id: s.nextId++, x, y, claimedBy: 0 });
    for (const [x, y] of SPOTS) expect(sim.placeItem('plant', x, y, 0), `plant at ${x},${y}`).toBeTruthy();
    expect(s.litter).toEqual([]);
    // and the Caretaker gets on with everything else
    const dry = sim.placeItem('plant', 20, 12, 0)!;
    dry.water = 10;
    hire(sim, 'caretaker');
    runUntil(sim, () => dry.water > 50, 300);
  });

  it('is swept up when furniture is moved onto it, and litter left in the open is not', () => {
    const { sim, s } = openCenter(1);
    const plant = sim.placeItem('plant', 22, 3, 0)!;
    s.litter.push({ id: s.nextId++, x: 24, y: 3, claimedBy: 0 }, { id: s.nextId++, x: 26, y: 3, claimedBy: 0 });
    expect(sim.moveItem(plant.id, 24, 3, 0)).toBe(true);
    expect(s.litter.map((l) => [l.x, l.y])).toEqual([[26, 3]]);
  });
});
