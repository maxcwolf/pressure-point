// What the interface says about rooms pencilled in.

import { type IconId, ITEMS, type ItemType, ROLES, ROOMS } from '../../core/data';
import { an, dateOf, money } from '../../core/format';
import type { Layout } from '../../core/room-layout';
import { noLongerFits, sketchCost, sketchesCost, unfitCount } from '../../core/sim/sketches';
import type { GameState, Sketch } from '../../core/state/types';
import type { SketchFit, SketchStanding, World } from '../../core/world';

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

/** What has gone wrong with a sketch, in a word or two, if anything has. */
function trouble({ standing }: SketchFit): string | null {
  if (standing === 'doorway') return '⚠ doorway blocked';
  if (standing === 'unfit') return '⚠ no longer fits';
  return null;
}

/**
 * The small line on a sketch's floor label: its size, or the template it remembers, or what has gone wrong, in a word
 * or two.
 */
export function sketchTag(sk: Pick<Sketch, 'w' | 'h' | 'template'>, fit: SketchFit): string {
  return (
    trouble(fit) ??
    (sk.template !== undefined ? `from "${sk.template}" · pencilled in` : `pencilled in · ${sk.w}×${sk.h}`)
  );
}

/**
 * The small line on a sketch's floor label while the Plans overlay is on: its price and whether it fits, or the
 * template it remembers, or what has gone wrong.
 */
export function plansTag(sk: Pick<Sketch, 'type' | 'w' | 'h' | 'layout' | 'template'>, fit: SketchFit): string {
  const price = money(sketchCost(sk));
  if (fit.standing === 'waits') return `${price} · waits for its land`;
  return trouble(fit) ?? (sk.template !== undefined ? `${price} · from "${sk.template}"` : `${price} · fits`);
}

/** A name, or so many of it: "a Plant", "2 Plants". */
function counted(n: number, name: string): string {
  return n === 1 ? an(name) : `${n} ${name}${/(s|sh|ch|x)$/.test(name) ? 'es' : 's'}`;
}

/** Things listed as a sentence says them: "a, b and c". */
function listed(parts: readonly string[]): string {
  return parts.length < 2 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1) ?? ''}`;
}

/**
 * What the room a sketch remembers holds, as its panel says it: "Remembers a Massage Table, an Oil Trolley, a Plant
 * and 2 windows. Built whole when you build it." Furniture is named in the order the layout lists it, and counted; a
 * certificate, which is earned rather than built, is left out.
 */
export function remembers(l: Layout): string {
  const counts = new Map<ItemType, number>();
  for (const it of l.items)
    if (it.type !== 'certificate' && Object.hasOwn(ITEMS, it.type)) counts.set(it.type, (counts.get(it.type) ?? 0) + 1);
  const parts = [...counts].map(([type, n]) => counted(n, ITEMS[type].name));
  if (l.windows.length) parts.push(l.windows.length === 1 ? 'a window' : `${l.windows.length} windows`);
  const held = parts.length ? listed(parts) : 'an empty room';
  return `Remembers ${held}. Built whole when you build it.`;
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
  // one that remembers a room says what it holds first, and leaves out what it keeps clear, for room
  if (sk.layout) return `${remembers(sk.layout)} Pencilled in on ${sketchDay(sk, s)}.${needs}`;
  return `Pencilled in on ${sketchDay(sk, s)}.${needs} Nothing can be placed on it until you erase it.`;
}

/** The Plans overlay's line: how many rooms are pencilled in, what building them all would cost, and how many no longer fit. */
export function plansLine(world: Pick<World, 's' | 'sketchFit'>): string {
  const n = world.s.sketches.length;
  if (!n) return 'Nothing pencilled in yet. Pencil rooms in from the Rooms menu.';
  const unfit = unfitCount(world);
  const trouble = unfit === 0 ? '' : unfit === 1 ? ' One no longer fits.' : ` ${unfit} no longer fit.`;
  return `${n} pencilled in · ${money(sketchesCost(world.s))} to build ${n === 1 ? 'it' : 'them all'}.${trouble}`;
}

/** A sketch's row in the Plans overlay's list. */
export interface PlanRow {
  id: number;
  icon: IconId;
  name: string;
  /** Its size, or the template it remembers, and the day it was drawn: "4×4 · Day 21". */
  sub: string;
  standing: SketchStanding;
  /** Its fit in a word: "✔ fits", "⚠ doorway". */
  chip: string;
  /** Whether it no longer fits, or its doorway is blocked, and so counts as trouble. */
  unfit: boolean;
  price: string;
}

/** What each fit is called in the Plans overlay's list. */
const FIT_CHIPS: Record<SketchStanding, string> = {
  fits: '✔ fits',
  waits: '⌛ waits',
  doorway: '⚠ doorway',
  unfit: "⚠ doesn't fit",
};

/** The Plans overlay's list: a row per sketch, in the order they were drawn. */
export function planRows(world: Pick<World, 's' | 'sketchFit'>): PlanRow[] {
  return world.s.sketches.map((sk) => {
    const def = ROOMS[sk.type];
    const { standing } = world.sketchFit(sk);
    const what = sk.template ?? `${sk.w}×${sk.h}`;
    return {
      id: sk.id,
      icon: def.icon,
      name: def.name,
      sub: `${what} · ${sketchDay(sk, world.s)}`,
      standing,
      chip: FIT_CHIPS[standing],
      unfit: noLongerFits(world, sk),
      price: money(sketchCost(sk)),
    };
  });
}

/** What the blueprint panel says when the bank cannot cover the room, or null when it can. */
export function shortfall(have: number, cost: number): string | null {
  return have < cost ? `You have ${money(have)}: not enough to build this yet.` : null;
}
