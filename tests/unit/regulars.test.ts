// Regulars: guests who enjoyed their visit come back every few weeks under their own name, are greeted at Reception, and
// grow loyal. A vision quest makes a regular of anyone it heals.
import { describe, expect, it } from 'vitest';

import {
  DEVOTED_AT,
  LOYAL_AT,
  REGULAR_GAP_DAYS,
  REGULAR_LOYALTY,
  REGULARS_MAX,
  VISION_LOYALTY,
} from '../../src/core/data';
import type { SimContext } from '../../src/core/sim/context';
import { drainEvents } from '../../src/core/sim/events';
import { admitGuests, spawnGuest } from '../../src/core/sim/guests';
import {
  afterVisit,
  dueRegular,
  greeting,
  loyaltyChange,
  loyaltyLevel,
  regularPatience,
  returnGap,
  takesToPlace,
  tipFor,
} from '../../src/core/sim/regulars';
import type { Sim } from '../../src/core/sim/sim';
import { newGame } from '../../src/core/state/game';
import type { GameState, Guest, Regular } from '../../src/core/state/types';
import { upgradeSave } from '../../src/core/state/upgrade';
import { loyaltyNote, regularTag } from '../../src/ui/lib/regulars';
import { addLodge, freshSim, hire, openCenter, runUntil, toasts } from './helpers';

/** The simulation's own context, for calling its parts directly. */
const ctxOf = (sim: Sim) => (sim as unknown as { ctx: SimContext }).ctx;

/** A guest on the street, with an id that does or does not take to the place. */
function guestWithId(sim: Sim, id: number): Guest {
  const g = spawnGuest(ctxOf(sim));
  if (!g) throw new Error('no guest');
  g.id = id;
  return g;
}

/** A regular, due back on a day. */
const regular = (over: Partial<Regular> = {}): Regular => ({
  id: 3,
  name: 'Margo Finch',
  look: newGame().candidates[0]!.look,
  visits: 1,
  loyalty: REGULAR_LOYALTY,
  due: 10,
  ...over,
});

describe('who becomes a regular', () => {
  it('is one in three of the guests who gave four stars or more, chosen by who they are', () => {
    expect(takesToPlace(9, 5)).toBe(true);
    expect(takesToPlace(9, 4)).toBe(true);
    expect(takesToPlace(9, 3)).toBe(false);
    expect(takesToPlace(10, 5)).toBe(false);
    expect([...Array(30).keys()].filter((id) => takesToPlace(id, 5))).toHaveLength(10);
  });

  it('keeps a guest who enjoyed their visit, with their name and look, due back in a few weeks', () => {
    const sim = freshSim();
    const g = guestWithId(sim, 9);
    afterVisit(ctxOf(sim), g, 5, true);
    const [r] = sim.s.regulars;
    expect(r).toMatchObject({ id: 9, name: g.name, look: g.look, visits: 1, loyalty: REGULAR_LOYALTY });
    expect(r!.due).toBeGreaterThanOrEqual(sim.s.day + REGULAR_GAP_DAYS[0] / 2);
    expect(r!.due).toBeLessThanOrEqual(sim.s.day + REGULAR_GAP_DAYS[1]);
    expect(toasts(drainEvents(ctxOf(sim)))[0]).toContain(`${g.name} enjoyed their visit and will be back`);
  });

  it('leaves out guests who did not enjoy it, or did not take to the place, and stops at the most kept', () => {
    const sim = freshSim();
    afterVisit(ctxOf(sim), guestWithId(sim, 9), 3, true);
    afterVisit(ctxOf(sim), guestWithId(sim, 10), 5, true);
    expect(sim.s.regulars).toHaveLength(0);
    sim.s.regulars = [...Array(REGULARS_MAX).keys()].map((i) => regular({ id: 100 + i }));
    afterVisit(ctxOf(sim), guestWithId(sim, 9), 5, true);
    expect(sim.s.regulars).toHaveLength(REGULARS_MAX);
  });
});

describe('a regular’s loyalty', () => {
  it('reads as regular, loyal or devoted', () => {
    expect(loyaltyLevel(LOYAL_AT - 1)).toBe('regular');
    expect(loyaltyLevel(LOYAL_AT)).toBe('loyal');
    expect(loyaltyLevel(DEVOTED_AT)).toBe('devoted');
  });

  it('rises with a good visit and falls with a bad one', () => {
    expect(loyaltyChange(5)).toBeGreaterThan(loyaltyChange(4));
    expect(loyaltyChange(4)).toBeGreaterThan(0);
    expect(loyaltyChange(3)).toBe(0);
    expect(loyaltyChange(1)).toBeLessThan(loyaltyChange(2));
    expect(loyaltyChange(2)).toBeLessThan(0);
  });

  it('brings them back sooner the more loyal they are, on a day settled by who they are', () => {
    const r = regular();
    expect(returnGap(r)).toBe(returnGap({ ...r }));
    expect(returnGap({ ...r, loyalty: 100 })).toBeLessThan(returnGap({ ...r, loyalty: 0 }));
    for (let id = 0; id < 40; id++) {
      const gap = returnGap({ id, visits: 1, loyalty: 0 });
      expect(gap).toBeGreaterThanOrEqual(REGULAR_GAP_DAYS[0]);
      expect(gap).toBeLessThanOrEqual(REGULAR_GAP_DAYS[1]);
    }
  });

  it('grows after a good visit, says so once they are loyal, and sets their next visit', () => {
    const sim = freshSim();
    const r = regular({ loyalty: LOYAL_AT - 5 });
    sim.s.regulars = [r];
    const g = guestWithId(sim, 50);
    g.regular = r.id;
    sim.s.day = 40;
    afterVisit(ctxOf(sim), g, 5, true);
    expect(r.loyalty).toBe(LOYAL_AT - 5 + loyaltyChange(5));
    expect(r.due).toBe(40 + returnGap(r));
    expect(toasts(drainEvents(ctxOf(sim)))).toEqual([`${r.name} has grown loyal: more patient, and they tip.`]);
  });

  it('runs out after a bad visit or two, and they stop coming', () => {
    const sim = freshSim();
    const r = regular({ loyalty: 20 });
    sim.s.regulars = [r];
    const g = guestWithId(sim, 50);
    g.regular = r.id;
    afterVisit(ctxOf(sim), g, 1, false);
    expect(sim.s.regulars).toHaveLength(0);
    expect(toasts(drainEvents(ctxOf(sim)))).toEqual([`${r.name} has had enough, and will not be coming back.`]);
  });

  it('makes a loyal regular more patient, and a tipper', () => {
    const s = newGame();
    s.regulars = [
      regular({ id: 1, loyalty: 0 }),
      regular({ id: 2, loyalty: LOYAL_AT }),
      regular({ id: 3, loyalty: 100 }),
    ];
    expect(regularPatience(s, {})).toBe(1);
    expect(regularPatience(s, { regular: 1 })).toBe(1);
    expect(regularPatience(s, { regular: 3 })).toBe(0.5);
    expect(tipFor(s, {}, 1000)).toBe(0);
    expect(tipFor(s, { regular: 1 }, 1000)).toBe(0);
    expect(tipFor(s, { regular: 2 }, 1000)).toBe(100);
    expect(tipFor(s, { regular: 3 }, 1000)).toBe(200);
  });
});

describe('a regular coming back', () => {
  it('takes the place of someone new once they are due, looking just as they did, and counts the visit', () => {
    const { sim, s } = openCenter();
    s.open = true;
    const r = regular({ due: 5 });
    s.regulars = [r];
    s.day = 4;
    expect(dueRegular(s)).toBeUndefined();
    s.day = 5;
    expect(dueRegular(s)).toBe(r);
    s.spawnT = 0;
    admitGuests(ctxOf(sim), 0.1);
    const g = s.guests.at(-1)!;
    expect(g).toMatchObject({ name: r.name, look: r.look, regular: r.id });
    expect(r.visits).toBe(2);
    // and not twice over while they are here
    expect(dueRegular(s)).toBeUndefined();
  });

  it('is greeted by name at Reception', () => {
    expect(greeting('Margo Finch')).toBe('Welcome back, Margo!');
    const { sim, s } = openCenter();
    s.open = true;
    s.regulars = [regular({ due: 0 })];
    s.spawnT = 0;
    const floats: string[] = [];
    runUntil(sim, () => {
      for (const e of drainEvents(ctxOf(sim))) if (e.type === 'float') floats.push(e.text);
      return floats.includes('Welcome back, Margo!');
    });
    expect(floats).toContain('Back again');
  });
});

describe('the vision quest', () => {
  it('makes a regular of anyone it heals, loyal from the start, even with the most kept', () => {
    const sim = freshSim();
    sim.s.regulars = [...Array(REGULARS_MAX).keys()].map((i) => regular({ id: 100 + i }));
    const g = guestWithId(sim, 10);
    g.condition = 'lost';
    afterVisit(ctxOf(sim), g, 2, true);
    expect(sim.s.regulars.at(-1)).toMatchObject({ id: 10, loyalty: VISION_LOYALTY });
  });

  it('does nothing for anyone it did not heal', () => {
    const sim = freshSim();
    const g = guestWithId(sim, 10);
    g.condition = 'lost';
    afterVisit(ctxOf(sim), g, 2, false);
    expect(sim.s.regulars).toHaveLength(0);
  });

  it('is done in a Ceremony Lodge by a Shaman trained in it, from the third star', () => {
    const { sim, s } = openCenter();
    s.stars = 3;
    addLodge(sim);
    const shaman = hire(sim, 'shaman');
    shaman.quals.push('quest');
    s.open = true;
    runUntil(
      sim,
      () => {
        for (const g of s.guests) if (g.diagnosis === 0) g.condition = 'lost';
        return s.regulars.some((r) => r.loyalty === VISION_LOYALTY);
      },
      900,
    );
  });
});

describe('a regular in the interface', () => {
  it('is tagged with their visits and loyalty', () => {
    expect(regularTag(regular({ visits: 1 }))).toEqual({ icon: 'ui-regular', text: 'Regular, on their 1st visit' });
    expect(regularTag(regular({ visits: 3, loyalty: LOYAL_AT }))).toEqual({
      icon: 'ui-loyal',
      text: 'Loyal regular, on their 3rd visit',
    });
    expect(regularTag(regular({ visits: 12, loyalty: DEVOTED_AT }))).toEqual({
      icon: 'ui-loyal',
      text: 'Devoted regular, on their 12th visit',
    });
  });

  it('says when they are due, or that they are here', () => {
    expect(loyaltyNote(regular({ due: 30 }), 20.5, false)).toBe('Due back in 10 days');
    expect(loyaltyNote(regular({ due: 21 }), 20.5, false)).toBe('Due back any time');
    expect(loyaltyNote(regular({ due: 30 }), 20.5, true)).toBe('Here now');
  });
});

describe('an older save', () => {
  it('has no regulars yet', () => {
    const old = newGame() as Partial<GameState>;
    delete old.regulars;
    const s = old as GameState;
    upgradeSave(s);
    expect(s.regulars).toEqual([]);
  });
});
