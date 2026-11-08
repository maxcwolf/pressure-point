// Perks: the choice owed at the promotions to Senior and Expert, choosing, Promote all, choosing for themselves, hires
// settling in, applicants who bring one, older saves, and what each kind of perk does to the numbers.
import { describe, expect, it } from 'vitest';

import {
  BROUGHT_PERK_CHANCE,
  broughtPerk,
  CONDITIONS,
  PERK_WAIT_DAYS,
  type PerkId,
  perkPair,
  PERKS,
  RAISE_STEP,
  RANK_XP,
  ROLE_ORDER,
  SENIOR_PERKS,
  STRUCTURAL_SURE,
} from '../../src/core/data';
import { makeCandidate } from '../../src/core/people';
import { gainXp, mentored, promote, promoteAll, serviceSeconds, setDuty } from '../../src/core/sim/careers';
import { instructorPlaces } from '../../src/core/sim/classes';
import { createContext } from '../../src/core/sim/context';
import { drainEvents } from '../../src/core/sim/events';
import { ASKED_FOR_PULL, stationScore } from '../../src/core/sim/lines';
import {
  choosePerk,
  consultPace,
  guessesSure,
  lapsePerks,
  ownChoice,
  perkProduct,
  perkSuccess,
  settlingFor,
  structuralSure,
} from '../../src/core/sim/perks';
import { needsRest } from '../../src/core/sim/recovery';
import { afterVisit, askedFor, askingFor, knowsHistory, takesToPlace } from '../../src/core/sim/regulars';
import { healerMats } from '../../src/core/sim/sessions';
import { raiseTo } from '../../src/core/sim/staffing';
import { doorTip, guestFee } from '../../src/core/sim/stations';
import { addWear } from '../../src/core/sim/upkeep';
import type { GameState, Guest, Staff } from '../../src/core/state/types';
import { upgradeSave } from '../../src/core/state/upgrade';
import { must } from '../../src/core/util';
import { applicantPerkNote, askedForNote, chosenHereNote, perkRequests, settlingNote } from '../../src/ui/lib/perks';
import { hire, openCenter } from './helpers';

/** A structural condition, which a consultation can only make so sure. */
const structuralCondition = must(
  CONDITIONS.find((c) => c.structural),
  'a structural condition',
).id;

/** Someone with no perks and nothing owed, at a rank, ready for promotion. */
function ready(st: Staff, skill: number) {
  st.skill = skill;
  st.xp = RANK_XP[skill]!;
  st.perks = [];
  st.perkDue = [];
  st.settling = [];
  st.promotion = true;
  return st;
}

describe('the choice at a promotion', () => {
  it('comes at Senior and at Expert, on a card of its own, and not at the ranks below', () => {
    const { s, therapist } = openCenter(1);
    const ctx = createContext(s);
    ready(therapist, 2);
    promote(ctx, therapist.id);
    expect(therapist.perkDue).toEqual([]);
    ready(therapist, 3);
    drainEvents(ctx);
    promote(ctx, therapist.id);
    expect(therapist.perkDue).toEqual([{ tier: 'senior', since: s.day }]);
    expect(drainEvents(ctx)).toContainEqual(
      expect.objectContaining({
        request: 'perk',
        text: `${therapist.name} is now Senior. How do they work: Firm Hand or Light Touch?`,
      }),
    );
    expect(perkRequests(s.staff)).toEqual([therapist]);
    therapist.promotion = true;
    therapist.xp = RANK_XP[4]!;
    promote(ctx, therapist.id);
    expect(therapist.perkDue.map((d) => d.tier)).toEqual(['senior', 'expert']);
  });

  it('is one of the two its role is offered, and settles that promotion', () => {
    const { s, therapist } = openCenter(1);
    const ctx = createContext(s);
    ready(therapist, 3);
    promote(ctx, therapist.id);
    // a perk of another role, or another promotion, is not theirs to choose
    expect(choosePerk(ctx, therapist.id, 'triage')).toBe(false);
    expect(choosePerk(ctx, therapist.id, 'mentor')).toBe(false);
    expect(choosePerk(ctx, therapist.id, 'light-touch')).toBe(true);
    expect(therapist.perks).toEqual(['light-touch']);
    expect(therapist.perkDue).toEqual([]);
    expect(perkRequests(s.staff)).toEqual([]);
    // and once chosen, it cannot be chosen again
    expect(choosePerk(ctx, therapist.id, 'firm-hand')).toBe(false);
  });

  it('waits for each promoted by Promote all', () => {
    const { s, therapist, consultant } = openCenter(1);
    const ctx = createContext(s);
    ready(therapist, 3);
    ready(consultant, 3);
    expect(promoteAll(ctx)).toBe(2);
    expect(perkRequests(s.staff)).toEqual(expect.arrayContaining([therapist, consultant]));
  });

  it('is made by the member of staff after 30 days, as their quirks suit, with a message saying so', () => {
    const { s, consultant } = openCenter(1);
    const ctx = createContext(s);
    ready(consultant, 3);
    consultant.traits = ['brisk'];
    promote(ctx, consultant.id);
    s.day += PERK_WAIT_DAYS - 1;
    lapsePerks(ctx);
    expect(consultant.perks).toEqual([]);
    s.day += 1;
    drainEvents(ctx);
    lapsePerks(ctx);
    expect(consultant.perks).toEqual(['triage']);
    expect(drainEvents(ctx)).toContainEqual(
      expect.objectContaining({ text: expect.stringContaining('got tired of waiting and chose Triage') }),
    );
  });

  it('chosen by themselves, goes the way their quirks and courses lean, or with a tie, the way their id falls', () => {
    const base = { role: 'consultant' as const, traits: [], general: [] };
    expect(ownChoice({ ...base, id: 1, traits: ['tireless'] }, 'senior')).toBe('diagnostician');
    expect(ownChoice({ ...base, id: 1, general: ['bedside'] }, 'senior')).toBe('diagnostician');
    expect(ownChoice({ ...base, id: 2, traits: ['speedy'] }, 'senior')).toBe('triage');
    expect(ownChoice({ ...base, id: 2 }, 'senior')).toBe('diagnostician');
    expect(ownChoice({ ...base, id: 3 }, 'senior')).toBe('triage');
    expect(ownChoice({ ...base, id: 4, traits: ['influencer'] }, 'expert')).toBe('their-history');
  });

  it('is offered to every role at Senior, and at Expert weighs Mentor against a perk for the work they do', () => {
    for (const role of ROLE_ORDER) {
      const [a, b] = SENIOR_PERKS[role];
      expect(PERKS[a].tier).toBe('senior');
      expect(PERKS[b].tier).toBe('senior');
    }
    expect(perkPair('caretaker', 'expert')).toEqual(['mentor', 'every-pipe']);
    for (const role of ['therapist', 'acupuncturist', 'practitioner', 'healer', 'shaman'] as const)
      expect(perkPair(role, 'expert')).toEqual(['mentor', 'name-on-door']);
    // nobody who heals nobody is offered Name on the Door
    expect(perkPair('receptionist', 'expert')).toEqual(['mentor', 'every-face']);
    expect(perkPair('consultant', 'expert')).toEqual(['mentor', 'their-history']);
    expect(perkPair('instructor', 'expert')).toEqual(['mentor', 'waiting-list']);
    for (const role of ROLE_ORDER) expect(PERKS[perkPair(role, 'expert')[1]].tier).toBe('expert');
  });
});

describe('hires above Experienced', () => {
  it('earn the choices their rank owes them by settling in: 35 experience for Senior, 80 in all for Expert', () => {
    expect(settlingFor(3, RANK_XP[2]!)).toEqual([]);
    expect(settlingFor(4, 80)).toEqual([{ tier: 'senior', at: 115 }]);
    expect(settlingFor(5, 125)).toEqual([
      { tier: 'senior', at: 160 },
      { tier: 'expert', at: 205 },
    ]);
    // a perk brought from their last job is one choice fewer
    expect(settlingFor(5, 125, 'mentor')).toEqual([{ tier: 'senior', at: 160 }]);
  });

  it('wait on a card once they have, saying they have settled in', () => {
    const { sim, s } = openCenter(1);
    const ctx = createContext(s);
    const c = makeCandidate(s, 'consultant');
    c.skill = 5;
    delete c.perk;
    s.candidates.push(c);
    const st = sim.hire(c.id)!;
    expect(st.settling.map((x) => x.tier)).toEqual(['senior', 'expert']);
    expect(settlingNote(st)?.text).toBe('Settling in: 35 more experience to choose a Senior perk');
    gainXp(ctx, st, 34);
    expect(st.perkDue).toEqual([]);
    drainEvents(ctx);
    gainXp(ctx, st, 1);
    expect(st.perkDue).toEqual([{ tier: 'senior', since: s.day, settled: true }]);
    expect(drainEvents(ctx)).toContainEqual(
      expect.objectContaining({ request: 'perk', text: expect.stringContaining('has settled in') }),
    );
    gainXp(ctx, st, 45);
    expect(st.perkDue.map((d) => d.tier)).toEqual(['senior', 'expert']);
    expect(st.settling).toEqual([]);
  });

  it('say on their card what they will be owed', () => {
    expect(applicantPerkNote({ skill: 3 })).toBe('');
    expect(applicantPerkNote({ skill: 4 })).toBe('Will choose a Senior perk once settled in (35 experience).');
    expect(applicantPerkNote({ skill: 5 })).toBe(
      'Will choose a Senior perk once settled in (35 experience), and an Expert one 45 after that.',
    );
  });
});

describe('a perk brought from a last job', () => {
  it('comes with about one Senior or Expert applicant in ten, and with nobody below', () => {
    const ids = [...Array(5000).keys()];
    expect(ids.filter((id) => broughtPerk(id, 'therapist', 3)).length).toBe(0);
    const brought = ids.filter((id) => broughtPerk(id, 'therapist', 4)).length / ids.length;
    expect(brought).toBeGreaterThan(BROUGHT_PERK_CHANCE * 0.8);
    expect(brought).toBeLessThan(BROUGHT_PERK_CHANCE * 1.2);
    // a Senior brings a Senior perk of their own role
    for (const id of ids) {
      const p = broughtPerk(id, 'therapist', 4);
      if (p) expect(SENIOR_PERKS.therapist).toContain(p);
    }
  });

  it('is hired with them, marked as brought, and not counted as chosen here when they go', () => {
    const { sim, s } = openCenter(1);
    const c = makeCandidate(s, 'healer');
    c.skill = 4;
    c.perk = 'hushed';
    s.candidates.push(c);
    const st = sim.hire(c.id)!;
    expect(st.perks).toEqual(['hushed']);
    expect(st.brought).toBe('hushed');
    expect(st.settling).toEqual([]);
    expect(chosenHereNote(st)).toBe('');
    st.perks.push('mentor');
    expect(chosenHereNote(st)).toBe(`${st.name}’s Mentor was chosen here. The next one will have their own ideas.`);
  });
});

describe('an older save', () => {
  it('gives every Senior and Expert already working the choices their rank owes them, at once', () => {
    const { s, therapist, consultant } = openCenter(1);
    therapist.skill = 5;
    consultant.skill = 2;
    const old = JSON.parse(JSON.stringify(s)) as Record<string, any>;
    old.version = 49;
    for (const st of old.staff) for (const k of ['perks', 'perkDue', 'settling']) Reflect.deleteProperty(st, k);
    upgradeSave(old as GameState);
    const up = old as GameState;
    expect(up.staff.find((st) => st.id === therapist.id)?.perkDue.map((d) => d.tier)).toEqual(['senior', 'expert']);
    expect(up.staff.find((st) => st.id === consultant.id)?.perkDue).toEqual([]);
    expect(up.staff.every((st) => Array.isArray(st.perks) && Array.isArray(st.settling))).toBe(true);
  });
});

describe('a save from 0.36.2', () => {
  it('gives a Receptionist, Consultant or Instructor with Name on the Door their own perk, and keeps a healer’s', () => {
    const { s, therapist, consultant, receptionist } = openCenter(1);
    therapist.perks = ['light-touch', 'name-on-door'];
    receptionist.perks = ['charmer', 'name-on-door'];
    consultant.perks = ['name-on-door'];
    s.candidates.push({ ...makeCandidate(s, 'instructor'), perk: 'name-on-door' });
    const old = JSON.parse(JSON.stringify(s)) as GameState;
    old.version = 50;
    upgradeSave(old);
    /** The perks of the member of staff with this id, after the upgrade. */
    const perksOf = (id: number) => old.staff.find((st) => st.id === id)?.perks;
    expect(perksOf(therapist.id)).toEqual(['light-touch', 'name-on-door']);
    expect(perksOf(receptionist.id)).toEqual(['charmer', 'every-face']);
    expect(perksOf(consultant.id)).toEqual(['their-history']);
    expect(old.candidates.at(-1)?.perk).toBe('waiting-list');
  });
});

describe('what perks do', () => {
  it('change how fast a service is given', () => {
    const { receptionist } = openCenter(1);
    receptionist.perks = [];
    const usual = serviceSeconds(3.5, receptionist);
    receptionist.perks = ['charmer'];
    expect(serviceSeconds(3.5, receptionist)).toBeCloseTo(usual / 0.93);
  });

  it('speed a Consultant up on one kind of condition and slow them on the other', () => {
    const st = { perks: ['triage'] as PerkId[] };
    expect(consultPace(st, 'slump')).toBeCloseTo(1.3);
    expect(consultPace(st, structuralCondition)).toBeCloseTo(1 / 1.2);
    st.perks = ['diagnostician'];
    expect(consultPace(st, 'slump')).toBeCloseTo(1 / 1.1);
    expect(consultPace(st, structuralCondition)).toBe(1);
    expect(structuralSure(st, STRUCTURAL_SURE)).toBe(0.8);
    expect(guessesSure(st)).toBe(true);
    expect(structuralSure({ perks: [] }, STRUCTURAL_SURE)).toBe(STRUCTURAL_SURE);
  });

  it('favor their own techniques, at a small cost to the rest of the discipline, and never a machine', () => {
    const { therapist } = openCenter(1);
    therapist.perks = ['light-touch'];
    expect(perkSuccess(therapist, 'swedish')).toBeCloseTo(0.08);
    expect(perkSuccess(therapist, 'deep')).toBeCloseTo(-0.03);
    expect(perkSuccess(therapist, 'kneading')).toBe(0);
    therapist.perks = ['firm-hand'];
    expect(perkSuccess(therapist, 'cranio')).toBeCloseTo(0.08);
    expect(perkSuccess(therapist, 'stone')).toBeCloseTo(-0.03);
    // Hushed costs only the technique it names, and does nothing for another discipline's
    expect(perkSuccess({ role: 'healer', perks: ['hushed'] }, 'gong')).toBeCloseTo(-0.03);
    expect(perkSuccess({ role: 'healer', perks: ['hushed'] }, 'crystalbowls')).toBe(0);
    expect(perkSuccess({ role: 'healer', perks: ['hushed'] }, 'swedish')).toBe(0);
  });

  it('decide whether a massage needs a rest after: one in three more for a Firm Hand, none for a Light Touch', () => {
    const { therapist } = openCenter(1);
    // Swedish needs no rest, and Deep Tissue always does
    /** A guest come for a Swedish massage. */
    const swedish = (id: number) => ({ id, condition: 'slump' }) as Guest;
    const deep = { id: 1, condition: 'knotted' } as Guest;
    therapist.perks = [];
    expect(needsRest(swedish(3), therapist)).toBe(false);
    expect(needsRest(deep, therapist)).toBe(true);
    // a Firm Hand's: one in three of those that need none, by the guest, and still every one that does
    therapist.perks = ['firm-hand'];
    const ids = [...Array(30).keys()];
    expect(ids.filter((id) => needsRest(swedish(id), therapist))).toHaveLength(10);
    expect(needsRest(deep, therapist)).toBe(true);
    // a Light Touch's never
    therapist.perks = ['light-touch'];
    expect(needsRest(deep, therapist)).toBe(false);
    expect(needsRest(deep)).toBe(true);
  });

  it('a Mentor speeds the experience of colleagues of a lower rank nearby, and not of a Caretaker', () => {
    const { s, sim, therapist, consultant } = openCenter(1);
    const ctx = createContext(s);
    therapist.skill = 5;
    therapist.perks = ['mentor'];
    consultant.skill = 2;
    Object.assign(therapist, { x: 10, y: 10, state: 'atPost' });
    Object.assign(consultant, { x: 12, y: 10, state: 'atPost' });
    expect(mentored(ctx, consultant)).toBe(1.6);
    const before = consultant.xp;
    consultant.promotion = true;
    gainXp(ctx, consultant, 1);
    expect(consultant.xp - before).toBeCloseTo(1.6);
    // the Mentor themselves, and someone too far off, learn at the usual pace
    expect(mentored(ctx, therapist)).toBe(1);
    consultant.x = 30;
    expect(mentored(ctx, consultant)).toBe(1);
    const caretaker = hire(sim, 'caretaker');
    caretaker.skill = 1;
    Object.assign(caretaker, { x: 11, y: 10 });
    expect(mentored(ctx, caretaker)).toBe(1);
  });

  it('a Name on the Door asks for 15% raises', () => {
    const { therapist } = openCenter(1);
    therapist.salary = 10_000;
    therapist.perks = [];
    expect(raiseTo(therapist)).toBe(Math.round((10_000 * RAISE_STEP) / 10) * 10);
    therapist.perks = ['name-on-door'];
    expect(raiseTo(therapist)).toBe(11_500);
  });

  it('one who Knows Every Pipe is done with litter for good, and what they repair wears more slowly', () => {
    const { s, sim } = openCenter(1);
    const ctx = createContext(s);
    const caretaker = ready(hire(sim, 'caretaker'), 4);
    caretaker.skill = 5;
    caretaker.perkDue = [{ tier: 'expert', since: s.day }];
    expect(choosePerk(ctx, caretaker.id, 'every-pipe')).toBe(true);
    expect(caretaker.off).toContain('litter');
    expect(setDuty(ctx, caretaker.id, 'litter', true)).toBe(false);
    const desk = s.items.find((it) => it.type === 'reception_desk')!;
    desk.wear = 0;
    addWear(ctx, desk, 10);
    const usual = desk.wear;
    desk.wear = 0;
    desk.pipes = true;
    addWear(ctx, desk, 10);
    expect(desk.wear).toBeCloseTo(usual * 0.7);
  });

  it('change mats, Practice Spots and how often class-goers become regulars', () => {
    expect(healerMats({ skill: 4, perks: [] })).toBe(3);
    expect(healerMats({ skill: 4, perks: ['big-gong'] })).toBe(4);
    expect(instructorPlaces({ skill: 4, perks: ['crowd-pleaser'] })).toBe(13);
    expect(instructorPlaces({ skill: 4, perks: ['devotee-maker'] })).toBe(10);
    const ids = [...Array(60).keys()];
    /** How many of them take to the place at these odds. */
    const count = (odds: number) => ids.filter((id) => takesToPlace(id, 5, odds)).length;
    expect(count(1)).toBe(20);
    expect(count(0.75)).toBe(15);
    expect(count(2)).toBe(40);
  });

  it('a regular a Name on the Door heals asks for them by name, and waits a little longer to see them', () => {
    const { s, therapist, receptionist } = openCenter(1);
    const ctx = createContext(s);
    therapist.perks = ['name-on-door'];
    s.regulars.push({ id: 9001, name: 'Ada Twinge', look: therapist.look, visits: 1, loyalty: 50, due: 0 });
    const guest = {
      id: 9001,
      name: 'Ada Twinge',
      regular: 9001,
      condition: 'slump',
      feelings: [],
      x: 0,
      y: 0,
    } as unknown as Guest;
    afterVisit(ctx, { ...guest, treatedBy: therapist.id }, 5, true);
    expect(s.regulars[s.regulars.length - 1]?.asksFor).toBe(therapist.id);
    expect(askingFor(s, therapist)).toBe(1);
    expect(askedFor(ctx, guest)).toBe(therapist.id);
    // a table they work scores as if its line were shorter, for that regular and nobody else
    const table = must(
      s.items.find((it) => it.type === 'massage_table'),
      'a massage table',
    );
    table.staffId = therapist.id;
    therapist.post = table.id;
    const stranger = { ...guest, id: 1 } as Guest;
    delete stranger.regular;
    expect(stationScore(ctx, table, stranger) - stationScore(ctx, table, guest)).toBe(ASKED_FOR_PULL);
    // healed by someone else, they forget; and a perk lost stops the asking
    afterVisit(ctx, { ...guest, treatedBy: receptionist.id }, 5, true);
    expect(askedFor(ctx, guest)).toBeUndefined();
  });

  it('a regular checked in by one who Knows Every Face tips 12% more, wherever they are treated', () => {
    const { s, therapist, receptionist } = openCenter(1);
    const ctx = createContext(s);
    receptionist.perks = ['every-face'];
    therapist.perks = [];
    const guest = { regular: 9001, condition: 'slump', checkedInBy: receptionist.id } as unknown as Guest;
    const fee = guestFee(s, { condition: 'slump' });
    expect(doorTip(ctx, guest, therapist)).toBe(Math.round(fee * 0.12));
    // and with a Name on the Door treating them, both tips
    therapist.perks = ['name-on-door'];
    expect(doorTip(ctx, guest, therapist)).toBe(Math.round(fee * 0.24));
    // nobody new tips, and nobody the Receptionist did not check in
    expect(doorTip(ctx, { condition: 'slump', checkedInBy: receptionist.id }, { ...therapist, perks: [] })).toBe(0);
    expect(doorTip(ctx, { regular: 9001, condition: 'slump' }, { ...therapist, perks: [] })).toBe(0);
    expect(perkProduct(receptionist, 'checkedInRegulars')).toBe(0.5);
  });

  it('a regular consulted by one who Knows Their History asks for them, and is seen faster and made sure', () => {
    const { s, consultant } = openCenter(1);
    const ctx = createContext(s);
    consultant.perks = ['their-history'];
    s.regulars.push({ id: 9002, name: 'Bo Kink', look: consultant.look, visits: 1, loyalty: 50, due: 0 });
    const guest = { id: 9002, name: 'Bo Kink', regular: 9002, condition: 'slump', feelings: [], x: 0, y: 0 };
    const regular = guest as unknown as Guest;
    expect(knowsHistory(ctx, regular, consultant)).toBe(false);
    afterVisit(ctx, { ...regular, consultedBy: consultant.id }, 3, false);
    expect(knowsHistory(ctx, regular, consultant)).toBe(true);
    expect(askingFor(s, consultant)).toBe(1);
    expect(askedForNote(0, true)).toContain('those they consult will');
    expect(perkProduct(consultant, 'history')).toBe(2);
    // their desk scores as if its line were shorter, for that regular and nobody else
    const desk = must(
      s.items.find((it) => it.type === 'consult_desk'),
      'a consultation desk',
    );
    desk.staffId = consultant.id;
    consultant.post = desk.id;
    const stranger = { ...regular, id: 1 } as Guest;
    delete stranger.regular;
    expect(stationScore(ctx, desk, stranger) - stationScore(ctx, desk, regular)).toBe(ASKED_FOR_PULL);
    // without the perk, nobody is known
    consultant.perks = [];
    expect(knowsHistory(ctx, regular, consultant)).toBe(false);
  });
});
