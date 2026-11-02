// The town paper: each center's masthead and column, and the bank of headlines and stories it prints from at the end
// of each quarter. How a quarter's news is chosen and filled in is in sim/news.ts.
//
// Every headline and story is filled only from the quarter's news log, so it prints only what really happened and was
// told at the time. The jokes land on the town, ZenMart, the vicar, the machines and the staff's dignity, never on the
// player's mistakes or anyone's illness, and money trouble never prints.

import type { CenterId } from './types';

/** A center's paper: its name, its motto, and the title of its column. */
export interface PaperDef {
  name: string;
  motto: string;
  column: string;
}

export const PAPERS: Readonly<Record<CenterId, PaperDef>> = {
  willow: { name: 'The Willow Lane Leaflet', motto: 'Folded by hand since last Tuesday.', column: 'Florist Watch' },
  exchange: { name: 'The Exchange Ledger', motto: 'Per my last edition.', column: 'Markets' },
  boardwalk: { name: 'The Boardwalk Bugle', motto: 'Read it before the gulls do.', column: 'Benny Count' },
  highpines: { name: 'The Pines Avalanche', motto: 'Published when the road is open.', column: 'The Road' },
  orchard: { name: 'The Parish Pump', motto: 'Established shortly before the vicar.', column: 'From the Vicarage' },
  sandbox: { name: 'The Open Plot', motto: 'Whatever you build, we print.', column: 'Planning Notices' },
};

/** What the sandbox's paper calls the center, which has no name of its own. */
export const SANDBOX_CENTER = 'the center';

/** Months to a quarter: the paper prints on every third payday. */
export const QUARTER_MONTHS = 3;
/** The most stories a quarter's log keeps: when it is full, a new one takes the place of the smallest, if it is bigger. */
export const NEWS_KEPT = 48;
/** A quarter with nothing scoring this much that can lead is a quiet quarter. */
export const QUIET_SCORE = 20;
/** The least a story needs to score to be the "Also". */
export const ALSO_SCORE = 15;
/** A long wait leads only from this many days. */
export const WAIT_LEAD_DAYS = 8;

/** Which headline and story a piece of news gets, from its kind and how it went. */
export type HeadlineCase =
  | 'opened'
  | 'opened-sandbox'
  | 'quiet'
  | 'fire'
  | 'fire-early'
  | 'fire-beaten'
  | 'fire-brigade'
  | 'fire-sprinklers'
  | 'runaway-door'
  | 'runaway-calmed'
  | 'runaway-shaman'
  | 'vip-delighted'
  | 'vip-disappointed'
  | 'vip-satisfied'
  | 'inspection-clean'
  | 'inspection-passed'
  | 'inspection-failed'
  | 'inspection-warned'
  | 'inspection-mushrooms'
  | 'inspection-refused'
  | 'inspection-paid'
  | 'mishap-power'
  | 'mishap-storm'
  | 'mishap-flood'
  | 'accident'
  | 'mishap-freeze'
  | 'mishap-wasps'
  | 'mishap-ready'
  | 'mishap-warded'
  | 'overload'
  | 'sale'
  | 'poached'
  | 'quit'
  | 'expert'
  | 'amanda'
  | 'overtook'
  | 'emergency-handled'
  | 'emergency-failed'
  | 'outbreak-contained'
  | 'outbreak-escaped'
  | 'grade'
  | 'star'
  | 'awards-center'
  | 'awards-other'
  | 'wait';

/**
 * The headlines for each case, in sentence case with the names as they are: the lead prints in capitals, and the
 * "Also" as a sentence. A case's headlines take turns by issue, among those whose every `{placeholder}` the news can
 * fill. The bribe nobody found out about never leads, so its "headline" is the sentence it prints as the "Also".
 */
export const HEADLINES: Readonly<Record<HeadlineCase, readonly string[]>> = {
  opened: ['{center} opens; Rang praised, as required'],
  'opened-sandbox': ['Grand opening; line forms in order of aura color'],
  quiet: ['{center} has quiet quarter; wind chimes questioned'],
  fire: ['{item} catches fire; {room} "fine, mostly"', '{item} catches fire; building "fine, mostly"'],
  'fire-early': ['Fire brigade arrives, finds fire out, leaves slightly disappointed'],
  'fire-beaten': ['{n} things burn in {room}; {staff} beats out last one with a towel'],
  'fire-brigade': ['Firefighters hose {room}, charge {fee}, decline massage'],
  'fire-sprinklers': ['Sprinklers save {room}, soak it thoroughly'],
  'runaway-door': [
    'Guest on "really bad" trip finds door, keeps going',
    '{guest} takes "really bad" trip out the front door',
  ],
  'runaway-calmed': ['{staff} talks {guest} down; walls confirmed not melting'],
  'runaway-shaman': ['Shaman talks {guest} down; walls confirmed not melting'],
  'vip-delighted': [
    '{visitor} calls {room} "{note}"; staff deny cleaning specially',
    '{visitor} leaves {center} delighted; staff deny cleaning specially',
  ],
  'vip-disappointed': [
    '{visitor} finds {room} "{note}", asks for a taxi',
    '{visitor} leaves {center} early, asks for a taxi',
  ],
  'vip-satisfied': ['{visitor} visits {center}, is fine about it'],
  'inspection-clean': ['Inspector finds nothing, checks again, still nothing'],
  'inspection-passed': ['Inspector calls at {center}, finds one thing, lets it go'],
  'inspection-failed': ['Inspector finds {problems}, needs second clipboard'],
  'inspection-warned': ['Inspector finds {problems}, needs second clipboard'],
  'inspection-mushrooms': ['Mushrooms found under shop counter; inspector takes one for tests'],
  'inspection-refused': ['Inspector hands envelope back at {center}, writes it up anyway'],
  'inspection-paid': ['The health inspector called on {date}. This paper has no further questions.'],
  'mishap-power': ['Power cut hits {center}; guests "barely noticed, eyes were shut"'],
  'mishap-storm': ['Storm hits {center}, breaks some equipment; gulls blamed'],
  'mishap-flood': ['Storm floods {center} restroom; guest leaves with tide table'],
  accident: ['{center} reminds town the floor is not a restroom; town "had assumed"'],
  'mishap-freeze': ['Pipes freeze at {center}; icicles "not a feature"'],
  'mishap-wasps': ['Wasps take the snacks; vicar blames croquet club'],
  'mishap-ready': ['{center} ready for {mishap}, as it turns out'],
  'mishap-warded': ['Shaman wards off {mishap}; {mishap} unavailable for comment'],
  overload: ['{item} {mess}; manual still untranslated', '{item} in {room} {mess}; manufacturer "looking into it"'],
  sale: [
    'ZenMart cuts prices {discount}%; {center} does not blink',
    'ZenMart holds sale; enlightenment "now slightly cheaper"',
  ],
  poached: ['{staff} defects to ZenMart, is issued lanyard'],
  quit: ['{staff} quits, citing "everything"'],
  expert: ['{staff} made Expert; name badge reprinted'],
  amanda: ['Amanda Jablonsky joins {center}; mohawk "not negotiable"'],
  overtook: ['{center} overtakes ZenMart; ZenMart "sending light"'],
  'emergency-handled': ['{n} cases of {condition} healed on time'],
  'emergency-failed': ['Emergency: {n} of {target} healed; the rest "still in the pose"'],
  'outbreak-contained': ['Stress outbreak contained; nobody speaking about the seating plan'],
  'outbreak-escaped': ['Stress escapes {center}, last seen heading for {where}'],
  grade: ['{center} now {grade}; sign painter booked'],
  star: ['{center} earns {nth} star, puts it somewhere safe'],
  'awards-center': ['{center} is Center of the Year; ZenMart "didn\'t want it anyway"'],
  'awards-other': ['{center} wins {award}; trophy cabinet dusted'],
  wait: ['{local} waits {days} days, can now describe {thing} in detail'],
};

/** How each fire was put out, in the story: the Caretaker named, or the sprinklers, or the brigade and its fee. */
export const FIRE_PUT_OUT = {
  extinguisher: '{staff}, Caretaker, put it out with the Fire Extinguisher by the door.',
  beaten: '{staff}, Caretaker, beat it out.',
  sprinklers: 'The sprinklers put it out.',
  brigade: 'The fire brigade hosed it down and charged {fee}.',
} as const;

/**
 * The story under each lead, two or three sentences of facts only, with the real names, rooms, days and sums. A
 * fire's are put together from `{burned}` and `{putout}`, and every story about guests healed reads `{healed}`.
 */
export const STORIES: Readonly<Record<HeadlineCase, string>> = {
  opened: '{center} opened its doors on {date}. {healed}',
  'opened-sandbox': '{center} opened its doors on {date}. {healed}',
  quiet: 'Nothing at {center} made the front page this quarter. {healed}',
  fire: 'The {item}{in} caught fire on {date}. {burned} {putout}',
  'fire-early': 'The {item}{in} caught fire on {date}. {burned} {putout}',
  'fire-beaten': 'The {item}{in} caught fire on {date}. {burned} {putout}',
  'fire-brigade': 'The {item}{in} caught fire on {date}. {burned} {putout}',
  'fire-sprinklers': 'The {item}{in} caught fire on {date}. {burned} {putout}',
  'runaway-door': '{guest} was on a really bad trip on {date}, found the door, and went home still tripping.',
  'runaway-calmed': '{guest} was on a really bad trip on {date} until {staff}, {role}, talked them down.',
  'runaway-shaman': '{guest} was on a really bad trip on {date} until {staff}, {role}, talked them down.',
  'vip-delighted':
    '{visitor} toured {rooms} on {date} and left delighted. Of the {room}: "{verdict}" The visit brought in {prize}.',
  'vip-disappointed': '{visitor} toured {rooms} on {date} and left disappointed. Of the {room}: "{verdict}"',
  'vip-satisfied': '{visitor} toured {rooms} on {date} and left satisfied. Of the {room}: "{verdict}"',
  'inspection-clean': 'The health inspector looked around {rooms} on {date} and found nothing wrong.',
  'inspection-passed':
    'The health inspector looked around {rooms} on {date} and found one thing wrong, which is allowed.',
  'inspection-failed': 'The health inspector looked around {rooms} on {date} and found {problems}.',
  'inspection-warned':
    'The health inspector looked around {rooms} on {date} and found {problems}, and let it go with a warning this time.',
  'inspection-mushrooms':
    'The health inspector looked around {rooms} on {date} and found magic mushrooms under the Shop Counter.',
  'inspection-refused': 'The health inspector called on {date}, was offered {fee}, turned it down and wrote it up.',
  'inspection-paid': 'The health inspector called on {date}. This paper has no further questions.',
  'mishap-power': 'The power went out on {date} for {lasted}, and nothing with a plug worked.',
  'mishap-storm': 'A storm came in on {date} and broke some equipment.',
  'mishap-flood': 'A storm came in on {date}, broke some equipment and flooded a restroom.',
  accident: 'A guest who could not find a toilet in time had an accident on the floor on {date}.',
  'mishap-freeze': 'The pipes froze on {date}, and the water was off for {lasted}.',
  'mishap-wasps': 'Wasps found the snacks on {date}, and nobody could get near them for {lasted}.',
  'mishap-ready': 'The {mishap} came on {date}, and {center} was ready for it.',
  'mishap-warded': 'The {mishap} came on {date}, and a Shaman had warded it off.',
  overload: 'The {item}{in} overloaded on {date} and {mess}.',
  sale: 'ZenMart held a sale from {date}: {discount}% off for {days} days.',
  poached: '{staff}, {role}, left on {date} to work at ZenMart.',
  quit: '{staff}, {role}, quit on {date}.',
  expert: '{staff}, {role}, was made Expert on {date}.',
  amanda: 'Amanda Jablonsky joined {center} as {arole} on {date}.',
  overtook: 'On {date}, the standing of {center} passed that of ZenMart.',
  'emergency-handled': 'An emergency ended on {date}: {target} cases of {condition} were needed, and {n} were healed.',
  'emergency-failed': 'An emergency ended on {date} with {n} of the {target} cases of {condition} healed.',
  'outbreak-contained': 'A stress outbreak ended on {date} with {guests} left still stressed.',
  'outbreak-escaped': 'A stress outbreak got away on {date}: {guests} left still stressed.',
  grade: '{center} rose to {grade} on {date}.',
  star: '{center} earned its {ordinal} star on {date}.',
  'awards-center': 'At the awards for year {year}, held on {date}, {center} won {won}.',
  'awards-other': 'At the awards for year {year}, held on {date}, {center} won {won}.',
  wait: '{guest} waited {days} days before leaving on {date}, the longest wait this quarter.',
};

/** Where stress that gets away from each center is last seen heading. */
export const STRESS_HEADS_FOR: Readonly<Record<CenterId, string>> = {
  willow: 'the high street',
  exchange: 'the trading floor',
  boardwalk: 'the boardwalk',
  highpines: 'the ski lift',
  orchard: 'the village green',
  sandbox: 'the high street',
};

/** What a guest who waited long is said to know by heart when the building has nothing more common to look at. */
export const CEILING = 'the ceiling';

/** How a letter is signed, by the stars its review gave: much looser, by email, or not at all. */
export const LETTER_SIGNS = {
  good: 'Yours, {name}, much looser.',
  middling: '{name}, by email.',
  bad: 'Name and address supplied.',
  regular: '{name} ({nth} visit).',
} as const;

/** The column at Willow Lane: the empty unit next door, watched until the center buys it. */
export const FLORIST_PLOT = 'unit-next-door';
export const FLORIST_WATCH: readonly string[] = [
  'Day {day}. Still empty. A man looked in the window on Tuesday.',
  'Day {day}. Still empty. The sign still says "Back in five minutes".',
  'Day {day}. Still empty. The fern in the window is holding on.',
];
export const FLORIST_BOUGHT = 'Closed. The unit next door is part of {center} now. The florist was never seen.';

/** The Exchange's markets: the center's reputation over the quarter, then ZenMart, then something else delisted. */
export const MARKETS = {
  calm: 'Calm: {move} on the quarter.',
  rival: [
    'ZenMart: up on news of layoffs.',
    'ZenMart: steady, unlike its staff.',
    'ZenMart: up, after cutting the tea.',
  ],
  closed: 'ZenMart: not yet listed.',
  rest: ['Lunch breaks: delisted.', 'Weekends: under review.', 'Pay rises: suspended until further notice.'],
} as const;

/** The Boardwalk's count of this quarter's crowd against the last. */
export const BENNY_COUNT = {
  both: '{now}, against {then} last quarter.',
  first: '{now}. No count last quarter: the clicker was new.',
  rest: [
    'Two still had their beach badges on.',
    'Most of them parked on the boardwalk.',
    'Several asked where the beach was.',
  ],
} as const;

/** High Pines' road: how many days it was shut this quarter. */
export const THE_ROAD = {
  shut: 'Shut {days} this quarter. Chains advised.',
  open: 'Open all quarter. Chains advised anyway.',
};

/** The vicar writes, one a quarter by turn; the first only when Sour Grapes is being treated, the second after wasps. */
export const VICARAGE = {
  sourGrapes: 'Someone at the Estate is being treated for Sour Grapes. I forgive them, eventually.',
  wasps: 'The wasps are back in the vestry. They are welcome at the evening service.',
  croquet: 'I won the croquet again. I mention it only because I was asked not to.',
} as const;

/** The sandbox's planning notices: the latest room pencilled in, or none. */
export const PLANNING = {
  sketch: '{room}, {w}×{h}, drawn up on {date}. Objections to the editor by Friday.',
  none: 'Nothing drawn up this quarter. The editor has taken Friday off.',
} as const;

/**
 * The one classified: ZenMart's sale only while one is really on, its wanted advert after it has hired someone away
 * this quarter, and otherwise the lost and found, by turn.
 */
export const CLASSIFIEDS = {
  sale: 'ZENMART. Enlightenment, {discount}% off for {days} days. Terms apply to the soul.',
  wanted: 'WANTED: {roles}. Must have hands. Lanyard provided. ZenMart.',
  lost: [
    'LOST: one aura, red, last seen in the fire exit.',
    'FOUND: one chakra, slightly out of line. Collect from reception.',
    'FOR SALE: crystal, lightly used, still humming. No time-wasters.',
  ],
} as const;

/** What the speakers say as each issue lands, by turn. None is recorded yet. */
export const PAPER_LINES: readonly string[] = [
  "This quarter's paper is out. Staff named in it may not sign copies.",
  'Guests are reminded that the letters page is not a complaints procedure.',
  'Copies of the local paper are at reception. One per aura.',
];
