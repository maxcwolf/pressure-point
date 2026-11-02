// The health inspector's warning: the first failed inspection of a game costs nothing, and says what was wrong where,
// what to do about it and what the next will cost. And what the interface says about it.
import { describe, expect, it } from 'vitest';

import {
  BRIBE_RECHECK_DAYS,
  bribeOffers,
  EXTINGUISHER_REACH,
  INSPECTION_FINE,
  MUSHROOM_FINE,
} from '../../src/core/data';
import { setSeed } from '../../src/core/random';
import { createContext } from '../../src/core/sim/context';
import { MUSHROOMS_FOUND } from '../../src/core/sim/mushrooms';
import { finishVisit, inspectionProblems } from '../../src/core/sim/visits';
import { newGame, SAVE_VERSION } from '../../src/core/state/game';
import type { GameState, RoomVerdict, VisitReport } from '../../src/core/state/types';
import { upgradeSave } from '../../src/core/state/upgrade';
import { pendingDialog } from '../../src/ui/lib/dialogs';
import {
  inspectionRule,
  offerLabel,
  problemNote,
  problemSpot,
  refusalNote,
  reportHeading,
  reportSummary,
  stillWrong,
  warningNote,
} from '../../src/ui/lib/visits';
import { inconsistencies, openCenter, runUntil, toasts } from './helpers';

/** A center open for business, with the health inspector due today and nobody else. */
function inspectorDue(seed = 1) {
  const c = openCenter(seed);
  runUntil(c.sim, () => c.s.open, 60);
  c.s.nextInspection = 1e9;
  c.s.nextVip = 1e9;
  c.s.visitNotice = { visit: 'inspector', name: 'Pat', title: 'the health inspector', arrives: c.s.day };
  return c;
}

/** Bring the inspector in and send them home having seen these rooms. */
function inspect(c: ReturnType<typeof inspectorDue>, rooms: RoomVerdict[]) {
  runUntil(c.sim, () => c.s.visitors.length > 0, 10);
  const v = c.s.visitors[0]!;
  v.seen = rooms;
  finishVisit(createContext(c.s), v);
  return c.s.visitReport!;
}

/** A room the inspector saw, with these problems. */
const seen = (room: number, ...problems: string[]): RoomVerdict => ({
  room,
  name: 'Massage Suite',
  score: 0,
  note: '',
  problems,
});

describe('the first failed inspection', () => {
  it('is only a warning: no fine and no hit to reputation, saying what the fine would have been', () => {
    const c = inspectorDue();
    const { s, sim } = c;
    // two rooms with no Fire Extinguisher near either: a failed inspection, walked for real
    sim.drain();
    runUntil(sim, () => s.visitReport !== null, 240);
    const r = s.visitReport!;
    expect(r).toMatchObject({ outcome: 'warned', money: 0, rep: 0, waived: 2 * INSPECTION_FINE, score: 2 });
    expect(r.bribes, 'nothing to settle').toBeUndefined();
    expect(s.inspectionWarned).toBe(true);
    expect(s.ledger.fines).toBe(0);
    // the warning opens again after a reload until the player has closed it
    expect(r.unread).toBe(true);
    expect(pendingDialog(s)).toBe('visit');
    sim.readVisitReport();
    expect(pendingDialog(s)).toBeNull();
    const events = sim.drain();
    expect(
      events.some((e) => e.type === 'visit'),
      'the report opens',
    ).toBe(true);
    expect(toasts(events).join()).toMatch(/only a warning/);
    expect(inconsistencies(sim)).toEqual([]);
  });

  it('is the only one: the next failure is fined and offered the bribes', () => {
    const c = inspectorDue(2);
    const { s } = c;
    expect(inspect(c, [seen(c.massage.id, 'dirty', 'broken equipment')]).outcome).toBe('warned');
    s.visitNotice = { visit: 'inspector', name: 'Sam', title: 'the health inspector', arrives: s.day };
    const r = inspect(c, [seen(c.massage.id, 'dirty', 'broken equipment')]);
    expect(r).toMatchObject({
      outcome: 'failed',
      money: -2 * INSPECTION_FINE,
      bribes: bribeOffers(2 * INSPECTION_FINE),
    });
    expect(pendingDialog(s)).toBe('visit');
  });

  it('warns for the magic mushrooms too, and counts the center caught with them', () => {
    const c = inspectorDue(3);
    runUntil(c.sim, () => c.s.visitors.length > 0, 10);
    const money = c.s.money;
    const rep = c.s.reputation;
    const r = inspect(c, [seen(0, MUSHROOMS_FOUND)]);
    expect([c.s.money, c.s.reputation], 'nothing paid, nothing lost').toEqual([money, rep]);
    expect(r).toMatchObject({ outcome: 'warned', money: 0, waived: INSPECTION_FINE + MUSHROOM_FINE });
    expect(c.s.stats.busted).toBe(1);
  });

  it('is not spent on an inspection passed', () => {
    const c = inspectorDue(4);
    expect(inspect(c, [seen(c.massage.id, 'dirty')]).outcome).toBe('passed');
    expect(c.s.inspectionWarned).toBe(false);
  });
});

describe('an offer turned down', () => {
  it('brings the inspector back within the days promised, a VIP due meanwhile or not', () => {
    for (const vip of [false, true]) {
      let walked = false;
      for (let seed = 1; seed <= 12 && !walked; seed++) {
        const c = inspectorDue(seed);
        const { s, sim } = c;
        s.inspectionWarned = true;
        const r = inspect(c, [seen(c.massage.id, 'dirty', 'broken equipment')]);
        setSeed(seed, s);
        expect(sim.settleInspection(0)).toBe(true);
        if (r.refused === undefined) continue;
        walked = true;
        const day = s.day;
        if (vip) {
          s.stars = 1;
          s.nextVip = day + 22;
        }
        runUntil(sim, () => s.visitNotice?.visit === 'inspector', 40 * 6);
        expect(s.visitNotice!.arrives).toBeLessThanOrEqual(day + BRIBE_RECHECK_DAYS);
      }
      expect(walked, 'an offer turned down among the seeds').toBe(true);
    }
  });
});

describe('a save from before the warning', () => {
  it('has its warning still to come, and an unsettled fine offered the bribes in place of its one price', () => {
    const { inspectionWarned: _warned, ...rest } = newGame();
    const s = rest as unknown as GameState;
    s.version = 45;
    s.visitReport = {
      visit: 'inspector',
      name: 'Pat',
      title: 'the health inspector',
      day: s.day,
      rooms: [],
      score: 3,
      outcome: 'failed',
      money: -2400,
      rep: -3,
      bribe: 10000,
    } as VisitReport;
    upgradeSave(s);
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.inspectionWarned).toBe(false);
    expect(s.visitReport).not.toHaveProperty('bribe');
    expect(s.visitReport.bribes).toEqual([500, 1000, 1400]);
  });
});

describe('what the report says about a failed inspection', () => {
  /** An inspection's report, failed in two rooms. */
  const report = (r: Partial<VisitReport>): VisitReport => ({
    visit: 'inspector',
    name: 'Pat',
    title: 'the health inspector',
    day: 1,
    rooms: [seen(2, 'dirty', 'no Fire Extinguisher nearby'), seen(3)],
    score: 2,
    outcome: 'warned',
    money: 0,
    rep: 0,
    waived: 1600,
    ...r,
  });

  it('heads a warning as one, and says plainly what it costs now and next time', () => {
    const r = report({});
    expect(reportHeading(r).text).toBe('The inspection: a warning');
    expect(reportSummary(r)).toBe(
      'Failed, with 2 things wrong. This time it is only a warning: no fine, and no hit to reputation.',
    );
    expect(warningNote(r)).toBe(
      'Put right what is listed before the inspector calls again. The next inspection failed will be fined $800 for each thing wrong and cost 3% reputation: this one would have cost $1,600 and 3%.',
    );
    const busted = report({ rooms: [seen(0, MUSHROOMS_FOUND)], waived: 6800 });
    expect(warningNote(busted)).toMatch(
      /\$800 for each thing wrong, \$6,000 more for magic mushrooms, and cost 8% reputation: this one would have cost \$6,800 and 8%\.$/,
    );
    expect(inspectionRule()).toBe(
      'The inspector checks up to 6 rooms, chosen at random, and lets one thing go: any more fails the inspection.',
    );
  });

  it('names every check the inspector makes in plain words, with what to do to pass it', () => {
    const c = openCenter(5);
    const room = c.massage;
    for (const p of [...inspectionProblems(createContext(c.s), room), 'dirty', 'broken equipment', MUSHROOMS_FOUND]) {
      const { what, fix } = problemNote(p);
      expect(what).not.toBe(p);
      expect(fix.length).toBeGreaterThan(20);
    }
    expect(problemNote('no Fire Extinguisher nearby')).toEqual({
      what: 'No Fire Extinguisher near the door',
      fix: `Place a Fire Extinguisher within ${EXTINGUISHER_REACH} tiles of the door, or fit the room with sprinklers.`,
    });
  });

  it('shows where each thing was, and keeps a room’s finding on it only while it is still wrong', () => {
    const c = openCenter(5);
    expect(problemSpot(c.s, seen(c.massage.id, 'dirty'))).toEqual({ kind: 'room', id: c.massage.id });
    expect(problemSpot(c.s, seen(c.massage.id)), 'nothing wrong there').toBeNull();
    expect(problemSpot(c.s, seen(999, 'dirty')), 'knocked down since').toBeNull();
    expect(problemSpot(c.s, seen(0, MUSHROOMS_FOUND)), 'no Shop Counter').toBeNull();
    const counter = c.sim.placeItem('shop_counter', 16, 15, 0)!;
    expect(problemSpot(c.s, seen(0, MUSHROOMS_FOUND))).toEqual({ kind: 'item', id: counter.id });
    const r = report({ rooms: [seen(c.massage.id, 'dirty', 'no Fire Extinguisher nearby')] });
    expect(stillWrong(r, c.massage.id, ['no Fire Extinguisher nearby'])).toEqual(['no Fire Extinguisher nearby']);
    expect(stillWrong(r, c.massage.id, []), 'all put right').toEqual([]);
    for (const outcome of ['failed', 'paid off'] as const)
      expect(stillWrong({ ...r, outcome }, c.massage.id, ['dirty'])).toEqual(['dirty']);
    expect(stillWrong({ ...r, outcome: 'passed' }, c.massage.id, ['dirty']), 'one thing let go').toEqual([]);
    expect(stillWrong(r, c.consult.id, ['dirty']), 'not a room it failed').toEqual([]);
    expect(stillWrong({ ...r, visit: 'vip' }, c.massage.id, ['dirty'])).toEqual([]);
    expect(stillWrong(null, c.massage.id, ['dirty'])).toEqual([]);
  });

  it('offers the bribes with their odds, and says what one turned down costs', () => {
    const r = report({ outcome: 'failed', money: -2400, rep: -3, bribes: bribeOffers(2400) });
    expect(r.bribes!.map(offerLabel)).toEqual(['$500 · 35% chance', '$1,000 · 60% chance', '$1,400 · 85% chance']);
    expect(refusalNote(r)).toBe(
      'Or offer the inspector something to make it go away: the more you offer, the likelier it is taken. One turned down costs nothing itself, but the fine goes up to $3,000, word gets out (another 6% reputation), and the inspector is back within 30 days.',
    );
    expect(reportSummary(r)).toBe(
      'Failed, with 2 things wrong: a $2,400 fine and -3% reputation, unless it goes away.',
    );
  });
});
