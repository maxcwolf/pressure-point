// Perks: at the promotions to Senior and to Expert, the player picks one of two for the person promoted. Each is a
// trade-off, and which is right depends on something the player can see in their own center. The design, and why each
// number is what it is, is in docs/planning/fun/promotion-perks.md.

import type { GeneralId, Modality, Role, TraitId } from './types';

/** A perk a member of staff can have. */
export type PerkId =
  | 'charmer'
  | 'upseller'
  | 'diagnostician'
  | 'triage'
  | 'firm-hand'
  | 'light-touch'
  | 'needle-artist'
  | 'fire-and-glass'
  | 'clears'
  | 'unbothered'
  | 'big-gong'
  | 'hushed'
  | 'crowd-pleaser'
  | 'devotee-maker'
  | 'trip-sitter'
  | 'earth-keeper'
  | 'fixer'
  | 'neat-freak'
  | 'mentor'
  | 'name-on-door'
  | 'every-pipe';

/** The promotion a perk comes with: the one to Senior, or the one to Expert. */
export type PerkTier = 'senior' | 'expert';

/** The ranks each promotion that brings a choice is to. */
export const PERK_RANKS: Readonly<Record<PerkTier, number>> = { senior: 4, expert: 5 };

/** A Caretaker's job a perk can speed up or slow down. */
export type PerkJob = 'repair' | 'litter' | 'clean' | 'launder';

export interface PerkDef {
  id: PerkId;
  name: string;
  /** What it does and what it costs, in numbers, as the choice shows it. */
  desc: string;
  tier: PerkTier;
  /** How much faster (above 1) or slower they give a service. */
  speed?: number;
  /** Chance added to (or, below zero, taken off) a treatment of theirs: every one, or those `techniques` names. */
  success?: number;
  techniques?: readonly Modality[];
  /**
   * Chance added to (or taken off) the techniques of their discipline that `techniques` leaves out: those
   * `offTechniques` names, or every other one given by hand.
   */
  offSuccess?: number;
  offTechniques?: readonly Modality[];
  /** How fast guests they checked in lose patience while they wait, against the usual. */
  checkedIn?: number;
  /** How much more often guests buy at a Shop Counter they work. */
  shop?: number;
  /** How much faster (above 1) or slower they consult on everyday conditions, and on structural ones. */
  consultSpeed?: { everyday?: number; structural?: number };
  /** How sure a consultation of theirs can make a structural condition, in place of `STRUCTURAL_SURE`. */
  structuralSure?: number;
  /** A best guess of theirs at a structural condition, unscanned, costs a treatment nothing. */
  sureGuess?: boolean;
  /** The share of their massages that need a rest after though the technique needs none, or `never` for none at all. */
  rest?: number | 'never';
  /** How much of a room's bad vibes count against a treatment of theirs, and how many their failures leave. */
  vibesTaken?: number;
  vibesLeft?: number;
  /** Clears bad vibes in their own room between guests, at this share of a smudger's pace. */
  clears?: number;
  /** Mats more (or fewer) a Sound Healer plays for, and noise added to their sessions. */
  mats?: number;
  noise?: number;
  /** No noise leaves their studio. */
  hushed?: boolean;
  /** Practice Spots more (or fewer) they lead, and how much more often their class-goers become regulars. */
  places?: number;
  regulars?: number;
  /** How much more often a failed ceremony of theirs is a really bad trip, and how much faster they talk a runner down. */
  runaway?: number;
  calm?: number;
  /** How much faster (above 1) or slower a Caretaker does each kind of job. */
  jobs?: Partial<Record<PerkJob, number>>;
  /** Goes to repairs before anything else but a fire. */
  repairsFirst?: boolean;
  /** How much faster colleagues of a lower rank nearby earn experience. */
  mentor?: number;
  /** How fast a regular in their line loses patience, against the usual, and the share of the fee they tip on top. */
  regularPatience?: number;
  regularTip?: number;
  /** Morale they settle at, against the usual, and the raise they ask for. */
  morale?: number;
  raiseStep?: number;
  /** Equipment they repair wears this much as fast until it is next repaired, and they never do litter again. */
  pipes?: number;
  /** The quirks and courses that suit it, which settle it when they choose for themselves. */
  suits: readonly TraitId[];
  suitsCourses?: readonly GeneralId[];
  /** A line for the inspector, under what it does. */
  joke?: string;
}

/** The quirks of the faster side of a pair, and of the more patient side. */
const FAST: readonly TraitId[] = ['brisk', 'speedy', 'chatty'];
const PATIENT: readonly TraitId[] = ['tireless'];
const BEDSIDE: readonly GeneralId[] = ['bedside'];

export const PERKS: Readonly<Record<PerkId, PerkDef>> = {
  charmer: {
    id: 'charmer',
    name: 'Charmer',
    tier: 'senior',
    desc: 'Guests they check in lose patience 20% more slowly while they wait. Works 7% slower.',
    checkedIn: 0.8,
    speed: 0.93,
    suits: [...PATIENT, 'sunny'],
    suitsCourses: BEDSIDE,
  },
  upseller: {
    id: 'upseller',
    name: 'Upseller',
    tier: 'senior',
    desc: 'Guests buy 35% more often at a Shop Counter they work. Guests they check in lose patience 3% faster.',
    shop: 1.35,
    checkedIn: 1.03,
    suits: FAST,
  },
  diagnostician: {
    id: 'diagnostician',
    name: 'Diagnostician',
    tier: 'senior',
    desc: 'Structural conditions they see get as sure as 80%, not 60%, and a best guess of theirs costs nothing. Everyday consultations take 10% longer.',
    structuralSure: 0.8,
    sureGuess: true,
    consultSpeed: { everyday: 1 / 1.1 },
    suits: PATIENT,
    suitsCourses: BEDSIDE,
  },
  triage: {
    id: 'triage',
    name: 'Triage',
    tier: 'senior',
    desc: 'Everyday conditions are seen 30% faster. Structural ones take 20% longer.',
    consultSpeed: { everyday: 1.3, structural: 1 / 1.2 },
    suits: FAST,
  },
  'firm-hand': {
    id: 'firm-hand',
    name: 'Firm Hand',
    tier: 'senior',
    desc: '+8% on Deep Tissue, Sports and Cranio-sacral, −3% on the rest. One in three of their massages needs a rest in the Recovery Lounge after, on top of those that always do.',
    success: 0.08,
    techniques: ['deep', 'sports', 'cranio'],
    offSuccess: -0.03,
    rest: 1 / 3,
    suits: PATIENT,
    suitsCourses: BEDSIDE,
  },
  'light-touch': {
    id: 'light-touch',
    name: 'Light Touch',
    tier: 'senior',
    desc: '+8% on Swedish and Hot Stone, −3% on the rest. None of their massages need a rest after.',
    success: 0.08,
    techniques: ['swedish', 'stone'],
    offSuccess: -0.03,
    rest: 'never',
    suits: FAST,
  },
  'needle-artist': {
    id: 'needle-artist',
    name: 'Needle Artist',
    tier: 'senior',
    desc: '+8% on Classic Needling and Electroacupuncture, −3% on Cupping and Moxibustion.',
    success: 0.08,
    techniques: ['needling', 'electro'],
    offSuccess: -0.03,
    suits: PATIENT,
    suitsCourses: BEDSIDE,
  },
  'fire-and-glass': {
    id: 'fire-and-glass',
    name: 'Fire and Glass',
    tier: 'senior',
    desc: '+8% on Cupping and Moxibustion, −3% on Classic Needling and Electroacupuncture.',
    success: 0.08,
    techniques: ['cupping', 'moxa'],
    offSuccess: -0.03,
    suits: FAST,
  },
  clears: {
    id: 'clears',
    name: 'Clears as They Go',
    tier: 'senior',
    desc: 'Between guests, clears bad vibes in their own room at 60% of a smudger’s pace. Treatments take 7% longer.',
    clears: 0.6,
    speed: 1 / 1.07,
    suits: PATIENT,
    suitsCourses: BEDSIDE,
  },
  unbothered: {
    id: 'unbothered',
    name: 'Unbothered',
    tier: 'senior',
    desc: 'Bad vibes take 60% less off their chance. Their own failures leave half as many vibes again.',
    vibesTaken: 0.4,
    vibesLeft: 1.5,
    suits: [...FAST, 'grump'],
  },
  'big-gong': {
    id: 'big-gong',
    name: 'Big Gong',
    tier: 'senior',
    desc: 'Plays for one more mat, and +6% on Gong Bath. Their sessions make 1 more noise next door.',
    mats: 1,
    success: 0.06,
    techniques: ['gong'],
    noise: 1,
    suits: FAST,
  },
  hushed: {
    id: 'hushed',
    name: 'Hushed',
    tier: 'senior',
    desc: 'No noise leaves their studio, and +6% on Singing Bowls, Tuning Forks and Overtone Chanting. −3% on Gong Bath.',
    hushed: true,
    success: 0.06,
    techniques: ['sound', 'forks', 'overtone'],
    offSuccess: -0.03,
    offTechniques: ['gong'],
    suits: PATIENT,
    suitsCourses: BEDSIDE,
  },
  'crowd-pleaser': {
    id: 'crowd-pleaser',
    name: 'Crowd-Pleaser',
    tier: 'senior',
    desc: 'Leads 2 more Practice Spots. Class-goers become regulars a quarter less often.',
    places: 2,
    regulars: 0.75,
    suits: FAST,
  },
  'devotee-maker': {
    id: 'devotee-maker',
    name: 'Devotee-Maker',
    tier: 'senior',
    desc: 'Class-goers become regulars twice as often. Leads one Practice Spot fewer.',
    places: -1,
    regulars: 2,
    suits: PATIENT,
    suitsCourses: BEDSIDE,
  },
  'trip-sitter': {
    id: 'trip-sitter',
    name: 'Trip Sitter',
    tier: 'senior',
    desc: '+8% on Mushroom and Ayahuasca ceremonies, a failed one is a really bad trip 60% less often, and they talk a runner down 2.5 times as fast. −3% on the rest.',
    success: 0.08,
    techniques: ['mushroom', 'ayahuasca'],
    offSuccess: -0.03,
    runaway: 0.4,
    calm: 2.5,
    suits: PATIENT,
    suitsCourses: BEDSIDE,
  },
  'earth-keeper': {
    id: 'earth-keeper',
    name: 'Earth Keeper',
    tier: 'senior',
    desc: '+8% on Spirit Animal Reading, Spiritual Extraction, Sweat Lodge and Vision Quest. −3% on Mushroom and Ayahuasca.',
    success: 0.08,
    techniques: ['reading', 'extraction', 'sweat', 'quest'],
    offSuccess: -0.03,
    suits: FAST,
  },
  fixer: {
    id: 'fixer',
    name: 'Fixer',
    tier: 'senior',
    desc: 'Repairs 35% faster, and sees to them first. Litter and cleaning 13% slower.',
    jobs: { repair: 1.35, litter: 0.87, clean: 0.87 },
    repairsFirst: true,
    suits: PATIENT,
  },
  'neat-freak': {
    id: 'neat-freak',
    name: 'Neat Freak',
    tier: 'senior',
    desc: 'Litter, cleaning and linens 35% faster. Repairs 13% slower.',
    jobs: { litter: 1.35, clean: 1.35, launder: 1.35, repair: 0.87 },
    suits: FAST,
  },
  mentor: {
    id: 'mentor',
    name: 'Mentor',
    tier: 'expert',
    desc: 'Colleagues of a lower rank within 5 tiles earn experience 60% faster. Two Mentors do not add up. Works 7% slower, teaching as they go.',
    mentor: 1.6,
    speed: 0.93,
    suits: ['sunny', 'tireless'],
    joke: 'Has a mug that says MENTOR. Bought it themselves.',
  },
  'name-on-door': {
    id: 'name-on-door',
    name: 'Name on the Door',
    tier: 'expert',
    desc: 'Regulars in their line lose patience 60% more slowly, and tip 12% more. Their morale settles 3 lower, and each raise they ask for is 15%, not 10%.',
    regularPatience: 0.4,
    regularTip: 0.12,
    morale: -3,
    raiseStep: 1.15,
    suits: ['influencer'],
  },
  'every-pipe': {
    id: 'every-pipe',
    name: 'Knows Every Pipe',
    tier: 'expert',
    desc: 'Equipment they repair wears 30% more slowly until its next repair. Will not do litter again, ever.',
    pipes: 0.7,
    suits: ['brisk', 'speedy'],
  },
};

/** The two perks each role chooses between at the promotion to Senior. */
export const SENIOR_PERKS: Readonly<Record<Role, readonly [PerkId, PerkId]>> = {
  receptionist: ['charmer', 'upseller'],
  consultant: ['diagnostician', 'triage'],
  therapist: ['firm-hand', 'light-touch'],
  acupuncturist: ['needle-artist', 'fire-and-glass'],
  practitioner: ['clears', 'unbothered'],
  healer: ['big-gong', 'hushed'],
  instructor: ['crowd-pleaser', 'devotee-maker'],
  shaman: ['trip-sitter', 'earth-keeper'],
  caretaker: ['fixer', 'neat-freak'],
};

/** The two perks a role chooses between at a promotion: Mentor, and for a Caretaker, who sees no guests, the pipes. */
export const perkPair = (role: Role, tier: PerkTier): readonly [PerkId, PerkId] =>
  tier === 'senior' ? SENIOR_PERKS[role] : ['mentor', role === 'caretaker' ? 'every-pipe' : 'name-on-door'];

/** Days a choice waits on its card before they choose for themselves. */
export const PERK_WAIT_DAYS = 30;

/** Experience a hire above Experienced earns here before each choice their rank owes them comes: Senior, then Expert. */
export const SETTLE_XP: Readonly<Record<PerkTier, number>> = { senior: 35, expert: 80 };

/** The share of Senior and Expert applicants who bring a perk from their last job. */
export const BROUGHT_PERK_CHANCE = 0.1;

/** The two promotions that bring a choice, in the order they come. */
export const PERK_TIERS: readonly PerkTier[] = ['senior', 'expert'];

/** The promotions whose choice someone of a rank has had, or is owed: none below Senior, then Senior, then both. */
export const tiersOwed = (skill: number) => PERK_TIERS.filter((t) => skill >= PERK_RANKS[t]);

/** A number from 0 up to 2³², the same every time for the same id, drawn from nothing else. */
function hash(id: number) {
  let h = Math.imul(id ^ 0x5bd1e995, 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  return (h ^ (h >>> 13)) >>> 0;
}

/**
 * The perk a Senior or Expert applicant brings from their last job, if they are one of the few who do: settled by
 * their id, after every other roll, so nobody else's random numbers move.
 */
export function broughtPerk(id: number, role: Role, skill: number): PerkId | undefined {
  const tiers = tiersOwed(skill);
  const h = hash(id);
  if (!tiers.length || (h % 1000) / 1000 >= BROUGHT_PERK_CHANCE) return undefined;
  const tier = tiers[(h >>> 10) % tiers.length] ?? 'senior';
  return perkPair(role, tier)[(h >>> 12) & 1];
}

/** Look up a perk by id. An unknown id is a bug or a corrupt save, so it throws. */
export function perkOf(id: PerkId): PerkDef {
  const def = (PERKS as Partial<Record<string, PerkDef>>)[id];
  if (!def) throw new Error(`unknown perk "${id}"`);
  return def;
}

/** Whether the game knows a perk a save holds. */
export const knownPerk = (id: string): id is PerkId => Object.hasOwn(PERKS, id);
