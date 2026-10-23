// Holding the advisor's note on screen long enough to read, rather than flipping between two notes as their figures
// move. The advisor itself has no memory: it says whatever is most pressing this moment.

import type { Advice, AdviceLevel } from '../../core/sim/advisor';
import type { Subject } from '../../core/sim/events';

/** How long a note stays on screen before another of the same or a lower level may take its place, in seconds. */
export const HOLD_FOR = 3.5;

/** How long a note has to stay gone from the advisor before it counts as dealt with, in seconds. */
export const GONE_FOR = 2.5;

/** How pressing each level of note is: a higher one takes the place of a lower one at once. */
const RANK: Record<AdviceLevel, number> = { tip: 0, step: 1, alarm: 2 };

/** The note on screen, numbered so the interface can tell a new one from the same one with new figures. */
export interface ShownNote extends Advice {
  id: number;
}

/** A note with its figures and amounts left out, so the same note with new numbers is still the same note. */
export function noteKey(note: Advice): string {
  const about = note.about ? `${note.about.kind}:${String(note.about.id)}|` : '';
  return about + note.text.replace(/[$−-]?\d[\d,.]*%?/g, '#');
}

/** The note's first sentence, to show bold, and the rest. */
export function headline(text: string): { head: string; rest: string } {
  const m = /^(.+?[.!?])\s+(?=[A-Z0-9$−"“])/.exec(text);
  if (!m?.[1]) return { head: text, rest: '' };
  return { head: m[1], rest: text.slice(m[0].length) };
}

/** Keeps the note shown for a while, and says which note to show. */
export class AdviceHold {
  private shown: ShownNote | null = null;
  private key = '';
  /** When the note on screen was put there, in seconds. */
  private since = 0;
  /** When the advisor last stopped giving the note on screen, if it has. */
  private goneSince: number | null = null;
  private nextId = 1;

  /**
   * The note to show at `now` (in seconds of real time), given the advisor's note this moment and whether something a
   * note is about is still there to be shown.
   */
  show(current: Advice, now: number, exists: (about: Subject) => boolean): ShownNote {
    const key = noteKey(current);
    const shown = this.shown;
    if (!shown) return this.put(current, key, now);
    if (key === this.key) {
      this.goneSince = null;
      // the same note, its figures held while it shows, and brought up to date once it has been read
      if (now - this.since < HOLD_FOR) return shown;
      this.shown = { ...current, id: shown.id };
      this.since = now;
      return this.shown;
    }
    this.goneSince ??= now;
    /** How pressing a note is. */
    const rank = (n: Advice) => RANK[n.level ?? 'tip'];
    const resolved =
      // a step in setting up is done once the advisor has moved on from it
      shown.level === 'step' || (shown.about !== undefined && !exists(shown.about)) || now - this.goneSince >= GONE_FOR;
    if (rank(current) > rank(shown) || resolved || now - this.since >= HOLD_FOR) return this.put(current, key, now);
    return shown;
  }

  /** Put a new note on screen. */
  private put(note: Advice, key: string, now: number): ShownNote {
    this.shown = { ...note, id: this.nextId++ };
    this.key = key;
    this.since = now;
    this.goneSince = null;
    return this.shown;
  }
}
