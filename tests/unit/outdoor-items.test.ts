// Items out of doors, and the first of them, the Generator: placed on the center's own grounds, off the paths and the
// street, kept by a Caretaker from the paving beside it, and keeping the power on through a power cut.
import { describe, expect, it } from 'vitest';

import { RUMBLE_REACH, rumbleLevel } from '../../src/app/rumble';
import { BACK_ROWS, onGrounds } from '../../src/core/build-rules';
import { ITEMS, MISHAPS, SIDEWALK_Y } from '../../src/core/data';
import { createContext } from '../../src/core/sim/context';
import { drainEvents } from '../../src/core/sim/events';
import { mishapCovered, mishapStopping, newMishap, updateMishaps } from '../../src/core/sim/mishaps';
import { Sim } from '../../src/core/sim/sim';
import { wearByTheDay } from '../../src/core/sim/upkeep';
import type { GameState } from '../../src/core/state/types';
import { upgradeSave } from '../../src/core/state/upgrade';
import { footprint, itemCenter } from '../../src/core/world';
import { animateCues } from '../../src/render/item-cues';
import { lightLevel, POWER_CUT_LIGHT } from '../../src/render/lighting';
import { buildItem } from '../../src/render/models/items';
import { partsOf } from '../../src/render/models/parts';
import { signSpot } from '../../src/render/sign';
import { itemOffered, placeFilters, placeLabel } from '../../src/ui/lib/catalog';
import { mishapLine } from '../../src/ui/lib/mishaps';
import { freshSim, hire, openCenter, runUntil, toasts } from './helpers';

// The sandbox: its building runs from x 3 to 27 and y 3 to 17, with the front door at x 14 and 15, so rows 18 and 19
// are the front lawn, and the pavement is row 20.

/** A spot on the front lawn, against the pavement and clear of the path, the sign and the plots. */
const BY_PAVEMENT = { x: 20, y: 19 };

/** Why a generator cannot stand at a spot, or '' if it can. */
const refusal = (sim: Sim, x: number, y: number, rot = 0) => sim.world.canPlaceItem('generator', x, y, rot).reason;

describe('where something outdoors can stand', () => {
  it('is the front lawn, beside the pavement', () => {
    const sim = freshSim();
    expect(refusal(sim, BY_PAVEMENT.x, BY_PAVEMENT.y)).toBe('');
    const money = sim.s.money;
    const gen = sim.placeItem('generator', BY_PAVEMENT.x, BY_PAVEMENT.y, 0);
    expect(gen).toBeTruthy();
    expect(sim.s.money).toBe(money - ITEMS.generator.cost);
    expect(sim.world.inside(gen!.x, gen!.y)).toBe(false);
  });

  it('is never inside the building, nor in a room', () => {
    const sim = freshSim();
    expect(refusal(sim, 20, 10)).toBe('Goes outdoors, not inside');
    expect(sim.world.canPlaceItem('generator', BY_PAVEMENT.x, BY_PAVEMENT.y, 0, 7).ok).toBe(false);
  });

  it('is off the street, the path to the door, the sign and the lamps by the entrance', () => {
    const sim = freshSim();
    expect(refusal(sim, 20, SIDEWALK_Y)).toBe('Keep it off the street');
    expect(refusal(sim, 14, 19)).toBe('Keep it off the paths');
    expect(refusal(sim, 13, 19)).toBe('Keep it off the paths');
    expect(refusal(sim, 9, 19)).toBe('The sign stands there');
    expect(refusal(sim, 16, 18)).toBe('Too close to the entrance');
    expect(refusal(sim, 12, 18)).toBe('Too close to the entrance');
  });

  it('keeps clear of the sign wherever it stands, and of the edges of the lot', () => {
    const sim = freshSim();
    const fp = sim.world.building;
    const spot = signSpot(fp);
    // the sign's legs and the ends of its board are on tiles kept clear of it
    for (const along of [-1.6, -1.3, 1.3, 1.6]) {
      const x = Math.floor(spot.x + Math.cos(spot.angle) * along);
      const y = Math.floor(spot.z - Math.sin(spot.angle) * along);
      expect(onGrounds(sim.world, x, y).reason, `${x},${y}`).toBe('The sign stands there');
    }
    expect(onGrounds(sim.world, 0, 10).ok).toBe(false);
    expect(onGrounds(sim.world, sim.world.w - 1, 10).ok).toBe(false);
    expect(onGrounds(sim.world, 1, BACK_ROWS - 1).ok).toBe(false);
  });

  it('is on no plot that is not yours yet, nor on the path one will have', () => {
    const sim = freshSim();
    // the east wing, for sale from the start
    expect(refusal(sim, 30, 16)).toBe('That land is not yours yet');
    // the garden pavilion's path to the pavement, though the pavilion is not yet for sale
    expect(refusal(sim, 39, 19)).toBe('That land is not yours yet');
    sim.s.money = 1e6;
    expect(sim.buyPlot('east-wing')).toBe(true);
    expect(refusal(sim, 30, 16)).toBe('The builders are at work there');
  });

  it('has a path or the pavement beside it for a Caretaker, since nobody walks on the grass', () => {
    const sim = freshSim();
    // between the building's west wall and the edge of the lot, behind the west annex, standing on end
    expect(onGrounds(sim.world, 1, 3).ok).toBe(true);
    expect(refusal(sim, 1, 3, 1)).toBe('Needs a path or the pavement beside it, for a Caretaker');
  });

  it('is never where an indoor item can go', () => {
    const sim = freshSim();
    expect(sim.world.canPlaceItem('bench', BY_PAVEMENT.x, BY_PAVEMENT.y, 0).reason).toBe('Must be inside the building');
  });

  it('leaves every entrance and everything inside reachable, wherever it fits', () => {
    const sim = openCenter().sim;
    sim.s.money = 1e6;
    let fits = 0;
    for (let y = 0; y < sim.world.h; y++)
      for (let x = 0; x < sim.world.w; x++)
        for (const rot of [0, 1]) {
          if (!sim.world.canPlaceItem('generator', x, y, rot).ok) continue;
          fits++;
          const gen = sim.placeItem('generator', x, y, rot)!;
          for (const [tx, ty] of footprint(gen)) expect(sim.world.inside(tx, ty)).toBe(false);
          expect(sim.world.connected(), `${x},${y}`).toBe(true);
          sim.sellItem(gen.id);
        }
    expect(fits).toBeGreaterThan(10);
  });
});

describe('something outdoors in play', () => {
  it('is kept through a save', () => {
    const sim = freshSim();
    const gen = sim.placeItem('generator', BY_PAVEMENT.x, BY_PAVEMENT.y, 0)!;
    const saved = JSON.parse(JSON.stringify(sim.s)) as GameState;
    upgradeSave(saved);
    const back = new Sim(saved);
    expect(back.world.itemAt(BY_PAVEMENT.x + 1, BY_PAVEMENT.y)?.id).toBe(gen.id);
    expect(back.world.canPlaceItem('generator', BY_PAVEMENT.x, BY_PAVEMENT.y, 0).reason).toBe(
      'Something is in the way',
    );
  });

  it('moves along the grounds, never indoors, and sells as anything else does', () => {
    const sim = freshSim();
    const gen = sim.placeItem('generator', BY_PAVEMENT.x, BY_PAVEMENT.y, 0)!;
    expect(sim.moveItem(gen.id, 20, 10, 0)).toBe(false);
    expect(sim.moveItem(gen.id, 23, 19, 0)).toBe(true);
    expect([gen.x, gen.y]).toEqual([23, 19]);
    const money = sim.s.money;
    sim.sellItem(gen.id);
    expect(sim.s.items).not.toContain(gen);
    expect(sim.s.money).toBeGreaterThan(money);
  });

  it('cannot be built over: a plot with something standing on it waits for it to be moved', () => {
    const sim = freshSim();
    sim.s.money = 1e6;
    const gen = sim.placeItem('generator', 36, 19, 0)!;
    // as a plot drawn since the save was made might reach under it
    gen.x = 30;
    gen.y = 17;
    sim.world.rebuild();
    sim.drain();
    expect(sim.buyPlot('east-wing')).toBe(false);
    expect(toasts(sim.drain())).toContain('Move the Generator off that land first.');
  });

  it('is listed in the Items menu as going outdoors, with a filter of its own', () => {
    expect(placeLabel(ITEMS.generator)).toBe('Outdoors');
    expect(placeFilters(['generator', 'bench'])).toEqual(['all', 'corridor', 'outdoors']);
  });

  it('is serviced by a Caretaker, who walks out to it and stands on the pavement', () => {
    const { sim, s } = openCenter();
    const caretaker = hire(sim, 'caretaker');
    const gen = sim.placeItem('generator', BY_PAVEMENT.x, BY_PAVEMENT.y, 0)!;
    gen.wear = 70;
    runUntil(sim, () => caretaker.state === 'doingJob' && caretaker.job?.id === gen.id, 400);
    expect(sim.world.inside(caretaker.tx, caretaker.ty), 'tending it from outside').toBe(false);
    runUntil(sim, () => gen.wear === 0, 60);
    expect(s.items).toContain(gen);
  });
});

describe('the Generator', () => {
  it('is offered only where power cuts come', () => {
    /** Every discipline switched on. */
    const allOn = () => true;
    expect(itemOffered(ITEMS.generator, allOn, 'power')).toBe(true);
    expect(itemOffered(ITEMS.generator, allOn, 'storm')).toBe(false);
    expect(itemOffered(ITEMS.generator, allOn)).toBe(false);
    expect(MISHAPS.power.heldOffBy).toBe('generator');
  });

  it('keeps the power on through a power cut while it stands unbroken', () => {
    const sim = freshSim();
    const s = sim.s;
    const radiator = sim.placeItem('radiator', 10, 12, 0)!;
    const gen = sim.placeItem('generator', BY_PAVEMENT.x, BY_PAVEMENT.y, 0)!;
    s.mishap = { ...newMishap(s.day, 'power'), started: true };
    expect(sim.world.usable(radiator)).toBe(true);
    expect(mishapCovered(s)).toBe(true);
    expect(mishapStopping(s)).toBeUndefined();
    expect(lightLevel(s.mishap, true)).toBe(1);
    gen.wear = 100;
    expect(sim.world.usable(radiator), 'broken down').toBe(false);
    expect(mishapCovered(s)).toBe(false);
    expect(mishapStopping(s)).toBe(MISHAPS.power);
    expect(lightLevel(s.mishap, false)).toBe(POWER_CUT_LIGHT);
  });

  it('says so when the power cut is announced, and kicks in when it starts', () => {
    const sim = freshSim();
    const s = sim.s;
    s.mishapsOn = true;
    s.open = true;
    const gen = sim.placeItem('generator', BY_PAVEMENT.x, BY_PAVEMENT.y, 0)!;
    const ctx = createContext(s);
    s.day = s.nextMishap = 100;
    updateMishaps(ctx);
    expect(toasts(drainEvents(ctx)).join(' ')).toContain('Your Generator will see you through.');
    s.mishap = null;
    gen.wear = 60;
    s.nextMishap = s.day;
    updateMishaps(ctx);
    expect(toasts(drainEvents(ctx)).join(' ')).toContain('have a Caretaker see to it');
    s.day = s.mishap!.starts;
    updateMishaps(ctx);
    expect(s.mishap!.started).toBe(true);
    expect(s.mishap!.prepared, 'nothing paid for').toBe(false);
    expect(toasts(drainEvents(ctx))).toContain('The Generator has kicked in.');
  });

  it('wears a little a day standing by, and much more for a day carrying the center through a cut', () => {
    const sim = freshSim();
    const gen = sim.placeItem('generator', BY_PAVEMENT.x, BY_PAVEMENT.y, 0)!;
    const ctx = createContext(sim.s);
    wearByTheDay(ctx);
    const standing = gen.wear;
    expect(standing).toBeGreaterThan(0);
    gen.wear = 0;
    sim.s.mishap = { ...newMishap(sim.s.day, 'power'), started: true };
    wearByTheDay(ctx);
    expect(gen.wear / standing).toBeCloseTo(ITEMS.generator.wear! / ITEMS.generator.dailyWear!);
  });

  it('burns $150 of diesel a day it carries the center, under upkeep, and nothing standing by', () => {
    const sim = freshSim();
    const s = sim.s;
    sim.placeItem('generator', BY_PAVEMENT.x, BY_PAVEMENT.y, 0);
    const ctx = createContext(s);
    const money = s.money;
    const upkeep = s.ledger.upkeep;
    wearByTheDay(ctx);
    expect(s.money, 'standing by').toBe(money);
    s.mishap = { ...newMishap(s.day, 'power'), started: true };
    drainEvents(ctx);
    wearByTheDay(ctx);
    expect(ITEMS.generator.dailyCost).toBe(150);
    expect(s.money).toBe(money - 150);
    expect(s.ledger.upkeep).toBe(upkeep + 150);
    // seen on the lawn
    expect(drainEvents(ctx)).toContainEqual(expect.objectContaining({ type: 'float', text: '-$150', kind: 'bad' }));
    // prepared for, it never kicks in
    s.mishap.prepared = true;
    wearByTheDay(ctx);
    expect(s.money).toBe(money - 150);
  });

  it('lets the power go if it breaks down partway through', () => {
    const sim = freshSim();
    const radiator = sim.placeItem('radiator', 10, 12, 0)!;
    const gen = sim.placeItem('generator', BY_PAVEMENT.x, BY_PAVEMENT.y, 0)!;
    const ctx = createContext(sim.s);
    gen.wear = 99;
    sim.s.mishap = { ...newMishap(sim.s.day, 'power'), started: true };
    expect(ctx.world.usable(radiator)).toBe(true);
    wearByTheDay(ctx);
    expect(gen.wear).toBe(100);
    expect(ctx.world.usable(radiator)).toBe(false);
  });

  it('shows in the notice instead of the offer to hire one', () => {
    const m = newMishap(0, 'power');
    expect(mishapLine(MISHAPS.power, m, 2, 'Generator')).toBe('Power cut: starts in 2 days · the Generator is ready');
    expect(mishapLine(MISHAPS.power, { ...m, started: true }, 0.5, 'Generator')).toBe(
      'Power cut: less than a day left · the Generator is on',
    );
  });

  it('rumbles only while it carries the center, louder the nearer the camera looks', () => {
    const sim = freshSim();
    const s = sim.s;
    const gen = sim.placeItem('generator', BY_PAVEMENT.x, BY_PAVEMENT.y, 0)!;
    const [x, y] = itemCenter(gen);
    expect(rumbleLevel(s, x, y), 'no power cut').toBe(0);
    s.mishap = newMishap(s.day, 'power');
    expect(rumbleLevel(s, x, y), 'standing by for one').toBe(0);
    s.mishap.started = true;
    expect(rumbleLevel(s, x, y)).toBe(1);
    expect(rumbleLevel(s, x + RUMBLE_REACH / 2, y)).toBeCloseTo(0.5);
    expect(rumbleLevel(s, x, y - RUMBLE_REACH - 1), 'out of earshot').toBe(0);
    s.mishap.prepared = true;
    expect(rumbleLevel(s, x, y), 'prepared for, so it never kicked in').toBe(0);
  });

  it('puffs from its exhaust, shudders and lights up only while it runs', () => {
    const model = buildItem('generator', {});
    const lamp = partsOf(model).lamp!;
    const bright = lamp.emissiveIntensity;
    const cue = { id: 1, type: 'generator' as const, wear: 0, dirt: 0, inUse: false, running: 0 };
    animateCues(model, cue, 1.03);
    expect(partsOf(model).cues?.fumes?.visible ?? false).toBe(false);
    expect(model.rotation.z).toBe(0);
    expect(lamp.emissiveIntensity).toBeCloseTo(bright / 3);
    animateCues(model, { ...cue, running: 1 }, 1.03);
    expect(partsOf(model).cues?.fumes?.visible).toBe(true);
    expect(Math.abs(model.rotation.z)).toBeGreaterThan(0);
    expect(Math.abs(model.rotation.z)).toBeLessThanOrEqual(0.01);
    expect(lamp.emissiveIntensity).toBeCloseTo(bright);
    animateCues(model, cue, 2);
    expect(partsOf(model).cues?.fumes?.visible).toBe(false);
    expect(model.rotation.z).toBe(0);
  });
});
