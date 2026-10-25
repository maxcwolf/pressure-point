// Light snow: a flurry or two each winter wherever it goes below freezing, only to look at.
import { describe, expect, it } from 'vitest';

import { CENTERS, DAYS_PER_MONTH } from '../../src/core/data';
import type { Climate } from '../../src/core/data/types';
import { FLURRY_DAYS, flurrying, flurrySpells, FREEZING, freezingWindow } from '../../src/core/sim/flurries';
import { Sim } from '../../src/core/sim/sim';
import { COLDEST_DAY, outdoorTemp } from '../../src/core/sim/warmth';
import { newGame } from '../../src/core/state/game';
import { snowLook } from '../../src/render/snowfall';

const YEAR = 12 * DAYS_PER_MONTH;
const PINES = CENTERS.highpines.climate;
const MILD: Climate = { average: 60, swing: 10 };
const ARCTIC: Climate = { average: 10, swing: 15 };

/** The days of a year, counted from the coldest, that are below freezing, found by checking every tenth of a day. */
function freezingDays(climate: Climate): number {
  let cold = 0;
  for (let d = 0; d < YEAR; d += 0.1) if (outdoorTemp(climate, COLDEST_DAY + d) < FREEZING) cold += 0.1;
  return cold;
}

describe('light snow', () => {
  it('works out how long each winter is below freezing from the climate', () => {
    expect(COLDEST_DAY).toBe(15);
    for (const climate of [PINES, MILD, ARCTIC, { average: 36, swing: 6 }]) {
      const half = freezingWindow(climate);
      // twice the window either side of the coldest day is how much of the year freezes, day by day
      expect(Math.abs(2 * half - freezingDays(climate)), JSON.stringify(climate)).toBeLessThan(0.3);
      // just inside the window it freezes, and just outside it does not
      if (half > 0 && half < YEAR / 2) {
        expect(outdoorTemp(climate, COLDEST_DAY + half - 0.5)).toBeLessThan(FREEZING);
        expect(outdoorTemp(climate, COLDEST_DAY - half + 0.5)).toBeLessThan(FREEZING);
        expect(outdoorTemp(climate, COLDEST_DAY + half + 0.5)).toBeGreaterThan(FREEZING);
      }
    }
    expect(freezingWindow(MILD)).toBe(0);
    expect(freezingWindow(ARCTIC)).toBe(YEAR / 2);
    // High Pines freezes from late November into early March
    expect(freezingWindow(PINES)).toBeGreaterThan(45);
    expect(freezingWindow(PINES)).toBeLessThan(50);
  });

  it('falls only at High Pines of the centers there are, the only one that goes below freezing', () => {
    for (const [id, center] of Object.entries(CENTERS)) {
      let any = false;
      for (let day = 0; day < 5 * YEAR && !any; day++) any = flurrying(day, center.climate);
      expect(any, id).toBe(id === 'highpines');
    }
  });

  it('falls once or twice a winter, for whole spells of a few days, only while it is below freezing', () => {
    const seasons = 40;
    let spells = 0;
    for (let year = 0; year < seasons; year++) {
      const starts = flurrySpells(year, PINES);
      expect(starts.length, `year ${year}`).toBeGreaterThanOrEqual(1);
      expect(starts.length, `year ${year}`).toBeLessThanOrEqual(2);
      spells += starts.length;
      for (const start of starts) {
        expect(Number.isInteger(start)).toBe(true);
        // the day before and the day after are clear, unless the season's other flurry falls on them
        const other = starts.filter((s) => s !== start);
        /** Whether the season's other flurry falls on a day. */
        const covered = (d: number) => other.some((s) => d >= s && d < s + FLURRY_DAYS);
        if (!covered(start - 1)) expect(flurrying(start - 1, PINES)).toBe(false);
        if (!covered(start + FLURRY_DAYS)) expect(flurrying(start + FLURRY_DAYS, PINES)).toBe(false);
        for (let d = start; d < start + FLURRY_DAYS; d += 0.25) {
          expect(flurrying(d, PINES), `day ${d}`).toBe(true);
          expect(outdoorTemp(PINES, d), `day ${d}`).toBeLessThan(FREEZING);
        }
      }
    }
    // every day it snows is in one of the season's spells, and below freezing
    for (let day = 0; day < seasons * YEAR; day++) {
      if (!flurrying(day, PINES)) continue;
      expect(outdoorTemp(PINES, day + 0.99)).toBeLessThan(FREEZING);
      const year = Math.round((day - COLDEST_DAY) / YEAR);
      expect(flurrySpells(year, PINES).some((s) => day >= s && day < s + FLURRY_DAYS)).toBe(true);
    }
    expect(spells / seasons).toBeGreaterThan(1.3);
    expect(spells / seasons).toBeLessThan(1.7);
  });

  it('is the same all through a day, and follows the calendar in a game that opened later in the year', () => {
    for (let day = 0; day < 3 * YEAR; day++)
      for (const part of [0.25, 0.5, 0.99]) expect(flurrying(day + part, PINES)).toBe(flurrying(day, PINES));
    for (let day = 0; day < YEAR; day++)
      expect(flurrying(day, PINES, 2)).toBe(flurrying(day + 2 * DAYS_PER_MONTH, PINES));
  });

  it('never falls in a winter too short for a whole flurry', () => {
    // a climate that only just dips below freezing, for a day or so either side of the coldest
    const brief: Climate = { average: 50, swing: 18.002 };
    expect(freezingWindow(brief)).toBeGreaterThan(0);
    expect(freezingWindow(brief) * 2).toBeLessThan(FLURRY_DAYS);
    for (let year = 0; year < 10; year++) expect(flurrySpells(year, brief)).toEqual([]);
  });

  it('shows in the sim only with the weather switched on', () => {
    let day = 0;
    while (!flurrying(day, PINES)) day++;
    const sim = new Sim(newGame('highpines'));
    sim.s.startMonth = 0;
    sim.s.day = day;
    expect(sim.flurrying()).toBe(true);
    sim.s.weatherOn = false;
    expect(sim.flurrying()).toBe(false);
    const willow = new Sim(newGame('willow'));
    willow.s.startMonth = 0;
    willow.s.day = day;
    expect(willow.flurrying()).toBe(false);
  });

  it('falls heavy while snowed in, light in a flurry, and not at all otherwise', () => {
    const heavy = snowLook(true, false);
    const light = snowLook(false, true);
    expect(snowLook(true, true)).toEqual(heavy);
    expect(snowLook(false, false)).toBeNull();
    expect(heavy).toEqual({ flakes: 2400, fall: 1.2, size: 0.2 });
    expect(light?.flakes).toBe(480);
    expect(light?.fall ?? 0).toBeLessThan(heavy?.fall ?? 0);
    expect(light?.size ?? 0).toBeLessThanOrEqual(heavy?.size ?? 0);
  });
});
