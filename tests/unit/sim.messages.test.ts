// Messages that know what they are about, so clicking one can take the player there.
import { describe, expect, it } from 'vitest';

import { bottleneckAdvice } from '../../src/core/sim/advisor';
import type { SimContext } from '../../src/core/sim/context';
import type { SimEvent, Subject } from '../../src/core/sim/events';
import { raiseRequests } from '../../src/ui/lib/status';
import { addStaffRoom, hire, LAYOUT, openCenter, run, runUntil } from './helpers';

/** What the toasts in a batch of events are about. */
const toastSubjects = (events: SimEvent[]) =>
  events.flatMap((e) => (e.type === 'toast' ? [{ text: e.text, about: e.about }] : []));

describe('toasts about someone or something', () => {
  it('point at a new member of staff', () => {
    const { sim } = openCenter(1);
    sim.drain();
    const caretaker = hire(sim, 'caretaker');
    const [joined] = toastSubjects(sim.drain());
    expect(joined?.about).toEqual({ kind: 'staff', id: caretaker.id });
  });

  it('point at an item that breaks down', () => {
    const { sim, s } = openCenter(1);
    const table = s.items.find((i) => i.type === 'massage_table')!;
    table.wear = 99;
    sim.drain();
    runUntil(sim, () => table.wear >= 100, 300);
    const broken = toastSubjects(sim.drain()).find((t) => t.text.includes('broken down'));
    expect(broken?.about).toEqual({ kind: 'item', id: table.id });
  });

  it('point at a new room', () => {
    const { sim, s } = openCenter(1);
    sim.drain();
    const room = addStaffRoom(sim);
    expect(s.rooms).toContain(room);
    const built = toastSubjects(sim.drain()).find((t) => t.text.includes('built'));
    expect(built?.about).toEqual({ kind: 'room', id: room.id });
  });

  it('leave general news alone', () => {
    const { sim, s } = openCenter(1);
    s.day = 29.99;
    sim.drain();
    run(sim, 30);
    const payday = toastSubjects(sim.drain()).find((t) => t.text.startsWith('Payday'));
    expect(payday).toBeDefined();
    expect(payday?.about).toBeUndefined();
  });
});

describe("the advisor's nudges", () => {
  it('leave a raise request to its own card, keeping the advisor for other things', () => {
    const { sim, therapist } = openCenter(1);
    const before = sim.adviceNote();
    therapist.raiseAsked = true;
    expect(sim.adviceNote()).toEqual(before);
    expect(raiseRequests(sim.s.staff)).toEqual([therapist]);
    therapist.state = 'leaving';
    expect(raiseRequests(sim.s.staff)).toEqual([]);
  });

  it('point at a broken item', () => {
    const { sim, s } = openCenter(1);
    const table = s.items.find((i) => i.type === 'massage_table')!;
    table.wear = 100;
    expect(sim.adviceNote().text).toMatch(/broken down/);
    expect(sim.adviceNote().about).toEqual({ kind: 'item', id: table.id });
  });

  it('say which stage holds guests up, and why, pointing at its longest line', () => {
    const { sim, s, therapist } = openCenter(1);
    runUntil(sim, () => s.guests.length > 0, 300);
    therapist.state = 'atPost';
    const table = s.items.find((i) => i.type === 'massage_table')!;
    const g = s.guests[0]!;
    table.serving = 0;
    table.queue = [];
    for (let i = 0; i < 4; i++) {
      s.guests.push({ ...g, id: 9100 + i, station: table.id, state: 'waiting', goal: 'treat' });
      table.queue.push(9100 + i);
    }
    // the therapist often away from the table
    table.staffed = 0.4;
    table.busy = 0.3;
    const ctx = (sim as unknown as { ctx: SimContext }).ctx;
    expect(bottleneckAdvice(ctx)).toEqual({
      text: 'Guests wait longest for the Massage Suite: 4 waiting for one Massage Table. It stood empty 60% of the last few days. Its Massage Therapist keeps being called away to breaks or other work. Build a Staff Room nearby, so their breaks are shorter.',
      about: { kind: 'item', id: table.id },
    });
    // at the table and flat out, with the books able to carry another
    s.ledger.treatment = 100_000;
    table.staffed = 0.95;
    table.busy = 0.9;
    expect(bottleneckAdvice(ctx)?.text).toMatch(
      /4 waiting for one Massage Table\. It has been busy 90% of the time\. Another Massage Table and a Massage Therapist/,
    );
    // three waiting is not yet a line worth a word
    table.queue.pop();
    expect(bottleneckAdvice(ctx)).toBeNull();
  });

  it('point at nothing when the advice is general', () => {
    const { sim } = openCenter(1);
    expect(sim.adviceNote().about).toBeUndefined();
  });
});

describe('finding a subject', () => {
  it('finds people where they stand, items by their middle and rooms by theirs', () => {
    const { sim, s, therapist, massage } = openCenter(1);
    expect(sim.whereIs({ kind: 'staff', id: therapist.id })).toEqual([therapist.x, therapist.y]);
    const table = s.items.find((i) => i.type === 'massage_table')!;
    expect(sim.whereIs({ kind: 'item', id: table.id })).toEqual([table.x + 0.5, table.y + 1]);
    const { x, y, w, h } = LAYOUT.massage.rect;
    expect(sim.whereIs({ kind: 'room', id: massage.id })).toEqual([x + w / 2, y + h / 2]);
  });

  it('finds a visitor where they stand, and nothing once they have gone', () => {
    const { sim, s } = openCenter(1);
    runUntil(sim, () => s.open, 60);
    s.nextInspection = 1e9;
    s.visitNotice = { visit: 'inspector', name: 'Pat', title: 'the health inspector', arrives: s.day };
    runUntil(sim, () => s.visitors.length > 0, 10);
    const v = s.visitors[0]!;
    expect(sim.whereIs({ kind: 'visitor', id: v.id })).toEqual([v.x, v.y]);
    runUntil(sim, () => s.visitors.length === 0, 240);
    expect(sim.whereIs({ kind: 'visitor', id: v.id })).toBeNull();
  });

  it('finds nothing once it has gone', () => {
    const { sim, therapist, massage } = openCenter(1);
    const gone: Subject[] = [
      { kind: 'staff', id: 424242 },
      { kind: 'item', id: 424242 },
      { kind: 'room', id: 424242 },
    ];
    for (const about of gone) expect(sim.whereIs(about)).toBeNull();
    sim.fire(therapist.id);
    runUntil(sim, () => !sim.s.staff.includes(therapist), 120);
    expect(sim.whereIs({ kind: 'staff', id: therapist.id })).toBeNull();
    sim.removeRoom(massage.id, 0);
    expect(sim.whereIs({ kind: 'room', id: massage.id })).toBeNull();
  });
});
