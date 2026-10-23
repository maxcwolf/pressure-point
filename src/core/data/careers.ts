// Staff careers: the ranks staff rise through, the general courses any of them can take, and the duties some of
// them can be kept to.

import type { Duty, GeneralDef, GeneralId, Role } from './types';

/** The five ranks, from a new starter to the best there is. A member of staff's rank is their skill. */
export const RANKS: readonly string[] = ['Trainee', 'Junior', 'Experienced', 'Senior', 'Expert'];

/** Experience needed to be ready for each rank, from rank 1 (none) to rank 5. */
export const RANK_XP: readonly number[] = [0, 20, 45, 80, 125];

/** Experience for a guest served, and for a Caretaker's job done (there are many more of those). */
export const XP_PER_GUEST = 1;
export const XP_PER_JOB = 0.4;

/** How much a member of staff waiting on a promotion sulks, and how much being promoted cheers them. */
export const PROMOTION_SULK = 12;
export const PROMOTION_CHEER = 10;

export const GENERAL_COURSES: Readonly<Record<GeneralId, GeneralDef>> = {
  bedside: {
    id: 'bedside',
    name: 'Bedside Manner',
    icon: 'course-bedside',
    desc: 'Guests waiting in their line lose patience a quarter more slowly, and a guest on a really bad trip is talked down a quarter sooner.',
    cost: 900,
    days: 6,
  },
  motivation: {
    id: 'motivation',
    name: 'Motivation',
    icon: 'course-motivation',
    desc: 'Works 15% faster at everything.',
    cost: 1200,
    days: 7,
  },
  stamina: {
    id: 'stamina',
    name: 'Stamina Training',
    icon: 'course-stamina',
    desc: 'Tires a quarter more slowly.',
    cost: 1000,
    days: 6,
  },
  service: {
    id: 'service',
    name: 'Customer Service',
    icon: 'course-service',
    desc: 'Checks guests in 30% faster.',
    cost: 700,
    days: 5,
    roles: ['receptionist'],
  },
  maintenance: {
    id: 'maintenance',
    name: 'Maintenance',
    icon: 'course-maintenance',
    desc: 'Repairs, cleans and tends things 40% faster.',
    cost: 800,
    days: 5,
    roles: ['caretaker'],
  },
  mechanics: {
    id: 'mechanics',
    name: 'Mechanics',
    icon: 'course-mechanics',
    desc: 'Installs the upgrades bought for treatment equipment.',
    cost: 900,
    days: 5,
    roles: ['caretaker'],
  },
  smudging: {
    id: 'smudging',
    name: 'Smudging',
    icon: 'course-smudging',
    desc: 'Clears the bad vibes a failed treatment leaves behind, wafting burning sage through the room.',
    cost: 600,
    days: 4,
    roles: ['caretaker'],
  },
};

export const GENERAL_ORDER = Object.keys(GENERAL_COURSES) as GeneralId[];

/** Whether a course is a general one, rather than a treatment. */
export const isGeneral = (c: string): c is GeneralId => Object.hasOwn(GENERAL_COURSES, c);

/** What each general course does, as a multiplier on the thing it changes. */
export const BEDSIDE_PATIENCE = 0.75;
export const MOTIVATION_SPEED = 1.15;
export const STAMINA_DRAIN = 0.75;
export const SERVICE_SPEED = 1.3;
export const MAINTENANCE_SPEED = 1 / 0.6;
/** What a Grump does to the reputation a healed guest brings. */
export const GRUMP_REP = 0.85;

/** The duties a member of each role can be kept to or kept from. Roles with one duty have nothing to choose. */
export const DUTIES: Readonly<Partial<Record<Role, readonly Duty[]>>> = {
  receptionist: ['reception', 'shop'],
  caretaker: ['litter', 'clean', 'repair', 'plants', 'stones'],
};

/** What each duty is called in the interface. */
export const DUTY_NAMES: Readonly<Record<Duty, string>> = {
  reception: 'Front desk',
  shop: 'Shop Counter',
  consult: 'Consultations',
  litter: 'Litter',
  clean: 'Cleaning',
  repair: 'Repairs',
  plants: 'Watering plants',
  stones: 'Heating stones',
};

/** The most applicants for one role at a time, and how many days apart new ones turn up. */
export const APPLICANTS_MAX = 8;
export const APPLICANT_DAYS = 4;
