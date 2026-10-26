// What the interface says about rooms pencilled in.

import { ROLES, ROOMS } from '../../core/data';
import { an, dateOf, money } from '../../core/format';
import { sketchesCost } from '../../core/sim/sketches';
import type { GameState, Sketch } from '../../core/state/types';

/** The Pencil in tab's one line: how many rooms are pencilled in, and what building them all would cost. */
export function sketchCount(s: Pick<GameState, 'sketches'>): string {
  const n = s.sketches.length;
  if (!n) return 'Nothing pencilled in yet';
  return `${n} pencilled in · ${money(sketchesCost(s))} to build ${n === 1 ? 'it' : 'them all'}`;
}

/** The day a sketch was drawn, as the bottom bar dates a day: "Day 21", and the month and year if not this month's. */
export function sketchDay(sk: Pick<Sketch, 'day'>, s: Pick<GameState, 'day' | 'startMonth'>): string {
  const then = dateOf(sk.day, s.startMonth);
  const now = dateOf(s.day, s.startMonth);
  return then.month === now.month && then.year === now.year
    ? `Day ${then.day}`
    : `Day ${then.day} of M${then.month} Y${then.year}`;
}

/** A sketch's line in its inspector: when it was drawn, who its room needs once it opens, and what it keeps clear. */
export function sketchNote(sk: Sketch, s: Pick<GameState, 'day' | 'startMonth'>): string {
  const role = ROOMS[sk.type].staff;
  const needs = role ? ` Needs ${an(ROLES[role].name)} once it opens.` : '';
  return `Pencilled in on ${sketchDay(sk, s)}.${needs} Nothing can be placed on it until you erase it.`;
}

/** What the blueprint panel says when the bank cannot cover the room, or null when it can. */
export function shortfall(have: number, cost: number): string | null {
  return have < cost ? `You have ${money(have)}: not enough to build this yet.` : null;
}
