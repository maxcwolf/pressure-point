// What people wear, while better people are being tried out: which version of them is drawn, picked in the page's
// address as `?people=clay`, `dressed` or `seasonal`, each building on the one before; with none named, people are
// drawn exactly as the game has them.
//
// - clay: the same clothes, built more cheaply where it cannot be seen and better where it can: mitten hands with a
//   thumb, slimmer arms under rounder shoulders, a clearer waist, and fewer sides on the hair, head, shoes and limbs.
// - dressed: clay, and clothes with a shape. Guests come in skirts, dresses and shorts as well as trousers, in
//   T-shirts as well as sweatshirts; staff each wear their role's cut: a long white coat, a tunic, a robe, sportswear.
// - seasonal: dressed, and dressed for the day: parkas, scarves and bobble hats in winter, T-shirts, shorts and sun
//   hats in summer, vests and visors on the Boardwalk in summer, and a raincoat with the hood up in a storm.
//
// What someone wears is taken from spare bits of the number their height was drawn from, as their build, glasses and
// shoes are, so it takes none of the game's random numbers, and the same person always dresses the same way for the
// same day.

import { centerOf, type Role } from '../../core/data';
import { calendarDay, type Season, seasonOf } from '../../core/format';
import { TOPS } from '../../core/people';
import { mishapOn } from '../../core/sim/mishaps';
import type { GameState, Look } from '../../core/state/types';
import { fxChoice } from '../fx';

/** The versions of the people that can be tried, each building on the one before it. */
export const PEOPLE_VARIANTS = ['clay', 'dressed', 'seasonal'] as const;

/** How far along the versions the people are drawn: 0 as the game has them, then one for each in `PEOPLE_VARIANTS`. */
const STEP = PEOPLE_VARIANTS.indexOf(fxChoice('people') as (typeof PEOPLE_VARIANTS)[number]) + 1;

/** Whether people are built the clay version's way, with mitten hands, slimmer arms and fewer sides. */
export const CLAY = STEP >= 1;

/** Whether people wear clothes with a shape: skirts, dresses, shorts, T-shirts, and each role's cut. */
export const DRESSED = STEP >= 2;

/** Whether people dress for the season, the setting and the weather. */
export const SEASONAL = STEP >= 3;

/** The day people are dressed for: the season, where the center is, and whether a storm is blowing. */
export interface Weather {
  season: Season;
  setting: string;
  storm: boolean;
}

/** A mild spring day in the park, which is what people dress for until the game says otherwise. */
const MILD: Weather = { season: 'spring', setting: 'park', storm: false };

/** The day the model lab's address asks for, as `&season=winter&setting=seaside&storm`, if it asks. */
function askedFor(): Weather | undefined {
  if (typeof location === 'undefined') return undefined;
  const params = new URLSearchParams(location.search);
  const season = params.get('season');
  if (!season && !params.has('setting') && !params.has('storm')) return undefined;
  return {
    season: (['winter', 'spring', 'summer', 'autumn'] as const).find((s) => s === season) ?? MILD.season,
    setting: params.get('setting') ?? MILD.setting,
    storm: params.has('storm'),
  };
}

const ASKED = askedFor();

/** The day people being made up now are dressed for. */
let today: Weather = ASKED ?? MILD;

/**
 * Note the day the game is at, for whoever is made up next to dress for: once a frame, from the people layer. The model
 * lab's address, if it names a day, wins.
 */
export function dressFor(s: GameState) {
  if (!SEASONAL || ASKED) return;
  today = {
    season: seasonOf(calendarDay(s)),
    setting: centerOf(s).scenery ?? 'park',
    storm: mishapOn(s)?.id === 'storm',
  };
}

/** What covers someone's body: a sweatshirt, a T-shirt, a vest with bare arms, or a padded parka. */
export type Top = 'long' | 'tee' | 'vest' | 'parka';

/** What covers their legs: trousers, shorts, a skirt in their trousers' color, or a dress in their top's. */
export type Legs = 'trousers' | 'shorts' | 'skirt' | 'dress';

/** What they wear on their head. */
export type Hat = 'beanie' | 'sunhat' | 'visor' | 'hood' | 'sweatband';

/** How long a member of staff's top is cut, below the shirt: to the hip, the knee, or the shin. */
export type Cut = 'tunic' | 'coat' | 'robe';

/** Everything someone wears beyond what the game has always drawn. */
export interface Outfit {
  top: Top;
  legs: Legs;
  /** Whether their legs are bare under a skirt, dress or shorts, or in tights the color of their trousers. */
  bareLegs: boolean;
  hat?: Hat;
  scarf: boolean;
  shades: boolean;
  /** How long their top is cut, for the staff whose role wears it long. */
  cut?: Cut;
  /**
   * The color of a skirt, a hat or a scarf: one of the colors guests' tops come in, so it is never taken for a uniform,
   * and a skirt reads as its own block of color under the top.
   */
  accent: number;
}

/** What everyone wore before: a sweatshirt and trousers, and nothing more. */
const PLAIN: Outfit = { top: 'long', legs: 'trousers', bareLegs: false, scarf: false, shades: false, accent: 0 };

/**
 * The spare bits of the number someone's height was drawn from, past those their build, glasses and shoes take (see
 * `lookBits` in `core/people.ts`): plenty for what they wear, and the same every time for the same look.
 */
function spareBits(look: Look) {
  const height = (look.scale - 0.92) / (1.08 - 0.92);
  return (Math.floor(height * 2 ** 32) >>> 7) ^ ((look.top * 2654435761) >>> 9);
}

/** A reader of spare bits, a few at a time. */
class Bits {
  constructor(private n: number) {}
  /** The next `count` bits, as a number from 0 to 2^count - 1. */
  take(count: number) {
    const v = this.n & ((1 << count) - 1);
    this.n >>>= count;
    return v;
  }
  /** One of the choices, by the next bits: a list of four gives each a quarter. */
  of<T>(choices: readonly T[]) {
    return choices[this.take(Math.ceil(Math.log2(choices.length))) % choices.length] as T;
  }
  /** True about this share of the time, in eighths. */
  chance(eighths: number) {
    return this.take(3) < eighths;
  }
}

/** The season someone dresses for: in the mountains it is a season colder, but for the height of summer. */
function feels(w: Weather): Season {
  if (w.setting !== 'mountain') return w.season;
  return w.season === 'summer' ? 'spring' : 'winter';
}

/** What a guest, a visitor or anyone not in uniform wears today. */
function everyday(look: Look, b: Bits): Outfit {
  const woman = look.sex === 'female';
  const accent = b.of(TOPS);
  /** What they wear on a mild day, as the dressed version always has them: the same top and legs, by the same bits. */
  const mild = (): Outfit => ({
    ...PLAIN,
    accent,
    top: b.of(['long', 'long', 'tee', 'tee'] as const),
    legs: woman ? b.of(['trousers', 'skirt', 'dress', 'dress'] as const) : b.chance(2) ? 'shorts' : 'trousers',
    bareLegs: b.chance(6),
  });
  if (!SEASONAL) return mild();
  const w = today;
  if (w.storm) {
    // caught in the rain on the way: a raincoat in their own color, mostly with the hood up
    const o = mild();
    return {
      ...o,
      top: 'parka',
      legs: o.legs === 'shorts' ? 'trousers' : o.legs,
      bareLegs: false,
      ...(b.chance(6) && { hat: 'hood' as const }),
    };
  }
  const season = feels(w);
  if (season === 'winter')
    return {
      ...PLAIN,
      accent,
      top: b.chance(5) ? 'parka' : 'long',
      legs: woman ? b.of(['trousers', 'skirt', 'trousers', 'dress'] as const) : 'trousers',
      bareLegs: false,
      ...(b.chance(5) && { hat: 'beanie' as const }),
      scarf: b.chance(5),
    };
  if (season === 'autumn') {
    const o = mild();
    return {
      ...o,
      top: o.top === 'tee' ? 'long' : o.top,
      legs: o.legs === 'shorts' ? 'trousers' : o.legs,
      bareLegs: false,
      scarf: b.chance(2),
    };
  }
  if (season === 'summer' && w.setting === 'seaside')
    // down the shore: vests and shorts, a visor or a sun hat, and shades
    return {
      ...PLAIN,
      accent,
      top: b.chance(4) ? 'vest' : 'tee',
      legs: woman ? b.of(['shorts', 'dress', 'skirt', 'shorts'] as const) : 'shorts',
      bareLegs: true,
      ...(b.chance(3) ? { hat: 'visor' as const } : b.chance(3) ? { hat: 'sunhat' as const } : {}),
      shades: b.chance(3),
    };
  if (season === 'summer')
    return {
      ...PLAIN,
      accent,
      top: b.of(['tee', 'tee', 'vest', 'long'] as const),
      legs: woman ? b.of(['shorts', 'skirt', 'dress', 'trousers'] as const) : b.chance(6) ? 'shorts' : 'trousers',
      bareLegs: true,
      ...(b.chance(3) && { hat: 'sunhat' as const }),
      shades: b.chance(1),
    };
  return mild();
}

/**
 * The cut each role wears, so it reads by its outline as well as its color: a long white coat for a consultant, a
 * tunic for a massage therapist, a long tunic and bare forearms for an acupuncturist, robes for a practitioner and a
 * sound healer, and sportswear for an instructor. A receptionist, a Caretaker and a Shaman have theirs already.
 */
const ROLE_CUTS: Partial<Record<Role, Partial<Outfit>>> = {
  consultant: { cut: 'coat' },
  therapist: { cut: 'tunic' },
  acupuncturist: { cut: 'coat', top: 'tee' },
  practitioner: { cut: 'robe' },
  healer: { cut: 'robe' },
  instructor: { top: 'vest', legs: 'shorts', bareLegs: true, hat: 'sweatband' },
};

/**
 * What the model lab's address dresses every guest in, as `&wear=dress,vest,sunhat,scarf,shades,bare`, to picture
 * each piece: a top, legs, a hat, and a scarf, shades and bare legs if named.
 */
function woreFor(): Partial<Outfit> | undefined {
  if (typeof location === 'undefined') return undefined;
  const asked = new URLSearchParams(location.search).get('wear');
  if (!asked) return undefined;
  const names = asked.split(',');
  /** The first name asked for that is one of these, if any. */
  const one = <T extends string>(of: readonly T[]) => of.find((n) => names.includes(n));
  const top = one(['long', 'tee', 'vest', 'parka'] as const);
  const legs = one(['trousers', 'shorts', 'skirt', 'dress'] as const);
  const hat = one(['beanie', 'sunhat', 'visor', 'hood', 'sweatband'] as const);
  return {
    ...(top && { top }),
    ...(legs && { legs }),
    ...(hat && { hat }),
    scarf: names.includes('scarf'),
    shades: names.includes('shades'),
    bareLegs: names.includes('bare') || legs === 'shorts',
  };
}

const WORE = woreFor();

/**
 * What someone wears, beyond what the game has always drawn: nothing, unless a version that dresses them is tried, nor
 * for anyone already in a `costume` (a visitor's clothes, or the center's robe).
 */
export function outfitOf(look: Look, role?: Role, costume = false): Outfit {
  if (!DRESSED || costume) return PLAIN;
  if (role) return { ...PLAIN, ...ROLE_CUTS[role] };
  const own = everyday(look, new Bits(spareBits(look)));
  return WORE ? { ...own, ...WORE } : own;
}
