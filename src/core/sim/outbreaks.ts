// Stress outbreaks: offered like an emergency. Once taken on, stress spreads between guests waiting close together,
// and the player has a few calming sessions to hand out to the carriers, spotted by their sweating and fidgeting,
// before too many of them leave still stressed.

import {
  OFFER_DAYS,
  OUTBREAK_CAUSES,
  OUTBREAK_DAYS,
  OUTBREAK_GAP_MAX,
  OUTBREAK_GAP_MIN,
  OUTBREAK_STARS,
  SPARE_CALMS,
  SPREAD_CHANCE,
  SPREAD_RANGE,
} from '../data';
import { money } from '../format';
import { irnd, pick, random, rnd } from '../random';
import type { Guest, Outbreak } from '../state/types';
import { guestById, say } from './chars';
import type { SimContext } from './context';
import { changeRep } from './economy';
import { emit, toast } from './events';
import { feel } from './feelings';
import { cutOff } from './twists';

/** Whether a guest is waiting about, where stress can pass between them and the guests around them. */
const idle = (g: Guest) => g.state === 'waiting' || g.state === 'toWait' || g.state === 'need' || g.state === 'toNeed';

/** Whether a guest can still catch stress: here for treatment, and neither stressed nor calmed yet. */
const catchable = (g: Guest) => !g.outcome && g.goal !== 'leave' && !g.stressed && !g.calmed;

/** Run the outbreak in progress, or offer a new one when it is time. */
export function updateOutbreak(ctx: SimContext) {
  const s = ctx.s;
  if (s.outbreakOffer && s.day >= s.outbreakOffer.deadline) declineOutbreak(ctx);
  const o = s.outbreak;
  if (o) {
    spreadStress(ctx);
    for (const g of s.guests)
      if (g.stressed && g.state !== 'leaving' && g.bubbleT <= 0 && random() < 0.25) say(g, '😰', 1.5);
    const carriers = s.guests.some((g) => g.stressed);
    if (s.day >= o.deadline || (o.pending === 0 && !carriers)) endOutbreak(ctx);
  } else if (
    s.outbreaksOn &&
    !s.outbreakOffer &&
    !s.offer &&
    !s.emergency &&
    s.open &&
    s.stars >= OUTBREAK_STARS &&
    s.day >= s.nextOutbreak &&
    !cutOff(ctx)
  )
    offerOutbreak(ctx);
}

/** Put a stress outbreak on the table: the more stars, the more it starts with and the more it pays. */
export function offerOutbreak(ctx: SimContext): boolean {
  const s = ctx.s;
  if (s.outbreakOffer || s.outbreak) return false;
  const seed = irnd(2, 3 + Math.floor(s.stars / 2));
  s.outbreakOffer = {
    cause: pick(OUTBREAK_CAUSES),
    seed,
    calms: seed + SPARE_CALMS,
    lost: 0,
    lostMax: 2 + Math.floor(s.stars / 2),
    reward: 2000 + s.stars * 1000,
    pending: 0,
    deadline: s.day + OFFER_DAYS,
  };
  emit(ctx, { type: 'announce', text: `Stress outbreak! ${s.outbreakOffer.cause}` });
  return true;
}

/** Take the outbreak on: its first carriers are among the guests here, and the rest among the next to arrive. */
export function acceptOutbreak(ctx: SimContext) {
  const s = ctx.s;
  const o = s.outbreakOffer;
  if (!o) return;
  s.outbreakOffer = null;
  o.deadline = s.day + OUTBREAK_DAYS;
  const here = s.guests.filter(catchable);
  let left = o.seed;
  while (left > 0 && here.length) {
    const g = here.splice(Math.floor(random() * here.length), 1)[0];
    if (g) g.stressed = true;
    left--;
  }
  o.pending = left;
  s.outbreak = o;
  emit(ctx, { type: 'sfx', name: 'place' });
}

/** Turn the outbreak down, and schedule the next. */
export function declineOutbreak(ctx: SimContext) {
  ctx.s.outbreakOffer = null;
  ctx.s.nextOutbreak = ctx.s.day + rnd(OUTBREAK_GAP_MIN, OUTBREAK_GAP_MAX);
}

/** A newly arrived guest might bring the outbreak in with them, while it still has carriers to come. */
export function arriveCarrying(ctx: SimContext, g: Guest) {
  const o = ctx.s.outbreak;
  if (!o || o.pending <= 0) return;
  o.pending--;
  g.stressed = true;
}

/** Once a second, stress passes between guests waiting close together. */
export function spreadStress(ctx: SimContext) {
  const guests = ctx.s.guests;
  const carriers = guests.filter((g) => g.stressed && idle(g));
  for (const c of carriers) {
    for (const g of guests) {
      if (!catchable(g) || !idle(g) || Math.hypot(g.x - c.x, g.y - c.y) > SPREAD_RANGE) continue;
      if (random() < SPREAD_CHANCE) g.stressed = true;
    }
  }
}

/** What came of a calming session: a carrier calmed, one wasted on a guest who was fine, or none given. */
export type CalmResult = 'calmed' | 'wasted' | '';

/** Give a guest one of the outbreak's calming sessions. */
export function calm(ctx: SimContext, guestId: number): CalmResult {
  const o = ctx.s.outbreak;
  const g = guestById(ctx, guestId);
  if (!o || o.calms <= 0 || !g || g.state === 'leaving' || g.calmed) return '';
  o.calms--;
  g.calmed = true;
  if (!g.stressed) {
    say(g, '🤷', 3);
    emit(ctx, { type: 'float', text: 'They were fine', x: g.x, y: g.y, kind: 'info' });
    emit(ctx, { type: 'sfx', name: 'error' });
    return 'wasted';
  }
  g.stressed = false;
  g.patience = Math.min(100, g.patience + 15);
  feel(g, 'calmed');
  say(g, '😌', 4);
  emit(ctx, { type: 'float', text: 'Calmed', x: g.x, y: g.y, kind: 'good' });
  emit(ctx, { type: 'sfx', name: 'heal' });
  return 'calmed';
}

/** A guest leaving still stressed carries the outbreak out the door with them. */
export function carriedOut(ctx: SimContext, g: Guest) {
  if (!g.stressed) return;
  g.stressed = false;
  if (ctx.s.outbreak) ctx.s.outbreak.lost++;
}

/** Wrap the outbreak up: a reward if few enough carriers left stressed, a knock to reputation if not. */
export function endOutbreak(ctx: SimContext) {
  const s = ctx.s;
  const o = s.outbreak;
  if (!o) return;
  // whoever is still stressed when it ends counts as lost
  for (const g of s.guests) carriedOut(ctx, g);
  if (o.lost <= o.lostMax) {
    s.money += o.reward;
    s.ledger.bonus += o.reward;
    changeRep(ctx, 3);
    toast(ctx, `Stress outbreak contained: only ${o.lost} left still stressed. ${money(o.reward)} bonus.`, 'good');
    emit(ctx, { type: 'sfx', name: 'fanfare' });
  } else {
    changeRep(ctx, -5);
    toast(ctx, `The stress outbreak got away: ${o.lost} guests left still stressed, and they will talk.`, 'bad');
    emit(ctx, { type: 'sfx', name: 'fail' });
  }
  for (const g of s.guests) g.calmed = false;
  s.outbreak = null;
  s.nextOutbreak = s.day + rnd(OUTBREAK_GAP_MIN, OUTBREAK_GAP_MAX);
}

/** Days an outbreak has left, or its offer has left to decide on. */
export const outbreakDaysLeft = (o: Outbreak, day: number) => Math.max(0, o.deadline - day);
