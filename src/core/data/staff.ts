// Staff roles and the quirks a member of staff can have.

import type { Role, RoleDef, TraitDef, TraitId } from './types';

export const ROLES: Readonly<Record<Role, RoleDef>> = {
  receptionist: {
    role: 'receptionist',
    name: 'Receptionist',
    icon: '🛎️',
    desc: 'Checks guests in at a Reception Desk.',
    baseSalary: 800,
    uniform: 0x2fa8a0,
    accent: 0xffffff,
  },
  consultant: {
    role: 'consultant',
    name: 'Wellness Consultant',
    icon: '🩺',
    desc: 'Diagnoses guests in a Consultation Room. Skill means fewer repeat visits.',
    baseSalary: 1700,
    uniform: 0xf4f1ea,
    accent: 0x3f7fb5,
  },
  therapist: {
    role: 'therapist',
    name: 'Massage Therapist',
    icon: '💆',
    desc: 'Treats guests in a Massage Suite. Each one knows certain modalities; train them to add more.',
    baseSalary: 1400,
    uniform: 0xa784d6,
    accent: 0xf4f1ea,
    discipline: 'massage',
  },
  acupuncturist: {
    role: 'acupuncturist',
    name: 'Acupuncturist',
    icon: '📍',
    desc: 'Treats guests in an Acupuncture Clinic. Each one knows certain techniques; train them to add more.',
    baseSalary: 1600,
    uniform: 0x3f9d7a,
    accent: 0xf4f1ea,
    discipline: 'acupuncture',
  },
  practitioner: {
    role: 'practitioner',
    name: 'Reiki Practitioner',
    icon: '✨',
    desc: 'Treats guests in a Reiki Studio. Each one knows certain techniques; train them to add more.',
    baseSalary: 1700,
    uniform: 0xece6f5,
    accent: 0x7a5aa8,
    discipline: 'reiki',
  },
  healer: {
    role: 'healer',
    name: 'Sound Healer',
    icon: '🔔',
    desc: 'Plays for every guest on the mats of a Sound Bath Studio at once. Each one knows certain techniques; train them to add more.',
    baseSalary: 1650,
    uniform: 0x3f7f8c,
    accent: 0xf2e6c8,
    discipline: 'sound',
  },
  caretaker: {
    role: 'caretaker',
    name: 'Caretaker',
    icon: '🧹',
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
];

export const TRAITS: readonly TraitDef[] = [
  { id: 'brisk', name: 'Brisk', desc: 'Works 20% faster.', speed: 1.2, pay: 1.1 },
  { id: 'tireless', name: 'Tireless', desc: 'Tires 35% more slowly.', stamina: 0.65, pay: 1.1 },
  { id: 'chatty', name: 'Chatterbox', desc: 'Works 15% slower. Has opinions about crystals.', speed: 0.85, pay: 0.92 },
  { id: 'sleepy', name: 'Sleepyhead', desc: 'Tires 35% faster.', stamina: 1.35, pay: 0.9 },
  { id: 'speedy', name: 'Power Walker', desc: 'Gets around 30% faster.', walk: 1.3, pay: 1.05 },
  { id: 'dawdler', name: 'Dawdler', desc: 'Has never hurried in their life.', walk: 0.8, pay: 0.92 },
  { id: 'bargain', name: 'Undervalued', desc: 'Asks for 15% less pay. Do not tell them.', pay: 0.85 },
  { id: 'litterbug', name: 'Litterbug', desc: 'Drops litter as they go.', pay: 0.9, habit: 'litter' },
  { id: 'grump', name: 'Grump', desc: 'Guests they see leave less pleased.', pay: 0.9, habit: 'grump' },
  { id: 'sunny', name: 'Ray of Sunshine', desc: 'Lifts the morale of colleagues nearby.', pay: 1.1, habit: 'cheer' },
  { id: 'quick', name: 'Quick Study', desc: 'Gets through courses 40% faster.', pay: 1.05, learn: 1.4 },
  { id: 'green', name: 'Green Thumb', desc: 'Waters thirsty plants in passing.', habit: 'water' },
];

/**
 * A massage therapist who now and then applies: at least three stars, and trained in every massage technique but
 * Sports and Hot Stone. There is only ever one of her, and she wears her hair in a mohawk, a style no one else has.
 */
export const AMANDA = {
  name: 'Amanda Jablonsky',
  chance: 0.05,
  minSkill: 3,
  quals: ['swedish', 'deep', 'cranio'],
  hairStyle: 5,
} as const;

const TRAIT_BY_ID = new Map(TRAITS.map((t) => [t.id, t]));

/** Look up a staff quirk by id. An unknown id is a bug or a corrupt save, so it throws. */
export function traitOf(id: TraitId): TraitDef {
  const def = TRAIT_BY_ID.get(id);
  if (!def) throw new Error(`unknown trait "${id}"`);
  return def;
}
