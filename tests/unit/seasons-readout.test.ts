// The seasons and rush hours in words: how arrivals run now and next, when it turns, and the season news with numbers.
import { describe, expect, it } from 'vitest';

import { centerOf, DAYS_PER_MONTH } from '../../src/core/data';
import { createContext } from '../../src/core/sim/context';
import { drainEvents } from '../../src/core/sim/events';
import { rushOutlook, seasonTurn, updateTwists } from '../../src/core/sim/twists';
import { emptyTally } from '../../src/core/state/game';
import { newGame } from '../../src/core/state/game';
import { calendarTip, rushLine, seasonLine } from '../../src/ui/lib/seasons';

const boardwalk = centerOf(newGame('boardwalk'));
const exchange = centerOf(newGame('exchange'));
const willow = centerOf(newGame('willow'));
const seasons = boardwalk.seasons!;
const rush = exchange.rush!;

describe('the season turn', () => {
  it('gives this season and the next, their multipliers, and the day it turns', () => {
    // day 10 of month 6 (summer, months 6 to 8); autumn starts with month 9
    expect(seasonTurn(5 * DAYS_PER_MONTH + 10, seasons)).toEqual({
      season: 'summer',
      factor: seasons.summer,
      next: 'autumn',
      nextFactor: 1,
      turnsOn: 8 * DAYS_PER_MONTH,
      daysUntil: 3 * DAYS_PER_MONTH - 10,
    });
    expect(seasonTurn(11 * DAYS_PER_MONTH, seasons)).toMatchObject({
      season: 'winter',
      factor: seasons.winter,
      next: 'spring',
      turnsOn: 14 * DAYS_PER_MONTH,
    });
  });

  it('reads in the bottom bar and the Guests tab, only where a center has seasons', () => {
    expect(seasonLine(5 * DAYS_PER_MONTH + 10, boardwalk)).toBe(
      `Summer: ×${seasons.summer} the usual guests. Autumn (×1) from day 1 of month 9, in 80 days.`,
    );
    expect(seasonLine(8 * DAYS_PER_MONTH - 0.5, boardwalk)).toContain('tomorrow.');
    expect(seasonLine(10, willow)).toBeNull();
    expect(calendarTip(10, willow)).toBe('Date and weather');
    expect(calendarTip(5 * DAYS_PER_MONTH + 10, boardwalk)).toBe(
      `Date and weather Summer: ×${seasons.summer} the usual guests. Autumn (×1) from day 1 of month 9, in 80 days.`,
    );
  });
});

describe('the rush-hour outlook', () => {
  it('says whether one is on and when it turns', () => {
    // the cycle is six days, with a rush from day 3 to day 5 of each
    expect(rushOutlook(1, rush)).toEqual({
      on: false,
      factor: rush.lull,
      nextFactor: rush.peak,
      turnsOn: 3,
      daysUntil: 2,
    });
    expect(rushOutlook(3.5, rush)).toEqual({
      on: true,
      factor: rush.peak,
      nextFactor: rush.lull,
      turnsOn: 5,
      daysUntil: 1.5,
    });
    expect(rushOutlook(5.5, rush)).toMatchObject({ on: false, turnsOn: 9 });
  });

  it('reads in words, only where a center has rush hours', () => {
    expect(rushLine(3.5, exchange)).toBe(
      `Rush hour: ×${rush.peak} the usual guests, who lose patience ×${rush.impatience} as fast. Ends in 2 days.`,
    );
    expect(rushLine(1.2, exchange)).toBe(
      `Between rush hours: ×${rush.lull} the usual guests. The next starts in 2 days, at ×${rush.peak}.`,
    );
    expect(rushLine(1, boardwalk)).toBeNull();
    expect(calendarTip(3.5, exchange)).toContain('Date and weather Rush hour:');
  });
});

describe('the season news', () => {
  it('is announced as the season turns, with last month on file', () => {
    const ctx = createContext(newGame('boardwalk'));
    ctx.s.open = true;
    ctx.s.months.push({ ...emptyTally(), arrived: 15, ledger: ctx.s.ledger, reputation: 50, money: 0 });
    ctx.s.day = 5 * DAYS_PER_MONTH + 0.01;
    updateTwists(ctx, 0.1);
    expect(drainEvents(ctx)).toEqual([
      { type: 'announce', text: expect.stringContaining('Last month 15 came; expect about 29 a month.') },
    ]);
  });
});
