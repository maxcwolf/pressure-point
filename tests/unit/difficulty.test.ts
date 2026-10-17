// How hard a sandbox game is: presets that set every pressure at once, and each pressure turned up or down on its own.
import { describe, expect, it } from 'vitest';

import {
  APPLICANT_DAYS,
  type Difficulty,
  type Knob,
  KNOB_ORDER,
  KNOBS,
  LOAN_MAX,
  LOAN_STEP,
} from '../../src/core/data';
import { nextLevel, presetLevels, presetOf, readDifficulty, tuning } from '../../src/core/difficulty';
import { fairSalary, makeCandidate } from '../../src/core/people';
import { setSeed } from '../../src/core/random';
import { updateApplicants } from '../../src/core/sim/careers';
import type { SimContext } from '../../src/core/sim/context';
import { borrow, changeRep, loanLimit } from '../../src/core/sim/economy';
import { declineEmergency } from '../../src/core/sim/emergencies';
import { admitGuests, spawnGuest, updateGuest } from '../../src/core/sim/guests';
import { declineOutbreak } from '../../src/core/sim/outbreaks';
import type { Sim } from '../../src/core/sim/sim';
import { fairPay } from '../../src/core/sim/staffing';
import { treatmentFee } from '../../src/core/sim/stations';
import { addWear } from '../../src/core/sim/upkeep';
import { inspectionGap } from '../../src/core/sim/visits';
import { newGame } from '../../src/core/state/game';
import type { GameState } from '../../src/core/state/types';
import { upgradeSave } from '../../src/core/state/upgrade';
import { addMassage, freshSim, openCenter, run } from './helpers';

/** The simulation's own context, for calling its parts directly. */
const ctxOf = (sim: Sim) => (sim as unknown as { ctx: SimContext }).ctx;

/** A game with one setting at a level. */
const gameWith = (k: Knob, level: 'easier' | 'harder'): GameState => ({ ...newGame(), difficulty: { [k]: level } });

/**
 * The same thing done in a game at each level of one setting, from the same random numbers, as the ratio of each
 * level's result to the usual one.
 */
function ratios(k: Knob, measure: (sim: Sim) => number) {
  /** The measure in a game set this way. */
  const at = (difficulty: Difficulty) => {
    const sim = freshSim(5);
    sim.s.difficulty = difficulty;
    setSeed(5, sim.s);
    return measure(sim);
  };
  const usual = at({});
  return { easier: at({ [k]: 'easier' }) / usual, harder: at({ [k]: 'harder' }) / usual };
}

describe('the difficulty settings', () => {
  it('change nothing as usual, which is what a game with none set has', () => {
    for (const k of KNOB_ORDER) {
      expect(tuning(newGame(), k)).toBe(1);
      expect(KNOBS[k].factor.usual).toBe(1);
    }
  });

  it('click round from easier to usual to harder and back', () => {
    expect(nextLevel('easier')).toBe('usual');
    expect(nextLevel('usual')).toBe('harder');
    expect(nextLevel('harder')).toBe('easier');
  });

  it('match a preset when every setting is at its level, and none when set one by one', () => {
    expect(presetOf({})).toBe('standard');
    expect(presetOf(presetLevels('relaxed'))).toBe('relaxed');
    expect(presetOf(presetLevels('demanding'))).toBe('demanding');
    expect(Object.values(presetLevels('relaxed')).every((l) => l === 'easier')).toBe(true);
    expect(presetOf({ ...presetLevels('relaxed'), wear: 'usual' })).toBeNull();
  });

  it('read back from storage keep only settings and levels the game knows', () => {
    expect(readDifficulty({ patience: 'harder', wear: 'brutal', luck: 'easier', loans: 3 })).toEqual({
      patience: 'harder',
    });
    expect(readDifficulty('hard')).toEqual({});
  });

  it('are as usual in a save from before there was a difficulty', () => {
    const old: Partial<GameState> = newGame();
    delete old.difficulty;
    upgradeSave(old as GameState);
    expect(old.difficulty).toEqual({});
  });
});

describe('each setting', () => {
  it('brings guests more or less often', () => {
    const r = ratios('arrivals', (sim) => {
      sim.s.open = true;
      sim.s.spawnT = 0;
      admitGuests(ctxOf(sim), 0.1);
      return sim.s.spawnT;
    });
    expect(r.easier).toBeCloseTo(0.8);
    expect(r.harder).toBeCloseTo(1.25);
  });

  it('makes guests lose patience more slowly or quickly', () => {
    const r = ratios('patience', (sim) => {
      const g = spawnGuest(ctxOf(sim))!;
      g.state = 'waiting';
      g.timer = 10;
      updateGuest(ctxOf(sim), g, 1);
      return 100 - g.patience;
    });
    expect(r.easier).toBeCloseTo(0.75);
    expect(r.harder).toBeCloseTo(1.3);
  });

  it('brings applicants more or less often', () => {
    for (const level of ['easier', 'harder'] as const) {
      const sim = freshSim();
      sim.s.difficulty = { applicants: level };
      sim.s.nextApplicant = 0;
      updateApplicants(ctxOf(sim));
      expect(sim.s.nextApplicant).toBeCloseTo(APPLICANT_DAYS * KNOBS.applicants.factor[level]);
    }
  });

  it('wears equipment more slowly or quickly', () => {
    const r = ratios('wear', (sim) => {
      addMassage(sim);
      const it = sim.s.items.find((i) => i.type === 'massage_table')!;
      addWear(ctxOf(sim), it);
      return it.wear;
    });
    expect(r.easier).toBeCloseTo(0.7);
    expect(r.harder).toBeCloseTo(1.4);
  });

  it('tires staff more slowly or quickly', () => {
    /** How much energy the therapist loses over a few seconds' work in a game set this way. */
    const drop = (difficulty: Difficulty) => {
      const { sim, therapist } = openCenter();
      sim.s.difficulty = difficulty;
      run(sim, 5);
      const before = therapist.energy;
      run(sim, 5);
      return before - therapist.energy;
    };
    expect(drop({ tiredness: 'easier' })).toBeLessThan(drop({}));
    expect(drop({ tiredness: 'harder' })).toBeGreaterThan(drop({}));
  });

  it('pays staff less or more, to the nearest $10', () => {
    for (const level of ['easier', 'harder'] as const) {
      const s = gameWith('salaries', level);
      setSeed(3, s);
      const c = makeCandidate(s, 'therapist');
      const fair = fairSalary(c.role, c.skill, c.traits, c.quals);
      expect(c.salary).toBe(Math.round((fair * KNOBS.salaries.factor[level]) / 10) * 10);
    }
    const st = { role: 'therapist', skill: 3, traits: [], quals: ['swedish'], general: [] } as never;
    expect(fairPay(st, 1.2)).toBeGreaterThan(fairPay(st));
  });

  it('makes treatments bring in more or less', () => {
    expect(treatmentFee(gameWith('fees', 'easier'), 1000, 1)).toBe(1150);
    expect(treatmentFee(gameWith('fees', 'harder'), 1000, 1)).toBe(850);
    expect(treatmentFee(newGame(), 1000, 1)).toBe(1000);
  });

  it('lets the bank lend more or less', () => {
    expect(loanLimit(newGame())).toBe(LOAN_MAX);
    expect(loanLimit(gameWith('loans', 'easier'))).toBe(LOAN_MAX * 1.5);
    expect(loanLimit(gameWith('loans', 'harder'))).toBe(LOAN_MAX / 2);
    const sim = freshSim();
    sim.s.difficulty = { loans: 'harder' };
    let steps = 0;
    while (borrow(ctxOf(sim))) steps++;
    expect(steps * LOAN_STEP).toBe(LOAN_MAX / 2);
  });

  it('brings trouble less or more often', () => {
    const inspections = ratios('trouble', (sim) => inspectionGap(sim.s));
    expect(inspections.easier).toBeCloseTo(1.5, 1);
    expect(inspections.harder).toBeCloseTo(0.7, 1);
    const outbreaks = ratios('trouble', (sim) => {
      declineOutbreak(ctxOf(sim));
      return sim.s.nextOutbreak;
    });
    expect(outbreaks.easier).toBeCloseTo(1.5);
    expect(outbreaks.harder).toBeCloseTo(0.7);
  });

  it('offers emergencies and challenges more or less often', () => {
    const r = ratios('chances', (sim) => {
      declineEmergency(ctxOf(sim));
      return sim.s.nextEmergency;
    });
    expect(r.easier).toBeCloseTo(0.75);
    expect(r.harder).toBeCloseTo(1.3);
  });

  it('earns reputation faster or slower, but loses it as usual', () => {
    const gain = ratios('reputation', (sim) => {
      changeRep(ctxOf(sim), 5);
      return sim.s.reputation - 30;
    });
    expect(gain.easier).toBeCloseTo(1.25);
    expect(gain.harder).toBeCloseTo(0.8);
    const loss = ratios('reputation', (sim) => {
      changeRep(ctxOf(sim), -5);
      return sim.s.reputation;
    });
    expect(loss).toEqual({ easier: 1, harder: 1 });
  });
});
