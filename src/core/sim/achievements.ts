// Campaign achievements: one-off feats that earn karma, noticed the moment they are done.

import { ACHIEVEMENT_ORDER, ACHIEVEMENTS, CAMPAIGN } from '../data';
import type { SimContext } from './context';
import { emit, toast } from './events';
import { objectiveFor } from './goals';

/**
 * Award any campaign achievement done in this game that has not been earned before. Sandbox games earn none, and nor
 * does a game the cheat console has been used in.
 */
export function checkAchievements(ctx: SimContext) {
  const s = ctx.s;
  if (!CAMPAIGN.includes(s.center) || s.cheated) return;
  for (const id of ACHIEVEMENT_ORDER) {
    if (s.achieved.includes(id)) continue;
    const a = ACHIEVEMENTS[id];
    if (!objectiveFor(ctx, a.goal).done) continue;
    s.achieved.push(id);
    toast(ctx, `Achievement: ${a.name}! +${a.karma} karma to spend in any center.`, 'good', undefined, a.icon);
    emit(ctx, { type: 'sfx', name: 'fanfare' });
    emit(ctx, { type: 'achievement', id });
  }
}
