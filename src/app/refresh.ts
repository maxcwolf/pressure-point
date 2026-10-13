// Deciding when the interface redraws.

/** Says when the interface is due a redraw: at once after a change, and a few times a second regardless. */
export class Refresh {
  private stale = true;
  private since = 0;

  /** Ask for a redraw on the next frame. */
  request() {
    this.stale = true;
  }

  /** Whether to redraw this frame. Answering yes starts the wait over. */
  due(dt: number): boolean {
    this.since += dt;
    if (!this.stale && this.since <= 0.2) return false;
    this.stale = false;
    this.since = 0;
    return true;
  }
}
