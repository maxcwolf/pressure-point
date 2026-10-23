// The banner along the top for announcements over the speakers: one line at a time, held long enough to read. A line
// about something happening waits for the one showing to have been up a while; a joke while anything shows is let go.

/** How long a line stays up, in seconds, with nothing waiting behind it. */
export const SHOW_FOR = 8;

/** How long a line stays up at least before one waiting takes its place. */
export const MIN_SHOW = 3;

/** A line on the banner, numbered so a new one can come in as itself. */
export interface Shown {
  id: number;
  text: string;
  /** When it went up, in seconds. */
  at: number;
}

/** The banner's line and those waiting to follow it. */
export class Announcer {
  shown: Shown | null = null;
  private waiting: string[] = [];
  private nextId = 1;

  /**
   * Offer a line at `now` (in seconds). A joke, `flavor`, only shows on an empty banner; a line about something waits
   * its turn. Returns the line if it goes up at once.
   */
  offer(text: string, flavor: boolean, now: number): Shown | null {
    if (!this.shown) return this.put(text, now);
    if (flavor || text === this.shown.text || this.waiting.includes(text)) return null;
    if (now - this.shown.at >= MIN_SHOW) return this.put(text, now);
    this.waiting.push(text);
    return null;
  }

  /** Move the banner on to `now`. Returns the line that goes up, if one does, and whether the banner changed. */
  tick(now: number): { next: Shown | null; changed: boolean } {
    const shown = this.shown;
    if (!shown) return { next: null, changed: false };
    const age = now - shown.at;
    const waiting = this.waiting[0];
    if (waiting !== undefined && age >= MIN_SHOW) {
      this.waiting.shift();
      return { next: this.put(waiting, now), changed: true };
    }
    if (age < SHOW_FOR) return { next: null, changed: false };
    this.shown = null;
    return { next: null, changed: true };
  }

  /** Put a line up. */
  private put(text: string, now: number): Shown {
    this.shown = { id: this.nextId++, text, at: now };
    return this.shown;
  }
}
