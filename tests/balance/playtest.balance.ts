// Plays every campaign center with the playtest bot and reports the pace: when it opened, when each star came, and
// the money, reputation, guests and waits month by month. Not a pass/fail test: run `yarn balance` before and after
// a tuning change and compare. The full logs go to test-results/balance.json. `BOT=old` plays as the bot did before
// it learned prices, marketing, payroll, saving, expansion on profit, house calls, lines, the Posture Lab, upgrades,
// emergencies it can see through, room layout, mats, classes and courses; `BOT_OFF=prices,calls` switches single ones
// off, and `BOT_ON` switches on the extras (see `BOT_FLAGS` and `BOT_EXTRAS` in bot.ts). `BOT=baseline` plays as a
// thoughtless new player: the opening build, a room only once a line has formed, never a price changed or a call
// taken (see `BotMode`). `BOT=advised` plays as the baseline and also does exactly what the game's toasts and advisor
// say, so whether the warnings are actionable can be measured.
//
// Each center and seed is a run of its own, and the runs are spread over worker slots (`BALANCE_SLOTS`, by default one
// fewer than the processor's cores; see vitest.balance.config.ts), each writing its log to test-results/balance-parts
// for tests/balance/merge.ts to put together in order. The default run (five centers, three seeds, four years) took
// 488 seconds on one thread and takes 137 seconds over 15 slots, on the 16-core Mac it was measured on (21 October 2026).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { it } from 'vitest';

import { CAMPAIGN, type CenterId, DAYS_PER_MONTH } from '../../src/core/data';
import { Bot } from './bot';
import { PARTS } from './merge';

/** How long each center is played, in in-game days: four years. */
const DAYS = Number(process.env.BALANCE_DAYS ?? 360 * 4);
/** Seeds per center, so one lucky run does not mislead. */
const SEEDS = (process.env.BALANCE_SEEDS ?? '1,2,3').split(',').map(Number);
const CENTERS = (process.env.BALANCE_CENTERS?.split(',') ?? CAMPAIGN) as CenterId[];
/** This worker's slot, and how many there are: the slot plays every `SLOTS`-th run, starting with its own number. */
const SLOT = Number(process.env.BALANCE_SLOT ?? 0);
const SLOTS = Number(process.env.BALANCE_SLOTS ?? 1);

/** Every run asked for, center by center and seed by seed, numbered in that order. */
const RUNS = CENTERS.flatMap((center) => SEEDS.map((seed) => ({ center, seed })))
  .map((run, index) => ({ ...run, index }))
  .filter((run) => run.index % SLOTS === SLOT);

/** A day as months into the game, for the summary line. */
const months = (day: number | null) => (day === null ? '  -  ' : (day / DAYS_PER_MONTH).toFixed(1).padStart(5));

for (const { center, seed, index } of RUNS) {
  it(`plays ${center} seed ${seed}`, () => {
    const bot = new Bot(center, seed);
    bot.play(DAYS);
    const l = bot.log;
    process.stdout.write(
      `${center.padEnd(10)} seed ${seed}: opened day ${l.openedDay}, stars at months ${l.starDays.map(months).join(' ')}` +
        `  lowest $${Math.round(l.lowestMoney)} peak loan $${l.peakLoan}  open: ${l.openGoals.join('; ')}\n`,
    );
    mkdirSync(PARTS, { recursive: true });
    writeFileSync(join(PARTS, `${index}.json`), JSON.stringify(l));
  });
}
// a slot with no run left over still needs a test, or vitest calls the file a failure
if (RUNS.length === 0) it.skip('has no run in this slot');
