// Treatment machines: which guests they take, what they do to a session, what they cost to run, how they overload and
// are put right, and that a game with none of them goes on just as it did before they were added.
import { describe, expect, it } from 'vitest';

import {
  centerOf,
  conditionOf,
  CONDITIONS,
  GUEST_CAP,
  ITEMS,
  type ItemType,
  MACHINE_DRAW,
  machineRoom,
  MODALITIES,
  MODALITY_ORDER,
  ROOM_ORDER,
  roomHere,
  ROOMS,
} from '../../src/core/data';
import { makeCandidate } from '../../src/core/people';
import type { Layout } from '../../src/core/room-layout';
import type { SimContext } from '../../src/core/sim/context';
import {
  capacity,
  capacityArrivals,
  chooseCondition,
  chooseMachineCondition,
  lineFactor,
  machineDemand,
  roomPull,
  UNTRAINED_PULL,
} from '../../src/core/sim/demand';
import { admitGuests, guestCap, spawnGuest } from '../../src/core/sim/guests';
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
import { capacityNote, machinePullNote, paceNote } from '../../src/ui/lib/demand';
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
  /** A Kneadmaster center with a second Massage Therapist, so the chair has someone of its own to run it. */
  function staffed() {
    const center = withKneader();
    const second = hire(center.sim, 'therapist');
    center.s.reputation = 50;
    return { ...center, second, ctx: ctxOf(center.sim) };
  }

  it('is not a treatment station, and takes a practitioner of its own before the tables do', () => {
    const { sim, s, chair } = withKneader();
    const ctx = ctxOf(sim);
    // a table and the Kneadmaster, with one Massage Therapist: the chair has them, and the table stands idle
    expect(capacity(ctx)).toMatchObject({
      stations: 0,
      by: {},
      idle: 1,
      machines: [{ machine: 'kneadmaster', standing: 1, paid: 1, staffed: 1, fed: 1 }],
    });
    expect(machineDemand(ctx)[0]?.pull).toBeGreaterThan(0);
    // a second therapist works the table: the tables' pace is a station's, and the chair still draws its own
    hire(sim, 'therapist');
    expect(capacity(ctx)).toMatchObject({ stations: 1, idle: 0, machines: [{ standing: 1, paid: 1, staffed: 1 }] });
    expect(capacityArrivals(capacity(ctx))).toBe(1);
    // with nobody in the role at all, it draws nobody
    for (const st of s.staff) if (st.role === 'therapist') st.state = 'leaving';
    expect(capacity(ctx).machines).toEqual([{ machine: 'kneadmaster', standing: 1, paid: 0, staffed: 0, fed: 0 }]);
    expect(machineDemand(ctx)[0]?.pull).toBe(0);
    expect(sim.arrivalPace().perMonth).toBe(sim.arrivalPace().tables);
    // broken down, it draws nobody until it is put right
    for (const st of s.staff) if (st.role === 'therapist') st.state = 'atPost';
    chair.wear = 100;
    expect(capacity(ctx).machines).toEqual([]);
    expect(sim.arrivalPace().machines).toEqual([]);
  });

  it('draws its share of the center’s pace, times its room’s pull, on top of the tables', () => {
    const { sim, ctx } = staffed();
    const pace = sim.arrivalPace();
    const [own] = pace.machines;
    if (!own) throw new Error('the Kneadmaster draws nobody');
    const parts = pace.parts.center * pace.parts.time * pace.parts.grade * pace.parts.rival * pace.parts.mishap;
    expect(own.demand.room.room?.type).toBe('kneader');
    expect(own.demand.pull).toBeCloseTo(MACHINE_DRAW * own.demand.room.pull * own.demand.flavour, 5);
    expect(own.perMonth).toBeCloseTo(pace.base * parts * pace.difficulty * own.demand.pull, 5);
    expect(pace.perMonth).toBeCloseTo(pace.tables + own.perMonth, 5);
    expect(pace.seconds).toBeCloseTo(180 / pace.perMonth, 5);
    // a finer room draws more, as a discipline's finest room does
    expect(own.demand.room.pull).toBe(roomPull(ctx, own.demand.room.room as never));
  });

  it('draws fewer while nobody is trained to run it, and fewer still behind a long line of its own', () => {
    const { ctx, therapist } = staffed();
    const trained = machineDemand(ctx)[0]?.pull ?? 0;
    therapist.quals = therapist.quals.filter((q) => q !== 'kneading');
    expect(machineDemand(ctx)[0]?.pull).toBeCloseTo(trained * UNTRAINED_PULL, 5);
    therapist.quals.push('kneading');
    // eight waiting for its one chair: past the three nobody minds
    for (let i = 0; i < 8; i++) {
      const g = spawnGuest(ctx, 'chairshaped');
      if (g) {
        g.goal = 'treat';
        g.state = 'waiting';
      }
    }
    const [row] = machineDemand(ctx);
    expect(row?.line).toMatchObject({ waiting: 8, places: 1 });
    expect(row?.pull).toBeCloseTo(trained * lineFactor(8, 1), 5);
  });

  it('draws nobody while it is down, or while its practitioner is away', () => {
    const { ctx, chair, second, therapist } = staffed();
    expect(machineDemand(ctx)[0]?.pull).toBeGreaterThan(0);
    chair.overloaded = true;
    chair.wear = 100;
    expect(machineDemand(ctx)).toEqual([]);
    chair.overloaded = false;
    chair.wear = 0;
    // both therapists away: the chair is paid for, but nobody is at work to run it
    second.state = 'training';
    therapist.state = 'toCall';
    expect(capacity(ctx).machines).toEqual([{ machine: 'kneadmaster', standing: 1, paid: 1, staffed: 0, fed: 0 }]);
    expect(machineDemand(ctx)[0]?.pull).toBe(0);
  });

  it('is kept in guests by the Consultation Rooms before the tables, since its guests are seen there first', () => {
    const { sim, ctx, s, consultant } = staffed();
    // three more tables and therapists: four tables and the chair, for one Consultation Room that keeps four in guests
    const room = sim.createRoom('massage', { x: 4, y: 10, w: 6, h: 6 }, { x: 9, y: 12, dx: 1, dy: 0 });
    let tables = 0;
    for (let y = 10; y < 16 && tables < 3; y++)
      for (let x = 4; x < 10 && tables < 3; x++)
        if (
          sim.world.canPlaceItem('massage_table', x, y, 0, room.id).ok &&
          sim.placeItem('massage_table', x, y, 0, { free: true, roomId: room.id })
        )
          tables++;
    sim.finishRoom(room);
    expect(tables).toBe(3);
    for (let i = 0; i < 3; i++) {
      s.candidates.push(makeCandidate(s, 'therapist'));
      hire(sim, 'therapist');
    }
    expect(capacity(ctx)).toMatchObject({ stations: 4, consults: 1, fed: 3, machines: [{ staffed: 1, fed: 1 }] });
    expect(guestCap(ctx)).toBe(GUEST_CAP.base + GUEST_CAP.station * 4 + GUEST_CAP.consult);
    expect(capacityNote(sim.arrivalPace().capacity)).toContain(
      'each keeps only 4 stations in guests, a signature machine first. Another would let it draw',
    );
    // with nobody to see them, nobody comes for it
    consultant.state = 'leaving';
    expect(capacity(ctx).machines[0]?.fed).toBe(0);
    expect(machineDemand(ctx)[0]?.pull).toBe(0);
    expect(capacityNote(sim.arrivalPace().capacity)).toContain(
      'The Kneadmaster 9000 draws nobody for its own ailments: every guest is seen in a Consultation Room first',
    );
  });

  it('keeps its ailments out of the tables’ guests: they come only for the machine', () => {
    const { ctx } = staffed();
    const own = new Set(CONDITIONS.filter((c) => MODALITIES[c.modality].machine).map((c) => c.id));
    for (let i = 0; i < 2000; i++) expect(own.has(chooseCondition(ctx, Math.random(), Math.random()))).toBe(false);
    const rows = machineDemand(ctx);
    for (let i = 0; i < 200; i++)
      expect(['chairshaped', 'mallback']).toContain(chooseMachineCondition(rows, Math.random(), Math.random()));
    expect(chooseMachineCondition([], 0.5, 0.5)).toBeUndefined();
  });

  it('brings its guests through the door at its share of the pace, and lets more in at once', () => {
    const { sim, ctx, s } = staffed();
    const pace = sim.arrivalPace();
    const share = (pace.machines[0]?.perMonth ?? 0) / pace.perMonth;
    expect(share).toBeGreaterThan(0.1);
    expect(guestCap(ctx)).toBe(GUEST_CAP.base + GUEST_CAP.station * 2 + GUEST_CAP.consult);
    let own = 0;
    const n = 1500;
    for (let i = 0; i < n; i++) {
      s.guests = [];
      s.spawnT = 0;
      admitGuests(ctx, 0.01);
      const g = s.guests.at(-1);
      if (g && MODALITIES[conditionOf(g.condition).modality].machine === 'kneadmaster') own++;
    }
    expect(own / n).toBeGreaterThan(share - 0.05);
    expect(own / n).toBeLessThan(share + 0.05);
  });

  it('says what it draws, and why, where the pace is broken down', () => {
    const { sim, s } = staffed();
    const note = paceNote(sim.arrivalPace(), s.reputation, centerOf(s));
    expect(note).toMatch(/^About \d+ new guests a month\. \d+ come for the treatment stations: /);
    expect(note).toMatch(
      /\d+ come for the Kneadmaster 9000’s own ailments: 35% of the center’s pace for the one with a Massage Therapist of its own to run it/,
    );
    // its room's inspector says how it draws, as a finest room does
    expect(machinePullNote(1, 'kneadmaster').text).toBe(
      'A prestigious, peaceful room draws more guests for the Kneadmaster 9000’s own ailments.',
    );
    expect(machinePullNote(1.43, 'kneadmaster').text).toBe(
      'Draws 1.4× the usual guests for the Kneadmaster 9000, for its prestige and its peace.',
    );
    // with one therapist, the chair takes them and the Guests tab says why the table stands idle
    const { sim: one, s: oneState } = withKneader();
    expect(capacityNote(one.arrivalPace().capacity)).toBe(
      '1 treatment station has nobody on the payroll to work it, since a signature machine takes its practitioner first: a practitioner for each would bring guests more often and let more in at once.',
    );
    // and with nobody in the role, what the chair needs
    for (const st of oneState.staff) if (st.role === 'therapist') st.state = 'leaving';
    expect(capacityNote(one.arrivalPace().capacity)).toContain(
      'The Kneadmaster 9000 draws nobody for its own ailments: nobody on the payroll can run it. A Massage Therapist would bring its guests',
    );
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

  it('draws guests at the pace it always has, to the last digit', () => {
    const { sim, s } = openCenter(5);
    s.open = true;
    s.reputation = 40;
    const pace = sim.arrivalPace();
    const parts = pace.parts.center * pace.parts.time * pace.parts.grade * pace.parts.rival * pace.parts.mishap;
    expect(pace.machines).toEqual([]);
    expect(pace.seconds).toBe((30 - 40 * 0.2) / parts / pace.staffed / pace.lines / pace.difficulty);
    expect(pace.perMonth).toBe(pace.tables);
  });
});
