# The balance harness

`yarn balance` has the playtest bot (`tests/balance/bot.ts`) play every campaign center for four years, three seeds each, and writes every game's log to `test-results/balance.json`. `yarn balance:report` turns that log into the tables the [balance log](log.md) uses, plus the fairness checks from [research/fair-challenge.md](../research/fair-challenge.md). Neither one passes or fails anything. You run them before and after a change and compare.

## Running it

```bash
yarn balance
```

```bash
yarn balance:report test-results/balance.json
```

Each center and seed is a game of its own, and the games are shared out over worker slots: `tests/balance/playtest.balance.ts` runs once per slot, as its own vitest project (`vitest.balance.config.ts`). Slot _k_ plays games _k_, _k_ + slots, and so on, and writes each log to `test-results/balance-parts/`. When every slot is done, `tests/balance/merge.ts` puts the logs together, center by center and seed by seed, in the same shape as before. Each game prints one summary line as it finishes: the day it opened, stars at month, the lowest bank balance, the peak loan, and the goals still open, with a line more for each treatment machine built with `BOT_ON=machines`.

The report runs on plain Node (22.18 or later). `scripts/balance-report.mjs` imports `tests/balance/report.ts` directly, and Node strips the types itself. The report module is pure: it never imports game code, so it can run that way.

## Settings

| Variable          | Default                              | What it does                                                                                                                                                 |
| ----------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `BALANCE_CENTERS` | every campaign center                | Comma-separated center ids, e.g. `willow,orchard`                                                                                                            |
| `BALANCE_SEEDS`   | `1,2,3`                              | Comma-separated seeds                                                                                                                                        |
| `BALANCE_DAYS`    | `1440` (four years)                  | In-game days per game                                                                                                                                        |
| `BALANCE_OUT`     | `test-results/balance.json`          | Where the merged log goes                                                                                                                                    |
| `BALANCE_SLOTS`   | one fewer than the processor's cores | Worker slots (`1` plays every game in one worker, one after another, as before)                                                                              |
| `BOT`             | the good bot                         | `baseline` plays a thoughtless new player; `advised` plays the baseline and does as the toasts and advisor say; `old` plays as the bot did before it learned |
| `BOT_OFF`         | none                                 | Turns single behaviours of the good bot off, e.g. `prices,calls` or `loan,early,brave,swap` (`BOT_FLAGS` in bot.ts)                                          |
| `BOT_ON`          | none                                 | Turns on the extras (`BOT_EXTRAS` in bot.ts), or any flag for `BOT=old`, `baseline` or `advised`, which start with none                                      |
| `BOT_STYLE`       | `good`                               | `hoarder` plays cautious and dear, `grower` bold and cheap (`STYLES` in bot.ts)                                                                              |
| `SHARE_DESK`      | none                                 | Any value has a Shop Counter share the desk's receptionist rather than the bot hiring one for it                                                             |

`BOT_ON=machines` builds the center's machine room as a station more, on free floor or on land bought for it, and never knocks a room down for it (nor for the Training Room its operator needs). From the star that opens the machine room until it stands, nothing else the bot builds may take the last spot it could go in: a spot where the room, its door and its machine really fit, tried as a plan and taken down again. Each game's `machines` records the site (`floor`, `expansion`, or `skipped` when nothing fitted) and the months it was put off.

`BOT_ON=opening` has the good bot do as the advisor says about a month's wages in hand: while it says there is less, it hires nobody but into a role with nobody in it, sends nobody on a course and turns house calls down. The advised persona (`BOT=advised`) holds its hires the same way. Both note when the hold begins and ends.

`loan`, `early`, `modest`, `brave` and `swap` are habits taken from the owner's own games (balance-log entries 46 to 48). With `loan`, the bot asks the bank for no more than three steps of the loan ($15,000) in all, the loan the bank forces at a payday aside, and pays a step back whenever a month's wages and $5,000 are in hand. With `early`, it builds a Staff Room before the doors open if the money allows, a Training Room as soon as the game opens one and its cost is in hand with the wages due kept back, and dresses each treatment room the day it is built, keeping nothing back for decor or the corridor's comforts until the center has been open a month. With `modest`, it sets prices to 1.1 on the first day open and takes them no higher, a long line's techniques to 1.2 at most (the bank's countdown still takes them to 1.4). With `brave`, it takes on every emergency and every stress outbreak and calms the outbreak's carriers. With `swap`, once open, it takes on an applicant a rank or more above the weakest member of a role who could go, and then lets that member go, keeping the headcount, at most once a month a role: not while the bank is calling the overdraft in or the advisor says to hire nobody, not when the dearer wage would take the month's books into a loss, and never anyone on a course or a call, or with a technique or general course the applicant lacks. `loan`, `early`, `brave` and `swap` are on for the good bot and off for `BOT=old`; `BOT_OFF=loan,early,brave,swap` plays the good bot as it was before them. `modest` is an extra, `BOT_ON=modest`: it cost the bot about $8,000 a month at every center for no star or game gained (entry 48). `loan` and `modest` change only the good style: `BOT_STYLE=hoarder` and `grower` keep their own loans and prices.

`endow` has the good bot give to the Pressure Point Foundation once every star is earned: the next gift whenever it leaves two months' wages and machine upkeep in the bank. It is on for the good bot and off for `BOT=old`; a gift comes only after the last star, so it changes no star month, only the bank from then on. `BOT_OFF=endow` plays the late game as before the Foundation.

## What a game's log holds

Beyond the month-by-month figures (`months`), the star days, the open goals and the bot's notes, each log records:

- `firstAdverse` and `adverse`: the first thing to go against the center once it was open, and every such event as it began. These are a twist's blow (a Boardwalk summer, an Exchange rush hour, a snowed-in spell), a stress outbreak, a mishap, a failed inspection, the rival opening, and someone quitting.
- `warnings`: the game's 'bad' toasts, the warnings a player would have seen. Each is cut to its first 60 characters and kept once a day.
- `bankruptDay`: the day the game ended in bankruptcy, or null if it never did.
- `months[].incomeBy`: each month's income by source, from the ledger. The sources are treatments, consultations, classes, house calls, the shop, mushrooms, vending, and bonuses (emergency rewards and prizes).
- `goalDays`: for each star, the day each of its objectives was first met, or null if never.
- `months[].runners`: each month's bad trips, and the really bad ones: how many ran, were calmed, calmed within 3 days, and found the door.
- `heldPaydays`: each payday the bank could not cover from the money in hand, as the player meets it (the game stops with the payday dialog): the day, the wages, the bank and the loan before the bot borrowed or paid into the red.
- `gifts`, only with `endow` on: the day each gift to the Foundation was made. A month with a gift also has `months[].gifts`, the amount; `months[].spending` leaves gifts out, so it stays what running the center cost.
- `swaps`, only with `swap` on: everyone let go for a better applicant, with the day, the role, and the rank and salary of the one let go and of the one taken on. The bot's notes stop at 150 a game, so count swaps here rather than from the notes.

## Reading the report

**The table**, one row per center, with the seeds side by side:

- _Stars at month_: the month each star came, seed by seed (`1.1/8.9/15.0 · …`). `–` means the star never came, and `bankrupt day N` stands in for the first star a bankrupt game never reached.
- _Profit a month_: income minus spending, averaged from month 13 on (the second year onward). The range is across seeds.
- _Months at a loss_: months that spent more than they took in, out of every month played.
- _Lowest reputation_: the lowest reputation seen in the game, sampled daily.
- _Months below 15%_: months whose lowest daily reputation went under 15.
- _Bank at the end_: the bank balance at the last month written up.
- _Bankruptcies_: each bankrupt seed and the day it went bankrupt.

**Survival, seed by seed**: each game's outcome and its first adverse event. For a bankrupt game, the table also shows the days from that event to the end, and the last warning before the end. A game lost with no warning in the 10 days before it is marked ⚠: that is a loss the player could not see coming.

**Reputation cliffs**: months in which reputation fell 20 points or more, measured from the end of the month before to the lowest reading in the month. Each cliff is listed with that month's counts of guests who got worse, stormed out, and failed treatment, as the likely cause. The table counts them per center across seeds.

**Spirals**: of the adverse events of each kind, the share followed by a cliff in that month or the two after it. The last column is the share of all three-month windows (from month 2 on) that contain a cliff, the chance of one anyway. An event whose share is well above that column tips the game into a spiral. One near it does not.

**Really bad trips**, only when the logs have them: for each center with any, over every seed, the bad trips, how many of them ran, how many runners were calmed and how many of those within 3 days, the average days to calm, and how many found the door. With a second run, before → after. It comes between the table and the survival slice.

**Side incomes**: the share of income from classes, house calls, the shop, mushrooms, vending and bonuses at months 12, 24 and 48, seed by seed (a game that stops a few ticks short of closing its last month shows the month before).

## A before/after comparison

1. On the code before the change: `BALANCE_OUT=test-results/before.json yarn balance` (and `BOT=baseline BALANCE_OUT=test-results/before-baseline.json yarn balance` if the thoughtless player matters to the change).
2. Make the change, then run `yarn balance` again.
3. `yarn balance:report test-results/balance.json test-results/before.json` prints the table a second time in the "before → after" form of balance-log entry 31. A cell that did not change reads `(unchanged)`. The fairness slices are for the "after" run.
4. Compare seed by seed, not by the means. In the balance-log entry, copy the table and say what the slices show: a new bankruptcy, a cliff that appeared or went away, a loss without warning.

Logs from before the richer fields existed still work as the "before" run. The report reads their bankruptcy from the bot's note and leaves out what they lack.

## How many seeds a call needs

A change to the game, even one that only moves the day a grade is crossed, sends every game down a different course from the first day it matters: the random stream is drawn in a different order from then on, so the same seed before and after is a different game, not the same game with one thing changed. A difference between two runs is the change plus that reshuffle, and at a few dozen seeds the reshuffle alone is as big as most changes.

What it cost to learn (balance-log entry 44): at High Pines, single parts of the standing rule switched off one at a time moved the profit a month by up to two standard errors over seeds 1 to 36, in both directions, and the old standing rule as a whole, +$4.8k a month over seeds 1 to 36, was −$1.9k over seeds 37 to 72. Six seeds a center had cleared the merge that turned out to cost High Pines $5k a month.

So, before a call is written into the balance log:

1. **72 seeds a center** (`BALANCE_SEEDS=$(seq -s, 1 72)`), read as two halves of 36. A finding is one where both halves agree in sign; give the mean of the paired difference (same seed after minus before) with its standard error, and each half's. 720 games, every center, took 72 minutes at 7 slots with a second run beside it on the 16-core Mac (22 October 2026).
2. **One change at a time, with the same bot on both sides.** To say what one part of a merge did, switch that part off in a scratch copy and leave everything else, the bot included, as it is. A merge that changes the game and the bot together has to be split before either can be blamed: the more-land merge carried bot changes too, and only the land's data reverted on the same code measured the land.
3. **The merge gate is every center, not the average.** A center that loses more games, or earns a star later or never in more of them, blocks the merge until the entry explains it, whatever the profit says elsewhere. "Is it easier?" is one question of several: "is it still fair at each center?" is the one that blocks.
