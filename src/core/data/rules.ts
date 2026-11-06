// The numbers that tune the game: time, fees, loans and wear, staff at work, guests, and how treatments go. Each
// center's goals are in centers.ts.

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
/** How sure a consultation can be of a structural condition: only a posture scan makes it surer. */
export const STRUCTURAL_SURE = 0.6;
/** How much less likely a treatment is to work when it is a best guess at a structural condition nobody scanned. */
export const GUESS_PENALTY = 0.05;
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
 * The paydays a new center meets before its takings have a record: the opening's, through which the Payroll tab weighs
 * a month's wages against the bank and the loan left whatever they hold. The Orchard Estate's opening, with every
 * discipline built and staffed at once, is down to less than one payday in hand by the first, and the bank called the
 * overdraft in at the third in 4 games of 12 (balance log 39).
 */
export const FIRST_PAYDAYS = 3;

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
  icon: 'technique-qigong',
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
/** Taken off the chance of such a treatment working when there is no free Lounger to rest on afterwards. */
export const NO_REST_PENALTY = 0.1;
/** How many times over a psychedelic ceremony feels its room's set and setting: its vibes, noise, linens and prestige. */
export const SETTING_WEIGHT = 2;
/** What a lodge too hot or too cold for comfort takes off a psychedelic ceremony's chance, at its worst. */
export const TRIP_DISCOMFORT = 0.15;
/** What a bad trip costs in reputation, on top of a failed treatment. */
export const BAD_TRIP_REP = 1.5;
/** The share of bad trips that are really bad: the guest runs round the institute freaking out everyone they pass. */
export const RUNAWAY_CHANCE = 0.1;
/** How long a guest on a really bad trip runs about before they find the door, in seconds: ten days. */
export const RUNAWAY_SECONDS = 60;
/** How fast they run, in tiles a second, and how long they stand and freak out wherever they stop. */
export const RUNAWAY_SPEED = 3.2;
export const RUNAWAY_PAUSE = 2.5;
/** How close they come to someone to freak them out, in tiles, and the patience that costs them. */
export const FREAK_RANGE = 1.5;
export const FREAK_PATIENCE = 10;
/** The chance someone they freak out catches the stress of an outbreak going round, if one is. */
export const FREAK_STRESS = 0.35;
/** How long it takes a member of staff to calm them down, once they have caught up with them. */
export const CALM_SECONDS = 2;
/** A Shaman talks a runner down in this share of the time. */
export const CALM_SHAMAN = 0.5;
/** Bedside Manner takes this much off anyone's time talking a runner down. */
export const CALM_BEDSIDE = 0.75;
/** What a runner who finds the door costs in reputation, on top of the bad trip. */
export const RUNAWAY_DOOR_REP = 1.5;
/** Calmed within this many days of starting to run, they leave grateful and the center earns back a point of reputation. */
export const RUNAWAY_SAVE_DAYS = 3;
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
/**
 * The offers that may make a failed inspection go away: each a share of the fine it would save, and the chance the
 * inspector takes it. Every one is below the fine, and a bigger one is likelier to be taken.
 */
export const BRIBE_OFFERS: readonly { share: number; odds: number }[] = [
  { share: 0.2, odds: 0.35 },
  { share: 0.4, odds: 0.6 },
  { share: 0.6, odds: 0.85 },
];
/** What each offer comes to for a fine: its share, rounded to $100, and never less than that. */
export const bribeOffers = (fine: number) =>
  BRIBE_OFFERS.map((o) => Math.max(100, Math.round((fine * o.share) / 100) * 100));
/**
 * An offer turned down: the offer is kept, but the fine goes up by this share of it, word gets out, which costs this
 * much reputation on top of the fine's, and the inspector is back within so many days.
 */
export const BRIBE_REFUSED_FINE = 0.25;
export const BRIBE_REP = 6;
export const BRIBE_RECHECK_DAYS = 30;
/** The chance a Shaman's ward against a mishap holds, and how long performing it takes them. */
export const WARD_CHANCE = 0.75;
export const WARD_SECONDS = 8;

/** Caretakers start repairing equipment at this much wear; at 100 it is broken. */
export const WEAR_REPAIR = 50;
/** Equipment shows its wear from here, with smoke, a shudder or a flickering light that grows until it breaks. */
export const WEAR_WARN = 70;
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
/**
 * How long a waiting guest holds on, bursting, before they have an accident, in seconds: with no restroom they can use
 * at all (none built, or none working), and with one but every toilet taken, against 3.5 seconds for a visit to one.
 */
export const HOLD_NO_RESTROOM = 15;
export const HOLD_TOILETS_TAKEN = 40;
/**
 * How long a guest holds on with every toilet taken before the advisor and the Restroom's inspector warn of them, in
 * seconds: a toilet often comes free well before then. With no toilet working at all, they warn at once.
 */
export const HOLD_WARN_TAKEN = 10;
/** The share of accidents that are a poop rather than a puddle of pee. */
export const POOP_SHARE = 0.35;
/** How much patience an accident costs the guest who had it, and the chance they go home there and then. */
export const ACCIDENT_PATIENCE = 40;
export const ACCIDENT_LEAVE = 0.5;
/** How much reputation a guest going home after an accident costs, as one leaving fed up does. */
export const ACCIDENT_REP = 3;
/** How far a waiting guest sees an accident from, in tiles: further than litter, which is 2. */
export const MESS_SIGHT = 3;
/** How much an accident takes off the pleasantness around it, and off its room's prestige: twice what litter does. */
export const MESS_DECOR = -5;
export const MESS_PRESTIGE = 4;
/** How long a poop is left uncleaned before flies come to it, in seconds. */
export const FLIES_AFTER = 30;
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
 * How many guests a signature machine draws for its own ailments, against the guests a month the center draws at its
 * reputation: they come only for the machine, at this share of that pace for each one standing with a practitioner of
 * its own to run it, times its room's pull, and they are not among the guests the tables draw. A machine counts for
 * nothing toward the stations those draw.
 */
export const MACHINE_DRAW = 0.35;
/**
 * How a signature machine's own line puts new guests off it: sooner than a discipline's, since one machine has no
 * table to share its line with. Nobody minds one waiting, then `each` fewer for every one more, and at most `most`.
 */
export const MACHINE_LINE = { easy: 1, each: 0.25, most: 0.75 } as const;
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

// Staff at work: pay and morale, energy, and the time chores take.

/** What a member of staff quitting or poached by the rival costs in reputation. */
export const QUIT_REP = 2;
/** What a raise takes a salary to when it is already at the going rate: 10% more. */
export const RAISE_STEP = 1.1;
/** How much a raise lifts morale. */
export const RAISE_MORALE = 22;
/**
 * The morale staff settle toward at fair pay with nothing else to say about it, and how much it moves for pay above
 * or below fair: `PAY_MORALE` for each fair salary's worth, but no more than `PAY_MORALE_HIGH` up or `PAY_MORALE_LOW`
 * down.
 */
export const MORALE_BASE = 62;
export const PAY_MORALE = 90;
export const PAY_MORALE_HIGH = 20;
export const PAY_MORALE_LOW = 45;
/** Below this energy staff are weary, which takes this much off the morale they settle toward. */
export const WEARY_ENERGY = 20;
export const WEARY_MORALE = 18;
/** How much each star of their room's prestige moves the morale staff at their post settle toward, from this many. */
export const STAR_MORALE = 5;
export const MORALE_STARS = 2;
/** With more than this much litter about, staff settle this much lower. */
export const LITTER_STAFF = 6;
export const LITTER_MORALE = 6;
/** How much of the way to the morale they settle toward staff go each second. */
export const MORALE_DRIFT = 0.03;
/** Staff below this share of fair pay are underpaid, and ask for a raise once their morale falls below the second. */
export const UNDERPAID = 0.97;
export const RAISE_ASK_MORALE = 56;
/** How fast staff walk, in tiles a second. */
export const STAFF_WALK = 2.3;
/** Below this energy staff are worn out: they walk and work slower, and their treatments work less often. */
export const TIRED_ENERGY = 15;
/** How fast worn-out staff walk and work, against usual. */
export const TIRED_WALK = 0.75;
export const TIRED_PACE = 0.6;
/** The energy staff lose each second: busy with a guest (times the work's strain), at their post, and otherwise. */
export const ENERGY_DRAIN = { busy: 0.42, post: 0.14, about: 0.2 } as const;
/** The chance, each time they look for work and find none, that staff wander off somewhere. */
export const WANDER_CHANCE = 0.25;
/** Seconds a lone guest is left waiting at an unworked station before someone idle at another goes over to them. */
export const LONE_WAIT = 3;
/** How long a Caretaker takes to repair something, to clean it, and to pick up litter or water a plant, in seconds. */
export const REPAIR_SECONDS = 3.2;
export const CLEAN_SECONDS = 2.4;
export const CHORE_SECONDS = 1.6;

// Guests: how often they come, what they need while they wait, and how patient they are.

/**
 * The seconds between one new guest and the next with nothing else moving the pace, at no reputation, and how many
 * fewer for each point of reputation.
 */
export const ARRIVAL_SECONDS = 30;
export const ARRIVAL_REP = 0.2;
/** The most thirst, hunger and need for the toilet a guest arrives with. */
export const ARRIVAL_NEEDS = { thirst: 45, hunger: 40, bladder: 40 } as const;
/** How fast a guest's thirst, hunger and need for the toilet grow, in points a second. */
export const NEED_RATES = { thirst: 0.5, hunger: 0.36, bladder: 0.42 } as const;
/** The need for the toilet, thirst and hunger past which a waiting guest breaks off to see to it. */
export const NEED_AT = { toilet: 75, drink: 70, eat: 75 } as const;
/** How long a guest takes on the toilet, at a game and over a drink or a snack, in seconds. */
export const TOILET_SECONDS = 3.5;
export const GAME_SECONDS = 3;
export const SNACK_SECONDS = 2.2;
/** How much patience a drink, a snack or a toilet gives back. */
export const NEED_PATIENCE = 8;
/** How much a drink adds to the need for the toilet. */
export const DRINK_BLADDER = 22;
/** How fast guests walk, in tiles a second, and with a stiff condition not yet healed. */
export const GUEST_WALK = 2.1;
export const STIFF_WALK = 1.75;
/** How fast a waiting guest loses patience, in points a second, before anything around them is counted. */
export const PATIENCE_DRAIN = 0.85;
/** How much faster they lose it once thirst, hunger or the toilet can wait no longer. */
export const NEEDY_DRAIN = 1.6;
/** What a guest leaving fed up costs in reputation. */
export const STORM_REP = 3;
/** Days a complaint waits for the player to ask its guest back, before it lapses. */
export const COMPLAINT_DAYS = 5;
/**
 * The condition a guest asked back after a complaint comes in at, whatever they left with: a little worse for the wait
 * at home.
 */
export const COMP_CONDITION = 70;
/** The share of what a complaint cost the center's name that healing its guest, asked back free, wins back: all of it. */
export const COMP_SHARE = 1;
/** What a "Second look" adds to the chance of a free treatment working, for what was learned the first time. */
export const SECOND_LOOK = 0.1;
/** The share of what a complaint cost that comes back at once when its guest is offered half off their next visit. */
export const HALF_OFF_SHARE = 0.25;
/** What a guest offered half off pays of their next visit's fees. */
export const HALF_OFF_PAY = 0.5;
/** The days, fewest and most, before a guest offered half off comes back. */
export const HALF_OFF_DAYS = { min: 3, max: 10 } as const;
/** How far a waiting guest sees litter from, in tiles. */
export const LITTER_SIGHT = 2;
/**
 * A guest with a snack's wrapper does something with it now and then, at this chance each time they think: it goes in
 * a bin within `BIN_REACH` tiles but for `LITTER_NEAR_BIN` of the time, and on the floor `LITTER_NO_BIN` of the time
 * with none near.
 */
export const WRAPPER_CHANCE = 0.2;
export const BIN_REACH = 7;
export const LITTER_NEAR_BIN = 0.12;
export const LITTER_NO_BIN = 0.9;

// Stations: how fast staff work, how likely a treatment is to work, and what it does for the center's name.

/**
 * How fast staff work at a station, against usual: `base`, and `rank` more for each rank of skill, times `mood` and a
 * point more for each `morale` points of morale (0.9 when miserable, 1.1 at the top).
 */
export const SERVICE_PACE = { base: 0.85, rank: 0.05, mood: 0.9, morale: 500 } as const;
/** A treatment's chance of working before anything about it is counted. */
export const BASE_CHANCE = 0.56;
/** What each rank of skill adds to the chance. */
export const SKILL_SUCCESS = 0.09;
/** What a certain diagnosis adds to the chance, a less certain one in proportion. */
export const DIAGNOSIS_SUCCESS = 0.15;
/** What a member of staff worn out below `TIRED_ENERGY` takes off the chance. */
export const TIRED_PENALTY = 0.15;
/** What each star of a room's prestige past the first adds to a service's results there. */
export const PRESTIGE_SUCCESS = 0.02;
/** The least and the most a treatment's chance can be before a botch cuts it. */
export const MIN_CHANCE = 0.3;
export const MAX_CHANCE = 0.98;
/**
 * How sure of a diagnosis a consultation makes a Consultant: `base`, `rank` more for each rank of skill, and up to
 * `luck` more by chance.
 */
export const CONSULT_GAIN = { base: 0.4, rank: 0.13, luck: 0.15 } as const;
/** After this many consultations a guest goes for treatment, however unsure the diagnosis. */
export const CONSULTS_MAX = 4;
/** How much patience being seen to gives back, and from a grump. */
export const SEEN_PATIENCE = 30;
export const GRUMP_PATIENCE = 10;
/** The prestige from which a treated guest finds the room fine. */
export const FINE_ROOM = 4;
/**
 * What a heal earns in reputation, a point more for a guest who was still fully patient: times 1 at standard prices,
 * and `PRICE_REP` more or less for each standard price's worth the treatment costs below or above it.
 */
export const HEAL_REP = 1.8;
export const PRICE_REP = 0.25;
/** What a failed treatment costs in reputation. */
export const FAIL_REP = 2.5;
/** What a guest put off by the price costs in reputation. */
export const PRICED_REP = 1;
