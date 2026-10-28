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
  type Role,
  ROLE_ORDER,
  ROLES,
  type TraitId,
  traitMost,
  traitOf,
  traitSpeed,
} from '../../src/core/data';
import { tuning } from '../../src/core/difficulty';
import { fairSalary, makeCandidate, rollQuirks, scalePay } from '../../src/core/people';
import { heldSpace } from '../../src/core/sim/careers';
import type { SimContext } from '../../src/core/sim/context';
import type { Sim } from '../../src/core/sim/sim';
import { moraleFloor } from '../../src/core/sim/staffing';
import { postAboutIt, serviceSeconds, worksAnyway } from '../../src/core/sim/stations';
import type { Candidate, GameState } from '../../src/core/state/types';
import { upgradeSave } from '../../src/core/state/upgrade';
import { freshSim, openCenter, run } from './helpers';

/** The simulation's own context, which the hooks are given. */
const ctxOf = (sim: Sim) => (sim as unknown as { ctx: SimContext }).ctx;

describe('the roll', () => {
  const rolls = Array.from({ length: 7000 }, (_, i) => rollQuirks({ rng: i * 7919 + 1 }, 'therapist'));

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

describe('the rare quirks for each role', () => {
  /** The rare quirks that turn up in many rolls for a role. */
  const rareFor = (role: Role) =>
    new Set(
      Array.from({ length: 4000 }, (_, i) => rollQuirks({ rng: i * 104729 + 3 }, role))
        .flat()
        .filter((t) => traitOf(t).rare),
    );

  it('gives Former Influencer and Healing Hands only to those who treat guests, and the other two to anyone', () => {
    // the roles whose work goes through a treatment: the Qi Gong Instructor's classes do not, and the Sound Healer's
    // baths do
    expect(ROLE_ORDER.filter((r) => ROLES[r].discipline).sort()).toEqual([
      'acupuncturist',
      'healer',
      'practitioner',
      'shaman',
      'therapist',
    ]);
    for (const role of ROLE_ORDER) {
      const rare = rareFor(role);
      const treats = !!ROLES[role].discipline;
      expect(rare.has('influencer')).toBe(treats);
      expect(rare.has('hands')).toBe(treats);
      expect(rare.has('survivor')).toBe(true);
      expect(rare.has('space')).toBe(true);
    }
  });

  it('keeps them from applicants who do not treat guests', () => {
    const sim = freshSim(7);
    for (const role of ['receptionist', 'consultant', 'caretaker', 'instructor'] as const)
      for (let i = 0; i < 200; i++) {
        const { traits } = makeCandidate(sim.s, role);
        expect(traits).not.toContain('influencer');
        expect(traits).not.toContain('hands');
      }
  });
});

describe('a save from before rare quirks fit the role', () => {
  it('takes them from staff and applicants who do not treat guests, and re-prices only the applicants', () => {
    const { s, receptionist, consultant, therapist } = openCenter(2);
    receptionist.traits = ['brisk', 'hands'];
    consultant.traits = ['bargain', 'influencer'];
    therapist.traits = ['green', 'influencer'];
    const pay = s.staff.map((st) => st.salary);
    /** An applicant in a role given these quirks, asking more than anyone would. */
    const apply = (role: Role, traits: TraitId[]) =>
      Object.assign(
        s.candidates.find((c) => c.role === role)!,
        { traits, salary: 9999 },
      );
    apply('receptionist', ['brisk', 'hands']);
    apply('caretaker', ['sleepy', 'influencer']);
    apply('therapist', ['quick', 'hands']);
    apply('consultant', ['tireless', 'survivor']);
    const old = JSON.parse(JSON.stringify(s)) as GameState;
    old.version = 42;
    upgradeSave(old);
    /** A member of staff in the upgraded save. */
    const staff = (id: number) => old.staff.find((st) => st.id === id)!;
    /** The applicant for a role given quirks above, in the upgraded save. */
    const applicant = (role: Role) => old.candidates.find((c) => c.role === role)!;
    /** What an applicant would ask, with the quirks they have. */
    const fair = (c: Candidate) => scalePay(fairSalary(c.role, c.skill, c.traits, c.quals), tuning(old, 'salaries'));
    // staff lose what they could never use, and keep the pay they were hired at
    expect(staff(receptionist.id).traits).toEqual(['brisk']);
    expect(staff(consultant.id).traits).toEqual(['bargain']);
    expect(staff(therapist.id).traits).toEqual(['green', 'influencer']);
    expect(old.staff.map((st) => st.salary)).toEqual(pay);
    // applicants lose it too, and ask what they are worth without it
    expect(applicant('receptionist').traits).toEqual(['brisk']);
    expect(applicant('receptionist').salary).toBe(fair(applicant('receptionist')));
    expect(applicant('caretaker').traits).toEqual(['sleepy']);
    expect(applicant('caretaker').salary).toBe(fair(applicant('caretaker')));
    // and one whose rare quirk fits keeps it, and their asking pay
    expect(applicant('therapist').traits).toEqual(['quick', 'hands']);
    expect(applicant('therapist').salary).toBe(9999);
    expect(applicant('consultant').traits).toEqual(['tireless', 'survivor']);
    expect(applicant('consultant').salary).toBe(9999);
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

  it('Holds Space speeds up colleagues at work within reach, through walls, and nobody further off', () => {
    const { sim, therapist, consultant } = openCenter(1);
    const ctx = ctxOf(sim);
    therapist.traits = [];
    consultant.traits = ['space'];
    const table = sim.s.items.find((i) => i.type === 'massage_table')!;
    const desk = sim.s.items.find((i) => i.type === 'consult_desk')!;
    Object.assign(therapist, { state: 'atPost', post: table.id, x: 12.5, y: 6.5 });
    // posted in the consultation room, through the wall but within reach
    Object.assign(consultant, { state: 'atPost', post: desk.id, x: 10.5, y: 6.5 });
    expect(heldSpace(ctx, therapist)).toBeCloseTo(1.15);
    // and their own speed is untouched
    expect(heldSpace(ctx, consultant)).toBe(1);
    // not while either is away from their post
    consultant.state = 'toPost';
    expect(heldSpace(ctx, therapist)).toBe(1);
    consultant.state = 'atPost';
    therapist.state = 'toPost';
    expect(heldSpace(ctx, therapist)).toBe(1);
    therapist.state = 'atPost';
    // out of reach
    Object.assign(consultant, { x: 30, y: 30 });
    expect(heldSpace(ctx, therapist)).toBe(1);
    expect(serviceSeconds(60, therapist, 1.15)).toBeCloseTo(serviceSeconds(60, therapist) / 1.15);
  });
});
