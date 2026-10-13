import { describe, expect, it } from 'vitest';
import { ASSESS_FEE, CONDITION_BY_ID, CONSULT_FEE, LOAN_MAX, LOAN_RATE, LOAN_STEP, PRICE_MAX, PRICE_MIN } from '../../src/data';
import {
  addPostureLab,
  addRestroom,
  addStaffRoom,
  addTraining,
  hire,
  openCenter,
  run,
  runUntil,
  toasts,
} from './helpers';

describe('decor and prestige', () => {
  it('rates a room higher the more decor it has, and lower for wilted plants and litter', () => {
    const { sim, s, massage } = openCenter(1);
    const plain = sim.prestige(massage);
    sim.placeItem('statue', 14, 8, 0);
    sim.placeItem('salt_lamp', 11, 8, 0);
    const dressed = sim.prestige(massage);
    expect(dressed).toBeGreaterThan(plain);
    const plant = sim.placeItem('plant', 11, 5, 0)!;
    const withPlant = sim.prestige(massage);
    plant.water = 0;
    expect(sim.prestige(massage)).toBeLessThanOrEqual(withPlant);
    s.litter.push({ id: s.nextId++, x: 13, y: 7, claimedBy: 0 }, { id: s.nextId++, x: 13, y: 8, claimedBy: 0 });
    expect(sim.prestige(massage)).toBeLessThan(dressed);
    expect(sim.prestige(massage)).toBeGreaterThanOrEqual(1);
  });

  it('caps prestige at five', () => {
    const { sim, massage } = openCenter(1);
    for (const [x, y] of [[14, 8], [11, 8], [14, 7], [14, 6], [11, 5]]) sim.placeItem('statue', x, y, 0);
    expect(sim.prestige(massage)).toBe(5);
  });

  it('makes waiting nicer near a fountain and worse near litter', () => {
    const { sim, s } = openCenter(1);
    sim.placeItem('fountain', 12, 11, 0);
    s.litter.push({ id: s.nextId++, x: 25, y: 15, claimedBy: 0 });
    run(sim, 2);
    expect(sim.drainFactor(12, 12)).toBeLessThan(sim.drainFactor(18, 15));
    expect(sim.drainFactor(25, 15)).toBeGreaterThan(sim.drainFactor(18, 15));
    // the effect fades with distance
    expect(sim.drainFactor(12, 12)).toBeLessThan(sim.drainFactor(12, 14));
  });
});

describe('equipment wear', () => {
  it('builds up with use until the table breaks, then a janitor repairs it', () => {
    const { sim, s, therapist } = openCenter(1);
    const table = s.items.find((i) => i.type === 'massage_table')!;
    runUntil(sim, () => s.stats.healed + s.stats.failed >= 1, 600);
    expect(table.wear).toBeGreaterThan(0);

    table.wear = 99;
    sim.drain();
    runUntil(sim, () => table.wear >= 100, 600);
    expect(sim.world.usable(table)).toBe(false);
    expect(toasts(sim.drain()).some((t) => /broken down/.test(t))).toBe(true);
    run(sim, 2);
    expect(therapist.state).not.toBe('atPost');
    expect(sim.advice()).toMatch(/broken down/);

    const done = s.stats.healed + s.stats.failed;
    run(sim, 120);
    expect(s.stats.healed + s.stats.failed).toBe(done);

    hire(sim, 'caretaker');
    runUntil(sim, () => table.wear === 0, 300);
    expect(sim.world.usable(table)).toBe(true);
    runUntil(sim, () => therapist.state === 'atPost', 120);
  });

  it('gets serviced before it breaks when a janitor is on the payroll', () => {
    const { sim, s } = openCenter(1);
    hire(sim, 'caretaker');
    const table = s.items.find((i) => i.type === 'massage_table')!;
    table.wear = 60;
    runUntil(sim, () => table.wear === 0, 300);
  });
});

describe('morale and pay', () => {
  it('has underpaid staff ask for a raise, which a raise settles', () => {
    const { sim, therapist } = openCenter(1);
    const fair = sim.fairPay(therapist);
    therapist.salary = Math.round(fair * 0.8);
    sim.drain();
    runUntil(sim, () => therapist.raiseAsked, 300);
    expect(toasts(sim.drain()).some((t) => /wants a raise/.test(t))).toBe(true);
    expect(sim.advice()).toMatch(/wants a raise/);
    const before = therapist.morale;
    sim.giveRaise(therapist.id);
    expect(therapist.salary).toBeGreaterThanOrEqual(fair);
    expect(therapist.raiseAsked).toBe(false);
    expect(therapist.morale).toBeGreaterThan(before);
  });

  it('gives a 10% raise to someone already on the going rate', () => {
    const { sim, therapist } = openCenter(1);
    const fair = sim.fairPay(therapist);
    therapist.salary = fair;
    sim.giveRaise(therapist.id);
    expect(therapist.salary).toBe(Math.round((fair * 1.1) / 10) * 10);
  });

  it('keeps fairly paid, rested staff content', () => {
    const { sim, therapist } = openCenter(1);
    addStaffRoom(sim);
    run(sim, 400);
    expect(therapist.morale).toBeGreaterThan(50);
    expect(therapist.raiseAsked).toBe(false);
  });

  it('loses badly treated staff for good', () => {
    const { sim, s, therapist } = openCenter(1);
    therapist.salary = Math.round(sim.fairPay(therapist) * 0.4);
    therapist.morale = 10;
    const rep = s.reputation;
    sim.drain();
    runUntil(sim, () => !s.staff.includes(therapist), 400);
    const said = toasts(sim.drain());
    expect(said.some((t) => /thinking of quitting/.test(t))).toBe(true);
    expect(said.some((t) => /has quit/.test(t))).toBe(true);
    expect(s.reputation).toBeLessThan(rep + 5);
  });
});

describe('loans', () => {
  it('lend up to the limit and charge monthly interest', () => {
    const { sim, s } = openCenter(1);
    const before = s.money;
    for (let i = 0; i < LOAN_MAX / LOAN_STEP; i++) expect(sim.borrow()).toBe(true);
    expect(sim.borrow()).toBe(false);
    expect(s.loan).toBe(LOAN_MAX);
    expect(s.money).toBe(before + LOAN_MAX);
    s.day = 29.99;
    run(sim, 1);
    expect(s.lastLedger.interest).toBe(LOAN_MAX * LOAN_RATE);
  });

  it('can be repaid, but only with money you have', () => {
    const { sim, s } = openCenter(1);
    sim.borrow();
    sim.borrow();
    expect(sim.repay()).toBe(true);
    expect(s.loan).toBe(LOAN_STEP);
    s.money = 1200;
    expect(sim.repay()).toBe(true);
    expect(s.loan).toBe(LOAN_STEP - 1200);
    expect(s.money).toBe(0);
    expect(sim.repay()).toBe(false);
  });
});

describe('prices', () => {
  it('stay within their limits', () => {
    const { sim, s } = openCenter(1);
    sim.setPrice(9);
    expect(s.priceLevel).toBe(PRICE_MAX);
    sim.setPrice(0);
    expect(s.priceLevel).toBe(PRICE_MIN);
    sim.setPrice(1.2000001);
    expect(s.priceLevel).toBe(1.2);
  });

  it('scale what guests are charged', () => {
    const { sim, s } = openCenter(1);
    sim.setPrice(1.5);
    runUntil(sim, () => s.ledger.consult > 0, 300);
    expect(s.ledger.consult % (CONSULT_FEE * 1.5)).toBe(0);
  });

  it('drive some guests away when they are steep', () => {
    const walkouts = (price: number) => {
      const { sim, s } = openCenter(21);
      sim.setPrice(price);
      sim.drain();
      run(sim, 900);
      return toasts(sim.drain()).filter((t) => /balked at your prices/.test(t)).length + s.guests.filter((g) => g.bubble === '💸').length;
    };
    expect(walkouts(1)).toBe(0);
    expect(walkouts(2)).toBeGreaterThan(0);
  });
});

describe('the Posture Lab', () => {
  it('takes guests the consultant was unsure about, and charges for the scan', () => {
    const { sim, s, consultant } = openCenter(1);
    consultant.skill = 1;
    addPostureLab(sim);
    hire(sim, 'consultant');
    const scanner = s.items.find((i) => i.type === 'posture_scanner')!;
    let sentForScan = false;
    runUntil(sim, () => {
      sentForScan ||= s.guests.some((g) => g.goal === 'assess');
      return scanner.wear > 0;
    }, 900);
    expect(sentForScan).toBe(true);
    const fees = s.ledger.consult + s.lastLedger.consult;
    expect((fees - ASSESS_FEE) % 50).toBe(0);
  });

  it('is skipped when there is not one', () => {
    const { sim, s, consultant } = openCenter(1);
    consultant.skill = 1;
    let sentForScan = false;
    for (let i = 0; i < 400; i++) {
      run(sim, 1);
      sentForScan ||= s.guests.some((g) => g.goal === 'assess');
    }
    expect(sentForScan).toBe(false);
  });

  it('sends guests back to the consultant if the lab is demolished', () => {
    const { sim, s } = openCenter(1);
    const lab = addPostureLab(sim);
    runUntil(sim, () => s.guests.length > 0, 120);
    const g = s.guests[0];
    Object.assign(g, { goal: 'assess', state: 'waiting', station: 0, timer: 0, path: null, dest: null });
    sim.removeRoom(lab.id, 0);
    run(sim, 2);
    expect(g.goal).toBe('consult');
  });
});

describe('emergencies', () => {
  it('are offered only for conditions the staff can treat', () => {
    const { sim, s, therapist } = openCenter(1);
    s.stars = 2;
    therapist.quals = ['swedish'];
    for (let i = 0; i < 20; i++) {
      expect(sim.offerEmergency()).toBe(true);
      expect(CONDITION_BY_ID[s.offer!.condition].modality).toBe('swedish');
      expect(s.offer!.target).toBeLessThanOrEqual(s.offer!.total);
      expect(s.offer!.reward).toBeGreaterThan(0);
      sim.declineEmergency();
    }
    expect(s.nextEmergency).toBeGreaterThan(s.day);
  });

  it('turn up unprompted once the center has a star, and lapse if ignored', () => {
    const { sim, s } = openCenter(1);
    s.nextEmergency = 0;
    run(sim, 3);
    expect(s.offer).toBeNull();
    s.stars = 1;
    run(sim, 3);
    expect(s.offer).not.toBeNull();
    expect(sim.advice()).toMatch(/emergency/);
    s.offer!.deadline = s.day;
    run(sim, 2);
    expect(s.offer).toBeNull();
    expect(s.emergency).toBeNull();
  });

  it('bring a batch of pre-diagnosed guests and pay out when enough are healed', () => {
    const { sim, s } = openCenter(1);
    s.stars = 1;
    sim.offerEmergency();
    const { total, target, reward, condition } = s.offer!;
    sim.acceptEmergency();
    expect(s.offer).toBeNull();
    run(sim, total + 2);
    const batch = s.guests.filter((g) => g.emergency);
    expect(batch).toHaveLength(total);
    expect(batch.every((g) => g.condition === condition && g.diagnosis === 1 && g.goal !== 'reception')).toBe(true);

    const before = s.money;
    const rep = s.reputation;
    s.emergency!.healed = target;
    sim.drain();
    run(sim, 2);
    expect(s.emergency).toBeNull();
    expect(s.money).toBeGreaterThanOrEqual(before + reward);
    expect(s.ledger.bonus).toBe(reward);
    expect(s.reputation).toBeGreaterThan(rep);
    expect(toasts(sim.drain()).some((t) => /Emergency handled/.test(t))).toBe(true);
    expect(s.guests.some((g) => g.emergency)).toBe(false);
  });

  it('cost reputation when the deadline passes with too few healed', () => {
    const { sim, s } = openCenter(1);
    s.stars = 1;
    sim.offerEmergency();
    sim.acceptEmergency();
    run(sim, 3);
    const rep = s.reputation;
    s.emergency!.deadline = s.day;
    sim.drain();
    run(sim, 2);
    expect(s.emergency).toBeNull();
    expect(s.reputation).toBeLessThan(rep);
    expect(toasts(sim.drain()).some((t) => /Emergency failed/.test(t))).toBe(true);
  });

  it('count real heals toward the target', () => {
    const { sim, s } = openCenter(8);
    s.stars = 1;
    sim.offerEmergency();
    sim.acceptEmergency();
    const e = s.emergency!;
    runUntil(sim, () => e.healed > 0 || s.emergency === null, 900);
    expect(e.healed).toBeGreaterThan(0);
  });
});

describe('moving items', () => {
  it('moves an item for free and rejects bad spots', () => {
    const { sim, s } = openCenter(1);
    const bench = sim.placeItem('bench', 18, 12, 0)!;
    const money = s.money;
    expect(sim.moveItem(bench.id, 20, 14, 1)).toBe(true);
    expect([bench.x, bench.y, bench.rot]).toEqual([20, 14, 1]);
    expect(s.money).toBe(money);
    expect(sim.moveItem(bench.id, 14, 13, 0)).toBe(false);
    expect(sim.moveItem(bench.id, 1, 1, 0)).toBe(false);
    expect([bench.x, bench.y]).toEqual([20, 14]);
    // it may be put back down overlapping where it was
    expect(sim.moveItem(bench.id, 20, 15, 1)).toBe(true);
  });

  it('keeps room furniture inside its room', () => {
    const { sim, s } = openCenter(1);
    const desk = s.items.find((i) => i.type === 'consult_desk')!;
    expect(sim.moveItem(desk.id, 16, 12, 0)).toBe(false);
    expect(sim.moveItem(desk.id, 6, 7, 0)).toBe(true);
  });

  it('sends anyone who was using it to find their place again', () => {
    const { sim, s, consultant } = openCenter(1);
    runUntil(sim, () => consultant.state === 'atPost', 120);
    const desk = s.items.find((i) => i.type === 'consult_desk')!;
    sim.moveItem(desk.id, 6, 7, 0);
    expect(consultant.state).not.toBe('atPost');
    runUntil(sim, () => consultant.state === 'atPost', 120);
    expect(desk.staffId).toBe(consultant.id);
  });
});

describe('a long session', () => {
  it.each([1, 2, 3])('stays healthy for an hour of play (seed %i)', (seed) => {
    const { sim, s, therapist } = openCenter(seed);
    addStaffRoom(sim);
    addRestroom(sim);
    addTraining(sim);
    addPostureLab(sim);
    hire(sim, 'caretaker');
    hire(sim, 'consultant');
    for (const [type, x, y] of [['bench', 10, 9], ['bench', 16, 9], ['tea_station', 10, 13], ['snack_machine', 12, 13], ['plant', 4, 4], ['bin', 22, 10], ['fountain', 12, 11], ['magazine_rack', 9, 10], ['rug', 24, 12]] as const)
      expect(sim.placeItem(type, x, y, 0), `${type}`).not.toBeNull();
    s.stars = 2;
    sim.placeItem('stretch_rack', 14, 7, 0);
    sim.placeItem('stone_warmer', 14, 6, 0);
    therapist.quals = ['swedish', 'deep', 'sports', 'stone', 'cranio'];

    for (let minute = 0; minute < 60; minute++) {
      if (s.offer) sim.acceptEmergency();
      for (const st of s.staff) if (st.raiseAsked) sim.giveRaise(st.id);
      run(sim, 60);
      expect(Number.isFinite(s.money) && Number.isFinite(s.reputation)).toBe(true);
      expect(s.reputation).toBeGreaterThanOrEqual(0);
      expect(s.reputation).toBeLessThanOrEqual(100);
      expect(s.guests.length).toBeLessThan(60);
      for (const c of [...s.guests, ...s.staff]) {
        expect(Number.isFinite(c.x + c.y + c.facing), `${c.name}`).toBe(true);
        if (c.kind === 'staff') expect(c.morale >= 0 && c.morale <= 100 && c.energy >= 0 && c.energy <= 100).toBe(true);
        else expect(c.patience).toBeLessThanOrEqual(100);
      }
      for (const item of s.items) {
        expect(item.wear).toBeLessThanOrEqual(100);
        for (const u of item.users) if (u) expect(sim.char(u), 'seat holder exists').toBeDefined();
        for (const id of item.queue) expect(sim.guest(id), 'queued guest exists').toBeDefined();
        if (item.staffId) expect(sim.staff(item.staffId)?.post).toBe(item.id);
      }
    }
    expect(s.stats.healed).toBeGreaterThan(40);
    expect(s.stats.healed).toBeGreaterThan(s.stats.stormed);
    sim.drain();
  });
});
