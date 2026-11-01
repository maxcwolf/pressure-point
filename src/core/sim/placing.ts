// The clock stopping on its own while a room or an item is being placed, and starting again once it is down.

import type { SimContext } from './context';

/** What the player is doing, looked at every frame, and whether the clock is to stop for it. */
export interface PlacingNow {
  /** Placing a room or an item. */
  placing: boolean;
  /** Choosing the next one from the Rooms or Items menu, which keeps a clock already stopped for placing stopped. */
  choosing: boolean;
  /** Whether the clock stops for placing at all: the switch in Settings. */
  auto: boolean;
}

/**
 * One look, every frame, at whether a room or an item is being placed. The clock stops as placing starts, if `auto`
 * and it is running, and goes back to the speed it had once placing ends. A player who had it stopped already keeps it
 * stopped, and one who sets it going by hand meanwhile has it to themselves until placing ends.
 */
export function watchPlacing(ctx: SimContext, { placing, choosing, auto }: PlacingNow) {
  const s = ctx.s;
  // set going again by hand: the clock is the player's from here, to stop or start as they like
  if (ctx.resumeSpeed !== undefined && s.speed !== 0) delete ctx.resumeSpeed;
  // picking the next thing from a build menu, after putting one down to open it, is still placing
  const busy = placing || (choosing && ctx.resumeSpeed !== undefined);
  if (busy && !ctx.placing && auto && s.speed > 0) {
    ctx.resumeSpeed = s.speed;
    s.speed = 0;
  } else if (!busy && ctx.resumeSpeed !== undefined) {
    s.speed = ctx.resumeSpeed;
    delete ctx.resumeSpeed;
  }
  ctx.placing = busy;
}

/** Whether the clock is stopped only for something being placed, and starts again by itself once it is down. */
export const pausedToPlace = (ctx: SimContext): boolean => ctx.resumeSpeed !== undefined;
