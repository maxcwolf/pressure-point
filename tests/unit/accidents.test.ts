// Accidents, chosen on 1 November 2026: a waiting guest bursting with no restroom to use, or every toilet taken, holds
// on a while and then has an accident, a poop or a puddle of pee where they stand; the guest is mortified, everyone
// near thinks less of the place, and a Caretaker cleans it up ahead of litter.
import { beforeEach, describe, expect, it } from 'vitest';

import {
  ACCIDENT_PATIENCE,
  DAY_SECONDS,
  FLIES_AFTER,
  HOLD_NO_RESTROOM,
  HOLD_TOILETS_TAKEN,
  HOLD_WARN_TAKEN,
  MESS_PRESTIGE,
} from '../../src/core/data';
import { setSeed } from '../../src/core/random';
import {
  ACCIDENT_NEWS,
  accidentDue,
  accidentsAllowed,
  fliesOn,
  haveAccident,
  holdOn,
  toiletTrouble,
  wentHomeMortified,
} from '../../src/core/sim/accidents';
import { prestigeTerms } from '../../src/core/sim/ambience';
import { setDuty } from '../../src/core/sim/careers';
import type { SimContext } from '../../src/core/sim/context';
import { spawnGuest } from '../../src/core/sim/guests';
import { HARM_EXPLAIN } from '../../src/core/sim/harms';
import { inPuddle } from '../../src/core/sim/novelties';
import { primerTip } from '../../src/core/sim/primer';
import type { Sim } from '../../src/core/sim/sim';
import { SAVE_VERSION } from '../../src/core/state/game';
import type { GameState, Guest, Litter } from '../../src/core/state/types';
import { upgradeSave } from '../../src/core/state/upgrade';
import { must } from '../../src/core/util';
import { burstingNote, guestStatus, staffStatus } from '../../src/ui/lib/status';
import { addRestroom, freshSim, hire, inconsistencies, openCenter, run, runUntil, toasts } from './helpers';

beforeEach(() => setSeed(3));

/** The sim's context, for the rule's own functions. */
const ctxOf = (sim: Sim) => (sim as unknown as { ctx: SimContext }).ctx;

/** A guest in line at a Reception Desk nobody works, so they wait there, fully patient and bursting. */
function burstingInLine(sim: Sim): Guest {
  sim.s.money = 100_000;
  if (!sim.s.items.some((i) => i.type === 'reception_desk')) sim.placeItem('reception_desk', 14, 13, 0);
  const g = must(spawnGuest(ctxOf(sim)), 'a guest');
  runUntil(sim, () => g.state === 'waiting', 120);
  g.patience = 100;
  g.bladder = 100;
  return g;
}

/** The accidents on the floor. */
const accidents = (sim: Sim) => sim.s.litter.filter((l) => l.accident);

/** The one Toilet Stall. */
const toiletOf = (sim: Sim) =>
  must(
    sim.s.items.find((i) => i.type === 'toilet'),
    'a toilet',
  );

/** The one Toilet Stall, taken by someone else. */
function takeToilet(sim: Sim, by: Guest) {
  toiletOf(sim).users[0] = by.id;
}

describe('a guest bursting with no restroom to use', () => {
  it(`holds on for ${HOLD_NO_RESTROOM} seconds, then has an accident where they stand`, () => {
    const sim = freshSim();
    const g = burstingInLine(sim);
    run(sim, HOLD_NO_RESTROOM - 2);
    expect(accidents(sim)).toEqual([]);
    expect(g.held).toBeGreaterThan(HOLD_NO_RESTROOM - 3);
    // warned meanwhile by a restroom bubble over them, and the inspector saying why
    expect(g.bubble).toBe('bubble-restroom');
    expect(guestStatus(g, sim)).toBe('In line at Reception, bursting: there is no Restroom to use');
    run(sim, 3);
    const [mess] = accidents(sim);
    expect(mess).toMatchObject({ x: g.tx, y: g.ty, claimedBy: 0 });
    expect(['poop', 'pee']).toContain(mess?.accident);
    expect(g.bladder).toBeLessThan(1);
    expect(g.held).toBeUndefined();
    expect(g.feelings).toContain('accident');
    expect(sim.s.stats.accidents).toBe(1);
    expect(sim.s.tally.accidents).toBe(1);
    expect(inconsistencies(sim)).toEqual([]);
  });

  it('is mortified: their patience badly hurt, and half the time, or with none left, they go home', () => {
    const sim = freshSim();
    const g = burstingInLine(sim);
    g.patience = ACCIDENT_PATIENCE - 1;
    const rep = sim.s.reputation;
    haveAccident(ctxOf(sim), g);
    expect(g.state).toBe('leaving');
    expect(wentHomeMortified(g)).toBe(true);
    expect(sim.s.stats.stormed).toBe(1);
    expect(sim.s.reputation).toBeLessThan(rep);
    expect(guestStatus(g, sim)).toBe('Going home mortified after an accident');
    // over many, about half go home
    let home = 0;
    for (let i = 0; i < 40; i++) {
      const other = must(spawnGuest(ctxOf(sim)), 'a guest');
      other.patience = 100;
      haveAccident(ctxOf(sim), other);
      expect(other.patience).toBe(100 - ACCIDENT_PATIENCE);
      if (other.state === 'leaving') home++;
    }
    expect(home).toBeGreaterThan(10);
    expect(home).toBeLessThan(30);
  });

  it('says so over the speakers and in a message the first time only, and explains it once it keeps happening', () => {
    const sim = freshSim();
    const ctx = ctxOf(sim);
    sim.drain();
    for (let i = 0; i < HARM_EXPLAIN; i++) haveAccident(ctx, must(spawnGuest(ctx), 'a guest'));
    const events = sim.drain();
    expect(events.filter((e) => e.type === 'announce' && e.text === ACCIDENT_NEWS)).toHaveLength(1);
    const said = toasts(events).filter((t) => t.includes('had an accident on the floor'));
    expect(said).toEqual([expect.stringMatching(/Build a Restroom.*Hire a Caretaker/)]);
    expect(sim.s.harmNotes).toContainEqual(
      expect.objectContaining({
        key: 'accident:none',
        title: `${HARM_EXPLAIN} guests had accidents with no Restroom to use`,
        causes: expect.arrayContaining([{ label: 'No Restroom built' }]),
        fix: { menu: 'rooms' },
      }),
    );
  });

  it('never holds on, or has one, with accidents switched off, nor as a class-goer', () => {
    const sim = freshSim();
    const ctx = ctxOf(sim);
    const g = burstingInLine(sim);
    sim.s.accidentsOn = false;
    run(sim, HOLD_TOILETS_TAKEN);
    expect(g.held).toBeUndefined();
    expect(accidents(sim)).toEqual([]);
    expect(sim.holdingOn()).toEqual([]);
    sim.s.accidentsOn = true;
    g.classDay = 1;
    holdOn(ctx, g, HOLD_TOILETS_TAKEN, true);
    expect(g.held).toBeUndefined();
    g.classDay = 0;
    holdOn(ctx, g, HOLD_TOILETS_TAKEN, true);
    expect(accidentDue(ctx, g)).toBe(true);
  });

  it('never has one on a first go at the campaign before its heads-up has asked for a Restroom', () => {
    const sim = freshSim();
    sim.s.primer = true;
    expect(accidentsAllowed(ctxOf(sim))).toBe(false);
    const g = burstingInLine(sim);
    run(sim, HOLD_TOILETS_TAKEN);
    expect(accidents(sim)).toEqual([]);
    // nor are they holding on all that while, to have one the moment they can
    expect(g.held).toBeUndefined();
    // the heads-up comes once the center is open and a guest starts to need the toilet, and accidents can happen after
    sim.s.open = true;
    g.patience = 100;
    run(sim, 2);
    expect(sim.s.seenTips).toContain(primerTip('restroom'));
    expect(accidentsAllowed(ctxOf(sim))).toBe(true);
    expect(accidents(sim)).toEqual([]);
    run(sim, HOLD_NO_RESTROOM);
    expect(accidents(sim)).toHaveLength(1);
  });

  it('can have one on a first go at the campaign once a Restroom is built, though its heads-up never came', () => {
    const sim = freshSim();
    sim.s.primer = true;
    sim.s.money = 100_000;
    addRestroom(sim);
    takeToilet(sim, must(spawnGuest(ctxOf(sim)), 'a guest'));
    const g = burstingInLine(sim);
    expect(sim.s.seenTips).not.toContain(primerTip('restroom'));
    expect(accidentsAllowed(ctxOf(sim))).toBe(true);
    run(sim, HOLD_TOILETS_TAKEN + 1);
    expect(g.feelings).toContain('accident');
  });

  it('is warned of by the advisor at once, by name, with the seconds left', () => {
    const { sim } = openCenter();
    const g = burstingInLine(sim);
    g.held = 5;
    expect(sim.adviceNote()).toMatchObject({
      level: 'alarm',
      text: `${g.name} is bursting with no Restroom to use: an accident on the floor in about ${HOLD_NO_RESTROOM - 5} seconds. Build a Restroom, with a toilet and a sink.`,
      about: { kind: 'guest', id: g.id },
    });
  });

  it('is never warned of as an accident to come with accidents switched off', () => {
    const { sim } = openCenter();
    const g = burstingInLine(sim);
    g.bladder = 90;
    expect(sim.adviceNote().text).toBe(
      'Guests are crossing their legs. Build a Restroom before someone has an accident.',
    );
    sim.s.accidentsOn = false;
    expect(sim.adviceNote().text).toBe('Guests are crossing their legs. A Restroom would be a kindness.');
  });

  it('lands on open floor beside them, never through a wall into a room', () => {
    const { sim } = openCenter();
    const ctx = ctxOf(sim);
    const g = must(spawnGuest(ctx), 'a guest');
    // in the corridor along the Massage Suite's west wall, with litter where they stand
    Object.assign(g, { tx: 10, ty: 6 });
    sim.s.litter.push({ id: sim.s.nextId++, x: 10, y: 6, claimedBy: 0 });
    expect(sim.world.roomAt(11, 6)?.type).toBe('massage');
    haveAccident(ctx, g);
    expect(accidents(sim)).toEqual([expect.objectContaining({ x: 9, y: 6 })]);
  });
});

describe('a guest bursting with the only toilet out of action', () => {
  it(`holds on for ${HOLD_NO_RESTROOM} seconds, and everything that warns of it says what is wrong`, () => {
    const sim = freshSim();
    sim.s.money = 100_000;
    addRestroom(sim);
    toiletOf(sim).wear = 100;
    const g = burstingInLine(sim);
    expect(toiletTrouble(ctxOf(sim))).toBe('out');
    run(sim, 3);
    expect(guestStatus(g, sim)).toBe('In line at Reception, bursting: the toilet is broken');
    expect(sim.holdingOn().map((h) => h.guest)).toEqual([g]);
    expect(burstingNote(sim, 1)).toBe('The toilet is broken, and 1 guest is bursting. Hire a Caretaker to repair it.');
    sim.drain();
    run(sim, HOLD_NO_RESTROOM);
    expect(accidents(sim)).toHaveLength(1);
    expect(toasts(sim.drain())).toContainEqual(
      expect.stringMatching(
        /as the toilet is broken, and had an accident on the floor. Hire a Caretaker to repair it./,
      ),
    );
  });

  it('is warned of by the advisor by name, with what puts it right', () => {
    const { sim } = openCenter();
    addRestroom(sim);
    toiletOf(sim).wear = 100;
    const g = burstingInLine(sim);
    g.held = 5;
    expect(sim.adviceNote()).toMatchObject({
      level: 'alarm',
      text: `${g.name} is bursting, and the toilet is broken: an accident on the floor in about ${HOLD_NO_RESTROOM - 5} seconds. Hire a Caretaker to repair it.`,
    });
  });

  it('is explained by what had the toilets out of action, flooded or broken, and who puts it right', () => {
    const sim = freshSim();
    const ctx = ctxOf(sim);
    sim.s.money = 100_000;
    const room = addRestroom(sim);
    sim.s.litter.push({ id: sim.s.nextId++, x: room.x, y: room.y, claimedBy: 0, flood: room.id });
    expect(sim.toiletsOut().why).toBe('the Restroom is flooded');
    for (let i = 0; i < HARM_EXPLAIN; i++) haveAccident(ctx, must(spawnGuest(ctx), 'a guest'));
    expect(sim.s.harmNotes).toContainEqual(
      expect.objectContaining({
        key: 'accident:out',
        title: `${HARM_EXPLAIN} guests had accidents with no toilet working`,
        causes: expect.arrayContaining([{ label: 'The Restroom is flooded' }]),
        help: expect.stringMatching(/^Hire a Caretaker to mop it out./),
        fix: { hire: 'caretaker' },
      }),
    );
  });
});

describe('a guest bursting with every toilet taken', () => {
  it(`holds on for ${HOLD_TOILETS_TAKEN} seconds rather than ${HOLD_NO_RESTROOM}`, () => {
    const sim = freshSim();
    addRestroom(sim);
    const g = burstingInLine(sim);
    const other = must(spawnGuest(ctxOf(sim)), 'a guest');
    takeToilet(sim, other);
    expect(toiletTrouble(ctxOf(sim))).toBe('taken');
    g.held = HOLD_NO_RESTROOM + 1;
    expect(accidentDue(ctxOf(sim), g)).toBe(false);
    g.held = HOLD_TOILETS_TAKEN;
    expect(accidentDue(ctxOf(sim), g)).toBe(true);
    expect(guestStatus(g, sim)).toBe('In line at Reception, bursting: every toilet is taken');
  });

  it(`is warned of by the advisor and the Restroom once they have held on ${HOLD_WARN_TAKEN} seconds`, () => {
    const { sim } = openCenter();
    addRestroom(sim);
    const g = burstingInLine(sim);
    takeToilet(sim, must(spawnGuest(ctxOf(sim)), 'a guest'));
    // a toilet often comes free before then
    g.held = HOLD_WARN_TAKEN - 1;
    expect(sim.adviceNote().about).not.toEqual({ kind: 'guest', id: g.id });
    expect(sim.holdingOn()).toEqual([]);
    g.held = HOLD_WARN_TAKEN + 1;
    expect(sim.adviceNote()).toMatchObject({
      level: 'alarm',
      text: `${g.name} is bursting, and every toilet is taken: an accident on the floor in about ${HOLD_TOILETS_TAKEN - HOLD_WARN_TAKEN - 1} seconds. Build another Restroom, or put more toilets in the one you have.`,
      about: { kind: 'guest', id: g.id },
    });
    expect(burstingNote(sim, sim.holdingOn().length)).toBe(
      'Every toilet is taken, and 1 guest is bursting. Build another Restroom, or put more toilets in this one, before someone has an accident.',
    );
  });

  it('goes to a free toilet instead, and has no accident', () => {
    const sim = freshSim();
    addRestroom(sim);
    const g = burstingInLine(sim);
    run(sim, 2);
    expect(g.state === 'toNeed' || g.state === 'need').toBe(true);
    expect(g.held).toBeUndefined();
    run(sim, HOLD_TOILETS_TAKEN);
    expect(accidents(sim)).toEqual([]);
  });
});

describe('an accident on the floor', () => {
  /** An accident of a kind on a tile, left this many seconds ago. */
  const mess = (sim: Sim, kind: 'poop' | 'pee', x: number, y: number, ago = 0): Litter => {
    const l: Litter = {
      id: sim.s.nextId++,
      x,
      y,
      claimedBy: 0,
      accident: kind,
      at: sim.s.day - ago / DAY_SECONDS,
    };
    sim.s.litter.push(l);
    return l;
  };

  it('is cleaned up by a Caretaker ahead of litter nearer them', () => {
    const { sim } = openCenter();
    const caretaker = hire(sim, 'caretaker');
    run(sim, 1);
    sim.s.litter.push({ id: sim.s.nextId++, x: caretaker.tx + 1, y: caretaker.ty, claimedBy: 0 });
    const poop = mess(sim, 'poop', 6, 12);
    runUntil(sim, () => caretaker.job !== null, 30);
    expect(caretaker.job).toEqual({ kind: 'litter', id: poop.id });
    expect(staffStatus(caretaker, sim)).toMatch(/Cleaning up after an accident/);
    runUntil(sim, () => !sim.s.litter.includes(poop), 120);
  });

  it('says in its message when no Caretaker clears litter where it is', () => {
    const { sim } = openCenter();
    const caretaker = hire(sim, 'caretaker');
    setDuty(ctxOf(sim), caretaker.id, 'litter', false);
    sim.drain();
    haveAccident(ctxOf(sim), burstingInLine(sim));
    expect(toasts(sim.drain())).toContainEqual(expect.stringMatching(/None of your Caretakers clears litter there/));
  });

  it('slows walkers when it is a puddle, and puts off waiting guests who can see it, more than litter', () => {
    const sim = freshSim();
    const ctx = ctxOf(sim);
    const pee = mess(sim, 'pee', 10, 10);
    mess(sim, 'poop', 12, 10);
    expect(inPuddle(ctx, 10, 10)).toBe(true);
    expect(inPuddle(ctx, 12, 10)).toBe(false);
    const g = burstingInLine(sim);
    g.bladder = 0;
    sim.s.litter = [{ ...pee, x: g.tx + 2, y: g.ty }];
    run(sim, 2);
    expect(g.feelings).toContain('mess');
    expect(g.feelings).not.toContain('litter');
  });

  it('takes twice what litter does off its room’s prestige', () => {
    const sim = freshSim();
    const room = addRestroom(sim);
    const clean = prestigeTerms(ctxOf(sim), room).litter;
    mess(sim, 'pee', room.x, room.y);
    expect(prestigeTerms(ctxOf(sim), room).litter).toBe(clean + MESS_PRESTIGE);
  });

  it(`draws flies once a poop has been left ${FLIES_AFTER} seconds, never a puddle`, () => {
    const sim = freshSim();
    expect(fliesOn(sim.s, mess(sim, 'poop', 5, 12, FLIES_AFTER - 1))).toBe(false);
    expect(fliesOn(sim.s, mess(sim, 'poop', 6, 12, FLIES_AFTER + 1))).toBe(true);
    expect(fliesOn(sim.s, mess(sim, 'pee', 7, 12, FLIES_AFTER * 10))).toBe(false);
  });
});

describe('a save from before accidents', () => {
  it('has them on, and none counted yet', () => {
    const { s } = openCenter();
    const old = JSON.parse(JSON.stringify(s)) as Record<string, any>;
    Reflect.deleteProperty(old, 'accidentsOn');
    Reflect.deleteProperty(old.stats, 'accidents');
    Reflect.deleteProperty(old.tally, 'accidents');
    old.version = 47;
    upgradeSave(old as GameState);
    const up = old as GameState;
    expect(up.accidentsOn).toBe(true);
    expect(up.stats.accidents).toBe(0);
    expect(up.tally.accidents).toBe(0);
    expect(up.version).toBe(SAVE_VERSION);
  });
});
