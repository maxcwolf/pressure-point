// Fires: a treatment machine smoking with wear can catch fire when it overloads, never otherwise. A Caretaker puts it
// out (quickly with a Fire Extinguisher near the room's door), sprinklers put it out on their own and soak the room,
// and the fire brigade is called the moment it starts: their truck always comes, and they charge only if they had to
// put the fire out themselves.
import { describe, expect, it } from 'vitest';

import {
  BEAT_SECONDS,
  BLAZE_SPREAD_SECONDS,
  BRIGADE_CALL_SECONDS,
  BRIGADE_FEE,
  DAY_SECONDS,
  DOUSE_SECONDS,
  FLOOD_PUDDLES,
  ITEMS,
  SIDEWALK_Y,
  SPRINKLER_COST,
  SPRINKLER_SECONDS,
} from '../../src/core/data';
import { startFire, truckPark, truckStart, updateBlazes } from '../../src/core/sim/blazes';
import { roomRefund } from '../../src/core/sim/building';
import { streetEnds } from '../../src/core/sim/chars';
import type { SimContext } from '../../src/core/sim/context';
import { spawnGuest } from '../../src/core/sim/guests';
import { maybeOverload } from '../../src/core/sim/machines';
import type { Sim } from '../../src/core/sim/sim';
import { caretakerSpeed } from '../../src/core/sim/staffing';
import { inspectionProblems } from '../../src/core/sim/visits';
import type { Item, Staff } from '../../src/core/state/types';
import { buildRoom, hire, inconsistencies, openCenter, run, runUntil, toasts } from './helpers';

/** The game's own workings behind a Sim, for the functions that take them. */
const ctxOf = (sim: Sim) => (sim as unknown as { ctx: SimContext }).ctx;

/**
 * An open center with fires on and a second Massage Suite: a Hot Stone Kiln at the back, a Massage Table beside it, and
 * an Oil Cart (which never wears, so never burns) in the far corner, with its door in the corner by the cart.
 */
function withKiln(seed = 1) {
  const c = openCenter(seed);
  c.s.blazesOn = true;
  c.s.stars = 2;
  const suite = buildRoom(c.sim, 'massage', { x: 18, y: 12, w: 5, h: 4 }, { x: 22, y: 15, dx: 0, dy: 1 }, [
    ['stone_kiln', 18, 12],
    ['massage_table', 20, 13],
    ['oil_trolley', 22, 12],
  ]);
  /** The one item of a kind in the suite. */
  const inSuite = (type: string) => {
    const it = c.s.items.find((i) => i.type === type && c.sim.world.zoneAt(i.x, i.y) === suite.id);
    if (!it) throw new Error(`no ${type} in the suite`);
    return it;
  };
  c.s.open = true;
  return {
    ...c,
    suite,
    kiln: inSuite('stone_kiln'),
    table: inSuite('massage_table'),
    cart: inSuite('oil_trolley'),
    ctx: ctxOf(c.sim),
  };
}

type Center = ReturnType<typeof withKiln>;

/** Put a Fire Extinguisher in the corridor just by the suite's door. */
function extinguisherByDoor(c: Center) {
  if (!c.sim.placeItem('fire_extinguisher', 21, 16, 0)) throw new Error('could not place the extinguisher');
}

/** Hire a Caretaker and let them get into the building and find nothing to do. */
function caretakerReady(c: Center): Staff {
  const st = hire(c.sim, 'caretaker');
  runUntil(c.sim, () => st.state === 'idle' || st.state === 'wander', 120);
  return st;
}

/** Seconds of game time between two moments, in days. */
const seconds = (from: number, to: number) => (to - from) * DAY_SECONDS;

/** The fire brigade's crew, while they are here. */
const crew = (c: Center) => c.s.visitors.filter((v) => v.visit === 'firefighter');

/** Whether anything is burning. */
const burning = (c: Center) => c.s.blazes.length > 0;

describe('catching fire', () => {
  it('happens only to a smoking machine with a flame or a motor, as it overloads, and only with fires on', () => {
    const { s, ctx, kiln } = withKiln();
    // not worn enough to smoke: it never overloads, so never catches fire
    kiln.wear = 10;
    for (let i = 0; i < 200; i++) expect(maybeOverload(ctx, kiln)).toBe(false);
    expect(s.blazes).toEqual([]);
    // with fires off, every overload is an ordinary one
    s.blazesOn = false;
    for (let i = 0; i < 300; i++) {
      kiln.wear = 75;
      delete kiln.overloaded;
      maybeOverload(ctx, kiln);
    }
    expect(s.blazes).toEqual([]);
    // with them on, a smoking kiln catches fire now and then as it overloads, and is broken but not overloaded
    s.blazesOn = true;
    let tries = 0;
    while (!s.blazes.length) {
      kiln.wear = 75;
      delete kiln.overloaded;
      maybeOverload(ctx, kiln);
      if (++tries > 500) throw new Error('never caught fire');
    }
    expect(s.blazes.map((b) => b.item)).toEqual([kiln.id]);
    expect(kiln.wear).toBe(100);
    expect(kiln.overloaded).toBeUndefined();
    expect(s.brigade?.state).toBe('coming');
  });

  it('never happens to a machine with neither a flame nor a motor, such as the Great Alphorn', () => {
    const { s, ctx, kiln } = withKiln();
    expect(ITEMS.great_alphorn.machine?.overload?.fire).toBeUndefined();
    expect(ITEMS.cider_press.machine?.overload?.fire).toBeUndefined();
    const horn: Item = { ...kiln, id: 9999, type: 'great_alphorn' };
    for (let i = 0; i < 300; i++) {
      horn.wear = 80;
      maybeOverload(ctx, horn);
    }
    expect(s.blazes).toEqual([]);
  });

  it('frightens the guests in the room, puts the room out of action and calls the fire brigade', () => {
    const { sim, s, ctx, kiln, table, suite } = withKiln();
    // one guest standing in the suite, and one out in the corridor
    const inside = spawnGuest(ctx)!;
    const outside = spawnGuest(ctx)!;
    Object.assign(inside, { tx: 21, ty: 14, x: 21.5, y: 14.5, patience: 80 });
    Object.assign(outside, { tx: 21, ty: 16, x: 21.5, y: 16.5, patience: 80 });
    sim.drain();
    startFire(ctx, kiln, 600);
    expect(sim.world.burning(suite)).toBe(true);
    expect(sim.world.usable(table)).toBe(false);
    expect(inside.feelings).toContain('blaze');
    expect(inside.patience).toBeLessThan(80);
    expect(inside.bubble).toBe('bubble-sweaty');
    expect(outside.feelings).not.toContain('blaze');
    const said = toasts(sim.drain()).join(' ');
    expect(said).toContain('has caught fire');
    expect(said).toContain('fire brigade has been called');
    expect(s.stats.fires).toBe(1);
  });
});

describe('a Caretaker with a Fire Extinguisher near the door', () => {
  it('puts the fire out quickly, before it spreads; the brigade comes, shrugs and goes without charging', () => {
    const c = withKiln();
    const { sim, s, ctx, kiln, table, suite } = c;
    extinguisherByDoor(c);
    const caretaker = caretakerReady(c);
    const upkeep = s.ledger.upkeep;
    startFire(ctx, kiln, 600);
    runUntil(sim, () => caretaker.state === 'doingJob' && caretaker.job?.kind === 'douse', 60);
    const from = s.day;
    runUntil(sim, () => !burning(c), 30);
    expect(seconds(from, s.day)).toBeCloseTo(DOUSE_SECONDS / caretakerSpeed(caretaker), 0);
    // the kiln alone burnt, broken, with soot on the floor beside it
    expect(kiln.burnt).toBe(true);
    expect(kiln.wear).toBe(100);
    expect(table.burnt).toBeUndefined();
    expect(s.litter.filter((l) => l.soot)).toHaveLength(1);
    expect(s.fire).toMatchObject({ item: 'stone_kiln', burnt: 1, how: 'extinguisher', fee: 0, out: true });
    expect(sim.world.usable(table)).toBe(true);
    // the brigade comes all the same, finds it out, and leaves without charging
    runUntil(sim, () => s.brigade?.state === 'parked', 60);
    expect(crew(c)).toHaveLength(2);
    runUntil(sim, () => !s.brigade, 120);
    expect(crew(c)).toEqual([]);
    expect(s.ledger.upkeep - upkeep).toBe(600);
    expect(sim.world.burning(suite)).toBe(false);
  });
});

describe('a Caretaker with no Fire Extinguisher near', () => {
  it('beats the fire out slowly, while it spreads to what wears beside it in the room, and nothing else', () => {
    const c = withKiln();
    const { sim, s, ctx, kiln, table, cart } = c;
    const caretaker = caretakerReady(c);
    // a plant just outside the room's wall, beside the kiln but not in its room, and one inside it beside the kiln
    sim.placeItem('plant', 17, 12, 0);
    startFire(ctx, kiln, 600);
    runUntil(sim, () => caretaker.state === 'doingJob' && caretaker.job?.kind === 'douse', 60);
    const from = s.day;
    runUntil(sim, () => !s.blazes.some((b) => b.item === kiln.id), 60);
    expect(seconds(from, s.day)).toBeCloseTo(BEAT_SECONDS / caretakerSpeed(caretaker), 0);
    // long enough for the table beside it to catch
    expect(BEAT_SECONDS).toBeGreaterThan(BLAZE_SPREAD_SECONDS);
    expect(table.wear).toBe(100);
    runUntil(sim, () => !burning(c), 120);
    expect(table.burnt).toBe(true);
    // nothing that never wears burns, and nothing outside the room
    expect(cart.burnt).toBeUndefined();
    expect(s.items.filter((i) => i.burnt).map((i) => i.type)).toEqual(['stone_kiln', 'massage_table']);
    expect(inconsistencies(sim)).toEqual([]);
  });

  it('repairs what burnt afterwards, which puts it right', () => {
    const c = withKiln();
    const { sim, ctx, kiln } = c;
    extinguisherByDoor(c);
    caretakerReady(c);
    startFire(ctx, kiln, 600);
    runUntil(sim, () => !burning(c), 60);
    expect(kiln.burnt).toBe(true);
    runUntil(sim, () => !kiln.burnt, 300);
    expect(kiln.wear).toBe(0);
    expect(sim.world.usable(kiln)).toBe(true);
  });
});

describe('the fire brigade, with no Caretaker', () => {
  it('drives in from the end of the street, parks by the door, hoses the fire out and charges once', () => {
    const c = withKiln();
    const { sim, s, ctx, kiln } = c;
    const upkeep = s.ledger.upkeep;
    const [left, right] = streetEnds(sim.world.building, sim.world.w);
    startFire(ctx, kiln, 600);
    const from = s.day;
    // waiting at the end of the street until the call comes through
    run(sim, BRIGADE_CALL_SECONDS - 1);
    expect(s.brigade).toMatchObject({ state: 'coming', x: truckStart(left) });
    run(sim, 2);
    expect(s.brigade?.x).toBeGreaterThan(truckStart(left));
    runUntil(sim, () => s.brigade?.state === 'parked', 30);
    expect(s.brigade?.x).toBe(truckPark(ctx));
    // two firefighters out on the pavement beside the cab
    expect(crew(c)).toHaveLength(2);
    for (const v of crew(c)) expect(v.ty).toBe(SIDEWALK_Y);
    runUntil(sim, () => !burning(c), 60);
    expect(seconds(from, s.day)).toBeLessThan(60);
    expect(s.ledger.upkeep - upkeep).toBe(600 + BRIGADE_FEE);
    expect(s.fire).toMatchObject({ how: 'brigade', fee: BRIGADE_FEE, out: true });
    // back to the truck, and off down the street
    runUntil(sim, () => s.brigade?.state === 'leaving', 60);
    expect(crew(c)).toEqual([]);
    runUntil(sim, () => !s.brigade, 30);
    expect(right).toBeGreaterThan(truckPark(ctx));
    expect(s.ledger.upkeep - upkeep).toBe(600 + BRIGADE_FEE);
  });

  it('puts out two fires in two rooms on one call-out, for one fee', () => {
    const c = withKiln();
    const { sim, s, ctx, kiln, massage } = c;
    const upkeep = s.ledger.upkeep;
    const other = s.items.find((i) => i.type === 'massage_table' && sim.world.zoneAt(i.x, i.y) === massage.id)!;
    startFire(ctx, kiln, 600);
    startFire(ctx, other, 0);
    runUntil(sim, () => !burning(c), 120);
    expect(kiln.burnt).toBe(true);
    expect(other.burnt).toBe(true);
    runUntil(sim, () => !s.brigade, 120);
    expect(s.ledger.upkeep - upkeep).toBe(600 + BRIGADE_FEE);
  });

  it('keeps everyone in order while they are about, and the room is out of action only while it burns', () => {
    const c = withKiln();
    const { sim, s, ctx, massage } = c;
    // a guest on the first suite's table when it catches fire
    runUntil(sim, () => s.guests.some((g) => g.state === 'served' && sim.world.zoneAt(g.tx, g.ty) === massage.id), 600);
    const g = s.guests.find((x) => x.state === 'served' && sim.world.zoneAt(x.tx, x.ty) === massage.id)!;
    const table = sim.world.item(g.station)!;
    startFire(ctx, table, 0);
    run(sim, 1);
    expect(g.state === 'served' && g.station === table.id).toBe(false);
    for (let i = 0; i < 1200 && (burning(c) || s.brigade); i++) {
      sim.tick(0.1);
      expect(inconsistencies(sim)).toEqual([]);
    }
    expect(s.brigade).toBeUndefined();
    expect(sim.world.burning(massage)).toBe(false);
  });
});

describe('sprinklers', () => {
  it('are fitted from the third star, at a price, and count as ready for a fire to the inspector', () => {
    const c = withKiln();
    const { sim, s, ctx, suite } = c;
    expect(sim.fitSprinklers(suite.id)).toBe(false);
    expect(suite.sprinklers).toBeUndefined();
    s.stars = 3;
    s.money = 100;
    expect(sim.fitSprinklers(suite.id)).toBe(false);
    s.money = 10_000;
    expect(inspectionProblems(ctx, suite)).toContain('no Fire Extinguisher nearby');
    expect(sim.fitSprinklers(suite.id)).toBe(true);
    expect(s.money).toBe(10_000 - SPRINKLER_COST);
    expect(suite.sprinklers).toBe(true);
    expect(inspectionProblems(ctx, suite)).not.toContain('no Fire Extinguisher nearby');
    // once only
    expect(sim.fitSprinklers(suite.id)).toBe(false);
    // and half of what they cost comes back with the room
    const back = roomRefund(ctx, suite, 0.5);
    delete suite.sprinklers;
    expect(back - roomRefund(ctx, suite, 0.5)).toBe(SPRINKLER_COST / 2);
  });

  it('put a fire out on their own before it spreads, and flood the room until a Caretaker mops it out', () => {
    const c = withKiln();
    const { sim, s, ctx, kiln, table, suite } = c;
    s.stars = 3;
    sim.fitSprinklers(suite.id);
    startFire(ctx, kiln, 600);
    const from = s.day;
    runUntil(sim, () => !burning(c), SPRINKLER_SECONDS + 2);
    expect(seconds(from, s.day)).toBeLessThanOrEqual(SPRINKLER_SECONDS + 1);
    expect(table.wear).toBeLessThan(100);
    expect(sim.world.flooded(suite)).toBe(true);
    expect(s.litter.filter((l) => l.flood === suite.id)).toHaveLength(FLOOD_PUDDLES);
    expect(sim.world.usable(table)).toBe(false);
    expect(s.fire).toMatchObject({ how: 'sprinklers', fee: 0 });
    hire(sim, 'caretaker');
    runUntil(sim, () => !sim.world.flooded(suite), 300);
    expect(sim.world.usable(table)).toBe(true);
  });
});

describe('taking a fire away', () => {
  it('ends with the burning item sold, and the Caretaker on their way to it goes back to other work', () => {
    const c = withKiln();
    const { sim, s, ctx, kiln } = c;
    const caretaker = caretakerReady(c);
    startFire(ctx, kiln, 600);
    runUntil(sim, () => caretaker.job?.kind === 'douse', 30);
    sim.sellItem(kiln.id);
    expect(s.blazes).toEqual([]);
    expect(caretaker.job?.kind).not.toBe('douse');
    expect(inconsistencies(sim)).toEqual([]);
  });

  it('ends with its room knocked down, and a firefighter running to it goes back to the truck', () => {
    const c = withKiln();
    const { sim, s, ctx, kiln, suite } = c;
    startFire(ctx, kiln, 600);
    runUntil(sim, () => crew(c).length === 2, 60);
    sim.removeRoom(suite.id, 0.5);
    expect(s.blazes).toEqual([]);
    updateBlazes(ctx);
    runUntil(sim, () => crew(c).length === 0, 120);
    runUntil(sim, () => !s.brigade, 60);
    expect(inconsistencies(sim)).toEqual([]);
  });
});
