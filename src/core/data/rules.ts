// The numbers that tune the game: time, fees, loans and wear. Each center's goals are in centers.ts.

export const DAY_SECONDS = 6;
/** Days an emergency stays on offer, and days to heal its guests once accepted. */
export const OFFER_DAYS = 8;
export const EMERGENCY_DAYS = 25;
/** Below this morale a member of staff is miserable, and the clock toward quitting runs. */
export const MISERABLE_MORALE = 25;
/** Seconds of misery before they say they are thinking of quitting, and before they walk out. */
export const QUIT_THINKING = 20;
export const QUIT_AFTER = 60;
/** How long before walking out the alarm goes up: two days. */
export const QUIT_WARNING = 2 * DAY_SECONDS;
export const DAYS_PER_MONTH = 30;

/** Stone warmers lose this much heat per Hot Stone session and are useless below it. */
export const STONE_USE = 25;

/** Chance of success is multiplied by this when the modality cannot be delivered properly. */
export const BOTCH_FACTOR = 0.35;
export const CONSULT_FEE = 200;

export const ASSESS_FEE = 150;
export const WINDOW_COST = 150;
/** What each tile added to a built room costs. Each tile taken away gives back half. */
export const ROOM_TILE_COST = 200;

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
/** How fast a seated guest loses patience against standing, unless the seat says otherwise. */
export const SEAT_DRAIN = 0.6;

export const DECOR_RADIUS = 4;
/** How sure a diagnosis must be before treatment, unless the policy says otherwise, and the range it can be set in. */
export const DIAGNOSIS_TARGET = 0.75;
export const DIAGNOSIS_MIN = 0.5;
export const DIAGNOSIS_MAX = 0.95;
/** The energy at which staff stop for a break, unless the policy says otherwise, and the range it can be set in. */
export const BREAK_AT = 18;
export const BREAK_AT_MIN = 10;
export const BREAK_AT_MAX = 50;
/** Days from a staff challenge being set to its deadline, at least and at most. */
export const CHALLENGE_DAYS_MIN = 60;
export const CHALLENGE_DAYS_MAX = 120;
/** Days between one staff challenge ending and the next being set, at least and at most. */
export const CHALLENGE_GAP_MIN = 30;
export const CHALLENGE_GAP_MAX = 60;
/** How much every member of staff cheers up when a challenge is met, and how much its setter sulks when it is not. */
export const CHALLENGE_MORALE = 12;
export const CHALLENGE_SULK = 10;
/** Days between one house call being offered and the next, at least and at most, and days an offer stays open. */
export const CALL_GAP_MIN = 25;
export const CALL_GAP_MAX = 45;
export const CALL_OFFER_DAYS = 6;
/** What a house call pays a day for someone of the first rank, and how much more for each rank above it. */
export const CALL_PER_DAY = 1200;
export const CALL_RANK_BONUS = 0.25;
/** What sending a guest home costs in reputation: less than a failed treatment. */
export const SEND_HOME_REP = 1;

/** Share of guests and applicants who get a cameo name instead of a generated one. */
export const CAMEO_CHANCE = 0.12;
