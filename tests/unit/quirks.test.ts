// Quirks: every applicant has one to three that do not clash, at most one of them a flaw, now and then a rare one too,
// pay follows them, and each rare one works through a hook the simulation already had.

import { describe, expect, it } from 'vitest';

import {
  CLASHES,
  clashes,
  COMMON_TRAITS,
  QUIRKS_MAX,
  QUIRKS_MIN,
  RARE_CHANCE,
  RARE_TRAITS,
  type TraitId,
  traitMost,
  traitOf,
  traitSpeed,
} from '../../src/core/data';
import { fairSalary, makeCandidate, rollQuirks } from '../../src/core/people';
import { heldSpace } from '../../src/core/sim/careers';
import type { SimContext } from '../../src/core/sim/context';
import type { Sim } from '../../src/core/sim/sim';
import { moraleFloor } from '../../src/core/sim/staffing';
import { postAboutIt, serviceSeconds, worksAnyway } from '../../src/core/sim/stations';
import { freshSim, openCenter, run } from './helpers';

/** The simulation's own context, which the hooks are given. */
const ctxOf = (sim: Sim) => (sim as unknown as { ctx: SimContext }).ctx;

describe('the roll', () => {
  const rolls = Array.from({ length: 7000 }, (_, i) => rollQuirks({ rng: i * 7919 + 1 }));

  it('gives one to three common quirks, none twice', () => {
    for (const r of rolls) {
      const common = r.filter((t) => !traitOf(t).rare);
      expect(common.length).toBeGreaterThanOrEqual(QUIRKS_MIN);
      expect(common.length).toBeLessThanOrEqual(QUIRKS_MAX);
      expect(new Set(r).size).toBe(r.length);
    }
    // and every count turns up
    for (let n = QUIRKS_MIN; n <= QUIRKS_MAX; n++)
      expect(rolls.some((r) => r.filter((t) => !traitOf(t).rare).length === n)).toBe(true);
  });

  it('gives nobody more than one flaw', () => {
    for (const r of rolls) expect(r.filter((t) => traitOf(t).bad).length).toBeLessThanOrEqual(1);
  });

  it('never puts two clashing quirks on one person', () => {
    for (const r of rolls) for (const a of r) for (const b of r) expect(clashes(a, b)).toBe(false);
  });

  it('adds a rare quirk, last, for about one in seven', () => {
    const rare = rolls.filter((r) => r.some((t) => traitOf(t).rare));
    expect(rare.length / rolls.length).toBeCloseTo(RARE_CHANCE, 1);
    for (const r of rare) {
      expect(r.filter((t) => traitOf(t).rare)).toHaveLength(1);
      expect(traitOf(r.at(-1)!).rare).toBe(true);
    }
  });

  it('leaves nobody without a quirk, applicant or Amanda Jablonsky', () => {
    const sim = freshSim(3);
    for (let i = 0; i < 300; i++) expect(makeCandidate(sim.s, 'therapist').traits.length).toBeGreaterThan(0);
  });
});

describe('the clash rule', () => {
  it('works both ways, and only between opposites', () => {
    expect(clashes('brisk', 'chatty')).toBe(true);
    expect(clashes('chatty', 'brisk')).toBe(true);
    expect(clashes('grump', 'sunny')).toBe(true);
    expect(clashes('brisk', 'grump')).toBe(false);
    expect(clashes('brisk', 'brisk')).toBe(false);
  });

  it('names only common quirks, each once', () => {
    const named = CLASHES.flat();
    for (const t of named) expect(COMMON_TRAITS.some((c) => c.id === t)).toBe(true);
    expect(new Set(named).size).toBe(named.length);
  });
});

describe('the pay', () => {
  it('follows every quirk, a rare one at a quarter more', () => {
    const plain = fairSalary('therapist', 3, [], ['swedish']);
    expect(fairSalary('therapist', 3, ['brisk', 'bargain'], ['swedish'])).toBe(
      Math.round((plain * 1.1 * 0.85) / 10) * 10,
    );
    for (const t of RARE_TRAITS) {
      expect(t.pay).toBe(1.25);
      expect(fairSalary('therapist', 3, [t.id], ['swedish'])).toBe(Math.round((plain * 1.25) / 10) * 10);
    }
  });

  it('is what an applicant asks', () => {
    const sim = freshSim(5);
    for (let i = 0; i < 50; i++) {
      const c = makeCandidate(sim.s, 'consultant');
      expect(c.salary).toBe(fairSalary(c.role, c.skill, c.traits, c.quals));
    }
  });
});

describe('the rare quirks', () => {
  it('a Former Influencer works 10% slower, and each guest they heal earns a little more reputation', () => {
    expect(traitSpeed(['influencer'])).toBeCloseTo(0.9);
    const { sim, therapist } = openCenter(1);
    therapist.traits = [];
    expect(serviceSeconds(60, { ...therapist, traits: ['influencer'] })).toBeCloseTo(
      serviceSeconds(60, therapist) / 0.9,
    );
    sim.s.reputation = 40;
    postAboutIt(ctxOf(sim), therapist);
    expect(sim.s.reputation).toBe(40);
    therapist.traits = ['influencer'];
    postAboutIt(ctxOf(sim), therapist);
    expect(sim.s.reputation).toBeGreaterThan(40);
  });

  it('a Burnout Survivor never falls below 35, however badly paid', () => {
    /** The lowest a badly paid therapist with these quirks sinks to over a few minutes of play. */
    const lowest = (traits: TraitId[]) => {
      const { sim, therapist } = openCenter(1);
      therapist.traits = traits;
      therapist.salary = 10;
      let low = 100;
      for (let i = 0; i < 40; i++) {
        run(sim, 5);
        low = Math.min(low, therapist.morale);
      }
      return low;
    };
    expect(moraleFloor({ traits: ['survivor'] } as never)).toBe(35);
    expect(lowest(['survivor'])).toBeGreaterThanOrEqual(35);
    expect(lowest([])).toBeLessThan(35);
  });

  it('Healing Hands saves one failed treatment in ten, and nobody else rolls the dice', () => {
    const ctx = { s: { rng: 99 } } as unknown as SimContext;
    const plain = { traits: ['brisk'] } as never;
    expect(Array.from({ length: 100 }, () => worksAnyway(ctx, plain)).some(Boolean)).toBe(false);
    expect(ctx.s.rng).toBe(99);
    const hands = { traits: ['hands'] } as never;
    const saved = Array.from({ length: 20000 }, () => worksAnyway(ctx, hands)).filter(Boolean).length;
    expect(saved / 20000).toBeCloseTo(traitMost(['hands'], 'rescue'), 1.5);
  });

  it('Holds Space speeds up colleagues posted in the same room, within reach, and nobody elsewhere', () => {
    const { sim, therapist, consultant } = openCenter(1);
    const ctx = ctxOf(sim);
    therapist.traits = [];
    consultant.traits = ['space'];
    const table = sim.s.items.find((i) => i.type === 'massage_table')!;
    const desk = sim.s.items.find((i) => i.type === 'consult_desk')!;
    Object.assign(therapist, { state: 'atPost', post: table.id, x: 12.5, y: 6.5 });
    // posted in the consultation room, near enough but not in the same room
    Object.assign(consultant, { state: 'atPost', post: desk.id, x: 10.5, y: 6.5 });
    expect(heldSpace(ctx, therapist)).toBe(1);
    // posted at the same table's room
    consultant.post = therapist.post;
    expect(heldSpace(ctx, therapist)).toBeCloseTo(1.1);
    // and their own speed is untouched
    expect(heldSpace(ctx, consultant)).toBe(1);
    // out of reach, even in the same room's post
    Object.assign(consultant, { x: 30, y: 30 });
    expect(heldSpace(ctx, therapist)).toBe(1);
    expect(serviceSeconds(60, therapist, 1.1)).toBeCloseTo(serviceSeconds(60, therapist) / 1.1);
  });
});
