// What a Qi Gong Studio's inspector says about its classes.

import { WEEKDAYS } from '../../core/data';
import { weekday } from '../../core/sim/classes';
import type { ClassBooking } from '../../core/state/types';

/** The studio's next class as booked: today's or a later one, how many have a place, and how many found it full. */
export function bookingNote(b: ClassBooking | undefined, day: number): string {
  if (!b || b.day < Math.floor(day)) return 'Places for each class are booked two days before.';
  const when = b.day === Math.floor(day) ? 'Today’s class' : `${WEEKDAYS[weekday(b.day)] ?? ''}’s class`;
  if (!b.count) return `${when}: nobody booked`;
  const full = b.turned ? `, full, with ${b.turned} turned away` : '';
  return `${when}: ${b.count} booked${full}`;
}

/** How many classes a week a timetable holds, in words. */
export function weekNote(days: readonly number[]): string {
  if (!days.length) return 'No classes: switch on a day to hold one.';
  return `${days.length} ${days.length === 1 ? 'class' : 'classes'} a week, sharing the week’s class-goers`;
}

/** How a studio's spots stand: a class under way, class-goers waiting on their spots for one, or every spot free. */
export function classNote(standing: number, spots: number, progress: number): string {
  if (progress > 0) return `Class under way: ${standing} of ${spots} spots taken`;
  if (standing) return `${standing} of ${spots} spots taken, waiting for the class`;
  return `${spots} Practice ${spots === 1 ? 'Spot' : 'Spots'}, all free`;
}
