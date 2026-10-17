// The simulation's functions, tested one at a time on a context of their own.
import { beforeEach, describe, expect, it } from 'vitest';

import { createRefresh, REFRESH_EVERY } from '../../src/app/refresh';
import {
  H,
  ITEMS,
  LOAN_MAX,
  LOAN_STEP,
  LOT_W,
  MODALITIES,
  PRICE_MAX,
  PRICE_MIN,
  SANDBOX_PLOT,
  SIDEWALK_Y,
} from '../../src/core/data';
import { footprintOf } from '../../src/core/footprint';
import { fairSalary } from '../../src/core/people';
import { setSeed } from '../../src/core/random';
import { stationPlace } from '../../src/core/sim/advisor';
import { decorOf, drainFactor, prestige, updateAmbience } from '../../src/core/sim/ambience';
import { createRoom, finishRoom, itemsInRoom, placeItem, usersOf } from '../../src/core/sim/building';
import {
  charById,
  guestById,
  lobbyTile,
  say,
  staffById,
  STREET_WALK,
  streetEnds,
  streetTile,
} from '../../src/core/sim/chars';
import { accessIndex, claim, findAccess, release } from '../../src/core/sim/claims';
import { createContext, type SimContext } from '../../src/core/sim/context';
import { borrow, changeRep, earn, repay, setPrice, spend } from '../../src/core/sim/economy';
import { drainEvents, tipOnce, toast } from '../../src/core/sim/events';
import { rollCondition, spawnGuest } from '../../src/core/sim/guests';
import { goTo, halt, moveAlong, turnToward } from '../../src/core/sim/movement';
import { hasItem, hasRoom, hasStaff, objectives } from '../../src/core/sim/progress';
import { fairPay, hire, raiseTo } from '../../src/core/sim/staffing';
import { serviceSeconds } from '../../src/core/sim/stations';
import { equipmentProblem, modalityOf, offered, unlocked } from '../../src/core/sim/treatments';
import { newGame } from '../../src/core/state/game';
import type { Item, Staff } from '../../src/core/state/types';
import { keepNearMap, MAX_DIST, MIN_DIST, tilesPerPixel, zoomedDist } from '../../src/render/camera-math';
import { LAYOUT } from './helpers';

let ctx: SimContext;
beforeEach(() => {
  setSeed(11);
  ctx = createContext(newGame());
});

/** Put an item down for free, failing the test if it does not fit. */
function put(type: Parameters<typeof placeItem>[1], x: number, y: number, roomId?: number): Item {
  const item = placeItem(ctx, type, x, y, 0, roomId === undefined ? { free: true } : { free: true, roomId });
  if (!item) throw new Error(`could not place ${type}`);
  return item;
}

/** Hire the first applicant for a role. */
function recruit(role: Staff['role']): Staff {
  const staff = hire(ctx, ctx.s.candidates.find((c) => c.role === role)!.id);
  if (!staff) throw new Error(`could not hire a ${role}`);
  return staff;
}

/** Build a finished Massage Suite with its table and trolley. */
function massageSuite() {
  const room = createRoom(ctx, 'massage', LAYOUT.massage.rect, LAYOUT.massage.door);
  const table = put('massage_table', 12, 5, room.id);
  put('oil_trolley', 14, 5, room.id);
  finishRoom(ctx, room);
  return { room, table };
}

describe('events', () => {
  it('queues what happens and hands it over once', () => {
    toast(ctx, 'Hello', 'good');
    expect(drainEvents(ctx)).toEqual([{ type: 'toast', text: 'Hello', kind: 'good' }]);
    expect(drainEvents(ctx)).toEqual([]);
  });

  it('gives each tip only once per game', () => {
    tipOnce(ctx, 'tired', 'Staff are tired.');
    tipOnce(ctx, 'tired', 'Staff are tired.');
    expect(drainEvents(ctx)).toHaveLength(1);
    expect(ctx.s.seenTips).toEqual(['tired']);
  });
});

describe('money and reputation', () => {
  it('books income to the bank and the ledger, with a cash sound for big sums', () => {
    const before = ctx.s.money;
    earn(ctx, 25, 'vending', 1, 1);
    earn(ctx, 900, 'treatment', 1, 1);
    expect(ctx.s.money).toBe(before + 925);
    expect(ctx.s.ledger).toMatchObject({ vending: 25, treatment: 900 });
    expect(drainEvents(ctx).filter((e) => e.type === 'sfx')).toEqual([{ type: 'sfx', name: 'cash' }]);
  });

  it('books spending the same way', () => {
    const before = ctx.s.money;
    spend(ctx, 400, 'training');
    expect(ctx.s.money).toBe(before - 400);
    expect(ctx.s.ledger.training).toBe(400);
  });

  it('makes reputation harder to gain the higher it is, and keeps it between 0 and 100', () => {
    ctx.s.reputation = 20;
    changeRep(ctx, 10);
    const lowGain = ctx.s.reputation - 20;
    ctx.s.reputation = 90;
    changeRep(ctx, 10);
    expect(ctx.s.reputation - 90).toBeLessThan(lowGain);
    changeRep(ctx, 500);
    expect(ctx.s.reputation).toBe(100);
    changeRep(ctx, -500);
    expect(ctx.s.reputation).toBe(0);
  });

  it('takes losses at face value', () => {
    ctx.s.reputation = 90;
    changeRep(ctx, -3);
    expect(ctx.s.reputation).toBe(87);
  });

  it('lends in steps up to the limit and no further', () => {
    const before = ctx.s.money;
    for (let i = 0; i < LOAN_MAX / LOAN_STEP; i++) expect(borrow(ctx)).toBe(true);
    expect(borrow(ctx)).toBe(false);
    expect(ctx.s.loan).toBe(LOAN_MAX);
    expect(ctx.s.money).toBe(before + LOAN_MAX);
  });

  it('repays only what there is to repay and money to repay it with', () => {
    expect(repay(ctx)).toBe(false);
    borrow(ctx);
    ctx.s.money = 1200;
    expect(repay(ctx)).toBe(true);
    expect(ctx.s.loan).toBe(LOAN_STEP - 1200);
    expect(ctx.s.money).toBe(0);
    expect(repay(ctx)).toBe(false);
  });

  it('keeps prices within bounds, in steps of ten percent', () => {
    setPrice(ctx, 1.26);
    expect(ctx.s.priceLevel).toBe(1.3);
    setPrice(ctx, 99);
    expect(ctx.s.priceLevel).toBe(PRICE_MAX);
    setPrice(ctx, 0);
    expect(ctx.s.priceLevel).toBe(PRICE_MIN);
  });
});

describe('pay', () => {
  it('prices a member of staff at the going rate for their role, skill, quirks and training', () => {
    const st = recruit('therapist');
    expect(fairPay(st)).toBe(fairSalary(st.role, st.skill, st.traits, st.quals));
  });

  it('raises to the going rate, or by ten percent for someone already paid it', () => {
    const st = recruit('therapist');
    st.salary = 100;
    expect(raiseTo(st)).toBe(fairPay(st));
    st.salary = fairPay(st) + 500;
    expect(raiseTo(st)).toBe(Math.round((st.salary * 1.1) / 10) * 10);
  });
});

describe('how long a service takes', () => {
  /** A member of staff with nothing unusual about them. */
  const plain = (): Staff => ({ ...recruit('consultant'), skill: 3, traits: [], energy: 100, morale: 50 });

  it('is shorter for the skilled and the content', () => {
    const base = serviceSeconds(10, plain());
    expect(serviceSeconds(10, { ...plain(), skill: 5 })).toBeLessThan(base);
    expect(serviceSeconds(10, { ...plain(), morale: 100 })).toBeLessThan(base);
  });

  it('is longer for the exhausted', () => {
    expect(serviceSeconds(10, { ...plain(), energy: 5 })).toBeGreaterThan(serviceSeconds(10, plain()));
  });

  it('follows their quirks', () => {
    const base = serviceSeconds(10, plain());
    expect(serviceSeconds(10, { ...plain(), traits: ['brisk'] })).toBeLessThan(base);
    expect(serviceSeconds(10, { ...plain(), traits: ['chatty'] })).toBeGreaterThan(base);
  });

  it('scales with the length of the service', () => {
    expect(serviceSeconds(20, plain())).toBeCloseTo(serviceSeconds(10, plain()) * 2);
  });
});

describe('surroundings', () => {
  it('counts a healthy plant as decor and a wilted one against the room', () => {
    const plant = put('plant', 10, 12);
    expect(decorOf(plant)).toBe(ITEMS.plant.decor);
    plant.water = 10;
    expect(decorOf(plant)).toBe(-1);
    expect(decorOf(put('bin', 12, 12))).toBe(ITEMS.bin.decor ?? 0);
  });

  it('drains patience more slowly near decor and faster near litter', () => {
    updateAmbience(ctx);
    const plain = drainFactor(ctx, 10, 12);
    put('statue', 10, 12);
    updateAmbience(ctx);
    expect(drainFactor(ctx, 11, 12)).toBeLessThan(plain);
    ctx.s.litter.push({ id: 999, x: 22, y: 12, claimedBy: 0 });
    updateAmbience(ctx);
    expect(drainFactor(ctx, 22, 12)).toBeGreaterThan(plain);
  });

  it('treats anywhere off the map as plain', () => {
    expect(drainFactor(ctx, -5, -5)).toBeCloseTo(1.12);
  });

  it('rates a room higher with windows, up to five stars', () => {
    const { room } = massageSuite();
    const bare = prestige(ctx, room);
    room.windows.push({ x: 11, y: 5, dx: -1, dy: 0 }, { x: 11, y: 6, dx: -1, dy: 0 }, { x: 11, y: 7, dx: -1, dy: 0 });
    expect(prestige(ctx, room)).toBeGreaterThan(bare);
    expect(prestige(ctx, room)).toBeLessThanOrEqual(5);
  });
});

describe('walking', () => {
  it('turns the short way round, and no faster than allowed', () => {
    expect(turnToward(0, 1, 0.25)).toBeCloseTo(0.25);
    expect(turnToward(0, 0.1, 0.25)).toBeCloseTo(0.1);
    // from just below a half turn to just above it is a small step, not nearly a full circle
    expect(turnToward(3, -3, 1)).toBeCloseTo(3 + (Math.PI * 2 - 6));
  });

  it('walks someone along their path and says when they arrive', () => {
    const st = recruit('caretaker');
    expect(goTo(ctx, st, SANDBOX_PLOT.door[0], 15)).toBe(true);
    expect(st.pose).toBe('walk');
    let arrived = false;
    for (let i = 0; i < 2000 && !arrived; i++) arrived = moveAlong(st, 0.05, 2);
    expect(arrived).toBe(true);
    expect([st.tx, st.ty, st.pose, st.path]).toEqual([SANDBOX_PLOT.door[0], 15, 'stand', null]);
    expect(moveAlong(st, 0.05, 2)).toBe(false);
  });

  it('refuses a walk to somewhere that cannot be reached', () => {
    const st = recruit('caretaker');
    expect(goTo(ctx, st, 0, 0)).toBe(false);
  });

  it('stops someone where they stand', () => {
    const st = recruit('caretaker');
    goTo(ctx, st, SANDBOX_PLOT.door[0], 15);
    halt(st);
    expect([st.path, st.dest, st.pose, st.busy]).toEqual([null, null, 'stand', false]);
  });
});

describe('people', () => {
  it('finds guests and staff by id, and nobody for zero', () => {
    const st = recruit('receptionist');
    spawnGuest(ctx);
    const g = ctx.s.guests[0]!;
    expect(staffById(ctx, st.id)).toBe(st);
    expect(guestById(ctx, g.id)).toBe(g);
    expect(charById(ctx, g.id)).toBe(g);
    expect(charById(ctx, st.id)).toBe(st);
    expect(guestById(ctx, st.id)).toBeUndefined();
    expect(charById(ctx, 0)).toBeUndefined();
  });

  it('brings people in a set walk along the sidewalk from the door, either way, and sends them to the lobby', () => {
    const building = footprintOf(SANDBOX_PLOT);
    const [d0, d1] = SANDBOX_PLOT.door;
    expect(streetEnds(building)).toEqual([d0 - STREET_WALK, d1 + STREET_WALK]);
    // the same walk wherever the door is, however wide the lot
    const moved = footprintOf({ ...SANDBOX_PLOT, door: [d0 + 3, d1 + 3] });
    expect(streetEnds(moved)).toEqual([d0 + 3 - STREET_WALK, d1 + 3 + STREET_WALK]);
    for (let i = 0; i < 20; i++) {
      const [x, y] = streetTile(building);
      expect(streetEnds(building)).toContain(x);
      expect(y).toBe(SIDEWALK_Y);
      expect(SANDBOX_PLOT.door).toContain(lobbyTile(building)[0]);
    }
  });

  // at the Orchard the end of the pavement lay between the main building and the orangery, so anyone walking from one
  // to the other shrank away there and grew back
  it('puts the ends of the sidewalk past a building standing apart, as far as the edge of the lot', () => {
    const [d0, d1] = SANDBOX_PLOT.door;
    const east = { side: 'south' as const, x: d1 + 20, y: SANDBOX_PLOT.y1 };
    const west = { side: 'south' as const, x: d0 - 18, y: SANDBOX_PLOT.y1 };
    const apart = footprintOf(SANDBOX_PLOT, [], { entrances: [east] });
    expect(streetEnds(apart, 100)).toEqual([d0 - STREET_WALK, east.x + STREET_WALK]);
    expect(streetEnds(apart, d1 + 25)).toEqual([d0 - STREET_WALK, d1 + 24]);
    const both = footprintOf(SANDBOX_PLOT, [], { entrances: [west, east] });
    expect(streetEnds(both, 100)[0]).toBe(Math.max(0, west.x - STREET_WALK));
    // one within the usual walk moves nothing
    const near = footprintOf(SANDBOX_PLOT, [], { entrances: [{ ...east, x: d1 + 2 }] });
    expect(streetEnds(near, 100)[1]).toBe(Math.max(d1 + STREET_WALK, d1 + 2 + STREET_WALK));
  });

  it('shows a speech bubble for a while', () => {
    const st = recruit('receptionist');
    say(st, '💰', 5);
    expect([st.bubble, st.bubbleT]).toEqual(['💰', 5]);
  });
});

describe('seats and facilities', () => {
  it('finds the nearest free spot of a kind, and none once it is taken', () => {
    const near = put('bench', 10, 12);
    const far = put('bench', 20, 12);
    expect(findAccess(ctx, 'seat', 10, 13)?.item).toBe(near);
    expect(findAccess(ctx, 'seat', 20, 13)?.item).toBe(far);
    expect(findAccess(ctx, 'toilet', 10, 13)).toBeNull();
    // too far away to bother with
    expect(findAccess(ctx, 'seat', 15, 4, 2)).toBeNull();
  });

  it('holds a spot for one person at a time', () => {
    const bench = put('bench', 10, 12);
    const seats = ITEMS.bench.access.length;
    const st = recruit('receptionist');
    for (let i = 0; i < seats; i++) {
      const spot = findAccess(ctx, 'seat', 10, 13)!;
      spot.item.users[spot.idx] = 1000 + i;
    }
    expect(findAccess(ctx, 'seat', 10, 13)).toBeNull();
    bench.users[0] = 0;
    claim(ctx, st, bench, 0);
    expect([bench.users[0], st.claimItem]).toEqual([st.id, bench.id]);
    release(ctx, st);
    expect([bench.users[0], st.claimItem]).toEqual([0, 0]);
  });

  it('knows which spot on an item is for whom', () => {
    const { table } = massageSuite();
    const staffSpot = accessIndex(table, 'staff');
    const guestSpot = accessIndex(table, 'guest');
    expect(staffSpot).not.toBe(guestSpot);
    expect(accessIndex(table, 'toilet')).toBe(-1);
  });
});

describe('treatments', () => {
  it('unlocks modalities with stars and offers a discipline once its room is built', () => {
    expect(unlocked(ctx, 'swedish')).toBe(true);
    expect(unlocked(ctx, 'stone')).toBe(ctx.s.stars >= MODALITIES.stone.star);
    ctx.s.stars = 3;
    expect(unlocked(ctx, 'stone')).toBe(true);
    expect(offered(ctx, 'massage')).toBe(false);
    massageSuite();
    expect(offered(ctx, 'massage')).toBe(true);
  });

  it('never offers a discipline that is switched off', () => {
    ctx.s.stars = 3;
    ctx.s.options.acupuncture = false;
    expect(unlocked(ctx, 'needling')).toBe(false);
    expect(offered(ctx, 'acupuncture')).toBe(false);
  });

  it('matches a guest to the modality that treats their condition', () => {
    spawnGuest(ctx, 'knotted');
    expect(modalityOf(ctx.s.guests[0]!).id).toBe('deep');
  });

  it('needs the right equipment in the room, and hot stones to be hot', () => {
    const { table, room } = massageSuite();
    expect(equipmentProblem(ctx, table, MODALITIES.swedish)).toBe('');
    expect(equipmentProblem(ctx, table, MODALITIES.stone)).toBe('no-equipment');
    const warmer = put('stone_warmer', 12, 7, room.id);
    expect(equipmentProblem(ctx, table, MODALITIES.stone)).toBe('');
    warmer.water = 0;
    expect(equipmentProblem(ctx, table, MODALITIES.stone)).toBe('cold');
  });

  it('only sends guests with conditions the center could treat', () => {
    massageSuite();
    for (let i = 0; i < 40; i++)
      expect(MODALITIES[modalityOf({ condition: rollCondition(ctx) } as never).id].star).toBe(0);
  });
});

describe('what the center has', () => {
  it('counts items, finished rooms and staff who are staying', () => {
    expect([hasItem(ctx, 'bench'), hasRoom(ctx, 'massage'), hasStaff(ctx, 'therapist')]).toEqual([false, false, false]);
    put('bench', 10, 12);
    const room = createRoom(ctx, 'massage', LAYOUT.massage.rect, LAYOUT.massage.door);
    expect(hasRoom(ctx, 'massage')).toBe(false);
    put('massage_table', 12, 5, room.id);
    put('oil_trolley', 14, 5, room.id);
    finishRoom(ctx, room);
    const st = recruit('therapist');
    expect([hasItem(ctx, 'bench'), hasRoom(ctx, 'massage'), hasStaff(ctx, 'therapist')]).toEqual([true, true, true]);
    st.state = 'leaving';
    expect(hasStaff(ctx, 'therapist')).toBe(false);
  });

  it('lists the furniture in a room and who is using an item', () => {
    const { room, table } = massageSuite();
    expect(
      itemsInRoom(ctx, room)
        .map((i) => i.type)
        .sort(),
    ).toEqual(['massage_table', 'oil_trolley']);
    const st = recruit('therapist');
    st.post = table.id;
    expect(usersOf(ctx, new Set([table.id])).staff).toEqual([st]);
    expect(usersOf(ctx, new Set([12345])).staff).toEqual([]);
  });

  it('names a station by its room, or by itself when it stands in a corridor', () => {
    const { table } = massageSuite();
    expect(stationPlace(table)).toBe('Massage Suite');
    expect(stationPlace(put('reception_desk', 13, 14))).toBe('Reception Desk');
  });

  it('sets out what the next star needs, with progress toward each goal', () => {
    const goals = objectives(ctx);
    expect(goals.length).toBeGreaterThanOrEqual(2);
    expect(goals.every((g) => !g.done && g.progress >= 0)).toBe(true);
    ctx.s.stats.healed = 9999;
    expect(objectives(ctx)[0]!.done).toBe(true);
  });
});

describe('when the interface redraws', () => {
  it('redraws on the first frame, then a few times a second', () => {
    const refresh = createRefresh();
    expect(refresh.due(0.016)).toBe(true);
    expect(refresh.due(0.016)).toBe(false);
    expect(refresh.due(REFRESH_EVERY)).toBe(true);
    expect(refresh.due(0.016)).toBe(false);
  });

  it('redraws at once when asked', () => {
    const refresh = createRefresh();
    refresh.due(0.016);
    refresh.request();
    expect(refresh.due(0.001)).toBe(true);
    expect(refresh.due(0.001)).toBe(false);
  });
});

describe('camera arithmetic', () => {
  it('zooms by a fraction and stops at the limits', () => {
    expect(zoomedDist(40, 0.1)).toBeCloseTo(44);
    expect(zoomedDist(40, -0.1)).toBeCloseTo(36);
    expect(zoomedDist(77, 0.5)).toBe(MAX_DIST);
    expect(zoomedDist(17, -0.5)).toBe(MIN_DIST);
  });

  it('lets the camera look a little past the edge of the map and no further', () => {
    expect(keepNearMap(10, 10)).toEqual([10, 10]);
    expect(keepNearMap(-50, 500)).toEqual([-2, H + 2]);
    expect(keepNearMap(500, -50)).toEqual([LOT_W + 2, -2]);
    expect(keepNearMap(500, -50, 44)).toEqual([44 + 2, -2]);
  });

  it('covers more ground per pixel the farther out the camera is and the shorter the window', () => {
    const near = tilesPerPixel(20, 30, 900);
    expect(tilesPerPixel(40, 30, 900)).toBeCloseTo(near * 2);
    expect(tilesPerPixel(20, 30, 450)).toBeCloseTo(near * 2);
  });
});
