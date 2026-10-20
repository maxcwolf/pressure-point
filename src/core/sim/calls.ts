// House calls: now and then someone asks for a practitioner to come to them for a day or more. Whoever goes is away
// from the center until they are back, and the fee, more for a higher rank, is paid when they are.

import {
  CALL_CLIENTS,
  CALL_GAP_MAX,
  CALL_GAP_MIN,
  CALL_OFFER_DAYS,
  CALL_PER_DAY,
  CALL_RANK_BONUS,
  centerOf,
  type Discipline,
  DISCIPLINE_ORDER,
  DISCIPLINES,
  MODALITIES,
  MODALITY_ORDER,
  ROLES,
} from '../data';
import { tuning } from '../difficulty';
import { money } from '../format';
import { irnd, pick, random } from '../random';
import type { GameState, HouseCall, Staff } from '../state/types';
import { gainXp } from './careers';
import { lobbyTile, say, staffById, streetTile } from './chars';
import type { SimContext } from './context';
import { earn, priceFor } from './economy';
import { emit, tipOnce, toast } from './events';
import { goTo, halt } from './movement';
import { staffIdle } from './staffing';
import { offered, unlocked } from './treatments';

/** Experience from a house call. */
export const CALL_XP = 3;

/**
 * What a house call pays if this member of staff goes: more for each rank above the first, and at the center's prices,
 * the overall level and, for a call that asks for a technique, that technique's own.
 */
export function callFee(s: GameState, call: HouseCall, st: Staff): number {
  const prices = call.modality ? priceFor(s, call.modality) : s.priceLevel;
  return Math.round(call.perDay * call.days * (1 + CALL_RANK_BONUS * (st.skill - 1)) * prices);
}

/** Whether this member of staff could go on a house call: in its discipline, trained in what it asks, and free. */
export function canGo(st: Staff, call: HouseCall): boolean {
  if (ROLES[st.role].discipline !== call.discipline) return false;
  if (call.modality && !st.quals.includes(call.modality)) return false;
  return !['leaving', 'arriving', 'training', 'toTrain', 'toCall', 'away'].includes(st.state);
}

/** Who could go on the house call on offer. */
export function whoCanGo(ctx: SimContext, call: HouseCall): Staff[] {
  return ctx.s.staff.filter((st) => canGo(st, call));
}

/** A house call for a discipline the center offers and has someone in, sometimes asking for one technique. */
export function makeCall(ctx: SimContext): HouseCall | null {
  const s = ctx.s;
  const disciplines = DISCIPLINE_ORDER.filter(
    (d): d is Discipline =>
      offered(ctx, d) && s.staff.some((st) => ROLES[st.role].discipline === d && st.state !== 'leaving'),
  );
  if (!disciplines.length) return null;
  const discipline = pick(s, disciplines);
  const techniques = MODALITY_ORDER.filter((m) => MODALITIES[m].discipline === discipline && unlocked(ctx, m));
  const asks = techniques.length > 1 && random(s) < 0.5 ? pick(s, techniques) : undefined;
  const clients = [...CALL_CLIENTS, ...(centerOf(s).calls?.clients ?? [])];
  return {
    client: pick(s, clients),
    days: irnd(s, 1, 3),
    perDay: CALL_PER_DAY,
    discipline,
    ...(asks && { modality: asks }),
    deadline: s.day + CALL_OFFER_DAYS,
  };
}

/** The words for who a house call wants: a role, and the technique if it asks for one. */
export function callWants(call: HouseCall): string {
  const role = ROLES[DISCIPLINES[call.discipline].role].name;
  return call.modality ? `${role} trained in ${MODALITIES[call.modality].name}` : role;
}

/** Send someone on the house call on offer. False if they cannot go. */
export function acceptCall(ctx: SimContext, staffId: number): boolean {
  const s = ctx.s;
  const call = s.callOffer;
  const st = staffById(ctx, staffId);
  if (!call || !st || !canGo(st, call)) {
    emit(ctx, { type: 'sfx', name: 'error' });
    return false;
  }
  staffIdle(ctx, st);
  const [x, y] = streetTile(s, ctx.world.building, ctx.world.w);
  if (!goTo(ctx, st, x, y)) {
    emit(ctx, { type: 'sfx', name: 'error' });
    return false;
  }
  st.call = { client: call.client, days: call.days, back: s.day + call.days, fee: callFee(s, call, st) };
  st.state = 'toCall';
  say(st, '🧳', 3);
  s.callOffer = null;
  toast(ctx, `${st.name} is off to ${call.client} for ${call.days} day${call.days === 1 ? '' : 's'}.`, 'info', {
    kind: 'staff',
    id: st.id,
  });
  return true;
}

/** Turn the house call on offer down. */
export function declineCall(ctx: SimContext) {
  ctx.s.callOffer = null;
}

/** Someone on their way to a house call is out of the door: the days away count from now. */
export function leaveForCall(ctx: SimContext, st: Staff) {
  halt(st);
  st.state = 'away';
  if (st.call) st.call.back = ctx.s.day + st.call.days;
}

/** Bring someone back from a house call: in from the street, a little tired, paid, and the wiser for it. */
export function returnFromCall(ctx: SimContext, st: Staff) {
  const call = st.call;
  if (!call) return;
  const [x, y] = streetTile(ctx.s, ctx.world.building, ctx.world.w);
  st.x = x + 0.5;
  st.y = y + 0.5;
  st.tx = x;
  st.ty = y;
  st.state = 'arriving';
  st.energy = Math.max(0, st.energy - 25);
  gainXp(ctx, st, CALL_XP);
  const [lx, ly] = lobbyTile(ctx.s, ctx.world.building);
  // and if the lobby cannot be reached from the street, they are simply there
  if (!goTo(ctx, st, lx, ly)) {
    st.x = lx + 0.5;
    st.y = ly + 0.5;
    st.tx = lx;
    st.ty = ly;
    st.state = 'idle';
  }
  earn(ctx, call.fee, 'calls', x, y);
  toast(ctx, `${st.name} is back from ${call.client}: ${money(call.fee)} for the house call.`, 'good', {
    kind: 'staff',
    id: st.id,
  });
  st.call = null;
}

/** Offer a house call when one is due, and let an offer lapse when its time is up. */
export function updateCalls(ctx: SimContext) {
  const s = ctx.s;
  if (s.callOffer && s.day >= s.callOffer.deadline) {
    toast(ctx, `${s.callOffer.client} found someone else for their house call.`, 'info');
    s.callOffer = null;
  }
  if (s.callOffer || !s.open || s.day < s.nextCall) return;
  const often = centerOf(s).calls?.often ?? 1;
  s.nextCall = s.day + (irnd(s, CALL_GAP_MIN, CALL_GAP_MAX) / often) * tuning(s, 'chances');
  const call = makeCall(ctx);
  if (!call) return;
  s.callOffer = call;
  emit(ctx, { type: 'sfx', name: 'announce' });
  tipOnce(
    ctx,
    'house-call',
    'A house call sends someone out for a day or more, for a fee that rises with their rank and with your prices. Their station stands empty while they are away.',
  );
}
