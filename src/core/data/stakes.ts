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

/** How much a failed treatment adds to the bad vibes in its room, out of 100. */
export const VIBES_PER_FAIL = 60;
/** How much of the chance of success a room full of bad vibes takes away. */
export const VIBES_PENALTY = 0.15;
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
