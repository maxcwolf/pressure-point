// Staff challenges and the year-end awards: goals along the way.
import { describe, expect, it } from 'vitest';

import { AWARD_ORDER, AWARDS, CHALLENGE_MORALE, DAYS_PER_MONTH } from '../../src/core/data';
import { holdAwards, judge, YEAR_MONTHS, yearTotals } from '../../src/core/sim/awards';
import {
  challengeGoals,
  challengeObjective,
  challengeTask,
  proposeChallenge,
  updateChallenge,
} from '../../src/core/sim/challenges';
import { createContext } from '../../src/core/sim/context';
import { drainEvents } from '../../src/core/sim/events';
import { emptyLedger, emptyTally } from '../../src/core/state/game';
import type { Challenge, MonthRecord } from '../../src/core/state/types';
import { addAcupuncture, freshSim, hire, openCenter, run, runUntil } from './helpers';

/** A center open for business with staff challenges on. */
function withChallenges(seed = 1) {
  const c = openCenter(seed);
  c.s.challengesOn = true;
  run(c.sim, 30);
  return { ...c, ctx: createContext(c.s) };
}

/** A challenge set by the first member of staff, now, with a deadline in sixty days. */
function challenge(s: ReturnType<typeof withChallenges>['s'], goal: Challenge['goal'], from = 0): Challenge {
  const st = s.staff[0]!;
  return { staffId: st.id, staffName: st.name, goal, from, set: s.day, deadline: s.day + 60, reward: 2000 };
}

describe('a staff challenge', () => {
  it('is only set once the center is open and has a few staff', () => {
    const sim = freshSim();
    expect(proposeChallenge(createContext(sim.s))).toBeNull();
    const { ctx } = withChallenges();
    const ch = proposeChallenge(ctx)!;
    expect(ch).not.toBeNull();
    expect(ch.deadline - ch.set).toBeGreaterThanOrEqual(60);
    expect(ch.deadline - ch.set).toBeLessThanOrEqual(120);
    expect(ctx.s.staff.map((st) => st.id)).toContain(ch.staffId);
  });

  it('asks for what the center could do, a stretch on how it is doing', () => {
    const { ctx, s, sim } = withChallenges();
    let goals = challengeGoals(ctx, 90);
    expect(goals.some((g) => g.kind === 'healed' && !g.discipline && g.count >= 5)).toBe(true);
    // no acupuncture to heal with, and no emergencies before the first star
    expect(goals.some((g) => g.kind === 'healed' && g.discipline)).toBe(false);
    expect(goals.some((g) => g.kind === 'emergencies')).toBe(false);
    s.stars = 1;
    addAcupuncture(sim);
    goals = challengeGoals(ctx, 90);
    expect(goals).toContainEqual(expect.objectContaining({ kind: 'healed', discipline: 'acupuncture' }));
    expect(goals).toContainEqual({ kind: 'emergencies', count: 1 });
  });

  it('counts guests healed since it was set, not before', () => {
    const { ctx, s } = withChallenges();
    s.stats.healed = 30;
    const ch = challenge(s, { kind: 'healed', count: 10 }, 30);
    expect(challengeObjective(ctx, ch)).toMatchObject({ label: 'Heal 10 more guests (0/10)', done: false });
    expect(challengeTask(ctx, ch)).toBe('Heal 10 more guests');
    s.stats.healed = 40;
    expect(challengeObjective(ctx, ch)).toMatchObject({ label: 'Heal 10 more guests (10/10)', done: true });
  });

  it('counts days without anyone quitting from when it was set', () => {
    const { ctx, s } = withChallenges();
    s.day = 200;
    s.stats.lastQuit = -1;
    const ch = challenge(s, { kind: 'noQuits', days: 45 });
    expect(challengeObjective(ctx, ch).done).toBe(false);
    s.day = 246;
    expect(challengeObjective(ctx, ch).done).toBe(true);
    // and someone quitting starts the count again
    s.stats.lastQuit = 240;
    expect(challengeObjective(ctx, ch).done).toBe(false);
  });

  it('is set when one is due, and not when challenges are switched off', () => {
    const { ctx, s } = withChallenges();
    s.challengesOn = false;
    s.nextChallenge = 0;
    updateChallenge(ctx);
    expect(s.challenge).toBeNull();
    s.challengesOn = true;
    updateChallenge(ctx);
    expect(s.challenge).not.toBeNull();
    expect(drainEvents(ctx).some((e) => e.type === 'toast' && e.text.includes('has set the center a challenge'))).toBe(
      true,
    );
  });

  it('pays out and cheers everyone up when met', () => {
    const { ctx, s } = withChallenges();
    for (const st of s.staff) st.morale = 50;
    s.challenge = challenge(s, { kind: 'healed', count: 1 }, s.stats.healed - 1);
    const money = s.money;
    updateChallenge(ctx);
    expect(s.challenge).toBeNull();
    expect(s.money).toBe(money + 2000);
    expect(s.staff.every((st) => st.morale === 50 + CHALLENGE_MORALE)).toBe(true);
    expect(s.nextChallenge).toBeGreaterThan(s.day);
  });

  it('lapses at its deadline, leaving the one who set it a little disappointed', () => {
    const { ctx, s } = withChallenges();
    const setter = s.staff[0]!;
    setter.morale = 50;
    s.challenge = challenge(s, { kind: 'healed', count: 1000 }, s.stats.healed);
    s.day = s.challenge.deadline;
    const money = s.money;
    updateChallenge(ctx);
    expect(s.challenge).toBeNull();
    expect(s.money).toBe(money);
    expect(setter.morale).toBeLessThan(50);
  });

  it('comes along by itself in play', () => {
    const { sim, s } = withChallenges();
    runUntil(sim, () => !!s.challenge, 600);
    expect(sim.challengeObjective()?.label).toBeTruthy();
  });
});

/** A month's record with a few of its figures set. */
function month(fields: Partial<MonthRecord>): MonthRecord {
  return { ...emptyTally(), ledger: emptyLedger(), reputation: 50, money: 0, ...fields };
}

describe('the year-end awards', () => {
  it('add up the year', () => {
    const t = yearTotals([
      month({ healed: 5, failed: 1, arrived: 8, ledger: { ...emptyLedger(), treatment: 3000, salaries: 1000 } }),
      month({ healed: 7, failed: 2, arrived: 9, priced: 1 }),
    ]);
    expect(t).toMatchObject({ healed: 12, failed: 3, arrived: 17, priced: 1, net: 2000 });
  });

  it('are judged against a bar that rises every year', () => {
    const { s } = withChallenges();
    const t = yearTotals([month({ healed: 45, failed: 5, arrived: 60, waitTotal: 60 * 6, waitCount: 60 })]);
    expect(judge(s, 'busiest', 1, t)).toMatchObject({ won: true, note: '45 healed, 40 needed' });
    expect(judge(s, 'busiest', 2, t)).toMatchObject({ won: false, note: '45 healed, 50 needed' });
    expect(judge(s, 'healing-hands', 1, t)).toMatchObject({ won: true, note: '90% healed, 75% needed' });
    expect(judge(s, 'no-waiting', 1, t)).toMatchObject({ won: true });
    expect(judge(s, 'fair-prices', 1, t)).toMatchObject({ won: true });
    // too few guests to say
    const quiet = yearTotals([month({ healed: 3, arrived: 4, waitCount: 4 })]);
    expect(judge(s, 'healing-hands', 1, quiet)).toMatchObject({ won: false });
    expect(judge(s, 'healing-hands', 1, quiet).note).toMatch(/Too few/);
  });

  it('go to the member of staff who did the most', () => {
    const { s, therapist, sim } = withChallenges();
    const second = hire(sim, 'therapist');
    therapist.yearServed = 10;
    second.yearServed = 22;
    const t = yearTotals([]);
    expect(judge(s, 'healer-of-the-year', 1, t)).toMatchObject({ won: true, winner: second.name });
    expect(judge(s, 'janitor-of-the-year', 1, t)).toMatchObject({ won: false, note: 'No Janitor to give it to' });
  });

  it('pay out for each won, fill the trophy cabinet, and start the year afresh', () => {
    const { ctx, s, therapist } = withChallenges();
    s.months = Array.from({ length: YEAR_MONTHS }, () =>
      month({ healed: 5, failed: 0, arrived: 6, waitTotal: 6 * 6, waitCount: 6 }),
    );
    therapist.yearServed = 30;
    therapist.morale = 50;
    drainEvents(ctx);
    const money = s.money;
    holdAwards(ctx, 1);
    const won = s.ceremony!.results.filter((r) => r.won).map((r) => r.award);
    expect(s.ceremony!.results.map((r) => r.award)).toEqual(AWARD_ORDER);
    expect(won).toEqual(expect.arrayContaining(['busiest', 'healing-hands', 'no-waiting', 'fair-prices']));
    expect(won).toContain('healer-of-the-year');
    expect(s.money).toBe(money + won.reduce((sum, id) => sum + AWARDS[id].prize, 0));
    expect(s.trophies).toEqual(won.map((award) => ({ award, year: 1 })));
    expect(therapist.morale).toBe(70);
    expect(s.staff.every((st) => st.yearServed === 0)).toBe(true);
    expect(drainEvents(ctx)).toContainEqual({ type: 'awards', year: 1 });
  });

  it('are held as each year ends', () => {
    const { sim, s } = withChallenges();
    s.day = YEAR_MONTHS * DAYS_PER_MONTH - 0.01;
    sim.drain();
    run(sim, 1);
    expect(s.ceremony?.year).toBe(1);
    expect(sim.drain()).toContainEqual({ type: 'awards', year: 1 });
    // and not at the end of any other month
    s.day = 13 * DAYS_PER_MONTH - 0.01;
    run(sim, 1);
    expect(s.ceremony?.year).toBe(1);
  });

  it('count what staff do over the year', () => {
    const { sim, therapist } = withChallenges();
    const before = therapist.yearServed;
    runUntil(sim, () => therapist.yearServed > before, 300);
    const janitor = hire(sim, 'caretaker');
    sim.s.litter.push({ id: 99001, x: 14, y: 11, claimedBy: 0 });
    runUntil(sim, () => janitor.yearServed > 0, 120);
  });
});
