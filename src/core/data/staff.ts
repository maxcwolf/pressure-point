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
  caretaker: {
    role: 'caretaker',
    name: 'Janitor',
    icon: '🧹',
    desc: 'Clears litter and waters the plants.',
    baseSalary: 600,
    uniform: 0x7d8f45,
    accent: 0xe8c65a,
  },
};

export const ROLE_ORDER: readonly Role[] = ['receptionist', 'consultant', 'therapist', 'acupuncturist', 'caretaker'];

export const TRAITS: readonly TraitDef[] = [
  { id: 'brisk', name: 'Brisk', desc: 'Works 20% faster.', speed: 1.2, pay: 1.1 },
  { id: 'tireless', name: 'Tireless', desc: 'Tires 35% more slowly.', stamina: 0.65, pay: 1.1 },
  { id: 'chatty', name: 'Chatterbox', desc: 'Works 15% slower. Has opinions about crystals.', speed: 0.85, pay: 0.92 },
  { id: 'sleepy', name: 'Sleepyhead', desc: 'Tires 35% faster.', stamina: 1.35, pay: 0.9 },
  { id: 'speedy', name: 'Power Walker', desc: 'Gets around 30% faster.', walk: 1.3, pay: 1.05 },
  { id: 'dawdler', name: 'Dawdler', desc: 'Has never hurried in their life.', walk: 0.8, pay: 0.92 },
  { id: 'bargain', name: 'Undervalued', desc: 'Asks for 15% less pay. Do not tell them.', pay: 0.85 },
];

const TRAIT_BY_ID = new Map(TRAITS.map((t) => [t.id, t]));

/** Look up a staff quirk by id. An unknown id is a bug or a corrupt save, so it throws. */
export function traitOf(id: TraitId): TraitDef {
  const def = TRAIT_BY_ID.get(id);
  if (!def) throw new Error(`unknown trait "${id}"`);
  return def;
}
