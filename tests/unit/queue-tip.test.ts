import { describe, expect, it } from 'vitest';

import { conditionOf, DAY_SECONDS } from '../../src/core/data';
import { createContext } from '../../src/core/sim/context';
import { spawnGuest } from '../../src/core/sim/guests';
import type { Sim } from '../../src/core/sim/sim';
import type { Guest, Item } from '../../src/core/state/types';
import { guestWants, LISTED, LISTED_SEVERAL, roomTip, waitedText } from '../../src/ui/lib/queue-tip';
import { addSound, addStaffRoom, buildRoom, hire, openCenter, runUntil } from './helpers';

/** A guest new to the center, as the sim makes one. */
function newGuest(sim: Sim): Guest {
  const g = spawnGuest(createContext(sim.s));
  if (!g) throw new Error('no guest could get in');
  return g;
}

/** Put guests in a station's line, waiting for treatment, each having waited a little longer than the one after. */
function queueAt(sim: Sim, it: Item, count: number): Guest[] {
  const guests = Array.from({ length: count }, () => newGuest(sim));
  guests.forEach((g, i) => {
    g.goal = 'treat';
    g.state = 'waiting';
    g.station = it.id;
    g.waited = (count - i) * DAY_SECONDS;
    it.queue.push(g.id);
  });
  return guests;
}

/** A staffed Massage Suite, with its therapist at the table and nobody seen or waiting yet. */
function quietSuite() {
  const center = openCenter(1);
  const { sim, massage, therapist } = center;
  const table = sim.s.items.find((i) => i.type === 'massage_table');
  if (!table) throw new Error('no table');
  runUntil(sim, () => therapist.state === 'atPost' && therapist.post === table.id, 120);
  // nobody comes in while the test sets the line up
  sim.s.speed = 0;
  for (const g of [...sim.s.guests]) sim.sendHome(g.id);
  table.queue = [];
  table.serving = 0;
  return { ...center, room: massage, table };
}

describe('the tooltip over a room', () => {
  it('names the room and who works its line, and says in a word that nobody is waiting', () => {
    const { sim, room, therapist } = quietSuite();
    expect(roomTip(sim, room)).toEqual({
      name: 'Massage Suite',
      icon: 'room-massage',
      lines: [{ name: '', seeing: `${therapist.name} is free`, waiting: [], more: 0 }],
    });
  });

  it('lists the first few waiting in order, with what they came for, how long they have waited and emergencies', () => {
    const { sim, room, table } = quietSuite();
    const guests = queueAt(sim, table, LISTED + 2);
    const [first, second] = guests;
    if (!first || !second) throw new Error('no guests');
    second.emergency = true;
    const tip = roomTip(sim, room);
    const line = tip?.lines[0];
    expect(line?.waiting.map((g) => g.id)).toEqual(guests.slice(0, LISTED).map((g) => g.id));
    expect(line?.waiting[0]).toEqual({
      id: first.id,
      name: first.name,
      wants: conditionOf(first.condition).treatment,
      waited: `${LISTED + 2} days`,
      emergency: false,
    });
    expect(line?.waiting[1]?.emergency).toBe(true);
    expect(line?.more, 'the rest are counted').toBe(2);
  });

  it('says who is being seen and by whom, or who is on the way in', () => {
    const { sim, room, table, therapist } = quietSuite();
    const [g] = queueAt(sim, table, 1);
    if (!g) throw new Error('no guest');
    table.queue = [];
    table.serving = g.id;
    g.state = 'called';
    expect(roomTip(sim, room)?.lines[0]?.seeing).toBe(`${therapist.name} is calling ${g.name} in`);
    g.state = 'served';
    expect(roomTip(sim, room)?.lines[0]?.seeing).toBe(`${therapist.name} is treating ${g.name}`);
  });

  it('says when nobody works the line', () => {
    const { sim, room, therapist } = quietSuite();
    therapist.post = 0;
    expect(roomTip(sim, room)?.lines[0]?.seeing).toBe('No Massage Therapist at work');
  });

  it('shows each station of a room with several, numbered, listing fewer guests at each', () => {
    const { sim } = openCenter(1);
    const room = buildRoom(sim, 'massage', { x: 17, y: 5, w: 6, h: 4 }, { x: 18, y: 8, dx: 0, dy: 1 }, [
      ['massage_table', 18, 5],
      ['massage_table', 21, 5],
      ['oil_trolley', 17, 5],
    ]);
    const tables = sim.s.items.filter((i) => i.type === 'massage_table' && sim.world.zoneAt(i.x, i.y) === room.id);
    const [a, b] = tables;
    if (!a || !b) throw new Error('no tables');
    queueAt(sim, a, LISTED_SEVERAL + 1);
    const tip = roomTip(sim, room);
    expect(tip?.name).toBe('Massage Suite 2');
    expect(tip?.lines.map((l) => l.name)).toEqual(['Massage Table 1', 'Massage Table 2']);
    expect(tip?.lines[0]?.waiting).toHaveLength(LISTED_SEVERAL);
    expect(tip?.lines[0]?.more).toBe(1);
    expect(tip?.lines[1]?.waiting).toEqual([]);
  });

  it('takes a room’s mats as one line, worked by whoever is at its lead station, in the order they will be called', () => {
    const { sim } = openCenter(1);
    sim.s.stars = 1;
    const room = addSound(sim);
    hire(sim, 'healer');
    const [m1, m2] = sim.s.items.filter((i) => i.type === 'sound_mat');
    if (!m1 || !m2) throw new Error('no mats');
    sim.s.speed = 0;
    const one = queueAt(sim, m1, 2);
    const two = queueAt(sim, m2, 1);
    const line = roomTip(sim, room)?.lines;
    expect(line?.map((l) => l.name)).toEqual(['']);
    expect(line?.[0]?.waiting.map((g) => g.id)).toEqual([one[0]?.id, two[0]?.id, one[1]?.id]);
  });

  it('has nothing to say for a room with no line, or a blueprint', () => {
    const { sim } = openCenter(1);
    expect(roomTip(sim, addStaffRoom(sim))).toBeNull();
    const blueprint = sim.createRoom('massage', { x: 17, y: 11, w: 4, h: 4 }, { x: 18, y: 14, dx: 0, dy: 1 });
    expect(roomTip(sim, blueprint)).toBeNull();
  });
});

describe('a guest in the tooltip', () => {
  it('waited to a tenth of a day', () => {
    expect(waitedText(0)).toBe('just now');
    expect(waitedText(DAY_SECONDS)).toBe('1 day');
    expect(waitedText(DAY_SECONDS * 2.46)).toBe('2.5 days');
  });

  it('came for their treatment once it is known, and as much as is known before', () => {
    const { sim } = openCenter(1);
    const g = newGuest(sim);
    g.goal = 'consult';
    g.consults = 0;
    expect(guestWants(g)).toBe('Undiagnosed');
    g.goal = 'treat';
    expect(guestWants(g)).toBe(conditionOf(g.condition).treatment);
    g.goal = 'shop';
    expect(guestWants(g)).toBe('Shopping');
  });
});
