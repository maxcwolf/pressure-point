// Visitors who judge the center: VIPs, with their own tastes, and the health inspector, with the rules.
import { describe, expect, it } from 'vitest';

import {
  BRIBE_MIN,
  CENTERS,
  DIRT_FILTHY,
  IDEAL_TEMP,
  INSPECTION_CLEAN_REP,
  INSPECTION_FINE,
  INSPECTION_REP,
  ITEMS,
  VIP_CARES,
  VIP_PRIZE,
  VIP_REP,
  VISIT_NEWS,
  VISIT_NOTICE_DAYS,
} from '../../src/core/data';
import { createContext } from '../../src/core/sim/context';
import { drainEvents } from '../../src/core/sim/events';
import { snowedIn } from '../../src/core/sim/twists';
import {
  type AspectScores,
  aspectScores,
  extinguisherNear,
  inspectionProblems,
  updateVisits,
  verdict,
  viewingTile,
  vipNote,
  vipScore,
} from '../../src/core/sim/visits';
import { newGame } from '../../src/core/state/game';
import type { GameState, RoomVerdict, Visitor, VisitReport } from '../../src/core/state/types';
import { upgradeSave } from '../../src/core/state/upgrade';
import { accessTile } from '../../src/core/world';
import { reportSummary, verdictTone, visitorStatus } from '../../src/ui/lib/visits';
import { inconsistencies, openCenter, runUntil } from './helpers';

/** Every aspect of a room at the same rating. */
const all = (n: number): AspectScores => ({ decor: n, cleanliness: n, calm: n, warmth: n, equipment: n });

/** A room's verdict with a score, and any problems the inspector found. */
const seen = (score: number, problems: string[] = []): RoomVerdict => ({
  room: 1,
  name: 'Massage Suite',
  score,
  note: '',
  problems,
});

describe('a VIP', () => {
  it('weighs what they care about most, and finds a gloomy room spoiled', () => {
    expect(vipScore(all(1), 'decor', 0)).toBe(100);
    expect(vipScore(all(0), 'decor', 0)).toBe(0);
    // great decor and nothing else: worth the decor lover's while, not the cleanliness lover's
    const decorOnly = { ...all(0), decor: 1 };
    expect(vipScore(decorOnly, 'decor', 0)).toBe(Math.round((VIP_CARES / (VIP_CARES + 4)) * 100));
    expect(vipScore(decorOnly, 'cleanliness', 0)).toBe(Math.round((1 / (VIP_CARES + 4)) * 100));
    expect(vipScore(all(1), 'decor', 100)).toBe(50);
  });

  it('writes a note on what they care about, and the worst of the rest if it let them down', () => {
    expect(vipNote(all(1), 'decor', 0, IDEAL_TEMP)).toBe('Beautifully done.');
    expect(vipNote({ ...all(1), calm: 0 }, 'decor', 0, IDEAL_TEMP)).toBe('Beautifully done, but far too noisy.');
    expect(vipNote({ ...all(0), cleanliness: 0.1 }, 'cleanliness', 0, IDEAL_TEMP)).toMatch(/^Grubby, and /);
    // too warm reads as hot, too cool as cold
    expect(vipNote({ ...all(1), warmth: 0 }, 'warmth', 0, IDEAL_TEMP + 20)).toBe('Too hot.');
    expect(vipNote({ ...all(1), warmth: 0 }, 'warmth', 0, IDEAL_TEMP - 20)).toBe('Too cold.');
    expect(vipNote(all(1), 'decor', 60, IDEAL_TEMP)).toBe('Beautifully done, with a gloomy air about it.');
  });

  it('looks round a room from its open floor, out of the way of where people sit and work', () => {
    const { s, consult } = openCenter(1);
    const ctx = createContext(s);
    const [x, y] = viewingTile(ctx, consult)!;
    expect(ctx.world.zoneAt(x, y)).toBe(consult.id);
    for (const it of s.items.filter((i) => ctx.world.zoneAt(i.x, i.y) === consult.id))
      for (let i = 0; i < ITEMS[it.type].access.length; i++) expect(accessTile(it, i)).not.toEqual([x, y]);
    expect([x, y]).not.toEqual([consult.door.x, consult.door.y]);
  });

  it('marks a room down for filth, litter and broken equipment', () => {
    const { s, massage } = openCenter(1);
    const ctx = createContext(s);
    const fresh = aspectScores(ctx, massage);
    expect(fresh.cleanliness).toBe(1);
    expect(fresh.equipment).toBe(1);
    const table = s.items.find((it) => it.type === 'massage_table')!;
    table.dirt = DIRT_FILTHY;
    table.wear = 100;
    s.litter.push({ id: s.nextId++, x: massage.x + 1, y: massage.y + 1, claimedBy: 0 });
    const grim = aspectScores(createContext(s), massage);
    expect(grim.cleanliness).toBeLessThan(0.5);
    expect(grim.equipment).toBe(0.5);
  });

  it('is delighted, satisfied or disappointed, and pays or costs accordingly', () => {
    expect(verdict('vip', [seen(80), seen(90)], 2)).toEqual({
      score: 85,
      outcome: 'delighted',
      money: VIP_PRIZE * 2,
      rep: VIP_REP,
    });
    // a center with no star yet still earns the first star's prize
    expect(verdict('vip', [seen(75)], 0).money).toBe(VIP_PRIZE);
    expect(verdict('vip', [seen(55)], 2)).toMatchObject({ outcome: 'satisfied', money: 0, rep: 1 });
    expect(verdict('vip', [seen(20), seen(30)], 2)).toMatchObject({ outcome: 'disappointed', rep: -VIP_REP });
  });
});

describe('the health inspector', () => {
  it('looks for dirt, broken equipment and a Fire Extinguisher near the door', () => {
    const { sim, s, massage } = openCenter(1);
    expect(inspectionProblems(createContext(s), massage)).toEqual(['no Fire Extinguisher nearby']);
    expect(sim.placeItem('fire_extinguisher', 13, 10, 0)).not.toBeNull();
    expect(extinguisherNear(createContext(s), massage)).toBe(true);
    expect(inspectionProblems(createContext(s), massage)).toEqual([]);
    const table = s.items.find((it) => it.type === 'massage_table')!;
    table.dirt = DIRT_FILTHY;
    table.wear = 100;
    expect(inspectionProblems(createContext(s), massage)).toEqual(['dirty', 'broken equipment']);
  });

  it('lets one thing go, and fines each thing found beyond that', () => {
    expect(verdict('inspector', [seen(100), seen(100)], 1)).toEqual({
      score: 0,
      outcome: 'passed',
      money: 0,
      rep: INSPECTION_CLEAN_REP,
    });
    expect(verdict('inspector', [seen(66, ['dirty'])], 1)).toMatchObject({ outcome: 'passed', rep: 0 });
    expect(verdict('inspector', [seen(66, ['dirty']), seen(32, ['dirty', 'broken equipment'])], 1)).toEqual({
      score: 3,
      outcome: 'failed',
      money: -3 * INSPECTION_FINE,
      rep: -INSPECTION_REP,
    });
  });
});

describe('visits', () => {
  it('are written ahead: the inspector when due, and a VIP only once there is a star', () => {
    const { s } = openCenter(1);
    const ctx = createContext(s);
    s.open = true;
    s.nextInspection = 1e9;
    s.nextVip = 0;
    updateVisits(ctx);
    expect(s.visitNotice).toBeNull();
    s.stars = 1;
    updateVisits(ctx);
    expect(s.visitNotice).toMatchObject({ visit: 'vip', arrives: s.day + VISIT_NOTICE_DAYS });
    expect(s.visitNotice?.cares).toBeDefined();
    expect(drainEvents(ctx), 'over the speakers').toContainEqual({ type: 'announce', text: VISIT_NEWS.vip });
    s.visitNotice = null;
    s.nextInspection = 0;
    updateVisits(ctx);
    expect(s.visitNotice).toMatchObject({ visit: 'inspector', title: 'the health inspector' });
    expect(drainEvents(ctx)).toContainEqual({ type: 'announce', text: VISIT_NEWS.inspector });
  });

  it('never come with visits switched off, or before the center opens', () => {
    const { s } = openCenter(1);
    const ctx = createContext(s);
    s.nextInspection = 0;
    s.open = false;
    updateVisits(ctx);
    expect(s.visitNotice).toBeNull();
    s.open = true;
    s.visitsOn = false;
    updateVisits(ctx);
    expect(s.visitNotice).toBeNull();
  });

  it('wait for the road to clear at High Pines', () => {
    const s = newGame('highpines');
    const snow = CENTERS.highpines.snow!;
    let day = 0;
    while (!snowedIn(day, snow)) day++;
    s.day = day;
    s.open = true;
    s.rooms.push({
      id: s.nextId++,
      type: 'consult',
      x: 7,
      y: 6,
      w: 4,
      h: 4,
      door: { x: 10, y: 8, dx: 1, dy: 0 },
      windows: [],
      done: true,
      priority: false,
      vibes: 0,
      claimedBy: 0,
    });
    s.visitNotice = { visit: 'inspector', name: 'Pat', title: 'the health inspector', arrives: day - 1 };
    const ctx = createContext(s);
    updateVisits(ctx);
    expect(s.visitors).toEqual([]);
    expect(s.visitNotice).not.toBeNull();
  });

  it('tour the rooms, go home and leave a report, paid or fined', () => {
    const { sim, s } = openCenter(1);
    runUntil(sim, () => s.open, 60);
    s.nextInspection = 1e9;
    s.nextVip = 1e9;
    s.visitNotice = { visit: 'inspector', name: 'Pat', title: 'the health inspector', arrives: s.day };
    // two rooms with no Fire Extinguisher near either: a failed inspection
    const money = s.money;
    runUntil(sim, () => s.visitors.length > 0, 10);
    const visitor = s.visitors[0]!;
    expect(visitor.tour.length).toBe(2);
    runUntil(sim, () => s.visitReport !== null, 240);
    expect(s.visitors).toEqual([]);
    const report = s.visitReport!;
    expect(report.rooms.map((r) => r.name).sort()).toEqual(['Consultation Room', 'Massage Suite']);
    expect(report).toMatchObject({ outcome: 'failed', score: 2, money: -2 * INSPECTION_FINE });
    // the fine waits on a choice: pay it, or make it go away
    expect(report.bribe).toBe(BRIBE_MIN);
    expect(s.ledger.fines).toBe(0);
    expect(sim.settleInspection(false)).toBe(true);
    expect(report.bribe).toBeUndefined();
    expect(s.ledger.fines).toBe(2 * INSPECTION_FINE);
    expect(s.money).toBeLessThan(money);
    expect(s.nextInspection).toBeGreaterThan(s.day);
    expect(drainEvents(createContext(s))).toEqual([]);
    expect(inconsistencies(sim)).toEqual([]);
  });

  it('move on when a room on the tour is knocked down', () => {
    const { sim, s } = openCenter(1);
    runUntil(sim, () => s.open, 60);
    s.nextInspection = 1e9;
    s.nextVip = 1e9;
    s.visitNotice = { visit: 'vip', name: 'Lee', title: 'a gadget reviewer', cares: 'equipment', arrives: s.day };
    runUntil(sim, () => s.visitors.length > 0, 10);
    const visitor = s.visitors[0]!;
    // the room they would see second is knocked down while they head for the first
    const [first, second] = visitor.tour;
    sim.removeRoom(second!, 0);
    runUntil(sim, () => s.visitReport !== null, 240);
    expect(s.visitReport?.rooms.map((r) => r.room)).toEqual([first]);
    expect(s.visitors).toEqual([]);
    expect(inconsistencies(sim)).toEqual([]);
  });
});

describe('a save from before visits', () => {
  it('has nobody visiting, the first visits ahead, and no fines in its books', () => {
    const {
      visitors: _visitors,
      visitNotice: _notice,
      visitReport: _report,
      nextVip: _vip,
      nextInspection: _inspection,
      visitsOn: _on,
      ...rest
    } = newGame();
    const { fines: _fines, ...ledger } = rest.ledger;
    const old = { ...rest, ledger };
    const s = old as unknown as GameState;
    s.day = 200;
    upgradeSave(s);
    expect(s).toMatchObject({ visitors: [], visitNotice: null, visitReport: null, visitsOn: true });
    expect(s.nextVip).toBeGreaterThan(200);
    expect(s.nextInspection).toBeGreaterThan(200);
    expect(s.ledger.fines).toBe(0);
  });
});

describe('what the interface says about visits', () => {
  /** A report with an outcome, a score and what it came to. */
  const report = (r: Partial<VisitReport>): VisitReport => ({
    visit: 'vip',
    name: 'Lee',
    title: 'a gadget reviewer',
    day: 1,
    rooms: [],
    score: 0,
    outcome: 'satisfied',
    money: 0,
    rep: 0,
    ...r,
  });

  it('sums up a visit in a sentence', () => {
    expect(reportSummary(report({ outcome: 'delighted', score: 82, money: 3000, rep: 4 }))).toBe(
      'Lee loved it, scoring the center 82 out of 100, and left $3,000. +4% reputation.',
    );
    expect(reportSummary(report({ outcome: 'disappointed', score: 31, rep: -4 }))).toBe(
      'Lee was disappointed: 31 out of 100. -4% reputation.',
    );
    expect(reportSummary(report({ visit: 'inspector', outcome: 'passed', score: 0, rep: 2 }))).toBe(
      'Passed, with nothing to put right. +2% reputation.',
    );
    expect(reportSummary(report({ visit: 'inspector', outcome: 'passed', score: 1 }))).toBe(
      'Passed, with one thing to put right.',
    );
    expect(reportSummary(report({ visit: 'inspector', outcome: 'failed', score: 3, money: -2400, rep: -3 }))).toBe(
      'Failed, with 3 things wrong: a $2,400 fine. -3% reputation.',
    );
  });

  it('colors a room by how it went, and says what a visitor is doing', () => {
    expect(verdictTone(seen(80))).toBe('good');
    expect(verdictTone(seen(55))).toBe('');
    expect(verdictTone(seen(20))).toBe('bad');
    expect(verdictTone(seen(100, ['dirty']))).toBe('bad');
    const v = { state: 'toRoom' } as Visitor;
    expect(visitorStatus(v, 'Massage Suite')).toBe('On the way to the Massage Suite');
    expect(visitorStatus({ ...v, state: 'looking' }, 'Massage Suite')).toBe('Looking round the Massage Suite');
    expect(visitorStatus({ ...v, state: 'leaving' }, undefined)).toBe('On the way out, to write it all up');
  });
});
