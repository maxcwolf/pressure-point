// The items chosen on 16 October 2026: Soundproof Panels, Wind Chimes, the Fortune Teller, the Kombucha Tap and the
// Staff Fridge.
import { beforeEach, describe, expect, it } from 'vitest';

import {
  CHIMES_FADE,
  FIZZ_WEAR,
  ITEM_MENU,
  ITEMS,
  type ItemType,
  MISHAPS,
  PUDDLE_SLOW,
  VIBES_FADE,
} from '../../src/core/data';
import { setSeed } from '../../src/core/random';
import { createContext } from '../../src/core/sim/context';
import { fizzOver, inPuddle, puddleSlow, tellFortune } from '../../src/core/sim/novelties';
import { fadeVibes } from '../../src/core/sim/vibes';
import { newGame } from '../../src/core/state/game';
import type { Guest } from '../../src/core/state/types';
import { accessTile } from '../../src/core/world';
import { addStaffRoom, hire, inconsistencies, LAYOUT, openCenter, run, runUntil } from './helpers';

const CHOSEN: ItemType[] = ['soundproof_panel', 'wind_chimes', 'fortune_teller', 'kombucha_tap', 'staff_fridge'];

beforeEach(() => setSeed(7));

describe('the items chosen on 16 October 2026', () => {
  it('are all in the Items menu', () => {
    for (const type of CHOSEN) expect(ITEM_MENU).toContain(type);
  });

  it('open with the stars', () => {
    expect(Object.fromEntries(CHOSEN.map((t) => [t, ITEMS[t].unlock ?? 0]))).toEqual({
      soundproof_panel: 0,
      wind_chimes: 0,
      fortune_teller: 1,
      kombucha_tap: 2,
      staff_fridge: 1,
    });
  });

  it('stop in a power cut if they have a plug, and the tap draws the wasps', () => {
    expect(MISHAPS.power.stops).toEqual(expect.arrayContaining(['fortune_teller', 'staff_fridge']));
    expect(MISHAPS.power.stops).not.toContain('kombucha_tap');
    expect(MISHAPS.wasps.stops).toContain('kombucha_tap');
  });
});

describe('soundproof panels', () => {
  it('quiet the corridor around an arcade', () => {
    const { sim } = openCenter(1);
    sim.s.stars = 1;
    expect(sim.placeItem('arcade_machine', 13, 10, 0)).toBeTruthy();
    sim.refreshAmbience();
    const loud = sim.noiseAt(15, 10);
    expect(sim.placeItem('soundproof_panel', 14, 11, 0)).toBeTruthy();
    sim.refreshAmbience();
    expect(sim.noiseAt(15, 10)).toBeLessThan(loud);
  });
});

describe('wind chimes', () => {
  it('make bad vibes in their room fade four times as fast', () => {
    const { sim, s, massage } = openCenter(1);
    const ctx = createContext(s);
    massage.vibes = 60;
    fadeVibes(ctx, 10);
    expect(massage.vibes).toBeCloseTo(60 - VIBES_FADE * 10);
    expect(sim.placeItem('wind_chimes', 14, 7, 0, { roomId: massage.id })).toBeTruthy();
    massage.vibes = 60;
    fadeVibes(ctx, 10);
    expect(massage.vibes).toBeCloseTo(60 - VIBES_FADE * CHIMES_FADE * 10);
  });

  it('do nothing for a room they are not in', () => {
    const { sim, s, consult, massage } = openCenter(1);
    const ctx = createContext(s);
    expect(sim.placeItem('wind_chimes', 14, 7, 0, { roomId: massage.id })).toBeTruthy();
    consult.vibes = 60;
    fadeVibes(ctx, 10);
    expect(consult.vibes).toBeCloseTo(60 - VIBES_FADE * 10);
  });
});

describe('the fortune teller', () => {
  /** A guest with a little patience left and nothing felt yet. */
  const guest = () => ({ patience: 30, feelings: [], bubble: '', bubbleT: 0 }) as unknown as Guest;

  it('tells everyone a fortune, and a lucky few that they will be healed today', () => {
    const guests = Array.from({ length: 200 }, guest);
    const ctx = createContext(newGame());
    for (const g of guests) tellFortune(ctx, g);
    expect(guests.every((g) => g.feelings.includes('fortune'))).toBe(true);
    const lucky = guests.filter((g) => g.feelings.includes('lucky'));
    expect(lucky.length).toBeGreaterThan(10);
    expect(lucky.length).toBeLessThan(60);
    expect(lucky.every((g) => g.patience === 100)).toBe(true);
    expect(guests.filter((g) => !g.feelings.includes('lucky')).every((g) => g.patience === 30)).toBe(true);
  });

  it('is played by bored guests, for a fee', () => {
    const { sim, s, therapist } = openCenter(5);
    s.stars = 1;
    const teller = sim.placeItem('fortune_teller', 18, 13, 0)!;
    expect(teller).toBeTruthy();
    // with nobody to treat them, diagnosed guests have to wait
    sim.fire(therapist.id);
    runUntil(sim, () => s.guests.some((g) => g.state === 'waiting'), 300);
    const bored = s.guests.find((g) => g.state === 'waiting')!;
    bored.patience = 40;
    runUntil(sim, () => bored.needKind === 'play' && bored.state === 'need', 60);
    runUntil(sim, () => bored.state !== 'need', 10);
    expect(bored.feelings).toContain('fortune');
    expect(bored.feelings).not.toContain('played');
    expect(teller.wear).toBeGreaterThan(0);
    expect(s.ledger.vending).toBeGreaterThanOrEqual(ITEMS.fortune_teller.sale!);
  });
});

describe('the kombucha tap', () => {
  it('only fizzes over once it is worn, and leaves one puddle where the guest stood', () => {
    const { sim, s } = openCenter(1);
    s.stars = 2;
    const tap = sim.placeItem('kombucha_tap', 18, 13, 0)!;
    const ctx = createContext(s);
    tap.wear = FIZZ_WEAR - 1;
    for (let i = 0; i < 50; i++) fizzOver(ctx, tap);
    expect(s.litter).toEqual([]);
    tap.wear = FIZZ_WEAR;
    for (let i = 0; i < 50; i++) fizzOver(ctx, tap);
    const [x, y] = accessTile(tap, 0);
    expect(s.litter).toEqual([{ id: expect.any(Number), x, y, claimedBy: 0, puddle: true }]);
    expect(inPuddle(ctx, x, y)).toBe(true);
  });

  it('slows anyone walking through its puddle, who does not like it', () => {
    const { s } = openCenter(1);
    const ctx = createContext(s);
    s.litter.push({ id: s.nextId++, x: 3, y: 3, claimedBy: 0, puddle: true });
    const g = { tx: 3, ty: 3, path: [[3.5, 4.5, 0]], feelings: [], bubble: '', bubbleT: 0 } as unknown as Guest;
    expect(puddleSlow(ctx, g)).toBe(PUDDLE_SLOW);
    expect(g.feelings).toContain('puddle');
    g.tx = 4;
    expect(puddleSlow(ctx, g)).toBe(1);
  });

  it('is drunk from for more than tea, and its puddles are mopped up by a Caretaker', () => {
    const { sim, s, consultant } = openCenter(5);
    s.stars = 2;
    const tap = sim.placeItem('kombucha_tap', 18, 13, 0)!;
    tap.wear = 90;
    sim.fire(consultant.id);
    runUntil(sim, () => s.guests.some((g) => g.state === 'waiting'), 300);
    runUntil(
      sim,
      () => {
        for (const g of s.guests) g.thirst = 100;
        return s.litter.some((l) => l.puddle);
      },
      300,
    );
    expect(s.ledger.vending).toBeGreaterThanOrEqual(ITEMS.kombucha_tap.sale!);
    hire(sim, 'caretaker');
    runUntil(sim, () => !s.litter.some((l) => l.puddle), 300);
    expect(inconsistencies(sim)).toEqual([]);
  });
});

describe('the staff fridge', () => {
  it('feeds and waters staff on a break in its Staff Room, until the power goes', () => {
    const { sim, s, therapist } = openCenter(1);
    s.stars = 1;
    const room = addStaffRoom(sim);
    const { x, y } = LAYOUT.staffroom.rect;
    expect(sim.placeItem('staff_fridge', x + 2, y, 0, { roomId: room.id })).toBeTruthy();
    const sofa = s.items.find((i) => i.type === 'sofa')!;
    therapist.thirst = 90;
    therapist.hunger = 90;
    therapist.energy = 5;
    runUntil(sim, () => therapist.state === 'onBreak' && therapist.claimItem === sofa.id, 300);
    run(sim, 3);
    expect(therapist.thirst).toBeLessThan(40);
    expect(therapist.hunger).toBeLessThan(40);
  });
});
