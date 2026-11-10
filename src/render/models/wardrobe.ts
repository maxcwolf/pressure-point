// What people wear. A guest dresses for the day they come in: the season, where the center is and the weather, in
// parkas, scarves and bobble hats in winter, T-shirts, shorts, skirts and sun hats in summer, vests, visors and shades
// down the shore, and a raincoat with the hood up in a storm, and keeps what they came in until they leave, but for
// their outerwear, which comes off for a treatment and goes back on to leave (`outerwearOn`). Staff wear their role's
// uniform, cut to an outline of its own (a long white coat, a tunic, a robe, sportswear), in short sleeves in summer
// and long ones the rest of the year, and are dressed again as the season turns or a storm blows in. Visitors come
// dressed for the part, and a guest asked back after a complaint in the center's robe, and those clothes never change.
//
// Which of the outfits a day offers someone puts on is read from their taste in clothes (`Look.wear`), sixteen bits
// that are a look's own, so dressing someone takes none of the game's random numbers, and the same guest on the same
// day always comes in the same clothes. Everything here is plain numbers: the shapes and the dressing are in
// character-clothes.ts.

import { centerOf, type Role } from '../../core/data';
import { calendarDay, type Season, seasonOf } from '../../core/format';
import { TOPS } from '../../core/people';
import { mishapOn } from '../../core/sim/mishaps';
import type { Char, GameState, Look } from '../../core/state/types';

/** The day people are dressed for: the season, the setting the center is in, and whether a storm is blowing. */
export interface Weather {
  season: Season;
  setting: string;
  storm: boolean;
}

/** A mild spring day in the park, which is what people dress for when nothing says otherwise. */
export const MILD: Readonly<Weather> = { season: 'spring', setting: 'park', storm: false };

/** The day the game is at, for whoever comes in now to dress for. */
export function weatherOf(s: GameState): Weather {
  return {
    season: seasonOf(calendarDay(s)),
    setting: centerOf(s).scenery ?? 'park',
    storm: mishapOn(s)?.id === 'storm',
  };
}

/** A day as a few letters, to tell at a glance whether it has changed since someone was last dressed. */
export const weatherKey = (w: Weather) => `${w.season}|${w.setting}|${w.storm ? 'storm' : ''}`;

/** What covers someone's body: a sweatshirt, a T-shirt, a vest with bare arms, or a padded parka over a sweatshirt. */
export type Top = 'long' | 'tee' | 'vest' | 'parka';

/** What covers their legs: trousers, shorts, a skirt in a color of its own, or a dress in their top's color. */
export type Legs = 'trousers' | 'shorts' | 'skirt' | 'dress';

/** What they wear on their head. */
export type Hat = 'beanie' | 'sunhat' | 'visor' | 'hood' | 'sweatband';

/**
 * How long a top is cut below the shirt: a tunic to the hip, a coat to the knee or a robe to the shin, for the staff
 * whose role wears one, and the gown of the center's robe, to the knee, for a guest asked back after a complaint.
 */
export type Cut = 'tunic' | 'coat' | 'robe' | 'gown';

/** Everything someone wears over the shirt and trousers that build them. */
export interface Outfit {
  top: Top;
  legs: Legs;
  /** Whether their legs are bare under a skirt, a dress or shorts, or in tights the color of their trousers. */
  bareLegs: boolean;
  hat?: Hat;
  scarf: boolean;
  shades: boolean;
  /** How long their top is cut, for the staff whose role wears it long and the center's robe. */
  cut?: Cut;
  /**
   * The color of a skirt, a hat or a scarf: one of the colors guests' tops come in, and never their own top's, so it is
   * never taken for a uniform and a skirt reads as a block of color of its own under the top. Staff wear their role's.
   */
  accent: number;
}

/** A sweatshirt and trousers and nothing more, as everyone wore before there was a wardrobe, and visitors still do. */
export const PLAIN: Readonly<Outfit> = {
  top: 'long',
  legs: 'trousers',
  bareLegs: false,
  scarf: false,
  shades: false,
  accent: 0,
};

/** The center's robe, for a guest asked back after a complaint: its gown to the knee over trousers. */
const GOWN: Readonly<Outfit> = { ...PLAIN, cut: 'gown' };

/**
 * What comes off for a treatment and goes back on to leave: the parka and the raincoat, any hat, the scarf and shades.
 * Under a parka is a sweatshirt.
 */
export function withoutOuterwear(o: Outfit): Outfit {
  const { hat: _hat, ...rest } = o;
  return { ...rest, top: o.top === 'parka' ? 'long' : o.top, scarf: false, shades: false };
}

/** Whether an outfit has anything on that comes off for a treatment. */
export const hasOuterwear = (o: Outfit) => o.top === 'parka' || o.hat !== undefined || o.scarf || o.shades;

/**
 * Whether someone has their outerwear on, given whether they had it on a moment ago: a guest takes it off to be
 * treated, to rest after, or to lie down for anything, and keeps it off until they leave, when it goes back on.
 * Everyone else keeps theirs on.
 */
export function outerwearOn(wasOn: boolean, c: Char): boolean {
  if (c.kind !== 'guest') return true;
  if (c.state === 'served' || c.state === 'resting' || c.pose === 'lie') return false;
  return wasOn || c.state === 'leaving';
}

/** Someone's taste in clothes, as bits read a few at a time, with a second helping scrambled from the first. */
class Taste {
  private n: number;
  private more: number;
  constructor(wear: number) {
    this.n = wear >>> 0;
    // a stretch of bits made from the first, for a day that asks more of a look than its own sixteen hold
    let h = Math.imul(wear ^ 0x5bd1e995, 0x27d4eb2d);
    h ^= h >>> 15;
    this.more = Math.imul(h, 0x165667b1) >>> 0;
  }
  /** The next `count` bits, as a number from 0 to 2^count - 1. */
  take(count: number) {
    const v = this.n & ((1 << count) - 1);
    this.n = (this.n >>> count) | ((this.more & ((1 << count) - 1)) << (32 - count));
    this.more >>>= count;
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
export function feels(w: Weather): Season {
  if (w.setting !== 'mountain') return w.season;
  return w.season === 'summer' ? 'spring' : 'winter';
}

/** What a guest wears on a mild day: a sweatshirt or a T-shirt, and trousers, a skirt, a dress or shorts. */
function mild(look: Look, t: Taste, accent: number): Outfit {
  const woman = look.sex === 'female';
  return {
    ...PLAIN,
    accent,
    top: t.of(['long', 'long', 'tee', 'tee'] as const),
    legs: woman ? t.of(['trousers', 'skirt', 'dress', 'dress'] as const) : t.chance(2) ? 'shorts' : 'trousers',
    bareLegs: t.chance(6),
  };
}

/** What a guest, or anyone else not in a uniform or a costume, wears on a day, by their taste in clothes. */
function everyday(look: Look, w: Weather): Outfit {
  const t = new Taste(look.wear);
  const woman = look.sex === 'female';
  const accent = t.of(TOPS.filter((c) => c !== look.top));
  /** Shades, this many eighths of the time, only for those who do not wear glasses: they go on in place of nothing. */
  const shady = (eighths: number) => !look.glasses && t.chance(eighths);
  if (w.storm) {
    // caught in the rain on the way: a raincoat in their own color, mostly with the hood up
    const o = mild(look, t, accent);
    return {
      ...o,
      top: 'parka',
      legs: o.legs === 'shorts' ? 'trousers' : o.legs,
      bareLegs: false,
      ...(t.chance(6) && { hat: 'hood' as const }),
    };
  }
  const season = feels(w);
  if (season === 'winter')
    return {
      ...PLAIN,
      accent,
      top: t.chance(5) ? 'parka' : 'long',
      legs: woman ? t.of(['trousers', 'skirt', 'trousers', 'dress'] as const) : 'trousers',
      bareLegs: false,
      ...(t.chance(5) && { hat: 'beanie' as const }),
      scarf: t.chance(5),
    };
  if (season === 'autumn') {
    const o = mild(look, t, accent);
    return {
      ...o,
      top: o.top === 'tee' ? 'long' : o.top,
      legs: o.legs === 'shorts' ? 'trousers' : o.legs,
      bareLegs: false,
      scarf: t.chance(2),
    };
  }
  if (season === 'summer' && w.setting === 'seaside')
    // down the shore: vests and shorts, a visor or a sun hat, and shades
    return {
      ...PLAIN,
      accent,
      top: t.chance(4) ? 'vest' : 'tee',
      legs: woman ? t.of(['shorts', 'dress', 'skirt', 'shorts'] as const) : 'shorts',
      bareLegs: true,
      ...(t.chance(3) ? { hat: 'visor' as const } : t.chance(3) ? { hat: 'sunhat' as const } : {}),
      shades: shady(3),
    };
  if (season === 'summer')
    return {
      ...PLAIN,
      accent,
      top: t.of(['tee', 'tee', 'vest', 'long'] as const),
      legs: woman ? t.of(['shorts', 'skirt', 'dress', 'trousers'] as const) : t.chance(6) ? 'shorts' : 'trousers',
      bareLegs: true,
      ...(t.chance(3) && { hat: 'sunhat' as const }),
      shades: shady(1),
    };
  return mild(look, t, accent);
}

/**
 * The cut each role wears, so it reads by its outline as well as its color: a long white coat for a consultant, a
 * tunic and rolled sleeves for a massage therapist, a coat and bare forearms for an acupuncturist, robes for a
 * practitioner and a sound healer, and sportswear and a sweatband for an instructor, who dresses for the season. A
 * receptionist, a Caretaker and a Shaman have theirs already, in their scarf, bib and cap, and poncho.
 */
const ROLE_CUTS: Readonly<Record<Role, Partial<Outfit>>> = {
  consultant: { cut: 'coat' },
  therapist: { cut: 'tunic', top: 'tee' },
  acupuncturist: { cut: 'coat', top: 'tee' },
  practitioner: { cut: 'robe' },
  healer: { cut: 'robe' },
  instructor: { hat: 'sweatband' },
  receptionist: {},
  caretaker: {},
  shaman: {},
};

/** The roles that keep their sleeves long through the summer: a consultant's white coat, cut as it always is. */
const LONG_SLEEVED: ReadonlySet<Role> = new Set(['consultant']);

/**
 * What a member of staff wears in a season: their role's cut, in short sleeves in summer, and an instructor in a vest
 * and shorts in summer, a T-shirt and shorts in spring and autumn, and long sleeves and trousers in winter.
 */
function uniform(role: Role, w: Weather): Outfit {
  const season = feels(w);
  const cut = ROLE_CUTS[role];
  if (role === 'instructor') {
    const kit: Partial<Outfit> =
      season === 'summer'
        ? { top: 'vest', legs: 'shorts', bareLegs: true }
        : season === 'winter'
          ? { top: 'long', legs: 'trousers', bareLegs: false }
          : { top: 'tee', legs: 'shorts', bareLegs: true };
    return { ...PLAIN, ...cut, ...kit };
  }
  const summer = season === 'summer' && !LONG_SLEEVED.has(role);
  return { ...PLAIN, ...cut, ...(summer && { top: 'tee' as const }) };
}

/** What the model lab dresses people for, and any pieces it puts everyone in, to picture each. */
let lab: { weather: Weather; wear: Partial<Outfit> | undefined } = { weather: MILD, wear: undefined };

/**
 * Dress everyone the model lab builds for a day, and in any pieces named, as its address asks
 * (`&season=winter&setting=seaside&storm&wear=dress,vest,sunhat`); the game itself always says what the day is.
 */
export function dressTheLab(weather: Weather, wear?: Partial<Outfit>) {
  lab = { weather, wear };
}

/** The day people are dressed for when nothing says: a mild one, or whatever the model lab asks for. */
export const labWeather = (): Weather => lab.weather;

/**
 * What someone wears on a day: a member of staff their role's uniform for the season, anyone in a `costume` (a
 * visitor's clothes) nothing over it, a guest asked back in the center's robe its gown, and a guest what their taste
 * picks from what the day calls for.
 */
export function outfitOf(look: Look, w: Weather, role?: Role, costume = false, robed = false): Outfit {
  if (role) return uniform(role, w);
  if (costume) return PLAIN;
  if (robed) return GOWN;
  const own = everyday(look, w);
  return lab.wear ? { ...own, ...lab.wear } : own;
}

/** An outfit as a few letters, to tell whether someone's clothes need changing at all. */
export const outfitKey = (o: Outfit) =>
  `${o.top}|${o.legs}|${o.bareLegs ? 1 : 0}|${o.hat ?? ''}|${o.scarf ? 1 : 0}|${o.shades ? 1 : 0}|${o.cut ?? ''}|${o.accent}`;
