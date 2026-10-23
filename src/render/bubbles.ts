// How a speech bubble over someone's head comes and goes, and how it reads at a glance: white for something said, red
// for an alarm a player should act on now and amber for a need that will become one; a quick pop in and shrink out;
// a gentle pulse on an alarm; and a least time on screen, so a bubble said at speed 3 is still there to be read.

import type { BubbleId } from '../core/state/types';
import { hasVariant, type IconVariant } from './models/icons';

/** How big a speech bubble is, in meters across, before anything keeps it readable from afar (see readable.ts). */
export const BUBBLE_SIZE = 0.62;

/** Where a bubble's tail ends, as a fraction of its sprite's height from the bottom: what sits on the head. */
export const BUBBLE_TAIL = 0.05;

/**
 * The least time a bubble shows, in seconds of real time, however briefly it was said: a bubble lasting 2.2 seconds of
 * the game is gone in 0.73 seconds at speed 3, too quick to read.
 */
export const MIN_SHOWN = 1.4;

/** How long a bubble takes to pop in and to shrink away, in seconds. */
export const POP_IN = 0.15;
export const SHRINK_OUT = 0.1;

/** How much an alarm swells as it pulses, as a share of its size, and how many times a second. */
export const PULSE = 0.15;
export const PULSE_HZ = 1.5;

/** The colors a bubble comes in. */
export type BubbleTone = Extract<IconVariant, 'bubble' | 'alarm' | 'need'>;

/** What a bubble says: an icon, and the color of the bubble round it. */
export interface Said {
  id: BubbleId;
  tone: BubbleTone;
}

/** The usual color of an icon's bubble: red if the atlas has it as an alarm, amber as a need, white otherwise. */
export function toneOf(id: BubbleId): BubbleTone {
  if (hasVariant(id, 'alarm')) return 'alarm';
  if (hasVariant(id, 'need')) return 'need';
  return 'bubble';
}

/** An icon said in its usual color. */
export const saying = (id: BubbleId): Said => ({ id, tone: toneOf(id) });

/**
 * How often, and for how long, a guest whose patience is running out shows it in an amber hourglass, in seconds: now
 * and then, before they are fed up and it turns red for good.
 */
export const NUDGE_EVERY = 6;
export const NUDGE_FOR = 1.6;

/** Whether someone running out of patience shows it at this moment, each on a beat of their own. */
export const nudging = (t: number, id: number) => (t + id * 1.7) % NUDGE_EVERY < NUDGE_FOR;

/** The bubble shown over someone's head, kept from frame to frame. */
export interface BubbleShown {
  /** What it says, or nothing; still set while it shrinks away. */
  said: Said | null;
  /** When it popped in, in seconds. */
  since: number;
  /** When it began to shrink away, or null while it stays. */
  gone: number | null;
}

/** No bubble at all. */
export const quiet = (): BubbleShown => ({ said: null, since: 0, gone: null });

/** Whether two bubbles say the same thing in the same color. */
const same = (a: Said | null, b: Said | null) => !!a && !!b && a.id === b.id && a.tone === b.tone;

/**
 * Move a bubble on to what someone wants to say at time `t`: a new one pops in at once, in place of any other; one no
 * longer said stays until it has been up `MIN_SHOWN`, then shrinks away; one said again as it shrinks comes back.
 */
export function follow(shown: BubbleShown, wanted: Said | null, t: number): BubbleShown {
  if (wanted) {
    if (!same(wanted, shown.said)) return { said: wanted, since: t, gone: null };
    return shown.gone === null ? shown : { said: wanted, since: t - POP_IN, gone: null };
  }
  if (!shown.said) return shown;
  if (shown.gone !== null) return t - shown.gone >= SHRINK_OUT ? quiet() : shown;
  if (t - shown.since < MIN_SHOWN) return shown;
  return { ...shown, gone: t };
}

/** A pop that overshoots a little and settles, from 0 at the start to 1 at the end. */
function overshoot(f: number) {
  const c = 1.7;
  const g = f - 1;
  return Math.max(0, 1 + (c + 1) * g * g * g + c * g * g);
}

/** How big a bubble shows at time `t`, as a share of its size: popping in, shrinking away, and pulsing if an alarm. */
export function bubbleScale(shown: BubbleShown, t: number): number {
  if (!shown.said) return 0;
  const age = t - shown.since;
  let s = age < POP_IN ? overshoot(Math.max(0, age) / POP_IN) : 1;
  if (shown.gone !== null) s *= Math.max(0, 1 - (t - shown.gone) / SHRINK_OUT);
  if (shown.said.tone === 'alarm') s *= 1 + (PULSE * (1 - Math.cos(2 * Math.PI * PULSE_HZ * age))) / 2;
  return s;
}
