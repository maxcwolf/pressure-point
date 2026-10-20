// Fixes from the 20 October 2026 deep-dive audit, one test each, in the audit's order.
import { describe, expect, it } from 'vitest';

import { setSeed } from '../../src/core/random';
import { checkAchievements } from '../../src/core/sim/achievements';
import { createContext } from '../../src/core/sim/context';
import { drainEvents, earnsForCampaign } from '../../src/core/sim/events';
import { newGame } from '../../src/core/state/game';

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
