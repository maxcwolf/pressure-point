// How long a message on the right stays: long enough to read its words, longer for bad news and with the setting at
// Long, or until it is dismissed. Which messages show in full, and which wait in the pile under them.

import type { Tone } from '../../core/sim/events';
import type { MessageTime } from '../../storage/display';
import type { Toast } from '../hud';

/** Milliseconds every message stays, as long as every message used to, before the time its words take to read. */
const BASE_MS = 6500;
/** Milliseconds for each letter, an unhurried reading pace. */
const PER_LETTER_MS = 50;
/** How much longer bad news stays than the rest. */
const BAD_STAYS = 1.5;
/** How much longer every message stays with the setting at Long. */
const LONG_STAYS = 2;
/** Milliseconds a message takes to fade at the end of its time. */
export const FADE_MS = 500;
/** Milliseconds a message has left at least once the player has been reading it, so one about to fade can be finished. */
export const GRACE_MS = 1500;
/** How many messages show in full; any more wait in a pile under them. */
export const SHOWN = 4;
/** How many messages are kept at most, the oldest let go beyond it. */
export const KEPT = 50;

/** What each message time is called in the settings. */
export const MESSAGE_TIME_NAMES: Readonly<Record<MessageTime, string>> = {
  normal: 'Normal',
  long: 'Long',
  dismissed: 'Until dismissed',
};

/** How long a message stays, in milliseconds of the time its clock runs: for ever when set to stay until dismissed. */
export function messageLife(text: string, kind: Tone, time: MessageTime): number {
  if (time === 'dismissed') return Infinity;
  const read = (BASE_MS + PER_LETTER_MS * text.length) * (kind === 'bad' ? BAD_STAYS : 1);
  return time === 'long' ? read * LONG_STAYS : read;
}

/** The messages newest first: the few shown in full, and the rest piled under them. */
export function pileUp<T>(oldestFirst: readonly T[]): { shown: T[]; piled: T[] } {
  const newest = [...oldestFirst].reverse();
  return { shown: newest.slice(0, SHOWN), piled: newest.slice(SHOWN) };
}

/** The messages with one more at the top. One saying the same as one already there takes its place, counted. */
export function withMessage(oldestFirst: readonly Toast[], message: Omit<Toast, 'count' | 'age' | 'leaving'>): Toast[] {
  const same = oldestFirst.find((t) => t.text === message.text && t.kind === message.kind);
  const added: Toast = { ...message, count: (same?.count ?? 0) + 1, age: 0, leaving: false };
  return [...oldestFirst.filter((t) => t !== same), added].slice(-KEPT);
}

/**
 * Run the messages' clock `ms` on, fading each in the last moment of its time. The ones whose time is not up, and
 * whether any message faded or went.
 */
export function ageMessages(
  messages: readonly Toast[],
  ms: number,
  time: MessageTime,
): { kept: Toast[]; changed: boolean } {
  let changed = false;
  const kept: Toast[] = [];
  for (const t of messages) {
    t.age += ms;
    const left = messageLife(t.text, t.kind, time) - t.age;
    if (left <= 0) {
      changed = true;
      continue;
    }
    if (t.leaving !== left < FADE_MS) changed = true;
    t.leaving = left < FADE_MS;
    kept.push(t);
  }
  return { kept, changed };
}

/** Leave each message at least a moment more, and bring back any fading. */
export function spareMessages(messages: readonly Toast[], time: MessageTime) {
  for (const t of messages) {
    t.age = Math.max(0, Math.min(t.age, messageLife(t.text, t.kind, time) - GRACE_MS));
    t.leaving = false;
  }
}
