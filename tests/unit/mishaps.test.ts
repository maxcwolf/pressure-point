// Mishaps: announced ahead, prepared for at a price, and out of action or keeping guests away while they last.
import { describe, expect, it } from 'vitest';

import {
  MISHAP_FIRST_DAY,
  MISHAP_GAP_DAYS,
  MISHAP_NOTICE_DAYS,
  type MishapId,
  MISHAPS,
  mishapStopsType,
  OWN_MISHAP_CHANCE,
} from '../../src/core/data';
import { advice } from '../../src/core/sim/advisor';
import { createContext } from '../../src/core/sim/context';
import { drainEvents } from '../../src/core/sim/events';
import {
  chooseMishap,
  mishapArrivals,
  mishapDaysLeft,
  mishapOn,
  newMishap,
  prepareMishap,
  updateMishaps,
} from '../../src/core/sim/mishaps';
import { arrivalFactor } from '../../src/core/sim/twists';
import { newGame } from '../../src/core/state/game';
import type { GameState } from '../../src/core/state/types';
import { upgradeSave } from '../../src/core/state/upgrade';
import { openCenter, run, runUntil, toasts } from './helpers';

/** An open center with mishaps switched on, and a context on it. */
function withMishaps(seed = 1) {
  const c = openCenter(seed);
  c.s.mishapsOn = true;
  c.s.open = true;
  return { ...c, ctx: createContext(c.s) };
}

/** A mishap of this kind announced long enough ago that it is due to start today. */
const dueToday = (day: number, kind: MishapId) => newMishap(day - MISHAP_NOTICE_DAYS, kind);

/** A day in the depth of winter. */
const WINTER_DAY = 15;
/** A day in high summer. */
const SUMMER_DAY = 200;

describe('which mishap comes', () => {
  it("is the center's own most of the time, and a fire drill the rest", () => {
    const s = newGame('exchange');
    expect(chooseMishap(s, 0)).toBe('power');
    expect(chooseMishap(s, OWN_MISHAP_CHANCE - 0.01)).toBe('power');
    expect(chooseMishap(s, OWN_MISHAP_CHANCE)).toBe('drill');
    expect(chooseMishap(newGame('saltmarsh'), 0)).toBe('storm');
    expect(chooseMishap(newGame('orchard'), 0)).toBe('wasps');
  });

  it('is always a fire drill at a center with none of its own', () => {
    expect(chooseMishap(newGame('willow'), 0)).toBe('drill');
  });

  it('is a freeze only in winter', () => {
    const s = newGame('highpines');
    s.day = WINTER_DAY;
    expect(chooseMishap(s, 0)).toBe('freeze');
    s.day = SUMMER_DAY;
    expect(chooseMishap(s, 0)).toBe('drill');
  });
});

describe('a mishap announced', () => {
  it('starts a few days ahead and lasts its days', () => {
    expect(newMishap(10, 'storm')).toEqual({
      kind: 'storm',
      starts: 10 + MISHAP_NOTICE_DAYS,
      ends: 10 + MISHAP_NOTICE_DAYS + MISHAPS.storm.days,
      prepared: false,
      started: false,
    });
  });

  it('counts down to its start, then to its end', () => {
    const s = newGame();
    s.day = 10;
    s.mishap = newMishap(10, 'power');
    expect(mishapDaysLeft(s)).toBe(MISHAP_NOTICE_DAYS);
    s.mishap.started = true;
    s.day = 13.5;
    expect(mishapDaysLeft(s)).toBe(0.5);
    s.mishap = null;
    expect(mishapDaysLeft(s)).toBe(0);
  });
});

describe('what a mishap stops', () => {
  it('is its own list of items, or every station for a fire drill, and nothing for a storm', () => {
    expect(mishapStopsType(MISHAPS.power, 'stim_unit', false)).toBe(true);
    expect(mishapStopsType(MISHAPS.power, 'massage_table', false)).toBe(false);
    expect(mishapStopsType(MISHAPS.freeze, 'toilet', false)).toBe(true);
    expect(mishapStopsType(MISHAPS.wasps, 'snack_machine', false)).toBe(true);
    expect(mishapStopsType(MISHAPS.drill, 'massage_table', false)).toBe(true);
    expect(mishapStopsType(MISHAPS.drill, 'bench', false)).toBe(false);
    expect(mishapStopsType(MISHAPS.storm, 'massage_table', false)).toBe(false);
  });

  it('is nothing once prepared for, except a fire drill, which is only shorter', () => {
    expect(mishapStopsType(MISHAPS.power, 'stim_unit', true)).toBe(false);
    expect(mishapStopsType(MISHAPS.freeze, 'toilet', true)).toBe(false);
    expect(mishapStopsType(MISHAPS.drill, 'massage_table', true)).toBe(true);
  });

  it('takes items out of action only once it has started, and stops a radiator heating', () => {
    const { sim, s } = withMishaps();
    const radiator = sim.placeItem('radiator', 10, 12, 0)!;
    s.mishap = newMishap(s.day, 'power');
    expect(sim.world.usable(radiator)).toBe(true);
    s.mishap.started = true;
    expect(sim.world.usable(radiator)).toBe(false);
    expect(sim.world.stoppedByMishap(radiator)).toBe(true);
    s.mishap.prepared = true;
    expect(sim.world.usable(radiator), 'a generator hired').toBe(true);
  });

  it('sends staff from a stopped station until it is over, then back to it', () => {
    const { sim, s, therapist, ctx } = withMishaps();
    runUntil(sim, () => therapist.state === 'atPost', 120);
    s.mishap = dueToday(s.day, 'drill');
    updateMishaps(ctx);
    expect(mishapOn(s)?.id).toBe('drill');
    runUntil(sim, () => therapist.state !== 'atPost', 10);
    run(sim, MISHAPS.drill.days * 6 + 2);
    expect(s.mishap).toBeNull();
    runUntil(sim, () => therapist.state === 'atPost', 120);
  });
});

describe('the run of a mishap', () => {
  it('is announced when due, only with mishaps on and the center open', () => {
    const { s, ctx } = withMishaps();
    s.day = MISHAP_FIRST_DAY;
    s.nextMishap = MISHAP_FIRST_DAY;
    s.mishapsOn = false;
    updateMishaps(ctx);
    expect(s.mishap).toBeNull();
    s.mishapsOn = true;
    s.open = false;
    updateMishaps(ctx);
    expect(s.mishap).toBeNull();
    s.open = true;
    drainEvents(ctx);
    updateMishaps(ctx);
    expect(s.mishap?.starts).toBe(s.day + MISHAP_NOTICE_DAYS);
    const events = drainEvents(ctx);
    expect(events).toContainEqual({ type: 'announce', text: MISHAPS[s.mishap!.kind].warning });
  });

  it('starts on its day, ends after its days, and sets when the next may come', () => {
    const { s, ctx } = withMishaps();
    s.mishap = newMishap(s.day, 'power');
    s.day = s.mishap.starts;
    drainEvents(ctx);
    updateMishaps(ctx);
    expect(s.mishap.started).toBe(true);
    expect(drainEvents(ctx)).toContainEqual({ type: 'announce', text: MISHAPS.power.start });
    s.day = s.mishap.ends;
    updateMishaps(ctx);
    expect(s.mishap).toBeNull();
    expect(drainEvents(ctx)).toContainEqual({ type: 'announce', text: MISHAPS.power.end });
    expect(s.nextMishap).toBeGreaterThanOrEqual(s.day + MISHAP_GAP_DAYS[0]);
    expect(s.nextMishap).toBeLessThanOrEqual(s.day + MISHAP_GAP_DAYS[1]);
  });

  it('keeps most guests away while a storm blows', () => {
    const { s, ctx } = withMishaps();
    const usual = arrivalFactor(ctx);
    s.mishap = { ...newMishap(s.day, 'storm'), started: true };
    expect(mishapArrivals(s)).toBe(MISHAPS.storm.arrivals);
    expect(arrivalFactor(ctx)).toBeCloseTo(usual * MISHAPS.storm.arrivals!);
  });

  it('breaks a few things as a storm starts, unless the windows were boarded up', () => {
    const { sim, s, ctx } = withMishaps();
    for (const x of [16, 18]) expect(sim.placeItem('water_cooler', x, 10, 0)).toBeTruthy();
    s.mishap = dueToday(s.day, 'storm');
    updateMishaps(ctx);
    expect(s.items.filter((it) => it.wear >= 100)).toHaveLength(MISHAPS.storm.breaks!);
    expect(toasts(drainEvents(ctx)).join(' ')).toContain('broken some equipment');
    const prepared = withMishaps(2);
    prepared.s.mishap = { ...dueToday(prepared.s.day, 'storm'), prepared: true };
    updateMishaps(prepared.ctx);
    expect(prepared.s.items.filter((it) => it.wear >= 100)).toEqual([]);
  });

  it('costs waiting guests patience in an unrehearsed fire drill', () => {
    const { sim, s, ctx } = withMishaps();
    runUntil(sim, () => s.guests.length >= 2, 300);
    for (const g of s.guests) g.patience = 80;
    s.mishap = dueToday(s.day, 'drill');
    updateMishaps(ctx);
    for (const g of s.guests) expect(g.patience).toBe(80 - MISHAPS.drill.patience!);
  });
});

describe('the advisor in a mishap', () => {
  it('says the stations are stopped by a fire drill, not that the center has no Reception Desk', () => {
    const { s, ctx } = withMishaps();
    s.mishap = { ...newMishap(s.day, 'drill'), started: true };
    expect(advice(ctx)).not.toContain('place a Reception Desk');
    expect(advice(ctx)).toContain('fire drill');
  });

  it('says a power cut has stopped the Stone Warmer, not that one is needed', () => {
    const { sim, s, ctx, therapist } = withMishaps();
    s.stars = 2;
    therapist.quals = ['swedish', 'stone'];
    sim.placeItem('stone_warmer', 14, 6, 0);
    runUntil(sim, () => s.guests.length > 0, 300);
    for (const g of s.guests) {
      g.goal = 'treat';
      g.condition = 'steam';
    }
    s.mishap = { ...newMishap(s.day, 'power'), started: true };
    expect(advice(ctx)).not.toContain('Items menu');
    expect(advice(ctx)).toContain('power cut');
  });

  it('carries on as usual through a storm, which stops nothing', () => {
    const { s, ctx } = withMishaps();
    const usual = advice(ctx);
    s.mishap = { ...newMishap(s.day, 'storm'), started: true };
    expect(advice(ctx)).toBe(usual);
  });

  it('carries on as usual once a generator is hired', () => {
    const { s, ctx } = withMishaps();
    const usual = advice(ctx);
    s.mishap = { ...newMishap(s.day, 'power'), started: true, prepared: true };
    expect(advice(ctx)).toBe(usual);
  });
});

describe('preparing for a mishap', () => {
  it('costs its price, and makes a fire drill shorter', () => {
    const { s, ctx } = withMishaps();
    s.mishap = newMishap(s.day, 'drill');
    const money = s.money;
    expect(prepareMishap(ctx)).toBe(true);
    expect(s.money).toBe(money - MISHAPS.drill.prepare.cost);
    expect(s.ledger.building).toBeGreaterThanOrEqual(MISHAPS.drill.prepare.cost);
    expect(s.mishap.prepared).toBe(true);
    expect(s.mishap.ends).toBe(s.mishap.starts + MISHAPS.drill.preparedDays);
    expect(prepareMishap(ctx), 'once only').toBe(false);
  });

  it('cannot be done with nothing coming, once it has started, or without the money', () => {
    const { s, ctx } = withMishaps();
    expect(prepareMishap(ctx)).toBe(false);
    s.mishap = { ...newMishap(s.day, 'power'), started: true };
    expect(prepareMishap(ctx)).toBe(false);
    s.mishap = newMishap(s.day, 'power');
    s.money = 100;
    drainEvents(ctx);
    expect(prepareMishap(ctx)).toBe(false);
    expect(s.mishap.prepared).toBe(false);
    expect(toasts(drainEvents(ctx)).join(' ')).toContain("can't afford");
  });
});

describe('a save from before mishaps', () => {
  it('has none coming, the first a while off, and mishaps on', () => {
    const { s } = openCenter(1);
    s.day = 300;
    const old = JSON.parse(JSON.stringify(s)) as Record<string, any>;
    for (const k of ['mishap', 'nextMishap', 'mishapsOn']) Reflect.deleteProperty(old, k);
    upgradeSave(old as GameState);
    const up = old as GameState;
    expect(up.mishap).toBeNull();
    expect(up.mishapsOn).toBe(true);
    expect(up.nextMishap).toBe(300 + MISHAP_GAP_DAYS[0]);
  });
});
