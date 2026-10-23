// A first go at the campaign looks ahead to what the center will soon need, and harm that keeps coming to guests is
// explained, with what is behind it and what helps, once it has happened a few times for the same reason.
import { describe, expect, it } from 'vitest';

import type { SimContext } from '../../src/core/sim/context';
import { failureCause, failureCosts, HARM_EXPLAIN, noteFailure, noteHarm } from '../../src/core/sim/harms';
import { PRIMER_TIRING } from '../../src/core/sim/primer';
import type { Sim } from '../../src/core/sim/sim';
import { addStaffRoom, addTraining, hire, openCenter, run, runUntil, toasts } from './helpers';

/** The simulation's own context, for the functions that take it. */
const ctxOf = (sim: Sim) => (sim as unknown as { ctx: SimContext }).ctx;

/** A center open and staffed, on a first go at the campaign. */
function firstGame() {
  const game = openCenter(1);
  game.s.primer = true;
  return game;
}

describe('the first game’s heads-ups', () => {
  it('stay away from any other game', () => {
    const { sim, s } = openCenter(1);
    s.stats.healed = 1;
    expect(sim.primerLines()).toEqual([]);
    expect(sim.adviceNote().label).toBeUndefined();
  });

  it('list what the center will need, ticking off what is in place', () => {
    const { sim } = firstGame();
    expect(sim.primerLines()).toEqual([
      { id: 'open', label: 'Open with a Massage Suite and a Therapist', done: true },
      { id: 'caretaker', label: 'Hire a Caretaker', done: false },
      { id: 'smudging', label: 'Train a Caretaker in Smudging', done: false },
      { id: 'staffroom', label: 'Build a Staff Room', done: false },
    ]);
  });

  it('say a Caretaker will be needed once the first guest is healed, ahead of any litter', () => {
    const { sim, s } = firstGame();
    expect(sim.adviceNote().label).toBeUndefined();
    sim.drain();
    runUntil(sim, () => s.stats.healed >= 1, 600);
    run(sim, 1.5);
    expect(s.litter.length).toBeLessThan(3);
    expect(sim.adviceNote()).toMatchObject({ label: 'Coming up', text: expect.stringMatching(/Hire a Caretaker/) });
    const said = toasts(sim.drain()).filter((t) => t.includes('Hire a Caretaker'));
    expect(said).toHaveLength(1);
    // once only
    run(sim, 5);
    expect(toasts(sim.drain()).filter((t) => t.includes('Hire a Caretaker'))).toEqual([]);
  });

  it('turn to Smudging once there is a Caretaker, by way of a Training Room if there is none', () => {
    const { sim, s } = firstGame();
    s.stats.healed = 1;
    hire(sim, 'caretaker');
    expect(sim.adviceNote().text).toMatch(/Build a Training Room .* Smudging course/);
    addTraining(sim);
    const caretaker = s.staff.find((st) => st.role === 'caretaker')!;
    expect(sim.adviceNote()).toMatchObject({
      label: 'Coming up',
      text: expect.stringMatching(/^Sooner or later a treatment fails.*Select a Caretaker/),
      about: { kind: 'staff', id: caretaker.id },
    });
    caretaker.general.push('smudging');
    expect(sim.primerLines().find((l) => l.id === 'smudging')?.done).toBe(true);
  });

  it('wait on a month’s wages in hand before asking for a hire', () => {
    const { sim, s } = firstGame();
    s.stats.healed = 1;
    s.money = 500;
    sim.drain();
    run(sim, 1.5);
    const said = toasts(sim.drain()).find((t) => t.includes('Hire a Caretaker'));
    expect(said).toMatch(/Wait until there is a month's wages in hand/);
  });

  it('end for good, with a word, once everything is in place', () => {
    const { sim, s } = firstGame();
    hire(sim, 'caretaker').general.push('smudging');
    addStaffRoom(sim);
    sim.drain();
    run(sim, 1.5);
    expect(s.primer).toBe(false);
    expect(sim.primerLines()).toEqual([]);
    expect(toasts(sim.drain())).toContainEqual(expect.stringMatching(/everything it needs to get going/));
  });

  it('say a Staff Room will be needed as soon as someone starts to tire', () => {
    const { sim, s, therapist } = firstGame();
    hire(sim, 'caretaker').general.push('smudging');
    therapist.energy = PRIMER_TIRING - 1;
    expect(sim.adviceNote().text).toMatch(/Build a Staff Room/);
    expect(s.primer).toBe(true);
  });
});

describe('harm that keeps coming to guests', () => {
  it(`is explained the ${HARM_EXPLAIN}rd time it comes for the same reason, and only then`, () => {
    const { sim, s } = openCenter(1);
    const ctx = ctxOf(sim);
    let asked = 0;
    /** An explanation, counting the times it is asked for. */
    const explain = () => {
      asked++;
      return { title: 'T', cost: 'C', causes: [], help: 'H' };
    };
    for (let i = 0; i < HARM_EXPLAIN + 3; i++) noteHarm(ctx, 'failed:vibes', explain);
    noteHarm(ctx, 'failed:tired', explain);
    expect(asked).toBe(1);
    expect(s.harms).toEqual({ 'failed:vibes': HARM_EXPLAIN + 3, 'failed:tired': 1 });
    expect(s.harmNotes.map((n) => n.key)).toEqual(['failed:vibes']);
    sim.dismissHarm();
    expect(s.harmNotes).toEqual([]);
  });

  it('names bad vibes as why treatments failed, with what they took off, and points to a Caretaker', () => {
    const { sim, s, massage, therapist } = openCenter(1);
    runUntil(sim, () => s.guests.length > 0, 300);
    const g = s.guests[0]!;
    const table = s.items.find((i) => i.type === 'massage_table')!;
    massage.vibes = 100;
    therapist.energy = 100;
    g.health = 100;
    g.diagnosis = 1;
    const ctx = ctxOf(sim);
    expect(failureCause('', failureCosts(ctx, table, therapist, g))).toBe('vibes');
    for (let i = 0; i < HARM_EXPLAIN; i++) noteFailure(ctx, table, therapist, g, '');
    const [note] = s.harmNotes;
    expect(note).toMatchObject({
      key: 'failed:vibes',
      title: `${HARM_EXPLAIN} treatments have failed with bad vibes in the room`,
      about: { kind: 'room', id: massage.id },
      fix: { hire: 'caretaker' },
    });
    expect(note?.causes[0]).toEqual({ label: 'Bad vibes in the Massage Suite', amount: '−15%' });
    expect(note?.help).toMatch(/Smudging/);
  });

  it('puts what stopped a treatment being delivered ahead of anything else', () => {
    const { sim, s, massage, therapist } = openCenter(1);
    runUntil(sim, () => s.guests.length > 0, 300);
    const g = s.guests[0]!;
    const table = s.items.find((i) => i.type === 'massage_table')!;
    massage.vibes = 100;
    expect(failureCause('unqualified', failureCosts(ctxOf(sim), table, therapist, g))).toBe('unqualified');
  });

  it('calls a failure with nothing much wrong just the odds', () => {
    const { sim, s, therapist } = openCenter(1);
    runUntil(sim, () => s.guests.length > 0, 300);
    const g = s.guests[0]!;
    const table = s.items.find((i) => i.type === 'massage_table')!;
    therapist.energy = 100;
    therapist.skill = 1;
    g.health = 100;
    g.diagnosis = 0.6;
    // a Trainee's hands and an unsure diagnosis are listed, but every treatment has some of that
    const costs = failureCosts(ctxOf(sim), table, therapist, g);
    expect(costs.map((c) => c.cause)).toEqual(['skill', 'diagnosis']);
    expect(failureCause('', costs)).toBe('odds');
  });

  it('is counted every time a visit ends badly, so the counts match the records', () => {
    const { sim, s } = openCenter(3);
    run(sim, 900);
    /** The harms of one kind counted, whatever the reason. */
    const counted = (kind: string) =>
      Object.entries(s.harms)
        .filter(([k]) => k === kind || k.startsWith(`${kind}:`))
        .reduce((n, [, v]) => n + v, 0);
    expect(s.stats.failed + s.stats.stormed + s.stats.worse + s.stats.priced).toBeGreaterThan(0);
    expect(counted('failed')).toBe(s.stats.failed);
    expect(counted('stormed')).toBe(s.stats.stormed);
    expect(counted('worse')).toBe(s.stats.worse);
    expect(counted('priced')).toBe(s.stats.priced);
    // and each reason that came often enough has its explanation, and no other does
    const due = Object.entries(s.harms)
      .filter(([, n]) => n >= HARM_EXPLAIN)
      .map(([k]) => k);
    expect(s.harmNotes.map((n) => n.key).sort()).toEqual(due.sort());
  });
});
