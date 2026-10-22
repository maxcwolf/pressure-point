import { describe, expect, it } from 'vitest';

import { CENTERS, ITEMS, ROOMS } from '../../src/core/data';
import { netOf } from '../../src/core/sim/economy';
import {
  addConsult,
  addMassage,
  addRestroom,
  addStaffRoom,
  addTraining,
  freshSim,
  hire,
  inconsistencies,
  openCenter,
  run,
  runUntil,
} from './helpers';

describe('opening the center', () => {
  it('stays closed until reception, consultation and massage all exist', () => {
    const sim = freshSim();
    sim.placeItem('reception_desk', 14, 13, 0);
    addConsult(sim);
    run(sim, 60);
    expect(sim.s.open).toBe(false);
    expect(sim.s.guests).toHaveLength(0);
    addMassage(sim);
    run(sim, 1);
    expect(sim.s.open).toBe(true);
    run(sim, 30);
    expect(sim.s.guests.length).toBeGreaterThan(0);
  });

  it('charges for rooms and items as they are built', () => {
    const sim = freshSim();
    sim.placeItem('reception_desk', 14, 13, 0);
    addConsult(sim);
    // a 4×4 Consultation Room, all of its floor in the price
    const room = ROOMS.consult.cost;
    expect(sim.s.money).toBe(CENTERS.sandbox.startMoney - ITEMS.reception_desk.cost - room);
    expect(sim.s.ledger.building).toBe(ITEMS.reception_desk.cost + room);
  });
});

describe('the guest journey', () => {
  it('runs from reception through diagnosis to a paid treatment', () => {
    const { sim, s } = openCenter(1);
    run(sim, 420);
    expect(s.stats.arrived).toBeGreaterThan(5);
    expect(s.stats.healed).toBeGreaterThan(0);
    expect(s.ledger.consult + s.lastLedger.consult).toBeGreaterThan(0);
    expect(s.ledger.treatment + s.lastLedger.treatment).toBeGreaterThan(0);
    expect(s.reputation).not.toBe(30);
  });

  it('ends with fed-up guests leaving when nobody is there to serve them', () => {
    const sim = freshSim(2);
    sim.placeItem('reception_desk', 14, 13, 0);
    addConsult(sim);
    addMassage(sim);
    run(sim, 400);
    expect(sim.s.stats.stormed).toBeGreaterThan(0);
    expect(sim.s.stats.healed).toBe(0);
    expect(sim.s.reputation).toBeLessThan(30);
  });

  it('has waiting guests take a free bench seat', () => {
    const { sim, s, therapist } = openCenter(3);
    const bench = sim.placeItem('bench', 10, 9, 0)!;
    // with no therapist, diagnosed guests have to wait outside the Massage Suite
    sim.fire(therapist.id);
    runUntil(sim, () => s.guests.some((g) => g.pose === 'sit' && g.claimItem === bench.id), 400);
    expect(bench.users.some((u) => u !== 0)).toBe(true);
  });

  it('sells a thirsty guest a cup of tea', () => {
    const { sim, s, consultant } = openCenter(4);
    sim.placeItem('tea_station', 16, 10, 0);
    // with no consultant, guests are left waiting long enough to want a drink
    sim.fire(consultant.id);
    runUntil(sim, () => s.guests.some((g) => g.state === 'waiting'), 300);
    for (const g of s.guests) g.thirst = 96;
    runUntil(sim, () => s.ledger.vending > 0, 200);
    expect(s.ledger.vending % 15).toBe(0);
  });

  it('never loses track of anyone', () => {
    const { sim, s } = openCenter(5);
    for (let minute = 0; minute < 10; minute++) {
      run(sim, 60);
      for (const c of [...s.guests, ...s.staff, ...s.visitors]) {
        expect(Number.isFinite(c.x) && Number.isFinite(c.y), `${c.name} position`).toBe(true);
        expect(c.x).toBeGreaterThanOrEqual(0);
        expect(c.y).toBeGreaterThanOrEqual(0);
      }
      for (const item of s.items) {
        for (const id of item.queue) expect(sim.guest(id), 'queued guest exists').toBeDefined();
        if (item.serving) expect(sim.guest(item.serving), 'served guest exists').toBeDefined();
      }
    }
  });
});

describe('staff', () => {
  it('walk in and take up the right posts', () => {
    const { sim, receptionist, consultant, therapist } = openCenter(1);
    runUntil(sim, () => [receptionist, consultant, therapist].every((x) => x.state === 'atPost'), 120);
    expect(sim.world.item(receptionist.post)!.type).toBe('reception_desk');
    expect(sim.world.item(consultant.post)!.type).toBe('consult_desk');
    expect(sim.world.item(therapist.post)!.type).toBe('massage_table');
  });

  it('rest on the sofa when tired, then go back to work', () => {
    const { sim, therapist } = openCenter(1);
    addStaffRoom(sim);
    runUntil(sim, () => therapist.state === 'atPost', 120);
    therapist.energy = 8;
    runUntil(sim, () => therapist.state === 'onBreak', 200);
    expect(therapist.pose).toBe('sit');
    runUntil(sim, () => therapist.energy > 95 && therapist.state !== 'onBreak', 200);
    runUntil(sim, () => therapist.state === 'atPost', 120);
  });

  it('soldier on, slowly, when there is no staff room', () => {
    const { sim, therapist } = openCenter(1);
    runUntil(sim, () => therapist.state === 'atPost', 120);
    therapist.energy = 3;
    run(sim, 60);
    expect(therapist.state).not.toBe('onBreak');
    expect(therapist.energy).toBeLessThan(15);
  });

  it('are paid at the end of the month', () => {
    const { sim, s } = openCenter(1);
    const wages = s.staff.reduce((a, x) => a + x.salary, 0);
    s.day = 29.99;
    run(sim, 1);
    expect(s.lastLedger.salaries).toBe(wages);
    expect(s.history).toHaveLength(1);
    expect(s.history[0]).toBe(netOf(s.lastLedger));
    expect(s.ledger.salaries).toBe(0);
  });

  it('leave when let go, freeing their post', () => {
    const { sim, s, therapist } = openCenter(1);
    runUntil(sim, () => therapist.state === 'atPost', 120);
    const table = sim.world.item(therapist.post)!;
    sim.fire(therapist.id);
    expect(table.staffId).toBe(0);
    runUntil(sim, () => !s.staff.includes(therapist), 200);
  });

  it('send the guest on their table back to the line when let go mid-treatment', () => {
    const { sim, s, therapist } = openCenter(1);
    const table = s.items.find((i) => i.type === 'massage_table')!;
    runUntil(sim, () => sim.guest(table.serving)?.state === 'served', 600);
    const g = sim.guest(table.serving)!;
    sim.fire(therapist.id);
    expect(inconsistencies(sim)).toEqual([]);
    expect(g.state).not.toBe('served');
    // with nobody to treat them they lose patience and leave, rather than lying there for good
    runUntil(sim, () => !s.guests.includes(g), 900);
  });

  it('send the guest on their table back to the line when sent on a course mid-treatment', () => {
    const { sim, s, therapist } = openCenter(3);
    addTraining(sim);
    const table = s.items.find((i) => i.type === 'massage_table')!;
    runUntil(sim, () => sim.guest(table.serving)?.state === 'served', 600);
    const g = sim.guest(table.serving)!;
    // a free qualification slot for the course
    therapist.quals = ['swedish'];
    expect(sim.train(therapist.id, 'stamina')).toBe(true);
    expect(inconsistencies(sim)).toEqual([]);
    expect(g.state).not.toBe('served');
    expect(table.serving).toBe(0);
  });
});

describe('caretakers', () => {
  it('clear litter', () => {
    const { sim, s } = openCenter(1);
    s.litter.push({ id: s.nextId++, x: 10, y: 12, claimedBy: 0 }, { id: s.nextId++, x: 20, y: 14, claimedBy: 0 });
    hire(sim, 'caretaker');
    runUntil(sim, () => s.litter.length === 0, 300);
  });

  it('water wilting plants', () => {
    const { sim } = openCenter(1);
    const plant = sim.placeItem('plant', 18, 12, 0)!;
    plant.water = 12;
    hire(sim, 'caretaker');
    runUntil(sim, () => plant.water > 90, 300);
  });
});

describe('selling', () => {
  it('returns half the price of an item', () => {
    const sim = freshSim();
    const bench = sim.placeItem('bench', 10, 10, 0)!;
    const before = sim.s.money;
    sim.sellItem(bench.id);
    expect(sim.s.money).toBe(before + 75);
    expect(sim.s.items).toHaveLength(0);
  });

  it('will not sell the furniture a room depends on', () => {
    const sim = freshSim();
    addConsult(sim);
    const desk = sim.s.items.find((i) => i.type === 'consult_desk')!;
    expect(sim.canSell(desk)).toBe(false);
    sim.sellItem(desk.id);
    expect(sim.s.items).toContain(desk);
  });

  it('frees the seat a guest was holding elsewhere when the station they wanted is sold', () => {
    const { sim, s, receptionist } = openCenter(1);
    addRestroom(sim);
    const toilet = s.items.find((i) => i.type === 'toilet')!;
    const desk = s.items.find((i) => i.type === 'reception_desk')!;
    // nobody at the desk, so guests wait in its line until one needs the toilet
    sim.fire(receptionist.id);
    runUntil(sim, () => s.guests.some((g) => g.station === desk.id), 300);
    const g = s.guests.find((x) => x.station === desk.id)!;
    g.bladder = 100;
    runUntil(sim, () => g.claimItem === toilet.id, 120);
    sim.sellItem(desk.id);
    expect(inconsistencies(sim)).toEqual([]);
  });
});

describe('demolishing a room', () => {
  it('frees the bench seats of the guests who were waiting for it', () => {
    const { sim, s, massage, therapist } = openCenter(4);
    sim.fire(therapist.id);
    const bench = sim.placeItem('bench', 10, 9, 0)!;
    const table = s.items.find((i) => i.type === 'massage_table')!;
    runUntil(sim, () => s.guests.some((g) => g.station === table.id && g.claimItem === bench.id), 600);
    sim.removeRoom(massage.id, 0.5);
    expect(inconsistencies(sim)).toEqual([]);
  });
});

describe('stars', () => {
  it('are awarded, with a grant, when every objective is met', () => {
    const { sim, s } = openCenter(1);
    sim.drain();
    s.stats.healed = 8;
    s.reputation = 45;
    const before = s.money;
    run(sim, 2);
    expect(s.stars).toBe(1);
    expect(s.money).toBeGreaterThanOrEqual(before + 5000 - 1);
    expect(sim.drain().some((e) => e.type === 'star')).toBe(true);
    // the next star's objectives take over, including a bank balance
    expect(sim.objectives()).toHaveLength(3);
  });

  it('are withheld while any objective is unmet', () => {
    const { sim, s } = openCenter(1);
    s.stats.healed = 8;
    s.reputation = 20;
    run(sim, 2);
    expect(s.stars).toBe(0);
  });

  it('are awarded exactly when every objective shown is met, even in debt', () => {
    const { sim, s } = openCenter(1);
    s.stats.healed = 8;
    s.reputation = 45;
    s.money = -500;
    expect(sim.objectives().every((o) => o.done)).toBe(true);
    run(sim, 2);
    expect(s.stars).toBe(1);
  });

  it('record their grant in the books', () => {
    const { sim, s } = openCenter(1);
    s.stats.healed = 8;
    s.reputation = 45;
    const before = { money: s.money, net: netOf(s.ledger) };
    sim.tick(0.05);
    expect(s.stars).toBe(1);
    expect(netOf(s.ledger) - before.net).toBe(s.money - before.money);
  });
});
