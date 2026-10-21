// How the Money menu tells the player what a price will cost them in guests, before it does.

import { PRICE_MAX } from '../../core/data';
import { putOffChance } from '../../core/sim/economy';
import { percent } from './chance';

/** How far above a price the menu looks, to show where the curve goes next. */
const AHEAD = 0.2;

/** A price against standard as the menu writes it. */
const level = (price: number) => `${Math.round(price * 100)}%`;

/** Whether a chance rounds to no one at all. */
const none = (chance: number) => chance < 0.005;

/**
 * What a price will cost in guests at this reputation, and two tenths dearer: "About 10% of guests balk at this
 * price; 20% at 160% of standard." At the top price there is no dearer one to look at.
 */
export function balkText(price: number, reputation: number): string {
  const now = putOffChance(price, reputation);
  const here = none(now) ? 'No guest balks at this price' : `About ${percent(now)} of guests balk at this price`;
  const next = Math.min(PRICE_MAX, Math.round((price + AHEAD) * 10) / 10);
  if (next <= price + 1e-6) return `${here}.`;
  const then = putOffChance(next, reputation);
  return `${here}; ${none(then) ? 'none' : percent(then)} at ${level(next)} of standard.`;
}

/** The share that balks at a technique's price, short enough to sit on its row: "10% balk", or "" when none does. */
export function balkShort(price: number, reputation: number): string {
  const chance = putOffChance(price, reputation);
  return none(chance) ? '' : `${percent(chance)} balk`;
}
