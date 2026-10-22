// The Fortune Teller and the Kombucha Tap: a fortune told to a guest who plays, now and then a lucky one, and a tap
// that fizzes over into a sticky puddle once it is worn, which slows anyone crossing it until a Caretaker mops it up,
// as the water in a flooded restroom does.

import { FIZZ_CHANCE, FIZZ_WEAR, LUCKY_FORTUNE, PUDDLE_SLOW } from '../data';
import { random } from '../random';
import type { Guest, Item } from '../state/types';
import { accessTile } from '../world';
import { say } from './chars';
import type { SimContext } from './context';
import { tipOnce } from './events';
import { feel } from './feelings';

/** Tell a guest their fortune: now and then that they will be healed today, which leaves them fully patient. */
export function tellFortune(ctx: SimContext, g: Guest) {
  feel(g, 'fortune');
  if (random(ctx.s) >= LUCKY_FORTUNE) return;
  feel(g, 'lucky');
  g.patience = 100;
  say(g, 'bubble-lucky', 3);
}

/** A worn Kombucha Tap may fizz over as it is used, leaving a puddle where the guest stood. */
export function fizzOver(ctx: SimContext, tap: Item) {
  if (tap.wear < FIZZ_WEAR || random(ctx.s) >= FIZZ_CHANCE) return;
  const [x, y] = accessTile(tap, 0);
  if (ctx.s.litter.some((l) => l.x === x && l.y === y)) return;
  ctx.s.litter.push({ id: ctx.s.nextId++, x, y, claimedBy: 0, puddle: true });
  tipOnce(
    ctx,
    'puddle',
    'The Kombucha Tap has fizzed over. Guests crossing the puddle slow down and are not pleased about it, until a Caretaker mops it up. A tap kept in good repair fizzes less.',
    'bad',
    { kind: 'item', id: tap.id },
  );
}

/** The puddle on a tile, if any: kombucha, or the water in a flooded restroom. */
export const puddleAt = (ctx: SimContext, x: number, y: number) =>
  ctx.s.litter.find((l) => (!!l.puddle || !!l.flood) && l.x === x && l.y === y);

/** Whether someone is standing in a puddle. */
export const inPuddle = (ctx: SimContext, x: number, y: number) => !!puddleAt(ctx, x, y);

/** How fast a guest walks where they are: slowly through a puddle or flood water, which they notice. */
export function puddleSlow(ctx: SimContext, g: Guest): number {
  const wet = g.path ? puddleAt(ctx, g.tx, g.ty) : undefined;
  if (!wet) return 1;
  const feeling = wet.flood ? 'wet-feet' : 'puddle';
  if (!g.feelings.includes(feeling)) {
    feel(g, feeling);
    say(g, 'bubble-sweaty');
  }
  return PUDDLE_SLOW;
}
