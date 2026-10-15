// The center's standing, and the rival across the street. A center climbs through grades from its rooms, how fine
// they are, and its staff; a higher grade brings more guests and applicants, and guests who expect more.

/** One grade of standing: what it is called, and the points it takes. */
export interface GradeDef {
  name: string;
  icon: string;
  points: number;
}

export const GRADES: readonly GradeDef[] = [
  { name: 'Back-Room Practice', icon: '🚪', points: 0 },
  { name: 'Wellness Studio', icon: '🌱', points: 80 },
  { name: 'Wellness Center', icon: '🌿', points: 180 },
  { name: 'Healing Center', icon: '🌳', points: 320 },
  { name: 'Healing Institute', icon: '🏛️', points: 500 },
];

/** Points for each finished room, and for each star of its prestige. */
export const ROOM_POINTS = 10;
export const PRESTIGE_POINTS = 4;
/** Points for each member of staff, and for each rank they hold. */
export const STAFF_POINTS = 4;
export const RANK_POINTS = 2;

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
/** The rival's standing when it opens, and how much it grows each day after. */
export const RIVAL_START_POINTS = 80;
export const RIVAL_GROWTH = 0.45;

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
