// The playtest bot's habits from the owner's own games (balance log 46): a small loan paid back fast (`loan`), the
// center fitted out in its first month (`early`), prices held near 1.1 (`modest`), and every emergency and stress
// outbreak taken on (`brave`).
import { describe, expect, it, vi } from 'vitest';

import { CONDITIONS, ITEMS, LOAN_STEP, MODALITIES, ROOMS } from '../../src/core/data';
import { makeCandidate } from '../../src/core/people';
import { wagesDue } from '../../src/core/sim/economy';
import type { Emergency } from '../../src/core/state/types';
import { Bot, BOT_FLAGS, botFlags } from '../balance/bot';

/** The four flags, as `BOT_OFF` names them. */
const OWNER: readonly string[] = ['loan', 'early', 'modest', 'brave'];

/** The bot's private steps, reached for the tests. */
interface Steps {
  decide(): void;
  afford(cost: number, reserve: number, borrow?: boolean): boolean;
  manageLoan(): void;
  handleEvents(): void;
  setPrices(): void;
  earlyTraining(): void;
  reserve(what: 'decor' | 'comforts'): number;
  wages(): number;
  canSeeThrough(e: Emergency): boolean;
  calmCarriers(): void;
}
/** A bot, with its private steps in reach. */
const steps = (bot: Bot) => bot as unknown as Steps;

/** Willow Lane played by the good bot, with any flags named switched off. */
const willow = (off = '') => new Bot('willow', 1, {}, botFlags({ BOT_OFF: off }));

/** Take on a Massage Therapist, as the opening would. */
function hireTherapist(bot: Bot) {
  bot.s.candidates.push(makeCandidate(bot.s, 'therapist'));
  expect(bot.hire('therapist')).toBe(true);
}

describe('the owner’s flags', () => {
  it('are on for the good bot, all off for the old one, and switched off by name', () => {
    const good = botFlags({});
    for (const f of OWNER) expect(good[f as keyof typeof good], f).toBe(true);
    const old = botFlags({ BOT: 'old' });
    for (const f of BOT_FLAGS) expect(old[f], f).toBe(false);
    const off = botFlags({ BOT_OFF: OWNER.join(',') });
    for (const f of BOT_FLAGS) expect(off[f], f).toBe(OWNER.includes(f) ? false : good[f]);
  });

  it('change the good style’s loan and prices, and leave them as they were without', () => {
    expect(willow().style).toMatchObject({ loanTop: 15000, repay: { k: 1, c: 5000 }, priceTop: 1.1, premiumTop: 1.2 });
    for (const bot of [willow('loan,modest'), new Bot('willow', 1, {}, botFlags({ BOT: 'old' }))])
      expect(bot.style).toMatchObject({ loanTop: Infinity, repay: { k: 1, c: 25000 }, priceTop: 1.4, premiumTop: 1.3 });
  });
});

describe('with `loan`', () => {
  it('asks the bank for no more than 15,000 in all', () => {
    const bot = willow();
    const { s } = bot;
    s.money = 0;
    // a build that would take the loan past three steps is not borrowed for at all
    expect(steps(bot).afford(20000, 0, true)).toBe(false);
    expect(s.loan).toBe(0);
    expect(steps(bot).afford(6000, 0, true)).toBe(true);
    expect(s.loan).toBe(2 * LOAN_STEP);
    s.money = 0;
    expect(steps(bot).afford(6000, 0, true)).toBe(false);
    expect(s.loan).toBe(2 * LOAN_STEP);
    // nor, nearly broke, a step more for the wages: the bank's own loan at payday sees to them
    s.loan = 3 * LOAN_STEP;
    steps(bot).manageLoan();
    expect(s.loan).toBe(3 * LOAN_STEP);
  });

  it('borrowed further without it', () => {
    const bot = willow('loan');
    const { s } = bot;
    s.money = 0;
    expect(steps(bot).afford(20000, 0, true)).toBe(true);
    expect(s.loan).toBeGreaterThan(3 * LOAN_STEP);
    s.money = 0;
    steps(bot).manageLoan();
    expect(s.loan).toBe(6 * LOAN_STEP);
  });

  it('pays a step back once a month’s wages and $5,000 are in hand', () => {
    const bot = willow();
    const { s } = bot;
    hireTherapist(bot);
    const wages = steps(bot).wages();
    expect(wages).toBeGreaterThan(0);
    s.loan = 3 * LOAN_STEP;
    s.money = wages + 4900;
    steps(bot).manageLoan();
    expect(s.loan).toBe(3 * LOAN_STEP);
    s.money = wages + 5100;
    steps(bot).manageLoan();
    expect(s.loan).toBe(2 * LOAN_STEP);
  });

  it('held on to it until $25,000 more than the wages were in hand without it', () => {
    const bot = willow('loan');
    const { s } = bot;
    hireTherapist(bot);
    s.loan = 3 * LOAN_STEP;
    s.money = steps(bot).wages() + 5100;
    steps(bot).manageLoan();
    expect(s.loan).toBe(3 * LOAN_STEP);
  });
});

describe('with `early`', () => {
  it('has a Staff Room standing at Willow Lane before the doors open, and the Massage Suite dressed', () => {
    const bot = willow();
    const without = willow('early');
    steps(bot).decide();
    steps(without).decide();
    expect(bot.s.open).toBe(false);
    expect(bot.sim.hasRoom('staffroom')).toBe(true);
    expect(without.sim.hasRoom('staffroom')).toBe(false);
    /** A bot's Massage Suite. */
    const suite = (b: Bot) => b.s.rooms.find((r) => r.type === 'massage');
    expect(bot.sim.prestige(suite(bot)!)).toBeGreaterThan(without.sim.prestige(suite(without)!));
  });

  it('builds a Training Room as soon as it can be paid for, keeping back only the wages due', () => {
    const bot = willow();
    const { s } = bot;
    steps(bot).decide();
    const cost = ROOMS.training.cost + ITEMS.study_desk.cost;
    s.money = cost + wagesDue(s) - 100;
    steps(bot).earlyTraining();
    expect(bot.sim.hasRoom('training')).toBe(false);
    s.money = cost + wagesDue(s) + 600;
    steps(bot).earlyTraining();
    expect(bot.sim.hasRoom('training')).toBe(true);
  });

  it('has a Training Room at Willow Lane within the first month, where one is open from the start', () => {
    const bot = willow();
    expect(bot.playUntil((b) => b.sim.hasRoom('training'), 30)).toBe(true);
  });

  it('keeps nothing back for decor or comforts until the center has been open a month', () => {
    const bot = willow();
    hireTherapist(bot);
    bot.log.openedDay = 0;
    expect(steps(bot).reserve('decor')).toBe(0);
    expect(steps(bot).reserve('comforts')).toBe(0);
    bot.s.day = 31;
    expect(steps(bot).reserve('decor')).toBe(steps(bot).wages() + 3000);
    expect(steps(willow('early')).reserve('decor')).toBe(3000);
  });
});

describe('with `modest`', () => {
  it('sets prices to 1.1 on the first day open, and never above it', () => {
    const bot = willow();
    const { s } = bot;
    bot.play(2);
    expect(s.open).toBe(true);
    expect(s.priceLevel).toBe(1.1);
    let top = 0;
    bot.playUntil((b) => {
      top = Math.max(top, b.s.priceLevel);
      return false;
    }, 60);
    expect(top).toBe(1.1);
    // a month with few put off and a fine reputation still takes them no higher
    s.reputation = 95;
    steps(bot).setPrices();
    expect(s.priceLevel).toBe(1.1);
    expect(Math.max(...Object.values(s.prices))).toBeLessThanOrEqual(1.2);
  });

  it('left them at 1 to start, and took them higher, without it', () => {
    const bot = willow('modest');
    const { s } = bot;
    bot.play(2);
    expect(s.priceLevel).toBe(1);
    bot.play(40);
    s.priceLevel = 1.1;
    s.reputation = 95;
    steps(bot).setPrices();
    expect(s.priceLevel).toBe(1.2);
  });
});

describe('with `brave`', () => {
  /** An emergency of massage guests, with nobody on the staff to see it through. */
  function offer(bot: Bot): Emergency {
    const cond = CONDITIONS.find(
      (c) => MODALITIES[c.modality].discipline === 'massage' && !MODALITIES[c.modality].machine,
    );
    const e: Emergency = {
      condition: cond!.id,
      cause: 'A coach party',
      total: 8,
      target: 5,
      healed: 0,
      pending: 0,
      reward: 2000,
      deadline: bot.s.day + 5,
    };
    bot.s.offer = e;
    expect(steps(bot).canSeeThrough(e)).toBe(false);
    return e;
  }

  it('takes on an emergency the staff cannot see through, its guests first', () => {
    const bot = willow();
    offer(bot);
    steps(bot).handleEvents();
    expect(bot.s.emergency).not.toBeNull();
    expect(bot.s.policy.emergenciesFirst).toBe(true);
  });

  it('turned it down without', () => {
    const bot = willow('brave');
    offer(bot);
    steps(bot).handleEvents();
    expect(bot.s.offer).toBeNull();
    expect(bot.s.emergency).toBeNull();
  });

  it('takes on a stress outbreak, and calms the guests carrying it', () => {
    const bot = willow();
    expect(bot.sim.offerOutbreak()).toBe(true);
    steps(bot).handleEvents();
    expect(bot.s.outbreak).not.toBeNull();
    const calm = vi.spyOn(steps(bot), 'calmCarriers');
    bot.play(1);
    expect(calm).toHaveBeenCalled();
  });

  it('turned it down, and calmed nobody, without', () => {
    const bot = willow('brave');
    expect(bot.sim.offerOutbreak()).toBe(true);
    steps(bot).handleEvents();
    expect(bot.s.outbreak).toBeNull();
    const calm = vi.spyOn(steps(bot), 'calmCarriers');
    bot.play(1);
    expect(calm).not.toHaveBeenCalled();
  });
});
