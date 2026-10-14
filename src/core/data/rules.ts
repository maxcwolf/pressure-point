// The numbers that tune the game: time, fees, loans, wear and the goals for each star.

import type { StarGoal } from './types';

export const DAY_SECONDS = 6;
export const DAYS_PER_MONTH = 30;

export const START_MONEY = 30000;

/** Stone warmers lose this much heat per Hot Stone session and are useless below it. */
export const STONE_USE = 25;

/** Chance of success is multiplied by this when the modality cannot be delivered properly. */
export const BOTCH_FACTOR = 0.35;
export const CONSULT_FEE = 200;

export const ASSESS_FEE = 150;
export const WINDOW_COST = 150;

/** Windows beyond this many add nothing more to a room's prestige. */
export const WINDOW_MAX_BONUS = 4;
export const LOAN_STEP = 5000;

export const LOAN_MAX = 50000;

/** Interest charged on the outstanding loan each month. */
export const LOAN_RATE = 0.02;
export const PRICE_MIN = 0.5;

export const PRICE_MAX = 2;

/** Janitors start repairing equipment at this much wear; at 100 it is broken. */
export const WEAR_REPAIR = 50;
/** Janitors start cleaning at this much grime. */
export const DIRT_CLEAN = 40;
/** From this much grime it is filthy: guests are put off and it spoils its surroundings. */
export const DIRT_FILTHY = 70;
/** What a filthy item does to its surroundings, in place of its usual decor. */
export const FILTHY_DECOR = -2;
/** How much patience a guest loses using a filthy toilet. */
export const FILTHY_PATIENCE = 12;

/** How far a decorative item's effect reaches, in tiles. */
/** How much faster staff get their energy back on a break with an Espresso Machine in the room. */
export const COFFEE_BREAK_BOOST = 1.5;
/** How much a Pool Table in a Staff Room lifts the morale everyone settles toward. */
export const POOL_TABLE_MORALE = 5;
/** How much faster a course goes for each bookcase in its Training Room, and how many count. */
export const BOOKCASE_SPEEDUP = 0.2;
export const BOOKCASE_MAX = 2;
/** A waiting guest whose patience falls below this goes looking for a game to play. */
export const BORED_PATIENCE = 60;
/** How far a bored guest will walk to play, in tiles. */
export const PLAY_RANGE = 12;
/** How much patience a round on the arcade gives back. */
export const PLAY_PATIENCE = 25;

export const DECOR_RADIUS = 4;
export const DIAGNOSIS_TARGET = 0.75;

export const STAR_GOALS: readonly StarGoal[] = [
  { healed: 8, reputation: 40, balance: 0 },
  { healed: 30, reputation: 60, balance: 50000 },
  { healed: 80, reputation: 80, balance: 120000 },
];

/** Share of guests and applicants who get a cameo name instead of a generated one. */
export const CAMEO_CHANCE = 0.12;
