// Magic mushrooms under the Shop Counter, the health inspector who might find them, paying the inspector off, and a
// Shaman's ward against a mishap.
import { describe, expect, it } from 'vitest';

import {
  BRIBE_LEAK,
  BRIBE_MIN,
  BRIBE_RECHECK_DAYS,
  BRIBE_REP,
  INSPECTION_FINE,
  INSPECTION_REP,
  MUSHROOM_FINE,
  MUSHROOM_REP,
} from '../../src/core/data';
import { setSeed } from '../../src/core/random';
import type { SimContext } from '../../src/core/sim/context';
import { incomeOf } from '../../src/core/sim/economy';
import { newMishap } from '../../src/core/sim/mishaps';
import {
  counterVerdict,
  inspectorComing,
  inspectorGone,
  mushroomPrice,
  MUSHROOMS_FOUND,
  mushroomsOnSale,
  sellMushrooms,
} from '../../src/core/sim/mushrooms';
import type { Sim } from '../../src/core/sim/sim';
import { bribeFor, lapseInspection, verdict } from '../../src/core/sim/visits';
import { mushroomNote, mushroomSwitch } from '../../src/ui/lib/ceremonies';
import { readiness } from '../../src/ui/lib/mishaps';
import { reportSummary } from '../../src/ui/lib/visits';
import { addLodge, hire, inconsistencies, openCenter, run, runUntil, toasts } from './helpers';

/** The simulation's own context, for calling its parts directly. */
const ctxOf = (sim: Sim) => (sim as unknown as { ctx: SimContext }).ctx;

/** A center at its second star with a Shop Counter, a Ceremony Lodge and a Shaman. */
function withCounter(seed = 1, shaman = true) {
  const c = openCenter(seed);
  c.s.stars = 2;
  addLodge(c.sim);
  const counter = c.sim.placeItem('shop_counter', 16, 15, 0);
  if (!counter) throw new Error('no room for the Shop Counter');
  const healer = shaman ? hire(c.sim, 'shaman') : undefined;
  return { ...c, counter, shaman: healer };
}

/** A room the inspector saw, with these problems. */
const seen = (...problems: string[]) => ({ room: 1, name: 'Room', score: 0, note: '', problems });

describe('mushrooms under the counter', () => {
  it('can only go on sale with a Shaman to supply them', () => {
    const { sim, s } = withCounter(1, false);
    expect(sim.mushroomSupplier()).toBe(false);
    expect(sim.setMushrooms(true)).toBe(false);
    expect(s.mushrooms).toBe(false);
    hire(sim, 'shaman');
    expect(sim.setMushrooms(true)).toBe(true);
    expect(mushroomsOnSale(ctxOf(sim))).toBe(true);
  });

  it('turn some Shop Counter sales into much bigger ones, counted on their own line', () => {
    const { sim, s } = withCounter(2);
    sim.setMushrooms(true);
    runUntil(sim, () => s.guests.length > 0, 300);
    const g = s.guests[0]!;
    let sold = 0;
    for (let i = 0; i < 40 && !sold; i++) sold = sellMushrooms(ctxOf(sim), g);
    expect(sold).toBeGreaterThan(100);
    expect(s.ledger.mushrooms).toBe(sold);
    expect(incomeOf(s.ledger)).toBeGreaterThanOrEqual(sold);
    sim.setMushrooms(false);
    for (let i = 0; i < 40; i++) expect(sellMushrooms(ctxOf(sim), g)).toBe(0);
  });

  it('sell for about the usual price, to the nearest five dollars', () => {
    expect(mushroomPrice(1)).toBe(180);
    expect(mushroomPrice(0.8)).toBe(145);
    expect(mushroomPrice(1.2)).toBe(215);
  });

  it('say on the counter whether they are out, put away for the inspector, or could be', () => {
    expect(mushroomSwitch(true)).toBe('🍄 Mushrooms under the counter: on sale');
    expect(mushroomSwitch(false)).toBe('🍄 Mushrooms under the counter: put away');
    expect(mushroomNote(false, true)).toMatch(/until the health inspector has been/);
    expect(mushroomNote(true, false)).toMatch(/big fine/);
  });
});

describe('the inspector and the mushrooms', () => {
  it('has them put away as the inspector writes ahead, and back out once they have gone', () => {
    const { sim, s } = withCounter(3);
    sim.setMushrooms(true);
    inspectorComing(ctxOf(sim));
    expect(s.mushrooms).toBe(false);
    expect(s.mushroomsStashed).toBe(true);
    expect(counterVerdict(ctxOf(sim))).toBeNull();
    inspectorGone(ctxOf(sim));
    expect(s.mushrooms).toBe(true);
    expect(s.mushroomsStashed).toBe(false);
  });

  it('leaves them out when the policy says not to put them away, with a warning', () => {
    const { sim, s } = withCounter(4);
    sim.setMushrooms(true);
    sim.setPolicy({ stashMushrooms: false });
    sim.drain();
    inspectorComing(ctxOf(sim));
    expect(s.mushrooms).toBe(true);
    expect(toasts(sim.drain()).join()).toMatch(/still on sale/);
    expect(counterVerdict(ctxOf(sim))?.problems).toEqual([MUSHROOMS_FOUND]);
  });

  it('fails an inspection that finds them, however clean the rest, with a much bigger fine and hit', () => {
    expect(verdict('inspector', [seen(), seen(MUSHROOMS_FOUND)], 2)).toEqual({
      score: 1,
      outcome: 'failed',
      money: -(INSPECTION_FINE + MUSHROOM_FINE),
      rep: -(INSPECTION_REP + MUSHROOM_REP),
    });
    expect(verdict('inspector', [seen('dirty')], 2).outcome).toBe('passed');
  });
});

describe('paying off the inspector', () => {
  it('costs twice the fine, rounded to $500, and never less than the floor', () => {
    expect(bribeFor(1600)).toBe(BRIBE_MIN);
    expect(bribeFor(8400)).toBe(17000);
  });

  /** A center with a failed inspection waiting to be settled. */
  function failed(seed: number) {
    const c = withCounter(seed);
    const { s } = c;
    s.visitReport = {
      visit: 'inspector',
      name: 'Pat',
      title: 'the health inspector',
      day: s.day,
      rooms: [seen('dirty'), seen(MUSHROOMS_FOUND)],
      score: 2,
      outcome: 'failed',
      money: -8400,
      rep: -8,
      bribe: 17000,
    };
    s.nextInspection = s.day + 150;
    return c;
  }

  it('pays the fine and takes the hit, when that is the choice', () => {
    const { sim, s } = failed(5);
    const money = s.money;
    const rep = s.reputation;
    expect(sim.settleInspection(false)).toBe(true);
    expect(s.money).toBe(money - 8400);
    expect(s.reputation).toBeLessThan(rep);
    expect(sim.settleInspection(false), 'nothing left to settle').toBe(false);
  });

  it('makes it go away for the bribe, counted as passed with no fine, unless word gets out', () => {
    let leaked = 0;
    let kept = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const { sim, s } = failed(seed);
      setSeed(seed, s);
      const money = s.money;
      const rep = s.reputation;
      expect(sim.settleInspection(true)).toBe(true);
      const r = s.visitReport!;
      expect(r).toMatchObject({ outcome: 'paid off', money: -17000 });
      expect(s.money).toBe(money - 17000);
      if (r.rep < 0) {
        leaked++;
        expect(r.rep).toBe(-BRIBE_REP);
        expect(s.nextInspection).toBeLessThanOrEqual(s.day + BRIBE_RECHECK_DAYS);
        expect(reportSummary(r)).toMatch(/Word got out/);
      } else {
        kept++;
        expect(s.reputation).toBeGreaterThanOrEqual(rep);
        expect(reportSummary(r)).toBe('Failed, but it went away for $17,000.');
      }
    }
    expect(leaked).toBeGreaterThan(0);
    expect(kept).toBeGreaterThan(leaked);
    expect(BRIBE_LEAK).toBeLessThan(0.5);
  });

  it('cannot be paid without the money, and leaves the fine to settle the day after if nobody chooses', () => {
    const { sim, s } = failed(6);
    s.money = 1000;
    expect(sim.settleInspection(true)).toBe(false);
    expect(s.visitReport?.bribe).toBe(17000);
    lapseInspection(ctxOf(sim));
    expect(s.visitReport?.bribe, 'not a day yet').toBe(17000);
    s.day += 1;
    lapseInspection(ctxOf(sim));
    expect(s.visitReport?.bribe).toBeUndefined();
    expect(s.ledger.fines).toBe(8400);
  });
});

describe("a Shaman's ward", () => {
  it('can be asked for a mishap coming, with a Shaman here, and is performed when they are free', () => {
    const { sim, s, shaman } = withCounter(7);
    expect(sim.canWard()).toBe(false);
    s.mishap = newMishap(s.day, 'power');
    expect(sim.canWard()).toBe(true);
    expect(readiness(s.mishap)).toBe('not prepared');
    expect(sim.askWard()).toBe(true);
    expect(sim.canWard(), 'asked already').toBe(false);
    expect(readiness(s.mishap)).toBe('a Shaman will ward it off');
    runUntil(sim, () => s.mishap?.ward === 'done', 300);
    expect(readiness(s.mishap)).toBe('warded');
    expect(shaman?.job).toBeNull();
    sim.drain();
    runUntil(sim, () => !!s.mishap?.started, 300);
    expect(toasts(sim.drain()).some((t) => t.startsWith('🪶 The ward'))).toBe(true);
    expect(inconsistencies(sim)).toEqual([]);
  });

  it('says so when the Shaman did not get to the ward before the mishap began', () => {
    const { sim, s } = withCounter(9);
    s.mishap = newMishap(s.day, 'power');
    sim.askWard();
    s.mishap.starts = s.day;
    sim.drain();
    run(sim, 0.1);
    expect(s.mishap.started).toBe(true);
    expect(toasts(sim.drain())).toContain('🪶 The Shaman did not get to the ward in time.');
  });

  it('cannot be asked without a Shaman', () => {
    const { sim, s } = withCounter(8, false);
    s.mishap = newMishap(s.day, 'power');
    expect(sim.canWard()).toBe(false);
    expect(sim.askWard()).toBe(false);
    run(sim, 1);
  });
});
