// The words for a center's seasons and rush hours: how arrivals run now, how they will run next, and when it turns.

import type { CenterDef } from '../../core/data';
import { calendarDay, dateOf } from '../../core/format';
import type { ArrivalPace } from '../../core/sim/guests';
import { rushOutlook, type Season, seasonTurn } from '../../core/sim/twists';
import { paceNote, times } from './demand';

/** A season's name, capitalized. */
export const SEASON_NAMES: Readonly<Record<Season, string>> = {
  winter: 'Winter',
  spring: 'Spring',
  summer: 'Summer',
  autumn: 'Autumn',
};

/** A day count in words: "today", "tomorrow", "in 12 days". */
function inDays(days: number): string {
  const n = Math.ceil(days);
  return n <= 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`;
}

/** A game day as a date, in a game that opened in `startMonth`: "day 1 of month 9". */
function onDay(day: number, startMonth: number): string {
  const d = dateOf(day, startMonth);
  return `day ${d.day} of month ${d.month}`;
}

/**
 * This season's arrival multiplier and the next's, with the date it turns, for a center with seasons: "Summer: ×1.9
 * the usual guests. Autumn (×1) from day 1 of month 9, in 12 days." Null for a center without them. `day` is the
 * game's day count, in a game that opened in `startMonth`; the seasons go by the calendar.
 */
export function seasonLine(day: number, center: CenterDef, startMonth = 0): string | null {
  if (!center.seasons) return null;
  const at = { day, startMonth };
  const o = seasonTurn(calendarDay(at), center.seasons);
  const turnsOn = day + o.daysUntil;
  return `${SEASON_NAMES[o.season]}: ${times(o.factor)} the usual guests. ${SEASON_NAMES[o.next]} (${times(o.nextFactor)}) from ${onDay(turnsOn, startMonth)}, ${inDays(o.daysUntil)}.`;
}

/**
 * Where the rush hours stand for a center that has them: "Rush hour: ×2.4 the usual guests, who lose patience ×1.25
 * as fast. Ends in 2 days." or "Between rush hours: ×0.6 the usual guests. The next starts tomorrow, at ×2.4." Null
 * for a center without them.
 */
export function rushLine(day: number, center: CenterDef): string | null {
  if (!center.rush) return null;
  const o = rushOutlook(day, center.rush);
  if (o.on)
    return `Rush hour: ${times(o.factor)} the usual guests, who lose patience ${times(center.rush.impatience)} as fast. Ends ${inDays(o.daysUntil)}.`;
  return `Between rush hours: ${times(o.factor)} the usual guests. The next starts ${inDays(o.daysUntil)}, at ${times(o.nextFactor)}.`;
}

/** A game day's whole date, as the bottom bar's hover heads it: "Day 1 of month 7, year 2". */
export function fullDate(day: number, startMonth = 0): string {
  const d = dateOf(day, startMonth);
  return `Day ${d.day} of month ${d.month}, year ${d.year}`;
}

/** The season, month and year in a few characters, as the bottom bar shows them under the day: "Summer · M7 Y2". */
export function shortDate(day: number, season: Season, startMonth = 0): string {
  const d = dateOf(day, startMonth);
  return `${SEASON_NAMES[season]} · M${d.month} Y${d.year}`;
}

/**
 * What the bottom bar's date says on hover: the whole date, the seasons or rush hours where there are any, and, given
 * the pace guests arrive at now, how many a month that comes to, factor by factor. `day` is the game's day count, in
 * a game that opened in `startMonth`.
 */
export function calendarTip(
  day: number,
  center: CenterDef,
  startMonth = 0,
  pace?: { p: ArrivalPace; reputation: number },
): string {
  const lines = [
    seasonLine(day, center, startMonth),
    rushLine(day, center),
    pace ? paceNote(pace.p, pace.reputation, center) : null,
  ].filter((l) => l !== null);
  return `${fullDate(day, startMonth)}: ${lines.length ? lines.join(' ') : 'the date, and the weather outside.'}`;
}
