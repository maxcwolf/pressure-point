// The items added after the first releases: what each one does, and when each one unlocks.
import { beforeEach, describe, expect, it } from 'vitest';

import {
  BOOKCASE_MAX,
  BOOKCASE_SPEEDUP,
  COFFEE_BREAK_BOOST,
  ITEM_MENU,
  ITEMS,
  type ItemType,
  PLAY_PATIENCE,
  POOL_TABLE_MORALE,
  type RoomType,
} from '../../src/core/data';
import { setSeed } from '../../src/core/random';
import { createRoom, finishRoom, placeItem } from '../../src/core/sim/building';
import { createContext, type SimContext } from '../../src/core/sim/context';
import { needNow } from '../../src/core/sim/guests';
import { breakBoost, courseSpeed, hire, moraleTarget, trainingSpeed } from '../../src/core/sim/staffing';
import { newGame } from '../../src/core/state/game';
import type { Guest, Item, Room, Staff } from '../../src/core/state/types';
import { openCenter, run, runUntil } from './helpers';

const NEW_ITEMS: ItemType[] = [
  'water_cooler',
  'fire_extinguisher',
  'arcade_machine',
  'bookcase',
  'coffee_machine',
  'aquarium',
  'pool_table',
  'trophy_cabinet',
];

let ctx: SimContext;
beforeEach(() => {
  setSeed(3);
  ctx = createContext(newGame());
  ctx.s.money = 100_000;
});

/** Put an item down for free at the first tile and turn that takes it, inside a room or in the corridor. */
function placeSomewhere(type: ItemType, area: { x: number; y: number; w: number; h: number }, roomId?: number): Item {
  for (let y = area.y; y < area.y + area.h; y++)
    for (let x = area.x; x < area.x + area.w; x++)
      for (let rot = 0; rot < 4; rot++) {
        const opts = roomId === undefined ? { free: true } : { free: true, roomId };
        const item = placeItem(ctx, type, x, y, rot, opts);
        if (item) return item;
      }
  throw new Error(`nowhere to put a ${type}`);
}

/** A finished room of a type, with its required furniture, somewhere roomy. */
function roomOf(type: RoomType, rect = { x: 5, y: 5, w: 5, h: 4 }, door = { x: 9, y: 7, dx: 1, dy: 0 }): Room {
  const room = createRoom(ctx, type, rect, door);
  for (const req of [
    ...(type === 'staffroom' ? (['sofa'] as const) : []),
    ...(type === 'training' ? (['whiteboard', 'study_desk'] as const) : []),
  ])
    placeSomewhere(req, rect, room.id);
  finishRoom(ctx, room);
  return room;
}

/** Hire the first applicant for a role. */
function recruit(role: Staff['role']): Staff {
  const st = hire(ctx, ctx.s.candidates.find((c) => c.role === role)!.id);
  if (!st) throw new Error(`could not hire a ${role}`);
  return st;
}

describe('the new items', () => {
  it('are all in the Items menu', () => {
    for (const type of NEW_ITEMS) expect(ITEM_MENU).toContain(type);
  });

  it('hold the bigger ones back until later stars', () => {
    const unlockAt = Object.fromEntries(NEW_ITEMS.map((t) => [t, ITEMS[t].unlock ?? 0]));
    expect(unlockAt).toEqual({
      water_cooler: 0,
      fire_extinguisher: 0,
      arcade_machine: 1,
      bookcase: 1,
      coffee_machine: 1,
      aquarium: 2,
      pool_table: 2,
      trophy_cabinet: 3,
    });
  });

  it('each fit where they belong', () => {
    const corridor = { x: 12, y: 12, w: 8, h: 4 };
    for (const type of NEW_ITEMS) {
      const where = ITEMS[type].where;
      if (where === 'corridor' || where === 'any') placeSomewhere(type, corridor);
      else {
        const room = roomOf(where);
        placeSomewhere(type, room, room.id);
        ctx.s.rooms = [];
        ctx.s.items = [];
        ctx.world.rebuild();
      }
    }
  });
});

describe('the water cooler', () => {
  it('quenches thirst for free, and wears with use', () => {
    const { sim, s } = openCenter(5);
    const cooler = sim.placeItem('water_cooler', 18, 13, 0)!;
    runUntil(sim, () => s.guests.some((g) => g.state === 'waiting'), 300);
    for (const g of s.guests) g.thirst = 100;
    runUntil(sim, () => cooler.wear > 0, 120);
    expect(cooler.wear).toBeGreaterThan(0);
    expect(s.ledger.vending).toBe(0);
  });
});

describe('the arcade', () => {
  /** A guest with every need at a level, and some patience. */
  const guest = (need: number, patience: number) => ({ bladder: need, thirst: need, hunger: need, patience }) as Guest;

  it('is what a bored guest wants once their other needs are seen to', () => {
    expect(needNow(guest(0, 100))).toBe('');
    expect(needNow(guest(0, 40))).toBe('play');
    expect(needNow({ ...guest(0, 40), thirst: 90 })).toBe('drink');
    expect(needNow({ ...guest(0, 40), bladder: 90, thirst: 90 })).toBe('toilet');
  });

  it('cheers up bored guests waiting nearby, and takes their coins', () => {
    const { sim, s } = openCenter(5);
    s.stars = 1;
    const arcade = sim.placeItem('arcade_machine', 18, 13, 0)!;
    runUntil(sim, () => s.guests.some((g) => g.state === 'waiting'), 300);
    const bored = s.guests.find((g) => g.state === 'waiting')!;
    bored.patience = 40;
    runUntil(sim, () => bored.needKind === 'play' && bored.state === 'need', 60);
    const before = bored.patience;
    runUntil(sim, () => bored.state !== 'need', 10);
    expect(bored.patience).toBeGreaterThan(before + PLAY_PATIENCE / 2);
    expect(arcade.wear).toBeGreaterThan(0);
    expect(s.ledger.vending).toBeGreaterThanOrEqual(ITEMS.arcade_machine.sale!);
  });
});

describe('the espresso machine', () => {
  it('speeds up breaks in its staff room', () => {
    const room = roomOf('staffroom');
    const sofa = ctx.s.items.find((i) => i.type === 'sofa')!;
    const st = recruit('therapist');
    st.claimItem = sofa.id;
    expect(breakBoost(ctx, st)).toBe(1);
    placeSomewhere('coffee_machine', room, room.id);
    expect(breakBoost(ctx, st)).toBe(COFFEE_BREAK_BOOST);
  });

  it('does nothing for someone resting somewhere else', () => {
    const room = roomOf('staffroom');
    placeSomewhere('coffee_machine', room, room.id);
    expect(breakBoost(ctx, recruit('therapist'))).toBe(1);
  });
});

describe('bookcases', () => {
  it('speed up courses by a fifth each, up to a limit', () => {
    expect([0, 1, 2, 3].map(trainingSpeed)).toEqual([
      1,
      1 + BOOKCASE_SPEEDUP,
      1 + 2 * BOOKCASE_SPEEDUP,
      1 + BOOKCASE_MAX * BOOKCASE_SPEEDUP,
    ]);
  });

  it('count only in the Training Room where the course is being taken', () => {
    const room = roomOf('training', { x: 5, y: 5, w: 6, h: 5 }, { x: 10, y: 7, dx: 1, dy: 0 });
    const desk = ctx.s.items.find((i) => i.type === 'study_desk')!;
    const st = recruit('therapist');
    st.claimItem = desk.id;
    expect(courseSpeed(ctx, st)).toBe(1);
    placeSomewhere('bookcase', room, room.id);
    expect(courseSpeed(ctx, st)).toBeCloseTo(1 + BOOKCASE_SPEEDUP);
    st.claimItem = 0;
    expect(courseSpeed(ctx, st)).toBe(1);
  });
});

describe('the pool table', () => {
  it('lifts the morale everyone settles toward', () => {
    const st = recruit('therapist');
    const without = moraleTarget(ctx, st);
    const room = roomOf('staffroom', { x: 5, y: 5, w: 5, h: 4 });
    placeSomewhere('pool_table', room, room.id);
    expect(moraleTarget(ctx, st)).toBeCloseTo(without + POOL_TABLE_MORALE);
  });

  it('shows over time in a running center', () => {
    const plain = openCenter(9);
    const fun = openCenter(9);
    for (const { sim } of [plain, fun]) {
      sim.s.stars = 2;
      const room = sim.createRoom('staffroom', { x: 17, y: 5, w: 4, h: 3 }, { x: 18, y: 7, dx: 0, dy: 1 });
      sim.placeItem('sofa', 17, 5, 0, { free: true, roomId: room.id });
      if (sim === fun.sim) sim.placeItem('pool_table', 19, 5, 0, { free: true, roomId: room.id });
      sim.finishRoom(room);
    }
    expect(fun.s.items.some((i) => i.type === 'pool_table')).toBe(true);
    run(plain.sim, 120);
    run(fun.sim, 120);
    expect(fun.therapist.morale).toBeGreaterThan(plain.therapist.morale);
  });
});
