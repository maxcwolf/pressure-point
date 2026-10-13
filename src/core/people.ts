// Making up people: how they look, what they are called and what a job applicant offers.

import {
  CAMEO_CHANCE,
  CAMEO_NAMES,
  DISCIPLINES,
  FIRST_NAMES,
  LAST_NAMES,
  MODALITIES,
  type Modality,
  MODALITY_ORDER,
  type Role,
  ROLE_ORDER,
  ROLES,
  type TraitId,
  traitOf,
  TRAITS,
} from './data';
import { irnd, pick, random, rnd } from './random';
import type { Candidate, GameState, Look } from './state/types';
import { clamp } from './util';

const SKINS = [0xf6d2b8, 0xeebf9e, 0xd9a078, 0xb97a55, 0x8d5a3b, 0x6b4229, 0xf9dfc9];

const HAIRS = [0x2b1d16, 0x4a2f1d, 0x8a5a2b, 0xd9a441, 0xb5422e, 0x8c8c8c, 0xe9e3d3, 0x6a4fb0, 0x2f7f7a];

const TOPS = [
  0xe76f51, 0xf4a261, 0xe9c46a, 0x2a9d8f, 0x4d7ea8, 0xb56576, 0x8ab17d, 0x6d597a, 0xef8fa2, 0x5fa8d3, 0xf2f2f2,
];

const BOTTOMS = [0x3d405b, 0x5c4b3a, 0x2f4858, 0x6b705c, 0x7f5539, 0x4a4e69, 0x8d99ae];

/** A random appearance. */
export function randomLook(): Look {
  return {
    skin: pick(SKINS),
    hair: pick(HAIRS),
    hairStyle: irnd(0, 4),
    top: pick(TOPS),
    bottom: pick(BOTTOMS),
    scale: rnd(0.92, 1.08),
  };
}

/** A random name, now and then a cameo. */
export const randomName = () =>
  random() < CAMEO_CHANCE ? pick(CAMEO_NAMES) : `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;

/** Make up a job applicant for a role. More stars bring more skilled ones. */
export function makeCandidate(s: GameState, role: Role): Candidate {
  const skill = clamp(Math.round(rnd(0.6, 3.4 + s.stars * 0.6)), 1, 5);
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
  const look = randomLook();
  look.top = ROLES[role].uniform;
  const salary = fairSalary(role, skill, traits, quals);
  return { id: s.nextId++, name: randomName(), role, skill, salary, traits, quals, look };
}

/** Each extra qualification is worth this much more pay. */
export const QUAL_PAY = 0.1;

/** The going rate for someone with this role, skill, quirks and training. */
export function fairSalary(role: Role, skill: number, traits: TraitId[], quals: Modality[]): number {
  let pay = ROLES[role].baseSalary * (0.75 + skill * 0.25);
  for (const t of traits) pay *= traitOf(t).pay ?? 1;
  if (ROLES[role].discipline) pay *= 1 + QUAL_PAY * Math.max(0, quals.length - 1);
  return Math.round(pay / 10) * 10;
}

/** Top up the applicants to three per role, optionally replacing them all. */
export function refillCandidates(s: GameState, replaceAll = false) {
  if (replaceAll) s.candidates = [];
  for (const role of ROLE_ORDER) {
    while (s.candidates.filter((c) => c.role === role).length < 3) s.candidates.push(makeCandidate(s, role));
  }
}
