// Women and men: everyone is one or the other, and their first name, hair and facial hair follow it. Applicants for
// the desk and the treatment tables are mostly women, caretakers mostly men, and guests half and half. And the rest of
// a look: a build, glasses and shoes.
import { describe, expect, it } from 'vitest';

import { AMANDA, CAMEOS, MEN_NAMES, ROLE_ORDER, WOMEN_APPLY, WOMEN_NAMES } from '../../src/core/data';
import {
  HAIR,
  hairFor,
  makeCandidate,
  MEN_HAIR,
  randomLook,
  randomName,
  settleLook,
  settleSex,
  sexOfName,
  SHOES,
  WOMEN_HAIR,
} from '../../src/core/people';
import { random, setSeed, stream } from '../../src/core/random';
import { createContext } from '../../src/core/sim/context';
import { spawnGuest } from '../../src/core/sim/guests';
import { newGame } from '../../src/core/state/game';
import type { Look } from '../../src/core/state/types';
import { upgradeSave } from '../../src/core/state/upgrade';
import { openCenter } from './helpers';

/** The share of a list that passes a test. */
const share = <T>(list: readonly T[], test: (x: T) => boolean) => list.filter(test).length / list.length;

describe('names', () => {
  it("are a woman's or a man's, cameos included, and tell which", () => {
    const r = stream(4);
    for (const sex of ['female', 'male'] as const) {
      for (let i = 0; i < 500; i++) expect(sexOfName(randomName(r, sex))).toBe(sex);
    }
    for (const c of CAMEOS) expect(sexOfName(c.name)).toBe(c.sex);
    expect(sexOfName('Someone Unheard-of')).toBeUndefined();
  });

  it('never put one name on both lists', () => {
    expect(WOMEN_NAMES.filter((n) => MEN_NAMES.includes(n))).toEqual([]);
  });
});

describe('looks', () => {
  it('give women and men their own hair, and only men a moustache or a beard, half of them', () => {
    const r = stream(5);
    const women = Array.from({ length: 2000 }, () => randomLook(r, 'female'));
    const men = Array.from({ length: 2000 }, () => randomLook(r, 'male'));
    for (const l of women) expect([l.sex, WOMEN_HAIR.includes(l.hairStyle), l.beard]).toEqual(['female', true, 0]);
    for (const l of men) expect([l.sex, MEN_HAIR.includes(l.hairStyle)]).toEqual(['male', true]);
    expect(share(men, (l) => l.beard > 0)).toBeCloseTo(0.5, 1);
    // every style turns up
    expect(new Set(women.map((l) => l.hairStyle))).toEqual(new Set(WOMEN_HAIR));
    expect(new Set(men.map((l) => l.hairStyle))).toEqual(new Set(MEN_HAIR));
    expect(new Set(men.map((l) => l.beard))).toEqual(new Set([0, 1, 2]));
  });

  it('never give the mohawk to anyone but Amanda Jablonsky', () => {
    setSeed(9);
    expect([...WOMEN_HAIR, ...MEN_HAIR]).not.toContain(HAIR.mohawk);
    const s = newGame();
    for (const role of ROLE_ORDER) {
      for (let i = 0; i < 3000; i++) {
        s.candidates = [];
        const c = makeCandidate(s, role);
        expect(c.look.hairStyle === HAIR.mohawk, c.name).toBe(c.name === AMANDA.name);
      }
    }
  });
});

describe('applicants', () => {
  it('are mostly women at the desk and the tables, and mostly men for caretaking', () => {
    setSeed(6);
    const s = newGame();
    for (const role of ROLE_ORDER) {
      const pool = Array.from({ length: 3000 }, () => {
        s.candidates = [];
        return makeCandidate(s, role);
      });
      expect(
        share(pool, (c) => c.look.sex === 'female'),
        role,
      ).toBeCloseTo(WOMEN_APPLY[role], 1);
      for (const c of pool) expect(sexOfName(c.name) ?? c.look.sex, c.name).toBe(c.look.sex);
    }
    expect(WOMEN_APPLY.caretaker).toBeLessThan(0.5);
    expect(WOMEN_APPLY.therapist).toBeGreaterThan(0.5);
  });

  it('bring Amanda Jablonsky as often as ever, as a woman', () => {
    setSeed(7);
    const s = newGame();
    const pool = Array.from({ length: 20000 }, () => {
      s.candidates = [];
      return makeCandidate(s, 'therapist');
    });
    const hers = pool.filter((c) => c.name === AMANDA.name);
    expect(hers.length / pool.length).toBeCloseTo(AMANDA.chance, 2);
    for (const c of hers) expect([c.look.sex, c.look.hair]).toEqual(['female', AMANDA.hair]);
  });
});

describe('guests', () => {
  it('are women and men about half and half, with names to match', () => {
    setSeed(8);
    const { s } = openCenter(1);
    const ctx = createContext(s);
    const guests = Array.from({ length: 600 }, () => {
      s.guests = [];
      const g = spawnGuest(ctx);
      if (!g) throw new Error('no guest');
      return g;
    });
    expect(share(guests, (g) => g.look.sex === 'female')).toBeCloseTo(0.5, 1);
    for (const g of guests) expect(sexOfName(g.name)).toBe(g.look.sex);
  });
});

describe('a save from before women and men were told apart', () => {
  /** A look as an older version kept it, with no sex or facial hair. */
  const old = (hairStyle: number) => ({ skin: 0, hair: 0, hairStyle, top: 0, bottom: 0, scale: 1 }) as Look;

  it('takes the sex from the name, then the hair, then the id, and gives hair to match', () => {
    const named = { id: 1, name: 'Barnaby Kneadham', look: old(HAIR.bun) };
    settleSex(named);
    expect(named.look.sex).toBe('male');
    expect(MEN_HAIR).toContain(named.look.hairStyle);
    expect(named.look.beard).toBe(0);

    const bunned = { id: 2, name: 'Unknown Person', look: old(HAIR.bun) };
    settleSex(bunned);
    expect([bunned.look.sex, bunned.look.hairStyle]).toEqual(['female', HAIR.bun]);

    const bald = { id: 3, name: 'Unknown Person', look: old(HAIR.bald) };
    settleSex(bald);
    expect([bald.look.sex, bald.look.hairStyle]).toEqual(['male', HAIR.bald]);

    for (const id of [4, 5]) {
      const either = { id, name: 'Unknown Person', look: old(HAIR.short) };
      settleSex(either);
      expect(hairFor(either.look.sex)).toContain(either.look.hairStyle);
    }
  });

  it('never gives a man from an older save one of the haircuts that came later', () => {
    for (let id = 0; id < 40; id++) {
      const man = { id, name: 'Barnaby Kneadham', look: old(HAIR.bun) };
      settleSex(man);
      expect([HAIR.short, HAIR.bald, HAIR.curls]).toContain(man.look.hairStyle);
    }
    // and leaves a quiff a man already has alone
    const quiffed = { id: 1, name: 'Barnaby Kneadham', look: { ...old(HAIR.quiff), sex: 'male' as const, beard: 0 } };
    settleSex(quiffed);
    expect(quiffed.look.hairStyle).toBe(HAIR.quiff);
  });

  it('gives Amanda Jablonsky her brown mohawk, and takes the mohawk from anyone else', () => {
    const amanda = { id: 6, name: AMANDA.name, look: { ...old(HAIR.short), sex: 'female' as const, beard: 0 } };
    amanda.look.hair = 0xd9a441;
    settleSex(amanda);
    expect([amanda.look.hairStyle, amanda.look.hair]).toEqual([HAIR.mohawk, AMANDA.hair]);
    for (const sex of ['female', 'male'] as const) {
      const other = { id: 7, name: 'Unknown Person', look: { ...old(HAIR.mohawk), sex, beard: 0 } };
      settleSex(other);
      expect(hairFor(sex)).toContain(other.look.hairStyle);
    }
    const unsexed = { id: 8, name: 'Unknown Person', look: old(HAIR.mohawk) };
    settleSex(unsexed);
    expect(unsexed.look.hairStyle).not.toBe(HAIR.mohawk);
  });

  it('settles everyone on loading, and leaves a look that has a sex alone', () => {
    const { s } = openCenter(1);
    const kept = { ...s.staff[0]!.look };
    for (const p of [...s.staff.slice(1), ...s.candidates]) {
      const { sex: _sex, beard: _beard, ...look } = p.look;
      p.look = look as Look;
    }
    upgradeSave(s);
    expect(s.staff[0]!.look).toEqual(kept);
    for (const p of [...s.staff, ...s.candidates]) {
      expect(hairFor(p.look.sex), p.name).toContain(p.look.hairStyle);
      expect(p.look.beard).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('the rest of a look', () => {
  /** Many looks, women's and men's. */
  const many = () => {
    const r = stream(11);
    return Array.from({ length: 4000 }, (_, i) => randomLook(r, i % 2 ? 'female' : 'male'));
  };

  it('comes slight, average or stocky, average the most', () => {
    const looks = many();
    expect(new Set(looks.map((l) => l.build))).toEqual(new Set([0, 1, 2]));
    expect(share(looks, (l) => l.build === 1)).toBeCloseTo(0.5, 1);
    expect(share(looks, (l) => l.build === 0)).toBeCloseTo(0.25, 1);
  });

  it('puts glasses on a quarter of people, round or square', () => {
    const looks = many();
    expect(share(looks, (l) => l.glasses > 0)).toBeCloseTo(0.25, 1);
    expect(share(looks, (l) => l.glasses === 1)).toBeCloseTo(0.125, 1);
    expect(new Set(looks.map((l) => l.glasses))).toEqual(new Set([0, 1, 2]));
  });

  it('puts shoes on in any of four colors', () => {
    const looks = many();
    expect(new Set(looks.map((l) => l.shoes))).toEqual(new Set([0, 1, 2, 3]));
    for (const shoes of [0, 1, 2, 3]) expect(share(looks, (l) => l.shoes === shoes)).toBeCloseTo(0.25, 1);
    expect(SHOES).toHaveLength(4);
  });

  it("takes no more of the game's random numbers than a look ever did", () => {
    for (const sex of ['female', 'male'] as const) {
      const r = stream(12);
      const look = randomLook(r, sex);
      const before = stream(12);
      // skin, hair, style, top, bottom and height, and for a man whether he has a moustache or a beard, and which
      const draws = 6 + (sex === 'male' ? (look.beard ? 2 : 1) : 0);
      for (let i = 0; i < draws; i++) random(before);
      expect(r.rng).toBe(before.rng);
    }
  });

  it('is settled from the id for a save from before, and left alone once it has one', () => {
    const builds = [0, 1, 2, 3].map((id) => {
      const p = { id, look: {} as Partial<Look> };
      settleLook(p);
      return p.look.build;
    });
    expect(builds).toEqual([1, 0, 1, 2]);
    const glasses = [1, 2, 5, 9].map((id) => {
      const p = { id, look: {} as Partial<Look> };
      settleLook(p);
      return p.look.glasses;
    });
    expect(glasses).toEqual([1, 0, 2, 1]);
    // and the brown shoes everyone wore before
    const shod = { id: 3, look: {} as Partial<Look> };
    settleLook(shod);
    expect(shod.look.shoes).toBe(0);
    const stocky = { id: 1, look: { build: 2 } as Partial<Look> };
    settleLook(stocky);
    expect(stocky.look.build).toBe(2);
  });

  it('settles a regular kept from before as well', () => {
    const { s } = openCenter(1);
    const look = { ...s.staff[0]!.look } as Partial<Look>;
    delete look.build;
    s.regulars = [{ id: 5, name: 'Some One', look: look as Look, visits: 1, loyalty: 50, due: 3 }];
    upgradeSave(s);
    expect(s.regulars[0]!.look.build).toBe(0);
  });
});
