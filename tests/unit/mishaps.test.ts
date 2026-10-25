// Mishaps: announced ahead, prepared for at a price, and out of action or keeping guests away while they last.
import { describe, expect, it } from 'vitest';

import {
  MISHAP_FIRST_DAY,
  MISHAP_GAP_DAYS,
  MISHAP_NOTICE_DAYS,
  MISHAP_RETRY_DAYS,
  type MishapId,
  MISHAPS,
  mishapStopsType,
  MODALITIES,
  STONE_USE,
} from '../../src/core/data';
import { advice } from '../../src/core/sim/advisor';
import { createContext } from '../../src/core/sim/context';
import { drainEvents } from '../../src/core/sim/events';
import {
  chooseMishap,
  mishapAdvice,
  mishapArrivals,
  mishapDaysLeft,
  newMishap,
  prepareMishap,
  updateMishaps,
} from '../../src/core/sim/mishaps';
import { arrivalFactor } from '../../src/core/sim/twists';
import { newGame } from '../../src/core/state/game';
import type { GameState } from '../../src/core/state/types';
import { upgradeSave } from '../../src/core/state/upgrade';
import { deliveryNote } from '../../src/ui/lib/delivery';
import { openCenter, runUntil, toasts } from './helpers';

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
  it("is the center's own", () => {
    expect(chooseMishap(newGame('exchange'))).toBe('power');
    expect(chooseMishap(newGame('boardwalk'))).toBe('storm');
    expect(chooseMishap(newGame('orchard'))).toBe('wasps');
  });

  it('is none at a center with none of its own', () => {
    expect(chooseMishap(newGame('willow'))).toBeNull();
  });

  it('is a freeze only in winter', () => {
    const s = newGame('highpines');
    s.day = WINTER_DAY;
    expect(chooseMishap(s)).toBe('freeze');
    s.day = SUMMER_DAY;
    expect(chooseMishap(s)).toBeNull();
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
  it('is its own list of items, and nothing for a storm', () => {
    expect(mishapStopsType(MISHAPS.power, 'stim_unit', false)).toBe(true);
    expect(mishapStopsType(MISHAPS.power, 'massage_table', false)).toBe(false);
    expect(mishapStopsType(MISHAPS.freeze, 'toilet', false)).toBe(true);
    expect(mishapStopsType(MISHAPS.wasps, 'snack_machine', false)).toBe(true);
    expect(mishapStopsType(MISHAPS.storm, 'massage_table', false)).toBe(false);
  });

  it('is nothing once prepared for', () => {
    expect(mishapStopsType(MISHAPS.power, 'stim_unit', true)).toBe(false);
    expect(mishapStopsType(MISHAPS.freeze, 'toilet', true)).toBe(false);
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

  it('never comes at a center with none of its own, and waits for winter for a freeze', () => {
    const { s, ctx } = withMishaps();
    s.center = 'willow';
    s.day = s.nextMishap = MISHAP_FIRST_DAY;
    updateMishaps(ctx);
    expect(s.mishap).toBeNull();
    expect(s.nextMishap).toBe(MISHAP_FIRST_DAY);
    s.center = 'highpines';
    s.day = s.nextMishap = SUMMER_DAY;
    updateMishaps(ctx);
    expect(s.mishap).toBeNull();
    expect(s.nextMishap).toBe(SUMMER_DAY + MISHAP_RETRY_DAYS);
    s.day = s.nextMishap = WINTER_DAY + 360;
    updateMishaps(ctx);
    expect(s.mishap?.kind).toBe('freeze');
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
});

describe('treatments in a power cut', () => {
  it('cannot use a Stone Warmer the power cut has stopped, unless a generator is hired', () => {
    const { sim, s, therapist } = withMishaps();
    therapist.quals = ['swedish', 'stone'];
    const table = s.items.find((i) => i.type === 'massage_table')!;
    const warmer = sim.placeItem('stone_warmer', 14, 6, 0)!;
    expect(sim.deliveryProblem(table, therapist, MODALITIES.stone)).toBe('');
    s.mishap = { ...newMishap(s.day, 'power'), started: true };
    expect(sim.deliveryProblem(table, therapist, MODALITIES.stone)).toBe('out-of-action');
    expect(deliveryNote('out-of-action', MODALITIES.stone, therapist.name)).toBe('Stone Warmer is out of action');
    s.mishap.prepared = true;
    expect(sim.deliveryProblem(table, therapist, MODALITIES.stone), 'a generator hired').toBe('');
    s.mishap = null;
    warmer.wear = 100;
    expect(sim.deliveryProblem(table, therapist, MODALITIES.stone), 'broken').toBe('out-of-action');
  });

  it('does not draw heat from a stopped Stone Warmer, and the treatment goes badly', () => {
    const { sim, s, therapist } = withMishaps();
    s.stars = 2;
    therapist.quals = ['swedish', 'stone'];
    const warmer = sim.placeItem('stone_warmer', 14, 6, 0)!;
    s.mishap = { ...newMishap(s.day, 'power'), started: true, ends: s.day + 99 };
    const heat = warmer.water;
    const failed = s.stats.failed;
    runUntil(
      sim,
      () => {
        for (const g of s.guests) if (g.diagnosis === 0) g.condition = 'steam';
        return s.stats.failed > failed;
      },
      900,
    );
    // it cools as it would anyway, but no stones were taken from it
    expect(heat - warmer.water).toBeLessThan(STONE_USE);
    expect(toasts(sim.drain()).join(' ')).toContain('Stone Warmer was out of action');
  });
});

describe('the advisor in a mishap', () => {
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

  it('says what the wasps have put out of action, in the plural', () => {
    const wasps = withMishaps();
    expect(wasps.sim.placeItem('bin', 14, 6, 0)).not.toBeNull();
    wasps.s.mishap = { ...newMishap(wasps.s.day, 'wasps'), started: true };
    expect(mishapAdvice(wasps.s)).toMatch(/^The wasps have put the snacks, drinks and bins out of action\./);
    const power = withMishaps();
    power.s.stars = 2;
    expect(power.sim.placeItem('stone_warmer', 14, 6, 0)).not.toBeNull();
    power.s.mishap = { ...newMishap(power.s.day, 'power'), started: true };
    expect(mishapAdvice(power.s)).toMatch(/^The power cut has put anything with a plug out of action\./);
  });
});

describe('preparing for a mishap', () => {
  it('costs its price, once only', () => {
    const { s, ctx } = withMishaps();
    s.mishap = newMishap(s.day, 'power');
    const money = s.money;
    expect(prepareMishap(ctx)).toBe(true);
    expect(s.money).toBe(money - MISHAPS.power.prepare.cost);
    expect(s.ledger.building).toBeGreaterThanOrEqual(MISHAPS.power.prepare.cost);
    expect(s.mishap.prepared).toBe(true);
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
