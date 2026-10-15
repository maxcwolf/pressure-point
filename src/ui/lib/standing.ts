// Words and figures for the center's standing and the rival across the street.

import {
  GRADE_ARRIVALS,
  GRADE_EXPECTS,
  type GradeDef,
  GRADES,
  POACH_MORALE,
  RIVAL_NAME,
  RIVAL_OPENS,
} from '../../core/data';
import { dateOf } from '../../core/format';

/** How far a center is toward its next grade: the grade, the points still needed, and the share of the way there. */
export interface GradeProgress {
  next: GradeDef | undefined;
  needed: number;
  share: number;
}

/** How far some points are toward the grade after this one. At the top, there is nothing left to climb. */
export function gradeProgress(points: number, grade: number): GradeProgress {
  const here = GRADES[grade];
  const next = GRADES[grade + 1];
  if (!here || !next) return { next: undefined, needed: 0, share: 1 };
  const span = next.points - here.points;
  return {
    next,
    needed: Math.max(0, next.points - points),
    share: Math.min(1, Math.max(0, (points - here.points) / span)),
  };
}

/** What a grade brings: more guests, more applicants, and what guests expect of a treatment room. */
export function gradeEffects(grade: number): string[] {
  const more = Math.round(GRADE_ARRIVALS * grade * 100);
  const expects = GRADE_EXPECTS[Math.min(grade, GRADE_EXPECTS.length - 1)] ?? 0;
  return [
    more ? `${more}% more guests than a ${GRADES[0]?.name ?? 'new center'}` : 'Guests come as reputation brings them',
    grade >= 2
      ? 'More applicants for each job, and better ones'
      : grade === 1
        ? 'Better applicants for each job'
        : 'Applicants come as they do anywhere',
    expects
      ? `Guests expect treatment rooms of ${'★'.repeat(expects)} prestige or more, and are let down by plainer ones`
      : 'Guests expect nothing special of the rooms yet',
  ];
}

/** When the rival is due to open, or has: a line for the Standing tab. */
export function rivalOpening(opened: number | null, on: boolean): string {
  if (!on) return 'There is no rival in this game.';
  if (opened === null) {
    const d = dateOf(RIVAL_OPENS);
    return `A ${RIVAL_NAME} is due to open across the street around day ${d.day} of month ${d.month}.`;
  }
  const d = dateOf(opened);
  return `Open across the street since day ${d.day} of month ${d.month}.`;
}

/** The share of guests the rival is drawing away, in words. */
export function drawNote(draw: number): string {
  if (draw <= 0) return 'Not drawing your guests away at the moment.';
  return `Drawing away about ${Math.round(draw * 100)}% of the guests who would come to you.`;
}

/** The warning on someone the rival has made an offer to. */
export function offerWarning(daysLeft: number): string {
  const when = daysLeft < 1 ? 'today' : `within ${Math.ceil(daysLeft)} day${Math.ceil(daysLeft) === 1 ? '' : 's'}`;
  return `🏪 ${RIVAL_NAME} has offered them a job. Lift their morale above ${POACH_MORALE} ${when}, or they will take it.`;
}
