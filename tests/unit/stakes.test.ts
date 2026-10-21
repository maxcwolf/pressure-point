// What is at stake on a visit: guests who worsen while they wait, bad vibes left by failed treatments and cleared
// with sage, and stress outbreaks spreading through the waiting area.
import { describe, expect, it } from 'vitest';

import {
  CONDITION_DRAIN,
  CONDITION_PENALTY,
  DAY_SECONDS,
  DAYS_PER_MONTH,
  EMERGENCY_CONDITION,
  OUTBREAK_STARS,
  REP_DAMPING,
  VIBES_FADE,
  VIBES_MORALE,
  VIBES_PENALTY,
  VIBES_PER_FAIL,
  WORSE_AHEAD_DAYS,
  WORSE_REP,
} from '../../src/core/data';
import { advice } from '../../src/core/sim/advisor';
import { createContext } from '../../src/core/sim/context';
import { changeRep, gainDamping, lossDamping } from '../../src/core/sim/economy';
import { reviewStars } from '../../src/core/sim/feelings';
import { spawnGuest } from '../../src/core/sim/guests';
import { endOutbreak, spreadStress } from '../../src/core/sim/outbreaks';
import { moraleTarget, wantsAway } from '../../src/core/sim/staffing';
import { addVibes, canSmudge, fadeVibes, roomToSmudge, vibesPenalty } from '../../src/core/sim/vibes';
import {
  conditionPenalty,
  daysUntilWorse,
  lineAtRisk,
  warnLine,
  worsening,
  worsenRate,
} from '../../src/core/sim/worsening';
import { SAVE_VERSION } from '../../src/core/state/game';
import type { GameState, Guest } from '../../src/core/state/types';
import { upgradeSave } from '../../src/core/state/upgrade';
import { puffAge } from '../../src/render/models/sage';
import { wafting } from '../../src/render/pose';
import { addReiki, addTraining, hire, inconsistencies, openCenter, run, runUntil, toasts } from './helpers';

/** A center with a guest in it, waiting in line. */
function withGuest(seed = 1) {
  const center = openCenter(seed);
  /** Whether a guest is waiting their turn, still untreated. */
  const waiting = (g: Guest) => (g.state === 'waiting' || g.state === 'toWait') && !g.outcome;
  runUntil(center.sim, () => center.s.guests.some(waiting), 300);
  const g = center.s.guests.find(waiting)!;
  return { ...center, g };
}

describe('reputation', () => {
  it('lands a gain in full below the midpoint, damped above it, and not at all at 100', () => {
    const { mid, top, gainAtTop } = REP_DAMPING;
    expect(gainDamping(0)).toBe(1);
    expect(gainDamping(mid)).toBe(1);
    expect(gainDamping((mid + top) / 2)).toBeCloseTo((1 + gainAtTop) / 2);
    expect(gainDamping(top)).toBeCloseTo(gainAtTop);
    expect(gainDamping(100)).toBe(0);
  });

  it('lands a loss in full above the midpoint, damped below it, and not at all at 0', () => {
    const { mid, floor, lossAtFloor } = REP_DAMPING;
    expect(lossDamping(100)).toBe(1);
    expect(lossDamping(mid)).toBe(1);
    expect(lossDamping((mid + floor) / 2)).toBeCloseTo((1 + lossAtFloor) / 2);
    expect(lossDamping(floor)).toBeCloseTo(lossAtFloor);
    expect(lossDamping(0)).toBe(0);
  });

  it('is changed by that much, within 0 and 100', () => {
    const { s } = openCenter(1);
    const ctx = createContext(s);
    s.reputation = 30;
    changeRep(ctx, 10);
    expect(s.reputation).toBe(40);
    changeRep(ctx, -10);
    expect(s.reputation).toBeCloseTo(40 - 10 * lossDamping(40));
    s.reputation = 80;
    changeRep(ctx, 10);
    expect(s.reputation).toBeCloseTo(80 + 10 * gainDamping(80));
    changeRep(ctx, -10);
    expect(s.reputation).toBeCloseTo(80 + 10 * gainDamping(80) - 10);
    s.reputation = 1;
    changeRep(ctx, -10);
    expect(s.reputation).toBeCloseTo(1 - 10 * lossDamping(1));
    expect(s.reputation).toBeGreaterThan(0);
  });

  it('holds a center healing six guests in ten off the floor, and lets one healing five sink to it', () => {
    /** Where reputation settles for a center treating 15 guests a month at a cure rate, a tenth storming out. */
    const settles = (cure: number) => {
      const { s } = openCenter(1);
      const ctx = createContext(s);
      s.reputation = 30;
      for (let m = 0; m < 36; m++)
        for (let i = 0; i < 15; i++) {
          changeRep(ctx, cure * 2.4);
          changeRep(ctx, -(1 - cure) * 2.5);
          changeRep(ctx, -0.1 * 3);
        }
      return s.reputation;
    };
    expect(settles(0.6)).toBeGreaterThan(40);
    expect(settles(0.5)).toBeLessThan(15);
    expect(settles(0.7)).toBeGreaterThan(70);
    expect(settles(0.9)).toBeLessThan(100);
  });
});

describe('a worsening condition', () => {
  it('shows which guests in the line are about to cost reputation, the soonest first', () => {
    const { s, g } = withGuest();
    expect(lineAtRisk(s)).toEqual([]);
    const soon = WORSE_AHEAD_DAYS * DAY_SECONDS * worsenRate(g.condition);
    g.health = soon - 1;
    expect(lineAtRisk(s)).toEqual([g]);
    expect(daysUntilWorse(g)).toBeLessThan(WORSE_AHEAD_DAYS);
    // a guest sooner to run out comes first, and one further off is not in it
    const sooner = { ...structuredClone(g), id: s.nextId++, health: soon / 2 };
    const later = { ...structuredClone(g), id: s.nextId++, health: soon * 3 };
    s.guests.push(later, sooner);
    expect(lineAtRisk(s).map((x) => x.id)).toEqual([sooner.id, g.id]);
    expect(lineAtRisk(s, WORSE_AHEAD_DAYS * 4).map((x) => x.id)).toEqual([sooner.id, g.id, later.id]);
  });

  it('warns the first time each month the line is about to cost reputation, and the advisor counts them', () => {
    const { s, g } = withGuest();
    const ctx = createContext(s);
    g.health = WORSE_AHEAD_DAYS * DAY_SECONDS * worsenRate(g.condition) - 1;
    warnLine(ctx);
    const said = toasts(ctx.events).join();
    expect(said).toContain(`${g.name} has waited so long`);
    expect(said).toContain(`−${WORSE_REP} reputation`);
    expect(advice(ctx)).toContain(`${g.name} is within ${WORSE_AHEAD_DAYS} days of going home worse off`);
    // a second guest the same month says nothing more
    const other = { ...structuredClone(g), id: s.nextId++ };
    s.guests.push(other);
    ctx.events.length = 0;
    warnLine(ctx);
    expect(toasts(ctx.events)).toEqual([]);
    expect(advice(ctx)).toContain('2 guests waiting are within');
    // the next month, it is said again
    s.day += DAYS_PER_MONTH;
    warnLine(ctx);
    expect(toasts(ctx.events).join()).toContain('2 guests have waited so long');
  });

  it('worsens faster with some conditions than others', () => {
    expect(worsenRate('knotted')).toBe(CONDITION_DRAIN);
    expect(worsenRate('steam')).toBeGreaterThan(worsenRate('knotted'));
    expect(worsenRate('slump')).toBeLessThan(worsenRate('knotted'));
  });

  it('takes more off the chance of success the worse it gets', () => {
    expect(conditionPenalty(100)).toBe(0);
    expect(conditionPenalty(50)).toBeCloseTo(CONDITION_PENALTY / 2);
    expect(conditionPenalty(0)).toBeCloseTo(CONDITION_PENALTY);
    expect(conditionPenalty(-5)).toBeCloseTo(CONDITION_PENALTY);
  });

  it('runs down while a guest waits, but not on the table or once they are on their way', () => {
    const { sim, g } = withGuest();
    const before = g.health;
    run(sim, 3);
    if (!g.outcome && g.state !== 'served') expect(g.health).toBeLessThan(before);
    expect(worsening({ ...g, state: 'served' })).toBe(false);
    expect(worsening({ ...g, outcome: 'healed' })).toBe(false);
    expect(worsening({ ...g, goal: 'leave' })).toBe(false);
  });

  it('starts low for emergency guests, who arrive in a bad way', () => {
    const { sim } = openCenter(1);
    const ctx = createContext(sim.s);
    expect(spawnGuest(ctx, 'knotted', true)!.health).toBe(EMERGENCY_CONDITION);
    expect(spawnGuest(ctx, 'knotted')!.health).toBe(100);
  });

  it('sends a guest home worse off when it runs out: counted, reviewed and a big knock to reputation', () => {
    const { sim, s, g } = withGuest();
    s.reputation = 50;
    g.health = 0.001;
    sim.tick(0.05);
    expect(g.outcome).toBe('worse');
    expect(g.state).toBe('leaving');
    expect(s.stats.worse).toBe(1);
    expect(s.tally.worse).toBe(1);
    expect(s.casebook[g.condition]!.worse).toBe(1);
    expect(s.reviews.at(-1)!.feelings).toContain('worse');
    expect(s.reviews.at(-1)!.stars).toBe(1);
    expect(s.reputation).toBeLessThanOrEqual(50 - WORSE_REP + 0.5);
    expect(reviewStars('worse', ['worse'])).toBe(1);
    expect(inconsistencies(sim)).toEqual([]);
  });

  it('lowers the chance a treatment works', () => {
    const { sim, s } = openCenter(1);
    runUntil(sim, () => s.guests.some((g) => sim.chanceFor(g)), 600);
    const g = s.guests.find((x) => sim.chanceFor(x))!;
    g.health = 100;
    const well = sim.chanceFor(g)!.chance;
    g.health = 10;
    expect(sim.chanceFor(g)!.chance).toBeLessThan(well);
  });
});

describe('bad vibes', () => {
  it('are left by a failed treatment, and lower results in that room until cleared', () => {
    const { sim, s, massage } = openCenter(1);
    const ctx = createContext(s);
    addVibes(ctx, massage);
    expect(massage.vibes).toBe(VIBES_PER_FAIL);
    addVibes(ctx, massage);
    expect(massage.vibes).toBe(100);
    expect(vibesPenalty(massage)).toBeCloseTo(VIBES_PENALTY);
    expect(vibesPenalty(undefined)).toBe(0);
    massage.vibes = 0;
    runUntil(sim, () => s.guests.some((g) => sim.chanceFor(g)), 600);
    const g = s.guests.find((x) => sim.chanceFor(x))!;
    const clear = sim.chanceFor(g)!.chance;
    massage.vibes = 100;
    expect(sim.chanceFor(g)!.chance).toBeLessThan(clear);
  });

  it('fade slowly on their own, and are gone in the end', () => {
    const { s, massage } = openCenter(1);
    const ctx = createContext(s);
    addVibes(ctx, massage);
    fadeVibes(ctx, 10);
    expect(massage.vibes).toBeCloseTo(VIBES_PER_FAIL - VIBES_FADE * 10);
    // slowly: a few days on, they are still most of the way there
    expect(massage.vibes).toBeGreaterThan(VIBES_PER_FAIL / 2);
    fadeVibes(ctx, VIBES_PER_FAIL / VIBES_FADE);
    expect(massage.vibes).toBe(0);
  });

  it('come with every failed treatment', () => {
    const { sim, s, massage } = openCenter(3);
    // no reiki here, and no Caretaker who could clear them
    runUntil(sim, () => s.stats.failed > 0, 1500);
    expect(massage.vibes).toBeGreaterThan(0);
  });

  it('unsettle staff working in the room', () => {
    const { sim, s, therapist, massage } = openCenter(1);
    runUntil(sim, () => therapist.state === 'atPost', 60);
    const ctx = createContext(s);
    massage.vibes = 0;
    const settled = moraleTarget(ctx, therapist);
    massage.vibes = 50;
    expect(moraleTarget(ctx, therapist)).toBeCloseTo(settled - VIBES_MORALE);
  });

  it('are cleared by a Reiki Practitioner, wafting sage through the room', () => {
    const { sim, s, massage } = openCenter(1);
    s.stars = 2;
    addReiki(sim);
    const practitioner = hire(sim, 'practitioner');
    expect(canSmudge(practitioner)).toBe(true);
    massage.vibes = 100;
    let wafted = false;
    runUntil(
      sim,
      () => {
        if (wafting(practitioner)) wafted = true;
        return massage.vibes === 0;
      },
      300,
    );
    expect(wafted).toBe(true);
    expect(massage.claimedBy).toBe(0);
    expect(practitioner.job).toBeNull();
    expect(inconsistencies(sim)).toEqual([]);
  });

  it('wait for a Reiki Practitioner to see the guests in their line, unless they are in their own room', () => {
    const { sim, s, massage } = openCenter(1);
    s.stars = 2;
    const reiki = addReiki(sim);
    const practitioner = hire(sim, 'practitioner');
    runUntil(sim, () => practitioner.state === 'atPost' && s.guests.length > 0, 300);
    const ctx = createContext(s);
    const table = s.items.find((i) => i.id === practitioner.post)!;
    table.serving = 0;
    table.queue = [];
    practitioner.energy = 100;
    massage.vibes = 100;
    expect(wantsAway(ctx, practitioner, table)).toBe(true);
    const g = s.guests[0]!;
    g.station = table.id;
    g.state = 'waiting';
    table.queue.push(g.id);
    expect(wantsAway(ctx, practitioner, table)).toBe(false);
    massage.vibes = 0;
    reiki.vibes = 100;
    expect(wantsAway(ctx, practitioner, table)).toBe(true);
  });

  it('are left alone by a Caretaker until they learn Smudging', () => {
    const { sim, s, massage } = openCenter(1);
    const caretaker = hire(sim, 'caretaker');
    const ctx = createContext(s);
    massage.vibes = 100;
    expect(canSmudge(caretaker)).toBe(false);
    expect(roomToSmudge(ctx, caretaker)).toBeUndefined();
    run(sim, 30);
    // only fading, with nobody clearing them
    expect(massage.vibes).toBeCloseTo(100 - VIBES_FADE * 30, 0);
    addTraining(sim);
    expect(sim.courses(caretaker).some((c) => c.id === 'smudging')).toBe(true);
    expect(sim.train(caretaker.id, 'smudging')).toBe(true);
    runUntil(sim, () => caretaker.general.includes('smudging'), 120);
    massage.vibes = 100;
    runUntil(sim, () => wafting(caretaker), 120);
    // cleared long before they could have faded
    runUntil(sim, () => massage.vibes === 0, 60);
    expect(inconsistencies(sim)).toEqual([]);
  });

  it('are given up on cleanly if the room is knocked down mid-clearing', () => {
    const { sim, s, massage } = openCenter(1);
    s.stars = 2;
    addReiki(sim);
    const practitioner = hire(sim, 'practitioner');
    massage.vibes = 100;
    runUntil(sim, () => wafting(practitioner), 300);
    sim.removeRoom(massage.id, 0.5);
    run(sim, 5);
    expect(practitioner.job?.kind).not.toBe('smudge');
    expect(inconsistencies(sim)).toEqual([]);
  });
});

describe('a stress outbreak', () => {
  /** A center past the stars an outbreak needs, with an outbreak on offer and a few guests about. */
  function onOffer(seed = 1) {
    const center = openCenter(seed);
    center.s.stars = OUTBREAK_STARS;
    runUntil(center.sim, () => center.s.guests.filter((g) => !g.outcome).length >= 3, 300);
    expect(center.sim.offerOutbreak()).toBe(true);
    return center;
  }

  it('is offered once the center has the stars for it, and lapses if left', () => {
    const { sim, s } = openCenter(1);
    s.stars = OUTBREAK_STARS;
    s.nextOutbreak = 0;
    run(sim, 2);
    expect(s.outbreakOffer).not.toBeNull();
    s.day = s.outbreakOffer!.deadline;
    run(sim, 1.5);
    expect(s.outbreakOffer).toBeNull();
    expect(s.outbreak).toBeNull();
    expect(s.nextOutbreak).toBeGreaterThan(s.day);
  });

  it('starts with stressed guests among those already here once accepted', () => {
    const { sim, s } = onOffer();
    const seed = s.outbreakOffer!.seed;
    sim.acceptOutbreak();
    const o = s.outbreak!;
    expect(s.guests.filter((g) => g.stressed).length + o.pending).toBe(seed);
    expect(o.calms).toBeGreaterThan(seed);
  });

  it('spreads between guests waiting close together, and not to those far off', () => {
    const { s } = onOffer();
    const ctx = createContext(s);
    s.outbreak = s.outbreakOffer;
    const [a, b, c] = s.guests.filter((g) => !g.outcome);
    for (const g of [a!, b!, c!]) g.state = 'waiting';
    a!.stressed = true;
    b!.x = a!.x + 0.5;
    b!.y = a!.y;
    c!.x = a!.x + 9;
    c!.y = a!.y;
    for (let i = 0; i < 200 && !b!.stressed; i++) spreadStress(ctx);
    expect(b!.stressed).toBe(true);
    expect(c!.stressed).toBe(false);
  });

  it('is fought with calming sessions: one on a carrier calms them, one on anyone else is wasted', () => {
    const { sim, s } = onOffer();
    sim.acceptOutbreak();
    const o = s.outbreak!;
    const carrier = s.guests.find((g) => g.stressed)!;
    const fine = s.guests.find((g) => g !== carrier && g.state !== 'leaving')!;
    fine.stressed = false;
    const calms = o.calms;
    expect(sim.calm(carrier.id)).toBe('calmed');
    expect(carrier.stressed).toBe(false);
    expect(carrier.calmed).toBe(true);
    expect(carrier.feelings).toContain('calmed');
    expect(sim.calm(fine.id)).toBe('wasted');
    expect(o.calms).toBe(calms - 2);
    // nobody is calmed twice, and none are given once they run out
    expect(sim.calm(carrier.id)).toBe('');
    o.calms = 0;
    const another = s.guests.find((g) => !g.calmed && g.state !== 'leaving');
    if (another) expect(sim.calm(another.id)).toBe('');
  });

  it('counts carriers who leave still stressed, and pays off if few enough did', () => {
    const { sim, s } = onOffer();
    sim.acceptOutbreak();
    const o = s.outbreak!;
    const carrier = s.guests.find((g) => g.stressed)!;
    sim.sendHome(carrier.id);
    expect(o.lost).toBe(1);
    for (const g of s.guests) g.stressed = false;
    o.pending = 0;
    const bonus = s.ledger.bonus;
    run(sim, 1.5);
    expect(s.outbreak).toBeNull();
    expect(s.ledger.bonus).toBe(bonus + o.reward);
  });

  it('costs reputation if too many carriers got away', () => {
    const { sim, s } = onOffer();
    sim.acceptOutbreak();
    const o = s.outbreak!;
    o.lost = o.lostMax + 1;
    s.reputation = 50;
    endOutbreak(createContext(s));
    expect(s.reputation).toBeLessThan(50);
    expect(s.guests.some((g) => g.stressed || g.calmed)).toBe(false);
    expect(inconsistencies(sim)).toEqual([]);
  });

  it('is carried in by the next guests to arrive when too few are here to start it', () => {
    const { sim, s } = openCenter(1);
    s.stars = OUTBREAK_STARS;
    expect(sim.offerOutbreak()).toBe(true);
    sim.acceptOutbreak();
    const o = s.outbreak!;
    expect(o.pending).toBeGreaterThan(0);
    const g = spawnGuest(createContext(s))!;
    expect(g.stressed).toBe(true);
  });
});

describe('the sage', () => {
  it('lets each puff of smoke go in turn, so the trail is never all in one place', () => {
    const ages = Array.from({ length: 7 }, (_, i) => puffAge(0.3, i));
    expect(new Set(ages.map((a) => a.toFixed(3))).size).toBe(7);
    for (const a of ages) expect(a >= 0 && a < 1).toBe(true);
  });
});

describe('a save from before the stakes', () => {
  it('gets healthy guests, clear rooms, no outbreak and nobody worse off', () => {
    const { sim, s } = openCenter(2);
    run(sim, 30);
    const old = JSON.parse(JSON.stringify(s)) as Record<string, any>;
    old.version = 9;
    for (const k of ['outbreakOffer', 'outbreak', 'nextOutbreak']) Reflect.deleteProperty(old, k);
    delete old.stats.worse;
    delete old.tally.worse;
    for (const c of Object.values<Record<string, number>>(old.casebook)) delete c.worse;
    for (const r of old.rooms) {
      delete r.vibes;
      delete r.claimedBy;
    }
    for (const g of old.guests) {
      delete g.health;
      delete g.stressed;
      delete g.calmed;
    }
    upgradeSave(old as GameState);
    const up = old as GameState;
    expect(up.version).toBe(SAVE_VERSION);
    expect(up.rooms.every((r) => r.vibes === 0 && r.claimedBy === 0)).toBe(true);
    expect(up.guests.every((g) => g.health === 100 && !g.stressed && !g.calmed)).toBe(true);
    expect(up.outbreak).toBeNull();
    expect(up.nextOutbreak).toBeGreaterThan(up.day);
    expect(up.stats.worse).toBe(0);
    expect(Object.values(up.casebook).every((c) => c.worse === 0)).toBe(true);
  });
});
