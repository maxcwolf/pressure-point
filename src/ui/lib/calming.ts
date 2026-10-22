// The words for a guest on a really bad trip being calmed down, and for the pill that shows while they run.

import { DAY_SECONDS, RUNAWAY_SECONDS } from '../../core/data';
import type { Guest } from '../../core/state/types';
import { clamp } from '../../core/util';
import { wholeDaysLeft } from './emergency';

/** Who is calming a runner down, or on the way to. */
export const calmingNote = (name: string, there: boolean) =>
  there ? `${name} is calming them down` : `${name} is on the way to calm them down`;

/** How long a runner has before they find the door, in words. */
export function daysToDoor(seconds: number): string {
  const days = seconds / DAY_SECONDS;
  if (days < 1) return 'less than a day';
  const whole = wholeDaysLeft(days);
  return `${whole} ${whole === 1 ? 'day' : 'days'}`;
}

/** The share of a runner's time left before they find the door. */
export const doorShare = (seconds: number) => clamp(seconds / RUNAWAY_SECONDS, 0, 1);

/** The pill's line for a runner, with how many more are running than the pills show, if any. */
export const runnerLine = (name: string, seconds: number, more = 0) =>
  `${name} is on a really bad trip: ${daysToDoor(seconds)} to the door${more ? ` (+${more} more)` : ''}`;

/** The most runners the pills show at once. */
export const RUNNER_PILLS = 3;

/** The runners the pills show, newest first, and how many more are running than that. */
export function runnersShown(runners: readonly Guest[]): { shown: Guest[]; more: number } {
  const newest = [...runners].sort((a, b) => (b.runaway ?? 0) - (a.runaway ?? 0));
  return { shown: newest.slice(0, RUNNER_PILLS), more: Math.max(0, newest.length - RUNNER_PILLS) };
}

/** What the button that sends someone after a runner says. */
export const sendLabel = (name: string) => `Send ${name}`;

/** Who would be sent after a runner, and why them. */
export const sendTitle = (name: string) =>
  `${name} is the nearest member of staff who is free: they go after them and talk them down.`;

/** Why nobody can be sent after a runner. */
export const NOBODY_FREE = 'Nobody is free to go: everyone is with a guest, or away.';
