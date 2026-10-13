// Deciding when the interface redraws.

/** How long the interface goes without a redraw when nothing has asked for one, in seconds. */
export const REFRESH_EVERY = 0.2;

/** Says when the interface is due a redraw: at once after a change, and a few times a second regardless. */
export interface Refresh {
  /** Ask for a redraw on the next frame. */
  request: () => void;
  /** Whether to redraw this frame. Answering yes starts the wait over. */
  due: (dt: number) => boolean;
}

/** Start keeping track of when the interface is next due a redraw. The first frame always is. */
export function createRefresh(): Refresh {
  let stale = true;
  let since = 0;
  return {
    /** Ask for a redraw on the next frame. */
    request: () => {
      stale = true;
    },
    /** Whether to redraw this frame. Answering yes starts the wait over. */
    due: (dt) => {
      since += dt;
      if (!stale && since <= REFRESH_EVERY) return false;
      stale = false;
      since = 0;
      return true;
    },
  };
}
