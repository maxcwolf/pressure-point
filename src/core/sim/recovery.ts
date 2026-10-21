// The Recovery Lounge: after the harder treatments a guest lies back on a Recliner for a while before heading on.
// With no free Recliner to go to, those treatments work less often and the guest leaves woozy.

import { NO_REST_PENALTY, REST_SECONDS } from '../data';
import type { Guest, Item } from '../state/types';
import { accessPose, accessTile } from '../world';
import { say } from './chars';
import { claim, findAccess, release } from './claims';
import type { SimContext } from './context';
import { tipOnce } from './events';
import { feel } from './feelings';
import { useLinens } from './linens';
import { goTo } from './movement';
import { modalityOf } from './treatments';

/** Whether a guest's treatment leaves them needing a rest afterwards. */
export const needsRest = (g: Guest) => !!modalityOf(g).rest;

/** The nearest free Recliner for a guest to rest on, if any. */
export function restSpot(ctx: SimContext, g: Guest): { item: Item; idx: number } | null {
  return findAccess(ctx, 'recover', g.tx, g.ty);
}

/** What a guest's treatment loses for want of somewhere to rest after it: nothing if it needs none or one is free. */
export function restPenalty(ctx: SimContext, g: Guest): number {
  return needsRest(g) && !restSpot(ctx, g) ? NO_REST_PENALTY : 0;
}

/**
 * How a guest who needs a rest feels about where they rest, as their treatment ends: glad of a Recliner, noticing its
 * blanket, or woozy with nowhere to lie down. Returns the Recliner they will rest on, if any.
 */
export function settleRest(ctx: SimContext, g: Guest): { item: Item; idx: number } | null {
  if (!needsRest(g)) return null;
  const spot = restSpot(ctx, g);
  if (spot) {
    feel(g, 'rested');
    useLinens(ctx, spot.item, g);
    return spot;
  }
  feel(g, 'woozy');
  const lounge = ctx.s.rooms.some((r) => r.done && r.type === 'recovery');
  tipOnce(
    ctx,
    lounge ? 'recovery-full' : 'recovery-none',
    lounge
      ? 'Every Recliner in the Recovery Lounge was taken, so a guest went home woozy and their treatment was less likely to work. Add more Recliners.'
      : 'Some treatments leave guests needing a lie-down. Without a Recovery Lounge they go home woozy, and the treatment is less likely to work.',
    'bad',
  );
  return null;
}

/** Send a guest off to lie back on a Recliner. False if they cannot get there. */
export function goRest(ctx: SimContext, g: Guest, spot: { item: Item; idx: number }): boolean {
  claim(ctx, g, spot.item, spot.idx);
  const [x, y] = accessTile(spot.item, spot.idx);
  if (!goTo(ctx, g, x, y, accessPose(spot.item, spot.idx))) {
    release(ctx, g);
    return false;
  }
  g.state = 'toRest';
  return true;
}

/** Move a resting guest along: lying down once they reach their Recliner, and up again when rested. True when done. */
export function updateRest(g: Guest, dt: number, arrived: boolean): boolean {
  if (g.state === 'toRest') {
    if (!arrived && g.path) return false;
    if (!arrived) return true;
    g.state = 'resting';
    g.timer = REST_SECONDS;
    say(g, 'bubble-relieved', 4);
    return false;
  }
  g.timer -= dt;
  return g.timer <= 0;
}
