// Centers: each game is set in one, with its own building on the lot and its own goals for each star.
import { beforeEach, describe, expect, it } from 'vitest';

import { type CenterId, CENTERS, type GoalSpec, plotFits, SANDBOX_PLOT } from '../../src/core/data';
import { lotWidth } from '../../src/core/land';
import { setSeed } from '../../src/core/random';
import { createContext, type SimContext } from '../../src/core/sim/context';
import { averageWait, cureRate, objectiveFor } from '../../src/core/sim/goals';
import { Sim } from '../../src/core/sim/sim';
import { emptyLedger, emptyTally, newGame } from '../../src/core/state/game';
import type { GameState, Tally } from '../../src/core/state/types';
import { upgradeSave } from '../../src/core/state/upgrade';
import { importSave } from '../../src/storage/saves';
import { openCenter, runUntil } from './helpers';

/** A finished month with these figures. */
const month = (fields: Partial<Tally>) => ({
  ...emptyTally(),
  ...fields,
  ledger: emptyLedger(),
  reputation: 0,
  money: 0,
});

describe('the centers', () => {
  it('each have a building that fits its lot, and three stars of goals', () => {
    for (const c of Object.values(CENTERS)) {
      expect(plotFits(c.plot, lotWidth(c)), c.id).toBe(true);
      expect(c.goals, c.id).toHaveLength(3);
      for (const star of c.goals) expect(star.length, c.id).toBeGreaterThan(0);
    }
  });

  it('keep the sandbox exactly as it was before there were centers', () => {
    expect(CENTERS.sandbox.plot).toBe(SANDBOX_PLOT);
    expect(SANDBOX_PLOT).toEqual({ x0: 3, x1: 27, y0: 3, y1: 17, door: [14, 15] });
    const { sim } = openCenter(1);
    expect(sim.objectives().map((o) => o.label)).toEqual(['Heal 8 guests (0/8)', 'Reach 40% reputation']);
    sim.s.stars = 2;
    expect(sim.objectives().map((o) => o.label)).toEqual([
      'Heal 80 guests (0/80)',
      'Reach 80% reputation',
      'Have $120,000 in the bank',
    ]);
  });

  it("start a game with the center's money, and remember the center", () => {
    expect(newGame().center).toBe('sandbox');
    const s = newGame('willow');
    expect(s.center).toBe('willow');
    expect(s.money).toBe(CENTERS.willow.startMoney);
  });
});

describe('a game in a smaller building', () => {
  /** A Willow Lane game with the bare minimum built inside its walls, and staff hired. */
  function willowCenter(): Sim {
    setSeed(4);
    const sim = new Sim(newGame('willow'));
    sim.s.money = 100_000;
    /** Build a finished room with its furniture. */
    const room = (type: 'consult' | 'massage', rect: object, door: object, items: [string, number, number][]) => {
      const r = sim.createRoom(type, rect as never, door as never);
      for (const [t, x, y] of items)
        expect(sim.placeItem(t as never, x, y, 0, { free: true, roomId: r.id }), t).not.toBeNull();
      sim.finishRoom(r);
    };
    expect(sim.placeItem('reception_desk', 14, 13, 0)).not.toBeNull();
    room('consult', { x: 7, y: 8, w: 4, h: 4 }, { x: 10, y: 10, dx: 1, dy: 0 }, [
      ['consult_desk', 8, 9],
      ['cabinet', 7, 11],
    ]);
    room('massage', { x: 18, y: 8, w: 4, h: 4 }, { x: 19, y: 11, dx: 0, dy: 1 }, [
      ['massage_table', 19, 8],
      ['oil_trolley', 21, 8],
    ]);
    for (const role of ['receptionist', 'consultant', 'therapist'] as const) {
      const best = sim.s.candidates.filter((c) => c.role === role).sort((a, b) => b.skill - a.skill)[0];
      expect(best && sim.hire(best.id), role).toBeTruthy();
    }
    return sim;
  }

  it('only lets things be built inside its own walls', () => {
    const sim = new Sim(newGame('willow'));
    // inside the sandbox's building, but outside Willow Lane's
    expect(sim.world.canPlaceItem('bench', 4, 10, 0).reason).toMatch(/inside the building/);
    expect(sim.world.canPlaceItem('bench', 12, 12, 0).ok).toBe(true);
    expect(sim.world.inside(SANDBOX_PLOT.x0, SANDBOX_PLOT.y0)).toBe(false);
  });

  it('brings guests in through its own door, and heals them', () => {
    const sim = willowCenter();
    runUntil(sim, () => sim.s.stats.healed >= 3, 900);
    const { door, y1 } = CENTERS.willow.plot;
    expect(sim.world.connected()).toBe(true);
    // everyone indoors is inside the walls
    for (const g of sim.s.guests) {
      if (g.ty <= y1) expect(sim.world.inside(Math.floor(g.x), Math.floor(g.y)) || door.includes(g.tx)).toBe(true);
    }
  });

  it('works toward its own goals', () => {
    const sim = willowCenter();
    expect(sim.objectives().map((o) => o.label)).toEqual(['Heal 5 guests (0/5)', 'Reach 35% reputation']);
    runUntil(sim, () => sim.s.stars >= 1, 2400);
    expect(sim.objectives().map((o) => o.label)[1]).toBe('Have a Massage Suite of prestige 2');
  });
});

describe('saves', () => {
  /** An exported save file for a game. */
  const file = (s: object) => JSON.stringify({ format: 'pressure-point-save', name: 'A test', savedAt: 1, state: s });
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    globalThis.localStorage = {
      /** Read a stored value, or null if there is none. */
      getItem: (k: string) => store.get(k) ?? null,
      /** Store a value. */
      setItem: (k: string, v: string) => void store.set(k, v),
      /** Forget a stored value. */
      removeItem: (k: string) => void store.delete(k),
    } as Storage;
  });

  it('from before centers load as sandbox games', () => {
    const old = JSON.parse(JSON.stringify(newGame())) as Record<string, any>;
    delete old.center;
    delete old.stats.healedBy;
    delete old.stats.emergencies;
    delete old.stats.lastQuit;
    upgradeSave(old as GameState);
    expect(old).toMatchObject({ center: 'sandbox', stats: { healedBy: {}, emergencies: 0, lastQuit: -1 } });
    expect(typeof importSave(file({ ...newGame(), center: undefined }))).toBe('object');
  });

  it('from a center this version does not know are refused', () => {
    expect(importSave(file({ ...newGame(), center: 'atlantis' as CenterId }))).toBe('invalid');
    expect(typeof importSave(file(newGame('willow')))).toBe('object');
  });
});

describe('each kind of goal', () => {
  let ctx: SimContext;
  beforeEach(() => {
    setSeed(1);
    ctx = createContext(newGame());
  });
  /** The objective for a goal in the current game. */
  const check = (goal: GoalSpec) => objectiveFor(ctx, goal);

  it('counts guests healed, in all or by one discipline', () => {
    ctx.s.stats.healed = 7;
    ctx.s.stats.healedBy = { acupuncture: 2 };
    expect(check({ kind: 'healed', count: 5 })).toEqual({ label: 'Heal 5 guests (5/5)', done: true, progress: 7 / 5 });
    expect(check({ kind: 'healed', count: 4, discipline: 'acupuncture' })).toMatchObject({
      label: 'Heal 4 guests with acupuncture (2/4)',
      done: false,
      progress: 0.5,
    });
  });

  it('counts the bank balance after any loan, so borrowing cannot buy a star', () => {
    ctx.s.money = 60000;
    expect(check({ kind: 'balance', amount: 50000 })).toEqual({
      label: 'Have $50,000 in the bank',
      done: true,
      progress: 60000 / 50000,
    });
    ctx.s.loan = 20000;
    expect(check({ kind: 'balance', amount: 50000 })).toEqual({
      label: 'Have $50,000 in the bank, after your loan',
      done: false,
      progress: 40000 / 50000,
    });
    ctx.s.money = 10000;
    expect(check({ kind: 'balance', amount: 50000 }).progress).toBe(0);
  });

  it('judges the cure rate and the wait over this month or the last one, once enough guests count', () => {
    expect(cureRate(emptyTally())).toBeNull();
    expect(cureRate({ ...emptyTally(), healed: 8, failed: 2 })).toBe(80);
    expect(averageWait({ ...emptyTally(), waitCount: 10, waitTotal: 10 * 6 * 2 })).toBe(2);
    ctx.s.tally = { ...emptyTally(), healed: 6, failed: 4 };
    ctx.s.months = [month({ healed: 9, failed: 1, waitCount: 10, waitTotal: 10 * 6 * 3 })];
    expect(check({ kind: 'cureRate', percent: 85 })).toMatchObject({ done: true });
    expect(check({ kind: 'cureRate', percent: 95 })).toMatchObject({ done: false });
    expect(check({ kind: 'wait', days: 3 })).toMatchObject({
      label: 'Keep the average wait under 3 days for a month',
      done: true,
    });
    expect(check({ kind: 'wait', days: 2 })).toMatchObject({ done: false, progress: 2 / 3 });
    ctx.s.months = [];
    expect(check({ kind: 'wait', days: 2 })).toMatchObject({ done: false, progress: 0 });
  });

  it('counts emergencies seen through and days without anyone quitting', () => {
    ctx.s.stats.emergencies = 1;
    expect(check({ kind: 'emergencies', count: 1 })).toMatchObject({
      label: 'See an emergency through (1/1)',
      done: true,
    });
    expect(check({ kind: 'emergencies', count: 2 }).label).toBe('See 2 emergencies through (1/2)');
    ctx.s.day = 50;
    expect(check({ kind: 'noQuits', days: 30 })).toMatchObject({ done: true });
    ctx.s.stats.lastQuit = 40;
    expect(check({ kind: 'noQuits', days: 30 })).toMatchObject({
      label: 'Go 30 days without anyone quitting (10/30)',
      done: false,
    });
  });

  it('looks for a finished room at the prestige asked for', () => {
    const { sim, s, massage } = openCenter(1);
    const game = createContext(s);
    const goal: GoalSpec = { kind: 'prestige', room: 'massage', level: 2 };
    const level = sim.prestige(massage);
    expect(objectiveFor(game, goal)).toMatchObject({ label: 'Have a Massage Suite of prestige 2', done: level >= 2 });
    expect(objectiveFor(game, { ...goal, level: 6 })).toMatchObject({ done: false, progress: level / 6 });
    // a blueprint does not count
    massage.done = false;
    expect(objectiveFor(game, goal)).toMatchObject({ done: false, progress: 0 });
  });
});

describe('the counts behind the goals', () => {
  it('note who healed whom and when someone last quit', () => {
    const { sim, s, therapist } = openCenter(2);
    runUntil(sim, () => s.stats.healed >= 2, 900);
    expect(s.stats.healedBy.massage).toBe(s.stats.healed);
    therapist.morale = 0;
    therapist.unhappyT = 1000;
    runUntil(sim, () => therapist.state === 'leaving', 60);
    expect(s.stats.lastQuit).toBeGreaterThan(0);
    expect(s.stats.lastQuit).toBeLessThanOrEqual(s.day);
  });
});
