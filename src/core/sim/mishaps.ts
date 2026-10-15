// Mishaps: now and then the center has one coming, announced a few days ahead. It can be prepared for at a price; if
// not, it does its harm as it starts. While it lasts, some items are out of action, or fewer guests come.

import {
  centerOf,
  ITEMS,
  MISHAP_GAP_DAYS,
  MISHAP_NOTICE_DAYS,
  MISHAP_RETRY_DAYS,
  type MishapDef,
  type MishapId,
  MISHAPS,
} from '../data';
import { money } from '../format';
import { irnd, pick } from '../random';
import type { GameState, Mishap } from '../state/types';
import type { SimContext } from './context';
import { spend } from './economy';
import { emit, tipOnce, toast } from './events';
import { seasonOf } from './twists';

/** The mishap that comes next here: the center's own, if it has one and it is in season, or none. */
export function chooseMishap(s: GameState): MishapId | null {
  const own = centerOf(s).mishap;
  if (!own) return null;
  // a freeze only comes in winter
  if (MISHAPS[own].winterOnly && seasonOf(s.day) !== 'winter') return null;
  return own;
}

/** A mishap announced today, to start a few days from now. */
export function newMishap(day: number, kind: MishapId): Mishap {
  const starts = day + MISHAP_NOTICE_DAYS;
  return { kind, starts, ends: starts + MISHAPS[kind].days, prepared: false, started: false };
}

/** The mishap under way, if one is. */
export const mishapOn = (s: GameState): MishapDef | undefined =>
  s.mishap?.started ? MISHAPS[s.mishap.kind] : undefined;

/** The mishap under way, if it has taken anything out of action as things stand. */
export function mishapStopping(s: GameState): MishapDef | undefined {
  const def = mishapOn(s);
  if (!def?.stops || s.mishap?.prepared) return undefined;
  return def;
}

/** A number of days in words, counting a part day as a day, or less than a day. */
export function daysInWords(days: number): string {
  if (days < 1) return 'less than a day';
  const whole = Math.ceil(days - 1e-9);
  return `${whole} ${whole === 1 ? 'day' : 'days'}`;
}

/** The advisor's line while a mishap has things out of action, so it does not ask for what is only stopped. */
export function mishapAdvice(s: GameState): string {
  const def = mishapStopping(s);
  if (!def) return '';
  return `${def.icon} The ${def.name.toLowerCase()} has put ${def.stopsWhat ?? 'some things'} out of action. It will be over in ${daysInWords(mishapDaysLeft(s))}.`;
}

/** How many guests arrive while a mishap is under way, against usual. */
export const mishapArrivals = (s: GameState) => mishapOn(s)?.arrivals ?? 1;

/** Days until an announced mishap starts, or until the one under way ends. */
export function mishapDaysLeft(s: GameState): number {
  const m = s.mishap;
  if (!m) return 0;
  return Math.max(0, (m.started ? m.ends : m.starts) - s.day);
}

/** Prepare for the mishap coming, at its price. False if there is none coming, it has started, or it cannot be paid. */
export function prepareMishap(ctx: SimContext): boolean {
  const s = ctx.s;
  const m = s.mishap;
  if (!m || m.started || m.prepared) return false;
  const def = MISHAPS[m.kind];
  if (s.money < def.prepare.cost) {
    toast(
      ctx,
      `Preparing for the ${def.name.toLowerCase()} costs ${money(def.prepare.cost)}. You can't afford it.`,
      'bad',
    );
    emit(ctx, { type: 'sfx', name: 'error' });
    return false;
  }
  spend(ctx, def.prepare.cost, 'building');
  m.prepared = true;
  toast(ctx, `${def.icon} Prepared for the ${def.name.toLowerCase()}. ${def.prepare.effect}`, 'good');
  emit(ctx, { type: 'sfx', name: 'cash' });
  return true;
}

/** Announce a mishap coming. */
function announceMishap(ctx: SimContext, kind: MishapId) {
  const def = MISHAPS[kind];
  ctx.s.mishap = newMishap(ctx.s.day, kind);
  emit(ctx, { type: 'announce', text: def.warning });
  toast(
    ctx,
    `${def.icon} ${def.name} in ${MISHAP_NOTICE_DAYS} days. ${def.harm} ${def.prepare.label} for ${money(def.prepare.cost)}?`,
    'bad',
  );
  tipOnce(
    ctx,
    'mishaps',
    'A mishap is coming. Prepare for it from its notice at the top of the screen, or take your chances.',
  );
}

/** Start a mishap: announce it, and, unprepared, do its harm. */
function startMishap(ctx: SimContext, m: Mishap) {
  const s = ctx.s;
  const def = MISHAPS[m.kind];
  m.started = true;
  emit(ctx, { type: 'announce', text: def.start });
  emit(ctx, { type: 'sfx', name: 'error' });
  if (m.prepared) return;
  // the wind breaks a few things as it starts
  const breakable = s.items.filter((it) => ITEMS[it.type].wear && it.wear < 100);
  for (let i = 0; i < (def.breaks ?? 0) && breakable.length; i++) {
    const it = pick(breakable);
    it.wear = 100;
    breakable.splice(breakable.indexOf(it), 1);
  }
  if (def.breaks)
    toast(ctx, `${def.icon} The ${def.name.toLowerCase()} has broken some equipment. A Caretaker can mend it.`, 'bad');
}

/** End the mishap under way, and set when the next may come. */
function endMishap(ctx: SimContext) {
  const s = ctx.s;
  const m = s.mishap;
  if (!m) return;
  emit(ctx, { type: 'announce', text: MISHAPS[m.kind].end });
  s.mishap = null;
  s.nextMishap = s.day + irnd(MISHAP_GAP_DAYS[0], MISHAP_GAP_DAYS[1]);
}

/** Announce a mishap when one is due, start it on its day, and end it when it is over. */
export function updateMishaps(ctx: SimContext) {
  const s = ctx.s;
  const m = s.mishap;
  if (m) {
    if (!m.started && s.day >= m.starts) startMishap(ctx, m);
    else if (m.started && s.day >= m.ends) endMishap(ctx);
    return;
  }
  if (!s.mishapsOn || !s.open || !centerOf(s).mishap || s.day < s.nextMishap) return;
  const kind = chooseMishap(s);
  // out of season, look again in a few days
  if (kind) announceMishap(ctx, kind);
  else s.nextMishap = s.day + MISHAP_RETRY_DAYS;
}
