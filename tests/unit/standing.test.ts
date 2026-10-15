// The center's standing, which climbs through grades from its rooms and staff, and the rival across the street.
import { describe, expect, it } from 'vitest';

import {
  GRADES,
  POACH_DAYS,
  POACH_MORALE,
  RIVAL_GROWTH,
  RIVAL_NAME,
  RIVAL_OPENS,
  RIVAL_START_POINTS,
  SALE_DAYS,
} from '../../src/core/data';
import { makeCandidate } from '../../src/core/people';
import { setSeed } from '../../src/core/random';
import { holdAwards, judge, yearTotals } from '../../src/core/sim/awards';
import { createContext } from '../../src/core/sim/context';
import { drainEvents } from '../../src/core/sim/events';
import {
  offerDaysLeft,
  poachTarget,
  rivalDraw,
  rivalGrade,
  rivalOpen,
  rivalPoints,
  saleDraw,
  updateRival,
} from '../../src/core/sim/rival';
import {
  expectedPrestige,
  gradeArrivals,
  gradeDef,
  gradeFor,
  nextGrade,
  roomPoints,
  staffPoints,
  standingPoints,
  updateStanding,
} from '../../src/core/sim/standing';
import { arrivalFactor } from '../../src/core/sim/twists';
import { newGame, newRival } from '../../src/core/state/game';
import type { GameState, Staff } from '../../src/core/state/types';
import { upgradeSave } from '../../src/core/state/upgrade';
import { addRestroom, addStaffRoom, LAYOUT, openCenter, run, runUntil, toasts } from './helpers';

/** An open center with the rival switched on. */
function withRival(seed = 1) {
  const c = openCenter(seed);
  c.s.rivalOn = true;
  c.s.open = true;
  return { ...c, ctx: createContext(c.s) };
}

/** Someone on the payroll, with the fields poaching looks at. */
function worker(id: number, morale: number, extra: Partial<Staff> = {}): Staff {
  return { id, name: `#${id}`, morale, offer: 0, state: 'idle', ...extra } as Staff;
}

describe('standing points', () => {
  it('come from each room and its prestige, and from each member of staff and their rank', () => {
    expect(roomPoints(1)).toBe(14);
    expect(roomPoints(5)).toBe(30);
    expect(staffPoints(1)).toBe(6);
    expect(staffPoints(5)).toBe(14);
  });

  it('count finished rooms and staff staying, not blueprints or anyone on their way out', () => {
    const { sim, s, consultant } = openCenter(1);
    const ctx = createContext(s);
    const before = standingPoints(ctx);
    expect(before.total).toBe(before.rooms + before.prestige + before.staff);
    expect(before.rooms).toBe(20);
    sim.createRoom('restroom', LAYOUT.restroom.rect, LAYOUT.restroom.door);
    expect(standingPoints(ctx).rooms, 'a blueprint').toBe(20);
    addStaffRoom(sim);
    expect(standingPoints(ctx).rooms).toBe(30);
    sim.fire(consultant.id);
    expect(standingPoints(ctx).staff).toBe(before.staff - staffPoints(consultant.skill));
  });
});

describe('grades', () => {
  it('run from Back-Room Practice to Healing Institute, each with more points than the last', () => {
    expect(GRADES[0]?.name).toBe('Back-Room Practice');
    expect(GRADES.at(-1)?.name).toBe('Healing Institute');
    for (let i = 1; i < GRADES.length; i++) expect(GRADES[i]!.points).toBeGreaterThan(GRADES[i - 1]!.points);
    expect(GRADES.some((g) => /spa/i.test(g.name))).toBe(false);
  });

  it('are earned by points, and the top one is the last', () => {
    expect(gradeFor(0)).toBe(0);
    expect(gradeFor(79)).toBe(0);
    expect(gradeFor(80)).toBe(1);
    expect(gradeFor(499)).toBe(3);
    expect(gradeFor(5000)).toBe(4);
    expect(gradeDef(9).name).toBe('Healing Institute');
    expect(nextGrade(0)?.name).toBe('Wellness Studio');
    expect(nextGrade(4)).toBeUndefined();
  });

  it('bring more guests, and guests who expect finer rooms', () => {
    expect(gradeArrivals(0)).toBe(1);
    expect(gradeArrivals(4)).toBeCloseTo(1.32);
    const s = newGame();
    expect(expectedPrestige(s)).toBe(0);
    s.grade = 2;
    expect(expectedPrestige(s)).toBe(2);
    s.grade = 4;
    expect(expectedPrestige(s)).toBe(3);
  });

  it('bring better applicants', () => {
    const s = newGame();
    /** The average skill of many applicants for this game. */
    const average = () => {
      setSeed(5);
      let total = 0;
      for (let i = 0; i < 400; i++) total += makeCandidate(s, 'therapist').skill;
      return total / 400;
    };
    const plain = average();
    s.grade = 4;
    expect(average()).toBeGreaterThan(plain + 0.3);
  });
});

describe('climbing a grade', () => {
  it('happens once the center is open, is announced, and is kept when the center shrinks', () => {
    const { sim, s } = openCenter(1);
    const ctx = createContext(s);
    s.open = false;
    addStaffRoom(sim);
    addRestroom(sim);
    updateStanding(ctx);
    expect(s.grade, 'not open yet').toBe(0);
    s.open = true;
    drainEvents(ctx);
    updateStanding(ctx);
    const reached = gradeFor(standingPoints(ctx).total);
    expect(reached).toBeGreaterThan(0);
    expect(s.grade).toBe(reached);
    const events = drainEvents(ctx);
    expect(events).toContainEqual({
      type: 'announce',
      text: `We are now a ${gradeDef(reached).name}. Thank you for bringing us your knots.`,
    });
    updateStanding(ctx);
    expect(
      drainEvents(ctx).filter((e) => e.type === 'announce'),
      'only once',
    ).toEqual([]);
    for (const r of [...s.rooms]) sim.removeRoom(r.id, 0.5);
    updateStanding(ctx);
    expect(s.grade).toBe(reached);
  });

  it('draws more guests in', () => {
    const { s } = openCenter(1);
    const ctx = createContext(s);
    const plain = arrivalFactor(ctx);
    s.grade = 3;
    expect(arrivalFactor(ctx)).toBeCloseTo(plain * gradeArrivals(3));
  });

  it('lets guests down in a plain treatment room once the center stands high', () => {
    const { sim, s } = openCenter(1);
    s.grade = 4;
    runUntil(sim, () => s.reviews.some((r) => r.feelings.includes('healed')), 600);
    expect(s.reviews.find((r) => r.feelings.includes('healed'))?.feelings).toContain('underwhelmed');
  });

  it('expects nothing of a room at the first grade', () => {
    const { sim, s } = openCenter(1);
    runUntil(sim, () => s.reviews.some((r) => r.feelings.includes('healed')), 600);
    expect(s.reviews.flatMap((r) => r.feelings)).not.toContain('underwhelmed');
  });
});

describe('the rival', () => {
  it('stands nowhere until it opens, then grows every day', () => {
    const s = newGame();
    expect(rivalPoints(s)).toBe(0);
    expect(rivalOpen(s)).toBe(false);
    s.rival.opened = 10;
    s.day = 110;
    expect(rivalOpen(s)).toBe(true);
    expect(rivalPoints(s)).toBe(Math.round(RIVAL_START_POINTS + 100 * RIVAL_GROWTH));
    expect(rivalGrade(s)).toBe(gradeFor(rivalPoints(s)));
    s.rivalOn = false;
    expect(rivalOpen(s), 'switched off').toBe(false);
  });

  it('draws guests away in a sale, unless the prices are down to its own', () => {
    expect(saleDraw(1)).toBeCloseTo(0.3);
    expect(saleDraw(1.5)).toBeCloseTo(0.3);
    expect(saleDraw(0.875)).toBeCloseTo(0.15);
    expect(saleDraw(0.75)).toBe(0);
    expect(saleDraw(0.5)).toBe(0);
  });

  it('draws more away the higher it stands above the center, and none before it opens', () => {
    const s = newGame();
    expect(rivalDraw(s)).toBe(0);
    s.rival.opened = 0;
    s.day = 0;
    // it opens a grade up on a new center
    expect(rivalGrade(s)).toBe(1);
    expect(rivalDraw(s)).toBeCloseTo(0.05);
    s.grade = 1;
    expect(rivalDraw(s), 'level with the center').toBe(0);
    s.grade = 0;
    s.day = 2000;
    expect(rivalGrade(s)).toBe(4);
    expect(rivalDraw(s)).toBeCloseTo(0.2);
    s.rival.saleUntil = s.day + 1;
    expect(rivalDraw(s)).toBeCloseTo(0.5);
    s.grade = 4;
    s.priceLevel = 0.75;
    expect(rivalDraw(s)).toBe(0);
  });

  it('opens on its day, with word of it, and not while switched off', () => {
    const { s, ctx } = withRival();
    s.day = RIVAL_OPENS - 1;
    updateRival(ctx);
    expect(s.rival.opened).toBeNull();
    s.day = RIVAL_OPENS;
    s.rivalOn = false;
    updateRival(ctx);
    expect(s.rival.opened).toBeNull();
    s.rivalOn = true;
    updateRival(ctx);
    expect(s.rival.opened).toBe(RIVAL_OPENS);
    expect(toasts(drainEvents(ctx)).join(' ')).toContain(`A ${RIVAL_NAME} has opened across the street`);
  });

  it('holds a sale on its day that ends after a while and draws guests away meanwhile', () => {
    const { s, ctx } = withRival();
    s.rival.opened = 0;
    s.day = s.rival.nextSale;
    // level with the rival, so only the sale draws guests away
    s.grade = rivalGrade(s);
    const before = arrivalFactor(ctx);
    updateRival(ctx);
    expect(s.rival.saleUntil).toBe(s.day + SALE_DAYS);
    expect(s.rival.nextSale).toBeGreaterThan(s.rival.saleUntil);
    expect(arrivalFactor(ctx)).toBeCloseTo(before * (1 - saleDraw(1)));
    expect(toasts(drainEvents(ctx)).join(' ')).toContain('is holding a sale');
    s.day = s.rival.saleUntil;
    updateRival(ctx);
    expect(s.rival.saleUntil).toBe(0);
    expect(toasts(drainEvents(ctx)).join(' ')).toContain('sale is over');
  });
});

describe('the rival hiring staff away', () => {
  it('goes for the unhappiest of those below the mark, not anyone already made an offer or leaving', () => {
    expect(poachTarget([worker(1, 80), worker(2, POACH_MORALE)])).toBeUndefined();
    expect(poachTarget([worker(1, 30), worker(2, 10), worker(3, 20)])?.id).toBe(2);
    expect(poachTarget([worker(2, 10, { offer: 50 }), worker(3, 20)])?.id).toBe(3);
    expect(poachTarget([worker(2, 10, { state: 'leaving' })])).toBeUndefined();
    const s = newGame();
    s.day = 10;
    expect(offerDaysLeft(s, worker(1, 10))).toBeNull();
    expect(offerDaysLeft(s, worker(1, 10, { offer: 13 }))).toBe(3);
  });

  it('makes an offer, which a member of staff turns down once cheered up', () => {
    const { s, ctx, consultant } = withRival();
    s.rival.opened = 0;
    s.day = s.rival.nextPoach;
    for (const st of s.staff) st.morale = 80;
    consultant.morale = 20;
    updateRival(ctx);
    expect(consultant.offer).toBe(s.day + POACH_DAYS);
    expect(toasts(drainEvents(ctx)).join(' ')).toContain(`${RIVAL_NAME} has offered ${consultant.name} a job`);
    consultant.morale = POACH_MORALE + 5;
    updateRival(ctx);
    expect(consultant.offer).toBe(0);
    expect(toasts(drainEvents(ctx)).join(' ')).toContain('turned down');
    expect(s.staff).toContain(consultant);
  });

  it('takes someone left unhappy until the offer runs out', () => {
    const { sim, s, ctx, consultant } = withRival();
    run(sim, 5);
    s.rival.opened = 0;
    consultant.morale = 10;
    consultant.offer = s.day;
    consultant.busy = false;
    s.rival.nextPoach = 1e9;
    updateRival(ctx);
    expect(consultant.state).toBe('leaving');
    expect(s.rival.poached).toBe(1);
    expect(s.stats.lastQuit).toBe(s.day);
    expect(toasts(drainEvents(ctx)).join(' ')).toContain(`has left to work at ${RIVAL_NAME}`);
  });
});

describe('Center of the Year', () => {
  it('goes to whichever stands higher, the center or the rival', () => {
    const s = newGame();
    const t = yearTotals([]);
    expect(judge(s, 'center-of-the-year', 1, t)).toMatchObject({ won: false, note: 'No rival to beat' });
    expect(judge(s, 'center-of-the-year', 1, t, { ours: 300, theirs: 250 })).toMatchObject({
      won: true,
      note: `Standing 300 against ${RIVAL_NAME}'s 250`,
    });
    expect(judge(s, 'center-of-the-year', 1, t, { ours: 200, theirs: 250 }).won).toBe(false);
  });

  it('is held only with the rival open, and counts the rival a trophy when it wins', () => {
    const { s, ctx } = withRival();
    holdAwards(ctx, 1);
    expect(s.ceremony!.results.map((r) => r.award)).not.toContain('center-of-the-year');
    s.rival.opened = 0;
    s.day = 3000;
    holdAwards(ctx, 2);
    expect(s.ceremony!.results.find((r) => r.award === 'center-of-the-year')?.won).toBe(false);
    expect(s.rival.trophies).toBe(1);
  });
});

describe('a save from before standing and the rival', () => {
  it('starts at the first grade, with the rival still to open and nobody made an offer', () => {
    const { s } = openCenter(1);
    s.day = 200;
    const old = JSON.parse(JSON.stringify(s)) as Record<string, any>;
    for (const k of ['grade', 'rival', 'rivalOn']) Reflect.deleteProperty(old, k);
    for (const st of old.staff) Reflect.deleteProperty(st, 'offer');
    upgradeSave(old as GameState);
    const up = old as GameState;
    expect(up.grade).toBe(0);
    expect(up.rivalOn).toBe(true);
    expect(up.rival).toEqual(newRival(200));
    expect(up.rival.opened).toBeNull();
    for (const st of up.staff) expect(st.offer).toBe(0);
  });
});
