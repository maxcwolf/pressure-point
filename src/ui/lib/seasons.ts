// The words for a center's seasons and rush hours: how arrivals run now, how they will run next, and when it turns.

import type { CenterDef } from '../../core/data';
import { dateOf } from '../../core/format';
import { rushOutlook, type Season, seasonTurn } from '../../core/sim/twists';
import { times } from './demand';

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

/** A game day as a date: "day 1 of month 9". */
function onDay(day: number): string {
  const d = dateOf(day);
  return `day ${d.day} of month ${d.month}`;
}

/**
 * This season's arrival multiplier and the next's, with the date it turns, for a center with seasons: "Summer: ×1.9
 * the usual guests. Autumn (×1) from day 1 of month 9, in 12 days." Null for a center without them.
 */
export function seasonLine(day: number, center: CenterDef): string | null {
  if (!center.seasons) return null;
  const o = seasonTurn(day, center.seasons);
  return `${SEASON_NAMES[o.season]}: ${times(o.factor)} the usual guests. ${SEASON_NAMES[o.next]} (${times(o.nextFactor)}) from ${onDay(o.turnsOn)}, ${inDays(o.daysUntil)}.`;
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

/** What the bottom bar's date says on hover: the date and weather, and the seasons or rush hours where there are any. */
export function calendarTip(day: number, center: CenterDef): string {
  const lines = ['Date and weather', seasonLine(day, center), rushLine(day, center)].filter((l) => l !== null);
  return lines.join(' ');
}
