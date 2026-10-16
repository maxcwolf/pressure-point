// How comfortable the building is: noise and calm, fresh linens on the tables, the temperature through the seasons,
// and staff who get thirsty and hungry.
import { describe, expect, it } from 'vitest';

import {
  CENTERS,
  COMFORT_BAND,
  DIRT_CLEAN,
  DISCOMFORT_SPAN,
  HAMPER_LAUNDER,
  HAMPER_SIZE,
  IDEAL_TEMP,
  INDOOR_PULL,
  ITEMS,
  LINENS_PENALTY,
  MAX_LEAK,
  NOISE_LOUD,
  NOISE_PENALTY,
  OUTBREAK_STARS,
  STAFF_NEED_MORALE,
  WALL_DAMPING,
  WINDOW_LEAK,
  WORN_HEAT,
} from '../../src/core/data';
import { decorOf } from '../../src/core/sim/ambience';
import { createContext } from '../../src/core/sim/context';
import { changeLinens, hamperWithRoom, linensPenalty, staleLinens, useLinens } from '../../src/core/sim/linens';
import { calmness, feelNoise, noiseLeak, noisePenalty } from '../../src/core/sim/noise';
import { updateOutbreak } from '../../src/core/sim/outbreaks';
import { growNeeds, wants } from '../../src/core/sim/staff-needs';

/** A member of staff not on a break, or on one with nothing to eat or drink. */
const NO_BREAK_ROOM = { espresso: false, fridge: false };
import { moraleTarget } from '../../src/core/sim/staffing';
import {
  discomfort,
  feelTemperature,
  hotness,
  indoorTemp,
  itemHeat,
  outdoorTemp,
  seasonal,
  tempFeel,
  tempScale,
  updateWarmth,
  warmthAt,
} from '../../src/core/sim/warmth';
import { SAVE_VERSION } from '../../src/core/state/game';
import type { GameState, Guest, Room } from '../../src/core/state/types';
import { upgradeSave } from '../../src/core/state/upgrade';
import { addStaffRoom, hire, inconsistencies, openCenter, run, runUntil } from './helpers';

/** A guest who has just arrived, for checking what they feel. */
const guest = () => ({ feelings: [] }) as unknown as Guest;

/** A room with this many windows, for checking how much gets through its walls. */
const withWindows = (n: number) => ({ windows: Array.from({ length: n }) }) as unknown as Room;

/** Day of the year in the middle of a month, counted from January. */
const midMonth = (month: number) => month * 30 + 15;

describe('calm', () => {
  it('is kept by a room’s walls, less so the more windows it has', () => {
    expect(noiseLeak(withWindows(0))).toBeCloseTo(WALL_DAMPING);
    expect(noiseLeak(withWindows(2))).toBeCloseTo(WALL_DAMPING + 2 * WINDOW_LEAK);
    expect(noiseLeak(withWindows(20))).toBeCloseTo(MAX_LEAK);
  });

  it('is broken by an arcade, much less behind a room’s walls than out in the corridor', () => {
    const { sim } = openCenter(1);
    sim.refreshAmbience();
    const quiet = sim.noiseAt(12, 7);
    expect(sim.placeItem('arcade_machine', 13, 10, 0)).toBeTruthy();
    sim.refreshAmbience();
    // the same distance from the arcade, once through the Massage Suite's wall and once along the corridor
    const inside = sim.noiseAt(13, 8) - quiet;
    const outside = sim.noiseAt(11, 10);
    expect(inside).toBeGreaterThan(0);
    expect(inside).toBeLessThan(outside * 0.5);
  });

  it('takes more off a treatment the noisier it gets, up to a point', () => {
    expect(noisePenalty(0)).toBe(0);
    expect(noisePenalty(NOISE_LOUD / 2)).toBeCloseTo(NOISE_PENALTY / 2);
    expect(noisePenalty(NOISE_LOUD * 3)).toBeCloseTo(NOISE_PENALTY);
    expect(calmness(0)).toBe(1);
    expect(calmness(NOISE_LOUD)).toBe(0);
  });

  it('lowers the chance a treatment works when the corridor outside is loud', () => {
    const { sim, s } = openCenter(1);
    runUntil(sim, () => s.guests.some((g) => sim.chanceFor(g)), 600);
    const g = s.guests.find((x) => sim.chanceFor(x))!;
    const before = sim.chanceFor(g)!.chance;
    for (const x of [10, 11, 13, 14]) expect(sim.placeItem('arcade_machine', x, 10, 0)).toBeTruthy();
    sim.refreshAmbience();
    expect(sim.chanceFor(g)!.chance).toBeLessThan(before);
  });

  it('is noticed by a guest on the table, for better or worse', () => {
    const loud = guest();
    feelNoise(loud, 5);
    expect(loud.feelings).toContain('noisy');
    const hushed = guest();
    feelNoise(hushed, 0);
    expect(hushed.feelings).toContain('peaceful');
  });
});

describe('fresh linens', () => {
  it('are soiled a little by each session, and stale ones are noticed and lower results', () => {
    const { s } = openCenter(1);
    const ctx = createContext(s);
    const table = s.items.find((i) => i.type === 'massage_table')!;
    const g = guest();
    useLinens(ctx, table, g);
    expect(table.dirt).toBe(ITEMS.massage_table.dirt);
    expect(g.feelings).not.toContain('stale-linens');
    table.dirt = 90;
    expect(staleLinens(table)).toBe(true);
    useLinens(ctx, table, g);
    expect(g.feelings).toContain('stale-linens');
    expect(linensPenalty({ ...table, dirt: DIRT_CLEAN })).toBe(0);
    expect(linensPenalty({ ...table, dirt: 100 })).toBeCloseTo(LINENS_PENALTY);
  });

  it('do not spoil the room the way a filthy toilet does', () => {
    const { s } = openCenter(1);
    const table = s.items.find((i) => i.type === 'massage_table')!;
    table.dirt = 100;
    expect(decorOf(table)).toBe(0);
  });

  it('are changed by a Caretaker only once there is a hamper to change them from', () => {
    const { sim, s } = openCenter(1);
    hire(sim, 'caretaker');
    const table = s.items.find((i) => i.type === 'massage_table')!;
    table.dirt = 80;
    run(sim, 30);
    expect(table.dirt).toBeGreaterThanOrEqual(80);
    const hamper = sim.placeItem('linen_hamper', 16, 10, 0)!;
    expect(hamper.water).toBe(0);
    runUntil(sim, () => table.dirt < DIRT_CLEAN, 120);
    expect(hamper.water).toBe(1);
    expect(inconsistencies(sim)).toEqual([]);
  });

  it('cannot be changed when every hamper is full, until a Caretaker launders one', () => {
    const { sim, s } = openCenter(1);
    const ctx = createContext(s);
    const table = s.items.find((i) => i.type === 'massage_table')!;
    const hamper = sim.placeItem('linen_hamper', 16, 10, 0)!;
    hamper.water = HAMPER_SIZE;
    table.dirt = 80;
    expect(hamperWithRoom(ctx)).toBeUndefined();
    expect(changeLinens(ctx, table)).toBe(false);
    expect(table.dirt).toBe(80);
    hire(sim, 'caretaker');
    runUntil(sim, () => hamper.water < HAMPER_LAUNDER, 120);
    runUntil(sim, () => table.dirt < DIRT_CLEAN, 120);
    expect(inconsistencies(sim)).toEqual([]);
  });
});

describe('temperature', () => {
  it('follows the seasons outside, and only some of that gets indoors', () => {
    expect(seasonal(midMonth(6))).toBeCloseTo(1);
    expect(seasonal(midMonth(0))).toBeCloseTo(-1);
    const climate = CENTERS.boardwalk.climate;
    expect(outdoorTemp(climate, midMonth(6))).toBeCloseTo(climate.average + climate.swing);
    expect(indoorTemp(IDEAL_TEMP + 20)).toBeCloseTo(IDEAL_TEMP + 20 * INDOOR_PULL);
  });

  it('is fine anywhere near just right, and as bad as it gets well past it', () => {
    expect(discomfort(IDEAL_TEMP + COMFORT_BAND)).toBe(0);
    expect(discomfort(IDEAL_TEMP - COMFORT_BAND - DISCOMFORT_SPAN)).toBe(1);
    expect(hotness(IDEAL_TEMP - 30)).toBe(0);
    expect(tempScale(IDEAL_TEMP)).toBe(0.5);
    expect(tempScale(IDEAL_TEMP - 40)).toBe(0);
    expect(tempScale(IDEAL_TEMP + 40)).toBe(1);
    expect(tempFeel(IDEAL_TEMP)).toBe('Just right');
    const cold = guest();
    feelTemperature(cold, IDEAL_TEMP - 20);
    expect(cold.feelings).toContain('too-cold');
    const hot = guest();
    feelTemperature(hot, IDEAL_TEMP + 20);
    expect(hot.feelings).toContain('too-hot');
  });

  it('is raised by a radiator, more in its own room than through the walls', () => {
    const { sim, s } = openCenter(1);
    const ctx = createContext(s);
    updateWarmth(ctx);
    const base = warmthAt(ctx, 13, 7);
    expect(sim.placeItem('radiator', 13, 10, 0)).toBeTruthy();
    updateWarmth(ctx);
    const corridor = warmthAt(ctx, 11, 10) - base;
    const suite = warmthAt(ctx, 13, 8) - base;
    expect(corridor).toBeGreaterThan(0);
    expect(suite).toBeGreaterThan(0);
    expect(suite).toBeLessThan(corridor);
  });

  it('comes from worn equipment, and not from a broken radiator', () => {
    const { s } = openCenter(1);
    const table = s.items.find((i) => i.type === 'massage_table')!;
    expect(itemHeat(table)).toBe(0);
    table.wear = 60;
    expect(itemHeat(table)).toBe(WORN_HEAT);
    const radiator = { ...table, type: 'radiator' as const, wear: 0 };
    expect(itemHeat(radiator)).toBe(ITEMS.radiator.heat);
    expect(itemHeat({ ...radiator, wear: 100 })).toBe(0);
  });

  it('is just right everywhere with the weather switched off', () => {
    const { sim, s } = openCenter(1);
    sim.placeItem('radiator', 13, 10, 0);
    s.weatherOn = false;
    const ctx = createContext(s);
    updateWarmth(ctx);
    expect(warmthAt(ctx, 13, 10)).toBe(IDEAL_TEMP);
  });

  it('leaves a guest treated beside an air conditioner in winter feeling the cold', () => {
    const { sim, s } = openCenter(1);
    expect(sim.placeItem('air_conditioner', 14, 7, 0)).toBeTruthy();
    runUntil(sim, () => s.guests.some((g) => g.feelings.includes('too-cold')), 300);
  });
});

describe('staff needs', () => {
  it('grow with time, and thirst faster in the heat', () => {
    const { s, therapist } = openCenter(1);
    const ctx = createContext(s);
    growNeeds(ctx, therapist, 10, NO_BREAK_ROOM);
    const mild = therapist.thirst;
    expect(mild).toBeGreaterThan(0);
    expect(therapist.hunger).toBeGreaterThan(0);
    expect(wants(therapist)).toBeNull();
    therapist.thirst = 0;
    ctx.warmth.fill(IDEAL_TEMP + 30);
    growNeeds(ctx, therapist, 10, NO_BREAK_ROOM);
    expect(therapist.thirst).toBeGreaterThan(mild * 1.5);
  });

  it('send someone free for a drink, and back to work after', () => {
    const { sim, therapist } = openCenter(1);
    sim.placeItem('water_cooler', 16, 10, 0);
    runUntil(sim, () => therapist.state === 'atPost', 60);
    therapist.thirst = 70;
    expect(wants(therapist)).toBe('drink');
    runUntil(sim, () => therapist.thirst < 5, 200);
    runUntil(sim, () => therapist.state === 'atPost', 120);
    expect(inconsistencies(sim)).toEqual([]);
  });

  it('are seen to by an espresso on a break', () => {
    const { s, therapist } = openCenter(1);
    const ctx = createContext(s);
    therapist.thirst = 80;
    therapist.state = 'onBreak';
    growNeeds(ctx, therapist, 2, { espresso: true, fridge: false });
    expect(therapist.thirst).toBeLessThan(80);
  });

  it('are seen to by a Staff Fridge on a break, hunger and thirst both', () => {
    const { s, therapist } = openCenter(1);
    const ctx = createContext(s);
    therapist.thirst = 80;
    therapist.hunger = 80;
    therapist.state = 'onBreak';
    growNeeds(ctx, therapist, 2, { espresso: false, fridge: true });
    expect(therapist.thirst).toBeLessThan(80);
    expect(therapist.hunger).toBeLessThan(80);
  });

  it('wear down morale when left unmet', () => {
    const { sim, s, therapist } = openCenter(1);
    addStaffRoom(sim);
    const ctx = createContext(s);
    const content = moraleTarget(ctx, therapist);
    therapist.thirst = 100;
    expect(moraleTarget(ctx, therapist)).toBeCloseTo(content - STAFF_NEED_MORALE);
  });
});

describe('sandbox switches', () => {
  it('keep stress outbreaks from being offered', () => {
    const { s } = openCenter(1);
    s.stars = OUTBREAK_STARS;
    s.open = true;
    s.day = s.nextOutbreak;
    s.outbreaksOn = false;
    updateOutbreak(createContext(s));
    expect(s.outbreakOffer).toBeNull();
    s.outbreaksOn = true;
    updateOutbreak(createContext(s));
    expect(s.outbreakOffer).not.toBeNull();
  });
});

describe('a save from before comfort', () => {
  it('gets staff who want for nothing, and outbreaks and weather switched on', () => {
    const { sim, s } = openCenter(2);
    run(sim, 30);
    const old = JSON.parse(JSON.stringify(s)) as Record<string, any>;
    old.version = 10;
    for (const k of ['outbreaksOn', 'weatherOn']) Reflect.deleteProperty(old, k);
    for (const st of old.staff) {
      delete st.thirst;
      delete st.hunger;
    }
    upgradeSave(old as GameState);
    const up = old as GameState;
    expect(up.version).toBe(SAVE_VERSION);
    expect(up.outbreaksOn).toBe(true);
    expect(up.weatherOn).toBe(true);
    for (const st of up.staff) expect([st.thirst, st.hunger]).toEqual([0, 0]);
  });
});

describe('a save from before the Caretaker', () => {
  it('keeps a Janitor of the Year trophy, as Caretaker of the Year', () => {
    const { s } = openCenter(2);
    const old = JSON.parse(JSON.stringify(s)) as Record<string, any>;
    old.version = 10;
    old.trophies = [{ award: 'janitor-of-the-year', year: 1 }];
    old.ceremony = { year: 1, results: [{ award: 'janitor-of-the-year', won: true, note: 'Ines Loosely' }] };
    upgradeSave(old as GameState);
    const up = old as GameState;
    expect(up.trophies.map((t) => t.award)).toEqual(['caretaker-of-the-year']);
    expect(up.ceremony?.results.map((r) => r.award)).toEqual(['caretaker-of-the-year']);
  });
});
