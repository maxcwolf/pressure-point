// What is at stake on a visit: guests who get worse while they wait, bad vibes left behind by failed treatments, and
// stress outbreaks that spread through a crowded waiting area.

/** How fast a guest's condition worsens, in points a second while they are in the building and not being seen to. */
export const CONDITION_DRAIN = 0.5;
/** Where an emergency guest's condition starts: they arrive in a bad way. */
export const EMERGENCY_CONDITION = 65;
/** How much of the chance of success a guest whose condition has run right down loses. */
export const CONDITION_PENALTY = 0.25;
/** Below this, a guest's condition is poor: it shows over their head. */
export const POOR_CONDITION = 30;
/** What a guest who leaves worse off costs the center's reputation: more than a failed treatment. */
export const WORSE_REP = 6;

/**
 * How reputation changes are dampened toward the ends of the scale, in the shape Theme Hospital's open-source clone
 * uses: below the midpoint a gain always lands in full, above it a loss does; a gain is damped as reputation climbs,
 * to `gainAtTop` at the `top` mark and nothing at 100, and a loss is damped as it falls, to `lossAtFloor` at the
 * `floor` mark and nothing at 0. So a good name is hard to keep perfect, and a center on its knees can climb back,
 * while one that heals half its guests still sinks to the bottom.
 */
export const REP_DAMPING = { mid: 50, top: 90, gainAtTop: 0.4, floor: 10, lossAtFloor: 0.75 } as const;

/** How far ahead, in days, the line is warned of guests whose condition is about to run out. */
export const WORSE_AHEAD_DAYS = 5;

/** How much a failed treatment adds to the bad vibes in its room, out of 100. */
export const VIBES_PER_FAIL = 60;
/** How much of the chance of success a room full of bad vibes takes away. */
export const VIBES_PENALTY = 0.15;
/** How fast bad vibes fade on their own, in points a second: a single failure's clears in about 25 days. */
export const VIBES_FADE = 0.4;
/** How many times faster bad vibes fade in a room with Wind Chimes in it. */
export const CHIMES_FADE = 4;
/** How much bad vibes lower the morale of staff working in the room. */
export const VIBES_MORALE = 8;
/** How long it takes to waft sage through a room and clear it. */
export const SMUDGE_SECONDS = 7;

/** How far stress spreads between guests waiting close together, in tiles, and the chance a second it does. */
export const SPREAD_RANGE = 1.6;
export const SPREAD_CHANCE = 0.06;
/** How much faster a stressed guest loses patience. */
export const STRESS_DRAIN = 1.5;
/** Stars needed before an outbreak is offered, the day the first may be, and the days between them. */
export const OUTBREAK_STARS = 2;
export const FIRST_OUTBREAK_DAY = 90;
export const OUTBREAK_GAP_MIN = 70;
export const OUTBREAK_GAP_MAX = 110;
/** Days an outbreak lasts once taken on. */
export const OUTBREAK_DAYS = 12;
/** Calming sessions on hand beyond one for each guest the outbreak starts with. */
export const SPARE_CALMS = 3;

/** What sets a stress outbreak off. */
export const OUTBREAK_CAUSES: readonly string[] = [
  'The office block across the road has just had its quarterly review.',
  'Exam results are out at the college.',
  'A wedding party has arrived, and the seating plan did not go well.',
  'The phone network went down for an hour.',
  'A yoga retreat let out early and nobody is speaking to each other.',
];
