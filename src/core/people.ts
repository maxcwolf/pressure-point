// Making up people: how they look, what they are called and what a job applicant offers.

import {
  AMANDA,
  CAMEO_CHANCE,
  CAMEOS,
  clashes,
  COMMON_TRAITS,
  DISCIPLINES,
  GRADE_APPLICANT_SKILL,
  LAST_NAMES,
  MEN_NAMES,
  MODALITIES,
  type Modality,
  MODALITY_ORDER,
  QUIRKS_MAX,
  QUIRKS_MIN,
  RARE_CHANCE,
  RARE_TRAITS,
  RECRUIT_SKILL,
  type Role,
  ROLE_ORDER,
  ROLES,
  type Sex,
  type TraitId,
  traitOf,
  WOMEN_APPLY,
  WOMEN_NAMES,
} from './data';
import { tuning } from './difficulty';
import { pick, random, rnd, type Rng } from './random';
import type { Candidate, GameState, Look } from './state/types';
import { clamp } from './util';

const SKINS = [0xf6d2b8, 0xeebf9e, 0xd9a078, 0xb97a55, 0x8d5a3b, 0x6b4229, 0xf9dfc9];

const HAIRS = [0x2b1d16, 0x4a2f1d, 0x8a5a2b, 0xd9a441, 0xb5422e, 0x8c8c8c, 0xe9e3d3, 0x6a4fb0, 0x2f7f7a];

/**
 * The colors guests' tops come in: none a uniform's, so a member of staff stands out in a crowd. As many as there
 * always were, so making someone up takes the game's random numbers as it always did.
 */
const TOPS = [
  0xe76f51, 0xf4a261, 0xe9c46a, 0xc8417f, 0x3a5fc8, 0xb56576, 0x6a3fa0, 0x6d597a, 0xef8fa2, 0x5fa8d3, 0xa8d14f,
];

/**
 * The tops guests wore that were too like a uniform, and what each became: the receptionist's teal, the healer's blue,
 * the Caretaker's sage, and the white of the consultant's and practitioner's coats.
 */
const RETIRED_TOPS: ReadonlyMap<number, number> = new Map([
  [0x2a9d8f, 0xc8417f],
  [0x4d7ea8, 0x3a5fc8],
  [0x8ab17d, 0x6a3fa0],
  [0xf2f2f2, 0xa8d14f],
]);

/** Put a guest from an older save in the top a guest in that color would wear now, rather than a uniform's. */
export function settleTop(look: Pick<Look, 'top'>) {
  look.top = RETIRED_TOPS.get(look.top) ?? look.top;
}

/** The colors shoes come in: the brown everyone wore before, black, tan and white. */
export const SHOES = [0x3a302b, 0x1d1d22, 0x9b6b3f, 0xe8e4dc];

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
  quiff: 8,
  topknot: 9,
} as const;

/** The hair styles women and men wear. Either may have big curls; the mohawk is Amanda Jablonsky's alone. */
export const WOMEN_HAIR: readonly number[] = [HAIR.bun, HAIR.long, HAIR.curls, HAIR.bob, HAIR.ponytail];
export const MEN_HAIR: readonly number[] = [HAIR.short, HAIR.bald, HAIR.curls, HAIR.quiff, HAIR.topknot];

/**
 * The styles a look from an older save is given in place of one its sex does not wear: those there were then, so a
 * save settles as it always did, and the newer styles only come to people made up since.
 */
const SETTLED_HAIR: Readonly<Record<Sex, readonly number[]>> = {
  female: WOMEN_HAIR,
  male: [HAIR.short, HAIR.bald, HAIR.curls],
};

/** The hair styles someone of this sex wears. */
export const hairFor = (sex: Sex) => (sex === 'female' ? WOMEN_HAIR : MEN_HAIR);

/** A woman, with this chance, or else a man. */
export const rollSex = (r: Rng, womenShare: number): Sex => (random(r) < womenShare ? 'female' : 'male');

/** A build from a number's lowest two bits: slight, average twice over, or stocky. */
const buildOf = (n: number) => [0, 1, 1, 2][n & 3] ?? 1;

/**
 * What a look takes from the spare bits of the number its height was drawn from: its build, glasses and shoes. The height uses the top
 * bits, and these the bottom ones, so making someone up takes no more of the game's random numbers than it did, and a
 * seeded game runs as it always has.
 */
function lookBits(height: number) {
  const bits = Math.floor(height * 2 ** 32) >>> 0;
  // slight, average twice over, or stocky; glasses on a quarter of people, round or square; and any color of shoe
  return {
    build: buildOf(bits),
    glasses: ((bits >>> 2) & 3) === 0 ? 1 + ((bits >>> 4) & 1) : 0,
    shoes: (bits >>> 5) & 3,
  };
}

/** A random appearance for a woman or a man: half of men have a moustache or a beard. */
export function randomLook(r: Rng, sex: Sex): Look {
  // drawn in the order they always were, so the game's random numbers fall the same way
  const skin = pick(r, SKINS);
  const hair = pick(r, HAIRS);
  const hairStyle = pick(r, hairFor(sex));
  const top = pick(r, TOPS);
  const bottom = pick(r, BOTTOMS);
  const height = random(r);
  const beard = sex === 'male' && random(r) < 0.5 ? (random(r) < 0.4 ? 1 : 2) : 0;
  return { skin, hair, hairStyle, top, bottom, scale: 0.92 + height * (1.08 - 0.92), sex, beard, ...lookBits(height) };
}

/**
 * Give a look from before builds, glasses and shoes the fields it lacks, from the person's id rather than the game's
 * random numbers, so loading a save changes nothing about what happens next.
 */
export function settleLook(person: { id: number; look: Partial<Look> }) {
  person.look.build ??= [1, 0, 1, 2][person.id % 4] ?? 1;
  person.look.glasses ??= person.id % 4 === 1 ? 1 + ((person.id >> 2) % 2) : 0;
  // everyone's shoes were brown, and stay so
  person.look.shoes ??= 0;
}

const CAMEOS_BY_SEX: Readonly<Record<Sex, readonly string[]>> = {
  female: CAMEOS.filter((c) => c.sex === 'female').map((c) => c.name),
  male: CAMEOS.filter((c) => c.sex === 'male').map((c) => c.name),
};

/** A random name for a woman or a man, now and then a cameo. */
export const randomName = (r: Rng, sex: Sex) =>
  random(r) < CAMEO_CHANCE
    ? pick(r, CAMEOS_BY_SEX[sex])
    : `${pick(r, sex === 'female' ? WOMEN_NAMES : MEN_NAMES)} ${pick(r, LAST_NAMES)}`;

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
export function settleSex(person: {
  id: number;
  name: string;
  look: Partial<Look> & Omit<Look, 'sex' | 'beard' | 'build'>;
}) {
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
  const styles = SETTLED_HAIR[look.sex];
  if (person.name === AMANDA.name) Object.assign(look, { hairStyle: AMANDA.hairStyle, hair: AMANDA.hair });
  else if (!hairFor(look.sex).includes(look.hairStyle))
    look.hairStyle = styles[person.id % styles.length] ?? HAIR.short;
}

/** Whether Amanda Jablonsky already works here or is applying. */
export const amandaAround = (s: GameState) =>
  s.staff.some((st) => st.name === AMANDA.name) || s.candidates.some((c) => c.name === AMANDA.name);

/** Make up a job applicant for a role. More stars bring more skilled ones, and now and then a familiar face. */
export function makeCandidate(s: GameState, role: Role): Candidate {
  // a recruitment drive brings in a better class of applicant
  const drive = s.campaigns.some((c) => c.kind === 'recruit') ? RECRUIT_SKILL : 0;
  // and a center standing higher, better still
  const reach = 3.4 + s.stars * 0.6 + s.grade * GRADE_APPLICANT_SKILL;
  const skill = clamp(Math.round(rnd(s, 0.6, reach)) + drive, 1, 5);
  const traits = rollQuirks(s);
  // practitioners all know their discipline's basic modality; a few arrive trained in something more
  const quals: Modality[] = [];
  const discipline = ROLES[role].discipline;
  if (discipline) {
    for (const m of MODALITY_ORDER) {
      const def = MODALITIES[m];
      // nobody arrives trained on a machine: its course is learned here, once it is built
      if (def.discipline !== discipline || def.machine) continue;
      if (m === DISCIPLINES[discipline].base || (def.star <= s.stars && random(s) < 0.28)) quals.push(m);
    }
  }
  // Amanda Jablonsky is decided first, so how often she turns up does not hang on how many therapists are women
  const amanda = role === 'therapist' && !amandaAround(s) && random(s) < AMANDA.chance;
  const sex = amanda ? AMANDA.sex : rollSex(s, WOMEN_APPLY[role]);
  const look = randomLook(s, sex);
  look.top = ROLES[role].uniform;
  if (amanda) {
    // she outranks the best the pool could offer right now, so she keeps pace as the center grows
    const best = clamp(Math.round(reach) + drive + AMANDA.edge, AMANDA.minSkill, 5);
    const hers = [...AMANDA.quals];
    Object.assign(look, { hairStyle: AMANDA.hairStyle, hair: AMANDA.hair });
    return {
      id: s.nextId++,
      name: AMANDA.name,
      role,
      skill: best,
      salary: scalePay(fairSalary(role, best, traits, hers), tuning(s, 'salaries')),
      traits,
      quals: hers,
      look,
    };
  }
  const salary = scalePay(fairSalary(role, skill, traits, quals), tuning(s, 'salaries'));
  return { id: s.nextId++, name: randomName(s, sex), role, skill, salary, traits, quals, look };
}

/**
 * An applicant's quirks: one to three common ones, none of them clashing with another and at most one of them a
 * flaw, and now and then a rare one as well, last.
 */
export function rollQuirks(r: Rng): TraitId[] {
  const count = QUIRKS_MIN + Math.floor(random(r) * (QUIRKS_MAX - QUIRKS_MIN + 1));
  const quirks: TraitId[] = [];
  while (quirks.length < count) {
    const flawed = quirks.some((q) => traitOf(q).bad);
    const free = COMMON_TRAITS.filter(
      (t) => !quirks.includes(t.id) && !quirks.some((q) => clashes(q, t.id)) && !(flawed && t.bad),
    );
    if (!free.length) break;
    quirks.push(pick(r, free).id);
  }
  if (random(r) < RARE_CHANCE) quirks.push(pick(r, RARE_TRAITS).id);
  return quirks;
}

/** A salary scaled up or down, to the nearest $10. Scaled by 1, a salary from `fairSalary` is unchanged. */
export const scalePay = (salary: number, scale: number) => Math.round((salary * scale) / 10) * 10;

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
