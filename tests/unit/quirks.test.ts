// Quirks: every applicant has one to three that do not clash, at most one of them a flaw, now and then a rare one too,
// pay follows them, and each rare one works through a hook the simulation already had.

import { describe, expect, it } from 'vitest';

import {
  AMANDA,
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
import { heldSpace, holdingSpaceFor, spaceHolder } from '../../src/core/sim/careers';
import type { SimContext } from '../../src/core/sim/context';
import type { Sim } from '../../src/core/sim/sim';
import { postAboutIt, serviceSeconds, worksAnyway } from '../../src/core/sim/stations';
import type { Candidate, GameState, Staff } from '../../src/core/state/types';
import { upgradeSave } from '../../src/core/state/upgrade';
import { quirkNotes, quirksSaid, rareFirst } from '../../src/ui/lib/quirks';
import { freshSim, hire, openCenter, runUntil } from './helpers';

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

  it('never gives a Former Influencer, slower at the table, a common flaw as well', () => {
    expect(traitOf('influencer').bad).toBe(true);
    const many = Array.from({ length: 20000 }, (_, i) => rollQuirks({ rng: i * 6151 + 5 }, 'therapist'));
    const influencers = many.filter((r) => r.includes('influencer'));
    // enough of them, and enough with a flaw to be had, that a slip would show
    expect(influencers.length).toBeGreaterThan(150);
    for (const r of influencers) expect(r.filter((t) => t !== 'influencer' && traitOf(t).bad)).toEqual([]);
    // the other rare quirks still go to the flawed
    expect(many.some((r) => r.includes('hands') && r.some((t) => !traitOf(t).rare && traitOf(t).bad))).toBe(true);
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

  it('leaves nobody without a quirk, and gives Amanda Jablonsky her own three every time', () => {
    expect([...AMANDA.traits].sort()).toEqual(['dawdler', 'hands', 'quick']);
    const sim = freshSim(3);
    const pool = Array.from({ length: 3000 }, () => makeCandidate(sim.s, 'therapist'));
    for (const c of pool) expect(c.traits.length).toBeGreaterThan(0);
    const hers = pool.filter((c) => c.name === AMANDA.name);
    expect(hers.length).toBeGreaterThan(50);
    for (const c of hers) expect(c.traits).toEqual(AMANDA.traits);
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

  it('gives Former Influencer and Healing Hands only to those who treat guests, and Holds Space to anyone who takes a post', () => {
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
      expect(rare.has('space')).toBe(role !== 'caretaker');
    }
  });

  it('gives a Caretaker no rare quirk, as none fits, and anyone else one about one time in seven', () => {
    expect(rareFor('caretaker').size).toBe(0);
    for (const role of ROLE_ORDER.filter((r) => r !== 'caretaker')) {
      const rolls = Array.from({ length: 4000 }, (_, i) => rollQuirks({ rng: i * 104729 + 3 }, role));
      const rare = rolls.filter((q) => q.some((t) => traitOf(t).rare)).length / rolls.length;
      // a Former Influencer, a flaw, is held back from someone who already has one
      expect(rare, role).toBeGreaterThan(0.11);
      expect(rare, role).toBeLessThan(0.16);
    }
  });

  it('draws as many random numbers for a Caretaker, with no rare quirk to pick, as for anyone', () => {
    for (let i = 0; i < 2000; i++) {
      const caretaker = { rng: i * 7907 + 11 };
      const receptionist = { rng: i * 7907 + 11 };
      rollQuirks(caretaker, 'caretaker');
      rollQuirks(receptionist, 'receptionist');
      expect(caretaker.rng, `roll ${i}`).toBe(receptionist.rng);
    }
  });

  it('never gives a Caretaker, who never takes a post, Holds Space', () => {
    for (let i = 0; i < 20000; i++) expect(rollQuirks({ rng: i * 7907 + 11 }, 'caretaker')).not.toContain('space');
    const sim = freshSim(9);
    for (let i = 0; i < 300; i++) expect(makeCandidate(sim.s, 'caretaker').traits).not.toContain('space');
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
    // the therapist here is Amanda Jablonsky, whose quirks a later step sets: someone else, so this one stands alone
    therapist.name = 'Greta Pummell';
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
    apply('consultant', ['tireless', 'space']);
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
    expect(applicant('consultant').traits).toEqual(['tireless', 'space']);
    expect(applicant('consultant').salary).toBe(9999);
  });
});

describe('a save from before Holds Space was kept from Caretakers', () => {
  it('takes it from Caretakers, staff and applicants, and leaves it with a Receptionist', () => {
    const { sim, s, receptionist } = openCenter(4);
    const caretaker = hire(sim, 'caretaker');
    caretaker.traits = ['tireless', 'space'];
    receptionist.traits = ['green', 'space'];
    const pay = caretaker.salary;
    const applicant = Object.assign(makeCandidate(s, 'caretaker'), { traits: ['quick', 'space'], salary: 9999 });
    s.candidates.push(applicant);
    const old = JSON.parse(JSON.stringify(s)) as GameState;
    old.version = 43;
    upgradeSave(old);
    expect(old.staff.find((st) => st.id === caretaker.id)!.traits).toEqual(['tireless']);
    expect(old.staff.find((st) => st.id === caretaker.id)!.salary).toBe(pay);
    expect(old.staff.find((st) => st.id === receptionist.id)!.traits).toEqual(['green', 'space']);
    const after = old.candidates.find((c) => c.id === applicant.id)!;
    expect(after.traits).toEqual(['quick']);
    expect(after.salary).toBe(
      scalePay(fairSalary('caretaker', after.skill, ['quick'], after.quals), tuning(old, 'salaries')),
    );
  });
});

describe('a save from before Amanda Jablonsky had her own quirks', () => {
  /** A save at version 44 with Amanda Jablonsky given rolled quirks, on the staff or applying. */
  const oldSave = (hired: boolean) => {
    // the therapist hired here is Amanda Jablonsky: someone else, when she is to be applying instead
    const { s, therapist } = openCenter(2);
    if (!hired) therapist.name = 'Greta Pummell';
    const amanda = hired ? therapist : s.candidates.find((c) => c.role === 'therapist')!;
    Object.assign(amanda, { name: AMANDA.name, traits: ['brisk', 'grump'], salary: 9999 });
    const other = s.candidates.find((c) => c.role === 'receptionist')!;
    const old = JSON.parse(JSON.stringify(s)) as GameState;
    old.version = 44;
    upgradeSave(old);
    const people: (Candidate | Staff)[] = [...old.staff, ...old.candidates];
    return {
      old,
      amanda: people.find((p) => p.id === amanda.id)!,
      other: { before: other, after: old.candidates.find((c) => c.id === other.id)! },
    };
  };

  it('gives her the three, and re-prices her as an applicant', () => {
    const { old, amanda: c, other } = oldSave(false);
    expect(c.traits).toEqual(AMANDA.traits);
    expect(c.salary).toBe(scalePay(fairSalary(c.role, c.skill, c.traits, c.quals), tuning(old, 'salaries')));
    expect(c.salary).not.toBe(9999);
    // nobody else is touched
    expect(other.after.traits).toEqual(other.before.traits);
    expect(other.after.salary).toBe(other.before.salary);
  });

  it('gives her the three on the staff, and leaves her pay alone', () => {
    const { amanda } = oldSave(true);
    expect(amanda.traits).toEqual(AMANDA.traits);
    expect(amanda.salary).toBe(9999);
  });
});

describe('a save from before Burnout Survivor was taken out', () => {
  /** A save at this version with a Burnout Survivor on the staff and among the applicants, on a pay no rule gives. */
  const oldSave = (version: number) => {
    const { s, receptionist, therapist } = openCenter(3);
    // the therapist hired here may be Amanda Jablonsky, whose quirks a step of their own sets
    therapist.name = 'Greta Pummell';
    Object.assign(receptionist, { traits: ['brisk', 'survivor'], salary: 9999 });
    therapist.traits = ['tireless', 'hands'];
    const survivor = Object.assign(
      s.candidates.find((c) => c.role === 'consultant')!,
      {
        traits: ['bargain', 'survivor'],
        salary: 9999,
      },
    );
    const other = s.candidates.find((c) => c.role === 'caretaker')!;
    const old = JSON.parse(JSON.stringify(s)) as GameState;
    old.version = version;
    upgradeSave(old);
    /** A member of staff in the upgraded save. */
    const staff = (id: number) => old.staff.find((st) => st.id === id)!;
    /** An applicant in the upgraded save. */
    const applicant = (id: number) => old.candidates.find((c) => c.id === id)!;
    return {
      old,
      staff,
      applicant,
      receptionist,
      therapist,
      survivor,
      other,
    };
  };

  it('takes it from staff, who keep their pay, and from applicants, who ask what they are worth without it', () => {
    const { old, staff, applicant, receptionist, therapist, survivor, other } = oldSave(46);
    expect(staff(receptionist.id).traits).toEqual(['brisk']);
    expect(staff(receptionist.id).salary).toBe(9999);
    expect(staff(therapist.id).traits).toEqual(['tireless', 'hands']);
    const c = applicant(survivor.id);
    expect(c.traits).toEqual(['bargain']);
    expect(c.salary).toBe(scalePay(fairSalary('consultant', c.skill, ['bargain'], c.quals), tuning(old, 'salaries')));
    // nobody else is touched
    expect(applicant(other.id).traits).toEqual(other.traits);
    expect(applicant(other.id).salary).toBe(other.salary);
  });

  it('takes it before the older steps that read quirks, which no longer know it', () => {
    const { staff, applicant, receptionist, survivor } = oldSave(42);
    expect(staff(receptionist.id).traits).toEqual(['brisk']);
    expect(applicant(survivor.id).traits).toEqual(['bargain']);
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
    expect(therapist.posts).toBeUndefined();
    therapist.traits = ['influencer'];
    postAboutIt(ctxOf(sim), therapist);
    expect(sim.s.reputation).toBeGreaterThan(40);
  });

  it('a Former Influencer shows each post: reputation floats up over them, and they keep count', () => {
    const { sim, therapist } = openCenter(1);
    therapist.traits = ['influencer'];
    sim.drain();
    postAboutIt(ctxOf(sim), therapist);
    postAboutIt(ctxOf(sim), therapist);
    expect(therapist.posts).toBe(2);
    const floats = sim.drain().filter((e) => e.type === 'float');
    expect(floats).toEqual([
      { type: 'float', text: 'Posted it: +1 reputation', x: therapist.x, y: therapist.y, kind: 'good' },
      { type: 'float', text: 'Posted it: +1 reputation', x: therapist.x, y: therapist.y, kind: 'good' },
    ]);
    expect(quirkNotes(therapist, [], undefined)).toEqual(['Posted about 2 heals: +2 reputation']);
  });

  it('Healing Hands saves one failed treatment in three, and nobody else rolls the dice', () => {
    const ctx = { s: { rng: 99 } } as unknown as SimContext;
    const plain = { traits: ['brisk'] } as never;
    expect(Array.from({ length: 100 }, () => worksAnyway(ctx, plain)).some(Boolean)).toBe(false);
    expect(ctx.s.rng).toBe(99);
    const hands = { traits: ['hands'] } as never;
    const saved = Array.from({ length: 20000 }, () => worksAnyway(ctx, hands)).filter(Boolean).length;
    expect(traitMost(['hands'], 'rescue')).toBeCloseTo(1 / 3);
    expect(saved / 20000).toBeCloseTo(1 / 3, 1.5);
  });

  it('Healing Hands show each treatment they save: a floater over the table, and a count of them', () => {
    const { sim, therapist } = openCenter(1);
    // untrained, so most treatments fail and the hands have plenty to save
    Object.assign(therapist, { traits: ['hands'], quals: [] });
    sim.drain();
    runUntil(sim, () => (therapist.rescued ?? 0) >= 2, 3600);
    const saved = sim.drain().filter((e) => e.type === 'float' && e.text === 'Healing Hands!');
    expect(saved).toHaveLength(therapist.rescued!);
    expect(saved.every((e) => e.type === 'float' && e.kind === 'good')).toBe(true);
    expect(quirkNotes(therapist, [], undefined)).toEqual([`Healing Hands saved ${therapist.rescued!} treatments`]);
    expect(quirkNotes({ ...therapist, rescued: 1 }, [], undefined)).toEqual(['Healing Hands saved 1 treatment']);
    // and nobody without them ever shows it
    expect(quirkNotes({ ...therapist, rescued: 0 }, [], undefined)).toEqual([]);
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

  it('Holds Space says what it reaches: colleagues at a desk, table or mat, while the holder is at their own', () => {
    const desc = traitOf('space').desc;
    for (const words of ['desk, table or mat', 'While at their post', 'through walls']) expect(desc).toContain(words);
    expect(desc).not.toContain('working nearby');
  });

  it("Holds Space says whom it speeds up, in the holder's inspector and in each colleague's", () => {
    const { sim, therapist, consultant, receptionist } = openCenter(1);
    const ctx = ctxOf(sim);
    for (const st of [therapist, consultant, receptionist]) st.traits = [];
    consultant.traits = ['space'];
    consultant.name = 'Priya Shah';
    Object.assign(therapist, { state: 'atPost', x: 12.5, y: 6.5 });
    Object.assign(consultant, { state: 'atPost', x: 10.5, y: 6.5 });
    Object.assign(receptionist, { state: 'atPost', x: 30, y: 30 });
    expect(spaceHolder(ctx, therapist)).toBe(consultant);
    expect(spaceHolder(ctx, receptionist)).toBeUndefined();
    expect(spaceHolder(ctx, consultant)).toBeUndefined();
    expect(holdingSpaceFor(ctx, consultant)).toEqual([therapist]);
    // nobody without the quirk holds space for anyone
    expect(holdingSpaceFor(ctx, therapist)).toEqual([]);
    expect(quirkNotes(consultant, holdingSpaceFor(ctx, consultant), spaceHolder(ctx, consultant))).toEqual([
      'Holding space for 1 colleague',
    ]);
    expect(quirkNotes(therapist, holdingSpaceFor(ctx, therapist), spaceHolder(ctx, therapist))).toEqual([
      'Working 15% faster: Priya holds space',
    ]);
    // the receptionist comes within reach too
    Object.assign(receptionist, { x: 11.5, y: 8.5 });
    expect(quirkNotes(consultant, holdingSpaceFor(ctx, consultant), undefined)).toEqual([
      'Holding space for 2 colleagues',
    ]);
    // and once the holder leaves their post, nobody is sped up and nothing is said
    consultant.state = 'toPost';
    expect(holdingSpaceFor(ctx, consultant)).toEqual([]);
    expect(spaceHolder(ctx, therapist)).toBeUndefined();
    expect(sim.heldSpace(therapist)).toBe(1);
    consultant.state = 'atPost';
    expect(sim.heldSpace(therapist)).toBeCloseTo(1.15);
  });
});

describe('the quirks in words', () => {
  it('put the rare one first, as the chips do', () => {
    expect(rareFirst(['brisk', 'hands', 'quick'])).toEqual(['hands', 'brisk', 'quick']);
  });

  it("give a Staff row's label every quirk and what it does, for those who cannot point at a chip", () => {
    expect(quirksSaid(['brisk', 'hands'])).toBe(
      `Quirks: Healing Hands, rare: ${traitOf('hands').desc} Brisk: ${traitOf('brisk').desc}`,
    );
    expect(quirksSaid([])).toBe('');
  });
});
