# The balance harness

`yarn balance` has the playtest bot (`tests/balance/bot.ts`) play every campaign center for four years, three seeds each, and writes every game's log to `test-results/balance.json`. `yarn balance:report` turns that log into the tables the [balance log](balance-log.md) uses, plus the fairness checks from [fair-challenge-research.md](fair-challenge-research.md). Neither one passes or fails anything. You run them before and after a change and compare.

## Running it

```bash
yarn balance
```

```bash
yarn balance:report test-results/balance.json
```

Each center and seed is a game of its own, and the games are shared out over worker slots: `tests/balance/playtest.balance.ts` runs once per slot, as its own vitest project (`vitest.balance.config.ts`). Slot _k_ plays games _k_, _k_ + slots, and so on, and writes each log to `test-results/balance-parts/`. When every slot is done, `tests/balance/merge.ts` puts the logs together, center by center and seed by seed, in the same shape as before. Each game prints one summary line as it finishes: stars at month, the lowest bank balance, the peak loan, and the goals still open.

The report runs on plain Node (22.18 or later). `scripts/balance-report.mjs` imports `tests/balance/report.ts` directly, and Node strips the types itself. The report module is pure: it never imports game code, so it can run that way.

## Settings

| Variable          | Default                              | What it does                                                                             |
| ----------------- | ------------------------------------ | ---------------------------------------------------------------------------------------- |
| `BALANCE_CENTERS` | every campaign center                | Comma-separated center ids, e.g. `willow,orchard`                                        |
| `BALANCE_SEEDS`   | `1,2,3`                              | Comma-separated seeds                                                                    |
| `BALANCE_DAYS`    | `1440` (four years)                  | In-game days per game                                                                    |
| `BALANCE_OUT`     | `test-results/balance.json`          | Where the merged log goes                                                                |
| `BALANCE_SLOTS`   | one fewer than the processor's cores | Worker slots (`1` plays every game in one worker, one after another, as before)          |
| `BOT`             | the good bot                         | `baseline` plays a thoughtless new player; `old` plays as the bot did before it learned  |
| `BOT_OFF`         | none                                 | Turns single behaviours of the good bot off, e.g. `prices,calls` (`BOT_FLAGS` in bot.ts) |
| `BOT_ON`          | none                                 | Turns on the extras (`BOT_EXTRAS` in bot.ts)                                             |

`BOT_ON=machines` builds the center's machine room as a station more, on free floor or on land bought for it, and never knocks a room down for it (nor for the Training Room its operator needs). Each game's `machines` records the site (`floor`, `expansion`, or `skipped` when nothing fitted) and the months it was put off.

## What a game's log holds

Beyond the month-by-month figures (`months`), the star days, the open goals and the bot's notes, each log records:

- `firstAdverse` and `adverse`: the first thing to go against the center once it was open, and every such event as it began. These are a twist's blow (a Boardwalk summer, an Exchange rush hour, a snowed-in spell), a stress outbreak, a mishap, a failed inspection, the rival opening, and someone quitting.
- `warnings`: the game's 'bad' toasts, the warnings a player would have seen. Each is cut to its first 60 characters and kept once a day.
- `bankruptDay`: the day the game ended in bankruptcy, or null if it never did.
- `months[].incomeBy`: each month's income by source, from the ledger. The sources are treatments, consultations, classes, house calls, the shop, mushrooms, vending, and bonuses (emergency rewards and prizes).

## Reading the report

**The table**, one row per center, with the seeds side by side:

- _Stars at month_: the month each star came, seed by seed (`1.1/8.9/15.0 · …`). `–` means the star never came, and `bankrupt day N` stands in for the first star a bankrupt game never reached.
- _Profit a month_: income minus spending, averaged from month 13 on (the second year onward). The range is across seeds.
- _Months at a loss_: months that spent more than they took in, out of every month played.
- _Lowest reputation_: the lowest reputation seen in the game, sampled daily.
- _Months below 15%_: months whose lowest daily reputation went under 15.
- _Bank at the end_: the bank balance at the last month written up.
- _Bankruptcies_: each bankrupt seed and the day it went bankrupt.

**Survival, seed by seed**: each game's outcome. For a bankrupt game, the table also shows the first adverse event, the days from it to the end, and the last warning before the end. A game lost with no warning in the 10 days before it is marked ⚠: that is a loss the player could not see coming.

**Reputation cliffs**: months in which reputation fell 20 points or more, measured from the end of the month before to the lowest reading in the month. Each cliff is listed with that month's counts of guests who got worse, stormed out, and failed treatment, as the likely cause. The table counts them per center across seeds.

**Spirals**: of the adverse events of each kind, the share followed by a cliff in that month or the two after it. The last column is the share of all three-month windows (from month 2 on) that contain a cliff, the chance of one anyway. An event whose share is well above that column tips the game into a spiral. One near it does not.

**Side incomes**: the share of income from classes, house calls, the shop, vending and bonuses at months 12, 24 and 48, seed by seed (a game that stops a few ticks short of closing its last month shows the month before).

## A before/after comparison

1. On the code before the change: `BALANCE_OUT=test-results/before.json yarn balance` (and `BOT=baseline BALANCE_OUT=test-results/before-baseline.json yarn balance` if the thoughtless player matters to the change).
2. Make the change, then run `yarn balance` again.
3. `yarn balance:report test-results/balance.json test-results/before.json` prints the table a second time in the "before → after" form of balance-log entry 31. A cell that did not change reads `(unchanged)`. The fairness slices are for the "after" run.
4. Compare seed by seed, not by the means. In the balance-log entry, copy the table and say what the slices show: a new bankruptcy, a cliff that appeared or went away, a loss without warning.

Logs from before the richer fields existed still work as the "before" run. The report reads their bankruptcy from the bot's note and leaves out what they lack.
