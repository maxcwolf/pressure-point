# Gameplay audit, 19 October 2026

A read of the code at 0.30.14 for bugs and gameplay problems, by three reviewers (staff, economy and events, treatment flow and the world) and one playtest-bot run (`yarn balance`, one seed per center, 48 months). Typecheck and all unit tests passed before any change. Nothing below was reproduced by hand in play: findings are from reading the code, and the balance numbers are from a single seed each, so read them as hints.

[known-issues.md](known-issues.md) holds the earlier audit's open issues; this one adds to it.

## Decisions

- **Stress outbreak paying out for doing nothing:** not a problem, left as it is.
- **Fix now:** price stacking, the Qi Gong class freezing when the Instructor leaves, the missing consequences for a negative bank (paydays especially), a visit notice that blocks the calendar, payroll with no proration, and course refunds booked in the wrong month.
- **Everything else:** a to-do below.

## Plan for the fixes

Each fix comes with a test that fails without it (`tests/unit/audit-fixes.test.ts`, and `tests/unit/classes.test.ts` for the class).

1. **Price stacking.** The overall price and a technique's own price are each limited to 0.5–2, but they multiply, so a treatment could cost 4× (or ¼×), and regulars and emergency guests never balk. `priceFor` (`src/core/sim/economy.ts`) now limits the product to the same range, so every price, house calls included, stops at 2×. Regulars and emergency guests still never balk, by design; only the 4× is gone.
2. **Class freezes when the Instructor leaves.** Firing, a house call, a course or a new room assignment pulled the Instructor off the mat mid-class and left the mat's `progress` above zero. That day's class was lost, the next Instructor inherited a half-run class, and `daysToClass` read 0 for good. `leavePost` (`src/core/sim/staffing.ts`) now ends a class in progress and clears the room's `lastClass`, so a class can start again as soon as someone is at the mat.
3. **Nothing happens when the bank goes negative.** Payday is now the point where it bites:
   - **Warning.** Five days before payday, if the bank will not cover the wages, a toast says so (`warnPayday`).
   - **Borrow, or lose.** At payday, if the bank cannot cover the wages, the game stops and asks to borrow the difference in loan steps (`payrollDue`, `PayrollDialog`). Taking it pays the wages and the game goes on. Refusing it is bankruptcy (`bankrupt`, `BankruptDialog`): time stops for good and the dialog offers Start again or the main menu. Esc does not back out of either dialog, and a save made while one is waiting brings it back on loading.
   - **A few days' grace when the bank would not lend enough.** If the difference would take the loan past its limit, the game does not stop: the player has `PAYROLL_GRACE_DAYS` (3) to find the money some other way, such as selling an item or a room, or earning it. The wages are paid the moment the bank holds them; if the bank would lend the difference after all (the loan was paid down), the question above is asked instead; and if the days run out, the center is bankrupt. A toast and the advisor say so.
   - **A switch.** Bankruptcy is a sandbox setting, on by default (`bankruptcyOn`, Events in the sandbox setup). Off, an unpaid payday is paid anyway and the bank goes into the red, paying the overdraft interest below. Campaign centers always have it on; the campaign has no difficulty settings to hang it on. Tying it to the Relaxed preset was not done, since presets only set the levels of the difficulty settings.
   - **Overdraft interest.** A balance that is still below zero (from anything but wages) pays 5% a month (`OVERDRAFT_RATE`), dearer than the loan's 2%.
4. **A visit notice blocks the calendar.** While a notice was set, nothing else was checked, so a visitor who could never get in (no finished rooms, no path to the first one) stopped inspectors and VIPs for the rest of the game. `updateVisits` (`src/core/sim/visits.ts`) now gives up on a visitor three days after they were due, clears the notice and puts the next visit off as if they had come.
5. **Payroll with no proration.** Wages were one lump at the month's end for everyone not leaving: someone hired the day before payday cost a full month, and someone hired just after payday and let go a day before the next worked a month for nothing. Each member of staff now has `paidTo`, the day their pay is settled up to. Payday pays the whole days since then (at most 30), and `fire`, which every quit, firing and poaching goes through, pays what they have earned on the way out. Saves move to version 32 (which also holds `payrollDue` and `bankrupt`); an older save owes everyone from the start of the month it was saved in.
6. **Course refunds in the wrong month's books.** A refund (a course cut short, or a room sold) came off this month's cost, so a course paid for in one month and called off in the next left the old month's cost standing and showed a cost below zero in the new one. `recoup` now takes back only what has been spent this month; any more comes in as income (`bonus`).

## Done in this pass

See the plan above. All six are in, with tests, and so are these, from the to-do list, each with a test unless noted:

- The rival's sale draw follows what the techniques on offer cost on average (`averagePrice`: unlocked, in a discipline that is switched on), not the overall level alone.
- Price and campaign setters refuse NaN and, for campaigns, fractions of a month.
- No emergency is offered while a stress outbreak is on offer or going on.
- A Mechanic who is leaving no longer counts as one.
- A Shaman no longer gets a blessing and XP for vibes that faded on their own (no test: `smudgeStep` is not exported).
- A soul retrieval is called off when the one asked for has cheered up, and the unhappiness that had them on the way out ends when one is done.
- A rival that is switched off leaves no job offer hanging.
- The Money menu's treatment prices show what each comes to all told when the overall level changes it (`150% → 200%`), and the + button stops at the highest a price can be, with a note, instead of going on with nothing to see.
- Someone back from a house call whose way to the lobby is blocked is put in the lobby rather than left on the street (no test: needs a blocked entrance).

## To do

### Bugs and rule gaps

- [ ] **Bankruptcy and the campaign.** Always on in the campaign centers, and the immediate-loss case is gone but a lost game still has no appeal beyond the grace days. Play The Orchard Estate's opening, and the "Lower" loans setting ($25,000 limit against a payroll of about $15,000), before a release.
- [ ] **Regulars and emergency guests never balk at a price,** however high. Now capped at 2× rather than 4×, but still no price-off check for them.
- [ ] **Moving or selling a treatment table re-queues everyone waiting at it,** undoing any hand-ordering of the line and the emergency-first order (`building.ts:194`, `usersOf` and `resetUsers`).
- [ ] **`upgradeSave` refunds a cancelled Sound course straight into `money`,** off the books, and runs on every load rather than only for old saves (`state/upgrade.ts`, `movedSoundBath`).
- [ ] **`acceptCall` and `train` idle a member of staff before a walk that can fail,** dropping their post or guest with nothing started (`calls.ts`, `training.ts`).
- [ ] **A failed `goTo` in `callGuest` sends a guest home with no outcome** (`stations.ts:263`), so the visit stats drift. No way to reach it found.
- [ ] **A guest in the `served` state has no timeout** and does not worsen (`guests.ts`, `worsening.ts`). No way to reach it found.
- [ ] **Staff retry only the single best unreachable post** (`staffing.ts:499`, `findWork`), so a post that becomes unreachable starves the others.
- [ ] **`settleRest` gives a "rested" feeling and soils a recliner before the walk to it can fail** (`recovery.ts`).
- [ ] **The sim's build API trusts the UI** for money, `missingItems`, unlock stars and "room done" (`building.ts`, `upgrades.ts`). Reachable only through `window.pp` or the console.
- [ ] **Monthly goals can be met on a small sample early in a month** (`goals.ts`: 7 of 10 healed meets a 70% cure rate, with no minimum span). Awards use 20 guests and a full year.
- [ ] **"Go 30 days without anyone quitting" is free** once day 30 comes if nobody has ever quit (`goals.ts:41`), and so is the 90-day achievement. Probably intended.
- [ ] **A failed inspection's bribe** is at least $10,000 (`BRIBE_MIN`) against fines of $800 a problem, so it is rarely worth paying; and `settleInspection(false)` runs silently when a later visitor finishes (`visits.ts`).
- [ ] **The awards ceremony finds a winner by name** (`awards.ts:185`), so two staff with one name get the first match.

### Balance and gameplay

From the bot's 48-month games (one seed per center):

| Center             | Stars at (day)  | Bank at month 48 | Lowest reputation | Got worse waiting |
| ------------------ | --------------- | ---------------- | ----------------- | ----------------- |
| Willow Lane        | 22 / 85 / 237   | $0.89M           | 19%               | 96                |
| The Exchange       | 322 / 459 / 533 | $1.03M           | 35%               | 27                |
| The Boardwalk      | 127 / – / –     | $0.17M           | 0%                | 85                |
| High Pines         | 112 / 437 / 623 | $1.22M           | 3%                | 112               |
| The Orchard Estate | 184 / 295 / 483 | $2.95M           | 16%               | 52                |

- [ ] **Late-game money has nowhere to go.** Four of five centers end with about $1M or more. Willow Lane's bot logs "could not fit a …" over and over from day 237, with nothing left to build or buy. Ideas: upkeep and rent that grow with the building, renovation and luxury upgrades, a research room, big end-game rooms, and the overdraft floor above so cash stays a worry.
- [ ] **Reputation swings between about 100% and 20%** (Willow Lane), driven by guests getting worse while they wait (up to 10 a month, waits of 15–25 days). Warn when a line is about to cost reputation, and bring back the unbuilt balance-audit items: demand growing with the center, and pressures introduced center by center ([balance-audit.md](balance-audit.md), items 4 and 6).
- [ ] **The Orchard Estate's bot goes bankrupt at its second or third payday (days 60 to 90).** Looked into: it is mostly the bot playing poorly, but the center is unforgiving. With every discipline open from the start, the bot builds 8 or 9 rooms and hires 8 specialists in the first 11 days, spending the $45,000 start and borrowing to the $50,000 limit. The payroll is then about $15,000 to $16,000 a month, against takings of $4,000 to $12,000 in the first month (4 to 7 guests in the building). It gets through the first payday only by borrowing the rest, and then the loan is at its limit with takings still under the payroll. The other four centers get through. Before the payday rule it survived on a bank balance as low as −$17,000 and reached its first star at month 6. Ideas: a leaner opening for the bot (fewer staff until the line grows), then see whether a human opening is as hard; if it is, raise The Orchard Estate's starting money or loan limit, or start it with fewer disciplines. `tests/balance/bot.ts` now keeps the first payroll in mind when it borrows (`FIRST_PAYROLL`) and borrows for a payday as a player would.
- [ ] **The Boardwalk reaches 0% reputation and never earns its second star,** stopped by "guests keep 93% of their patience". Look at that goal, or at winter at that center.
- [ ] **The Exchange's first star comes at about day 322,** against day 22 at Willow Lane. Check its first-star goals ([balance-audit.md](balance-audit.md), item 7).
- [ ] **The bot's limits:** it never fires anyone, does not manage lines, prices or marketing, and was run on one seed per center. Run more seeds (`BALANCE_SEEDS`) before tuning anything from these numbers.
- [ ] **A price sweet spot of about 1.9×.** Income per guest peaks near there (guests balk at `(price − 1) × 0.35`), so the slider has a best setting. Consider a steeper balk curve or a reputation cost for high prices.
- [ ] **Ideas already in the docs that this run supports:** the really bad trip ([todo.md](todo.md)) and a signature room per center ([ideas.md](ideas.md)).

## Checked and found sound

Loan, interest and ledger-reset order; reputation clamping; success chance stays within 0.3 to 0.98 (a floor of about 0.105 when botched); sale, demolish and resize refunds; claims are released on every removal path traced; the 47 conditions all have unique ids and a modality; the month and year boundary and the awards timing; campaign timers; and the quit and fire cleanup.
