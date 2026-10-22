// Treatment machines: which guests they take, what they do to a session, what they cost to run, how they overload and
// are put right, and that a game with none of them goes on just as it did before they were added.
import { describe, expect, it } from 'vitest';

import {
  CONDITIONS,
  ITEMS,
  type ItemType,
  machineRoom,
  MODALITIES,
  MODALITY_ORDER,
  ROOM_ORDER,
  roomHere,
  ROOMS,
} from '../../src/core/data';
import type { Layout } from '../../src/core/room-layout';
import type { SimContext } from '../../src/core/sim/context';
import { capacity, capacityArrivals } from '../../src/core/sim/demand';
import {
  machineBuilt,
  machineSeconds,
  machineUpkeep,
  maybeOverload,
  practicable,
  roomForModality,
  smoking,
  treatsHere,
} from '../../src/core/sim/machines';
import type { Sim } from '../../src/core/sim/sim';
import { unlocked } from '../../src/core/sim/treatments';
import { templateLock } from '../../src/core/templates';
import { machineCures, roomKarmaLock } from '../../src/ui/lib/catalog';
import { itemStats } from '../../src/ui/lib/item-stats';
import { treatmentsUnlockedAt } from '../../src/ui/lib/unlocks';
import { buildRoom, freshSim, hire, inconsistencies, openCenter, run, runUntil, toasts } from './helpers';

/** Every discipline switched on. */
const everything = () => true;

/** The game's own workings behind a Sim, for the functions that take them. */
const ctxOf = (sim: Sim) => (sim as unknown as { ctx: SimContext }).ctx;

/** The machines a guest is treated on, as opposed to those that help a whole room. */
const STATIONS = (Object.keys(ITEMS) as ItemType[]).filter((t) => ITEMS[t].machine && ITEMS[t].station);

/** A center with a Kneadmaster Suite, past the star that opens it, and a Massage Therapist trained to run it. */
function withKneader() {
  const center = openCenter(3);
  center.s.stars = 2;
  const suite = buildRoom(center.sim, 'kneader', { x: 17, y: 13, w: 4, h: 4 }, { x: 20, y: 16, dx: 0, dy: 1 }, [
    ['kneadmaster', 17, 13],
  ]);
  const chair = center.s.items.find((it) => it.type === 'kneadmaster');
  if (!chair) throw new Error('no Kneadmaster');
  center.therapist.quals.push('kneading');
  center.s.open = true;
  return { ...center, suite, chair };
}

describe('a machine room and the guests it draws', () => {
  it('counts as a staffed treatment station like a table, with nothing of its own', () => {
    const { sim, chair } = withKneader();
    const ctx = ctxOf(sim);
    // a table and the Kneadmaster, with one Massage Therapist: one station, and one standing idle
    expect(capacity(ctx)).toMatchObject({ stations: 1, by: { massage: 1 }, idle: 1 });
    hire(sim, 'therapist');
    expect(capacity(ctx)).toMatchObject({ stations: 2, by: { massage: 2 }, idle: 0 });
    expect(capacityArrivals(capacity(ctx))).toBeCloseTo(1.12, 5);
    // broken down, it draws nobody until it is put right
    chair.wear = 100;
    expect(capacity(ctx)).toMatchObject({ stations: 1 });
  });
});

describe('the machines as data', () => {
  it('give every signature machine a room of its own, and its techniques to that machine alone', () => {
    for (const m of MODALITY_ORDER) {
      const machine = MODALITIES[m].machine;
      if (!machine) continue;
      const room = machineRoom(machine);
      expect(room, m).toBeDefined();
      expect(ITEMS[machine].machine?.performs, m).toContain(m);
      expect(ITEMS[machine].station?.discipline, m).toBe(MODALITIES[m].discipline);
      // a machine's ailments are found where its room can be built, and nowhere else
      for (const c of CONDITIONS.filter((x) => x.modality === m))
        for (const center of c.only ?? []) expect(roomHere(ROOMS[room ?? 'consult'], center), c.id).toBe(true);
    }
  });

  it('keep each room’s machine to the centers the room belongs to, and the carousel to karma', () => {
    expect(ROOMS.kneader.only).toEqual(['willow', 'sandbox']);
    expect(roomHere(ROOMS.kneader, 'exchange')).toBe(false);
    expect(roomHere(ROOMS.rebirth, 'exchange')).toBe(true);
    expect(roomKarmaLock('rebirth', 3, [])).toBe('wheel_of_rebirth');
    expect(roomKarmaLock('rebirth', 3, ['wheel_of_rebirth'])).toBeUndefined();
    expect(roomKarmaLock('kneader', 3, [])).toBeUndefined();
  });

  it('cost something every month to run, and take short courses to learn', () => {
    for (const t of Object.keys(ITEMS) as ItemType[]) {
      const machine = ITEMS[t].machine;
      if (machine) expect(machine.upkeep, t).toBeGreaterThan(0);
    }
    for (const m of MODALITY_ORDER)
      if (MODALITIES[m].machine) expect(MODALITIES[m].trainDays, m).toBeLessThanOrEqual(3);
  });

  it('can each be upgraded when a guest is treated on it', () => {
    for (const t of STATIONS) expect(ITEMS[t].upgrade, t).toBeDefined();
  });
});

describe('a machine room at its smallest', () => {
  it('fits its machine, built either way round, with a door on any side', () => {
    for (const type of ROOM_ORDER) {
      const def = ROOMS[type];
      const machine = def.required.find((t) => ITEMS[t].machine);
      if (!machine) continue;
      for (const [w, h] of [
        [def.minShort, def.minLong],
        [def.minLong, def.minShort],
      ] as const) {
        const rect = { x: 10, y: 4, w, h };
        const doors = [
          { x: rect.x + 1, y: rect.y + h - 1, dx: 0, dy: 1 },
          { x: rect.x + w - 1, y: rect.y + 1, dx: 1, dy: 0 },
          { x: rect.x, y: rect.y + 1, dx: -1, dy: 0 },
        ];
        for (const door of doors) {
          const sim = freshSim(1);
          const room = sim.createRoom(type, rect, door);
          const world = ctxOf(sim).world;
          let fits = false;
          for (let rot = 0; rot < 4 && !fits; rot++)
            for (let y = rect.y; y < rect.y + h && !fits; y++)
              for (let x = rect.x; x < rect.x + w && !fits; x++)
                fits = world.canPlaceItem(machine, x, y, rot, room.id).ok;
          expect(fits, `${machine} in a ${w}×${h} ${def.name}, door ${door.dx},${door.dy}`).toBe(true);
        }
      }
    }
  });
});

describe('which station takes a guest', () => {
  it('sends a machine’s own technique only to it, and a table none of them', () => {
    expect(treatsHere({ type: 'kneadmaster' }, MODALITIES.kneading)).toBe(true);
    expect(treatsHere({ type: 'massage_table' }, MODALITIES.kneading)).toBe(false);
    expect(treatsHere({ type: 'kneadmaster' }, MODALITIES.swedish)).toBe(false);
  });

  it('lets a machine for a table’s technique take only that technique, beside the tables', () => {
    expect(treatsHere({ type: 'stone_kiln' }, MODALITIES.stone)).toBe(true);
    expect(treatsHere({ type: 'massage_table' }, MODALITIES.stone)).toBe(true);
    expect(treatsHere({ type: 'stone_kiln' }, MODALITIES.swedish)).toBe(false);
  });

  it('names a machine’s own room as where its technique is done', () => {
    expect(roomForModality('kneading')).toBe('kneader');
    expect(roomForModality('stone')).toBe('massage');
    expect(roomForModality('rebirth')).toBe('rebirth');
  });

  it('makes a session quicker on a quicker machine', () => {
    const { sim, s } = openCenter(2);
    s.stars = 3;
    buildRoom(sim, 'massage', { x: 22, y: 10, w: 4, h: 4 }, { x: 22, y: 12, dx: -1, dy: 0 }, [['stone_kiln', 24, 10]]);
    const kiln = s.items.find((it) => it.type === 'stone_kiln');
    const table = s.items.find((it) => it.type === 'massage_table');
    if (!kiln || !table) throw new Error('no kiln or table');
    const ctx = ctxOf(sim);
    expect(machineSeconds(ctx, kiln)).toBe(ITEMS.stone_kiln.machine?.seconds);
    expect(machineSeconds(ctx, table)).toBe(1);
  });
});

describe('a signature machine’s technique', () => {
  it('cannot be offered, priced or learned until its room is built', () => {
    const { sim, s } = openCenter(3);
    s.stars = 2;
    expect(machineBuilt(s, 'kneading')).toBe(false);
    expect(unlocked(ctxOf(sim), 'kneading')).toBe(false);
    expect(practicable(ctxOf(sim), 'kneading')).toBe(false);
  });

  it('opens with its room, with a word over the speakers', () => {
    const { sim, s } = withKneader();
    expect(machineBuilt(s, 'kneading')).toBe(true);
    expect(unlocked(ctxOf(sim), 'kneading')).toBe(true);
    expect(practicable(ctxOf(sim), 'kneading')).toBe(true);
    run(sim, 2);
    const said = sim.drain().flatMap((e) => (e.type === 'announce' ? [e.text] : []));
    expect(said.join(' ')).toContain('The Kneadmaster 9000 is now open');
  });

  it('is left out of the techniques a star unlocks, coming with its room instead', () => {
    const named = treatmentsUnlockedAt(2, () => true)
      .map((t) => t.text)
      .join(' ');
    expect(named).not.toContain(MODALITIES.kneading.name);
  });

  it('treats a guest who needs it, on the machine, with nothing out of step', () => {
    const { sim, s, chair } = withKneader();
    const condition = CONDITIONS.find((c) => c.modality === 'kneading');
    if (!condition) throw new Error('no kneading ailment');
    expect(sim.cheat(`guests 1 ${condition.id}`).ok).toBe(true);
    runUntil(sim, () => chair.serving > 0, 900);
    const guest = s.guests.find((g) => g.condition === condition.id);
    expect(guest?.station).toBe(chair.id);
    runUntil(sim, () => chair.serving === 0, 300);
    expect(inconsistencies(sim)).toEqual([]);
  });
});

describe('every signature machine', () => {
  for (const type of ROOM_ORDER) {
    const def = ROOMS[type];
    const machine = def.required.find((t) => ITEMS[t].machine);
    if (!machine || !def.staff) continue;
    const staffRole = def.staff;
    it(`treats a guest in the ${def.name}`, () => {
      const center = openCenter(4);
      const { sim, s } = center;
      s.stars = 3;
      s.open = true;
      // the room at its smallest, in the free space at the back of the building, with its machine wherever it fits
      const world = ctxOf(sim).world;
      const rect = { x: 17, y: 4, w: def.minShort, h: def.minLong };
      const room = sim.createRoom(type, rect, { x: rect.x, y: rect.y + rect.h - 1, dx: 0, dy: 1 });
      let placed = false;
      for (let rot = 0; rot < 4 && !placed; rot++)
        for (let y = rect.y; y < rect.y + rect.h && !placed; y++)
          for (let x = rect.x; x < rect.x + rect.w && !placed; x++)
            if (world.canPlaceItem(machine, x, y, rot, room.id).ok)
              placed = !!sim.placeItem(machine, x, y, rot, { free: true, roomId: room.id });
      expect(placed).toBe(true);
      sim.finishRoom(room);
      // an operator of its own, as the one Therapist on the tables wears out doing both
      const operator = hire(sim, staffRole);
      const performs = ITEMS[machine].machine?.performs ?? [];
      operator.quals.push(...performs);
      const condition = CONDITIONS.find((c) => performs.includes(c.modality));
      if (!condition) throw new Error(`nothing for the ${machine} to cure`);
      expect(sim.cheat(`guests 1 ${condition.id}`).ok).toBe(true);
      const it = s.items.find((i) => i.type === machine);
      if (!it) throw new Error(`no ${machine}`);
      runUntil(sim, () => it.serving > 0, 900);
      runUntil(sim, () => it.serving === 0, 300);
      expect(inconsistencies(sim)).toEqual([]);
    });
  }
});

describe('running a machine', () => {
  it('costs its upkeep at the end of each month, in the books under its own line', () => {
    const { sim, s } = withKneader();
    expect(machineUpkeep(s)).toBe(ITEMS.kneadmaster.machine?.upkeep);
    s.day = 29.99;
    sim.drain();
    run(sim, 30);
    expect(s.lastLedger.upkeep).toBe(ITEMS.kneadmaster.machine?.upkeep);
    expect(toasts(sim.drain()).join(' ')).toContain('The machines cost');
  });

  it('smokes once worn, as warning it may overload', () => {
    const { chair } = withKneader();
    chair.wear = 50;
    expect(smoking(chair)).toBe(false);
    chair.wear = 80;
    expect(smoking(chair)).toBe(true);
  });

  it('only ever overloads once smoking, and then needs a Caretaker, with a bill for parts', () => {
    const { sim, s, chair } = withKneader();
    chair.wear = 10;
    for (let i = 0; i < 200; i++) expect(maybeOverload(ctxOf(sim), chair)).toBe(false);
    chair.wear = 80;
    const before = s.money;
    let tries = 0;
    while (!maybeOverload(ctxOf(sim), chair)) if (++tries > 500) throw new Error('never overloaded');
    expect(chair.overloaded).toBe(true);
    expect(chair.wear).toBe(100);
    expect(s.money).toBe(before - (ITEMS.kneadmaster.machine?.overload?.bill ?? 0));
    expect(practicable(ctxOf(sim), 'kneading')).toBe(false);
    expect(toasts(sim.drain()).join(' ')).toContain('Caretaker');
    // and a Caretaker puts it right
    hire(sim, 'caretaker');
    runUntil(sim, () => chair.wear < 100, 900);
    runUntil(sim, () => !chair.overloaded, 300);
    expect(practicable(ctxOf(sim), 'kneading')).toBe(true);
  });

  it('tells a player what it does on its card', () => {
    const ids = itemStats('kneadmaster').map((x) => x.icon);
    expect(ids).toEqual(expect.arrayContaining(['bubble-installing', 'ui-wages', 'ui-warning']));
    expect(itemStats('fog_machine').map((x) => x.short)).toContain('Helps its room');
  });
});

describe('the build menus', () => {
  it('list what each signature room cures', () => {
    expect(machineCures('kneader').map((c) => c.modality)).toEqual(['kneading', 'kneading']);
    expect(machineCures('massage')).toEqual([]);
  });

  it('refuse a template for a room another center has', () => {
    const layout: Layout = {
      type: 'kneader',
      w: 4,
      h: 4,
      door: { x: 3, y: 3, dx: 0, dy: 1 },
      windows: [],
      items: [{ type: 'kneadmaster', x: 0, y: 0, rot: 0 }],
    };
    const allowed = { upTo: 3, unlocked: [], enabled: everything };
    expect(templateLock(layout, { ...allowed, center: 'willow' })).toBe('');
    expect(templateLock(layout, { ...allowed, center: 'exchange' })).toBe(
      'There is no Kneadmaster Suite at The Exchange',
    );
  });

  it('keep every machine room in the order rooms are listed', () => {
    for (const t of ['kneader', 'pinpress', 'aurawash', 'alphorn', 'cider', 'rebirth'] as const)
      expect(ROOM_ORDER).toContain(t);
  });
});

describe('a game without machines', () => {
  it('never offers staff who already know a machine’s technique', () => {
    const { s } = openCenter(5);
    for (const c of s.candidates) for (const q of c.quals) expect(MODALITIES[q].machine, q).toBeUndefined();
  });
});
