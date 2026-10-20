// Fixes from the 20 October 2026 deep-dive audit, one test each, in the audit's order.
import { describe, expect, it } from 'vitest';

import type { Offering } from '../../src/core/data';
import { setSeed } from '../../src/core/random';
import { checkAchievements } from '../../src/core/sim/achievements';
import { createContext } from '../../src/core/sim/context';
import { drainEvents, earnsForCampaign } from '../../src/core/sim/events';
import { averagePatience } from '../../src/core/sim/goals';
import { monthSoFar } from '../../src/core/sim/records';
import { emptyTally, newGame } from '../../src/core/state/game';
import { upgradeSave } from '../../src/core/state/upgrade';
import { templateLock } from '../../src/core/templates';
import { addQigong, openCenter } from './helpers';

describe('karma from a star or an achievement', () => {
  it('is noted for the campaign as it is earned, not at the next autosave', () => {
    setSeed(1);
    const ctx = createContext(newGame('willow'));
    ctx.s.stats.healed = 100;
    checkAchievements(ctx);
    expect(drainEvents(ctx).filter(earnsForCampaign)).toEqual([{ type: 'achievement', id: 'century' }]);
    expect(earnsForCampaign({ type: 'star', stars: 1 })).toBe(true);
    expect(earnsForCampaign({ type: 'visit' })).toBe(false);
  });
});

describe('months saved before patience was kept', () => {
  it('stay without it after the save is brought up to date, rather than read as no patience kept at all', () => {
    const old = newGame('willow');
    const month = { ...monthSoFar(createContext(old)), waitCount: 30 };
    delete month.patienceTotal;
    old.months = [month];
    old.tally = { ...emptyTally(), waitCount: 12 };
    delete old.tally.patienceTotal;
    upgradeSave(old);
    expect(averagePatience(old.months[0]!)).toBeNull();
    expect(old.tally.patienceTotal).toBeUndefined();
  });
});

describe('a Qi Gong Studio template', () => {
  it('is locked while the classes are switched off', () => {
    const { sim } = openCenter(1);
    const studio = sim.roomLayout(addQigong(sim));
    /** Everything is on but the Qi Gong classes. */
    const noClasses = (o: Offering) => o !== 'qigong';
    expect(templateLock(studio, { upTo: Infinity, unlocked: [], enabled: noClasses })).toBe(
      'Qi Gong classes are switched off',
    );
    /** Everything is on. */
    const allOn = () => true;
    expect(templateLock(studio, { upTo: Infinity, unlocked: [], enabled: allOn })).toBe('');
  });
});
