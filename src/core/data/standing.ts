// The center's standing, and the rival across the street. A center climbs through grades from the rooms it works in,
// how fine they are, its staff and their ranks, and the guests it has healed; a higher grade brings more guests and
// applicants, and guests who expect more.

import type { IconId } from './icon-ids';

/** One grade of standing: what it is called, and the points it takes. */
export interface GradeDef {
  name: string;
  icon: IconId;
  points: number;
}

export const GRADES: readonly GradeDef[] = [
  { name: 'Back-Room Practice', icon: 'standing-practice', points: 0 },
  { name: 'Wellness Studio', icon: 'standing-studio', points: 80 },
  { name: 'Wellness Center', icon: 'standing-center', points: 180 },
  { name: 'Healing Center', icon: 'standing-healing-center', points: 320 },
  { name: 'Healing Institute', icon: 'standing-institute', points: 500 },
];

/**
 * Points for each finished room in use, where guests are seen, treated or taught and someone on the payroll can work,
 * and for each star of its prestige; and for any other room, a Restroom say, or a Massage Suite nobody can work in.
 */
export const ROOM_POINTS = 12;
export const PRESTIGE_POINTS = 4;
export const IDLE_ROOM_POINTS = 4;
/** Points for each rank a member of staff holds, from 1 for a Trainee to 5 for an Expert. */
export const RANK_POINTS = 3;
/** Guests healed for each point: every guest the center has healed counts, and keeps counting. */
export const HEALS_A_POINT = 5;

/** How many more guests arrive for each grade above the first. */
export const GRADE_ARRIVALS = 0.08;
/** The prestige guests expect of a treatment room at each grade, below which it lets them down. */
export const GRADE_EXPECTS: readonly number[] = [0, 0, 2, 2, 3];
/** How much better the applicants are for each grade above the first, added to the best skill they may have. */
export const GRADE_APPLICANT_SKILL = 0.25;

/** The franchise across the street, and the day it opens. */
export const RIVAL_NAME = 'ZenMart';
export const RIVAL_SLOGAN = 'Inner peace in ten minutes or your money back';
export const RIVAL_OPENS = 45;
/**
 * The rival's standing when it opens, and how much it grows each day after: up to its ceiling, a share more than the
 * center's own standing, so it keeps ahead of a center that stands still and can be caught by one that grows. Above
 * it, as when the center's standing falls, it shrinks back as fast as it would grow. It never falls below where it
 * started.
 */
export const RIVAL_START_POINTS = 80;
export const RIVAL_GROWTH = 0.45;
export const RIVAL_CEILING = 1.25;
/**
 * What the center can do about it: each VIP delighted takes a share of its points off, word of mouth takes points off
 * every day it runs (and it does not grow meanwhile), and winning Center of the Year takes a bigger share off.
 */
export const RIVAL_VIP_KNOCK = 0.05;
export const RIVAL_WORD_FALL = 0.15;
export const RIVAL_AWARD_KNOCK = 0.1;

/** Days between one of the rival's sales and the next, how long each lasts, and how much it takes off its prices. */
export const SALE_GAP_DAYS: readonly [number, number] = [40, 80];
export const SALE_DAYS = 10;
export const SALE_DISCOUNT = 0.25;
/** The share of guests a sale draws away from a center charging full price or more. */
export const SALE_DRAW = 0.3;
/** The share of guests the rival draws away for each grade it stands above the center. */
export const RIVAL_LEAD_DRAW = 0.05;

/** Days between the rival's attempts to hire staff away, the morale below which they listen, and days to answer. */
export const POACH_GAP_DAYS: readonly [number, number] = [20, 40];
export const POACH_MORALE = 35;
export const POACH_DAYS = 5;
