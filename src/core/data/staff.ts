// Staff roles and the quirks a member of staff can have.

import { CLASS_PLACES } from './rules';
import type { Role, RoleDef, TraitDef, TraitId } from './types';

export const ROLES: Readonly<Record<Role, RoleDef>> = {
  receptionist: {
    role: 'receptionist',
    name: 'Receptionist',
    icon: 'role-receptionist',
    desc: 'Checks guests in at a Reception Desk.',
    baseSalary: 800,
    uniform: 0x2fa8a0,
    accent: 0xffffff,
  },
  consultant: {
    role: 'consultant',
    name: 'Wellness Consultant',
    icon: 'role-consultant',
    desc: 'Diagnoses guests in a Consultation Room. Skill means fewer repeat visits.',
    baseSalary: 1700,
    uniform: 0xf4f1ea,
    accent: 0x3f7fb5,
  },
  therapist: {
    role: 'therapist',
    name: 'Massage Therapist',
    icon: 'role-therapist',
    desc: 'Treats guests in a Massage Suite. Each one knows certain modalities; train them to add more.',
    baseSalary: 1400,
    uniform: 0xa784d6,
    accent: 0xf4f1ea,
    discipline: 'massage',
  },
  acupuncturist: {
    role: 'acupuncturist',
    name: 'Acupuncturist',
    icon: 'role-acupuncturist',
    desc: 'Treats guests in an Acupuncture Clinic. Each one knows certain techniques; train them to add more.',
    baseSalary: 1600,
    uniform: 0x3f9d7a,
    accent: 0xf4f1ea,
    discipline: 'acupuncture',
  },
  practitioner: {
    role: 'practitioner',
    name: 'Reiki Practitioner',
    icon: 'role-practitioner',
    desc: 'Treats guests in a Reiki Studio. Each one knows certain techniques; train them to add more.',
    baseSalary: 1700,
    uniform: 0xece6f5,
    accent: 0x7a5aa8,
    discipline: 'reiki',
  },
  healer: {
    role: 'healer',
    name: 'Sound Healer',
    icon: 'role-healer',
    desc: 'Plays for the guests on the mats of a Sound Bath Studio all at once: 2 mats as a Trainee or Junior, 3 as Experienced or Senior, 4 as an Expert. Each one knows certain techniques; train them to add more.',
    baseSalary: 1650,
    uniform: 0x3f7f8c,
    accent: 0xf2e6c8,
    discipline: 'sound',
  },
  instructor: {
    role: 'instructor',
    name: 'Qi Gong Instructor',
    icon: 'role-instructor',
    desc: `Leads the classes in a Qi Gong Studio, on the days its timetable sets. The more skilled, the more who come, and the more Practice Spots they can lead: ${CLASS_PLACES[0]} for a Trainee, up to ${CLASS_PLACES.at(-1)} for an Expert.`,
    baseSalary: 1300,
    uniform: 0xc0473a,
    accent: 0xf2d27a,
    room: 'qigong',
  },
  shaman: {
    role: 'shaman',
    name: 'Shaman',
    icon: 'role-shaman',
    desc: 'Treats guests one at a time in a Ceremony Lodge. Each one knows certain techniques; train them to add more.',
    baseSalary: 1900,
    uniform: 0x8a4b2a,
    accent: 0xe0b04a,
    discipline: 'shaman',
  },
  caretaker: {
    role: 'caretaker',
    name: 'Caretaker',
    icon: 'role-caretaker',
    desc: 'Clears litter, cleans toilets, changes and launders the linens, waters plants, reheats Stone Warmers and repairs worn equipment.',
    baseSalary: 600,
    uniform: 0x7d8f45,
    accent: 0xe8c65a,
  },
};

export const ROLE_ORDER: readonly Role[] = [
  'receptionist',
  'consultant',
  'therapist',
  'acupuncturist',
  'practitioner',
  'healer',
  'caretaker',
  'instructor',
  'shaman',
];

export const TRAITS: readonly TraitDef[] = [
  { id: 'brisk', name: 'Brisk', desc: 'Works 20% faster.', speed: 1.2, pay: 1.1 },
  { id: 'tireless', name: 'Tireless', desc: 'Tires 35% more slowly.', stamina: 0.65, pay: 1.1 },
  {
    id: 'chatty',
    name: 'Chatterbox',
    desc: 'Works 15% slower. Has opinions about crystals.',
    speed: 0.85,
    pay: 0.92,
    bad: true,
  },
  { id: 'sleepy', name: 'Sleepyhead', desc: 'Tires 35% faster.', stamina: 1.35, pay: 0.9, bad: true },
  { id: 'speedy', name: 'Power Walker', desc: 'Gets around 30% faster.', walk: 1.3, pay: 1.05 },
  { id: 'dawdler', name: 'Dawdler', desc: 'Has never hurried in their life.', walk: 0.8, pay: 0.92, bad: true },
  { id: 'bargain', name: 'Undervalued', desc: 'Asks for 15% less pay. Do not tell them.', pay: 0.85 },
  { id: 'litterbug', name: 'Litterbug', desc: 'Drops litter as they go.', pay: 0.9, habit: 'litter', bad: true },
  { id: 'grump', name: 'Grump', desc: 'Guests they see leave less pleased.', pay: 0.9, habit: 'grump', bad: true },
  { id: 'sunny', name: 'Ray of Sunshine', desc: 'Lifts the morale of colleagues nearby.', pay: 1.1, habit: 'cheer' },
  { id: 'quick', name: 'Quick Study', desc: 'Gets through courses 40% faster.', pay: 1.05, learn: 1.4 },
  { id: 'green', name: 'Green Thumb', desc: 'Waters thirsty plants in passing.', habit: 'water' },
  {
    id: 'influencer',
    name: 'Former Influencer',
    desc: 'Every guest they heal posts about it: +1 reputation each. Stops to film it: 10% slower.',
    speed: 0.9,
    pay: 1.25,
    rep: 1,
    rare: true,
  },
  {
    id: 'survivor',
    name: 'Burnout Survivor',
    desc: 'Morale never falls below 35. Has a mug about it.',
    pay: 1.25,
    floor: 35,
    rare: true,
  },
  {
    id: 'hands',
    name: 'Healing Hands',
    desc: 'One treatment in ten that would have failed works anyway.',
    pay: 1.25,
    rescue: 0.1,
    rare: true,
  },
  {
    id: 'space',
    name: 'Holds Space',
    desc: 'Colleagues working in the same room work 10% faster. Mentions it.',
    pay: 1.25,
    hold: 1.1,
    rare: true,
  },
];

/** The common quirks, of which every applicant has one to three. */
export const COMMON_TRAITS: readonly TraitDef[] = TRAITS.filter((t) => !t.rare);

/** The rare quirks, of which about one applicant in seven has one as well. */
export const RARE_TRAITS: readonly TraitDef[] = TRAITS.filter((t) => t.rare);

/** How many common quirks an applicant has, at fewest and at most. */
export const QUIRKS_MIN = 1;
export const QUIRKS_MAX = 3;

/** The chance an applicant has a rare quirk too. */
export const RARE_CHANCE = 1 / 7;

/** Quirks that cannot both be on one person, each pair the opposite of the other. */
export const CLASHES: readonly (readonly [TraitId, TraitId])[] = [
  ['brisk', 'chatty'],
  ['tireless', 'sleepy'],
  ['speedy', 'dawdler'],
  ['grump', 'sunny'],
];

/** Whether two quirks cannot both be on one person. */
export const clashes = (a: TraitId, b: TraitId) =>
  CLASHES.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

/**
 * A massage therapist who now and then applies: at least three stars and one above the best of the other applicants, and trained in every massage technique but
 * Sports and Hot Stone. There is only ever one of her, and she wears her brown hair in a mohawk, a style no one else has.
 */
export const AMANDA = {
  name: 'Amanda Jablonsky',
  chance: 0.05,
  minSkill: 3,
  /** Stars above the best applicant the pool could produce at the time (at most five in all). */
  edge: 1,
  quals: ['swedish', 'deep', 'cranio'],
  hairStyle: 5,
  /** Always brown. */
  hair: 0x4a2f1d,
  sex: 'female',
} as const;

const TRAIT_BY_ID = new Map(TRAITS.map((t) => [t.id, t]));

/** Look up a staff quirk by id. An unknown id is a bug or a corrupt save, so it throws. */
export function traitOf(id: TraitId): TraitDef {
  const def = TRAIT_BY_ID.get(id);
  if (!def) throw new Error(`unknown trait "${id}"`);
  return def;
}

/** The product of one number their quirks each set, such as `stamina`, with 1 for a quirk that leaves it alone. */
export const traitProduct = (
  traits: readonly TraitId[],
  key: 'speed' | 'stamina' | 'walk' | 'learn' | 'pay' | 'hold',
) => traits.reduce((x, t) => x * (traitOf(t)[key] ?? 1), 1);

/** The highest of one number their quirks each set, such as `floor`, or 0 if none sets it. */
export const traitMost = (traits: readonly TraitId[], key: 'rep' | 'floor' | 'rescue') =>
  traits.reduce((x, t) => Math.max(x, traitOf(t)[key] ?? 0), 0);

/** How much faster than usual someone's quirks make them work: Brisk quicker, Chatterbox slower. */
export function traitSpeed(traits: readonly TraitId[]): number {
  return traits.reduce((speed, t) => speed * (traitOf(t).speed ?? 1), 1);
}
