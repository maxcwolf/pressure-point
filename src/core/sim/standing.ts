// The center's standing: points from its rooms, how fine they are, and its staff, which carry it up through the
// grades. A grade once reached is kept. Each brings more guests and better applicants, and guests who expect more.

import {
  centerOf,
  GRADE_ARRIVALS,
  GRADE_EXPECTS,
  type GradeDef,
  GRADES,
  PRESTIGE_POINTS,
  RANK_POINTS,
  ROOM_POINTS,
  STAFF_POINTS,
} from '../data';
import type { GameState } from '../state/types';
import { at } from '../util';
import { prestige } from './ambience';
import type { SimContext } from './context';
import { emit, toast } from './events';

/** What a center's standing is made of: its rooms, their prestige, and its staff, with the total. */
export interface StandingPoints {
  rooms: number;
  prestige: number;
  staff: number;
  total: number;
}

/** Points for a room: for being built, and for each star of its prestige. */
export const roomPoints = (stars: number) => ROOM_POINTS + PRESTIGE_POINTS * stars;

/** Points for a member of staff: for being on the payroll, and for each rank. */
export const staffPoints = (rank: number) => STAFF_POINTS + RANK_POINTS * rank;

/** The center's standing points as it is now: finished rooms and staff who are not on their way out. */
export function standingPoints(ctx: SimContext): StandingPoints {
  const rooms = ctx.s.rooms.filter((r) => r.done);
  const staff = ctx.s.staff.filter((st) => st.state !== 'leaving');
  const built = rooms.length * ROOM_POINTS;
  const fine = rooms.reduce((sum, r) => sum + PRESTIGE_POINTS * prestige(ctx, r), 0);
  const team = staff.reduce((sum, st) => sum + staffPoints(st.skill), 0);
  return { rooms: built, prestige: fine, staff: team, total: built + fine + team };
}

/** The grade some points earn, from 0. */
export function gradeFor(points: number): number {
  let grade = 0;
  for (const [i, g] of GRADES.entries()) if (points >= g.points) grade = i;
  return grade;
}

/** A grade's details. */
export const gradeDef = (grade: number): GradeDef => at(GRADES, Math.min(grade, GRADES.length - 1));

/** The grade after this one, if there is one. */
export const nextGrade = (grade: number): GradeDef | undefined => GRADES[grade + 1];

/** How many more guests arrive at a grade than at the first, as a multiplier. */
export const gradeArrivals = (grade: number) => 1 + GRADE_ARRIVALS * grade;

/** The prestige guests expect of a treatment room here, below which it lets them down: more as the center rises. */
export function expectedPrestige(s: GameState): number {
  // picky guests expect more on top
  return at(GRADE_EXPECTS, Math.min(s.grade, GRADE_EXPECTS.length - 1)) + (centerOf(s).picky?.expects ?? 0);
}

/** Climb to the grade the center's points now earn, announcing it. A center never drops a grade. */
export function updateStanding(ctx: SimContext) {
  const s = ctx.s;
  if (!s.open) return;
  const reached = gradeFor(standingPoints(ctx).total);
  if (reached <= s.grade) return;
  s.grade = reached;
  const g = gradeDef(reached);
  emit(ctx, { type: 'announce', text: `We are now a ${g.name}. Thank you for your custom, and your knots.` });
  toast(
    ctx,
    `${g.icon} The center has risen to ${g.name}: more guests and better applicants, and guests who expect finer rooms.`,
    'good',
  );
  emit(ctx, { type: 'sfx', name: 'fanfare' });
}
