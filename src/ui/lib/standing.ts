// Words and figures for the center's standing and the rival across the street.

import {
  DAYS_PER_MONTH,
  GRADE_ARRIVALS,
  GRADE_EXPECTS,
  type GradeDef,
  GRADES,
  POACH_MORALE,
  RIVAL_AWARD_KNOCK,
  RIVAL_CEILING,
  RIVAL_GROWTH,
  RIVAL_NAME,
  RIVAL_OPENS,
  RIVAL_VIP_KNOCK,
  RIVAL_WORD_FALL,
} from '../../core/data';
import { dateOf } from '../../core/format';
import type { RivalCourse } from '../../core/sim/rival';
import type { StandingPoints } from '../../core/sim/standing';

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

/** Where the standing points come from, in one line. */
export function standingLine(p: StandingPoints): string {
  const rooms = p.idle ? `Rooms ${p.rooms} (${p.inUse} in use, ${p.idle} not)` : `Rooms ${p.rooms}`;
  return `${rooms} · Prestige ${p.prestige} · Staff ${p.staff} · Guests healed ${p.heals}`;
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

/** When the rival is due to open, or has, in a game that opened in `startMonth`: a line for the Standing tab. */
export function rivalOpening(opened: number | null, on: boolean, startMonth = 0): string {
  if (!on) return 'There is no rival in this game.';
  if (opened === null) {
    const d = dateOf(RIVAL_OPENS, startMonth);
    return `A ${RIVAL_NAME} is due to open across the street around day ${d.day} of month ${d.month}.`;
  }
  const d = dateOf(opened, startMonth);
  return `Open across the street since day ${d.day} of month ${d.month}.`;
}

/** Which way the rival's standing is going, against its ceiling, in words. */
export function rivalCourseLine(course: RivalCourse, ceiling: number): string {
  const share = `${Math.round((RIVAL_CEILING - 1) * 100)}% more than your own standing`;
  if (course === 'losing')
    return `Losing about ${Math.round(RIVAL_WORD_FALL * DAYS_PER_MONTH)} points a month while your word of mouth runs.`;
  if (course === 'growing')
    return `Growing about ${Math.round(RIVAL_GROWTH * DAYS_PER_MONTH)} points a month, up to ${share}: ${ceiling} points now.`;
  return `As big as it gets for now, at ${share}: ${ceiling} points. It grows again as you do.`;
}

/** A share as a whole percentage. */
const pct = (share: number) => `${Math.round(share * 100)}%`;

/** What the center can do about the rival, and what it has done so far. */
export function counterplayLine(knocked: number): string {
  const done = knocked >= 1 ? ` You have knocked ${Math.round(knocked)} points off it so far.` : '';
  return `Each VIP you delight takes ${pct(RIVAL_VIP_KNOCK)} off it, word of mouth stops it growing and takes about ${Math.round(RIVAL_WORD_FALL * DAYS_PER_MONTH)} points a month off it while it runs, and winning Center of the Year takes ${pct(RIVAL_AWARD_KNOCK)} off.${done}`;
}

/** The share of guests the rival is drawing away, in words. */
export function drawNote(draw: number): string {
  if (draw <= 0) return 'Not drawing your guests away at the moment.';
  return `Drawing away about ${Math.round(draw * 100)}% of the guests who would come to you.`;
}

/** The warning on someone the rival has made an offer to. */
export function offerWarning(daysLeft: number): string {
  const when = daysLeft < 1 ? 'today' : `within ${Math.ceil(daysLeft)} day${Math.ceil(daysLeft) === 1 ? '' : 's'}`;
  return `${RIVAL_NAME} has offered them a job. Lift their morale above ${POACH_MORALE} ${when}, or they will take it.`;
}
