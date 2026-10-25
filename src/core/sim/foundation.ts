// The Pressure Point Foundation: gifts a center can make once it has earned every star, each worth karma.

import { CAMPAIGN, centerOf, FOUNDATION_GIFTS, FOUNDATION_KARMA } from '../data';
import { money } from '../format';
import type { GameState } from '../state/types';
import type { SimContext } from './context';
import { spend } from './economy';
import { emit, toast } from './events';

/** Whether the Foundation takes gifts from this game: a campaign center with every star earned. */
export const foundationOpen = (s: GameState) => CAMPAIGN.includes(s.center) && s.stars >= centerOf(s).goals.length;

/** What the gifts still to make cost, in order, more where guests pay more. */
export const giftsToCome = (s: GameState): number[] =>
  FOUNDATION_GIFTS.slice(s.gifts).map((g) => g * (centerOf(s).picky?.fee ?? 1));

/** What the next gift costs; null once every gift has been made. */
export const nextGift = (s: GameState): number | null => giftsToCome(s)[0] ?? null;

/** Why the next gift cannot be made ('' when it can). */
export function giftBlocker(s: GameState): string {
  if (!foundationOpen(s)) return 'The Foundation takes gifts once every star here is earned.';
  const price = nextGift(s);
  if (price === null) return 'Every gift has been made.';
  if (s.cheated) return 'Cheats were used in this game, so the campaign keeps nothing from it.';
  if (s.money < price) return 'Not enough money.';
  return '';
}

/** Make the next gift to the Foundation. False if it cannot be made. */
export function endow(ctx: SimContext): boolean {
  const s = ctx.s;
  const price = nextGift(s);
  if (price === null || giftBlocker(s)) {
    emit(ctx, { type: 'sfx', name: 'error' });
    return false;
  }
  spend(ctx, price, 'gifts');
  s.gifts++;
  emit(ctx, { type: 'gift', n: s.gifts });
  emit(ctx, { type: 'sfx', name: 'cash' });
  toast(
    ctx,
    `${money(price)} given to the Pressure Point Foundation: +${FOUNDATION_KARMA} karma.`,
    'good',
    undefined,
    'ui-karma',
  );
  return true;
}
