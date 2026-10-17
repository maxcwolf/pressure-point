// Plays every campaign center with the playtest bot and reports the pace: when it opened, when each star came, and
// the money, reputation, guests and waits month by month. Not a pass/fail test: run `yarn balance` before and after
// a tuning change and compare. The full logs go to test-results/balance.json. `BOT=old` plays as the bot did before
// it learned prices, marketing, payroll, saving, expansion on profit, house calls, lines, the Posture Lab, upgrades,
// emergencies it can see through, room layout, mats, classes and courses; `BOT_OFF=prices,calls` switches single ones
// off, and `BOT_ON` switches on the extras (see `BOT_FLAGS` and `BOT_EXTRAS` in bot.ts).
import { mkdirSync, writeFileSync } from 'node:fs';

import { it } from 'vitest';

import { CAMPAIGN, type CenterId, DAYS_PER_MONTH } from '../../src/core/data';
import { Bot, type Playtest } from './bot';

/** How long each center is played, in in-game days: four years. */
const DAYS = Number(process.env.BALANCE_DAYS ?? 360 * 4);
/** Seeds per center, so one lucky run does not mislead. */
const SEEDS = (process.env.BALANCE_SEEDS ?? '1,2,3').split(',').map(Number);
const CENTERS = (process.env.BALANCE_CENTERS?.split(',') ?? CAMPAIGN) as CenterId[];

/** A day as months into the game, for the summary line. */
const months = (day: number | null) => (day === null ? '  -  ' : (day / DAYS_PER_MONTH).toFixed(1).padStart(5));

it('plays the campaign', () => {
  const all: Playtest[] = [];
  for (const center of CENTERS) {
    for (const seed of SEEDS) {
      const bot = new Bot(center, seed);
      bot.play(DAYS);
      all.push(bot.log);
      const l = bot.log;
      process.stdout.write(
        `${center.padEnd(10)} seed ${seed}: opened day ${l.openedDay}, stars at months ${l.starDays.map(months).join(' ')}` +
          `  lowest $${Math.round(l.lowestMoney)} peak loan $${l.peakLoan}  open: ${l.openGoals.join('; ')}\n`,
      );
    }
  }
  mkdirSync('test-results', { recursive: true });
  writeFileSync(process.env.BALANCE_OUT ?? 'test-results/balance.json', `${JSON.stringify(all, null, 1)}\n`);
});
