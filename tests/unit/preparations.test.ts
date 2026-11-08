// What preparing for a storm shows: planks across the outer windows and sandbags banked at the entrances, from the day
// it is paid for until it is over, and nothing for a ward that held.
import { describe, expect, it } from 'vitest';

import { CAMPAIGN, CENTERS, ROAD_Y, SANDBOX_PLOT, TRUCK_PARK } from '../../src/core/data';
import { entranceSpan, footprintOf, inFootprint } from '../../src/core/footprint';
import { createContext } from '../../src/core/sim/context';
import { newMishap, paidFor, prepareMishap } from '../../src/core/sim/mishaps';
import type { WallSpot } from '../../src/core/state/types';
import { must } from '../../src/core/util';
import {
  BAG_D,
  BAG_ROWS,
  BAG_W,
  BAGS_LOW,
  byDoor,
  coveringOf,
  entranceBags,
  frontDoor,
  generatorSpot,
  type OuterWindow,
  outerWindows,
  PLANKS,
  preparationsShown,
  sigilSpot,
  trapSide,
  vanSpot,
  windowPlanks,
} from '../../src/render/preparations';
import { OUTER_PANE_H, OUTER_PANE_Y0, OUTER_T } from '../../src/render/shared';
import { LOW_INLAY } from '../../src/render/windows';
import { openCenter } from './helpers';

const fp = footprintOf(SANDBOX_PLOT);
/** A window in the north wall, whose inside face is the line y = 3, two tiles wide. */
const north: OuterWindow = { side: 'north', horizontal: true, line: 3, a: 6, b: 8 };
/** A stretch of wall seen from the tile inside it. */
const spot = (x: number, y: number, dx: number, dy: number): WallSpot => ({ x, y, dx, dy });

describe('which windows are boarded up', () => {
  it("are the building's own, and a room's own along the outer wall, but not those looking inside", () => {
    const room = {
      done: true,
      // two side by side in the north wall, which is the building's, and one onto the corridor below the room
      windows: [spot(10, 3, 0, -1), spot(11, 3, 0, -1), spot(10, 6, 0, 1)],
    };
    const blueprint = { done: false, windows: [spot(20, 3, 0, -1)] };
    expect(outerWindows(fp, [room, blueprint], [north])).toEqual([
      north,
      { side: 'north', horizontal: true, line: 3, a: 10, b: 12 },
    ]);
  });
});

describe('the planks over a window', () => {
  it('standing tall, run across it in front of its frame, on the face the camera sees', () => {
    const planks = windowPlanks(north, true);
    expect(planks).toHaveLength(PLANKS);
    for (const p of planks) {
      // the north wall's inside face looks south, toward +z, and the frame stands 6 cm out from it
      expect(p.across - p.deep / 2).toBeGreaterThan(north.line + 0.06);
      expect(p.len).toBeGreaterThan(north.b - north.a);
      expect(Math.abs(p.tilt)).toBeLessThanOrEqual(0.05);
      expect(p.y).toBeGreaterThan(OUTER_PANE_Y0);
      expect(p.y).toBeLessThan(OUTER_PANE_Y0 + OUTER_PANE_H);
    }
    // covering most of the glass, top to bottom
    const covered = planks.reduce((n, p) => n + p.h, 0);
    expect(covered / OUTER_PANE_H).toBeGreaterThan(0.6);
  });

  it('take a set for each stretch two tiles wide, as sheets would', () => {
    const wide = windowPlanks({ ...north, b: north.a + 5 }, true);
    expect(wide).toHaveLength(3 * PLANKS);
    expect(new Set(wide.map((p) => Math.round(p.along * 2) / 2))).toEqual(new Set([7, 9, 10.5]));
  });

  it('cut low, lie along the top of the stub, over its strip of glass', () => {
    const south: OuterWindow = { side: 'south', horizontal: true, line: 18, a: 6, b: 8 };
    const planks = windowPlanks(south, false);
    expect(planks).toHaveLength(1);
    const plank = must(planks[0], 'plank');
    expect(plank.y - plank.h / 2).toBeCloseTo(LOW_INLAY.building.y0);
    // over the bars, which stand a centimeter above the glass
    expect(plank.y + plank.h / 2).toBeGreaterThan(LOW_INLAY.building.y0 + LOW_INLAY.building.h + 0.01);
    expect(plank.across).toBeCloseTo(south.line + OUTER_T / 2);
    expect(plank.tilt).toBe(0);
  });
});

describe('the sandbags at an entrance', () => {
  it('bank either side of it outside, clear of the doorway and its pillars', () => {
    const bags = entranceBags(fp);
    // four, three and two in each bank
    expect(bags).toHaveLength(fp.entrances.length * 2 * (BAGS_LOW * BAG_ROWS - (BAG_ROWS * (BAG_ROWS - 1)) / 2));
    const { line, a, b } = entranceSpan(must(fp.entrances[0], 'entrance'));
    const mid = (a + b) / 2;
    for (const bag of bags) {
      // outside the south wall's outer face
      expect(bag.z - BAG_D / 2).toBeGreaterThan(line + OUTER_T);
      // past the pillar, a third of a meter wide, at each side of the doorway
      expect(Math.abs(bag.x - mid) - BAG_W / 2).toBeGreaterThan((b - a) / 2 + 0.33);
    }
    expect(bags.filter((g) => g.x < mid)).toHaveLength(bags.length / 2);
  });
});

describe('what shows a mishap was prepared for', () => {
  it('is the storm, once paid for', () => {
    const c = openCenter(1);
    const ctx = createContext(c.s);
    expect(paidFor(c.s)).toBeUndefined();
    c.s.mishap = newMishap(c.s.day, 'storm');
    expect(paidFor(c.s)).toBeUndefined();
    c.s.money = 1e6;
    expect(prepareMishap(ctx)).toBe(true);
    expect(paidFor(c.s)).toBe('storm');
    c.s.mishap.started = true;
    expect(paidFor(c.s), 'through the storm').toBe('storm');
  });

  it('is nothing for a ward that held', () => {
    const c = openCenter(1);
    c.s.mishap = { ...newMishap(c.s.day, 'storm'), ward: 'done', prepared: true, started: true };
    expect(paidFor(c.s)).toBeUndefined();
  });

  it('in a save from before it was kept, is a mishap prepared for with no ward asked', () => {
    const c = openCenter(1);
    c.s.mishap = { ...newMishap(c.s.day, 'storm'), prepared: true };
    expect(paidFor(c.s)).toBe('storm');
  });
});

describe('what preparing puts on the things a mishap would stop', () => {
  it('is lagging on pipes and a tarp on the koi pond for a freeze, traps and mesh lids for wasps', () => {
    expect(coveringOf('freeze', 'toilet')).toBe('lagging');
    expect(coveringOf('freeze', 'radiator')).toBe('lagging');
    expect(coveringOf('freeze', 'koi_pond')).toBe('tarp');
    expect(coveringOf('wasps', 'snack_machine')).toBe('trap');
    expect(coveringOf('wasps', 'bin')).toBe('lid');
  });

  it('is nothing on what the mishap leaves alone, or for a mishap that covers nothing', () => {
    expect(coveringOf('freeze', 'snack_machine')).toBeUndefined();
    expect(coveringOf('wasps', 'toilet')).toBeUndefined();
    expect(coveringOf('power', 'coffee_machine')).toBeUndefined();
    expect(coveringOf('storm', 'aura_wash')).toBeUndefined();
  });
});

describe('the side a wasp trap stands', () => {
  const machine = { type: 'snack_machine' as const, x: 5, y: 5, rot: 0 };
  it("is the item's right where that tile is free, else its left, else on its own tile", () => {
    expect(trapSide(machine, () => true)).toBe(1);
    expect(trapSide(machine, (x) => x !== 6)).toBe(-1);
    expect(trapSide(machine, () => false)).toBe(0);
  });

  it('turns with the item: turned round, its right is the other way', () => {
    expect(trapSide({ ...machine, rot: 2 }, (x, y) => x === 4 && y === 5)).toBe(1);
    expect(trapSide({ ...machine, rot: 1 }, (x, y) => x === 5 && y === 6)).toBe(1);
  });
});

describe('where the pieces stand in each campaign center', () => {
  for (const id of CAMPAIGN) {
    const center = footprintOf(CENTERS[id].plot);
    const d = frontDoor(center);

    it(`${id}: the hired generator is outside, past the pillar, clear of the road`, () => {
      const gen = generatorSpot(d);
      // its door end, with the socket, 0.69 m from its middle, and its wheels half a meter either side
      expect(gen.along - 0.69).toBeGreaterThan(d.b + 0.33);
      expect(gen.out - 0.53).toBeGreaterThan(OUTER_T);
      const [, , z] = byDoor(d, gen.along, gen.out + 0.53);
      expect(z).toBeLessThan(ROAD_Y[0]);
    });

    it(`${id}: the van is in the near lane, clear of where the fire engine parks`, () => {
      const van = vanSpot(center.door);
      expect(van.z).toBeGreaterThan(ROAD_Y[0]);
      expect(van.z).toBeLessThan(ROAD_Y[0] + 1);
      // the van is 2.6 m long and the fire engine about as long
      expect(van.x - (center.door[0] - TRUCK_PARK)).toBeGreaterThan(3);
    });

    it(`${id}: the ward's sigil is inside, in front of the doorway`, () => {
      const spot = sigilSpot(d);
      const [x, , z] = byDoor(d, spot.along, spot.out);
      expect(inFootprint(center, Math.floor(x), Math.floor(z))).toBe(true);
      expect(spot.along).toBeGreaterThan(d.a);
      expect(spot.along).toBeLessThan(d.b);
    });
  }
});

describe("what a Shaman's ward shows", () => {
  it('is nothing while only asked for, the sigil once performed, and smeared once it has failed', () => {
    const c = openCenter(1);
    const base = newMishap(c.s.day, 'wasps');
    c.s.mishap = { ...base, ward: 'asked' };
    expect(preparationsShown(c.s).ward).toBeUndefined();
    c.s.mishap = { ...base, ward: 'done' };
    expect(preparationsShown(c.s).ward).toBe('held');
    c.s.mishap = { ...base, ward: 'done', started: true, prepared: true };
    expect(preparationsShown(c.s)).toEqual({ paid: undefined, ward: 'held' });
    c.s.mishap = { ...base, ward: 'done', started: true };
    expect(preparationsShown(c.s).ward).toBe('smeared');
  });
});
