// The center's standing: points from the rooms it works in and how fine they are, its staff and their ranks, and the
// guests it has healed, which carry it up through the grades. A grade once reached is kept. Each brings more guests
// and better applicants, and guests who expect more.

import {
  centerOf,
  GRADE_ARRIVALS,
  GRADE_EXPECTS,
  type GradeDef,
  GRADES,
  HEALS_A_POINT,
  IDLE_ROOM_POINTS,
  PRESTIGE_POINTS,
  RANK_POINTS,
  ROOM_POINTS,
  ROOMS,
} from '../data';
import type { GameState, Room } from '../state/types';
import { at } from '../util';
import { prestige } from './ambience';
import type { SimContext } from './context';
import { emit, toast } from './events';

/**
 * What a center's standing is made of: its rooms (those in use, and the rest), the prestige of those in use, its
 * staff, and the guests it has healed, with the total. `inUse` and `idle` count the rooms of each kind, and
 * `unstaffed` the rooms that would be in use with someone on the payroll to work in them.
 */
export interface StandingPoints {
  rooms: number;
  prestige: number;
  staff: number;
  heals: number;
  total: number;
  inUse: number;
  idle: number;
  unstaffed: number;
}

/** Points for a room in use: for being built, and for each star of its prestige. */
export const roomPoints = (stars: number) => ROOM_POINTS + PRESTIGE_POINTS * stars;

/** Points for a member of staff, by their rank. */
export const staffPoints = (rank: number) => RANK_POINTS * rank;

/** Points for the guests healed: a point for every few. */
export const healPoints = (healed: number) => Math.floor(healed / HEALS_A_POINT);

/** Whether a room is in use: one where staff see guests, with someone on the payroll who can work in it. */
export function inUse(s: GameState, room: Room): boolean {
  const role = ROOMS[room.type].staff;
  return room.done && !!role && s.staff.some((st) => st.role === role && st.state !== 'leaving');
}

/**
 * The center's standing points as it is now: finished rooms, the more for those in use and their prestige; staff
 * who are not on their way out, by rank; and every guest healed.
 */
export function standingPoints(ctx: SimContext): StandingPoints {
  const s = ctx.s;
  const rooms = s.rooms.filter((r) => r.done);
  const working = rooms.filter((r) => inUse(s, r));
  const idle = rooms.length - working.length;
  const built = working.length * ROOM_POINTS + idle * IDLE_ROOM_POINTS;
  const fine = working.reduce((sum, r) => sum + PRESTIGE_POINTS * prestige(ctx, r), 0);
  const team = s.staff.filter((st) => st.state !== 'leaving').reduce((sum, st) => sum + staffPoints(st.skill), 0);
  const heals = healPoints(s.stats.healed);
  return {
    rooms: built,
    prestige: fine,
    staff: team,
    heals,
    total: built + fine + team + heals,
    inUse: working.length,
    idle,
    unstaffed: rooms.filter((r) => !working.includes(r) && ROOMS[r.type].staff).length,
  };
}

/**
 * What staffing the rooms nobody can work in would add, as a line for the Standing tab and the grade goals, or '' when
 * every room that needs staff has someone.
 */
export function idleNote(pts: StandingPoints): string {
  const n = pts.unstaffed;
  if (!n) return '';
  const more = n * (ROOM_POINTS - IDLE_ROOM_POINTS);
  return n === 1
    ? `1 room nobody on the payroll can work in counts only ${IDLE_ROOM_POINTS} points: staffing it adds at least ${more}`
    : `${n} rooms nobody on the payroll can work in count only ${IDLE_ROOM_POINTS} points each: staffing them adds at least ${more}`;
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
  emit(ctx, { type: 'announce', text: `We are now a ${g.name}. Thank you for bringing us your knots.` });
  toast(
    ctx,
    `The center has risen to ${g.name}: more guests and better applicants, and guests who expect finer rooms.`,
    'good',
    undefined,
    g.icon,
  );
  emit(ctx, { type: 'sfx', name: 'fanfare' });
}
