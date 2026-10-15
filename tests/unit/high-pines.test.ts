// High Pines: the mountain lodge, with its cold, its snowed-in spells, its own ailments and stones that cool faster.
import { describe, expect, it } from 'vitest';

import { nextCenter } from '../../src/core/campaign';
import { CENTERS, COLD_STONES, DAYS_PER_MONTH, H, IDEAL_TEMP, STONE_COOLING, W } from '../../src/core/data';
import type { Snowfall } from '../../src/core/data/types';
import { setSeed } from '../../src/core/random';
import { createContext } from '../../src/core/sim/context';
import { updateEmergency } from '../../src/core/sim/emergencies';
import { drainEvents } from '../../src/core/sim/events';
import { admitGuests, rollCondition } from '../../src/core/sim/guests';
import { Sim } from '../../src/core/sim/sim';
import { cutOff, dice, SNOW_GRACE_DAYS, SNOW_NEWS, snowedIn, updateTwists } from '../../src/core/sim/twists';
import { decayItems } from '../../src/core/sim/upkeep';
import { discomfort, stoneCooling, updateWarmth, warmthAt } from '../../src/core/sim/warmth';
import { disciplineOn, newGame } from '../../src/core/state/game';
import { flakeHeight, flakeSpot } from '../../src/render/snowfall';
import { buildRoom, runUntil } from './helpers';

const SNOW: Snowfall = CENTERS.highpines.snow ?? { chance: 0, days: 1 };

/** The first day of a snowed-in spell at High Pines. */
function firstSnowDay(): number {
  for (let day = 0; day < 400; day++) if (snowedIn(day, SNOW)) return day;
  throw new Error('no snow in a year');
}

describe('High Pines', () => {
  it('comes after The Boardwalk, with acupuncture and reiki', () => {
    expect(nextCenter('boardwalk')).toBe('highpines');
    expect(nextCenter('highpines')).toBe('orchard');
    expect(disciplineOn(newGame('highpines'), 'reiki')).toBe(true);
    expect(disciplineOn(newGame('highpines'), 'acupuncture')).toBe(true);
  });

  it('rolls the same dice for the same number every time, spread between 0 and 1', () => {
    expect(dice(42)).toBe(dice(42));
    const rolls = Array.from({ length: 2000 }, (_, i) => dice(i));
    expect(Math.min(...rolls)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...rolls)).toBeLessThan(1);
    expect(rolls.reduce((a, b) => a + b, 0) / rolls.length).toBeCloseTo(0.5, 1);
  });

  it('is snowed in only in winter, for whole spells, about as often as its chance', () => {
    const winters = [];
    for (let day = 0; day < 10 * 12 * DAYS_PER_MONTH; day++) {
      const month = Math.floor(day / DAYS_PER_MONTH) % 12;
      const winter = month === 11 || month <= 1;
      if (!winter) expect(snowedIn(day, SNOW), `day ${day}`).toBe(false);
      else winters.push(day);
    }
    // a new game's first month is clear, so it can open
    for (let day = 0; day < SNOW_GRACE_DAYS; day += 0.5) expect(snowedIn(day, SNOW)).toBe(false);
    // every day of a spell is the same, so a spell is snowed in from start to end
    for (const day of winters) expect(snowedIn(day + 0.5, SNOW)).toBe(snowedIn(Math.floor(day), SNOW));
    const spells = new Set(winters.filter((d) => d >= SNOW_GRACE_DAYS).map((d) => Math.floor(d / SNOW.days)));
    const snowy = [...spells].filter((n) => snowedIn(n * SNOW.days, SNOW)).length;
    expect(snowy / spells.size).toBeGreaterThan(SNOW.chance - 0.1);
    expect(snowy / spells.size).toBeLessThan(SNOW.chance + 0.1);
  });

  it('is the only center that is ever snowed in', () => {
    const day = firstSnowDay();
    for (const id of ['sandbox', 'willow', 'exchange', 'boardwalk', 'highpines'] as const) {
      const ctx = createContext(newGame(id));
      ctx.s.day = day;
      expect(cutOff(ctx), id).toBe(id === 'highpines');
    }
    const sim = new Sim(newGame('highpines'));
    sim.s.day = day;
    expect(sim.snowedIn()).toBe(true);
  });

  it('lets nobody new in while snowed in, then lets them in again once the road is open', () => {
    setSeed(4);
    const ctx = createContext(newGame('highpines'));
    ctx.s.open = true;
    ctx.s.day = firstSnowDay();
    ctx.s.spawnT = 0;
    admitGuests(ctx, 0.1);
    expect(ctx.s.guests).toHaveLength(0);
    while (snowedIn(ctx.s.day, SNOW)) ctx.s.day += 0.5;
    admitGuests(ctx, 0.1);
    expect(ctx.s.guests).toHaveLength(1);
  });

  it('offers no emergency while snowed in', () => {
    const ctx = createContext(newGame('highpines'));
    ctx.s.open = true;
    ctx.s.stars = 1;
    ctx.s.nextEmergency = 0;
    ctx.s.day = firstSnowDay();
    updateEmergency(ctx);
    expect(ctx.s.offer).toBeFalsy();
  });

  it('announces each snowed-in spell, and the road opening again', () => {
    const ctx = createContext(newGame('highpines'));
    ctx.s.open = true;
    const start = firstSnowDay();
    ctx.s.day = start + 0.01;
    updateTwists(ctx, 0.1);
    expect(drainEvents(ctx)).toContainEqual({ type: 'announce', text: SNOW_NEWS.start });
    let end = start;
    while (snowedIn(end, SNOW)) end += SNOW.days;
    ctx.s.day = end + 0.01;
    updateTwists(ctx, 0.1);
    expect(drainEvents(ctx)).toContainEqual({ type: 'announce', text: SNOW_NEWS.end });
  });

  it('has its own mountain ailments, found nowhere else', () => {
    const local = ['frozen', 'wipeout', 'cabin'];
    /** The local ailments among many guests in a center two stars in, with a suite and a studio to treat them. */
    const seen = (id: 'highpines' | 'boardwalk') => {
      setSeed(5);
      const ctx = createContext(newGame(id));
      ctx.s.stars = 2;
      for (const type of ['massage', 'reiki'] as const)
        ctx.s.rooms.push({
          id: ctx.s.nextId++,
          type,
          x: 0,
          y: 0,
          w: 3,
          h: 3,
          door: { x: 1, y: 2, dx: 0, dy: 1 },
          windows: [],
          done: true,
          priority: false,
          vibes: 0,
          claimedBy: 0,
        });
      const found = new Set<string>();
      for (let i = 0; i < 3000; i++) found.add(rollCondition(ctx));
      return local.filter((c) => found.has(c));
    };
    expect(seen('highpines')).toEqual(local);
    expect(seen('boardwalk')).toEqual([]);
  });

  it('is cold indoors in winter until a radiator warms it', () => {
    const ctx = createContext(newGame('highpines'));
    updateWarmth(ctx);
    const cold = warmthAt(ctx, 12, 10);
    expect(cold).toBeLessThan(IDEAL_TEMP);
    expect(discomfort(cold)).toBeGreaterThan(0.5);
    ctx.s.items.push({ id: ctx.s.nextId++, type: 'radiator', x: 12, y: 10, rot: 0 } as never);
    updateWarmth(ctx);
    expect(warmthAt(ctx, 12, 10)).toBeGreaterThan(cold + 10);
  });

  it('cools a Stone Warmer faster in a cold room', () => {
    expect(stoneCooling(IDEAL_TEMP)).toBe(STONE_COOLING);
    expect(stoneCooling(IDEAL_TEMP + 30)).toBe(STONE_COOLING);
    expect(stoneCooling(IDEAL_TEMP - 40)).toBeCloseTo(STONE_COOLING * (1 + COLD_STONES));
    /** How much heat a Stone Warmer loses in a minute in winter in a center. */
    const lost = (id: 'highpines' | 'sandbox') => {
      const ctx = createContext(newGame(id));
      updateWarmth(ctx);
      const warmer = { id: 1, type: 'stone_warmer', x: 12, y: 10, rot: 0, water: 100, wear: 0 } as never as {
        water: number;
      };
      ctx.s.items.push(warmer as never);
      decayItems(ctx, 60);
      return 100 - warmer.water;
    };
    expect(lost('highpines')).toBeGreaterThan(lost('sandbox') * 2);
  });

  it('can be built and run inside its own walls', () => {
    setSeed(8);
    const sim = new Sim(newGame('highpines'));
    sim.s.money = 100_000;
    sim.s.weatherOn = false;
    expect(sim.placeItem('reception_desk', 15, 13, 0)).not.toBeNull();
    buildRoom(sim, 'consult', { x: 6, y: 5, w: 4, h: 4 }, { x: 9, y: 7, dx: 1, dy: 0 }, [
      ['consult_desk', 7, 6],
      ['cabinet', 6, 8],
    ]);
    buildRoom(sim, 'massage', { x: 21, y: 5, w: 4, h: 4 }, { x: 22, y: 8, dx: 0, dy: 1 }, [
      ['massage_table', 22, 5],
      ['oil_trolley', 24, 5],
    ]);
    for (const role of ['receptionist', 'consultant', 'therapist'] as const) {
      const best = sim.s.candidates.filter((c) => c.role === role).sort((a, b) => b.skill - a.skill)[0];
      expect(best && sim.hire(best.id), role).toBeTruthy();
    }
    runUntil(sim, () => sim.s.stats.healed >= 3, 1500);
    expect(sim.objectives()[0]?.label).toMatch(/^Heal 25 guests/);
  });
});

describe('falling snow', () => {
  it('falls from the top to the ground, then starts again at the top', () => {
    const top = flakeHeight(0, 0);
    expect(top).toBeGreaterThan(5);
    expect(flakeHeight(0, 1)).toBeLessThan(top);
    expect(flakeHeight(0.5, 0)).toBeCloseTo(top / 2);
    // later on it has gone round again, never below the ground or above the top
    for (let t = 0; t < 60; t += 0.37) {
      expect(flakeHeight(0.3, t)).toBeGreaterThan(0);
      expect(flakeHeight(0.3, t)).toBeLessThanOrEqual(top);
    }
  });

  it('spreads the flakes over the whole lot and a little past it', () => {
    const spots = Array.from({ length: 500 }, (_, i) => flakeSpot(i));
    expect(Math.min(...spots.map((p) => p.x))).toBeLessThan(0);
    expect(Math.max(...spots.map((p) => p.x))).toBeGreaterThan(W);
    expect(Math.min(...spots.map((p) => p.z))).toBeLessThan(0);
    expect(Math.max(...spots.map((p) => p.z))).toBeGreaterThan(H);
    expect(flakeSpot(7)).toEqual(flakeSpot(7));
  });
});
