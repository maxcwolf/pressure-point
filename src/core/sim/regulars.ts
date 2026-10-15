// Regulars: a guest who enjoyed their visit may come back every few weeks, under their own name and looking the same,
// to be greeted at Reception. The better each visit goes the more loyal they grow, and the more loyal, the more patient
// they are, the sooner they come back and the more they tip; a bad visit or two and they stop coming. Who takes to the
// place, and when they come back, is settled by who they are rather than by the game's random numbers, so a game
// without regulars plays out as it always did.

import {
  conditionOf,
  DEVOTED_AT,
  DEVOTED_TIP,
  LOYAL_AT,
  LOYAL_TIP,
  LOYALTY_BY_STARS,
  type LoyaltyLevel,
  type Modality,
  REGULAR_GAP_DAYS,
  REGULAR_LOYALTY,
  REGULAR_ODDS,
  REGULAR_PATIENCE,
  REGULAR_STARS,
  REGULARS_MAX,
  VISION_LOYALTY,
} from '../data';
import type { GameState, Guest, Regular } from '../state/types';
import { clamp } from '../util';
import type { SimContext } from './context';
import { emit, tipOnce, toast } from './events';

/** The technique whose guests all come back as regulars. */
export const VISION_QUEST: Modality = 'quest';

/** How a regular stands with the center, by their loyalty. */
export function loyaltyLevel(loyalty: number): LoyaltyLevel {
  if (loyalty >= DEVOTED_AT) return 'devoted';
  if (loyalty >= LOYAL_AT) return 'loyal';
  return 'regular';
}

/** Whether a guest who gave their visit these stars takes to the place: one in a few of those who enjoyed it. */
export const takesToPlace = (id: number, stars: number) => stars >= REGULAR_STARS && id % REGULAR_ODDS === 0;

/** How a visit changes a regular's loyalty, by the stars they gave it. */
export const loyaltyChange = (stars: number) => LOYALTY_BY_STARS[clamp(Math.round(stars), 1, 5) - 1] ?? 0;

/** Days until a regular comes back: somewhere in the usual gap, by who they are and how often they have been, and up to
 * half as long again for the most loyal. */
export function returnGap(r: Pick<Regular, 'id' | 'visits' | 'loyalty'>): number {
  const [least, most] = REGULAR_GAP_DAYS;
  const days = least + ((r.id * 7 + r.visits * 13) % (most - least + 1));
  return Math.max(1, Math.round(days * (1 - r.loyalty / 200)));
}

/** The regular a guest is, if they are one. */
export const regularOf = (s: GameState, g: Pick<Guest, 'regular'>) =>
  g.regular ? s.regulars.find((r) => r.id === g.regular) : undefined;

/** Whether a regular is here now, on a visit. */
export const regularHere = (s: GameState, r: Regular) => s.guests.some((g) => g.regular === r.id);

/** The regular due back soonest whose day has come and who is not here already, if any. */
export function dueRegular(s: GameState): Regular | undefined {
  return s.regulars.filter((r) => r.due <= s.day && !regularHere(s, r)).sort((a, b) => a.due - b.due)[0];
}

/** How fast a guest's patience drains against usual: slower the more loyal a regular is. */
export function regularPatience(s: GameState, g: Pick<Guest, 'regular'>): number {
  const r = regularOf(s, g);
  return r ? 1 - (REGULAR_PATIENCE * r.loyalty) / 100 : 1;
}

/** What a regular adds to a treatment's fee as a tip: nothing until they are loyal. */
export function tipFor(s: GameState, g: Pick<Guest, 'regular'>, fee: number): number {
  const r = regularOf(s, g);
  if (!r) return 0;
  const level = loyaltyLevel(r.loyalty);
  if (level === 'regular') return 0;
  return Math.round(fee * (level === 'devoted' ? DEVOTED_TIP : LOYAL_TIP));
}

/** How Reception greets a regular: by their first name. */
export const greeting = (name: string) => `Welcome back, ${name.split(' ')[0] ?? name}!`;

/** A regular is back: they count another visit, and are pleased to be. */
export function welcomeBack(ctx: SimContext, g: Guest, r: Regular) {
  g.regular = r.id;
  r.visits++;
  emit(ctx, { type: 'float', text: '👋 Back again', x: g.x, y: g.y, kind: 'good' });
}

/** Whether a guest's visit was a vision quest that worked. */
const questDone = (g: Guest, healed: boolean) => healed && conditionOf(g.condition).modality === VISION_QUEST;

/**
 * Once a visit is over and reviewed: a regular grows more loyal or less, by the stars they gave it, and is due back in a
 * while, unless that was the last straw. Anyone else who enjoyed it may become a regular, and anyone a vision quest
 * healed does.
 */
export function afterVisit(ctx: SimContext, g: Guest, stars: number, healed: boolean) {
  const s = ctx.s;
  const quest = questDone(g, healed);
  const r = regularOf(s, g);
  if (r) {
    const before = loyaltyLevel(r.loyalty);
    r.loyalty = clamp(r.loyalty + loyaltyChange(stars), 0, 100);
    if (quest) r.loyalty = Math.max(r.loyalty, VISION_LOYALTY);
    if (r.loyalty <= 0) {
      s.regulars = s.regulars.filter((o) => o !== r);
      toast(ctx, `💔 ${r.name} has had enough, and will not be coming back.`, 'bad');
      return;
    }
    r.due = s.day + returnGap(r);
    const after = loyaltyLevel(r.loyalty);
    if (after !== before && after !== 'regular' && (before === 'regular' || after === 'devoted'))
      toast(
        ctx,
        after === 'devoted'
          ? `💛 ${r.name} is devoted to the center now, and tips well.`
          : `💛 ${r.name} has grown loyal: more patient, and they tip.`,
        'good',
      );
    return;
  }
  if (!quest && (!takesToPlace(g.id, stars) || s.regulars.length >= REGULARS_MAX)) return;
  const added: Regular = {
    id: g.id,
    name: g.name,
    look: { ...g.look },
    visits: 1,
    loyalty: quest ? VISION_LOYALTY : REGULAR_LOYALTY,
    due: 0,
  };
  added.due = s.day + returnGap(added);
  s.regulars.push(added);
  emit(ctx, { type: 'float', text: quest ? '🪶 Will be back' : 'Will be back', x: g.x, y: g.y, kind: 'good' });
  tipOnce(
    ctx,
    'regulars',
    `${g.name} enjoyed their visit and will be back as a regular. Look after regulars and they grow loyal: more patient, and they tip. See them all under Stats.`,
    'good',
  );
}
