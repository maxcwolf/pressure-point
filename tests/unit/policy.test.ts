// The player's say in how the center is run: policy, guests' chances, lines, sending home and room priority.
import { describe, expect, it } from 'vitest';

import { createContext } from '../../src/core/sim/context';
import { breakDue, changedPolicy, onBreak } from '../../src/core/sim/policy';
import { inLine, sameKind } from '../../src/core/sim/queues';
import { nextInLine, successChance } from '../../src/core/sim/stations';
import { defaultPolicy } from '../../src/core/state/game';
import type { Guest, Item } from '../../src/core/state/types';
import {
  addRestroom,
  addStaffRoom,
  buildRoom,
  hire,
  inconsistencies,
  LAYOUT,
  openCenter,
  run,
  runUntil,
} from './helpers';

/** Put guests in a station's line, waiting, as if they had walked up to it. */
function lineUp(table: Item, guests: Guest[]) {
  for (const g of guests) {
    g.station = table.id;
    g.state = 'waiting';
    g.goal = 'treat';
    table.queue.push(g.id);
  }
}

/** A second Massage Suite, where the Posture Lab usually goes. */
function addSecondSuite(sim: ReturnType<typeof openCenter>['sim']) {
  return buildRoom(sim, 'massage', LAYOUT.assess.rect, LAYOUT.assess.door, [
    ['massage_table', 20, 11],
    ['oil_trolley', 22, 11],
  ]);
}

/** A center with guests in the building, and its massage table. */
function busyCenter(seed = 1) {
  const c = openCenter(seed);
  runUntil(c.sim, () => c.s.guests.length >= 3, 300);
  const table = c.s.items.find((i) => i.type === 'massage_table')!;
  return { ...c, table };
}

describe('the policy', () => {
  it('keeps each setting in its range', () => {
    const p = defaultPolicy();
    expect(changedPolicy(p, { diagnosis: 2 }).diagnosis).toBe(0.95);
    expect(changedPolicy(p, { diagnosis: 0.1 }).diagnosis).toBe(0.5);
    expect(changedPolicy(p, { diagnosis: 0.8000001 }).diagnosis).toBe(0.8);
    expect(changedPolicy(p, { breakAt: 99 }).breakAt).toBe(50);
    expect(changedPolicy(p, { breakAt: 0 }).breakAt).toBe(10);
    expect(changedPolicy(p, { breakLimit: { role: 'therapist', limit: 2 } }).breakLimit).toEqual({ therapist: 2 });
    // and a limit of nothing takes it away again, without touching the policy it came from
    const limited = changedPolicy(p, { breakLimit: { role: 'therapist', limit: 2 } });
    expect(
      changedPolicy(limited, { breakLimit: { role: 'therapist', limit: 0 } }).breakLimit.therapist,
    ).toBeUndefined();
    expect(limited.breakLimit.therapist).toBe(2);
    expect(p.breakLimit).toEqual({});
  });

  it('sends guests for treatment once their diagnosis is as sure as it asks', () => {
    const lax = openCenter(3);
    lax.sim.setPolicy({ diagnosis: 0.5 });
    const strict = openCenter(3);
    strict.sim.setPolicy({ diagnosis: 0.95 });
    for (const c of [lax, strict]) run(c.sim, 240);
    /** Consultation fees paid per guest who came. */
    const consults = (c: typeof lax) => c.s.ledger.consult / Math.max(1, c.s.stats.arrived);
    // a stricter policy means more consultations per guest, and surer diagnoses for those treated
    expect(consults(strict)).toBeGreaterThan(consults(lax));
    for (const g of strict.s.guests.filter((x) => x.goal === 'treat' && !x.emergency))
      expect(g.diagnosis >= 0.95 || g.consults >= 4).toBe(true);
  });

  it('lets staff take a break at the energy it sets', () => {
    const { s, therapist } = openCenter(1);
    const ctx = createContext(s);
    therapist.energy = 30;
    expect(breakDue(ctx, therapist)).toBe(false);
    s.policy.breakAt = 35;
    expect(breakDue(ctx, therapist)).toBe(true);
  });

  it('keeps no more of a role on a break at once than it allows', () => {
    const { sim, s } = openCenter(1);
    addStaffRoom(sim);
    const second = hire(sim, 'therapist');
    const ctx = createContext(s);
    s.policy.breakLimit = { therapist: 1 };
    const first = s.staff.find((x) => x.role === 'therapist' && x !== second)!;
    first.state = 'onBreak';
    second.energy = 5;
    expect(onBreak(s, 'therapist')).toBe(1);
    expect(breakDue(ctx, second)).toBe(false);
    // other roles are not held back by it
    const consultant = s.staff.find((x) => x.role === 'consultant')!;
    consultant.energy = 5;
    expect(breakDue(ctx, consultant)).toBe(true);
    first.state = 'atPost';
    expect(breakDue(ctx, second)).toBe(true);
  });

  it('can call emergency guests first', () => {
    const { s, table } = busyCenter();
    const ctx = createContext(s);
    const [a, b] = s.guests;
    lineUp(table, [a!, b!]);
    b!.emergency = true;
    expect(nextInLine(ctx, table)).toBe(a);
    s.policy.emergenciesFirst = true;
    expect(nextInLine(ctx, table)).toBe(b);
  });
});

describe("a guest's chance of success", () => {
  it('is shown before treatment, and falls with the wrong hands', () => {
    const { sim, s, table, therapist } = busyCenter();
    const g = s.guests[0]!;
    lineUp(table, [g]);
    g.condition = 'slump';
    g.diagnosis = 0.8;
    const ctx = createContext(s);
    const good = successChance(ctx, table, therapist, g);
    expect(good.problem).toBe('');
    expect(good.chance).toBeGreaterThan(0.3);
    expect(good.chance).toBeLessThanOrEqual(0.98);
    // a technique they were never taught: the same odds, cut to a fraction
    g.condition = 'flex';
    therapist.quals = ['swedish'];
    const bad = successChance(ctx, table, therapist, g);
    expect(bad.problem).not.toBe('');
    expect(bad.chance).toBeLessThan(good.chance);
    // and the interface asks for it through the guest
    table.staffId = therapist.id;
    expect(sim.chanceFor(g)?.chance).toBe(successChance(ctx, table, therapist, g).chance);
  });

  it('is unknown until there is a diagnosis and someone at the table', () => {
    const { sim, s, table } = busyCenter();
    const g = s.guests[0]!;
    lineUp(table, [g]);
    table.staffId = 0;
    expect(sim.chanceFor(g)).toBeNull();
    g.goal = 'consult';
    expect(sim.chanceFor(g)).toBeNull();
  });
});

describe('a line', () => {
  it('can be reordered, and the guest moved stays put', () => {
    const { sim, s, table } = busyCenter();
    const [a, b, c] = s.guests;
    lineUp(table, [a!, b!, c!]);
    expect(sim.moveInLine(c!.id, -2)).toBe(true);
    expect(table.queue).toEqual([c!.id, a!.id, b!.id]);
    expect(c!.placed).toBe(true);
    // not past either end
    expect(sim.moveInLine(c!.id, -1)).toBe(false);
    expect(sim.moveInLine(b!.id, 1)).toBe(false);
  });

  it('can send a waiting guest to another station that does the same job, and they stay there', () => {
    const { sim, s, table } = busyCenter();
    addSecondSuite(sim);
    const other = s.items.find((i) => i.type === 'massage_table' && i !== table)!;
    const ctx = createContext(s);
    expect(sameKind(ctx, table)).toContain(other);
    expect(sameKind(ctx, table)).not.toContain(s.items.find((i) => i.type === 'consult_desk'));
    const g = s.guests[0]!;
    lineUp(table, [g]);
    expect(sim.moveToStation(g.id, other.id)).toBe(true);
    expect(g.station).toBe(other.id);
    expect(other.queue).toContain(g.id);
    expect(table.queue).not.toContain(g.id);
    // not to a station that does something else
    const desk = s.items.find((i) => i.type === 'consult_desk')!;
    expect(sim.moveToStation(g.id, desk.id)).toBe(false);
    run(sim, 3);
    expect(inconsistencies(sim)).toEqual([]);
  });

  it('only moves guests who are waiting', () => {
    const { sim, s, table } = busyCenter();
    const g = s.guests[0]!;
    lineUp(table, [g]);
    g.state = 'served';
    expect(inLine(g)).toBe(false);
    expect(sim.moveInLine(g.id, 1)).toBe(false);
  });
});

describe('sending a guest home', () => {
  it('counts them as sent home, costs a little reputation and no fee', () => {
    const { sim, s } = busyCenter();
    const g = s.guests.find((x) => x.state !== 'leaving')!;
    const rep = s.reputation;
    const money = s.money;
    expect(sim.sendHome(g.id)).toBe(true);
    expect(g.outcome).toBe('sent');
    expect(g.state).toBe('leaving');
    expect(s.stats.sent).toBe(1);
    expect(s.tally.sent).toBe(1);
    expect(s.reputation).toBeLessThan(rep);
    expect(rep - s.reputation).toBeLessThan(2.5);
    expect(s.money).toBe(money);
    // once is enough
    expect(sim.sendHome(g.id)).toBe(false);
    run(sim, 5);
    expect(inconsistencies(sim)).toEqual([]);
  });
});

describe('a priority room', () => {
  it('is staffed before the others', () => {
    const { sim, therapist } = openCenter(1);
    runUntil(sim, () => therapist.state === 'atPost', 120);
    const second = addSecondSuite(sim);
    // settled in the first suite, they stay there while the second is just another room
    run(sim, 5);
    const before = sim.world.item(therapist.post)!;
    expect(sim.world.zoneAt(before.x, before.y)).not.toBe(second.id);
    sim.setRoomPriority(second.id, true);
    runUntil(
      sim,
      () => {
        const post = sim.world.item(therapist.post);
        return therapist.state === 'atPost' && !!post && sim.world.zoneAt(post.x, post.y) === second.id;
      },
      120,
    );
    expect(inconsistencies(sim)).toEqual([]);
    sim.setRoomPriority(second.id, false);
    expect(second.priority).toBe(false);
  });

  it('is seen to first by janitors', () => {
    const { sim, s, massage } = openCenter(1);
    const restroom = addRestroom(sim);
    const janitor = hire(sim, 'caretaker');
    runUntil(sim, () => janitor.state === 'idle' || janitor.state === 'wander', 60);
    // litter right beside them, and some in the restroom across the building
    s.litter.push({ id: 90001, x: janitor.tx, y: janitor.ty, claimedBy: 0 });
    s.litter.push({ id: 90002, x: 22, y: 6, claimedBy: 0 });
    expect(sim.world.zoneAt(22, 6)).toBe(restroom.id);
    sim.setRoomPriority(restroom.id, true);
    runUntil(sim, () => !!janitor.job, 30);
    expect(janitor.job?.id).toBe(90002);
    expect(massage.priority).toBe(false);
  });
});
