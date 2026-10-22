// The center's standing, which climbs through grades from its rooms and staff, and the rival across the street.
import { describe, expect, it } from 'vitest';

import {
  DAY_SECONDS,
  GRADES,
  POACH_DAYS,
  POACH_MORALE,
  RIVAL_AWARD_KNOCK,
  RIVAL_CEILING,
  RIVAL_GROWTH,
  RIVAL_NAME,
  RIVAL_OPENS,
  RIVAL_START_POINTS,
  RIVAL_VIP_KNOCK,
  RIVAL_WORD_FALL,
  SALE_DAYS,
} from '../../src/core/data';
import { makeCandidate } from '../../src/core/people';
import { setSeed } from '../../src/core/random';
import { holdAwards, judge, yearTotals } from '../../src/core/sim/awards';
import { createContext } from '../../src/core/sim/context';
import { drainEvents } from '../../src/core/sim/events';
import { startCampaign } from '../../src/core/sim/marketing';
import {
  offerDaysLeft,
  poachTarget,
  rivalCeiling,
  rivalCourse,
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
  healPoints,
  idleNote,
  nextGrade,
  roomPoints,
  staffPoints,
  standingPoints,
  updateStanding,
} from '../../src/core/sim/standing';
import { arrivalFactor } from '../../src/core/sim/twists';
import { finishVisit } from '../../src/core/sim/visits';
import { newGame, newRival } from '../../src/core/state/game';
import type { GameState, Staff } from '../../src/core/state/types';
import { upgradeSave } from '../../src/core/state/upgrade';
import { addRestroom, addStaffRoom, hire, LAYOUT, openCenter, run, runUntil, toasts } from './helpers';

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

/** Rival points that rise and fall by the day, as the rival's own day passes a second at a time. */
function rivalDays(ctx: ReturnType<typeof withRival>['ctx'], days: number) {
  for (let i = 0; i < days * DAY_SECONDS; i++) updateRival(ctx);
}

describe('standing points', () => {
  it('come from each room in use and its prestige, from each member of staff by rank, and from heals', () => {
    expect(roomPoints(1)).toBe(20);
    expect(roomPoints(5)).toBe(36);
    expect(staffPoints(1), 'a Trainee').toBe(3);
    expect(staffPoints(5), 'an Expert').toBe(15);
    expect(healPoints(9)).toBe(1);
    expect(healPoints(10)).toBe(2);
  });

  it('count finished rooms and staff staying, not blueprints or anyone on their way out', () => {
    const { sim, s, consultant } = openCenter(1);
    const ctx = createContext(s);
    const before = standingPoints(ctx);
    expect(before.total).toBe(before.rooms + before.prestige + before.staff + before.heals);
    // the Consultation Room and the Massage Suite, each with someone to work in it
    expect(before.rooms).toBe(32);
    expect(before).toMatchObject({ inUse: 2, idle: 0, unstaffed: 0 });
    sim.createRoom('restroom', LAYOUT.restroom.rect, LAYOUT.restroom.door);
    expect(standingPoints(ctx).rooms, 'a blueprint').toBe(32);
    addStaffRoom(sim);
    expect(standingPoints(ctx).rooms, 'a room nobody works in counts for less').toBe(36);
    sim.fire(consultant.id);
    expect(standingPoints(ctx).staff).toBe(before.staff - staffPoints(consultant.skill));
  });

  it('count a treatment room for little with nobody to work in it, and say what staffing it would add', () => {
    const { sim, s, therapist } = openCenter(1);
    const ctx = createContext(s);
    const before = standingPoints(ctx);
    expect(idleNote(before)).toBe('');
    sim.fire(therapist.id);
    const after = standingPoints(ctx);
    expect(after).toMatchObject({ inUse: 1, idle: 1, unstaffed: 1 });
    expect(after.rooms).toBe(before.rooms - 12);
    // and its prestige no longer counts
    expect(after.prestige).toBeLessThan(before.prestige);
    expect(idleNote(after)).toBe(
      '1 room nobody on the payroll can work in counts only 4 points: staffing it adds at least 12',
    );
  });

  it('rise with every guest healed, and keep them', () => {
    const { s } = openCenter(1);
    const ctx = createContext(s);
    const before = standingPoints(ctx).total;
    s.stats.healed += 50;
    expect(standingPoints(ctx).total).toBe(before + 10);
  });

  it('cannot be bought with Restrooms and Trainees', () => {
    const { sim, s } = openCenter(1);
    const ctx = createContext(s);
    const before = standingPoints(ctx).total;
    addRestroom(sim);
    // a Restroom used to count 10, and 4 more for each star of its prestige
    expect(standingPoints(ctx).total - before).toBe(4);
    const trainee = hire(sim, 'receptionist');
    trainee.skill = 1;
    // a Trainee used to count 6, as much as a Junior and half an Expert
    expect(standingPoints(ctx).total - before).toBe(4 + 3);
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
      setSeed(5, s);
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
    // a few guests healed, as an open center has
    s.stats.healed = 200;
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
    const { s, ctx } = withRival();
    expect(rivalPoints(s)).toBe(0);
    expect(rivalOpen(s)).toBe(false);
    s.day = RIVAL_OPENS;
    updateRival(ctx);
    expect(rivalOpen(s)).toBe(true);
    expect(rivalPoints(s)).toBe(RIVAL_START_POINTS);
    // a center standing well above it, so nothing holds it back
    s.stats.healed = 5000;
    rivalDays(ctx, 100);
    expect(s.rival.points).toBeCloseTo(RIVAL_START_POINTS + 100 * RIVAL_GROWTH, 5);
    expect(rivalGrade(s)).toBe(gradeFor(rivalPoints(s)));
    s.rivalOn = false;
    expect(rivalOpen(s), 'switched off').toBe(false);
  });

  it('grows no further than a quarter more than the center, and shrinks back when the center does', () => {
    const { sim, s, ctx, therapist } = withRival();
    s.rival.opened = 0;
    s.rival.points = RIVAL_START_POINTS;
    s.stats.healed = 1000;
    const ceiling = rivalCeiling(ctx);
    expect(ceiling).toBe(Math.round(standingPoints(ctx).total * RIVAL_CEILING));
    rivalDays(ctx, 2000);
    expect(rivalPoints(s), 'it used to grow without limit, to 980 by now').toBe(ceiling);
    expect(rivalCourse(ctx)).toEqual({ course: 'ceiling', ceiling });
    // the center loses its therapist, and with it some standing: the rival comes down to its new ceiling, a day at a time
    sim.fire(therapist.id);
    const lower = rivalCeiling(ctx);
    expect(lower).toBeLessThan(ceiling);
    rivalDays(ctx, 1);
    expect(s.rival.points).toBeCloseTo(ceiling - RIVAL_GROWTH, 5);
    rivalDays(ctx, 200);
    expect(rivalPoints(s)).toBe(lower);
    // and the center can catch it by growing faster than it does
    s.stats.healed += 2000;
    expect(standingPoints(ctx).total).toBeGreaterThan(rivalPoints(s));
  });

  it('says once that it has stopped growing, and once that the center has passed it', () => {
    const { s, ctx } = withRival();
    s.rival.opened = 0;
    s.rival.points = RIVAL_START_POINTS;
    s.stats.healed = 1000;
    drainEvents(ctx);
    /** The tips said with the rival's icon over some days. */
    const tips = (days: number) => {
      rivalDays(ctx, days);
      return drainEvents(ctx).flatMap((e) => (e.type === 'toast' && e.icon === 'ui-rival' ? [e.text] : []));
    };
    // it starts below the center, which is nothing to tell, and grows past it to its ceiling
    const growing = tips(2000);
    expect(growing.filter((t) => t.includes('has stopped growing'))).toHaveLength(1);
    expect(growing.filter((t) => t.includes('has passed'))).toEqual([]);
    expect(tips(10)).toEqual([]);
    // the center grows past it
    s.stats.healed += 4000;
    expect(tips(1)).toEqual([`Your standing has passed ${RIVAL_NAME}'s. Center of the Year is yours to lose.`]);
    // and only once: it gets ahead again, and is passed again, in silence
    s.stats.healed = 1000;
    tips(400);
    expect(s.rival.points).toBeGreaterThan(standingPoints(ctx).total);
    s.stats.healed += 4000;
    expect(tips(1)).toEqual([]);
  });

  it('loses ground while word of mouth runs, instead of growing', () => {
    const { s, ctx } = withRival();
    s.rival.opened = 0;
    s.rival.points = 150;
    s.stats.healed = 1000;
    expect(startCampaign(ctx, 'word', 1)).toBe(true);
    expect(rivalCourse(ctx).course).toBe('losing');
    rivalDays(ctx, 10);
    expect(s.rival.points).toBeCloseTo(150 - 10 * RIVAL_WORD_FALL, 5);
    expect(s.rival.knocked).toBeCloseTo(10 * RIVAL_WORD_FALL, 5);
    // but never below where it started
    s.rival.points = RIVAL_START_POINTS + 1;
    rivalDays(ctx, 10);
    expect(s.rival.points).toBe(RIVAL_START_POINTS);
  });

  it('loses a share of its standing to each VIP the center delights', () => {
    const { sim, s, ctx } = withRival();
    s.rival.opened = 0;
    s.stars = 1;
    s.visitNotice = { visit: 'vip', name: 'Lee', title: 'a gadget reviewer', cares: 'equipment', arrives: s.day };
    runUntil(sim, () => s.visitors.length > 0, 30);
    s.rival.points = 400;
    const v = s.visitors[0]!;
    v.seen = [{ room: 0, name: 'Massage Suite', score: 95, note: '', problems: [] }];
    drainEvents(ctx);
    finishVisit(ctx, v);
    expect(s.visitReport?.outcome).toBe('delighted');
    expect(s.rival.points).toBeCloseTo(400 * (1 - RIVAL_VIP_KNOCK), 5);
    expect(toasts(drainEvents(ctx))).toContain(
      `A delighted VIP is telling everyone about you: ${RIVAL_NAME} loses ${Math.round(400 * RIVAL_VIP_KNOCK)} standing points.`,
    );
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
    s.rival.points = RIVAL_START_POINTS;
    s.day = 0;
    // it opens a grade up on a new center
    expect(rivalGrade(s)).toBe(1);
    expect(rivalDraw(s)).toBeCloseTo(0.05);
    s.grade = 1;
    expect(rivalDraw(s), 'level with the center').toBe(0);
    s.grade = 0;
    s.rival.points = 980;
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
    s.rival.points = 2000;
    holdAwards(ctx, 2);
    expect(s.ceremony!.results.find((r) => r.award === 'center-of-the-year')?.won).toBe(false);
    expect(s.rival.trophies).toBe(1);
    expect(s.rival.points, 'winning costs the rival nothing').toBe(2000);
  });

  it('knocks the rival back a tenth when the center wins it', () => {
    const { s, ctx } = withRival();
    s.rival.opened = 0;
    s.rival.points = 200;
    s.stats.healed = 1000;
    drainEvents(ctx);
    holdAwards(ctx, 1);
    expect(s.ceremony!.results.find((r) => r.award === 'center-of-the-year')?.won).toBe(true);
    expect(s.rival.points).toBe(200 * (1 - RIVAL_AWARD_KNOCK));
    expect(toasts(drainEvents(ctx))).toContain(`Center of the Year is yours: ${RIVAL_NAME} loses 20 standing points.`);
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

  it('carries on a rival open since before it kept its own points from where the old rule had it', () => {
    const { s } = openCenter(1);
    s.day = 445;
    s.rival.opened = 45;
    const old = JSON.parse(JSON.stringify(s)) as Record<string, any>;
    Reflect.deleteProperty(old.rival, 'points');
    Reflect.deleteProperty(old.rival, 'knocked');
    upgradeSave(old as GameState);
    const up = old as GameState;
    // the old rule's 0.45 a day
    expect(up.rival.points).toBeCloseTo(RIVAL_START_POINTS + 400 * 0.45, 5);
    expect(up.rival.knocked).toBe(0);
  });
});
