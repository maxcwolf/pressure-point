// Complaints: a guest let down by the wait or an accident can be asked back, free and first in line, to win back half
// of what they cost; a complaint left unanswered lapses after a few days.
import { describe, expect, it } from 'vitest';

import { COMP_CONDITION, COMP_SHARE, COMPLAINT_DAYS, FEELINGS, REGULAR_LOYALTY } from '../../src/core/data';
import { haveAccident } from '../../src/core/sim/accidents';
import { admitGuests, spawnGuest } from '../../src/core/sim/arrivals';
import {
  answerComplaint,
  ASKED_BACK_LINES,
  complains,
  COMPLAINT_LINE,
  dropComplaint,
  dueComplaint,
  fileComplaint,
  lapseComplaints,
  madeRight,
  openComplaints,
} from '../../src/core/sim/complaints';
import type { SimContext } from '../../src/core/sim/context';
import { drainEvents } from '../../src/core/sim/events';
import { reviewText } from '../../src/core/sim/feelings';
import { decide } from '../../src/core/sim/lines';
import { afterVisit, dueRegular, mindsPrice } from '../../src/core/sim/regulars';
import type { Sim } from '../../src/core/sim/sim';
import { worseOff } from '../../src/core/sim/worsening';
import type { Complaint, Guest, Regular } from '../../src/core/state/types';
import { upgradeSave } from '../../src/core/state/upgrade';
import {
  complaintBack,
  complaintCard,
  complaintNote,
  complaintSaid,
  makeItRightNote,
} from '../../src/ui/lib/complaints';
import { openCenter, runUntil, toasts } from './helpers';

/** The simulation's own context, for calling its parts directly. */
const ctxOf = (sim: Sim) => (sim as unknown as { ctx: SimContext }).ctx;

/** A guest come in for Desk Slump, a Swedish massage. */
function slumped(sim: Sim, over: Partial<Guest> = {}): Guest {
  const g = spawnGuest(ctxOf(sim), 'slump');
  if (!g) throw new Error('no guest');
  return Object.assign(g, over);
}

/** A complaint left by a guest with Desk Slump, a day ago. */
const complaint = (sim: Sim, over: Partial<Complaint> = {}): Complaint => ({
  id: 901,
  name: 'Ada Twinge',
  look: sim.s.candidates[0]!.look,
  condition: 'slump',
  diagnosis: 0.4,
  end: 'stormed',
  waited: 9,
  day: sim.s.day,
  cost: 3,
  ...over,
});

/** A regular, due back on a day. */
const regular = (sim: Sim, over: Partial<Regular> = {}): Regular => ({
  id: 7,
  name: 'Margo Finch',
  look: sim.s.candidates[0]!.look,
  visits: 2,
  loyalty: REGULAR_LOYALTY,
  due: 0,
  ...over,
});

describe('a complaint', () => {
  it('is left by a guest who goes home worse off, with what it really cost', () => {
    const { sim, s } = openCenter();
    s.reputation = 50;
    const g = slumped(sim, { goal: 'treat', diagnosis: 0.8 });
    worseOff(ctxOf(sim), g);
    expect(s.complaints).toEqual([
      expect.objectContaining({
        id: g.id,
        name: g.name,
        look: g.look,
        condition: 'slump',
        diagnosis: 0.8,
        modality: 'swedish',
        end: 'worse',
        cost: 50 - s.reputation,
      }),
    ]);
    expect(s.complaints[0]!.cost).toBeGreaterThan(0);
  });

  it('is left by a guest who storms out of a line', () => {
    const { sim, s } = openCenter();
    const g = slumped(sim);
    runUntil(sim, () => g.state === 'waiting', 60);
    g.patience = 0;
    sim.tick(0.1);
    expect(g.outcome).toBe('stormed');
    expect(s.complaints).toEqual([expect.objectContaining({ id: g.id, end: 'stormed' })]);
    // not yet in a treatment's line, so no treatment to name
    expect(s.complaints[0]!.modality).toBeUndefined();
  });

  it('is left by a guest who goes home after an accident', () => {
    const { sim, s } = openCenter();
    const g = slumped(sim);
    runUntil(sim, () => g.state === 'waiting', 60);
    g.patience = 0;
    haveAccident(ctxOf(sim), g);
    expect(g.outcome).toBe('stormed');
    expect(s.complaints).toEqual([expect.objectContaining({ id: g.id, end: 'accident' })]);
  });

  it('is left by nobody put off by a price, come in an emergency or for a class, or asked back once already', () => {
    const { sim } = openCenter();
    const g = slumped(sim, { outcome: 'stormed' });
    expect(complains(g)).toBe(true);
    expect(complains({ ...g, outcome: 'worse' })).toBe(true);
    expect(complains({ ...g, feelings: ['pricey'] })).toBe(false);
    expect(complains({ ...g, emergency: true })).toBe(false);
    expect(complains({ ...g, classDay: 12 })).toBe(false);
    expect(complains({ ...g, comp: 3 })).toBe(false);
    for (const outcome of ['healed', 'failed', 'sent', 'class'] as const)
      expect(complains({ ...g, outcome })).toBe(false);
  });

  it('is not left by a guest sent home', () => {
    const { sim, s } = openCenter();
    const g = slumped(sim);
    runUntil(sim, () => g.state === 'waiting', 60);
    expect(sim.sendHome(g.id)).toBe(true);
    expect(s.complaints).toEqual([]);
  });

  it('lapses once it has waited its days unanswered', () => {
    const { sim, s } = openCenter();
    s.complaints = [complaint(sim, { day: 10 })];
    s.day = 10 + COMPLAINT_DAYS - 0.1;
    lapseComplaints(ctxOf(sim));
    expect(openComplaints(s)).toHaveLength(1);
    s.day = 10 + COMPLAINT_DAYS;
    lapseComplaints(ctxOf(sim));
    expect(s.complaints).toEqual([]);
  });

  it('can be let go at once, but not once its guest has been asked back', () => {
    const { sim, s } = openCenter();
    s.complaints = [complaint(sim), complaint(sim, { id: 902 })];
    expect(sim.dropComplaint(901)).toBe(true);
    expect(s.complaints.map((c) => c.id)).toEqual([902]);
    expect(sim.answerComplaint(902)).toBe(true);
    expect(sim.dropComplaint(902)).toBe(false);
    expect(sim.answerComplaint(902)).toBe(false);
  });

  it('is gone from an older save, which loads with none', () => {
    const { s } = openCenter();
    const old = structuredClone(s) as Partial<typeof s>;
    delete old.complaints;
    old.version = 48;
    upgradeSave(old as typeof s);
    expect(old.complaints).toEqual([]);
  });
});

describe('a guest asked back', () => {
  it('is due the next day, and comes on top of the usual arrivals', () => {
    const { sim, s } = openCenter();
    s.open = true;
    s.day = 20.4;
    s.complaints = [complaint(sim)];
    expect(answerComplaint(ctxOf(sim), 901)).toBe(true);
    expect(s.complaints[0]!.due).toBe(21);
    expect(dueComplaint(s)).toBeUndefined();
    // nobody new is due for a long while
    s.spawnT = 1e9;
    s.day = 21;
    const before = s.guests.length;
    admitGuests(ctxOf(sim), 0.1);
    expect(s.guests).toHaveLength(before + 1);
    const g = s.guests.at(-1)!;
    expect(g).toMatchObject({ name: 'Ada Twinge', condition: 'slump', comp: 3, health: COMP_CONDITION, patience: 100 });
    expect(s.complaints).toEqual([]);
    expect(drainEvents(ctxOf(sim))).toContainEqual(expect.objectContaining({ type: 'float', text: 'Asked back' }));
  });

  it('waits for room under the limit on guests at once, and while the doors are shut', () => {
    const { sim, s } = openCenter();
    s.open = true;
    s.complaints = [complaint(sim, { due: 0 })];
    s.spawnT = 1e9;
    s.intakeCap = 0;
    admitGuests(ctxOf(sim), 0.1);
    expect(s.complaints).toHaveLength(1);
    s.intakeCap = null;
    s.open = false;
    admitGuests(ctxOf(sim), 0.1);
    expect(s.complaints).toHaveLength(1);
    s.open = true;
    admitGuests(ctxOf(sim), 0.1);
    expect(s.complaints).toEqual([]);
  });

  it('goes straight to treatment with a sure diagnosis, and through Reception without one', () => {
    const { sim, s } = openCenter();
    const sure = spawnGuest(ctxOf(sim), 'slump', false, 0, undefined, complaint(sim, { diagnosis: 0.9 }))!;
    expect(sure).toMatchObject({ goal: 'treat', diagnosis: 0.9 });
    const unsure = spawnGuest(ctxOf(sim), 'slump', false, 0, undefined, complaint(sim, { diagnosis: 0.4 }))!;
    expect(unsure).toMatchObject({ goal: 'reception', diagnosis: 0.4 });
    expect(s.policy.diagnosis).toBeGreaterThan(0.4);
  });

  it('goes to the front of the line, and stays there', () => {
    const { sim } = openCenter();
    const ctx = ctxOf(sim);
    const waiting = [slumped(sim, { goal: 'treat', diagnosis: 1 }), slumped(sim, { goal: 'treat', diagnosis: 1 })];
    for (const g of waiting) decide(ctx, g);
    const back = slumped(sim, { goal: 'treat', diagnosis: 1, comp: 3 });
    decide(ctx, back);
    const table = sim.s.items.find((i) => i.id === back.station)!;
    expect(table.queue[0]).toBe(back.id);
    expect(back.placed).toBe(true);
    // the next to come joins the back as usual
    const after = slumped(sim, { goal: 'treat', diagnosis: 1 });
    decide(ctx, after);
    if (after.station === table.id) expect(table.queue.at(-1)).toBe(after.id);
  });

  it('never balks at a price', () => {
    const { sim } = openCenter();
    expect(mindsPrice(sim.s, { emergency: false, comp: 3 })).toBe(0);
  });

  it('pays nothing, and healed, wins back exactly half of what the complaint cost', () => {
    const { sim, s, therapist } = openCenter();
    s.open = true;
    s.spawnT = 1e9;
    therapist.skill = 5;
    s.reputation = 40;
    const g = spawnGuest(ctxOf(sim), 'slump', false, 0, undefined, complaint(sim, { diagnosis: 1, cost: 4 }))!;
    runUntil(sim, () => g.outcome !== '', 300);
    expect(g.outcome).toBe('healed');
    expect(s.ledger.treatment).toBe(0);
    expect(s.ledger.consult).toBe(0);
    expect(s.reputation).toBeCloseTo(40 + 4 * COMP_SHARE, 6);
  });

  it('wins back half at either end of the scale, never more', () => {
    const { sim, s } = openCenter();
    const g = slumped(sim, { comp: 6 });
    s.reputation = 99;
    madeRight(ctxOf(sim), g);
    expect(s.reputation).toBe(100);
    s.reputation = 1;
    madeRight(ctxOf(sim), g);
    expect(s.reputation).toBe(1 + 6 * COMP_SHARE);
  });

  it('leaves no second complaint if let down again', () => {
    const { sim, s } = openCenter();
    const g = slumped(sim, { goal: 'treat', comp: 3 });
    const before = s.reputation;
    worseOff(ctxOf(sim), g);
    expect(s.reputation).toBeLessThan(before);
    expect(s.complaints).toEqual([]);
  });
});

describe('a guest made right', () => {
  it('says so in their review, and makes the town paper', () => {
    const { sim, s, therapist } = openCenter();
    s.open = true;
    s.spawnT = 1e9;
    therapist.skill = 5;
    const c = complaint(sim, { diagnosis: 1, end: 'worse', name: 'Bo Kettle' });
    const g = spawnGuest(ctxOf(sim), 'slump', false, 0, undefined, c)!;
    runUntil(sim, () => g.outcome !== '', 300);
    expect(g.outcome).toBe('healed');
    const review = s.reviews.at(-1)!;
    expect(review.feelings).toContain('made-right');
    expect(FEELINGS['made-right'].lines).toContain(review.text);
    expect(s.news).toContainEqual(expect.objectContaining({ kind: 'made-right', how: 'worse', who: 'Bo Kettle' }));
  });

  it('writes about being made right above being seen quickly', () => {
    const { sim } = openCenter();
    const g = slumped(sim, { feelings: ['made-right', 'healed', 'quick'] });
    expect(FEELINGS['made-right'].lines).toContain(reviewText(g, 5));
    // let down by more than a robe could fix, they say what went wrong
    const sore = slumped(sim, { feelings: ['made-right', 'healed', 'grump'] });
    expect(FEELINGS.grump.lines).toContain(reviewText(sore, 2));
  });
});

describe('the speakers', () => {
  /** What the speakers have said since last asked. */
  const said = (sim: Sim) => drainEvents(ctxOf(sim)).flatMap((e) => (e.type === 'announce' ? [e.text] : []));

  it('mention complaints as one is left, once a day at most', () => {
    const { sim, s } = openCenter();
    s.day = 10.2;
    worseOff(ctxOf(sim), slumped(sim, { goal: 'treat' }));
    worseOff(ctxOf(sim), slumped(sim, { goal: 'treat' }));
    expect(s.complaints).toHaveLength(2);
    expect(said(sim).filter((t) => t === COMPLAINT_LINE)).toHaveLength(1);
    s.day = 11.5;
    worseOff(ctxOf(sim), slumped(sim, { goal: 'treat' }));
    expect(said(sim)).toContain(COMPLAINT_LINE);
  });

  it('greet each guest asked back with the next of their lines', () => {
    const { sim, s } = openCenter();
    s.open = true;
    s.spawnT = 1e9;
    const heard: string[] = [];
    for (const id of [901, 902, 903]) {
      s.complaints = [complaint(sim, { id, due: 0 })];
      drainEvents(ctxOf(sim));
      admitGuests(ctxOf(sim), 0.1);
      heard.push(...said(sim).filter((t) => ASKED_BACK_LINES.includes(t)));
    }
    expect(heard).toEqual([ASKED_BACK_LINES[0], ASKED_BACK_LINES[1], ASKED_BACK_LINES[0]]);
  });
});

describe('a regular who leaves a complaint', () => {
  it('keeps their place while it is open, though the visit took their loyalty to nothing', () => {
    const { sim, s } = openCenter();
    const r = regular(sim, { loyalty: 1 });
    s.regulars = [r];
    const g = slumped(sim, { regular: r.id, goal: 'treat', outcome: 'worse' });
    afterVisit(ctxOf(sim), g, 1, false);
    expect(r.loyalty).toBe(0);
    expect(s.regulars).toEqual([r]);
    fileComplaint(ctxOf(sim), g, 6);
    expect(s.complaints[0]!.regular).toBe(r.id);
    // their visit waits on the complaint
    expect(dueRegular(s)).toBeUndefined();
  });

  it('goes for good if it lapses, as they would have gone', () => {
    const { sim, s } = openCenter();
    const r = regular(sim, { loyalty: 0 });
    s.regulars = [r];
    s.complaints = [complaint(sim, { regular: r.id, day: 0 })];
    s.day = COMPLAINT_DAYS;
    drainEvents(ctxOf(sim));
    lapseComplaints(ctxOf(sim));
    expect(s.regulars).toEqual([]);
    expect(toasts(drainEvents(ctxOf(sim)))).toContain('Margo Finch has had enough, and will not be coming back.');
  });

  it('comes back as themselves when asked, and stays a regular after', () => {
    const { sim, s } = openCenter();
    s.open = true;
    s.spawnT = 1e9;
    const r = regular(sim, { loyalty: 0 });
    s.regulars = [r];
    s.complaints = [complaint(sim, { name: r.name, look: r.look, regular: r.id, due: 0 })];
    admitGuests(ctxOf(sim), 0.1);
    expect(s.guests.at(-1)).toMatchObject({ name: r.name, regular: r.id, comp: 3 });
    expect(r.visits).toBe(3);
    expect(s.regulars).toEqual([r]);
  });

  it('of good standing comes back for their usual visits once the complaint is let go', () => {
    const { sim, s } = openCenter();
    const r = regular(sim, { due: 0 });
    s.regulars = [r];
    s.complaints = [complaint(sim, { regular: r.id })];
    expect(dueRegular(s)).toBeUndefined();
    dropComplaint(ctxOf(sim), 901);
    expect(dueRegular(s)).toBe(r);
    expect(s.regulars).toEqual([r]);
  });
});

describe('what the interface says about a complaint', () => {
  it('says what went wrong, with the treatment they were waiting for when there was one', () => {
    const { sim } = openCenter();
    expect(complaintSaid(complaint(sim, { modality: 'deep' }))).toBe(
      'Ada Twinge stormed out of the Deep Tissue line after 9 days.',
    );
    expect(complaintSaid(complaint(sim, { waited: 0.2 }))).toBe('Ada Twinge stormed out after 1 day waiting.');
    expect(complaintSaid(complaint(sim, { end: 'worse', modality: 'cupping', waited: 14 }))).toBe(
      'Ada Twinge went home worse off after 14 days waiting for Cupping.',
    );
    expect(complaintSaid(complaint(sim, { end: 'accident' }))).toBe(
      'Ada Twinge went home after an accident in the waiting area.',
    );
  });

  it('says what asking them back does and wins back, and where it stands', () => {
    expect(makeItRightNote({ cost: 3 })).toBe(
      'Free, first in line. Healed: +1.5 reputation back. Let down again: the usual loss, and no second chance.',
    );
    expect(complaintBack({ cost: 2.37 })).toBe(1.2);
    expect(complaintNote({ day: 10 }, 10.5)).toBe(`Lapses in ${COMPLAINT_DAYS} days`);
    expect(complaintNote({ day: 10 }, 10 + COMPLAINT_DAYS - 0.5)).toBe('Lapses in 1 day');
    expect(complaintNote({ day: 10, due: 12 }, 11.5)).toBe('Asked back: due tomorrow');
    expect(complaintNote({ day: 10, due: 12 }, 12.2)).toBe('Asked back: on their way');
  });

  it('puts every complaint open on one card', () => {
    expect(complaintCard([{ name: 'Ada Twinge' }])).toBe('Ada Twinge left a complaint');
    expect(complaintCard([{ name: 'Ada Twinge' }, { name: 'Bo Kettle' }, { name: 'Cy Plover' }])).toBe(
      'Ada Twinge and 2 more left complaints',
    );
  });
});
