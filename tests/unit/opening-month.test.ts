// The month a game opens in: Willow Lane, the first of the campaign, opens as spring starts. The calendar (the season,
// the weather and the date shown) runs that far ahead of the day count, and everything counted in days since the
// center opened (paydays, the year its awards are for) stays as it was.
import { describe, expect, it } from 'vitest';

import { type CenterId, CENTERS, DAYS_PER_MONTH } from '../../src/core/data';
import { dateOf } from '../../src/core/format';
import { paydayOf } from '../../src/core/sim/economy';
import { Sim } from '../../src/core/sim/sim';
import { SNOW_GRACE_DAYS, snowedIn } from '../../src/core/sim/twists';
import { newGame } from '../../src/core/state/game';
import type { GameState } from '../../src/core/state/types';
import { upgradeSave } from '../../src/core/state/upgrade';
import { gameDate } from '../../src/storage/saves';

describe('the month a game opens in', () => {
  it('is the start of spring at Willow Lane, and January everywhere else', () => {
    const willow = new Sim(newGame('willow'));
    expect(willow.season()).toBe('spring');
    expect(dateOf(willow.s.day, willow.s.startMonth)).toEqual({ day: 1, month: 3, year: 1 });
    for (const id of Object.keys(CENTERS) as CenterId[])
      if (id !== 'willow') expect(new Sim(newGame(id)).season(), id).toBe('winter');
  });

  it('opens Willow Lane in milder weather than January', () => {
    const spring = new Sim(newGame('willow'));
    const january = new Sim({ ...newGame('willow'), startMonth: 0 });
    expect(spring.outdoorTemp()).toBeGreaterThan(january.outdoorTemp());
  });

  it('leaves paydays and the year of the awards counted from the day the center opened', () => {
    const s = newGame('willow');
    expect(paydayOf(s)).toBe(DAYS_PER_MONTH);
    // eleven months in, February on the calendar is still the first year; the year turns as the awards come
    expect(dateOf(11 * DAYS_PER_MONTH, s.startMonth)).toEqual({ day: 1, month: 2, year: 1 });
    expect(dateOf(12 * DAYS_PER_MONTH, s.startMonth)).toEqual({ day: 1, month: 3, year: 2 });
  });

  it('names a save by its own calendar', () => {
    expect(gameDate(0, 2)).toBe('Day 1, Month 3, Year 1');
    expect(gameDate(45)).toBe('Day 16, Month 2, Year 1');
  });

  it('keeps a save from before on its own dates', () => {
    const old = JSON.parse(JSON.stringify({ ...newGame('willow'), day: 45 })) as Record<string, unknown>;
    Reflect.deleteProperty(old, 'startMonth');
    const s = old as unknown as GameState;
    upgradeSave(s);
    expect(s.startMonth).toBe(0);
    expect(new Sim(s).season()).toBe('winter');
  });

  it('keeps the road clear for the first month whatever month a game opens in, and snows it in by the calendar', () => {
    const always = { chance: 1, days: 3 };
    // opening in December: the first month is clear, and January after it is snowed in
    expect(snowedIn(SNOW_GRACE_DAYS - 1, always, 11)).toBe(false);
    expect(snowedIn(SNOW_GRACE_DAYS + 1, always, 11)).toBe(true);
    // opening in March, the months after the first are spring
    expect(snowedIn(SNOW_GRACE_DAYS + 1, always, 2)).toBe(false);
  });
});
