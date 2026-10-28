// Quirks: every applicant has one to three that do not clash, at most one of them a flaw, now and then a rare one too,
// pay follows them, and each rare one works through a hook the simulation already had.

import { describe, expect, it } from 'vitest';

import {
  CLASHES,
  clashes,
  COMMON_TRAITS,
  MISERABLE_MORALE,
  POACH_MORALE,
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
import { moraleFloor } from '../../src/core/sim/staffing';
import { postAboutIt, serviceSeconds, worksAnyway } from '../../src/core/sim/stations';
import type { Candidate, GameState } from '../../src/core/state/types';
import { upgradeSave } from '../../src/core/state/upgrade';
import { quirkNotes, quirksSaid, rareFirst } from '../../src/ui/lib/quirks';
import { freshSim, hire, openCenter, run, runUntil } from './helpers';

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

  it('gives Former Influencer and Healing Hands only to those who treat guests, Holds Space to anyone who takes a post, and Burnout Survivor to anyone', () => {
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
      expect(rare.has('space')).toBe(role !== 'caretaker');
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

  it('a Burnout Survivor never quits and is never poached, as their description says', () => {
    const floor = traitMost(['survivor'], 'floor');
    // quitting starts below miserable, and a rival's offer only goes to someone below the poaching line
    expect(floor).toBeGreaterThan(MISERABLE_MORALE);
    expect(floor).toBeGreaterThanOrEqual(POACH_MORALE);
    expect(traitOf('survivor').desc).toContain(`below ${floor}`);
    expect(traitOf('survivor').desc).toContain('never quit');
    expect(traitOf('survivor').desc).toContain('poach');
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
