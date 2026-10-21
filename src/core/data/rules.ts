// The numbers that tune the game: time, fees, loans and wear. Each center's goals are in centers.ts.

import type { Role } from './types';

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

/** What a posture scan costs: a little more than a consultation. */
export const ASSESS_FEE = 250;
/** How much likelier a guest's treatment is to work once a posture scan has shown just where to work. */
export const SCAN_SUCCESS = 0.1;
export const WINDOW_COST = 150;
/** What each tile added to a built room costs. Each tile taken away gives back half. */
export const ROOM_TILE_COST = 200;

/** Windows beyond this many add nothing more to a room's prestige. */
export const WINDOW_MAX_BONUS = 4;
export const LOAN_STEP = 5000;

export const LOAN_MAX = 50000;

/** Interest charged on the outstanding loan each month. */
export const LOAN_RATE = 0.02;

/** Interest charged each month on a bank balance below zero, which is dearer than a loan. */
export const OVERDRAFT_RATE = 0.05;

/**
 * How long the bank gives a center that is in the red and losing money to put one of the two right, before it calls the
 * overdraft in and the center is bankrupt: ten days, a third of a month. Long enough for a price change or a leaver to
 * show in the books, and for something to be sold; short enough that living there is no plan. Prison Architect gives
 * a day; the three days this game gave to find unpaid wages passed in eighteen seconds.
 */
export const INSOLVENCY_DAYS = 10;

/**
 * How much lower staff morale settles while the bank is in the red, worried about their wages, and how much lower
 * once it has been there a month, when they also ask for a raise to stay.
 */
export const RED_MORALE = 10;
export const RED_MONTH_MORALE = 20;
export const PRICE_MIN = 0.5;

export const PRICE_MAX = 2;

/**
 * The chance a new guest balks at the price of their treatment once diagnosed, and leaves, as knots joined by straight
 * lines: `price`, the treatment's price against standard and the chance at 50% reputation; `reputation`, how far a
 * center's name moves that curve along the price, a reputation and the price it adds. A plain regular minds the price
 * half as much (`REGULAR_PUT_OFF`); loyal and devoted regulars and emergency guests never balk.
 *
 * Fitted to what the guests are, not to a formula (balance log entry 35): in the good bot's second year a diagnosed
 * guest is new 26% of the time, a plain regular 6%, loyal or devoted 55% and an emergency 13%, so about 0.29 of them
 * mind the price in full. The knots are the targets for every diagnosed guest divided by that: gentle to 1.3 and steep
 * past it, about 1% at 1.1, 3% at 1.2, 5% at 1.3, 10% at 1.4 and 20% at 1.6 at 50% reputation. Half at 2 cannot be had
 * while loyal regulars are spared, so the top flattens toward nearly every new guest. A center at 90% is forgiven
 * 0.15 more on the price, one at 20% 0.15 less, though at standard prices or below no one balks, however poor the
 * name. Beyond the last knots the curve stays level. CorsixTH's price
 * distortion has the tolerated price rise with reputation the same way.
 */
export const PRICE_PUT_OFF = {
  price: [
    [1, 0],
    [1.1, 0.03],
    [1.2, 0.1],
    [1.3, 0.17],
    [1.4, 0.34],
    [1.6, 0.68],
    [2, 0.9],
    [2.4, 0.95],
  ],
  reputation: [
    [20, -0.15],
    [50, 0],
    [90, 0.15],
  ],
} as const satisfies Record<string, readonly (readonly [number, number])[]>;

/** How much a plain regular minds the price against a new guest: half. Loyal and devoted regulars never balk. */
export const REGULAR_PUT_OFF = 0.5;

/** How many times a piece of treatment equipment can be upgraded. Each level unlocks at the star of the same number. */
export const UPGRADE_LEVELS = 3;
/** What each level costs, as a share of the equipment's upgrade price: the first, the second and the third. */
export const UPGRADE_PRICE: readonly number[] = [0.5, 0.75, 1];
/** How fast equipment wears at each level, from none to the top: a third more slowly, half, then two thirds. */
export const UPGRADE_WEAR: readonly number[] = [1, 0.7, 0.5, 0.35];
/** What each level adds to the chance of a treatment working there. */
export const UPGRADE_SUCCESS = 0.03;
/** How long a Mechanic takes to install an upgrade, in seconds of game time before their speed is counted. */
export const INSTALL_SECONDS = 20;

/** The Qi Gong classes as Settings shows them, to switch on or off like an optional discipline. */
export const QIGONG_SETTING = {
  icon: '☯️',
  name: 'Qi Gong classes',
  desc: 'From the second star, a Qi Gong Studio holds weekly classes for guests who come in just for them.',
} as const;

/** What a place in a Qi Gong class costs at standard prices. */
export const CLASS_FEE = 130;
/** The days of the week a new Qi Gong Studio holds classes: Monday, Wednesday and Friday. */
export const CLASS_DAYS: readonly number[] = [0, 2, 4];
/** The days of the week, from Monday, as the timetable shows them. */
export const WEEKDAYS: readonly string[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/** How long a Qi Gong class lasts, in seconds of game time before the Instructor's pace is counted. */
export const CLASS_SECONDS = 6;
/** Days after their class day that class-goers who never had it give up and go home. */
export const CLASS_PATIENCE = 3;
/** How many days before a class its places are booked and its class-goers set off. */
export const BOOK_AHEAD = 2;
/**
 * Days at normal speed at least between one call over the speakers that a class is starting and the next, so it is not
 * heard every class. At a faster speed the gap is as long in real time, and so more days.
 */
export const CLASS_CALL_GAP = 14;
/**
 * How many class-goers a week a studio draws, before its reputation and its Instructor's rank are counted: about 13 at
 * 50% reputation, 21 at 80% and 25 at the top, shared among the week's classes. More Practice Spots do not draw more;
 * they only let a class hold more.
 */
export const CLASS_WEEKLY = 14;
/**
 * How many Practice Spots a Qi Gong Instructor can lead a class on, by rank from Trainee to Expert. Kept to 12 at most:
 * a bigger class sent more guests into the center at once, to the shop and the restrooms, than it could cope with.
 */
export const CLASS_PLACES: readonly number[] = [6, 8, 9, 11, 12];

/** How long a guest lies back in a Recovery Lounge after a treatment that leaves them needing a rest. */
export const REST_SECONDS = 15;
/** Taken off the chance of such a treatment working when there is no free Recliner to rest on afterwards. */
export const NO_REST_PENALTY = 0.1;
/** How many times over a psychedelic ceremony feels its room's set and setting: its vibes, noise, linens and prestige. */
export const SETTING_WEIGHT = 2;
/** What a lodge too hot or too cold for comfort takes off a psychedelic ceremony's chance, at its worst. */
export const TRIP_DISCOMFORT = 0.15;
/** What a bad trip costs in reputation, on top of a failed treatment. */
export const BAD_TRIP_REP = 1.5;
/** How many times faster a Shaman clears bad vibes than sage does. */
export const SHAMAN_CLEARING = 2;
/** How many days the blessing a Shaman leaves on a room they clear lasts. */
export const BLESS_DAYS = 7;
/** What a blessed room adds to the chance of a treatment there working. */
export const BLESS_BONUS = 0.04;
/** Morale below which a member of staff is burnt out enough for a Shaman to retrieve their soul. */
export const SOUL_MORALE = 50;
/** How much morale a soul retrieval gives back. */
export const SOUL_LIFT = 40;
/** What a soul retrieval takes out of the Shaman's energy. */
export const SOUL_ENERGY = 20;
/** Seconds a soul retrieval takes, at normal speed. */
export const SOUL_SECONDS = 6;
/** The chance a Shop Counter sale comes with magic mushrooms from under the counter, while they are on sale. */
export const MUSHROOM_CHANCE = 0.35;
/** What a bag of magic mushrooms sells for, give or take a fifth. */
export const MUSHROOM_SALE = 180;
/** What the health inspector finding the mushrooms adds to the fine, and takes off the center's reputation. */
export const MUSHROOM_FINE = 6000;
export const MUSHROOM_REP = 5;
/** What making a failed inspection go away costs: so many times the fine, and never less than a floor. */
export const BRIBE_TIMES = 2;
export const BRIBE_MIN = 10000;
/** The chance word of a bribe gets out, what that costs in reputation, and how soon the inspector is back then. */
export const BRIBE_LEAK = 0.1;
export const BRIBE_REP = 6;
export const BRIBE_RECHECK_DAYS = 30;
/** The chance a Shaman's ward against a mishap holds, and how long performing it takes them. */
export const WARD_CHANCE = 0.75;
export const WARD_SECONDS = 8;

/** Caretakers start repairing equipment at this much wear; at 100 it is broken. */
export const WEAR_REPAIR = 50;
/** Caretakers start cleaning at this much grime. */
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
/** The chance a round on the Fortune Teller says the guest will be healed today, and leaves them fully patient. */
export const LUCKY_FORTUNE = 0.15;
/** How worn a Kombucha Tap is before it may fizz over, and the chance each time it is used then that it does. */
export const FIZZ_WEAR = 60;
export const FIZZ_CHANCE = 0.3;
/** How fast someone walks across a puddle, against usual. */
export const PUDDLE_SLOW = 0.55;
/** How fast a Staff Fridge in the Staff Room sees to the thirst and hunger of staff on a break, in points a second. */
export const FRIDGE_REFRESH = 20;
/** How much each Motivational Poster in a Staff Room lifts the morale everyone settles toward, and how many count. */
export const POSTER_MORALE = 2;
export const POSTER_MAX = 2;
/** How much faster staff get their energy back on a break with a Wall Clock in the room: they keep an eye on it. */
export const CLOCK_BREAK_BOOST = 1.25;
/** How far a waiting guest can see a Wall Clock from, in tiles, and how much faster they lose patience watching it. */
export const CLOCK_SIGHT = 6;
export const CLOCK_DRAIN = 1.1;
/** How much more often treatments work in a room with a Chakra Chart or a Meridian Poster on its wall. */
export const CHART_BONUS = 0.02;
/** How far waiting guests can watch a Television from, in tiles, and how fast they lose patience watching it. */
export const TV_RANGE = 4;
export const TV_CALM = 0.8;
/** How fast a seated guest loses patience against standing, unless the seat says otherwise. */
export const SEAT_DRAIN = 0.6;

/** How many tiles an item's decor reaches, unless the item says otherwise. */
export const DECOR_RADIUS = 4;
/** How much each point of pleasantness on a tile slows the patience of anyone waiting there, until it can slow no more. */
export const DECOR_CALM = 0.035;
/**
 * How much more an item's good decor counts where it reaches, and how many tiles past its reach it would take to fade
 * to nothing: it fades more gently than litter or grime, so it is still felt toward the edge of its reach.
 */
export const DECOR_BOOST = 1.2;
export const DECOR_FADE = 2;
/** How sure a diagnosis must be before treatment, unless the policy says otherwise, and the range it can be set in. */
export const DIAGNOSIS_TARGET = 0.75;
export const DIAGNOSIS_MIN = 0.5;
export const DIAGNOSIS_MAX = 0.95;
/** The energy at which staff stop for a break, unless the policy says otherwise, and the range it can be set in. */
export const BREAK_AT = 18;
export const BREAK_AT_MIN = 10;
export const BREAK_AT_MAX = 50;
/**
 * How an Instructor fits their breaks around the classes: they rest only when the next class is at least `REST_GAP`
 * days off, and then a little early, at `REST_AHEAD` more energy than the policy says, unless they fall below
 * `BREAK_EXHAUSTED` first. A resting Instructor gets up once rested that far, if it is the last chance to walk back and
 * call the class-goers to their spots with `REST_RETURN` of the class day to spare.
 */
export const REST_GAP = 2;
export const REST_AHEAD = 15;
export const BREAK_EXHAUSTED = 10;
export const REST_RETURN = 0.5;
/** The energy a break gives back each second, before a coffee machine or a clock speeds it. */
export const BREAK_REST = 9;
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
/**
 * What a house call pays a day for someone of the first rank, and how much more for each rank above it: about what
 * they would earn at home, where a table treats a guest in about two days at fees of $900 to $2,000.
 */
export const CALL_PER_DAY = 600;
export const CALL_RANK_BONUS = 0.15;
/** What sending a guest home costs in reputation: less than a failed treatment. */
export const SEND_HOME_REP = 1;

/** Share of guests and applicants who get a cameo name instead of a generated one. */
export const CAMEO_CHANCE = 0.12;

/** Seconds a group session waits for its mats to fill after the first guest lies down, before it starts anyway. */
export const SESSION_WAIT = 8;
/** How many mats a Sound Healer can play for at once, by rank from Trainee to Expert. */
export const SOUND_MATS: readonly number[] = [2, 2, 3, 3, 4];
/**
 * How much more often guests come for a discipline, for a fine room to have it in: for each prestige star past the
 * first, for a peaceful room, and in a Sound Bath Studio for each mat past the two it needs, up to a limit.
 */
export const ROOM_PULL = { star: 0.35, calm: 0.6, mat: 0.2, max: 2 } as const;
/**
 * A discipline's following, from 0 (nobody has heard of it) to 100: where a discipline new to the center starts, and
 * massage in a new game; what each guest healed adds (less as it grows), what each failure or guest who gives up takes
 * away, and how much of it fades in a month with nobody treated. A discipline healing about 40% of its guests holds
 * its own from nothing, 50% at 40 and 75% at 80.
 */
export const FOLLOWING = { start: 20, established: 40, heal: 5, fail: 3, walkout: 2, fade: 0.05 } as const;
/**
 * How many more guests arrive for each staffed treatment station past the first (a table, or a mat a Sound Healer can
 * play for, with someone in its role on the payroll and at work to work it), and the most it comes to: six staffed
 * tables draw 1.6 times the guests of one, and the pace stops growing at 2.5 times, from 14 stations.
 */
export const CAPACITY_ARRIVALS = { each: 0.12, most: 2.5 } as const;
/**
 * How many treatment stations one staffed Consultation Room can keep in guests: every guest is seen there first, so
 * stations past this many for each one draw nobody more, and count nothing toward the guests let in at once.
 */
export const CONSULT_FEEDS = 4;
/**
 * How many guests the building lets in at once, from what it can treat: `base`, and more for each staffed treatment
 * station and each staffed consulting room. A center that has outgrown its tables turns the rest away rather than
 * filling its corridors.
 */
export const GUEST_CAP = { base: 4, station: 2, consult: 2 } as const;
/**
 * How a long line for a discipline's treatment puts new guests off it: nobody while there are up to `easy` guests
 * waiting for each of its practitioners, then `each` fewer for every one more, and at most `most` fewer. Those put off
 * do not come, so guests arrive less often too.
 */
export const LINE_PUT_OFF = { easy: 3, each: 0.1, most: 0.5 };
/**
 * How a following multiplies how often guests come for a discipline: three quarters as often with none, up to 1.75×
 * at 100. Kept narrow, since the busiest discipline, with the most guests to heal, builds the biggest following.
 */
export const followingPull = (following: number) => 0.75 + following / 100;

/** Share of applicants for each role who are women: most of those at the desk and the tables, few caretakers. */
export const WOMEN_APPLY: Readonly<Record<Role, number>> = {
  receptionist: 0.7,
  consultant: 0.7,
  therapist: 0.7,
  acupuncturist: 0.7,
  practitioner: 0.7,
  healer: 0.7,
  instructor: 0.6,
  shaman: 0.5,
  caretaker: 0.3,
};
/** Share of guests and visitors who are women. */
export const WOMEN_VISIT = 0.5;
