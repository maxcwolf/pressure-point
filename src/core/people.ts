// Making up people: how they look, what they are called and what a job applicant offers.

import {
  AMANDA,
  CAMEO_CHANCE,
  CAMEOS,
  DISCIPLINES,
  GRADE_APPLICANT_SKILL,
  LAST_NAMES,
  MEN_NAMES,
  MODALITIES,
  type Modality,
  MODALITY_ORDER,
  RECRUIT_SKILL,
  type Role,
  ROLE_ORDER,
  ROLES,
  type Sex,
  type TraitId,
  traitOf,
  TRAITS,
  WOMEN_APPLY,
  WOMEN_NAMES,
} from './data';
import { pick, random, rnd } from './random';
import type { Candidate, GameState, Look } from './state/types';
import { clamp } from './util';

const SKINS = [0xf6d2b8, 0xeebf9e, 0xd9a078, 0xb97a55, 0x8d5a3b, 0x6b4229, 0xf9dfc9];

const HAIRS = [0x2b1d16, 0x4a2f1d, 0x8a5a2b, 0xd9a441, 0xb5422e, 0x8c8c8c, 0xe9e3d3, 0x6a4fb0, 0x2f7f7a];

const TOPS = [
  0xe76f51, 0xf4a261, 0xe9c46a, 0x2a9d8f, 0x4d7ea8, 0xb56576, 0x8ab17d, 0x6d597a, 0xef8fa2, 0x5fa8d3, 0xf2f2f2,
];

const BOTTOMS = [0x3d405b, 0x5c4b3a, 0x2f4858, 0x6b705c, 0x7f5539, 0x4a4e69, 0x8d99ae];

/** The hair styles, by the number a look keeps. A number already in saves never changes meaning. */
export const HAIR = {
  short: 0,
  bun: 1,
  long: 2,
  bald: 3,
  curls: 4,
  mohawk: AMANDA.hairStyle,
  bob: 6,
  ponytail: 7,
} as const;

/** The hair styles women and men wear. Either may have big curls; the mohawk is Amanda Jablonsky's alone. */
export const WOMEN_HAIR: readonly number[] = [HAIR.bun, HAIR.long, HAIR.curls, HAIR.bob, HAIR.ponytail];
export const MEN_HAIR: readonly number[] = [HAIR.short, HAIR.bald, HAIR.curls];

/** The hair styles someone of this sex wears. */
export const hairFor = (sex: Sex) => (sex === 'female' ? WOMEN_HAIR : MEN_HAIR);

/** A woman, with this chance, or else a man. */
export const rollSex = (womenShare: number): Sex => (random() < womenShare ? 'female' : 'male');

/** A random appearance for a woman or a man: half of men have a moustache or a beard. */
export function randomLook(sex: Sex): Look {
  return {
    skin: pick(SKINS),
    hair: pick(HAIRS),
    hairStyle: pick(hairFor(sex)),
    top: pick(TOPS),
    bottom: pick(BOTTOMS),
    scale: rnd(0.92, 1.08),
    sex,
    beard: sex === 'male' && random() < 0.5 ? (random() < 0.4 ? 1 : 2) : 0,
  };
}

const CAMEOS_BY_SEX: Readonly<Record<Sex, readonly string[]>> = {
  female: CAMEOS.filter((c) => c.sex === 'female').map((c) => c.name),
  male: CAMEOS.filter((c) => c.sex === 'male').map((c) => c.name),
};

/** A random name for a woman or a man, now and then a cameo. */
export const randomName = (sex: Sex) =>
  random() < CAMEO_CHANCE
    ? pick(CAMEOS_BY_SEX[sex])
    : `${pick(sex === 'female' ? WOMEN_NAMES : MEN_NAMES)} ${pick(LAST_NAMES)}`;

/** Whether a name is a woman's or a man's, if it is one the game gives out. */
export function sexOfName(name: string): Sex | undefined {
  if (name === AMANDA.name) return AMANDA.sex;
  const cameo = CAMEOS.find((c) => c.name === name);
  if (cameo) return cameo.sex;
  const first = name.split(' ')[0] ?? '';
  if (WOMEN_NAMES.includes(first)) return 'female';
  if (MEN_NAMES.includes(first)) return 'male';
  return undefined;
}

/**
 * Give a look from before women and men were told apart a sex, from the name if it says, from the hair if not, and
 * failing both from the id; then a hair style to match if theirs does not. The mohawk, and brown hair, go to Amanda
 * Jablonsky, whose save may be older than either, and the mohawk is taken from anyone else. Choices come from the id rather than the game's random
 * numbers, so loading a save changes nothing about what happens next.
 */
export function settleSex(person: { id: number; name: string; look: Partial<Look> & Omit<Look, 'sex' | 'beard'> }) {
  const { look } = person;
  look.beard ??= 0;
  look.sex ??=
    sexOfName(person.name) ??
    (look.hairStyle === HAIR.bun || look.hairStyle === HAIR.long
      ? 'female'
      : look.hairStyle === HAIR.bald
        ? 'male'
        : person.id % 2
          ? 'female'
          : 'male');
  const styles = hairFor(look.sex);
  if (person.name === AMANDA.name) Object.assign(look, { hairStyle: AMANDA.hairStyle, hair: AMANDA.hair });
  else if (!styles.includes(look.hairStyle)) look.hairStyle = styles[person.id % styles.length] ?? HAIR.short;
}

/** Whether Amanda Jablonsky already works here or is applying. */
export const amandaAround = (s: GameState) =>
  s.staff.some((st) => st.name === AMANDA.name) || s.candidates.some((c) => c.name === AMANDA.name);

/** Make up a job applicant for a role. More stars bring more skilled ones, and now and then a familiar face. */
export function makeCandidate(s: GameState, role: Role): Candidate {
  // a recruitment drive brings in a better class of applicant
  const drive = s.campaigns.some((c) => c.kind === 'recruit') ? RECRUIT_SKILL : 0;
  // and a center standing higher, better still
  const skill = clamp(Math.round(rnd(0.6, 3.4 + s.stars * 0.6 + s.grade * GRADE_APPLICANT_SKILL)) + drive, 1, 5);
  const traits: TraitId[] = [];
  if (random() < 0.65) traits.push(pick(TRAITS).id);
  // practitioners all know their discipline's basic modality; a few arrive trained in something more
  const quals: Modality[] = [];
  const discipline = ROLES[role].discipline;
  if (discipline) {
    for (const m of MODALITY_ORDER) {
      const def = MODALITIES[m];
      if (def.discipline !== discipline) continue;
      if (m === DISCIPLINES[discipline].base || (def.star <= s.stars && random() < 0.28)) quals.push(m);
    }
  }
  // Amanda Jablonsky is decided first, so how often she turns up does not hang on how many therapists are women
  const amanda = role === 'therapist' && !amandaAround(s) && random() < AMANDA.chance;
  const sex = amanda ? AMANDA.sex : rollSex(WOMEN_APPLY[role]);
  const look = randomLook(sex);
  look.top = ROLES[role].uniform;
  if (amanda) {
    const best = Math.max(skill, AMANDA.minSkill);
    const hers = [...AMANDA.quals];
    Object.assign(look, { hairStyle: AMANDA.hairStyle, hair: AMANDA.hair });
    return {
      id: s.nextId++,
      name: AMANDA.name,
      role,
      skill: best,
      salary: fairSalary(role, best, traits, hers),
      traits,
      quals: hers,
      look,
    };
  }
  const salary = fairSalary(role, skill, traits, quals);
  return { id: s.nextId++, name: randomName(sex), role, skill, salary, traits, quals, look };
}

/** Each extra qualification is worth this much more pay. */
export const QUAL_PAY = 0.1;

/** The going rate for someone with this role, rank, quirks and training (treatments, and general courses passed). */
export function fairSalary(role: Role, skill: number, traits: TraitId[], quals: Modality[], general = 0): number {
  let pay = ROLES[role].baseSalary * (0.75 + skill * 0.25);
  for (const t of traits) pay *= traitOf(t).pay ?? 1;
  if (ROLES[role].discipline) pay *= 1 + QUAL_PAY * Math.max(0, quals.length - 1);
  pay *= 1 + QUAL_PAY * general;
  return Math.round(pay / 10) * 10;
}

/** Top up the applicants to three per role, optionally replacing them all. */
export function refillCandidates(s: GameState, replaceAll = false) {
  if (replaceAll) s.candidates = [];
  for (const role of ROLE_ORDER) {
    while (s.candidates.filter((c) => c.role === role).length < 3) s.candidates.push(makeCandidate(s, role));
  }
}
