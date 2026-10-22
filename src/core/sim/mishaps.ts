// Mishaps: now and then the center has one coming, announced a few days ahead. It can be prepared for at a price; if
// not, it does its harm as it starts. While it lasts, some items are out of action, or fewer guests come.

import {
  centerOf,
  FLOOD_PUDDLES,
  holdingOff,
  ITEMS,
  MISHAP_GAP_DAYS,
  MISHAP_NOTICE_DAYS,
  MISHAP_RETRY_DAYS,
  type MishapDef,
  type MishapId,
  MISHAPS,
  traitSpeed,
  WARD_CHANCE,
  WARD_SECONDS,
  WEAR_REPAIR,
} from '../data';
import { tuning } from '../difficulty';
import { money } from '../format';
import { irnd, pick, random } from '../random';
import type { GameState, Mishap, Room, Staff } from '../state/types';
import { say } from './chars';
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

/** The item here keeping the mishap coming or under way at bay, such as a generator through a power cut, if one is. */
export const mishapHolder = (s: GameState) => (s.mishap ? holdingOff(MISHAPS[s.mishap.kind], s.items) : undefined);

/** Whether the mishap coming or under way is taken care of: prepared for, or kept at bay by something here. */
export const mishapCovered = (s: GameState) => !!s.mishap && (s.mishap.prepared || !!mishapHolder(s));

/** The mishap under way, if it has taken anything out of action as things stand. */
export function mishapStopping(s: GameState): MishapDef | undefined {
  const def = mishapOn(s);
  if (!def?.stops || mishapCovered(s)) return undefined;
  // with nothing here of the kinds it stops, such as a storm with no Aura Wash to shut, it has stopped nothing
  if (!s.items.some((it) => def.stops?.includes(it.type))) return undefined;
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
  return `The ${def.name.toLowerCase()} has put ${def.stopsWhat ?? 'some things'} out of action. It will be over in ${daysInWords(mishapDaysLeft(s))}.`;
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
  toast(ctx, `Prepared for the ${def.name.toLowerCase()}. ${def.prepare.effect}`, 'good', undefined, def.icon);
  emit(ctx, { type: 'sfx', name: 'cash' });
  return true;
}

/** Announce a mishap coming. */
function announceMishap(ctx: SimContext, kind: MishapId) {
  const def = MISHAPS[kind];
  ctx.s.mishap = newMishap(ctx.s.day, kind);
  emit(ctx, { type: 'announce', text: def.warning });
  const holder = mishapHolder(ctx.s);
  if (holder) {
    // one of the center's own will see it off, if it holds out
    const name = ITEMS[holder.type].name;
    const worn = holder.wear >= WEAR_REPAIR ? ` It is worn, so have a Caretaker see to it before then.` : '';
    toast(
      ctx,
      `${def.name} in ${MISHAP_NOTICE_DAYS} days. Your ${name} will see you through.${worn}`,
      worn ? 'bad' : 'info',
      { kind: 'item', id: holder.id },
      def.icon,
    );
  } else
    toast(
      ctx,
      `${def.name} in ${MISHAP_NOTICE_DAYS} days. ${def.harm} ${def.prepare.label} for ${money(def.prepare.cost)}?`,
      'bad',
      undefined,
      def.icon,
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
  // a Shaman's ward holds, most of the time, as well as preparing would
  if (!m.prepared && m.ward === 'done') {
    m.prepared = random(s) < WARD_CHANCE;
    toast(
      ctx,
      m.prepared
        ? `The ward held. ${def.prepare.effect}`
        : `The ward did not hold against the ${def.name.toLowerCase()}.`,
      m.prepared ? 'good' : 'bad',
      undefined,
      'discipline-shaman',
    );
  } else if (!m.prepared && m.ward === 'asked')
    toast(ctx, 'The Shaman did not get to the ward in time.', 'bad', undefined, 'discipline-shaman');
  if (m.prepared) return;
  const holder = mishapHolder(s);
  if (holder) {
    toast(ctx, `The ${ITEMS[holder.type].name} has kicked in.`, 'good', { kind: 'item', id: holder.id }, def.icon);
    return;
  }
  // the wind breaks a few things as it starts
  const breakable = s.items.filter((it) => ITEMS[it.type].wear && it.wear < 100);
  for (let i = 0; i < (def.breaks ?? 0) && breakable.length; i++) {
    const it = pick(s, breakable);
    it.wear = 100;
    breakable.splice(breakable.indexOf(it), 1);
  }
  if (def.breaks)
    toast(
      ctx,
      `The ${def.name.toLowerCase()} has broken some equipment. A Caretaker can mend it.`,
      'bad',
      undefined,
      def.icon,
    );
  if (def.floods) floodRestroom(ctx, def);
}

/**
 * The tiles of a room's floor a flood leaves puddles on: spread across the open floor, up to `FLOOD_PUDDLES` of them,
 * where nothing stands and nothing lies already.
 */
export function floodTiles(ctx: SimContext, room: Room): [number, number][] {
  const open: [number, number][] = [];
  for (let y = room.y; y < room.y + room.h; y++)
    for (let x = room.x; x < room.x + room.w; x++)
      if (
        ctx.world.roomAt(x, y) === room &&
        ctx.world.walkable(x, y) &&
        !ctx.s.litter.some((l) => l.x === x && l.y === y)
      )
        open.push([x, y]);
  const n = Math.min(FLOOD_PUDDLES, open.length);
  return Array.from({ length: n }, (_, i) => open[Math.floor(((i + 0.5) * open.length) / n)] ?? [room.x, room.y]);
}

/** Flood one of the finished restrooms, not flooded already: out of action until a Caretaker has mopped it out. */
export function floodRestroom(ctx: SimContext, def: MishapDef): Room | undefined {
  const s = ctx.s;
  const dry = s.rooms.filter((r) => r.type === 'restroom' && r.done && !ctx.world.flooded(r));
  if (!dry.length) return undefined;
  const room = pick(s, dry);
  for (const [x, y] of floodTiles(ctx, room)) s.litter.push({ id: s.nextId++, x, y, claimedBy: 0, flood: room.id });
  // a restroom with no floor to flood stays dry
  if (!ctx.world.flooded(room)) return undefined;
  toast(
    ctx,
    `The ${def.name.toLowerCase()} has flooded a restroom. It is out of action until a Caretaker mops it out.`,
    'bad',
    { kind: 'room', id: room.id },
    def.icon,
  );
  return room;
}

/** The advisor's line while a restroom is flooded: who will mop it out, or who to hire to. */
export function floodAdvice(ctx: SimContext): string {
  const s = ctx.s;
  if (!s.rooms.some((r) => ctx.world.flooded(r))) return '';
  return s.staff.some((st) => st.role === 'caretaker')
    ? 'A restroom is flooded and out of action until a Caretaker mops it out.'
    : 'A restroom is flooded and out of action. Hire a Caretaker to mop it out.';
}

/** End the mishap under way, and set when the next may come. */
function endMishap(ctx: SimContext) {
  const s = ctx.s;
  const m = s.mishap;
  if (!m) return;
  const def = MISHAPS[m.kind];
  emit(ctx, { type: 'announce', text: def.end });
  s.mishap = null;
  // something in the center that draws it brings the next one sooner
  const drawn = def.drawnBy && s.items.some((it) => it.type === def.drawnBy?.item) ? def.drawnBy.gap : 1;
  s.nextMishap = s.day + irnd(s, MISHAP_GAP_DAYS[0], MISHAP_GAP_DAYS[1]) * tuning(s, 'trouble') * drawn;
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

/** Whether a Shaman is on the payroll and here to perform a ward. */
const shamanHere = (s: GameState) =>
  s.staff.some((st) => st.role === 'shaman' && st.state !== 'leaving' && st.state !== 'away');

/** Whether a Shaman can be asked to ward off the mishap coming: one is coming, not yet prepared for or warded, and a Shaman is here. */
export function canWard(s: GameState): boolean {
  const m = s.mishap;
  return !!m && !m.started && !m.prepared && !m.ward && shamanHere(s);
}

/** Ask a Shaman to ward off the mishap coming. It costs nothing but their time. False if they cannot. */
export function askWard(ctx: SimContext): boolean {
  if (!canWard(ctx.s) || !ctx.s.mishap) return false;
  ctx.s.mishap.ward = 'asked';
  toast(
    ctx,
    'A Shaman will ward off the mishap when they are free. Most wards hold.',
    'info',
    undefined,
    'discipline-shaman',
  );
  return true;
}

/** Whether this member of staff should go and perform the ward asked for: a Shaman, and nobody else on it already. */
export function wardWanted(ctx: SimContext, st: Staff): boolean {
  const m = ctx.s.mishap;
  if (st.role !== 'shaman' || m?.ward !== 'asked' || m.started) return false;
  return !ctx.s.staff.some((o) => o.job?.kind === 'ward');
}

/** Perform the ward where they stand. */
export function startWard(st: Staff) {
  st.job = { kind: 'ward', id: 0 };
  st.state = 'doingJob';
  st.busy = true;
  st.timer = WARD_SECONDS / traitSpeed(st.traits);
  say(st, 'bubble-feather', 3);
}

/** A ward goes on for a step. True when it is over: done, or no longer needed. */
export function wardStep(ctx: SimContext, st: Staff, dt: number): boolean {
  const m = ctx.s.mishap;
  if (m?.ward !== 'asked' || m.started) return true;
  st.timer -= dt;
  if (st.timer > 0) return false;
  m.ward = 'done';
  const def = MISHAPS[m.kind];
  toast(
    ctx,
    `${st.name} has warded off the ${def.name.toLowerCase()}. It should hold.`,
    'good',
    undefined,
    'discipline-shaman',
  );
  emit(ctx, { type: 'float', text: 'Warded', x: st.x, y: st.y, kind: 'good' });
  return true;
}
