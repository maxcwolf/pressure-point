// Staff get thirsty and hungry too, faster in the heat. Between jobs they go for a drink or a snack from whatever the
// guests use, an Espresso Machine in the Staff Room sees to their thirst on a break, and a Staff Fridge to their thirst
// and hunger both. Left wanting, they are fed up.

import {
  FRIDGE_REFRESH,
  HEAT_THIRST,
  ITEMS,
  REFRESH_SECONDS,
  STAFF_HUNGER,
  STAFF_NEED_AT,
  STAFF_NEED_HOLD,
  STAFF_NEED_RANGE,
  STAFF_THIRST,
} from '../data';
import type { AccessRole } from '../data/types';
import type { Item, Staff } from '../state/types';
import { accessTile } from '../world';
import type { SimContext } from './context';
import { tipOnce } from './events';
import { goTo } from './movement';
import { hotness, warmthAt } from './warmth';

/** Whether this member of staff is somewhere their needs grow: in the building, not out on a call or going home. */
const present = (st: Staff) => st.state !== 'away' && st.state !== 'toCall' && st.state !== 'leaving';

/** What a Staff Room offers someone on a break there: an espresso, a fridge to help themselves from. */
export interface BreakRoom {
  espresso: boolean;
  fridge: boolean;
}

/**
 * Make staff thirstier and hungrier with time: thirstier in the heat. A drink on a break with an espresso to hand, and
 * a drink and a bite with a fridge.
 */
export function growNeeds(ctx: SimContext, st: Staff, dt: number, room: BreakRoom) {
  if (!present(st)) return;
  const heat = hotness(warmthAt(ctx, st.tx, st.ty));
  st.thirst = Math.min(100, st.thirst + STAFF_THIRST * (1 + heat * HEAT_THIRST) * dt);
  st.hunger = Math.min(100, st.hunger + STAFF_HUNGER * dt);
  if (st.state === 'onBreak' && (room.espresso || room.fridge))
    st.thirst = Math.max(0, st.thirst - FRIDGE_REFRESH * dt);
  if (st.state === 'onBreak' && room.fridge) st.hunger = Math.max(0, st.hunger - FRIDGE_REFRESH * dt);
  if (st.thirst >= 100 || st.hunger >= 100)
    tipOnce(
      ctx,
      'staff-needs',
      'Staff get thirsty and hungry too, and thirstier in the heat. Between jobs they use the same Water Coolers, Tea Stations and Snack Machines as guests. An Espresso Machine in the Staff Room sees to their thirst on a break, and a Staff Fridge to their thirst and hunger.',
      'bad',
      { kind: 'staff', id: st.id },
    );
}

/**
 * What a member of staff wants most, if they want anything enough to go for it: from `STAFF_NEED_AT`, or, with guests
 * waiting in their line, not until `STAFF_NEED_HOLD`.
 */
export function wants(st: Staff, holding = false): 'drink' | 'eat' | null {
  const at = holding ? STAFF_NEED_HOLD : STAFF_NEED_AT;
  if (st.thirst < at && st.hunger < at) return null;
  return st.thirst >= st.hunger ? 'drink' : 'eat';
}

/** Whether someone is fed up with wanting a drink or a snack. */
export const fedUp = (st: Staff) => st.thirst >= 100 || st.hunger >= 100;

/** The nearest working item to see to a want, within reach. */
export function refreshmentFor(ctx: SimContext, st: Staff, want: AccessRole): Item | undefined {
  let best: Item | undefined;
  let bestD = STAFF_NEED_RANGE;
  for (const it of ctx.s.items) {
    if (!ITEMS[it.type].access.some((a) => a.role === want) || !ctx.world.usable(it)) continue;
    const d = Math.hypot(it.x - st.tx, it.y - st.ty);
    if (d < bestD) {
      bestD = d;
      best = it;
    }
  }
  return best;
}

/** Whether someone wants a drink or a snack enough to go for one, and there is one to be had. */
export function wantsRefresh(ctx: SimContext, st: Staff, holding = false): boolean {
  const want = wants(st, holding);
  return !!want && !!refreshmentFor(ctx, st, want);
}

/** Head off for a drink or a snack, if they want one and there is one to be had. True if they set off. */
export function goRefresh(ctx: SimContext, st: Staff): boolean {
  const want = wants(st);
  const it = want && refreshmentFor(ctx, st, want);
  if (!want || !it) return false;
  const idx = ITEMS[it.type].access.findIndex((a) => a.role === want);
  const [x, y] = accessTile(it, idx);
  if (!goTo(ctx, st, x, y)) return false;
  st.job = { kind: 'refresh', id: it.id };
  st.state = 'toJob';
  return true;
}

/** How long a drink or a snack takes. */
export const refreshSeconds = () => REFRESH_SECONDS;

/** Drink or eat up: whichever the item is for. */
export function refreshed(st: Staff, it: Item | undefined) {
  const roles = it ? ITEMS[it.type].access.map((a) => a.role) : [];
  if (roles.includes('drink')) st.thirst = 0;
  if (roles.includes('eat')) st.hunger = 0;
}
