// The playtest bot's land: out of space, it buys the cheapest plot for sale, and for a room whose worth it knows, only
// a plot that worth pays back within the months a room is given to pay its way.
import { describe, expect, it } from 'vitest';

import { Bot } from '../balance/bot';

/** Willow Lane with every star earned and money to spare, its floor full of Massage Suites. */
function fullFloor(): Bot {
  const bot = new Bot('willow', 1);
  bot.s.stars = 3;
  bot.s.money = 1e6;
  // a room with no worth buys no land, so this fills the floor and stops
  while (bot.buildRoom('massage', [], [], 0));
  // and it would not look again for a few days
  (bot as unknown as { noFit: Record<string, number> }).noFit = {};
  return bot;
}

/** The plot the bot would buy: the cheapest for sale. */
const cheapest = (bot: Bot) =>
  bot.sim
    .landOffers()
    .filter((o) => o.state === 'open')
    .sort((a, b) => a.price - b.price)[0];

/** Whether builders are at work on a plot. */
const building = (bot: Bot) => bot.sim.landOffers().some((o) => o.state === 'building');

describe('the bot’s land', () => {
  it('is not bought for a room worth less a month than pays the plot back within a year', () => {
    const bot = fullFloor();
    const offer = cheapest(bot);
    expect(offer).toBeDefined();
    expect(bot.buildRoom('massage', [], [], offer!.price / 12 - 1)).toBeNull();
    expect(building(bot)).toBe(false);
  });

  it('is bought for a room worth that much', () => {
    const bot = fullFloor();
    const offer = cheapest(bot);
    expect(bot.buildRoom('massage', [], [], offer!.price / 12)).toBeNull();
    expect(building(bot)).toBe(true);
    expect(bot.log.notes.some((n) => n.includes(`bought ${offer!.name}`))).toBe(true);
  });

  it('is bought, as ever, for a room whose worth it does not know', () => {
    const bot = fullFloor();
    expect(bot.buildRoom('consult')).toBeNull();
    expect(building(bot)).toBe(true);
  });
});
