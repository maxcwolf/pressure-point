// Two machines and the guests and rooms around them: the Gong of Last Resort rattles the rooms next door while it
// plays, and bored guests pay for a ride on the Carousel of Rebirth while it treats nobody, getting off for a guest due
// for rebirth.
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';

import { BORED_PATIENCE, CONDITIONS, ITEMS, ROOMS, SESSION_WAIT } from '../../src/core/data';
import { accessIndex, claim, findAccess } from '../../src/core/sim/claims';
import type { SimContext } from '../../src/core/sim/context';
import { spawnGuest } from '../../src/core/sim/guests';
import { rattledRooms, rattlersBeside, rattling } from '../../src/core/sim/machines';
import { noiseAt, updateNoise } from '../../src/core/sim/noise';
import type { Sim } from '../../src/core/sim/sim';
import type { Guest, Item, Room } from '../../src/core/state/types';
import { accessTile, itemCenter } from '../../src/core/world';
import { BOOST_LOOP, GagClock } from '../../src/render/gags/clock';
import { WHEEL_OF_REBIRTH } from '../../src/render/gags/scripts/wheel-of-rebirth';
import { rattle } from '../../src/render/item-cues';
import { animateItemParts, type ItemCondition } from '../../src/render/items';
import { buildItem } from '../../src/render/models/items';
import { itemStats } from '../../src/ui/lib/item-stats';
import { rattledLine, rattleLine } from '../../src/ui/lib/rattle';
import { guestStatus } from '../../src/ui/lib/status';
import { buildRoom, hire, openCenter, run, runUntil } from './helpers';

// a few models paint onto canvases, which Node does not have: a canvas that draws nothing will do
beforeAll(() => {
  /** Does nothing, for every call a canvas makes that a test has no use for. */
  const nothing = () => undefined;
  const context = new Proxy(
    {},
    {
      /** Whatever is asked for is a method that does nothing, except measuring text. */
      get: (_, p) => (p === 'measureText' ? () => ({ width: 10 }) : nothing),
    },
  );
  Object.assign(globalThis, {
    document: {
      /** A canvas that draws nothing. */
      createElement: () => ({
        width: 0,
        height: 0,
        style: {},
        /** The one context it has. */
        getContext: () => context,
      }),
    },
  });
});

/** The game's own workings behind a Sim, for the functions that take them. */
const ctxOf = (sim: Sim) => (sim as unknown as { ctx: SimContext }).ctx;

/** The one item of a kind. */
function only(sim: Sim, type: Item['type']): Item {
  const it = sim.s.items.find((i) => i.type === type);
  if (!it) throw new Error(`no ${type}`);
  return it;
}

/** How noisy it is in the middle of an item, with the noise worked out afresh. */
function noiseOver(sim: Sim, it: Item): number {
  const ctx = ctxOf(sim);
  updateNoise(ctx);
  const [cx, cy] = itemCenter(it);
  return noiseAt(ctx, Math.floor(cx), Math.floor(cy));
}

/**
 * The standard little center, with a Sound Bath Studio built against the Massage Suite's east wall: two mats, the
 * bowls, and a Gong of Last Resort, or the little gong.
 */
function withGong(gong: 'big_gong' | 'gong' = 'big_gong') {
  const center = openCenter(2);
  const studio = buildRoom(center.sim, 'sound', { x: 15, y: 5, w: 4, h: 4 }, { x: 16, y: 8, dx: 0, dy: 1 }, [
    ['sound_mat', 15, 5],
    ['sound_mat', 17, 5],
    ['singing_bowls', 15, 8, 2],
    [gong, 17, 8],
  ]);
  const bowls = only(center.sim, 'singing_bowls');
  return { ...center, studio, bowls, gong: only(center.sim, gong), table: only(center.sim, 'massage_table') };
}

describe('the Gong of Last Resort, next door', () => {
  it('rattles the rooms that share a wall with its studio while a session plays, and only then', () => {
    const { sim, massage, consult, studio, bowls, gong } = withGong();
    const ctx = ctxOf(sim);
    expect(rattling(ctx, gong)).toEqual([]);
    bowls.progress = SESSION_WAIT;
    expect(rattling(ctx, gong)).toEqual([massage]);
    expect([...rattledRooms(ctx)]).toEqual([massage.id]);
    // nothing else is shaken: not the studio itself, nor the Consultation Room down the corridor
    expect(rattledRooms(ctx).has(studio.id)).toBe(false);
    expect(rattledRooms(ctx).has(consult.id)).toBe(false);
  });

  it('carries its noise through the shared wall to the treatment table next door', () => {
    const { sim, bowls, table, consult } = withGong();
    const desk = only(sim, 'consult_desk');
    const quietTable = noiseOver(sim, table);
    const quietDesk = noiseOver(sim, desk);
    bowls.progress = SESSION_WAIT;
    const rattled = noiseOver(sim, table);
    // loud enough at the table for a guest on it to notice, and to take something off the treatment
    expect(rattled - quietTable).toBeGreaterThan(3);
    expect(rattled - quietTable).toBeLessThanOrEqual((ITEMS.big_gong.machine?.rattle ?? 0) + 1);
    // the Consultation Room shares no wall with the studio
    expect(consult.done).toBe(true);
    expect(noiseOver(sim, desk)).toBeCloseTo(quietDesk, 1);
  });

  it('is louder next door than the little gong, which only leaks through two walls', () => {
    const big = withGong('big_gong');
    const little = withGong('gong');
    big.bowls.progress = SESSION_WAIT;
    little.bowls.progress = SESSION_WAIT;
    const bigRise = noiseOver(big.sim, big.table);
    const littleRise = noiseOver(little.sim, little.table);
    expect(bigRise - littleRise).toBeGreaterThan(3);
    expect(rattledRooms(ctxOf(little.sim)).size).toBe(0);
  });

  it('fades across a room from the shared wall', () => {
    const { sim, bowls, massage } = withGong();
    bowls.progress = SESSION_WAIT;
    const ctx = ctxOf(sim);
    updateNoise(ctx);
    const y = massage.y + 2;
    const near = noiseAt(ctx, massage.x + massage.w - 1, y);
    const far = noiseAt(ctx, massage.x, y);
    expect(near).toBeGreaterThan(far);
    expect(far).toBeGreaterThan(0);
  });

  it('warns on its card and in the inspectors, playing or not', () => {
    const rattleStat = itemStats('big_gong').find((s) => s.id === 'rattle');
    expect(rattleStat?.long).toContain('every room next door');
    expect(itemStats('gong').some((s) => s.id === 'rattle')).toBe(false);
    const { sim, bowls, gong, massage } = withGong();
    const { reach, now } = sim.rattles(gong);
    expect(rattleLine(reach, now)).toBe('Rattles the Massage Suite next door while a session plays');
    bowls.progress = SESSION_WAIT;
    const playing = sim.rattles(gong);
    expect(rattleLine(playing.reach, playing.now)).toBe('Rattling the Massage Suite next door');
    expect(rattleLine([], [])).toBe('Nothing next door to rattle');
    expect(rattlersBeside(ctxOf(sim), massage)).toEqual([gong]);
    expect(rattledLine(sim.rattlersBeside(massage))).toBe(
      'The Gong of Last Resort next door rattles this room while it plays',
    );
    const rooms = [massage, { ...massage, id: 99, type: 'staffroom' } as Room];
    expect(rattleLine(rooms, [])).toBe('Rattles the Massage Suite and the Staff Room next door while a session plays');
  });

  it('rocks what is next door just after each strike, and leaves it as it stood once the session ends', () => {
    // still before the strike, rocking a moment after it
    expect(rattle(0, 1)).toBe(0);
    expect(Math.abs(rattle(BOOST_LOOP * 0.25, 1))).toBeGreaterThan(0);
    expect(rattle(BOOST_LOOP * 0.9, 1)).toBe(0);
    const model = buildItem('massage_table');
    const cond: ItemCondition = {
      id: 1,
      type: 'massage_table',
      water: 100,
      dirt: 0,
      wear: 0,
      scanning: false,
      inUse: false,
      running: 0,
      trophies: 0,
    };
    let most = 0;
    for (let k = 0; k < 40; k++) {
      animateItemParts(model, { ...cond, rattled: true }, (BOOST_LOOP * k) / 40);
      most = Math.max(most, Math.abs(model.rotation.z));
    }
    expect(most).toBeGreaterThan(0.005);
    animateItemParts(model, { ...cond, rattled: false }, BOOST_LOOP * 0.25);
    expect(model.rotation.z).toBe(0);
    // something that has never been rattled is never touched
    const plant = buildItem('plant');
    plant.rotation.z = 0.3;
    animateItemParts(plant, { ...cond, type: 'plant' }, BOOST_LOOP * 0.25);
    expect(plant.rotation.z).toBe(0.3);
    expect(model).toBeInstanceOf(THREE.Object3D);
  });
});

/** A center with the Carousel of Rebirth built at its smallest at the back of the building, and an operator for it. */
function withCarousel() {
  const center = openCenter(4);
  const { sim, s } = center;
  s.stars = 3;
  s.open = true;
  const def = ROOMS.rebirth;
  const world = ctxOf(sim).world;
  const rect = { x: 17, y: 4, w: def.minShort, h: def.minLong };
  const room = sim.createRoom('rebirth', rect, { x: rect.x, y: rect.y + rect.h - 1, dx: 0, dy: 1 });
  let placed = false;
  for (let rot = 0; rot < 4 && !placed; rot++)
    for (let y = rect.y; y < rect.y + rect.h && !placed; y++)
      for (let x = rect.x; x < rect.x + rect.w && !placed; x++)
        if (world.canPlaceItem('wheel_of_rebirth', x, y, rot, room.id).ok)
          placed = !!sim.placeItem('wheel_of_rebirth', x, y, rot, { free: true, roomId: room.id });
  if (!placed) throw new Error('no room for the carousel');
  sim.finishRoom(room);
  const carousel = only(sim, 'wheel_of_rebirth');
  const play = accessIndex(carousel, 'play');
  return { ...center, room, carousel, play };
}

/** A guest for a massage table, bored and waiting on the carousel's step with nobody free to see them. */
function boredBeside(sim: Sim, carousel: Item, play: number): Guest {
  const ctx = ctxOf(sim);
  const condition = CONDITIONS.find((c) => c.modality === 'swedish');
  const g = condition && spawnGuest(ctx, condition.id);
  if (!g) throw new Error('no guest');
  const table = only(sim, 'massage_table');
  // the table's therapist has gone, so the guest waits in its line
  sim.s.staff = sim.s.staff.filter((st) => st.role !== 'therapist');
  table.staffId = 0;
  const [ax, ay] = accessTile(carousel, play);
  Object.assign(g, {
    goal: 'treat',
    diagnosis: 1,
    state: 'waiting',
    station: table.id,
    timer: 0,
    patience: BORED_PATIENCE - 20,
    path: null,
    tx: ax,
    ty: ay,
    x: ax + 0.5,
    y: ay + 0.5,
  });
  table.queue.push(g.id);
  return g;
}

describe('a ride on the Carousel of Rebirth', () => {
  it('is on offer to a bored guest only while it treats nobody and nobody waits for it', () => {
    const { sim, carousel, play } = withCarousel();
    const ctx = ctxOf(sim);
    const [ax, ay] = accessTile(carousel, play);
    expect(findAccess(ctx, 'play', ax, ay)?.item).toBe(carousel);
    carousel.queue.push(12345);
    expect(findAccess(ctx, 'play', ax, ay)).toBeNull();
    carousel.queue = [];
    carousel.serving = 12345;
    expect(findAccess(ctx, 'play', ax, ay)).toBeNull();
    carousel.serving = 0;
    carousel.wear = 100;
    expect(findAccess(ctx, 'play', ax, ay)).toBeNull();
  });

  it('takes a bored guest round once for a fare, in the books as vending, and eases their boredom', () => {
    const { sim, s, carousel, play } = withCarousel();
    const g = boredBeside(sim, carousel, play);
    const before = { vending: s.ledger.vending, patience: g.patience };
    runUntil(sim, () => g.state === 'need' && g.claimItem === carousel.id, 30);
    expect(carousel.users[play]).toBe(g.id);
    expect(guestStatus(g, sim)).toBe('Taking a ride on the Carousel of Rebirth');
    runUntil(sim, () => g.state !== 'need', 30);
    expect(s.ledger.vending - before.vending).toBe(ITEMS.wheel_of_rebirth.sale);
    expect(g.patience).toBeGreaterThan(before.patience);
    expect(g.feelings).toContain('played');
    expect(carousel.users[play]).toBe(0);
  });

  it('turns once round with the rider, as themselves, ending where they got on', () => {
    const { sim, carousel, play } = withCarousel();
    const g = boredBeside(sim, carousel, play);
    runUntil(sim, () => g.state === 'need', 30);
    const clock = new GagClock();
    const input = clock.input(sim, carousel, 0);
    expect(input).toMatchObject({ stage: 'running', ride: true });
    expect(input?.progress ?? 1).toBeLessThan(0.2);
    const start = WHEEL_OF_REBIRTH.frame({ ...(input ?? { stage: 'running', t: 0 }), progress: 0 } as never);
    expect(start.guest.x).toBeCloseTo(0, 5);
    expect(start.parts.goat).toBeUndefined();
    const halfway = WHEEL_OF_REBIRTH.frame({ ...(input as object), progress: 0.5 } as never);
    expect(Math.abs(halfway.guest.z ?? 0)).toBeGreaterThan(1);
    const end = WHEEL_OF_REBIRTH.frame({ ...(input as object), progress: 1 } as never);
    expect(end.guest.x).toBeCloseTo(0, 5);
    expect(end.guest.z).toBeCloseTo(0, 5);
  });

  it('gives way to a guest due for rebirth: the rider gets off as they are called', () => {
    const { sim, s, carousel, play } = withCarousel();
    const operator = hire(sim, 'therapist');
    operator.quals.push('rebirth');
    // a first patient brings the operator to the carousel
    expect(sim.cheat('guests 1 oldsoul').ok).toBe(true);
    runUntil(sim, () => carousel.serving > 0, 900);
    runUntil(sim, () => carousel.serving === 0, 300);
    // a guest on a ride that would go on and on, from the massage table's line
    const swedish = CONDITIONS.find((c) => c.modality === 'swedish');
    const rider = swedish && spawnGuest(ctxOf(sim), swedish.id);
    if (!rider) throw new Error('no rider');
    const table = only(sim, 'massage_table');
    Object.assign(rider, { goal: 'treat', diagnosis: 1, station: table.id, placed: true, path: null });
    table.queue.push(rider.id);
    claim(ctxOf(sim), rider, carousel, play);
    Object.assign(rider, { state: 'need', needKind: 'play', timer: 1000 });
    const fare = s.ledger.vending;
    expect(sim.cheat('guests 1 pastlife').ok).toBe(true);
    // the rider is kept patient, so only the guest due for rebirth can end the ride
    runUntil(
      sim,
      () => {
        rider.patience = 100;
        return carousel.serving > 0;
      },
      900,
    );
    run(sim, 0.5);
    expect(rider.state).not.toBe('need');
    expect(carousel.users[play]).not.toBe(rider.id);
    // the ride was cut short, but paid for
    expect(s.ledger.vending - fare).toBe(ITEMS.wheel_of_rebirth.sale);
  });

  it('says what a ride costs on its card', () => {
    const sale = itemStats('wheel_of_rebirth').find((st) => st.id === 'sale');
    expect(sale?.short).toBe('$25 a ride');
    expect(sale?.long).toContain('while nobody is being treated');
    expect(itemStats('arcade_machine').find((st) => st.id === 'sale')?.short).toBe('$10 a use');
  });
});
