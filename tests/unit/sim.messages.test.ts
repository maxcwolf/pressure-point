// Messages that know what they are about, so clicking one can take the player there.
import { describe, expect, it } from 'vitest';

import type { SimEvent, Subject } from '../../src/core/sim/events';
import { addStaffRoom, hire, LAYOUT, openCenter, run, runUntil } from './helpers';

/** What the toasts in a batch of events are about. */
const toastSubjects = (events: SimEvent[]) =>
  events.flatMap((e) => (e.type === 'toast' ? [{ text: e.text, about: e.about }] : []));

describe('toasts about someone or something', () => {
  it('point at a new member of staff', () => {
    const { sim } = openCenter(1);
    sim.drain();
    const janitor = hire(sim, 'caretaker');
    const [joined] = toastSubjects(sim.drain());
    expect(joined?.about).toEqual({ kind: 'staff', id: janitor.id });
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
  it('point at the member of staff who wants a raise', () => {
    const { sim, therapist } = openCenter(1);
    therapist.raiseAsked = true;
    const note = sim.adviceNote();
    expect(note.text).toMatch(/wants a raise/);
    expect(note.about).toEqual({ kind: 'staff', id: therapist.id });
    expect(sim.advice()).toBe(note.text);
  });

  it('point at a broken item, and at a station with a line and nobody on it', () => {
    const { sim, s } = openCenter(1);
    const table = s.items.find((i) => i.type === 'massage_table')!;
    table.wear = 100;
    expect(sim.adviceNote().text).toMatch(/broken down/);
    expect(sim.adviceNote().about).toEqual({ kind: 'item', id: table.id });
    table.wear = 0;
    // the therapist is on the payroll but away from the table
    table.staffId = 0;
    table.queue = [9001, 9002];
    expect(sim.adviceNote().text).toMatch(/nobody staffing it/);
    expect(sim.adviceNote().about).toEqual({ kind: 'item', id: table.id });
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
