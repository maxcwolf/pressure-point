// What the interface says about rooms pencilled in.

import { ROLES, ROOMS } from '../../core/data';
import { an, dateOf, money } from '../../core/format';
import { sketchesCost, unfitCount } from '../../core/sim/sketches';
import type { GameState, Sketch } from '../../core/state/types';
import type { SketchFit, World } from '../../core/world';

/**
 * The Pencil in tab's one line: how many rooms are pencilled in, what building them all would cost, and how many of
 * them no longer fit where they are, if any.
 */
export function sketchCount(world: Pick<World, 's' | 'sketchFit'>): string {
  const n = world.s.sketches.length;
  if (!n) return 'Nothing pencilled in yet';
  const unfit = unfitCount(world);
  const trouble = unfit === 0 ? '' : unfit === 1 ? ' · one no longer fits' : ` · ${unfit} no longer fit`;
  return `${n} pencilled in · ${money(sketchesCost(world.s))} to build ${n === 1 ? 'it' : 'them all'}${trouble}`;
}

/** The small line on a sketch's floor label: its size, or what has gone wrong, in a word or two. */
export function sketchTag(sk: Pick<Sketch, 'w' | 'h'>, { standing }: SketchFit): string {
  if (standing === 'doorway') return '⚠ doorway blocked';
  if (standing === 'unfit') return '⚠ no longer fits';
  return `pencilled in · ${sk.w}×${sk.h}`;
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
