# Balance log

How to run `yarn balance` and read its report, before and after a change: [balance/harness.md](harness.md).

What was found to be off in how the game plays, how it was measured, and what was done about it, newest first. The wider audit of the campaign's pace and difficulty, with its playtest bot, is [audits/balance-audit.md](../audits/balance-audit.md) (15 October 2026); entries here refer to its findings by number.

A month is 180 seconds of game time (30 days of 6 seconds).

## 25 October 2026, evening: late-game money, and the Pressure Point Foundation

Measured with `yarn balance`, every campaign center, seeds 0 to 12, four years a game, with each payday the bank could not cover now logged (`heldPaydays`). The money curve and the cost options were measured on `claude/money-curve` at `02654cf6`, the Foundation on `claude/foundation` at main `32e85910`. Thirteen seeds, not the 72 [balance/harness.md](harness.md) asks for before a call.

### 49. Money piles up only after the third star; growing costs lose games, so the late game gets a sink instead

**Found:** the gameplay audit's "late-game money has nowhere to go". The good bot's bank tells two stories. Until the third star a center makes about nothing: profit a month is within $3k of zero at every center, and the net worth at the third star is a median $8k (Willow Lane) to $97k (High Pines and The Orchard). After it, the center makes a median $20k to $53k a month with nothing to spend it on, and ends four years with a median $0.5M (High Pines) to $1.4M (The Orchard). The thoughtless baseline and the advised bot never reach a third star (entry 48), and stall on the goals, not on money, so nothing late-game touches them.

Three costs that grow with the center were tried, each against the good bot on the same seeds, with the treatment machines as they are (`BOT_ON=machines`, a running cost the bot can already choose) for comparison:

| Option                                                                             | Games lost (of 65) | Third stars (of 65) | Profit a month, year 2 on | Bank at four years, median by center |
| ---------------------------------------------------------------------------------- | ------------------ | ------------------- | ------------------------- | ------------------------------------ |
| today                                                                              | 4                  | 59                  |                           | $0.5M to $1.1M                       |
| rent by star: $1k, $3k, then $12k a month (×1.5 at The Orchard)                    | 12                 | 56                  | $6k to $16k less          | The Boardwalk below zero, 5 lost     |
| upkeep for every room: 5% of what the rooms cost each month, faster past six rooms | 13                 | 53                  | $5k to $13k less          | High Pines 7 lost, against 2         |
| business rates: 40% of a month's profit above $10k (above $15k at The Orchard)     | 3                  | 59                  | $5k to $11k less          | $0.6M to $0.8M                       |
| the treatment machines, for comparison                                             | 3                  | 57                  | $1k to $6k less           | $0.2M to $1.0M                       |

The bank at four years leaves out The Orchard, whose logs stop short of month 48.

**Read:** rent and room upkeep bite before the third star as well as after it, when the center has no money to spare: they lose 8 and 9 more games, and room upkeep brings the third star later at all five centers. Business rates take a share of a good month only, so they lose nothing, but the pile is still $0.6M to $0.8M at the end and the money has no more purpose than before. None of the three gives the money somewhere to go; they only take it.

**Done:** no new costs. Instead, the **Pressure Point Foundation** (`src/core/sim/foundation.ts`): once every star in a campaign center is earned, three gifts of $50,000, $100,000 and $200,000 (×1.5 at The Orchard), each worth 1 karma for the campaign, once a center. It asks nothing of a center still earning its stars. The bot gives with `endow` (on for the good bot): the next gift whenever it leaves two months' wages and machine upkeep in the bank.

The good bot with `endow` against it without (`BOT_OFF=endow`), on the same 65 games:

| Center             | Three-star games | All three gifts | First gift, months after the third star | Third gift, months after | Bank at the end, median | Lowest bank after the third star, median |
| ------------------ | ---------------- | --------------- | --------------------------------------- | ------------------------ | ----------------------- | ---------------------------------------- |
| Willow Lane        | 13               | 12              | 5 to 7                                  | 13 to 18                 | $1,054k → $704k         | $3k → $3k                                |
| The Exchange       | 13               | 13              | 3 to 10                                 | 11 to 26                 | $735k → $385k           | $6k → $6k                                |
| The Boardwalk      | 11               | 9               | 0 to 10                                 | 17 to 22                 | $617k → $261k           | $20k → $20k                              |
| High Pines         | 11               | 9               | 0 to 11                                 | 0 to 24                  | $510k → $160k           | $74k → $49k                              |
| The Orchard Estate | 11               | 11              | 0 to 3                                  | 7 to 15                  | $1,315k → $790k         | $114k → $65k                             |

**Read:**

- **It costs nothing on the way up.** Stars, games lost (4 of 65), held paydays after the third star (21 in all) and Center of the Year trophies are the same with and without, game for game: a gift comes only after the last star, and the bot keeps two months' wages back.
- **Nearly every finished center gives.** 57 of the 59 three-star games make a first gift and 54 make all three, over the year or so after the third star. Of the five that fall short, three never have that much spare, one High Pines game earns its third star in month 40 with too little time left, and one goes bankrupt with or without the Foundation.
- **It gives the money somewhere to go, not a reason to worry.** The bank still ends at a median $160k to $790k: $350k ($525k at The Orchard) is a third to two thirds of what piles up. The pile shrinks by choice, for karma, and a player who would rather keep the money loses nothing.

A switch to borrow for a held payday without the game stopping was also offered, and turned down: the payday dialog stays.

**Still open:**

- **72 seeds a center** before the costs' verdict counts as a finding; the direction was the same at every center for rent and room upkeep.
- **The advised bot** stalls on the goals before the money matters (entry 48): a pass on what the advisor says, not on the money curve.

## 25 October 2026, after midnight: the personas side by side

Measured with `yarn balance` on `claude/bot-plays-like-max` at `c1c5d48`, every campaign center, seeds 1 to 6, four years a game: five bots on the same code. The good bot as it was before the owner's flags (`BOT_OFF=loan,early,modest,brave,swap`), with all five of them, and with four and no `modest`; the thoughtless baseline (`BOT=baseline`); and the advised bot (`BOT=advised`). Profit a month is averaged from month 13 on over the games that reached it; a star never earned counts as month 48 in the mean star month. Six seeds, not the 72 [balance/harness.md](harness.md) asks for before a call.

### 48. Four of the owner's habits make the best bot yet; `modest` is an extra; the baseline and the advised bot never reach a third star

**Found:** entries 46 and 47 measured the owner's five habits one at a time against the good bot, but never set the personas beside each other on one code, and never ran the five with `modest` off. Done here.

| Center             | Persona         | Profit a month | Games lost | Third stars | First star, month | Mean star month |
| ------------------ | --------------- | -------------- | ---------- | ----------- | ----------------- | --------------- |
| Willow Lane        | good as it was  | $22.2k         | 1 of 6     | 5 of 6      | 0.9               | 8.2             |
|                    | all five        | $17.1k         | 1 of 6     | 5 of 6      | 0.9               | 10.0            |
|                    | four, no modest | $27.0k         | 0 of 6     | 6 of 6      | 0.8               | 8.1             |
|                    | baseline        | $0.5k          | 3 of 6     | 0 of 6      | 0.9               | 32.3            |
|                    | advised         | $3.9k          | 0 of 6     | 0 of 6      | 0.9               | 32.3            |
| The Exchange       | good as it was  | $24.1k         | 1 of 6     | 5 of 6      | 6.3               | 13.4            |
|                    | all five        | $10.1k         | 0 of 6     | 5 of 6      | 8.1               | 15.3            |
|                    | four, no modest | $20.7k         | 0 of 6     | 6 of 6      | 7.9               | 13.1            |
|                    | baseline        | $4.7k          | 0 of 6     | 0 of 6      | 6.0               | 34.0            |
|                    | advised         | $5.1k          | 0 of 6     | 0 of 6      | 6.0               | 34.0            |
| The Boardwalk      | good as it was  | $16.1k         | 0 of 6     | 6 of 6      | 5.2               | 11.4            |
|                    | all five        | $4.2k          | 0 of 6     | 5 of 6      | 9.0               | 17.0            |
|                    | four, no modest | $13.4k         | 0 of 6     | 5 of 6      | 6.1               | 18.3            |
|                    | baseline        | $2.0k          | 0 of 6     | 0 of 6      | 8.7               | 23.7            |
|                    | advised         | $0.0k          | 0 of 6     | 0 of 6      | 8.2               | 21.5            |
| High Pines         | good as it was  | $17.2k         | 1 of 6     | 4 of 6      | 5.8               | 19.1            |
|                    | all five        | $4.4k          | 1 of 6     | 6 of 6      | 6.0               | 15.0            |
|                    | four, no modest | $10.8k         | 1 of 6     | 4 of 6      | 6.2               | 20.2            |
|                    | baseline        | $3.1k          | 0 of 6     | 0 of 6      | 6.5               | 34.2            |
|                    | advised         | $5.1k          | 0 of 6     | 0 of 6      | 6.1               | 34.0            |
| The Orchard Estate | good as it was  | $66.6k         | 2 of 6     | 4 of 6      | 19.3              | 22.5            |
|                    | all five        | $49.9k         | 0 of 6     | 6 of 6      | 5.0               | 9.8             |
|                    | four, no modest | $53.6k         | 0 of 6     | 6 of 6      | 4.7               | 10.3            |
|                    | baseline        | −$0.9k         | 1 of 6     | 0 of 6      | never             | never           |
|                    | advised         | −$0.9k         | 1 of 6     | 0 of 6      | never             | never           |

All centers together, 30 games each:

| Persona         | Profit a month | Games lost | Third stars | Mean star month |
| --------------- | -------------- | ---------- | ----------- | --------------- |
| good as it was  | $26.7k         | 5          | 24          | 14.9            |
| all five        | $17.1k         | 2          | 27          | 13.4            |
| four, no modest | $25.1k         | 1          | 27          | 14.0            |
| baseline        | $1.9k          | 4          | 0           | 34.4            |
| advised         | $2.7k          | 1          | 0           | 34.0            |

**Read:**

- **The four without `modest` is the best bot so far.** One game lost in thirty against five for the good bot as it was, 27 third stars against 24, and $1.6k a month less profit. The small loan is what saves The Orchard's opening (entry 46), and the swaps bring the stars (entry 47).
- **`modest` costs about $8k a month at every center** for no star or game gained, as entry 46 found on its own: at 1.4 few guests are put off, so 1.1 only takes a fifth off every fee.
- **The baseline and the advised bot never reach a third star** in 30 games each, and rarely a second. At The Orchard neither ever opens the doors: the thoughtless opening build cannot be paid for. The advice saves games, one lost against four, and does not make the player any quicker. That is the fairness reading of entries 32 and 33 again, on today's code.
- For the game's communication: a player who holds prices at 1.0 or 1.1, as the real players in PostHog do, leaves about a fifth of their income on the table, and the only hint the game gives is the put-off chance on the Prices tab. Noted for a later pass, not changed here.

**Done** (`tests/balance/bot.ts`, `tests/unit/bot-owner.test.ts`, `docs/balance/harness.md`): `modest` moved into `BOT_EXTRAS`, off unless `BOT_ON=modest` names it, so the good bot runs `loan`, `early`, `brave` and `swap`. The "four, no modest" column is the good bot as it now plays.

**Still open:**

- **72 seeds a center** before any of this counts as a finding, as the harness asks. The direction is the same at every center for `modest`, and the same at four of five for the four together.
- **Why `early` costs The Boardwalk and High Pines** (entry 46), still not looked into.

## 24 October 2026, night: the bot swaps staff for better applicants

Measured with `yarn balance` on `claude/bot-plays-like-max` (uncommitted, on `e3ec295`), every campaign center, seeds 1 to 6, four years a game: the good bot with `swap` against the same code with `BOT_OFF=swap`, which plays as the good bot did at `e3ec295`, the four flags of entry 46 on in both. With `BOT_OFF=swap` the logs are the same as at `e3ec295`, byte for byte, at Willow Lane, The Exchange and The Orchard, seeds 1 and 2 over 420 days, and so are `BOT=old`'s; over the six seeds and four years, the merged log is byte for byte entry 46's "after". `swap` was also measured on its own, the other four flags off, against entry 46's "before". Profit a month is averaged from month 13 on over the games that reached it, each difference paired seed by seed with its standard error; a mean star month counts a star never earned as month 48. Six seeds is below the 72 a center that [balance/harness.md](harness.md) asks for before a call: this entry says what moved and how far, not what to keep.

### 47. A better applicant in place of the weakest: stars sooner at four centers, mostly through Consultants and Receptionists

**Found:** in the owner's two games in PostHog they replaced staff six times: a Wellness Consultant hired and one let go the same day (Willow Lane, day 59); a Caretaker hired on day 160 and one let go on day 168; a Consultant hired on day 305 and one let go on day 323; two Massage Therapists let go on days 210 and 219, with hires on days 212, 246 and 252 (The Exchange); and an Acupuncturist hired on day 314 and one let go on day 315. Read together: when a clearly better applicant turns up for a role, take them on and let the weakest in it go. The good bot never did. It let a practitioner go only when their tables stood idle (`trimPayroll`) or the bank was calling the overdraft in (`rescue`), and otherwise kept whoever it hired first. As in entry 46, these are one player's games on 0.30.9 to 0.33.3, not today's code: they show a habit, not a target.

**Done** (`tests/balance/bot.ts`, `tests/unit/bot-owner.test.ts`, `docs/balance/harness.md`): a flag, `swap`, on for the good bot, off for `BOT=old`, switched off with `BOT_OFF=swap`. Once the doors are open, each day, in each role with staff (the desk, the Consultants, each discipline's practitioners, the Caretakers and the Qi Gong Instructors), the bot sets the best applicant (the best rank, then the cheaper, as it always hires) against the weakest member who could go (the lowest rank, then the dearer, as `trimPayroll` picks). An applicant a rank or more above them is hired, and only once the hire has gone through is the weakest let go. The headcount stays the same, so the rooms `benched` leaves empty, which `hireToFill` and `trimPayroll` count by, are unchanged. Each swap is a note (`day N: swapped a <role>: rank X for rank Y, salary A for B`) and a row in the log's new `swaps`, which is there only with the flag on, since the notes stop at 150 a game.

- **Guards:** not while the advisor says to hire nobody (`holdHires`) or the bank is calling the overdraft in (`daysUntilBankrupt`); not when the applicant asks more than the one going and the difference would take the month's projected books (`projectedCashflow`) below zero; at most one swap a role in any 30 days; never a dearer Consultant with `junior`; never anyone on a course, on a house call or away.
- **What would be lost:** nobody goes who knows a technique the applicant does not, learned here or brought with them (and nobody arrives knowing a machine's), nor anyone with a general course passed, which no applicant has: in the bot's games that is the Caretaker it trains in Mechanics for `kit`. A Receptionist or Caretaker knows no techniques, so for them only the general course counts.
- **What the game charges for letting someone go:** nothing beyond the wages earned since payday (`payOff`), which staying would have cost as well: no notice, no severance and no month's pay. Nobody else's morale moves, and the reputation does not fall (only someone quitting or poached costs 2 points). Entry 13 found the same, and that someone let go just before payday went unpaid for the month; pay has been settled by the day since (`e1c917b`). What does go with them: a guest they were treating is sent back to the line, their station stands empty while the new hire walks in from the street, a course would be refunded (the bot swaps nobody on one), and their experience toward the next rank is lost, the new hire starting at the bottom of their own.
- **Tests:** a better applicant hired and the weakest let go, with the note and the log row; no swap for an applicant of the same rank, however cheap; none for a therapist with a technique the applicant lacks until the applicant knows it too, nor for a Caretaker with Mechanics; none past what the month's books can carry; one a role a month at most; and nothing with the flag off. Breaking the rank, course, books or month check, or calling `swap` with the flag off, makes its test fail.

Choices the brief left open: the weakest is the weakest of those who could go, so a trained practitioner stays and a lower-ranked colleague without the course can still be swapped; a general course counts for every role, the Caretaker's Mechanics included, though the brief let a Caretaker's techniques go; the books guard looks only at a dearer applicant, so one asking the same or less is taken on even in a month at a loss; "a month" is 30 days since the role's last swap; and only the single best applicant is weighed, by rank alone, quirks aside, as `hire` weighs them.

**Result**, `swap` against none, the four flags of entry 46 on in both, before → after:

| Center             | Stars at month (seed by seed)                                                                                                                                                                                  | Profit a month                      | Months at a loss    | Lowest reputation    | Months below 15% | Bank at the end                             | Bankruptcies                                     |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ------------------- | -------------------- | ---------------- | ------------------------------------------- | ------------------------------------------------ |
| Willow Lane        | 0.9/15.6/24.3 · 0.9/22.8/24.9 · 0.7/5.9/14.5 · 1.0/9.6/11.9 · 1.0/29.9/38.7 · 1.0/bankrupt day 1150/– → 0.9/5.0/9.5 · 0.9/bankrupt day 521/– · 0.7/6.0/12.9 · 1.0/3.7/10.9 · 1.0/2.8/7.8 · 1.0/7.9/11.4        | −$1.4k to $23.6k → −$3.1k to $26.7k | 7 to 28 → 6 to 15   | 1 to 30 → 4 to 30    | 0 to 10 → 0 to 4 | −$3.6k to $824.4k → −$9.1k to $943.2k       | seed 6 day 1150 → seed 2 day 521                 |
| The Exchange       | 13.6/17.0/28.9 · 8.3/12.7/17.9 · 9.5/12.8/19.9 · 3.8/14.0/24.9 · 10.3/14.4/24.5 · 7.7/12.6/18.7 → 11.6/14.7/26.6 · 8.4/13.6/18.7 · 9.5/11.8/– · 3.8/12.4/22.5 · 7.7/12.2/19.7 · 7.5/10.1/16.7                  | $5.9k to $18.9k → −$2.6k to $17.0k  | 8 to 18 → 9 to 24   | 29 to 30 (unchanged) | 0 (unchanged)    | $209.1k to $708.3k → −$24.6k to $584.8k     | none (unchanged)                                 |
| The Boardwalk      | 13.5/bankrupt day 611/– · 8.8/–/– · 9.8/–/– · 11.9/15.0/25.2 · 13.7/–/– · 12.6/25.9/bankrupt day 971 → 12.1/14.8/23.0 · 6.8/9.7/15.6 · 4.8/9.5/18.9 · 11.7/–/– · 9.9/12.8/20.9 · 8.8/10.8/20.3                 | −$6.3k to $3.8k → $1.1k to $7.5k    | 13 to 28 → 15 to 22 | 30 (unchanged)       | 0 (unchanged)    | −$23.6k to $133.5k → $48.6k to $234.6k      | seed 1 day 611, seed 6 day 971 → none            |
| High Pines         | 5.9/10.6/20.8 · 5.8/9.1/bankrupt day 371 · 5.6/12.8/19.6 · 3.9/12.8/23.3 · bankrupt day 1180/–/– · 4.9/20.5/30.3 → 7.8/11.5/31.3 · 6.6/10.7/29.3 · 3.8/8.6/21.2 · 6.0/9.8/21.7 · 6.9/11.3/18.4 · 4.9/25.5/35.3 | −$1.4k to $14.5k → −$2.8k to $13.6k | 9 to 25 → 9 to 26   | 0 to 30 → 17 to 30   | 0 to 8 → 0       | −$15.3k to $498.9k → −$41.0k to $444.5k     | seed 2 day 371, seed 5 day 1180 → seed 4 day 941 |
| The Orchard Estate | 5.1/11.6/20.0 · 7.2/11.7/20.6 · 6.5/10.9/17.8 · 4.6/11.2/19.7 · 5.0/10.3/16.0 · 5.2/9.1/13.8 → 5.3/10.5/15.9 · 5.3/9.2/14.8 · 4.7/7.8/13.9 · 4.8/8.9/15.9 · 4.9/9.2/15.9 · 5.3/9.1/15.7                        | $38.4k to $55.8k → $43.6k to $56.1k | 7 to 12 → 5 to 9    | 5 to 30 → 26 to 30   | 0 to 1 → 0       | $1322.9k to $2004.6k → $1503.0k to $1953.7k | none (unchanged)                                 |

| Center        | Profit a month              | Games lost | Third stars | Mean star month |
| ------------- | --------------------------- | ---------- | ----------- | --------------- |
| Willow Lane   | $7.9k → $17.1k (+9.2 ±4.2)  | 1 → 1      | 5 → 5       | 16.6 → 10.0     |
| The Exchange  | $12.0k → $10.1k (−1.9 ±2.8) | 0 → 0      | 6 → 5       | 15.1 → 15.3     |
| The Boardwalk | −$0.6k → $4.2k (+4.8 ±0.8)  | 2 → 0      | 1 → 5       | 31.6 → 17.0     |
| High Pines    | $6.9k → $4.4k (−2.9 ±3.6)   | 2 → 1      | 4 → 6       | 21.0 → 15.0     |
| The Orchard   | $44.0k → $49.9k (+5.9 ±3.3) | 0 → 0      | 6 → 6       | 11.5 → 9.8      |

High Pines pairs five games, as one game before went bankrupt on day 371, before its second year. Willow Lane's lost game moved: seed 6 on day 1150 before, seed 2 on day 521 after.

**What the bot did:** 404 swaps in the 30 games, 4 to 21 a game: 199 in the first year, 157 in the second, 42 in the third and 6 in the fourth, as the staff reach ranks no applicant beats.

| Center        | Swaps a game (seeds 1 to 6) | In the first year | Consultants | Receptionists | Caretakers | Practitioners                                                               |
| ------------- | --------------------------- | ----------------- | ----------- | ------------- | ---------- | --------------------------------------------------------------------------- |
| Willow Lane   | 12 · 4 · 9 · 8 · 8 · 8      | 30 of 49          | 20          | 20            | 6          | 3 (Massage Therapists)                                                      |
| The Exchange  | 10 · 13 · 13 · 10 · 12 · 14 | 28 of 72          | 29          | 23            | 11         | 9 (7 Massage Therapists, 2 Acupuncturists)                                  |
| The Boardwalk | 18 · 14 · 16 · 9 · 16 · 15  | 43 of 88          | 25          | 24            | 16         | 23 (17 Massage Therapists, 3 Acupuncturists, 3 Reiki Practitioners)         |
| High Pines    | 20 · 21 · 15 · 13 · 17 · 21 | 48 of 107         | 30          | 23            | 19         | 35 (12 Massage Therapists, 11 Sound Healers, 7 Acupuncturists, 5 Reiki)     |
| The Orchard   | 15 · 17 · 14 · 12 · 15 · 15 | 50 of 88          | 33          | 24            | 17         | 14 (6 Reiki Practitioners, 3 Acupuncturists, 3 Shamans, 1 Massage, 1 Sound) |

No Qi Gong Instructor was swapped. By rank: 151 swaps were a rank 4 for a 5, 140 a 3 for a 4, 52 a 3 for a 5, 29 a 2 for a 3, 22 a 2 for a 4, 5 a 2 for a 5, and 5 a rank 1 for better. The new hire cost $320 to $470 a month more on average at each center, from $560 less to $2,120 more; 28 cost no more. Willow Lane's seed 2 made only 4, in a game that ended on day 521.

Why so few practitioners: counted each day before the bot decides, a role at a time, over the same 30 games, 68,412 role-days had an applicant a rank or more above the role's weakest. On 62,929 of them (92%) everyone who could go knew a technique the applicant did not, nearly always a practitioner the bot had sent on courses; 2,206 fell within a month of the role's last swap, 1,519 had the weakest on a course or a call, 1,216 were stopped by the books, 82 by the bank's countdown, and on 460 nothing stood in the way. So it is the courses guard, not the books, that holds `swap` back: once a practitioner has a course no applicant matches them, and 57 of the 84 practitioner swaps came in the first year. Consultants, Receptionists and Caretakers, who learn no techniques, make up four swaps in five.

**`swap` on its own**, the other four flags off, against entry 46's "before" (none of the five):

| Center        | Profit a month               | Games lost | Third stars | Mean star month |
| ------------- | ---------------------------- | ---------- | ----------- | --------------- |
| Willow Lane   | $22.2k → $29.2k (+7.1 ±9.2)  | 1 → 0      | 5 → 6       | 8.2 → 6.1       |
| The Exchange  | $24.1k → $18.3k (−7.6 ±11.3) | 1 → 1      | 5 → 5       | 13.4 → 13.2     |
| The Boardwalk | $16.1k → $17.2k (+1.0 ±3.4)  | 0 → 0      | 6 → 6       | 11.4 → 10.3     |
| High Pines    | $17.2k → $6.0k (−11.2 ±6.3)  | 1 → 2      | 4 → 5       | 19.1 → 14.4     |
| The Orchard   | $66.6k → $67.8k (−0.8 ±4.1)  | 2 → 1      | 4 → 5       | 22.5 → 15.8     |

**Read:**

- **Stars come sooner.** With the four flags on, the mean star month falls at Willow Lane (16.6 → 10.0), The Boardwalk (31.6 → 17.0), High Pines (21.0 → 15.0) and The Orchard (11.5 → 9.8), and is even at The Exchange (15.1 → 15.3). On its own it falls at every center. Most swaps put a better Consultant or Receptionist in place, and a skilled Consultant is surer of a diagnosis the first time, which makes the treatment likelier to work (the game's own help text). The share healed of the guests healed, failed or sent home worse in the first year rises at every center, from 61% to 76% at Willow Lane, 68% to 75% at The Orchard, and 3 to 4 points elsewhere. That is likely what carries the heal-share goals, though it was not taken apart further.
- **Profit, paired:** +$9.2k ±4.2 a month at Willow Lane and +$4.8k ±0.8 at The Boardwalk (more on every seed), both more than two standard errors; +$5.9k ±3.3 at The Orchard; −$1.9k ±2.8 at The Exchange and −$2.9k ±3.6 at High Pines, within the noise. The wages rise with the ranks (Willow Lane's first-year payroll $8.8k → $12.6k a month), and where the stars come sooner the takings rise more ($11.1k → $19.0k a month there).
- **The Boardwalk is the clearest:** every seed better off, no game lost against two, and the third star in 5 games of 6 against 1. Entry 46's four flags had cost it most.
- **It gives back part of what entry 46's habits cost, not all.** All five flags against none of them: −$5.0k ±10.0 a month at Willow Lane, −$15.4k ±5.8 at The Exchange, −$11.9k ±2.5 at The Boardwalk, −$12.8k ±6.3 at High Pines and −$15.0k ±4.7 at The Orchard, with the mean star month at 10.0, 15.3, 17.0, 15.0 and 9.8 against 8.2, 13.4, 11.4, 19.1 and 22.5.
- **High Pines makes less money with it**, by $2.9k ±3.6 with the four flags and $11.2k ±6.3 without, while its stars still come sooner. Not looked into.

**Still open:**

- **Whether `swap` stays on.** It is on for the good bot, as the brief asked. Over six seeds it brings the stars sooner almost everywhere and is about even on money, but the call should be made on the 72 seeds a center the harness asks for.
- **The courses guard keeps nearly every trained practitioner.** A looser rule, a swap when the applicant knows the techniques guests come for, or when a rank more outweighs a course the bot can buy again, was not tried.
- **Why High Pines earns less with it.**
- No game rule was changed: letting someone go still costs nothing but the days worked, and whether it should is the owner's call (entry 13).

## 24 October 2026, evening: the bot plays as the owner does

Measured with `yarn balance` on `claude/bot-plays-like-max` (uncommitted, on `main` at `ad1afad`, 0.33.5), every campaign center, seeds 1 to 6, four years a game: the good bot with its four new flags against the same code with `BOT_OFF=loan,early,modest,brave`, which plays as the good bot did before them (its logs are the same as on `main`, byte for byte, at Willow Lane, The Exchange and The Orchard, seeds 1 and 2 over 420 days, and so are `BOT=old`'s). Each flag was also measured on its own, the other three off, over the same games. Profit a month is averaged from month 13 on over the games that reached it, each difference paired seed by seed with its standard error; a mean star month counts a star never earned as month 48. Six seeds is the brief's sample, not the 72 that [balance/harness.md](harness.md) asks for before a call: this entry says what moved and how far, not what to merge.

### 46. The owner's four habits in the good bot: together they make it slower and poorer, and the low prices are most of it

**Found:** the owner's own two games in PostHog, played by one player on 0.30.9 to 0.33.3 rather than today's code, earned Willow Lane's three stars by months 0.8, 2.8 and 5.6 and The Exchange's first two by months 3.9 and 6.4. Those months are why this was built and show which habits a good player has; they are not a target for the bot, and they cannot be set beside its months on today's code. Four habits stood out from the good bot's: a loan of 5 to 15 thousand for one build at a time, repaid within days of having the cash; decor, a Staff Room on day 1 or 2 and a Training Room by day 10 to 24; prices set to 1.1 on day 10 and left there for a year, a busy discipline's techniques at 1.1 to 1.2; and every emergency (7 of 7) and stress outbreak (5 of 5) taken on. The measurement is the before → after table below, on today's code over six seeds.

**Done** (`tests/balance/bot.ts`, `tests/unit/bot-owner.test.ts`, `docs/balance/harness.md`): four flags in `BOT_FLAGS`, on for the good bot, off for `BOT=old`, each switched off by name with `BOT_OFF`:

- **`loan`:** the bot asks the bank for no more than three steps ($15,000) in all, for a build, land, equipment or the wages before a payday; past that, only the loan the bank forces at a payday. It pays a step back whenever a month's wages and $5,000 are in hand, rather than $25,000. Both numbers are the good style's (`loanTop`, new, and `repay`), so the hoarder and the grower keep their own.
- **`early`:** a Staff Room before the doors open if the money allows after the opening rooms and the first hires; a Training Room from the first day, as soon as the game opens one (the room's center, offering and star, and its furniture's `itemOpen`) and its cost is in hand with only the wages due kept back; each treatment room dressed the day it is built, by `decorate`'s own rules and order (with `layout`: windows, a picture or a hanging, a rug, then lamps) up to the prestige it aims for, a prestige goal still dressed for while saving; and nothing kept back for decor or the corridor's comforts until the center has been open a month.
- **`modest`:** prices to 1.1 on the first day open, and the good style's tops at 1.1, and 1.2 for a long line's techniques, against 1.4 and 1.3. The cuts for a short or falling reputation stay, and the bank's countdown still takes prices to 1.4.
- **`brave`:** every emergency taken on, whatever the staff can see through, and every stress outbreak, its carriers calmed as `trouble` calms them (without its Shaman's ward). With `emergencies` on too, `brave` wins: every emergency is taken, and its guests still go first while it runs.
- **Tests** for each: the loan asked for never past $15,000 and a step paid back once the cushion is there; a Staff Room before Willow Lane's doors open and a Training Room within its first month; prices at 1.1 the first day open and never above; an emergency the staff cannot see through taken on, and an outbreak; `BOT=old` with every flag off, and `BOT_OFF=loan,early,modest,brave` switching off exactly those four.

Two choices the brief left open. The Training Room is not borrowed for: borrowed for on the first day, it left most of the loan's three steps spent at The Exchange, which then earned its stars later (seeds 1 and 2), and it changed nothing where the opening money pays for it. And the cushion stays at $5,000: over seeds 1 to 6 and two years, 19 of about 720 paydays had a step paid back and borrowed again before the payday came, against 11 at $7,500 or $10,000, not every payday.

**Result**, all four flags against none, before → after:

| Center             | Stars at month (seed by seed)                                                                                                                                                                                    | Profit a month                      | Months at a loss   | Lowest reputation  | Months below 15% | Bank at the end                            | Bankruptcies                                     |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ------------------ | ------------------ | ---------------- | ------------------------------------------ | ------------------------------------------------ |
| Willow Lane        | 1.1/6.7/17.0 · 0.9/7.9/12.2 · 0.8/3.9/10.7 · 0.8/4.0/8.7 · 0.7/6.8/bankrupt day 461 · 0.8/5.8/10.4 → 0.9/15.6/24.3 · 0.9/22.8/24.9 · 0.7/5.9/14.5 · 1.0/9.6/11.9 · 1.0/29.9/38.7 · 1.0/bankrupt day 1150/–       | −$8.2k to $39.5k → −$1.4k to $23.6k | 5 to 14 → 7 to 28  | 21 to 30 → 1 to 30 | 0 → 0 to 10      | −$10.4k to $1408.8k → −$3.6k to $824.4k    | seed 5 day 461 → seed 6 day 1150                 |
| The Exchange       | 7.8/11.8/18.7 · 4.0/7.9/bankrupt day 311 · 5.9/10.3/16.8 · 7.0/11.1/16.7 · 6.6/9.9/22.0 · 6.4/10.5/20.6 → 13.6/17.0/28.9 · 8.3/12.7/17.9 · 9.5/12.8/19.9 · 3.8/14.0/24.9 · 10.3/14.4/24.5 · 7.7/12.6/18.7        | $13.4k to $33.1k → $5.9k to $18.9k  | 7 to 14 → 8 to 18  | 30 → 29 to 30      | 0 (unchanged)    | −$8.9k to $1143.6k → $209.1k to $708.3k    | seed 2 day 311 → none                            |
| The Boardwalk      | 6.8/15.0/20.5 · 4.8/14.7/20.1 · 5.9/11.7/16.8 · 4.5/8.9/16.2 · 4.8/9.9/15.8 · 4.6/8.7/15.0 → 13.5/bankrupt day 611/– · 8.8/–/– · 9.8/–/– · 11.9/15.0/25.2 · 13.7/–/– · 12.6/25.9/bankrupt day 971                | $8.0k to $21.8k → −$6.3k to $3.8k   | 8 to 13 → 13 to 28 | 28 to 30 → 30      | 0 (unchanged)    | $353.7k to $750.2k → −$23.6k to $133.5k    | none → seed 1 day 611, seed 6 day 971            |
| High Pines         | 4.4/7.8/18.5 · 3.9/7.9/25.9 · 9.0/bankrupt day 521/– · 5.7/–/– · 3.9/7.5/12.2 · 7.7/11.5/25.1 → 5.9/10.6/20.8 · 5.8/9.1/bankrupt day 371 · 5.6/12.8/19.6 · 3.9/12.8/23.3 · bankrupt day 1180/–/– · 4.9/20.5/30.3 | −$1.5k to $29.0k → −$1.4k to $14.5k | 7 to 17 → 9 to 25  | 6 to 30 → 0 to 30  | 0 to 2 → 0 to 8  | −$5.8k to $970.2k → −$15.3k to $498.9k     | seed 3 day 521 → seed 2 day 371, seed 5 day 1180 |
| The Orchard Estate | 4.5/9.9/15.1 · 5.4/9.4/15.5 · bankrupt day 161/–/– · 6.4/10.6/15.4 · bankrupt day 130/–/– · 3.8/7.8/12.5 → 5.1/11.6/20.0 · 7.2/11.7/20.6 · 6.5/10.9/17.8 · 4.6/11.2/19.7 · 5.0/10.3/16.0 · 5.2/9.1/13.8          | $58.3k to $72.3k → $38.4k to $55.8k | 4 to 7 → 7 to 12   | 20 to 30 → 5 to 30 | 0 → 0 to 1       | −$16.0k to $2742.4k → $1322.9k to $2004.6k | seed 3 day 161, seed 5 day 130 → none            |

| Center        | Profit a month               | Games lost | Third stars | Mean star month |
| ------------- | ---------------------------- | ---------- | ----------- | --------------- |
| Willow Lane   | $22.2k → $7.9k (−14.3 ±7.0)  | 1 → 1      | 5 → 5       | 8.2 → 16.6      |
| The Exchange  | $24.1k → $12.0k (−13.5 ±4.6) | 1 → 0      | 5 → 6       | 13.4 → 15.1     |
| The Boardwalk | $16.1k → −$0.6k (−16.8 ±2.5) | 0 → 2      | 6 → 1       | 11.4 → 31.6     |
| High Pines    | $17.2k → $6.9k (−10.5 ±7.8)  | 1 → 2      | 4 → 4       | 19.1 → 21.0     |
| The Orchard   | $66.6k → $44.0k (−21.8 ±3.3) | 2 → 0      | 4 → 6       | 22.5 → 11.5     |

**Each flag on its own**, the other three off, against none: the paired difference in profit a month (thousands, ± its standard error) · games lost · mean star month.

| Flags            | Willow Lane           | The Exchange          | The Boardwalk         | High Pines            | The Orchard           |
| ---------------- | --------------------- | --------------------- | --------------------- | --------------------- | --------------------- |
| none (before)    | $22.2k · 1 · 8.2      | $24.1k · 1 · 13.4     | $16.1k · 0 · 11.4     | $17.2k · 1 · 19.1     | $66.6k · 2 · 22.5     |
| `loan`           | −0.8 ±6.9 · 0 · 8.8   | −2.1 ±3.3 · 0 · 11.9  | +4.6 ±4.5 · 0 · 11.2  | −5.2 ±3.3 · 1 · 16.1  | −8.3 ±3.1 · 0 · 11.3  |
| `early`          | +9.8 ±7.8 · 0 · 7.7   | −2.1 ±2.8 · 0 · 13.7  | −7.2 ±3.4 · 1 · 20.6  | −8.6 ±5.6 · 2 · 19.8  | −5.6 ±13.0 · 2 · 22.0 |
| `modest`         | −1.6 ±8.1 · 1 · 8.3   | −12.0 ±4.1 · 0 · 15.0 | −14.9 ±3.3 · 1 · 19.5 | −14.7 ±3.0 · 1 · 23.3 | −26.4 ±5.7 · 3 · 28.8 |
| `brave`          | +8.0 ±7.0 · 0 · 6.7   | +1.6 ±5.0 · 0 · 11.7  | −4.0 ±5.8 · 1 · 14.2  | +0.7 ±3.6 · 1 · 18.9  | −3.8 ±3.1 · 2 · 22.6  |
| all four (after) | −14.3 ±7.0 · 1 · 16.6 | −13.5 ±4.6 · 0 · 15.1 | −16.8 ±2.5 · 2 · 31.6 | −10.5 ±7.8 · 2 · 21.0 | −21.8 ±3.3 · 0 · 11.5 |

**Each flag on the old bot** (`BOT=old BOT_ON=<flag>`), Willow Lane seeds 1 and 2, 420 days, to see that each does what it says:

| `BOT=old` with | Stars at month (seed 1 · 2) | What its notes and months show                                                                                                                                                                                 |
| -------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| nothing        | 1.1/–/– · 0.9/3.9/–         | Owes $30,000 and $35,000 at the end, at peaks of $30,000 and $45,000                                                                                                                                           |
| `loan`         | 1.1/11.9/– · 0.9/–/–        | Never asked past $15,000; the bank's payday loans took it to $20,000 and $25,000; 5 and 4 steps paid back, ending at $10,000 and $15,000 owed, and $8,600 and $14,000 better off net of the loan than without  |
| `early`        | 0.8/8.0/– · 0.8/–/–         | A Staff Room on day 0 (day 1 without), the Massage Suite at prestige 3 before the doors open, 35% reputation by day 13 on both seeds (22 and 13 without), a Training Room on day 24 and 26 (33 and 28 without) |
| `modest`       | 1.1/–/– · 0.9/–/–           | Prices at 1.1 from the first day open to the end, where the old bot never moves them from 1                                                                                                                    |
| `brave`        | 1.1/–/– · 0.9/3.9/–         | The old bot already takes every emergency; seed 2 took on 4 stress outbreaks, seed 1 was offered none                                                                                                          |

Two seeds over 14 months say no more than that: the old bot loses money at Willow Lane on both, and seed 2's second star at month 3.9 comes or goes with any change.

**Read:**

- **The low prices are most of the loss.** `modest` on its own costs $12k to $26k a month at The Exchange, The Boardwalk, High Pines and The Orchard, each by nearly three standard errors or more, and brings stars later at four centers. The good bot only ever raised prices while fewer than one guest in ten was put off by them and reputation was comfortable, so at 1.4 few were put off, and 1.1 can win back at most those while it takes a fifth off every fee. Prices at month 12 are 1.0 to 1.1 after, against 1.2 to 1.4 before.
- **`loan` saves The Orchard's opening.** On its own it loses none of six Orchard games against two, and the mean star month falls from 22.5 to 11.3. Before, the bot borrowed to $45,000 in its first month to build the opening's rooms (entry 39's cliff), so the first paydays went into the red with no loan left; capped at $15,000 on its own asking, the bank's payday loans still have room. Elsewhere it is about even, and High Pines and The Orchard make $5k to $8k a month less, likely the growth it no longer borrows for. The bot's peak loan falls from $42k to $50k a center to $22k to $45k.
- **`early` helps Willow Lane** (+$9.8k a month, within the noise, no game lost against one, stars a little sooner) and costs The Boardwalk and High Pines $7k to $9k a month with a game more lost at each. Not looked into.
- **`brave` is about even:** within the noise at every center, with a game fewer lost at Willow Lane and The Exchange and one more at The Boardwalk. With all four on, the games logged 113 failed emergencies against 64 before, and took on 82 stress outbreaks or more (the bot's notes stop at 150 a game). Calmed as soon as their carriers are seen, the outbreaks rarely last to the end of a day: only 2 were still running at one.
- **Together they cost $10k to $22k a month at every center**, more than `modest` alone at Willow Lane, The Exchange and The Boardwalk, with the third star in 1 Boardwalk game of 6 against 6, and Willow Lane's mean star month doubled. Low prices with a loan held to three steps likely leave the bot little to grow on: its peak loan and its profit both fall. The Orchard's gain is `loan`'s: no game lost, and every third star.
- **On today's code these four habits do not make the bot quicker.** Whatever made the owner's games quick on 0.30.9 to 0.33.3, it is not these habits as the bot can play them now, or not all of them together.

**Still open:**

- **Which flags stay on.** As the brief asked, all four are on for the good bot. Measured, `modest` costs it most, `brave` is even, `loan` saves Orchard games, and `early` is mixed; `BOT_OFF=modest` keeps the other three. The call is the owner's, and should be made on the 72 seeds a center the harness asks for.
- **Why `early` costs The Boardwalk and High Pines.**

## 23 October 2026, after midnight: a Posture Lab that runs itself

Measured with `yarn balance`, the good bot, four years a game, seeds 1 to 72 a center read as two halves of 36, profit a month averaged from month 13 on over the games that reached it, each difference paired seed by seed with its standard error (each half's mean in brackets). `main` at `db228ab` against `feat/posture-lab-machine` at `05a6ba7`, and that branch against itself with `BOT_OFF=lab`.

### 45. The Posture Lab is worth a little, structural conditions cost nothing overall

**Found:** entry 21 left the lab barely paying even in a junior center, its Consultant at $1,700 a month eating what about 10 scans a month brought in. A first draft of this change made Desk Slump structural too: half the guests a new center sees, before it can afford a lab. Over seeds 1 to 6 that took a third off the bot's profit (median $27.9k → $18.8k a month) and lost three more games, and softening the best guess alone barely moved it. Without Desk Slump, every structural condition comes with the first star or later.

**Done** (`src/core/sim/stations.ts`, `src/core/data/conditions.ts`, `src/core/data/rules.ts`, `tests/balance/bot.ts`): the Posture Scanner serves its own line with nobody posted at it, for $250 a month (`upkeep` on the item) and a Caretaker's repairs, and a scan makes the diagnosis certain. Crick of the Neck, Text Neck, Croquet Back and Wipeout are structural: a consultation gets no surer of them than 60% (`STRUCTURAL_SURE`), and without a working scanner the guest is treated on a best guess, 5% less likely to work (`GUESS_PENALTY`). The bot builds the lab once three guests have been treated on a guess, or its Consultants are all junior, and no longer builds it in place of a Consultation Room for a long line (it adds no Consultant now). `lab` is no longer an extra.

**This branch against `main`,** every center:

| Center        | Profit a month                          | Games lost | Third stars |
| ------------- | --------------------------------------- | ---------- | ----------- |
| Willow Lane   | $28.2k → $29.1k (+1.3 ±1.4; +1.5, +1.0) | 3 → 3      | 70 → 67     |
| The Exchange  | $19.8k → $19.5k (−0.3 ±1.3; −1.3, +0.7) | 4 → 5      | 69 → 68     |
| The Boardwalk | $12.9k → $13.8k (+1.0 ±1.0; +2.0, −0.2) | 4 → 5      | 68 → 68     |
| High Pines    | $12.6k → $12.2k (−0.6 ±1.6; +0.8, −2.1) | 13 → 14    | 51 → 55     |
| The Orchard   | $58.9k → $58.1k (−1.1 ±2.3; −2.2, +0.1) | 28 → 29    | 45 → 44     |

**The lab, on against off with the same bot:**

| Center        | Profit a month         | Games lost | Guests on a best guess a month |
| ------------- | ---------------------- | ---------- | ------------------------------ |
| Willow Lane   | +0.6 ±1.0 (+0.1, +1.2) | 5 → 3      | 3.0 → 1.4                      |
| The Exchange  | −2.2 ±1.1 (−3.8, −0.6) | 2 → 5      | 3.8 → 2.2                      |
| The Boardwalk | +1.1 ±0.8 (+1.4, +0.9) | 7 → 5      | 1.2 → 0.8                      |
| High Pines    | +0.5 ±1.2 (+0.8, +0.3) | 18 → 14    | 2.4 → 1.9                      |
| The Orchard   | +0.4 ±1.5 (+1.7, −0.8) | 29 → 29    | 2.7 → 2.6                      |

**Read:** against `main`, no center moves past its noise, and the halves disagree in sign everywhere but Willow Lane. The extra game lost at four centers is one in 72, inside the two or three games the lab on and off alone moves. The lab pays a little where it is built, and its scanner is never the bottleneck: 4 to 7 scans a month in the year after it opens, with shorter waits than without. It does little more because there are few structural guests to scan, 1 to 4 a month, and the bot fits a lab into fewer than half its games (34 of 72 at The Exchange, opened at a median of day 531). The Exchange is the exception, worse with the lab in both halves, and nothing found explains it yet.

**Still open:**

- **The Exchange with the lab.** Worse by $2.2k a month although its structural guests are the most common there.
- **More structural guests,** if the lab is to be a building a center plans for rather than a small extra: more conditions, or a center that features them.

## 22 October 2026, night: High Pines and The Boardwalk, measured again

Measured with `yarn balance`, the good bot, four years a game, seeds 1 to 72 a center read as two halves of 36 (the sample [balance/harness.md](harness.md) "How many seeds a call needs" now asks for), profit a month averaged from month 13 on, each difference paired seed by seed with its standard error. The attribution runs were at `0306b41` and the merge commits named; the land and the fix at `main` `7dd9a55` and `fix/land-and-consults` `e71a963`, with the land's data alone reverted in scratch copies (`git diff 4d566cd 129d4e1 -- src/core/data/centers.ts`, applied in reverse: that merge changed no other game file).

### 44. The land costs High Pines and The Boardwalk, through how the bot grows into it; standing does not

**Found:** after the merges of 21 and 22 October, High Pines made $11.1k a month against 0.31.0's $16.9k (−$5.9k ±1.8k, both halves), with 11 games lost against 9 and 51 third stars against 59. Entry 42 had put it on the new standing weights, from runs that turned out to be the random stream reshuffled.

**Done** (`src/core/sim/advisor.ts`, `src/core/sim/demand.ts`, `src/core/sim/economy.ts`, `tests/balance/bot.ts`):

- **A warning when the consultations are the limit.** The advisor, and a toast the first day it happens, say how many staffed treatment stations draw no guests because every guest sees a Wellness Consultant first and each Consultation Room keeps only 4 stations in guests, and that another Consultation Room (or a Consultant for one standing without) would let them draw, where another treatment room would draw nobody more. The Guests tab said so already, but only to a player who opened it. The Orchard's campaign card says the same of its five-discipline opening, so the card and the first day agree.
- **The bot buys land only for a room worth the plot,** when it knows the room's worth: a growth room only if its expected monthly worth pays the plot back within the style's payback months (borrowing for it only within the borrowing months), and a Recovery Room none. A center's first room of a discipline, and a Consultation Room, still buy the cheapest plot as before. With two or more stations unfed it builds another Consultation Room, turned away or not, and while any are it keeps space for one when growing treatment rooms. The advised bot acts on the new warning.

**What moved High Pines,** paired, seeds 1 to 72 (each half in brackets):

| Change                                                             | High Pines                | The Boardwalk             |
| ------------------------------------------------------------------ | ------------------------- | ------------------------- |
| The more-land merge, `4d566cd` → `129d4e1`                         | −$6.2k ±1.5k (−7.3, −5.1) | −$4.6k ±1.5k (seeds 1–36) |
| Every merge after it, to `0306b41`                                 | +$0.3k ±1.6k              |                           |
| The standing rule of entry 42 against the old one                  | −$1.5k ±1.4k (−4.8, +1.9) |                           |
| The land's data alone, on `main`                                   | −$4.9k ±1.6k (−5.9, −3.8) | −$3.5k ±1.1k (−3.1, −3.9) |
| The land's data alone, with this branch's bot                      | −$6.0k ±1.5k (−7.2, −4.8) | −$3.6k ±1.2k (−3.6, −3.5) |
| The land's data alone, this bot valuing no waiting guests          | −$4.8k ±1.3k (−5.0, −4.7) | −$3.7k ±1.2k (−2.8, −4.6) |
| The woodshed at the first star, at `0306b41`                       | +$2.9k ±1.5k (+5.7, +0.2) |                           |
| No more guests for a higher grade (`GRADE_ARRIVALS` 0), seeds 1–36 | −$1.0k ±2.5k              |                           |

Parts of the standing rule switched off one at a time, seeds 1 to 36: room points −$2.2k ±2.5k, staff points +$2.7k ±2.2k, prestige from every room +$2.9k ±2.2k, no heal points +$0.6k ±2.0k, the top grade expecting ★★ +$0.1k ±0.3k. None is outside two standard errors, and the whole old rule, +$4.8k over seeds 1 to 36, is −$1.9k over 37 to 72.

**This branch against `main`,** every center, seeds 1 to 72:

| Center        | Profit a month              | Games lost | Third stars |
| ------------- | --------------------------- | ---------- | ----------- |
| Willow Lane   | $27.9k → $27.4k (−0.5 ±1.2) | 4 → 3      | 69 → 69     |
| The Exchange  | $19.0k → $19.5k (+0.5 ±1.0) | 4 → 4      | 68 → 68     |
| The Boardwalk | $12.6k → $12.9k (+0.3 ±0.6) | 5 → 4      | 68 → 67     |
| High Pines    | $11.1k → $11.9k (+0.8 ±1.4) | 11 → 13    | 51 → 50     |
| The Orchard   | $33.7k → $36.8k (+3.2 ±2.2) | 29 → 27    | 43 → 45     |

Without the new land, the same bot change is +$2.0k ±1.5k at High Pines and +$0.4k ±0.4k at The Boardwalk.

**Read:**

- **What sank High Pines is the land, as the bot plays it.** Its whole loss against 0.31.0 is the more-land merge, and the land's data alone, with the code otherwise as on `main`, costs it $4.9k a month and The Boardwalk $3.5k, in both halves. The standing weights do not: entry 42's reading came from six and then 36 seeds of a reshuffled stream.
- **How:** with the land, High Pines' good bot runs 7.7 treatment rooms in months 25 to 36 against 5.5, 15.2 staff against 12.5, and buys 2.8 plots a game against 1.7: $8.8k a month more in wages for $6.7k more income and 3 more guests healed. The wider lots let it grow more Massage Suites, which it values at a median $3.2k a month (The Boardwalk $4.2k, a quarter of them over $10k), and the realized return is about $3k of income for $4k of wages a room. Once the lot is full of them, the first Reiki or Qi Gong room no longer fits and buys the $26,000 lift station.
- **Does the fix change what the bot buys?** No. High Pines buys the lift station in 55 games of 72 against 53, The Boardwalk the bathing rooms in 68 against 69, and the treatment rooms do not fall: a growth room the bot values at $3k a month clears a $26,000 plot in a year, and most purchases now are for a discipline's first room, which the gate leaves alone. Leaving the waiting guests out of a room's worth changes nothing either. The bot overvalues a room more than any of these gates catch.
- **Is the land neutral?** Not as the bot plays it, and this entry does not claim it is. The land is optional, so a player who leaves it alone plays the game without it, but the bot that stands in for a good player loses $3.5k to $6.0k a month with it at these two centers under every growth rule tried. Whether a player who grows only into rooms that pay comes out even needs a bot that does, which this is not.
- **Is the warning actionable?** Not measured: the advised bot builds a room only once a line forms, so it is never short of consultations, and its 180 games are the same as on `main` to the month. It earns no third star anywhere and no second at The Exchange, High Pines or The Orchard, with or without the warning.
- **The Orchard** loses 29 of 72 good-bot games on `main` and 27 here, against 4 of 12 on 0.31.0: the opening's cliff of entry 39 stands, at a sample big enough to say so.
- **Guests underwhelmed:** on `main`, 5.5, 10.4 and 22.7 reviews in 100 say so in years 1 to 3 at High Pines, against 6.1, 3.9 and 5.6 under the old standing rule: with heals counting for good, centers reach the top grade, whose guests expect ★★★ rooms. It costs little profit (the top grade expecting ★★ moves it $0.1k), but it is a pressure the game does not explain.

**Still open:**

- **A bot that grows only into rooms that pay**, by the guests one more fed station really adds at the center's pace, less its practitioner's wage, measured with and without the land. Until then, no balance claim about the land.
- **The Orchard's opening:** the owner's choice of entry 39, staging the disciplines or a loan in proportion to the center.
- **Heal points that count for good**, and the underwhelmed reviews they bring at the top grade: a small item of its own, after the release.

## 22 October 2026, later: the really bad trip as an event

Measured with `yarn balance` on `claude/polish-pass-e4b7bd` at `0103b79` (the whole of piece A of [plans/polish-pass.md](../plans/polish-pass.md), with the bot sending someone after every runner) against `main` at `f579737` with only the bot's runner count added (no game code changed, nobody calmed), at The Orchard Estate and the sandbox, the only places ceremonies run, four years a game, the good bot. Seeds 1 to 6, then 0 to 30 for enough runners to count (a seed list ending in a comma also played seed 0). A third run is `0103b79` with the bot's calming switched off, a player who never touches the pill, to measure the cost at the door on its own. Year 4 is months 37 to 48, over the games not lost; a mean star month counts a star never earned as month 48.

### 43. A runner who costs something, a pill to send someone from, and a bot that does

**Found:** [plans/polish-pass.md](../plans/polish-pass.md) A. A runner who found the door cost nothing past the bad trip, the lever was three clicks away in the inspector, whoever was nearest went (a Receptionist with a line at the desk included), it was heard only as the error sound and seen only at each stop, it freaked out guests through walls, and the bot never calmed one, so the Orchard was measured with every runner left to find the door.

**Done** (`src/core/sim/runaways.ts`, `src/core/data/rules.ts`, `src/ui/components/RunnerNotice.tsx`, `src/render/pose.ts`, `src/audio/audio.ts`, `tests/balance/bot.ts`):

- **A stake.** Finding the door costs `RUNAWAY_DOOR_REP` (1.5) reputation on top of the bad trip and leaves a `ran-out` feeling; calmed within `RUNAWAY_SAVE_DAYS` (3) of starting to run, the center earns a point back ("Calmed in time").
- **A pill.** One for each runner at the top of the screen, newest first, with the days to the door, a bar, and **Send** naming who goes; the inspector's button names them too.
- **Who goes.** A free Shaman first, then another practitioner or an Instructor on foot, a Caretaker, one at their post, and a Receptionist only with nobody in line. A Shaman takes `CALM_SHAMAN` (0.5) of the time and Bedside Manner `CALM_BEDSIDE` (0.75).
- **Seen and heard.** A yelp, one of two announcer lines, the stressed bubble the whole run, heads turning, a red ring in any view, and a first-time tip; freaking out only in the same room or corridor, and nobody on a table.
- **The bot** calms every runner the moment anyone can go (`calmRunners`, every persona), and its month log counts `runners`: bad trips, runners, calmed, calmed within three days, days run before the calm, and those who found the door. The report prints them per center ("Really bad trips").

**Result**, seeds 0 to 30 (31 games a center), before → after:

| Center      | Bad trips | Ran (share of bad trips) | Calmed | Within 3 days | Days to calm | Found the door |
| ----------- | --------- | ------------------------ | ------ | ------------- | ------------ | -------------- |
| The Orchard | 96 → 101  | 15 (16%) → 13 (13%)      | 0 → 13 | 0 → 13 (100%) | – → 0.1      | 15 → 0         |
| sandbox     | 65 → 62   | 4 (6%) → 3 (5%)          | 0 → 3  | 0 → 3 (100%)  | – → 0.1      | 4 → 0          |

With the calming off (the cost at the door alone): The Orchard 9 runners of 91 bad trips, the sandbox 5 of 63, all 14 out of the door.

| The Orchard, good bot             | Games lost | Mean star month | Third star | Year-4 profit a month | Cliffs |
| --------------------------------- | ---------- | --------------- | ---------- | --------------------- | ------ |
| entry 42, seeds 1 to 6            | 1 of 6     | 17.1            | 5 of 6     | $56.1k                |        |
| `main` now, seeds 1 to 6          | 2 of 6     | 23.1            | 4 of 6     | $58.4k                |        |
| after, seeds 1 to 6               | 2 of 6     | 23.1            | 4 of 6     | $61.3k                |        |
| `main` now, seeds 0 to 30         | 12 of 31   | 25.4            | 19 of 31   | $63.5k                | 103    |
| after, seeds 0 to 30              | 12 of 31   | 25.4            | 19 of 31   | $61.5k                | 109    |
| after with nobody calmed, 0 to 30 | 12 of 31   | 25.4            | 19 of 31   | $62.6k                | 100    |

**Read:**

- **The rate is as the constant says.** 19 runners of 161 bad trips on `main`, 16 of 163 after and 14 of 154 with nobody calmed: 49 of 478, 10.3%, against `RUNAWAY_CHANCE` 0.1. The Orchard alone runs high on `main` (16%) and the sandbox low (6%); over this few they are one number.
- **The bot calms every runner within three days**, 16 of 16, on average a tenth of a day after they start: the pill sends someone at once, and someone is nearly always free. So the bot never pays at the door, and earns the point back every time.
- **The Orchard's stars do not move.** Seeds 1 to 6 earn every star on the same day as on `main` but seed 2's third, 0.9 months sooner; over 31 games the mean star month, the games lost and the third stars are the same. Against entry 42 the Orchard is a step behind on seeds 1 to 6, but `main` is too, the same amount: seed 5, which survived in entry 42, now goes bankrupt on day 130 on `main` with nobody running, from the merges since.
- **Only games with a runner change at all,** 8 of the Orchard's 31 and 3 of the sandbox's; the rest match `main` month for month, since the roll is drawn aside from the game's stream. Once a runner is calmed rather than left to run, the game takes a different course, and those 8 move both ways: year-4 profit from −$30.8k (seed 30) to +$11.8k (seed 2) a month, −$2.0k on average over the 19 games not lost. The sandbox loses 25 of 31 against 26 (seed 27 survives, seed 17 goes sooner, seed 30 later). The Orchard's reputation cliffs go from 103 to 109, all in those 8 games (seed 14, whose lowest was 30%, falls to 6% in month 30, after its runner); with nobody calmed they are 100, so the cost at the door does not move the cliffs up.
- **No number moved.** The cost at the door bites only a player who leaves a runner ten days, which the bot never does. With nobody calmed, the 14 who found the door cost 1.5 each, and the Orchard's year-4 profit ($62.6k) and cliffs (100) sit inside the spread between `main` and calming. Every lost game in all three runs was warned in its last 10 days.

## 22 October 2026: floor, standing and the rival

Measured with `yarn balance` on `fair-standing` at `5267229` against `main` at `3507545` with the bot's month log extended to record standing, the rival's points and Center of the Year (no game code changed for the "before"), every campaign center, seeds 1 to 6, four years a game, with `BOT_STYLE=good`, `hoarder` and `grower` and `BOT=baseline`; The Orchard and Willow Lane also over seeds 1 to 12 for the good bot. Year 4 is months 37 to 48, over the games not lost; a mean star month counts a star never earned as month 48. The two other floor rules below were measured the same way on the branch before `5267229`, and the ablations with one change switched off in a scratch copy.

Numbered 39 after main's latest; the branch for The Orchard's first paydays (`claude/great-liskov-252582`) also wrote a 39, so one of the two is renumbered when both are merged.

### 42. Floor paid for past what a room's price covers, standing earned by working, and a rival with a ceiling

**Found:** the deep-dive audit's three rule gaps (`docs/audits/deep-dive-audit.md`, "Rule and gameplay gaps", and item 8 of what to change):

- **Prestige was free with floor space.** A room cost its flat price at any size, and its size counted 0.4 prestige points a tile past its smallest, so a 7×7 Massage Suite was prestige 5 for what a 3×3 costs, while growing a room later cost $200 a tile.
- **The rival grew without limit or counterplay:** 80 points plus 0.45 a day, never lowered. On `main` the good bot's rival stands at 708 points by month 48 against 252 to 354 for the center, above it in all 29 games not lost, and Center of the Year is won 35 times in 30 games, nearly all in the first two years.
- **Standing was bought:** 10 points a finished room of any kind and 4 a head plus 2 a rank, so Restrooms and Trainees climbed the grades as well as treatment rooms did.

**Done:**

- **Floor** (`src/core/resize.ts`, `src/core/sim/building.ts`, `src/app/tools/`, `src/ui/components/PlanPanel.tsx`): a room's price covers floor up to one tile more each way than its smallest (`coveredTiles`: 4×4 for a 3×3 room, 5×5 for the Qi Gong Studio's 4×4, 3×4 for a 2×3 Restroom). Every tile past that costs `ROOM_TILE_COST` ($200) when the room is built, by a copy or a template too, and on a resize alike, and comes back at half when given up (`bought`). A resize charges only for floor past what the room already holds, so a room built big before floor was charged keeps that floor for nothing and pays only for more; moving a wall across costs nothing. The drag hint says the price as the room is dragged out ("Massage Suite · 4×5 · $7,800 ($800 of it for floor past 4×4) · release to confirm"), and before the drag the size the price covers ("$7,000 up to 4×4, $200 a tile past that"); the build toast and the blueprint panel say the same. A room's size still counts 0.4 prestige points a tile past its smallest.
- **Standing** (`src/core/data/standing.ts`, `src/core/sim/standing.ts`, `src/core/sim/goals.ts`, the Standing tab): a room counts 16 points, and 4 more a star of its prestige, only while it is in use: a room where staff see guests, with someone on the payroll in its role. Any other room, a Restroom, a Staff Room or a Massage Suite with no therapist, counts 4 and no prestige. Staff count 3 points a rank (3 for a Trainee to 15 for an Expert), and every 5 guests healed add a point, for good. The Standing tab and the grade goal's detail break the points down this way and say what staffing an idle room would add.
- **The rival** (`src/core/sim/rival.ts`, `visits.ts`, `awards.ts`, the Standing tab): it keeps its own points (`rival.points`, set for old saves from the day it opened). It grows 0.6 a day up to a ceiling a quarter above the center's own standing, and shrinks back at the same pace when above it. A VIP leaving delighted takes 5% off it, word of mouth stops its growth and takes 0.15 a day off while it runs, and winning Center of the Year takes 10% off, never below its 80 points at opening. The Standing tab gives its course ("Growing about 18 points a month, up to 25% more than your own standing: 410 points now."), the counterplay and how much has been knocked off it.
- **The bot** (`tests/balance/bot.ts`): the month log records `standing`, `rival` and `coty`. The bot prices a room at the size it builds it (`price`), and every size it builds is within what the price covers. Tried and dropped: building at the smallest before the first month's takings, which lost more Orchard openings, and building the Restroom, Training Room and Posture Lab at their smallest, which moved the rooms after them so that on Willow Lane the bot walled off the one plot a second Massage Suite fits on (seeds 2 and 6 sat on $22,000 for a year with one Massage Suite, refused with "That would block the way").
- **Tests** that fail without each change: the floor a price covers, charged at build, copy and resize alike and refunded at half (`resize.test.ts`, `tools.test.ts`, `room-move.test.ts`, `room-layout.test.ts`); room, idle-room, rank and heal points, the Restroom and Trainee that no longer buy a grade, the rival's growth, ceiling, shrinking back and each setback, and an old save's upgrade (`standing.test.ts`, `standing-ui.test.ts`, `objective-details.test.ts`). The long sound-healing session (`sim.sound.test.ts`) gets a Staff Room: at the new weights its center opens a grade higher, the random draws shift, and on seed 1 its healer's morale fell to 23 and they left before a guest needed the bowls.

**The floor rule, three ways.** As briefed, floor was first charged from the smallest a room can be, at the resize price. That made the campaign much harder, so the rule now in the game is option 2 above. The good bot, seeds 1 to 6: games lost · mean star month · third star · year-4 profit a month. Every rule here has the new standing and rival.

| Center (good bot, seeds 1 to 6) | main                         | $200 a tile from the smallest | $100 a tile from the smallest | **as now: $200 a tile past a tile more each way** |
| ------------------------------- | ---------------------------- | ----------------------------- | ----------------------------- | ------------------------------------------------- |
| Willow Lane                     | 0 lost · 6.6 · 6/6 · $31.4k  | 0 lost · 18.4 · 4/6 · $16.8k  | 0 lost · 11.1 · 5/6 · $18.6k  | 0 lost · 5.9 · 6/6 · $25.8k                       |
| The Exchange                    | 0 lost · 11.7 · 6/6 · $25.9k | 0 lost · 12.1 · 6/6 · $29.2k  | 1 lost · 14.7 · 5/6 · $28.5k  | 0 lost · 10.9 · 6/6 · $27.9k                      |
| The Boardwalk                   | 0 lost · 11.4 · 6/6 · $24.3k | 0 lost · 12.3 · 6/6 · $24.0k  | 0 lost · 15.1 · 5/6 · $14.6k  | 1 lost · 13.8 · 6/6 · $20.4k                      |
| High Pines                      | 0 lost · 13.8 · 5/6 · $26.8k | 2 lost · 20.7 · 2/6 · $25.2k  | 0 lost · 15.3 · 5/6 · $20.9k  | 0 lost · 17.4 · 4/6 · $21.2k                      |
| The Orchard                     | 1 lost · 16.6 · 5/6 · $53.1k | 4 lost · 35.4 · 2/6 · $50.0k  | 4 lost · 30.6 · 2/6 · $61.8k  | 1 lost · 17.1 · 5/6 · $56.1k                      |

The Orchard and Willow Lane over seeds 1 to 12, the good bot, with each change on its own:

| Rule                                                              | The Orchard                                            | Willow Lane                                            |
| ----------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------ |
| main                                                              | 4 of 12 lost, mean star month 23.3, third star 8 of 12 | 0 of 12 lost, mean star month 7.0, third star 12 of 12 |
| standing and rival only, floor as on main                         | 5 of 12 lost, mean star month 25.4, third star 7 of 12 | 0 of 12 lost, mean star month 8.2, third star 12 of 12 |
| $200 a tile from the smallest only, standing and rival as on main | 8 of 12 lost, mean star month 34.7, third star 4 of 12 | 0 of 12 lost, mean star month 16.9, third star 7 of 12 |
| $200 a tile from the smallest, with standing and rival            | 8 of 12 lost, mean star month 34.5, third star 4 of 12 | 1 of 12 lost, mean star month 15.6, third star 8 of 12 |
| **as now**, with standing and rival                               | 4 of 12 lost, mean star month 24.4, third star 8 of 12 | 1 of 12 lost, mean star month 8.5, third star 11 of 12 |

Games lost of 30, by style: main → $200 from the smallest → $100 from the smallest → as now. Good bot 1 → 6 → 5 → 2; hoarder 11 → 13 → 8 → 7; grower 11 → 11 → (not run) → 10; baseline 4 → 2 → (not run) → 4. The hoarder with each change on its own: 7 with standing and the rival only, 16 with the floor from the smallest only (Willow Lane 6 of 6, against 3 on main).

Charging from the smallest made every 4×4 room, the bot's usual size, cost 15% to 20% more ($1,400 on a $7,000 Massage Suite). It doubled the good bot's Orchard losses, whose opening is already at the bank's limit (entry 37), and on Willow Lane it delayed the second Massage Suite until a cheaper room had taken its spot. At $100 a tile the Orchard still lost 4 of 6. Standing and the rival on their own play much as `main` does.

**Result**, as now, the good bot, before → after:

| Center             | Stars at month (seed by seed)                                                                                                                                                                        | Profit a month                      | Months at a loss  | Lowest reputation   | Months below 15% | Bank at the end                           | Bankruptcies                    |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ----------------- | ------------------- | ---------------- | ----------------------------------------- | ------------------------------- |
| Willow Lane        | 1.1/6.0/12.3 · 0.9/3.8/12.4 · 0.7/7.6/11.4 · 0.8/5.7/16.8 · 0.7/3.9/13.7 · 0.8/7.7/12.6 → 1.1/4.9/11.6 · 0.9/3.6/11.9 · 0.8/3.0/12.8 · 0.8/6.9/11.7 · 0.7/3.9/9.9 · 0.8/7.7/12.6                     | $9.2k to $38.9k → $10.0k to $33.8k  | 5 to 18 → 5 to 14 | 22 to 30 → 30       | 0 (unchanged)    | $336.8k to $1404.1k → $363.7k to $1246.9k | none (unchanged)                |
| The Exchange       | 7.9/12.9/16.1 · 2.8/10.9/24.3 · 6.5/11.2/15.6 · 7.0/11.6/17.6 · 6.6/10.3/14.0 · 6.4/11.7/17.8 → 7.8/10.3/15.9 · 4.0/10.6/16.9 · 5.9/9.4/14.4 · 7.0/11.6/16.7 · 6.6/10.3/14.0 · 6.4/11.7/17.6         | $12.2k to $36.7k → $10.7k to $32.7k | 5 to 14 → 7 to 13 | 30 (unchanged)      | 0 (unchanged)    | $380.0k to $1310.6k → $424.5k to $1160.7k | none (unchanged)                |
| The Boardwalk      | 5.7/11.8/22.7 · 4.8/9.6/14.2 · 4.8/9.7/16.5 · 4.5/8.5/14.9 · 4.8/8.6/16.4 · 4.6/19.5/24.3 → 6.8/22.8/28.2 · 4.8/14.7/19.4 · 5.9/8.6/19.9 · 4.5/8.5/14.9 · 4.8/13.7/17.6 · 4.6/19.5/28.4              | $6.4k to $28.2k → −$8.4k to $29.6k  | 5 to 15 → 5 to 17 | 30 → 17 to 30       | 0 (unchanged)    | $231.6k to $1023.2k → −$21.2k to $1083.0k | none → seed 5 day 671           |
| High Pines         | 4.4/8.3/14.6 · 4.0/19.4/31.0 · 5.2/8.8/16.4 · 5.7/12.9/– · 3.9/6.7/11.8 · 7.7/13.9/26.2 → 4.4/10.6/19.3 · 3.9/7.3/18.6 · 9.0/–/– · 5.7/12.9/– · 3.9/6.7/16.1 · 7.7/11.5/32.0                         | $11.4k to $33.5k → $0.0k to $37.8k  | 4 to 15 → 4 to 27 | 20 to 30 → 6 to 30  | 0 → 0 to 1       | $419.0k to $1328.2k → $3.1k to $1492.9k   | none (unchanged)                |
| The Orchard Estate | 4.2/11.9/18.1 · 4.6/9.6/15.5 · 5.3/9.9/15.7 · 4.9/8.9/13.8 · bankrupt day 100/–/– · 4.9/9.7/17.9 → 4.5/15.7/20.4 · 4.7/9.4/14.9 · bankrupt day 161/–/– · 7.5/11.6/16.7 · 5.0/9.3/14.8 · 4.0/9.7/15.8 | $37.4k to $61.7k → $41.1k to $64.0k | 3 to 6 → 4 to 10  | 19 to 30 → 21 to 30 | 0 (unchanged)    | −$9.6k to $2234.5k → −$16.0k to $2223.6k  | seed 5 day 100 → seed 3 day 161 |

| Center        | Center of the Year a game | Standing / rival at months 12, 24, 36, 48                               | Games lost |
| ------------- | ------------------------- | ----------------------------------------------------------------------- | ---------- |
| Willow Lane   | 0.5 → 0.3                 | 225/222, 251/384, 251/546, 252/708 → 221/231, 287/352, 321/396, 354/429 | 0 → 0      |
| The Exchange  | 1.2 → 2.2                 | 253/222, 306/384, 304/546, 316/708 → 281/211, 378/351, 428/431, 495/525 | 0 → 0      |
| The Boardwalk | 1.2 → 2.0                 | 295/222, 355/384, 353/546, 335/708 → 296/211, 402/344, 454/472, 493/586 | 0 → 1      |
| High Pines    | 1.3 → 1.7                 | 342/222, 360/384, 356/546, 354/708 → 336/223, 392/357, 431/459, 488/604 | 0 → 0      |
| The Orchard   | 2.0 → 3.2                 | 454/222, 470/384, 474/546 → 467/226, 557/338, 610/424, 617/469          | 1 → 1      |

Games lost, as now against `main`, seed by seed: the good bot loses The Boardwalk seed 5 (day 671) and The Orchard seed 3 (day 161), and no longer The Orchard seed 5; over seeds 7 to 12 also Willow Lane seed 12 (day 281). The hoarder loses none it did not lose before, and no longer The Exchange seed 6, High Pines seed 6 and The Orchard seeds 1 and 5. The grower loses The Boardwalk seed 1, High Pines seed 4 and The Orchard seed 1, and no longer The Boardwalk seed 3, The Exchange seed 1 and High Pines seeds 1 and 5. The baseline swaps Willow Lane seed 3 for seed 5.

**Read:**

- **Corrected by [entry 44](#44-the-land-costs-high-pines-and-the-boardwalk-through-how-the-bot-grows-into-it-standing-does-not):** the falls at High Pines and The Boardwalk below are not the standing rule's. Over 72 seeds High Pines makes $1.5k ±1.4k a month less under it than under the old rule (−$4.8k over seeds 1 to 36, +$1.9k over 37 to 72), and no part of it switched off alone moves High Pines by more than two standard errors; what lowered both centers is the land of entry 40. The rise in underwhelmed reviews at the top grade is the standing rule's, and real.

- **Stars no sooner:** the good bot's mean star month is 5.9 against 6.6 at Willow Lane and 10.9 against 11.7 at The Exchange, and later elsewhere: The Boardwalk 13.8 against 11.4, High Pines 17.4 against 13.8, The Orchard 17.1 against 16.6. Over seeds 1 to 12, Willow Lane 8.5 against 7.0 and The Orchard 24.4 against 23.3.
- **The exploit is gone, and ordinary rooms cost what they did:** past 4×4 a Massage Suite pays $200 a tile for its 0.4 prestige points, $1,500 a star, against $650 for a statue's 4 points. Every size the bot builds is within what the price covers, so its rooms cost what they cost on `main`. Growing a room to 4×4 is now free where it cost $1,400 on `main`.
- **Games lost:** 27 of 120 on `main`, 23 now. The good bot loses 2 of 30 against 1, and over seeds 1 to 12, 4 of 12 Orchard games as on `main` and 1 of 12 Willow Lane games against none (seed 12, day 281: wages into the red on day 270, then the overdraft called in). Every lost game of every style was warned in its last 10 days; none is marked ⚠.
- **The rival can be caught:** at month 48 it stands at 429 to 604 against 708 on `main`, and below the center in 6 of the good bot's 28 games not lost (none of 29 on `main`). Center of the Year is won 52 times in 30 games against 35, and in every year: 24, 16, 10 and 2 wins in years 1 to 4, against 26, 9, 0 and 0 on `main`. The grower, with word of mouth always running, wins it 1.2 to 3.5 times a game against 0.2 to 2.
- **Standing:** by month 12 it is about where it was (221 to 467 against 225 to 454), and it keeps climbing with the guests healed: 354 to 617 at month 48 against 252 to 354. A fresh Orchard's opening build, 9 rooms of which 5 are in use, stands at 170 to 202 in its first month against about 190 on `main`, around the 180 of a Wellness Center: 5 of 12 games are a Wellness Center in month 1 (all 12 on `main`), 9 of 12 by month 2.
- **Year-4 profit** is lower at Willow Lane ($25.8k against $31.4k), The Boardwalk ($20.4k against $24.3k) and High Pines ($21.2k against $26.8k), and higher at The Exchange and The Orchard.
- **Reputation cliffs rise for the good bot, from 84 to 108** (High Pines 24 → 36, The Boardwalk 16 → 25, Willow Lane 7 → 13; The Orchard 27 → 24), and fall for the other styles (hoarder 78 → 73, grower 86 → 66, baseline 29 → 28). With heals counting for good, the good bot's centers reach the top grade, Healing Institute, where guests expect ★★★ treatment rooms: 236 months there against 30 on `main`. A month there is as likely to hold a cliff as before (13.6% against 13.3%), and at every other grade too (8.9% at grade 3 both ways), so the cliffs come from more time at the top grade, not from any grade getting harsher. Left for the owner: whether heals should count only over the last year or so, so standing measures a center working now rather than one that has worked long enough.

## 22 October 2026: machines that draw guests of their own

Measured with `yarn balance` on `machine-demand` at `d2a1cba` (the rule is the same from `198a456`), every campaign center, seeds 1 to 6, four years a game, good bot. Year 4 is months 37 to 48, over the games not lost. "Paid back" counts days from the day the machine was built to the day its fees first covered its room and its running costs so far.

### 41. A signature machine's two ailments come only for it, at a pace of their own

**Found:** entries 37 and 38. A machine's ailments were a share of the guests its discipline already drew, and its chair counted as one staffed station, so the Kneadmaster healed about 2 guests a month against a Massage Suite's 6 or 7, and the one game with one made $8.1k a month less.

**Done** (`src/core/data/rules.ts`, `src/core/sim/demand.ts`, `src/core/sim/guests.ts`, the Guests tab, the date's hover, the machine room's inspector):

- **Its own guests.** A signature machine's ailments are no longer among the conditions the tables' guests come with. Each machine that stands (not broken, overloaded, stopped by a mishap or in a blueprint) draws them on its own: `MACHINE_DRAW` (0.35) of what the center draws at its reputation, times the season or rush hour, the grade, the rival, a mishap and the difficulty, times its room's pull as a finest room's (`roomPull`: prestige and quiet), times `UNTRAINED_PULL` while nobody on the payroll knows its technique, times the center's favourites and any campaign for its ailments, and less for a line of its own. `arrivalPace` adds these to the tables' pace, and `admitGuests` rolls which kind of guest comes through the door only while a machine draws anyone, so a game without one rolls as it always has.
- **A practitioner of its own, first.** `capacity` no longer counts a signature machine as a treatment station. A working machine takes a practitioner of its discipline before the tables do (`MachineCapacity`: standing, paid, staffed), so one built without hiring for it leaves a table standing instead. Tried first and not kept: the tables first. The bot hires one practitioner a room, so at High Pines its second Sound Healer went to the mats one healer cannot play for, and the Alphorn never had anyone (0 healed in 28 months on seed 2).
- **Seen in a Consultation Room first.** A machine's guests count against the four stations each Consultation Room keeps in guests, before the tables (`fed`); it lets 2 more guests in at once when it draws, like a station.
- **Its own line puts guests off sooner.** `MACHINE_LINE`: nobody minds one waiting, then a quarter fewer for each one more, at most three quarters. With a discipline's rule (three a practitioner), the Cider Press's guests stormed out 43 times against 94 healed at The Orchard (seed 1), and the tables' 22 times in 846.
- **Said where the pace is.** The Guests tab and the date's hover: "About 16 new guests a month. 11 come for the treatment stations: … 5 come for the Kneadmaster 9000’s own ailments: 35% of the center’s pace for the one with a Massage Therapist of its own to run it, ×1.43 for the Kneadmaster Suite." The Guests tab also says when a machine draws nobody and why (nobody to run it, its practitioner away, no consultation to spare), and that an idle table's practitioner went to a machine. The machine room's inspector gives its pull, as a discipline's room does.
- **A bot extra for land:** `BOT_ON=land` gives each center one plot more at the second star, $12,000, sized for its machine room (`MACHINE_LOTS` in `tests/balance/bot.ts`); with `machines` the bot keeps it, and the corridor in it, for the machine room until that is built. A stand-in for the plots the land session is adding (finding 1 in [plans/next-pass.md](../plans/next-pass.md)). The Boardwalk's has a door of its own: without one the bot's rooms along the east wall left it reached only through the ice-cream parlor, a 66-tile walk that let the Aura Wash heal 3 guests in 15 months.
- No price, fee or running cost changed.

**Games without a machine are unchanged.** The default bot (no flag) matches `main` on all 30 games, every month. With `BOT_ON=machines` alone, 29 of 30 games match entry 38 to the month; the 30th is Willow Lane seed 3, the one game that fits a machine on today's lots.

**On today's lots** (`BOT_ON=machines` against no flag): the bot still fits a machine in 1 game of 30, because the lots are full by the second star (entry 38). That Kneadmaster heals 4.6 guests a month (2.0 in entry 38) and pays back 74 days after it was built (248). The game makes $29.0k a month in year 4 against $37.2k, as before: its chair stands where the bot's third Massage Suite would.

**Calibration** (`BOT_ON=land,machines` against `BOT_ON=land`, the same plot in both games; over the games where a machine was built):

| Rule                                                          | Built | Healed a month: all (Kneadmaster, Pin Press, Aura Wash, Alphorn, Cider) | Paid back | Year-4 profit, with against without | Turned away a month | Reputation |
| ------------------------------------------------------------- | ----- | ----------------------------------------------------------------------- | --------- | ----------------------------------- | ------------------- | ---------- |
| 0.45, the tables first (the Boardwalk plot without its door)  | 16    | 3.9 (5.2, 5.9, 2.7, 1.8, 3.2)                                           | 13 of 16  | −$5.7k                              | +8.4                | −3.9       |
| 0.25, the tables first                                        | 15    | 2.6 (3.4, 4.0, 1.8, 0.9, 2.3)                                           | 12 of 15  | −$6.7k                              | +2.5                | −5.3       |
| 0.35, the machine first                                       | 15    | 4.0 (4.5, 5.7, 3.4, 2.8, 3.3)                                           | 15 of 15  | −$7.1k                              | +6.2                | −7.6       |
| and seen in a Consultation Room first                         | 15    | 4.0 (4.5, 5.7, 3.4, 2.6, 3.3)                                           | 14 of 15  | −$6.0k                              | +6.8                | −5.1       |
| and its own line puts guests off sooner                       | 15    | 3.8 (4.1, 5.6, 2.1, 3.0, 3.1)                                           | 14 of 15  | −$8.1k                              | +5.6                | −5.0       |
| **as now: and the bot keeps corridor items off the plot too** | 19    | 4.4 (5.7, 6.6, 3.5, 3.8, 3.0)                                           | 19 of 19  | −$1.9k (median −$0.1k, 8 of 18 up)  | +5.4                | −3.6       |

Until the last row, the bot bought the plot and then could not fit the machine on it in 14 games, because benches, plants and radiators had gone into its corridor; those games' differences are the plot standing empty. With the plot kept whole, the bot builds 19 machines in 29 games. A game in which the bot built no machine moves by −$6.1k to +$22.4k a month all the same (the reserved plot changes what it builds), so one game's difference is mostly noise.

**Result** (as now, `BOT_ON=land,machines` against `BOT_ON=land`):

| Machine (center)           | Built | Healed a month, seed by seed | Paid back, days after building | Earned while a guest is inside / room and running costs | Year-4 profit, with against without, seed by seed                             |
| -------------------------- | ----- | ---------------------------- | ------------------------------ | ------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Kneadmaster (Willow Lane)  | 3 / 6 | 5.6, 4.3, 7.4                | 89, 92, 51                     | $1341.3k / $201.0k                                      | $45.1k / $38.5k · $29.3k / $37.3k · $53.8k / $31.1k: +$7.1k                   |
| Pin Press (The Exchange)   | 3 / 6 | 6.7, 6.6, 6.4                | 127, 104, 60                   | $1620.9k / $254.0k                                      | $41.0k / $37.0k · $39.2k / $33.8k · $35.3k / $42.6k: +$0.7k                   |
| Aura Wash (The Boardwalk)  | 6 / 6 | 2.3, 4.0, 2.0, 3.9, 3.7, 3.2 | 292, 154, 146, 140, 139, 207   | $1451.8k / $514.0k                                      | five games −$7.9k to +$5.1k: −$1.5k; seed 3 bankrupt on day 1001              |
| Great Alphorn (High Pines) | 3 / 6 | 3.8, 3.8, 3.9                | 268, 131, 121                  | $1003.1k / $351.0k                                      | $29.9k / $28.8k · $24.1k / $12.0k · $7.3k / $7.5k: +$4.4k                     |
| Cider Press (The Orchard)  | 4 / 5 | 2.7, 2.7, 3.1, 3.6           | 221, 156, 283, 150             | $1522.4k / $580.0k                                      | $32.1k / $39.0k · $58.8k / $45.3k · $4.3k / $37.5k · −$1.9k / $35.5k: −$16.0k |

Year-4 profit a month by center, with against without: Willow Lane $32.2k against $28.9k, The Exchange $30.6k against $31.4k, The Boardwalk $18.6k against $18.9k (five games against six), High Pines $24.8k against $23.0k, The Orchard $30.1k against $38.4k. The first two stars come on the same days in every game (the machines come after them).

**Read:**

- **Does a machine room now draw guests of its own?** Yes. Every machine built pays back on its own books, 19 of 19, from 51 to 292 days after it was built. The Kneadmaster heals 5.7 guests a month (2 in entry 38) and the Pin Press 6.6, about what a Massage Suite heals. The slower machines heal 3 to 4.
- **Is it worth building?** Where it has a plot of its own and the center is sound, about as much as the tables the same plot would hold. Willow Lane and High Pines make more with one, The Exchange and The Boardwalk the same, and the 18 games split 8 up and 10 down with a median of −$0.1k a month. It is not a free win: its running cost, its operator's wage and the guests its line turns away come out of what it earns.
- **The Orchard loses with the Cider Press.** Two of its four games lose $33k to $37k a month. Seed 3 takes on 3.5 more staff ($12.9k a month in wages) and its reputation falls 34 points; seed 6's reputation falls 12. The Cider Press heals 3 a month there at about $4.6k a guest. This is the Orchard's own instability (finding 2 in [plans/next-pass.md](../plans/next-pass.md)) as much as the machine, and The Orchard's game without a machine (seed 4) moves $22k a month by the plot alone.
- **The one new bankruptcy** is The Boardwalk seed 3, on day 1001, against a game that survives without the machine: the Aura Wash, which a storm stops, healed 2 a month there, and the loss was warned 18 times in its last 30 days.
- **Prices and running costs:** not changed. On its own books every machine earns 2.6 to 6.7 times its room and running costs, so the running costs are not what decides a center's month. Its practitioner's wage and the guests it turns away do.

**Still open:**

- **Land.** On today's lots the bot fits a machine in 1 game of 30. The numbers above are for a plot given by hand; the plots the land session adds should be measured the same way, with `BOT_ON=machines` against no flag.
- **The building's limit.** With a machine, 5 more guests a month are turned away: its guests come into a center already at its limit, and it lets in only 2 more at once.
- **Slow machines.** The Aura Wash, the Alphorn and the Cider Press heal 3 to 4 a month, about half the Kneadmaster's and the Pin Press's; a shorter session would bring them level, and is a price for the owner to set.

## 22 October 2026, after midnight: more land

Measured with `yarn balance` on `main` at `7ac9574` (before) and `feat/more-land` at `19da076` (after), every campaign center, seeds 1 to 6, four years a game, the good bot with and without `BOT_ON=machines`. Year 4 is months 37 to 48 and "profit a month" months 13 to 48, over the games not lost; a mean star month counts a star never earned as month 48. The bot changed with the land (below), so the land alone is also measured against `main` with the same bot (`main` plus the bot commits).

### 40. Every lot wider, a building of its own for the machine room at the second star, and more at the third

**Found:** entries 37 and 38, and the owner's call of 21 October that the lots are too small. In 28 of 30 games a new treatment room stopped fitting 3 to 23 months before the second star, in 23 of them with every plot bought, so the machines, which open at that star, could only stand where a table had been.

**Done** (`src/core/data/centers.ts`, `tests/unit/land.test.ts`; [plans/land.md](../plans/land.md) "Decisions to make" has the plots):

- Every lot grows east, which moves no tile of an old save: Willow Lane 32 → 40 tiles, The Exchange and High Pines 36 → 44, The Boardwalk and The Orchard Estate 40 → 48, the sandbox 44 → 56.
- Two plots more for each center, the sandbox too. At the second star there is a building of its own with a door and a path from the pavement, big enough for the center's machine room beside the tables: Willow Lane's old bakery, The Exchange's bank on the corner, The Boardwalk's bathing rooms, High Pines' old lift station, The Orchard's stable block, and the sandbox's old cinema, which takes any of its five machines. At the third star there is a plot joined to the building, out the back or beside it. They cost $260 to $375 a tile, more than the plots before them ($200 to $375), at $13,000 to $36,000 each.
- Tested: each center's machine room is built at its smallest, with its machine, wholly on its plot in a building grown into every plot, and the plot has a door of its own. Every plot is bought in the order they open, on a new lot and over an old save's strips, and every entrance can still be reached after each.
- First tried with the second-star plots joined to the building, as most plots are, and kept none of them: the bot buys a back plot and then cannot use it. Its rooms line the wall the plot shares with the building, the plot has no other way in, and nothing fits there, not a table and not the machine. In one Orchard game the bot bought the cider barn and the apple store at its second star, and five months later the Cider Press would not fit on either. A building of its own cannot be walled off that way.
- A building standing apart now has the full 14 tiles of pavement past its door before people arrive or leave, where the lot's edge cut that short before, so walks along the pavement are a few tiles longer once one is built. One unit test's walk went from under 1.5 days to under 1.75 (`tests/unit/classes.route.test.ts`).

**The bot** (`tests/balance/bot.ts`), because the land showed two things it did wrong:

- It valued another treatment room for the guests a staffed station more draws and lets in, even while its Consultation Rooms already kept fewer stations in guests than were staffed, when the station draws nobody. With the room to build, The Orchard went from 8.4 staffed stations to 10.9 in year 4 with the same limit on guests, and its year-4 profit fell from $53.1k to $30.4k a month. Now such a room is worth only the guests already waiting for it, and the bot builds a Consultation Room when 3 or more guests were turned away while the consultations held stations back, as the Guests tab tells a player to. On `main` this changes only High Pines and The Orchard, and saves the Orchard game lost on day 100 (seed 5).
- With `BOT_ON=machines`, from the second star the bot has earned (not merely the star the rooms open at, which at The Orchard is the day it opens) until the machine room stands, nothing it builds may take the last spot the room could go in. A spot counts only where the room, a door that is reached, and its machine really fit, tried as a plan and taken down again. Without the reservation the bot bought each machine building at its star and filled it with tables months before it could afford the machine.
- Without `BOT_ON=machines` the bot plays the land exactly as it would any plot: the default run at `19da076` matches the one before the machine reservations, game for game.

**Result,** the good bot without machines, `main` → this branch:

| Center             | Stars at month (seed by seed)                                                                                                                                                                  | Profit a month                      | Months at a loss  | Lowest reputation    | Months below 15% | Bank at the end                           | Bankruptcies           |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ----------------- | -------------------- | ---------------- | ----------------------------------------- | ---------------------- |
| Willow Lane        | 1.1/6.0/12.3 · 0.9/3.8/12.4 · 0.7/7.6/11.4 · 0.8/5.7/16.8 · 0.7/3.9/13.7 · 0.8/7.7/12.6 (unchanged)                                                                                            | $9.2k to $38.9k → $23.6k to $41.1k  | 5 to 18 → 6 to 11 | 22 to 30 (unchanged) | 0 (unchanged)    | $336.8k to $1404.1k → $854.8k to $1494.4k | none (unchanged)       |
| The Exchange       | 7.9/12.9/16.1 · 2.8/10.9/24.3 · 6.5/11.2/15.6 · 7.0/11.6/17.6 · 6.6/10.3/14.0 · 6.4/11.7/17.8 → 7.9/12.9/19.0 · 2.8/10.9/24.3 · 6.5/11.2/17.8 · 7.0/11.6/17.9 · 6.6/10.3/19.6 · 6.4/11.7/20.8  | $12.2k to $36.7k → $10.0k to $26.9k | 5 to 14 → 7 to 16 | 30 → 25 to 30        | 0 (unchanged)    | $380.0k to $1310.6k → $328.0k to $1029.4k | none (unchanged)       |
| The Boardwalk      | 5.7/11.8/22.7 · 4.8/9.6/14.2 · 4.8/9.7/16.5 · 4.5/8.5/14.9 · 4.8/8.6/16.4 · 4.6/19.5/24.3 → 5.7/11.8/25.1 · 4.8/9.6/18.2 · 4.8/9.7/19.6 · 4.5/8.5/14.8 · 4.8/8.6/19.0 · 4.6/19.5/24.9          | $6.4k to $28.2k → −$4.0k to $32.9k  | 5 to 15 → 5 to 18 | 30 → 8 to 30         | 0 → 0 to 1       | $231.6k to $1023.2k → −$42.3k to $1186.0k | none → seed 1 day 1001 |
| High Pines         | 4.4/8.3/14.6 · 4.0/19.4/31.0 · 5.2/8.8/16.4 · 5.7/12.9/– · 3.9/6.7/11.8 · 7.7/13.9/26.2 → 4.4/8.3/17.4 · 4.0/11.6/17.0 · 5.2/8.8/26.7 · 5.7/10.6/22.8 · 3.9/8.8/15.5 · 7.7/13.9/24.7           | $11.4k to $33.5k → $10.9k to $29.1k | 4 to 15 → 8 to 15 | 20 to 30 → 30        | 0 (unchanged)    | $419.0k to $1328.2k → $335.9k to $967.6k  | none (unchanged)       |
| The Orchard Estate | 4.2/11.9/18.1 · 4.6/9.6/15.5 · 5.3/9.9/15.7 · 4.9/8.9/13.8 · bankrupt day 100/–/– · 4.9/9.7/17.9 → 4.2/12.8/23.0 · 4.6/10.5/15.7 · 5.3/9.6/15.0 · 4.9/10.5/17.9 · 3.5/12.5/18.7 · 4.9/9.8/16.4 | $37.4k to $61.7k → $22.2k to $67.6k | 3 to 6 → 6 to 11  | 19 to 30 (unchanged) | 0 (unchanged)    | −$9.6k to $2234.5k → $732.5k to $2371.3k  | seed 5 day 100 → none  |

| Center        | Year-4 profit a month: main · main with the bot changes · this branch | Staffed stations, year 4 | Wait, days  | Turned away a month, year 2 | Mean star month | Plots bought |
| ------------- | --------------------------------------------------------------------- | ------------------------ | ----------- | --------------------------- | --------------- | ------------ |
| Willow Lane   | $31.4k · $31.4k · $38.8k                                              | 3.0 → 4.1                | 8.8 → 7.3   | 4.9 → 6.6                   | 6.6 → 6.6       | 3.0 → 5.0    |
| The Exchange  | $25.9k · $25.9k · $28.3k                                              | 4.2 → 6.8                | 8.5 → 6.7   | 5.6 → 6.2                   | 11.7 → 12.5     | 2.0 → 4.0    |
| The Boardwalk | $24.3k · $24.3k · $19.3k (5 games)                                    | 5.4 → 6.4                | 7.3 → 7.3   | 8.7 → 8.9                   | 11.4 → 12.1     | 2.0 → 3.8    |
| High Pines    | $26.8k · $28.0k · $23.8k                                              | 7.6 → 9.7                | 10.9 → 10.0 | 5.0 → 3.5                   | 13.8 → 12.1     | 1.8 → 3.7    |
| The Orchard   | $53.1k (5 games) · $49.2k · $53.0k                                    | 8.4 → 10.1               | 11.7 → 11.6 | 5.6 → 7.3                   | 16.6 → 11.1     | 1.7 → 4.0    |

**The machines** (`BOT_ON=machines`), entry 38's figures → this branch:

| Machine (center)           | Built in   | Healed   | Earned while a guest is inside | Room and running costs | Paid back on its own books              |
| -------------------------- | ---------- | -------- | ------------------------------ | ---------------------- | --------------------------------------- |
| Kneadmaster (Willow Lane)  | 1 → 4 of 6 | 74 → 231 | $204.2k → $605.7k              | $70.5k → $223.5k       | 1 of 1, day 601 → 4 of 4, days 482–1279 |
| Pin Press (The Exchange)   | 0 → 3 of 6 | – → 93   | – → $269.4k                    | – → $208.0k            | – → 3 of 3, days 1003–1317              |
| Aura Wash (The Boardwalk)  | 0 → 1 of 5 | – → 5    | – → $15.9k                     | – → $56.5k             | – → none (built on day 1041)            |
| Great Alphorn (High Pines) | 0 → 0 of 6 | –        | –                              | –                      | –                                       |
| Cider Press (The Orchard)  | 0 → 0 of 6 | –        | –                              | –                      | –                                       |

Year-4 profit a month with the machines against the same land without them: Willow Lane $27.1k against $38.8k, The Exchange $25.5k against $28.3k, The Boardwalk $21.4k against $19.3k, High Pines $26.6k against $23.8k, The Orchard $51.7k against $53.0k. Seed by seed, the four Willow Lane games with a Kneadmaster make $20.8k a month against $37.3k without, and the three Exchange games with a Pin Press make $23.6k against $26.9k. Both figures include the months the bot held space for a machine it could not yet afford.

**Read:**

- **Corrected by [entry 44](#44-the-land-costs-high-pines-and-the-boardwalk-through-how-the-bot-grows-into-it-standing-does-not):** over 72 seeds a center, the land's data alone costs High Pines $4.9k ±1.6k a month and The Boardwalk $3.5k ±1.1k as `main`'s bot plays it, in both halves of the seeds, and the bot's land gate of entry 44 does not change it. The six-seed figures below (−$3.0k and −$5.0k) had the direction right and the size inside the noise; "Is it easier? No" stands, and the land is not neutral as the bot plays it.

- **Is there room to grow now?** Yes. The bot bought every second-star plot in all 30 games, a median of a month after the star, and 27 of the 30 third-star plots within six weeks of theirs. Every center runs more staffed stations in year 4 (1.0 to 2.6 more), and waits are as short or shorter everywhere.
- **Is it easier?** No. Year-4 profit rises at Willow Lane (+$7.4k a month) and The Exchange (+$2.4k), falls at The Boardwalk (−$5.0k) and High Pines (−$3.0k), and holds at The Orchard. Third stars come later, the land and the bigger payroll taking the money the third star's goals ask for: The Exchange's by up to 5.6 months in five seeds, The Boardwalk's by 2.4 to 4.0 months in four, High Pines' by 2.8 to 10.3 months in three (sooner in two, and earned at month 22.8 in the seed that never earned it on `main`). The Boardwalk loses seed 1 on day 1001, a game `main` survives: the bot bought the bathing rooms ($17,500) a month after its second star and was in the red from month 14 to 23, then bought the arcade ($16,000) at its third star and was in the red from month 28 to the end. 20 warnings came in its last 30 days, so the loss was warned. Reputation cliffs rise from 84 to 116 across the 30 games, the most at High Pines and The Orchard: bigger centers with more guests at once have more to lose in a bad month. The lowest reputation in any game is 8 (Boardwalk seed 1), against 19 before.
- **Does the bot now build machines?** Sometimes: 8 of 29 games against 1, and at Willow Lane and The Exchange in most games. The Great Alphorn and the Cider Press were never built. In those games the machine buildings were bought at the star and reserved, but by the time the bot could afford the room ($28,000 and $32,000, with a reserve of a month's wages and three months' running costs) nothing fitted. On an empty lift station or stable block the bot builds both rooms, so the most likely cause is the bot's free-standing items (benches, plants, vending machines), which it places along any corridor without the reservation. Not confirmed.
- **Do the machines pay?** On their own books, yes: every Kneadmaster and Pin Press built paid back its room and running costs, the Pin Press only in the game's third or fourth year. The center, no: games with a Kneadmaster made $16.5k a month less, and games with a Pin Press $3.3k less. Entry 38's finding stands. A machine draws no guests of its own, so it heals 2 or 3 guests a month (the four Kneadmasters, 231 between them in 109 machine-months) while holding a practitioner and the floor a table would use. Land was not what held the machines back; demand is, and that is [plans/next-pass.md](../plans/next-pass.md) "Open findings" 4.

**Still open:**

- The bot's free-standing items against a machine room's reservation, before the Great Alphorn and the Cider Press can be measured.
- The third-star plots join the building through one wall, as every plot before this pass did, so a player who lines that wall with rooms cuts them off. The guide says to leave a corridor; nothing in the game warns of it yet.

## 21 October 2026, late night: the first paydays in sight

Measured with `yarn balance` on `main` at `7ac9574` (before) and on this branch (after), The Orchard Estate, seeds 1 to 12, four years a game: the good bot, `BOT=advised`, and the good bot with the new `BOT_ON=opening`; and `BOT=advised` at every campaign center, seeds 1 to 3. Year 4 is months 37 to 48, over the games not lost. No game rule or price changed.

### 39. The first payday shown before the build, and advice against what the paydays cannot carry

**Found:** [plans/next-pass.md](../plans/next-pass.md) open finding 2 and entry 37. The good bot loses 4 of 12 Orchard games the same way: the day-0 build (7 staff, $94,000 spent) takes the loan to $50,000 by month 2, a third month heals 0 to 2 guests while practitioners are away on courses and house calls, and the bank calls the overdraft in on day 100. Every loss was warned, but nothing said before the build that the opening the blurb offers costs more than the start and the loan can carry, and the advisor weighed only the next payday, not what is left behind it, so with that payday covered it went on to its training and growth nudges. After the build, every one of the 12 games has less than a month's wages in the bank and the loan left (seed 5: $1,465 and $10,000 against $14,200 a month).

**Done** (`src/core/sim/economy.ts`, `src/core/sim/advisor.ts`, `src/core/data/rules.ts`, the campaign card, the Payroll tab, `tests/balance/bot.ts`):

- **On each campaign card**, under the blurb, what the opening costs: "Opening with a Receptionist, a Wellness Consultant and a practitioner for each of its 5 disciplines costs $10,750 a month in wages at a Trainee's pay and $48,000 for their rooms, against $45,000 to start and up to $50,000 from the bank: $47,000 left for the furniture and every payday until the takings cover the wages." (`openingCosts`, `openingLine`; a discipline counts when its room is open from the start.)
- **`paydaysInHand`**: a month's wages for the staff on the books (and the machines' running costs) against the bank and the loan left, and how many months that pays with nothing coming in. The Payroll tab shows it as "Months of wages in hand", and a line under the verdict through the first three paydays (`FIRST_PAYDAYS`), before the takings have a record, and whenever there is less than a month in hand, when the verdict turns amber: "The first paydays: $6,000 a month in wages, against $500 in the bank and $5,000 the bank will still lend: less than one payday in hand, with nothing coming in. 3 paydays come before the takings have a record, so what is hired, built or sent away before then is paid for out of this. That is past what the paydays can carry: …"
- **The advisor** (`inHandAdvice`), with less than a month's wages in hand and bankruptcy on, above the payday nudge and every growth nudge: "Hire nobody more, send nobody on a course and turn house calls down until there is a month's wages in hand, $500 more: $6,000 a month in wages, against … Each adds a wage or leaves a station empty for days, and once the loan is used up a month that heals few guests has the bank call the overdraft in. 3 of the first paydays are still to come, before the takings have a record." Not while the bank is calling the overdraft in, nor when the next payday is short past what the bank lends: the payday nudge says that, with the cut.
- **The bot:** the advised persona, and the good bot with the new extra `BOT_ON=opening`, do as that nudge says while it shows: no hire but into a role with nobody in it, no course, house calls turned down. The persona's other matches are unchanged; no toast it reads changed.
- **Tried and not kept:** the advice only through the first three paydays (below), and the hold taken from the numbers rather than from the advisor's words.

**Result,** The Orchard, seeds 1 to 12:

| Bot                                               | Bankrupt (seed at day) before → after                                   | Year-4 profit a month |
| ------------------------------------------------- | ----------------------------------------------------------------------- | --------------------- |
| good                                              | 5, 8, 9, 10 at 100 (unchanged, every month the same)                    | $48.5k (unchanged)    |
| advised                                           | 6 at 1420, 9 at 821, 11 at 1420 (unchanged, every month the same)       | (unchanged)           |
| good, doing as the advice says (`BOT_ON=opening`) | 5, 8, 9, 10 at 100 → 1 at 161, 6 at 130, 8 at 100, 10 at 100, 11 at 190 | $48.5k → $43.7k       |

What the heeding bot holds back, and for how long, with the hold taken straight from the numbers rather than the advisor's words:

| Holds, while less than a month is in hand                            | Bankrupt (seed at day)                                       | Year-4 profit a month |
| -------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------- |
| hires, courses and house calls, through the first three paydays only | 2 at 130, 4 at 161, 5 at 190, 8 at 100, 10 at 100, 11 at 130 | $45.1k                |
| hires, courses and house calls, for as long as it lasts              | 4 at 491, 6 at 161, 8 at 100, 10 at 100                      | $56.1k                |
| courses and house calls                                              | 4 at 491, 6 at 161, 8 at 100, 10 at 100                      | $47.8k                |
| hires and house calls                                                | 2 at 130, 8 at 100, 9 at 100, 10 at 100, 12 at 100           | $67.8k                |

The advised persona at every center, seeds 1 to 3, is unchanged month for month against `main` (no game lost either way). The new nudge showed in five of the fifteen games (Willow Lane seed 2 the most) but never on a day the persona would have hired.

**Read:**

- **Does a player who does what the advice says get through the opening?** No more often than one who does not: 4 or 5 games of 12 lost in every variant, against 4. Following it saves seeds 5 and 9 and costs others: seeds 6 and 11 lose in month 4 to 6, after the bot sent its practitioners on courses again, and seed 1 on day 161.
- **Seeds 8 and 10 are lost on day 100 whatever the advice says.** Once the day-0 build is done they have under a month in hand from the first payday, and month 3 heals 0 or 1 guests. Nothing in the first months saves them; only a smaller build would.
- **A limit of three paydays made it worse** (6 lost): the advice went quiet in month 4 with the bank still empty, and the bot's courses then emptied the stations. So the nudge holds for as long as there is less than a month in hand.
- **Holding courses matters, holding hires barely does** (the same four games lost with or without hires held). A course both costs and empties a station. But a course is also how a practitioner learns the techniques guests come for, and the bot that held them all botched treatments it was not trained for ("is not trained in Sports massage and botched …"), so holding courses is no clean win either.
- **When it shows:** every game already had the payday toast on day 1 ("Payday in 29 days: $13,663 in wages …"). The new nudge first comes at the first payday or soon after (days 30 to 60), once the wages have left the bank. In the lost seeds 8 and 10 it showed only 3 times and once, under the guests about to go home worse off that fill the advisor. The Payroll tab keeps it in sight whatever the advisor is saying.
- **What is left for the owner:** the campaign card is the one place the cliff shows before the build, and the bot builds the same opening every seed (entry 37, and the bot's blind spots), so it cannot say whether a player who reads the card opens leaner. The audit's lean opening (acupuncture only, the rest later) lost 2 of 3 too. The arithmetic is unchanged: $48,000 of rooms and $10,750 a month of Trainee wages against $95,000, with the loan limit the same at a $20,000 center as at this $45,000 one. Whether the bank lends a center in proportion to what it starts with, or whether The Orchard opens fewer disciplines, is the owner's call, and outside a communication pass.

## 21 October 2026, late: machines as a station more

Measured with `yarn balance` on `integrate-audit` at `e02faa5` with the bot changed as below, every campaign center, seeds 1 to 6, four years a game: `BOT_ON=machines` against the good bot without the flag. Year 4 is months 37 to 48, over the games not lost. No game rule or price changed. The bot without the flag plays exactly as before: the default `yarn balance` (seeds 1 to 3) matches `e02faa5` on all 15 runs, star days and every month.

### 38. The bot builds a machine room beside the tables, not in place of one

**Found:** entry 37. With `BOT_ON=machines` the bot made room for a machine by knocking down a room it had two or more of, nearly always a Massage Suite, so the machine took a table's place and the center kept the same stations. In 14 of 30 games it knocked a room down and still could not fit the machine.

**Done** (`tests/balance/bot.ts`, `tests/balance/playtest.balance.ts`):

- The machine room goes on free floor, or on land the bot buys when it does not fit, the same way `buildRoom` places any room. When nothing fits, the machine is skipped that month and tried again later. The bot no longer calls `makeSpace` for a machine, nor for the Training Room its operator needs.
- `hireToFill` counts a machine room as one more room of its discipline, so the chair gets its own practitioner and no table is left empty.
- `MachineLog` records `site` (`floor`, `expansion` or `skipped`) and `skipped`, the months it was put off. A skipped machine is logged from the day it was first wanted, with nothing earned or spent. The game summary line says which.
- A unit test (`tests/unit/bot-machines.test.ts`): on a Willow Lane where every plot is bought and every tile holds a staffed Massage Suite, the bot builds no machine, keeps all ten tables, and logs the Kneadmaster as skipped. The old bot knocks one down in the same test.
- Tried and not kept: keeping space for the machine room in `growOnProfit` from the star before it unlocks, as the bot does for a discipline still to come. It built no more machines, because the floor is already full by then (below).

**Result** (entry 37's figures, with the bot knocking rooms down, → now):

| Machine (center)           | Built in     | Healed  | Earned while a guest is inside | Room and running costs | Paid back on its own books        |
| -------------------------- | ------------ | ------- | ------------------------------ | ---------------------- | --------------------------------- |
| Kneadmaster (Willow Lane)  | 5 → 1, floor | 69 → 74 | $190.8k → $204.2k              | $67.5k → $70.5k        | 5 of 5, day 510–880 → 1 of 1, 601 |
| Pin Press (The Exchange)   | 3 → 0        | 24 → –  | $69.8k → –                     | $88.7k → –             | 1 of 3, day 1282 → –              |
| Aura Wash (The Boardwalk)  | 2 → 0        | 19 → –  | $61.6k → –                     | $104.0k → –            | none → –                          |
| Great Alphorn (High Pines) | 0 → 0        | –       | –                              | –                      | –                                 |
| Cider Press (The Orchard)  | 1 → 0        | 7 → –   | $38.0k → –                     | $172.0k → –            | none → –                          |

Year-4 profit a month, with the flag against without: Willow Lane $29.6k against $31.4k, The Exchange $25.9k against $25.9k, The Boardwalk $24.3k against $24.3k, High Pines $26.8k against $26.8k, The Orchard $53.1k against $53.1k (five games: seed 5 is lost on day 100 both ways, before any machine). The one game with a machine, Willow Lane seed 3, makes $29.1k against $37.2k, $8.1k a month less. Willow Lane seed 1 makes $2.7k less with no machine built: the plot the bot bought for the Kneadmaster on day 375 went to its own tables instead. Every other game is the same to the dollar.

**Skipped:** 28 of 29 machines were never built (seed 5 at The Orchard never got far enough to want one). Every one was skipped because nothing fitted:

- In every skipped game, the bot's last table that would not fit came 3 to 23 months before it wanted the machine (day 61 to 265, against day 287 to 926). The good bot fills its building with treatment rooms during the first star.
- In 23 of the 28, every plot was already bought when the machine came due.
- In the other 5, the bot bought the last plot for the machine on the day it wanted it, and still could not use it: Willow Lane seed 1 (the back room), The Exchange seed 1 (the annex), The Boardwalk seeds 2 and 6 (the ice-cream parlor) and High Pines seed 4 (the woodshed). At The Exchange and The Boardwalk, the bot's other rooms took the plot first: another Massage Suite and Acupuncture Room within two weeks, and a Reiki Room the goal asked for. At Willow Lane and High Pines, the plot had no spot the room fitted.
- Machine rooms are bigger than a table's: 4×5 for the Pin Press and the Cider Press, 4×6 for the Aura Wash and 3×7 for the Great Alphorn, where the bot's treatment rooms are 4×4.

**Read:**

- **Do the machines make their center richer in the bot's hands?** No. Only one was built, and its center lost $8.1k a month.
- **The Kneadmaster has a demand problem, not a price or upkeep one.** It pays back on its own books by day 601: $204.2k from 74 guests, about $2.8k each, against its $15,000 room and $1,500 a month to run, and it never overloaded. But it heals about 2 guests a month, where one of the same center's Massage Suites heals 6 or 7. Its Chair-Shaped and Mall Back guests come only once the room is built, and they come from the same arrivals as everyone else. The chair counts as one station, so it draws no more guests than the Massage Suite the bot builds on that spot the next day without the flag (2.67 to 2.92 staffed stations a month on average, with it or without). Most of the time the chair is empty. The center heals 15.8 guests a month in year 4 against 18.3, waits are 8.4 days against 6.3, and the running cost comes on top. Its price ($15,000) and upkeep ($1,500 a month, less than one guest's fee) are not what loses the money. A machine whose conditions are this rare costs the center the table it stands in for.
- **The Pin Press, the Aura Wash, the Great Alphorn and the Cider Press were never built, so this pass cannot say whether their prices or upkeep are right.** Entry 37's figures for them come from games where they replaced a table: on its own books, the Pin Press paid back once in three games and the others never. Their running costs are $2,000 to $4,000 a month.
- **What is left is a space problem in the game, not in the bot.** Every machine unlocks at the second star, and by then every center's building is full and every plot is bought. So the only way a player can have a machine is the one entry 37 measured: knock a table down for it. For the owner to decide: whether the machine star should come with land or floor to put the machine on, or whether a machine should be worth a table's place.

## 21 October 2026, night: demand that grows with the building

Measured with `yarn balance` on the merged `integrate-audit` at `e15f8ba` (before) and `f8cbca1` (after), every campaign center, seeds 1 to 6, four years a game, with `BOT_STYLE=good`, `hoarder` and `grower` and `BOT=baseline`; The Orchard also over seeds 1 to 12 for the good bot and the baseline. The "before" is the merged tree, not entries 34 to 36's own before-runs. Taken again after the treatment machines were merged (`32c41cf` before, `3e16096` after), every number below came out the same to the dollar: the machines are built only with `BOT_ON=machines`. Year 4 is months 37 to 48 and "profit a month" months 13 to 48, over the games not lost; a mean star month counts a star never earned as month 48; waits are the month logs' average wait from month 13 on.

### 37. Arrivals rise with what the center can treat, and a limit on guests at once that binds

**Found:** entry 33 and the audit's recommendation 5. A guest came every `30 − 0.2 × reputation` seconds, 5% more often for each staffed discipline past the first, under a limit of 14 plus 5 a finished room that nobody hit in four years. On the merged tree the good bot still turned nobody away, its waits ran 7.5 to 17.6 days (Willow Lane's the longest), and The Boardwalk's summer was followed by a reputation cliff 88% of the time against 31% for any three months. Watching the games (guest states sampled daily for a month at 18 months, and in an Orchard opening) showed where the time goes: the Consultation Room is the busiest stage everywhere (its desk 77% to 85% busy, the tables 30% to 80%), and at The Orchard's opening 7.5 guests wait for its one consultation while the five disciplines' tables stand mostly idle. The Orchard over seeds 7 to 12, never measured before, loses 5 of 6 games on the merged tree (seed 3 of 1 to 6 as well, on day 71): with the day-0 build the loan is at $50,000 by month 2, and in month 3 the center heals 0 to 2 guests while its practitioners are away on courses and calls, so the bank calls the overdraft in at the third payday.

**Done** (`src/core/data/rules.ts`, `src/core/sim/demand.ts`, `src/core/sim/guests.ts`, `src/core/sim/twists.ts`, the Guests tab, the date's hover and the Loan tab):

- `capacity(ctx)` counts the **staffed treatment stations**: tables, and the mats a Sound Healer can play for, with someone in the role on the payroll and at work (staying, and not on a course or a house call; a break counts as work) to use them, so six tables and two therapists are two stations. It also counts the staffed Consultation Rooms (one for each Consultant on the payroll; a Consultant's course shows in the consultation line, not in the stations), and `fed`, the stations those rooms keep in guests: `CONSULT_FEEDS` 4 each, since every guest is seen there first.
- `capacityArrivals` replaces `offeringArrivals`: `1 + CAPACITY_ARRIVALS.each × (fed − 1)`, with `each` 0.12, capped at `most` 2.5. Reputation stays the base and the difficulty knob multiplies on top; `arrivalPace(ctx)` gives each factor (the center's own draw, the season or rush hour, the grade, the rival, a mishap, the stations, the lines, the difficulty) and `admitGuests` uses it.
- `guestCap(ctx)` is `GUEST_CAP` base 4, plus 2 for each fed station and 2 for each staffed Consultation Room; the player's own intake cap still sits under it. Guests past it go elsewhere and are counted, as before.
- The Guests tab says the pace factor by factor with the counts ("About 14 new guests a month: 9 at 45% reputation, ×1.36 for 4 of 5 staffed treatment stations (1 Consultation Room keeps only 4 in guests), ×1.16 for its grade."), the limit with what it is made of, how many are in and how many found it full this month with the lever (another staffed station, or another Consultation Room where the consultation holds stations back), and which stations draw nobody and why. The date's hover gives the same pace line. The guide's 5%-a-discipline sentence is replaced, and item 12's "14, plus 5 a room".
- The Loan tab shows the next payday beside the loan: "Next payday in 20 days: $12,830 in wages for the staff on the payroll now, against $9,236 in the bank, …", so the first payday's size is in sight before the bank lends.
- **The bot** (`tests/balance/bot.ts`), because its room valuation read lines that the limit now caps: `roomValue` adds the guests a staffed station more draws (last month's arrivals and turn-aways × 0.12 ÷ the current factor), and the good bot (and the styles built on it) also builds a Consultation Room when 3 or more were turned away last month with 2 or more waiting for each consultation. The month log records `stations` and `guestCap`. The baseline and the advised persona are unchanged.

**Calibration** (good bot, seeds 1 to 6; the first three with the bot unchanged; year-4 profit a month; waits, turned away in year 2, and the mean star month over all five centers):

| Rule                                                          | Willow Lane | High Pines | The Boardwalk | Wait, days | Turned away a month | Mean star month | Lost                                                |
| ------------------------------------------------------------- | ----------- | ---------- | ------------- | ---------- | ------------------- | --------------- | --------------------------------------------------- |
| merged tree                                                   | $13.4k      | $30.6k     | $23.0k        | 11.3       | 0                   | 14.6            | The Orchard 3                                       |
| the brief's start: every staffed station, limit 8 + 4 + 2     | $20.4k      | $25.7k     | $24.4k        | 13.0       | 0.6                 | 15.7            | High Pines 3, 5; The Orchard 3, 6                   |
| limit 4 + 2 + 2                                               | $15.4k      | $24.9k     | $17.8k        | 11.3       | 6.0                 | 16.1            | High Pines 5; The Orchard 3, 6                      |
| stations weighted by their staffed share, the bot's valuation | $21.2k      | $18.2k     | $19.3k        | 10.4       | 3.3                 | 13.7            | The Orchard 5                                       |
| practitioners at work, no consultation limit                  | $31.4k      | $31.8k     | $24.3k        | 9.1        | 5.6                 | 15.2            | The Orchard 3, 4, 5, 6 (8 of 12 over seeds 1 to 12) |
| **as now: 4 stations a Consultation Room**                    | $31.4k      | $26.8k     | $24.3k        | 9.3        | 6.0                 | 12.0            | The Orchard 5 (4 of 12)                             |
| 5 stations a Consultation Room                                | $31.4k      | $33.0k     | $24.3k        | 9.2        | 5.5                 | 14.9            | The Orchard 1, 2, 3, 6 (7 of 12)                    |

The brief's limit of 8 plus 4 a station still never binds (0.6 a month) and lets waits grow with the extra guests; 4 plus 2 plus 2 binds, but a limit alone does not shorten a wait that is mostly the consultation's. Weighting stations by how much of the time they stood staffed rescued The Orchard but discounted every niche discipline, whose practitioner leaves the post when nobody comes, so a quiet room drew still fewer and High Pines lost a third of its year-4 profit. Counting practitioners at work is right everywhere a center is balanced (Willow Lane, The Exchange and The Boardwalk are the same game with and without the consultation limit), but an Orchard with five disciplines and one consultation draws guests it cannot see (8 of 12 lost). Four stations a Consultation Room is what one desk keeps busy (a desk sees 15 to 20 guests a month, a table treats 8 to 10); five gives High Pines back $6k a month and costs The Orchard three more seeds of twelve.

**Result**, the good bot, before → after:

| Center             | Stars at month (seed by seed)                                                                                                                                                                         | Profit a month                      | Months at a loss  | Lowest reputation  | Months below 15% | Bank at the end                           | Bankruptcies                   |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ----------------- | ------------------ | ---------------- | ----------------------------------------- | ------------------------------ |
| Willow Lane        | 1.1/8.6/12.6 · 0.9/5.9/9.9 · 0.7/6.8/13.3 · 0.8/16.9/18.6 · 0.7/8.7/13.5 · 0.8/–/– → 1.1/6.0/12.3 · 0.9/3.8/12.4 · 0.7/7.6/11.4 · 0.8/5.7/16.8 · 0.7/3.9/13.7 · 0.8/7.7/12.6                          | $6.1k to $22.4k → $9.2k to $38.9k   | 5 to 19 → 5 to 18 | 1 to 24 → 22 to 30 | 0 to 4 → 0       | $211.9k to $859.2k → $336.8k to $1404.1k  | none (unchanged)               |
| The Exchange       | 7.8/11.9/17.4 · 2.8/6.5/12.5 · 8.7/12.5/16.7 · 8.8/12.6/17.7 · 6.9/11.3/16.5 · 7.6/12.6/14.9 → 7.9/12.9/16.1 · 2.8/10.9/24.3 · 6.5/11.2/15.6 · 7.0/11.6/17.6 · 6.6/10.3/14.0 · 6.4/11.7/17.8          | $21.0k to $27.5k → $12.2k to $36.7k | 6 to 9 → 5 to 14  | 30 (unchanged)     | 0 (unchanged)    | $786.1k to $988.2k → $380.0k to $1310.6k  | none (unchanged)               |
| The Boardwalk      | 6.0/12.9/22.1 · 4.6/10.9/21.8 · 4.6/–/– · 4.4/11.0/17.9 · 4.6/10.9/16.9 · 4.8/15.9/23.3 → 5.7/11.8/22.7 · 4.8/9.6/14.2 · 4.8/9.7/16.5 · 4.5/8.5/14.9 · 4.8/8.6/16.4 · 4.6/19.5/24.3                   | $4.0k to $30.0k → $6.4k to $28.2k   | 4 to 18 → 5 to 15 | 1 to 30 → 30       | 0 to 13 → 0      | $145.6k to $1122.6k → $231.6k to $1023.2k | none (unchanged)               |
| High Pines         | 5.9/11.6/18.0 · 4.0/8.7/14.8 · 5.0/34.6/43.5 · 4.3/8.1/18.4 · 3.8/22.9/28.8 · 9.9/15.4/21.7 → 4.4/8.3/14.6 · 4.0/19.4/31.0 · 5.2/8.8/16.4 · 5.7/12.9/– · 3.9/6.7/11.8 · 7.7/13.9/26.2                 | $9.7k to $30.7k → $11.4k to $33.5k  | 6 to 15 → 4 to 15 | 2 to 30 → 20 to 30 | 0 to 4 → 0       | $296.7k to $1084.3k → $419.0k to $1328.2k | none (unchanged)               |
| The Orchard Estate | 4.1/10.2/16.4 · 4.1/12.0/33.6 · bankrupt day 71/–/– · 4.6/9.6/16.2 · 4.2/11.9/19.3 · 5.0/11.4/18.8 → 4.2/11.9/18.1 · 4.6/9.6/15.5 · 5.3/9.9/15.7 · 4.9/8.9/13.8 · bankrupt day 100/–/– · 4.9/9.7/17.9 | $10.1k to $58.7k → $37.4k to $61.7k | 2 to 20 → 3 to 6  | 2 to 30 → 19 to 30 | 0 to 6 → 0       | −$4.5k to $2024.6k → −$9.6k to $2234.5k   | seed 3 day 71 → seed 5 day 100 |

| Center        | Year-4 profit a month: good · hoarder · grower (games lost)           | Wait, days (good) | Turned away a month, year 2 | Mean star month (good) | Baseline: months at a loss, seeds 1 to 3 (log 31) · games lost of 6 |
| ------------- | --------------------------------------------------------------------- | ----------------- | --------------------------- | ---------------------- | ------------------------------------------------------------------- |
| Willow Lane   | $13.4k · $11.1k (3) · $10.4k → $31.4k · $21.6k (3) · $17.4k           | 17.6 → 8.8        | 0 → 4.9                     | 12.0 → 6.6             | 24/16/22 → 25/20/18 (12 to 32) · 2 → 3                              |
| The Exchange  | $24.3k · $47.5k (5) · $26.9k (3) → $25.9k · $41.7k (5) · $19.0k (1)   | 7.5 → 8.5         | 0 → 5.6                     | 11.4 → 11.7            | 19/12/21 → 22/8/6 (10 to 23) · 1 → 0                                |
| The Boardwalk | $23.0k · $11.9k · $4.6k (3) → $24.3k · $25.0k · $6.8k (2)             | 10.5 → 7.3        | 0 → 8.7                     | 16.0 → 11.4            | 16/22/25 → 20/28/23 (19 to 30) · 5 → 0                              |
| High Pines    | $30.6k · $15.2k (1) · $20.5k (3) → $26.8k · $28.4k (1) · $3.3k (3)    | 8.8 → 10.9        | 0 → 5.0                     | 15.5 → 13.8            | 13/22/19 → 15/9/14 (19 to 31) · 1 → 0                               |
| The Orchard   | $51.5k (1) · $49.5k (3) · – (6) → $53.1k (1) · $69.6k (2) · $1.4k (5) | 12.1 → 11.7       | 0 → 5.6                     | 18.1 → 16.6            | 34/31/36 → 34/31/36 (32 to 35) · 1 → 1                              |

**Read against the brief:**

- **The good bot's year-4 profit at least the hoarder's:** at Willow Lane yes, $31.4k against $21.6k (it was already $13.4k against $11.1k on the merged tree). **At High Pines, no, narrowly:** $26.8k against $28.4k over the hoarder's five games not lost, or $23.7k counting its lost game as nothing. The setting that wins it (five stations a Consultation Room, $33.0k against $24.1k) loses three more Orchard seeds in twelve, and the gap is inside what one setting moves High Pines between runs ($5k to $6k), so the rule stays at four.
- **The Orchard survives every seed: no,** for the good bot (seed 5, day 100; 4 of 12 over seeds 1 to 12, against 6 of 12 on the merged tree) or the baseline (seed 6, day 1420, the same game as on the merged tree, which has one table and so one station and is not touched by this change; 3 of 12 both ways). The good bot's losses are the merged tree's: the loan at its limit from the day-0 build, then a third month with almost nobody healed while practitioners are on courses and calls, then the overdraft called in. Each is warned (the countdown, and 19 warnings in the last 30 days of seed 5). The grower still loses its Orchard games on day 41 (5 of 6, 6 before), borrowing $50,000 on day 0. Raising arrivals cannot fix a month in which nobody is treated, and a cheaper opening would make the center easier, so this is left for the opening itself (below).
- **Stars no more than a month later:** 2.6 months sooner on average (14.6 → 12.0); The Exchange is the same (11.4 → 11.7).
- **The Boardwalk's profit back within about 15% of log 31's:** $20.9k a month over seeds 1 to 6 (the merged tree's $20.3k); over log 31's seeds 1 to 3, $18.8k against its $23.3k, 19% under, from seed 1 ($6.4k, a slow first two years before a third star at 22.7). Its year-4 profit is $24.3k against $23.0k.
- **The Boardwalk summer's share of spirals:** 88% → 17%, against a background of 18% (31% before). Cliffs across the good bot's games fall from 160 to 84, no month falls below 15% reputation at any center (up to 13 a game before), and the lowest reputation anywhere is 19 (was 1).
- **Waits in settled centers 5 to 10 days:** at Willow Lane (8.8), The Exchange (8.5) and The Boardwalk (7.3); at High Pines (10.9) and The Orchard (11.7) just over, both with more stations than their consultations keep busy for part of the year. The hoarder waits 6.9 to 11.3.
- **Turned away a few a month in year 2:** 4.9 to 8.7 for the good bot, The Boardwalk's summers the most; the player's own limit sits under the building's.
- **The baseline's months at a loss no worse than log 31's:** within log 31's range at all five centers for seeds 1 to 3 (The Orchard's 36 is the merged tree's, unchanged). Over six seeds it loses 4 games against 10 (The Boardwalk 5 → 0, Willow Lane 2 → 3: seeds 1 and 4, which grow a third table eight months sooner on the longer lines and then fail more treatments, with no guest ever turned away). Its cliffs rise from 54 to 83 windows of 1,209 to 1,273, still 7% of all three-month windows.

**Fairness:** no game of any style is lost without a warning in its last 10 days. Losses: good bot 1 → 1, hoarder 12 → 11, grower 15 → 11, baseline 10 → 4. Side income shrinks where demand now pays: The Boardwalk's share at month 24 goes from 11% to 53% to 2% to 11%.

**The treatment machines** (`BOT_ON=machines`, seeds 1 to 6, `32c41cf` → `3e16096`). A machine room is a staffed treatment station by the general rule, with no rule of its own: its chair counts once someone in its discipline is on the payroll and at work to run it (a unit test in `tests/unit/machines.test.ts`). Demand that follows capacity roughly doubles what the machines do, but none of them makes its center richer in the bot's hands:

| Machine (center)           | Built in | Healed  | Earned while a guest is inside | Room and running costs | Paid back on its own books   |
| -------------------------- | -------- | ------- | ------------------------------ | ---------------------- | ---------------------------- |
| Kneadmaster (Willow Lane)  | 3 → 5    | 40 → 69 | $102.8k → $190.8k              | $59.5k → $67.5k        | 3 of 3 → 5 of 5, day 510–880 |
| Pin Press (The Exchange)   | 5 → 3    | 15 → 24 | $46.0k → $69.8k                | $84.0k → $88.7k        | 0 of 5 → 1 of 3, day 1282    |
| Aura Wash (The Boardwalk)  | 3 → 2    | 8 → 19  | $22.8k → $61.6k                | $89.0k → $104.0k       | none                         |
| Great Alphorn (High Pines) | 4 → 0    | 9 → –   | $28.9k → –                     | $112.8k → –            | none                         |
| Cider Press (The Orchard)  | 1 → 1    | 0 → 7   | $0 → $38.0k                    | $92.0k → $172.0k       | none                         |

Year-4 profit a month with the machines against the good bot without them: Willow Lane $24.3k against $31.4k (was $12.1k against $13.4k), The Exchange $25.0k against $25.9k, The Boardwalk $19.0k against $24.3k, High Pines $21.9k against $26.8k, The Orchard $48.8k against $53.1k. Seed by seed, a game where the bot built a machine makes $7.0k a month less than the same seed without the flag (11 games; $6.9k over 16 before). So the Kneadmaster pays for itself but not for what it replaces, and the Pin Press barely pays for itself. Two things in the bot cost more than the machines' prices:

- It makes room by knocking down a Massage Suite, so at Willow Lane the Kneadmaster takes the place of a table and its therapist moves to the chair: the center keeps the same staffed stations, the same pace and the same guest limit, and pays the running costs on top. Willow Lane seed 3 stays at 2 stations and a limit of 12 from day 353, where the good bot builds a third Massage Suite on day 354 and has 3 and 14.
- In 14 of 30 games it knocked a room down and then could not fit the machine ("in vain" in the notes), $3.1k a month down on those seeds with no machine built.

Tried and not kept: hiring a practitioner whenever the machine's discipline had more stations than staff. The machines heal more (Kneadmaster 75, Pin Press 28 and $5.4k short of paying back, Cider Press 17) but the centers gain only $1k to $2k a month (Willow Lane $26.2k, The Exchange $26.0k, The Boardwalk $19.8k), and at The Exchange it took on six acupuncturists one after another as the payroll rules let them go. The bot change belongs with the machines, not here.

**Still open:** The Orchard's opening on the merged tree, for the good bot as much as the grower: the day-0 build puts the loan at its limit by month 2, and the bot's courses and house calls in month 3 leave lines with nobody to treat them. The Loan tab now shows the first payday before borrowing; the bot does not read it.

## 21 October 2026: side income in proportion

Measured with `yarn balance` at `020cb42` (before) and `2a179ed` (after), every campaign center, seeds 1 to 6, four years a game, with `BOT_STYLE=good`, `hoarder` and `grower`. The bot's month log now records the finished treatment rooms and the Instructors on the payroll, so class income per Instructor and a treatment room's take are read from the same months. Year 4 is months 37 to 48, over the games not lost.

### 36. A Qi Gong Studio and a house call pay about what the center does

**Found:** entry 33 and the audit's recommendation 6. A class drew `spots × 2.5` class-goers a week, so every Practice Spot built added demand from a pool nothing limited: in the studio games, one Instructor brought in 1.0 to 3.6 times a treatment room's take (most near 1.65). House calls paid $1,200 a day at rank 1 and 25% more a rank, several times a practitioner's day at home, and were 7% to 22% of the good bot's year-4 income.

**Done:**

- `weeklyInterest(reputation, skill)` is `CLASS_WEEKLY × (0.4 + reputation/83) × (0.85 + 0.05 × skill)`, with `CLASS_WEEKLY` 14: 21 a week for an Expert at 80%, 25 at the top. Spots only cap a class in `classSize`, which is unchanged, as are the class-size and full-class tips, which still read right. The studio's inspector says "About 21 class-goers a week come for classes at this reputation, shared among 3 class days".
- House calls pay `CALL_PER_DAY` $600 a day at rank 1 and `CALL_RANK_BONUS` 15% more a rank ($960 for an Expert). The day at home: fees run about $100 a second of table time (Swedish $850 to $900 for 9 seconds, Deep Tissue $1,100 to $1,150 for 11, the dearest massage $2,000 for 16), and a table treats about one guest in two days, so a practitioner earns $450 to $1,000 a day at standard prices; in the good bot's logs a treatment room takes $300 to $450 a day at price 1.4. The offer card says, beside each who could go, how many wait in their line and the days of condition the worst of them has left, with a ⚠️ when that is less than the days away.

**Calibration** (class income a month per Instructor ÷ treatment income a month per treatment room, year 4, in the months with a studio; before → after at `CLASS_WEEKLY` 14):

| Style   | Center        | Before                 | After                            |
| ------- | ------------- | ---------------------- | -------------------------------- |
| good    | The Boardwalk | 1.60, 1.69             | 1.09 ($10.1k / $9.3k)            |
| good    | High Pines    | 3.58                   | no studio                        |
| good    | The Orchard   | 1.68, 1.64, 1.04       | 0.86, 0.77, 1.49 ($6.7k / $4.5k) |
| hoarder | Willow Lane   | 1.93 ($20.0k / $10.4k) | no studio                        |
| hoarder | The Exchange  | 2.82                   | 2.69 ($13.0k / $4.8k)            |
| hoarder | The Boardwalk | 2.00                   | no studio                        |
| hoarder | High Pines    | 5.96, 1.55             | 1.49                             |
| hoarder | The Orchard   | 1.70, 1.29, 1.33, 1.39 | 1.19, 0.85, 0.97                 |
| grower  | studio games  | 2.93, 1.41, 2.02       | 1.41, 1.09, 0.89, 1.73           |

Over the nine good and hoarder games with a studio after, an Instructor brings in $12.0k a month against $10.9k a treatment room: 1.10, the middle of the 0.8 to 1.3 band. The games outside it at the top are where the center's rooms take under $5k a month, not where classes pay more ($6.7k to $15.3k a month per Instructor everywhere). A lower `CLASS_WEEKLY` would move as many games out at the bottom (0.77 to 0.86) as it brought in at the top, so it stays at 14.

**Result:**

| Style   | House calls, share of year-4 income (Willow · Exchange · Boardwalk · High Pines · Orchard) | Year-4 profit a month at Willow Lane | Games lost  |
| ------- | ------------------------------------------------------------------------------------------ | ------------------------------------ | ----------- |
| good    | 13% · 22% · 12% · 10% · 7% → 7% · 9% · 6% · 4% · 3%                                        | $17.9k → $13.2k                      | 1 → 2 of 30 |
| hoarder | 13% · 13% · 13% · 9% · 12% → 7% · 7% · 5% · 4% · 6%                                        | $25.7k → $9.0k                       | 5 → 7 of 30 |
| grower  | 14% · 20% · 9% · 8% · 8% → 7% · 10% · 2% · 3% · 8%                                         | $15.4k → $13.1k                      | 8 → 9 of 30 |

- House calls are under 10% of the good bot's year-4 income at every center.
- The hoarder's year-4 money edge at Willow Lane is gone: $9.0k a month against the good bot's $13.2k (it was $25.7k against $17.9k).
- The good bot's stars: over seeds 1 to 6, 83 reached before and after, 0.68 months later on average (Willow Lane 0.3 sooner, The Exchange 1.8 later, The Orchard 1.4 later). Over entry 31's seeds 1 to 3 alone, 2.0 months later and 41 stars against 45, from one game: The Orchard, seed 3, lost on day 100.

**The losses.** None comes from classes: every game lost after has no studio. The Orchard's seed 3 is in the bank's ten-day countdown from day 90 in both runs; before, a two-day house call on day 94 paid $5,040 and cleared it, and now the same call pays $2,184. The hoarder's Willow Lane games end sooner (seeds 1 and 5 on days 761 and 641, from 1030 and 1060) and seed 2 is lost on day 1030 having never fitted a studio; the grower loses 5 of 6 at The Orchard (3 before). These are centers that were living on calls at twice a day's work. The loss is in sight (the countdown and the payday warnings come first), but a side income was what carried a player past them, and the next pass's demand work (section D) is where a center earns that back from its rooms.

## 21 October 2026, afternoon: prices that bite

Measured with `yarn balance` (`BOT_STYLE=good`, `hoarder`, `grower`), seeds 1 to 3, four years, before (`integrate-audit` at `d1b3d02`) and after; The Boardwalk also over seeds 4 to 9 for the good bot. Profit a month is from month 13 on, over the games not lost; "mean star month" counts a star never earned as month 48.

### 35. A put-off curve fitted to the guests who mind the price

**Found:** the old rule, a flat `(price − 1) × 0.35` chance after a diagnosis, put off far fewer than it says. Share of diagnosed guests put off (priced over healed + failed + priced + worse + stormed), from the month logs, before:

| Price level | 1.0  | 1.1  | 1.2  | 1.3  | 1.4  | 1.5  | 1.6  |
| ----------- | ---- | ---- | ---- | ---- | ---- | ---- | ---- |
| Good bot    | 0.6% | 2.4% | 2.2% | 2.6% | 4.3% | –    | –    |
| Hoarder     | 1.0% | 2.5% | 3.7% | 5.3% | 4.6% | 4.4% | 6.3% |
| Grower      | 0.0% | 1.0% | 2.1% | –    | 4.7% | –    | –    |

The reason: in the good bot's second year a diagnosed guest is new 26% of the time, a plain regular 6%, a loyal or devoted regular 55% and an emergency 13% (14 games, sampled daily). Every regular and emergency was exempt, so only about a quarter of guests could balk at all.

**Done:** `putOffChance(price, reputation)` (economy.ts) over `PRICE_PUT_OFF` (rules.ts). **The regulars rule changed:** a plain regular now minds the price half as much as a new guest (`REGULAR_PUT_OFF`); loyal and devoted regulars keep "never put off by prices" as their earned perk, and emergencies stay exempt. About 0.29 of diagnosed guests then mind the price in full, so the knots are the targets for all diagnosed guests divided by that: per new guest 3% at 1.1, 10% at 1.2, 17% at 1.3, 34% at 1.4, 68% at 1.6 and 90% at 2, at 50% reputation, shifted 0.15 along the price at 90% and −0.15 at 20%. Half of all guests at 2 cannot be had while loyal regulars are spared. No one balks at standard prices or below, however poor the name, so a struggling center always has a price that costs no guests (without it a center at 0% lost 6% of new guests at 1.0, each balk costing reputation). The Prices tab says "About 34% of new guests balk at this price; 68% at 160% of standard. Plain regulars balk half as often; loyal regulars and emergencies never do.", and each treatment's row shows its share.

**Result**, share put off from month 13 on, before → after: good bot 3.6% → 5.0% (5.4% at 1.4: reputations mostly sit above 50%, so the curve reads lower than at 50%), hoarder 5.0% → 11.0% (16% at 1.6, 19% at 1.5), grower 1.8% → 1.2% (its 1.2 cap barely bites once reputation is good).

| Center, style                   | Price at months 12/24/47, before → after                                          | Profit a month         | Stars at month, before → after                                                                                                                                                         | Mean star month | Net worth at the end (mean) | Lost  |
| ------------------------------- | --------------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | --------------------------- | ----- |
| Willow Lane, good               | 1.1/1.4/1.4 · 1.1/1.2/1.4 · 1.3/1.4/1.4 → 1.3/1.3/1.4 · 1.3/1.3/1.4 · 1.1/1.3/1.4 | $19.2k → $21.8k (+13%) | 1.1/8.9/15.0 · 0.9/8.0/10.9 · 0.7/4.9/12.1 → 1.1/5.8/14.7 · 0.9/5.8/7.8 · 0.7/5.8/9.8                                                                                                  | 6.9 → 5.8       | $692k → $858k               | 0 → 0 |
| The Exchange, good              | 1.4/1.3/1.4 · 1.2/1.4/1.4 · 1.4/1.4/1.4 → 1.3/1.4/1.4 · 1.1/1.4/1.3 · 1.4/1.4/1.4 | $27.3k → $26.7k (−2%)  | 15.7/19.4/25.6 · 8.6/12.6/15.2 · 3.8/8.2/13.7 → 9.0/12.4/18.6 · 2.8/8.6/18.7 · 8.8/12.7/14.5                                                                                           | 13.6 → 11.8     | $1007k → $981k              | 0 → 0 |
| The Boardwalk, good (seeds 1–3) | 1.4/1.4/1.4 · 1.4/1.3/1.3 · 1.4/1.3/1.4 → 1/1.2/1.2 · 1/1/1.1 · 1.4/1.4/1.4       | $23.3k → $13.7k (−41%) | 4.8/12.0/17.7 · 4.3/12.9/18.8 · 4.3/9.9/19.0 → 5.4/47.0/– · 4.6/–/– · 4.3/9.7/15.2                                                                                                     | 11.5 → 25.6     | $905k → $503k               | 0 → 0 |
| The Boardwalk, good (seeds 4–9) | settles 1.0 to 1.4 both ways                                                      | $16.8k → $16.1k (−4%)  | 4.0/38.0/– · 4.2/27.8/34.1 · 5.8/9.0/16.2 · 4.5/14.9/22.1 · 4.2/14.9/23.9 · 4.9/9.8/17.2 → 4.2/7.3/17.0 · 4.6/15.7/28.3 · 4.6/11.0/22.5 · 4.5/9.8/15.7 · 4.7/35.8/42.0 · 5.9/26.8/39.0 | 16.9 → 16.6     | $624k → $623k               | 0 → 0 |
| High Pines, good                | 1.4/1.4/1.4 · 1.3/1.4/1 · 1.4/1.4/1.4 → 1.4/1.4/1.4 · 1.2/1.4/1.4 · 1.4/1.4/1.3   | $19.3k → $35.4k (+83%) | 4.9/10.1/16.1 · 4.6/12.9/27.9 · 3.7/8.2/27.2 → 6.0/10.8/16.1 · 4.9/9.3/16.2 · 4.4/12.5/18.1                                                                                            | 12.8 → 10.9     | $674k → $1279k              | 0 → 0 |
| The Orchard, good               | 1.4/1.4/1.4 · 1.3/1.4/1.4 · 1.4/1.4/1.4 → 1.4/1.4/1.4 · 1.3/1.4/1.4 · 1.3/1.4/1.4 | $69.0k → $63.2k (−8%)  | 6.5/11.1/17.7 · 4.6/9.8/16.5 · 4.6/9.4/17.1 → 4.6/9.6/16.0 · 4.7/9.9/15.9 · 6.1/12.8/18.6                                                                                              | 10.8 → 10.9     | $2518k → $2303k             | 0 → 0 |
| Willow Lane, hoarder            | ✗ · 1/1.1/1.6 · 1.3/1.6/1.6 → ✗ · 1.1/1.6/1.6 · 1/1.2/1.6                         | $24.5k → $31.4k        | 1.1/–/– · 2.4/6.0/17.7 · 0.9/15.8/15.8 → 1.1/–/– · 1.9/16.7/16.7 · 0.9/18.9/18.9                                                                                                       | 17.3 → 19.0     | $583k → $730k               | 1 → 1 |
| The Exchange, hoarder           | ✗ · 1.6/1.6/1.6 · 1.6/1.6/1.6 → ✗ · ✗ · 1.5/1.6/1.6                               | $21.6k → $41.2k        | –/–/– · 47.7/–/– · 11.7/17.1/21.2 → –/–/– · –/–/– · 9.5/14.1/18.9                                                                                                                      | 37.5 → 36.7     | $524k → $469k               | 1 → 2 |
| The Boardwalk, hoarder          | 1.3/1/1 · 1.6/1.6/1.2 · 1.6/1/1 → 1.5/1/1.2 · 1.4/1.5/1.6 · 1.3/1/1.5             | $7.0k → $12.0k         | 4.6/15.8/36.7 · 4.6/23.8/37.2 · 5.6/15.7/26.4 → 5.6/15.0/27.6 · 4.6/29.9/39.2 · 5.4/14.9/26.0                                                                                          | 18.9 → 18.7     | $310k → $484k               | 0 → 0 |
| High Pines, hoarder             | 1/1.6/1.6 · 1.3/1.6/1.6 · 1.1/1.6/1.6 → 1/1.5/1.5 · 1.4/1.2/1 · ✗                 | $24.1k → $14.0k        | 9.1/26.9/– · 4.5/15.0/25.2 · 5.0/26.9/33.4 → 12.8/26.0/31.8 · 4.3/13.7/32.6 · 24.6/–/–                                                                                                 | 21.6 → 26.9     | $890k → $355k               | 0 → 1 |
| The Orchard, hoarder            | 1.5/1.6/1.5 · 1/1.5/1.6 · 1.3/1.6/1.6 → 1/1/1.6 · 1/1/1.6 · 1.2/1.6/1.6           | $74.3k → $34.2k        | 5.4/12.8/21.0 · 12.0/18.8/25.7 · 8.3/14.5/20.0 → 12.7/21.0/31.7 · –/–/– · 7.1/14.7/20.4                                                                                                | 15.4 → 28.0     | $2675k → $1242k             | 0 → 0 |
| Willow Lane, grower             | 1.2/1.2/1.1 · 1.2/1/1.1 · 1.1/1.2/1 → 1.2/1.2/1.2 · 1.2/1.2/1.2 · 1.2/1/1.1       | $12.5k → $18.0k        | 6.5 → 5.5 mean                                                                                                                                                                         |                 | $454k → $696k               | 0 → 0 |
| The Exchange, grower            | 1.2 to 1.1 → 1.0 to 1.2                                                           | $15.9k → $22.8k        |                                                                                                                                                                                        | 17.0 → 12.9     | $597k → $758k               | 0 → 0 |
| The Boardwalk, grower           | ✗ · ✗ · 1.4/1/1 → 1.2/1.2/1.2 · 1.1/1.2/1.1 · 1.1/1.1/1.1                         | $0.8k → $8.2k          |                                                                                                                                                                                        | 30.2 → 20.4     | −$43k → $301k               | 2 → 0 |
| High Pines, grower              | 1.2/1.2/1.2 · ✗ · ✗ → same                                                        | $19.1k → $23.0k        |                                                                                                                                                                                        | 21.5 → 25.9     | $161k → $234k               | 2 → 2 |
| The Orchard, grower             | ✗ · 1.2/1.2/1.2 · ✗ → 1.2/1/1.2 · 1.1/1.2/1.2 · ✗                                 | $42.0k → $25.0k        |                                                                                                                                                                                        | 35.7 → 26.6     | $450k → $542k               | 2 → 1 |

**Read against the brief:**

- **No longer all on their caps.** The good bot settles at 1.3 at Willow Lane in its first two years and drops to 1.0–1.2 at The Boardwalk; elsewhere it still ends at 1.4, where its 5% share is under its 10% aim. The hoarder ends below 1.6 in 7 of its 15 games (High Pines 1.5, 1.0; The Boardwalk 1.2, 1.5), where it sat at 1.6 nearly everywhere before. The grower stays at its 1.2 cap: 1% put off there is no reason to move.
- **The good bot's profit within 15%:** yes at Willow Lane (+13%), The Exchange (−2%) and The Orchard (−8%); High Pines rises 83%, because its seeds 2 and 3 no longer sink to 1.0 and reach their third star in month 16 to 18 instead of 27 to 28. **Not at The Boardwalk seeds 1 and 2**, which lose a room early (7 against 9 at month 6), have a bad first summer and never recover: the bot reads its put-off share off winter months of 3 to 12 arrivals, so two balks read as 25% and it drops prices to 1.0. Over seeds 4 to 9 The Boardwalk is −4% with the same mean star month, so over nine seeds it is −16% and about 2.5 months later.
- **Stars within a month on average:** the mean star month improves at four centers and is the same at The Orchard; The Boardwalk is as above.
- **The hoarder's year-four money edge:** at High Pines it is gone (it ends $355k against the good bot's $1279k; before $890k against $674k). At Willow Lane it was not there over seeds 1 to 3 (one seed lost both times) and is not now ($730k against $858k).

**Still open:** the hoarder loses a third game (High Pines seed 3, day 1390) and The Exchange seed 2; both are slow, warned declines at prices the menu says put off one new guest in five or more. The bot's put-off measure is noisy on small months; a player sees the menu's per-price share instead.

## 21 October 2026, evening: advice that can be followed

Entry 32's advised persona lost more games than the thoughtless baseline because the advisor asked for growth the payroll could not carry and named levers that could not work in time. This is [plans/next-pass.md](../plans/next-pass.md) section A. Measured with `yarn balance` on `integrate-audit` at `d1b3d02` (before) and on this branch (after), every campaign center, seeds 1 to 3, four years, in the same terms as entry 32.

### 34. The advisor weighs the payroll, names who to let go, and stops sticking

**Found** (entry 32): the bottleneck advice asked for another room or member of staff on a line of four without regard for the wages; the overdraft countdown said "prices up" when the bank judges a month-long pace that a price rise barely moves in ten days; "staff down" named nobody, so the extra consultants the advisor had asked for stayed; a broken Air Conditioner the Caretaker never reached sat above every other nudge on half The Boardwalk's days, as "A Air Conditioner"; and "borrow it" was said while the books lost money.

**Done** (`src/core/sim/advisor.ts`, `src/core/sim/economy.ts`, `src/core/format.ts`):

- The bottleneck advice prices the hire (the cheapest applicant in the role, or its standard pay) and asks for it only when the books stay at or above zero with the new wage at the pace, and the bank holds a month of it (with the room's cost, for a new station). Otherwise it keeps the diagnosis and changes the lever: "Another Massage Therapist would put the books $1,800 a month in the red: raise prices, or wait for the pace to grow", or "… comes to $9,400, and the bank has $3,000: save up for it first." With enough staff on the books but the station standing empty, it names a Staff Room ("Build a Staff Room nearby, so their breaks are shorter", or "A Staff Room nearer by would keep it going") rather than another wage, as entry 32's first recommendation asked; with a new hire still on the way, or someone out on a course or a house call, it says so and asks for nobody. While the bank calls the overdraft in, or payday is not covered at the pace, it gives no growth advice. A new money nudge comes first instead: "Payday in 12 days is $2,400 short, past what the bank will lend. No new staff or rooms until the takings cover the wages." With a month behind the center and the books losing money, that nudge names the cut.
- The countdown, the bank calling the overdraft in and the halfway reminder all say "A price rise helps the months ahead, but the bank judges the takings over the last month or so, so it barely moves them in 10 days; a wage comes off at once", then name who to let go: in a role that works a station and has two or more, the one whose station was busy least (no station at all counts as idlest), with their wage and where the books stand without them, as in "Letting Priya go ($2,400 a month, their Massage Table busy 31% of the time) puts the books $600 a month in profit." With nobody spare: "No role has two to let one go from, so the way out is the bank above zero: sell something, or earn it."
- With a Caretaker on the payroll a breakdown drops below the money, line and comfort advice, and is not said at all while a Caretaker has claimed the repair (the item's `claimedBy` and the Caretaker's `job` record it). Items now read "An Air Conditioner" (`an()` in format.ts), in the advisor and in the breakdown toast.
- While the books lose money, the month-end red toast and the advisor's loan line lead with the cut ("Prices up or staff down first: Letting … go …") and then say to borrow what is left, since the loan buys time but uses the room the next payday needs. While the books make money, both read as before.

The advised persona (`tests/balance/bot.ts`) reads the new words for the same levers: prices up on "a month in the red: raise prices"; nothing on "save up" or a new hire on the way; a Staff Room on "Build a Staff Room nearby"; a hire only on "hire another"; a build only on "… to work it would move them along" or "would share the load". "Letting X go" lets that person go, and their room or desk is benched so the baseline's refill does not hire them back. The cut on the red toast, the loan line and the payday nudge comes first, at most once in three days, before any borrowing. The good bot and the baseline are unchanged, star day for star day.

**Result,** the thoughtless baseline, then the advised persona before and after:

| Center             | Bot            | Stars at month (seed 1 · 2 · 3)                               | Profit a month   | Months at a loss | Lowest reputation | Months below 15% | Bankrupt           |
| ------------------ | -------------- | ------------------------------------------------------------- | ---------------- | ---------------- | ----------------- | ---------------- | ------------------ |
| Willow Lane        | baseline       | 3.1/–/– · 0.9/bankrupt day 581 · 0.7/–/–                      | −$5.9k to −$0.4k | 12 to 32         | 7 to 30           | 0 to 4           | 1 (day 581)        |
|                    | advised before | 3.1/bankrupt day 671 · 0.9/bankrupt day 281 · 0.7/–/–         | −$0.7k to −$0.0k | 7 to 32          | 17 to 30          | 0                | 2 (days 281, 671)  |
|                    | advised after  | 3.1/–/– · 0.9/–/– · 0.7/–/–                                   | $2.9k to $4.4k   | 12 to 18         | 14 to 30          | 0 to 1           | 0                  |
| The Exchange       | baseline       | 7.7/–/– · 6.9/–/– · 5.8/–/–                                   | $0.7k to $5.0k   | 10 to 23         | 30                | 0                | 0                  |
|                    | advised before | 5.7/–/– · 6.7/–/– · 4.8/–/–                                   | $0.1k to $5.9k   | 11 to 26         | 30                | 0                | 0                  |
|                    | advised after  | 5.6/–/– · 7.5/–/– · 6.8/–/–                                   | −$2.1k to $9.7k  | 8 to 30          | 30                | 0                | 0                  |
| The Boardwalk      | baseline       | 9.9/9.9/bankrupt day 1390 · 8.8/15.0/– · 3.9/bankrupt day 851 | −$3.0k to $0.7k  | 19 to 30         | 30                | 0                | 2 (days 851, 1390) |
|                    | advised before | 18.9/19.3/bankrupt day 1001 · 8.8/9.8/– · 3.9/–/–             | −$2.5k to $2.6k  | 9 to 18          | 30                | 0                | 1 (day 1001)       |
|                    | advised after  | 8.9/9.1/– · 7.5/–/– · 3.9/–/–                                 | $0.7k to $3.1k   | 9 to 21          | 18 to 30          | 0                | 0                  |
| High Pines         | baseline       | 5.8/–/– · 6.7/–/– · 6.9/–/–                                   | −$1.4k to $1.7k  | 19 to 31         | 23 to 30          | 0                | 0                  |
|                    | advised before | 8.9/–/– · 8.8/–/– · 46.8/–/–                                  | −$1.2k to $0.7k  | 20 to 28         | 23 to 30          | 0                | 0                  |
|                    | advised after  | 7.7/–/– · 5.8/–/– · 5.5/–/–                                   | $2.5k to $8.5k   | 6 to 15          | 23 to 30          | 0                | 0                  |
| The Orchard Estate | baseline       | –/–/– · –/–/– · –/–/–                                         | −$1.3k to −$0.6k | 32 to 35         | 1 to 2            | 28 to 43         | 0                  |
|                    | advised before | bankrupt day 1420 · –/–/– · –/–/–                             | −$1.4k to −$0.6k | 32 to 36         | 1 to 2            | 28 to 43         | 1 (day 1420)       |
|                    | advised after  | –/–/– · –/–/– · –/–/–                                         | −$1.1k to −$0.6k | 32 to 34         | 1 to 2            | 28 to 43         | 0                  |

The good bot is unchanged in every cell of entry 31's table, star day for star day. The baseline is unchanged too, since it reads nothing.

Guests sent home worse off, all three seeds together, advised before → after: Willow Lane 0 → 3, The Exchange 2 → 0, The Boardwalk 6 → 23, High Pines 0 → 0, The Orchard 0 → 0.

**Per center:**

- **Willow Lane: no game lost, against two.** Profit a month moves from about nothing to $2.9k to $4.4k. Seed 2 shows the old failure going away: on day 193 the bottleneck advice said another consultant would put the books in the red, and the persona raised prices instead of hiring. Once, the cut first ran into the baseline's own refill: a run with the cut named but no bench let a consultant go each day of the countdown and had the baseline hire one back the next, until the bank called it in on day 551. Benching the room or desk of the person let go, as the persona already did for practitioners, fixed it, and that game now plays out.
- **High Pines: the first star at months 7.7, 5.8 and 5.5, against 8.9, 8.8 and 46.8.** Seeds 2 and 3 are inside the baseline's months (5.8 to 6.9). Seed 1 is 0.8 of a month past the baseline's latest and 1.9 past its own seed, and the advisor no longer causes the gap. Before, the persona hired a consultant (day 131) and a third therapist (day 144) on "keeps being called away". The first was a desk that stood empty for breaks, and now gets the Staff Room nudge. The second was a new therapist still on the way, and is now waited for. With neither hire, seed 1 makes no hires or price changes before its star and makes the same moves as the baseline. The $25,000 goal still comes later because its months 6 to 8 have fewer arrivals (13 against 20 in month 6) once the guests it moves up or sends home have changed what follows. In one trial with a stricter payroll test (three months' wage of margin), the persona raised prices on the same nudges and reached the star at 5.9, but that margin has no basis in the rule, so it was not kept.
- **The Boardwalk: the gain stays and grows.** No game lost, against one (and two for the baseline). Seed 1 plays out the four years and reaches its first two stars at months 8.9 and 9.1, against 18.9 and 19.3 before, its loss on day 1001. Seed 2 loses its second star (9.8 before): in its first summer the advisor said another therapist would put the books in the red, so the persona raised prices (day 181) and built a room four days later instead of hiring two therapists on days 174 and 178. Its three second-star goals are each met (days 226, 226, 297), but never in the same month. The 17 more guests sent home worse off come in the years seeds 1 and 2 now play with three massage rooms benched by the winter notices (one table staffed for eight rooms in seed 1's fourth year). The broken Air Conditioner no longer hides the advice beneath it, so the advisor now spends those days on "nobody is qualified … train" and "Acupuncture is now available", which sit above the bottleneck advice and which this persona does not act on (entry 32's sixth recommendation).
- **The Exchange: about as the baseline, where before it was a little ahead.** First stars at 5.6, 7.5 and 6.8, against 5.7, 6.7 and 4.8 before and 7.7, 6.9 and 5.8 for the baseline. A first try named the cut on a payday covered by borrowing, and in the first month its pace is a few days of takings, so the persona raised prices to 1.4 by day 11 and the first star slipped to month 8.7. The cut is now named only past what the bank will lend and once a month has closed. What is left is churn between two signals: seed 2 lets a consultant go on the month-end toast at $72 in the red and hires one back 22 days later on the bottleneck advice. Seed 3's months at a loss (30) come from its fourth year, borrowing at each payday from day 1170.
- **The Orchard Estate: no game lost, against one.** Seed 1 no longer takes the last loan step on "borrow it" (day 1380 before). The month-end toast now has it raise prices first (nobody is spare to let go), and it borrows a step only on day 1410, still in the red. A step is left for the last payday, and the game plays out.

**For a later session:**

1. The advisor's training and new-discipline nudges ("nobody is qualified … train", "Acupuncture is now available") sit above the bottleneck advice and fill most late-game days. A persona that acts on them, or an order that lets a long line speak first, would show whether the Boardwalk's late worse-offs are the advisor's or the persona's.
2. Whatever the reason a station stood empty, the bottleneck still reads only the last three days. A role that grew within them, by a hire the player made rather than one still arriving, could be noted so the advice does not ask for another the day after. That needs a hire day on `Staff`, which saves do not have yet.

## 21 October 2026: three ways to play the same seeds

The research's two checks for a strategy that always wins ([research/balancing-methods.md](../research/balancing-methods.md): Holmgård's personas, the same policy with different weights compared on survival curves, and Supercell's dominant-strategy detector, a population collapsing onto one choice) need more than one way to play. Measured with `yarn balance` on `integrate-audit` at `1a6de22`, every campaign center, seeds 1 to 6, four years a game. Stars at month are given seed by seed; profit a month is averaged from the second year on, over the games that were not lost; months at a loss, the lowest reputation (sampled daily) and months below 15% are of every game.

### 33. No style always wins, but the price cap and a Qi Gong Studio always pay

**Found:** every number in this log came from one way of playing well. The deep-dive audit's findings on late money, side income, demand that barely grows with the building, and a price sweet spot near the cap are claims about what the best play is. Only one style of play had been measured, so the claims could not be tested.

**Done** (`tests/balance/bot.ts`): the good bot's tuning is one `Style` record, chosen by `BOT_STYLE`. The record holds the price cap, the long-line premium and the put-off target, a reserve of `wages × k + c` for each thing the bot spends on, how far it borrows (`payday`, `build`, `limit`), when it pays the loan back, how many months a new room's cost is spread over in `roomValue` and how many months of the room's worth must cover its cost before the bot borrows for it, and whether it markets. `decide()` is unchanged; the methods read `this.style`. Each month's log also records income by source (`incomeBy`, shared with the report).

- `good` (the default) is the bot as it was. With `BOT_STYLE` unset (seeds 1 to 3) and with `BOT_STYLE=good` (seeds 1 to 6), every game plays out move for move as before, notes included; seeds 1 to 3 are entry 31's "after".
- `hoarder` never borrows except when a payday forces it, keeps at least two months' wages in reserve for everything, raises prices up to 1.6 while fewer than one guest in five is put off, builds a room only when it pays back within a month, and never markets.
- `grower` borrows up to the bank's limit for anything from day one, keeping only the next payday in hand. It keeps at most half a month's wages in reserve, prices from 1.0 to 1.2 with no long-line premium, and runs word of mouth whenever it can pay for it. Its rooms must pay back within two years, not the brief's six months, because six months would be stricter than the good bot's one year.
- What all three styles share: the rescue when the bank calls the overdraft in still raises prices to at least 1.4, and growth (one room per discipline every two months, the line thresholds) is left as it was, so the styles differ in temper, not in skill.

**Result** (the last column shows each game's loan at its peak and at the end, with ✗ for a game that was lost; prices are at months 12 and 24 and in the last month played, month 47, since the game ends before month 48 closes):

| Center, style               | Stars at month (seed 1 · 2 · 3 · 4 · 5 · 6)                                                                            | Profit a month   | Months at a loss | Lowest reputation | Months below 15% | Bankrupt | Net worth at the end                 | Price level at months 12 / 24 / end                                               | Loan at its peak → at the end                       |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------- | ---------------- | ----------------- | ---------------- | -------- | ------------------------------------ | --------------------------------------------------------------------------------- | --------------------------------------------------- |
| Willow Lane, good           | 1.1/8.9/15.0 · 0.9/8.0/10.9 · 0.7/4.9/12.1 · 0.8/4.9/16.7 · 0.7/–/– · 0.8/–/–                                          | $5.5k to $22.9k  | 5 to 12          | 1 to 20           | 0 to 4           | 0 of 6   | $208.6k to $841.1k (mean $531.0k)    | 1.1/1.4/1.4 · 1.1/1.2/1.4 · 1.3/1.4/1.4 · 1/1.4/1.4 · 1.2/1.1/1.4 · 1/1/1.4       | 40k→0k · 30k→0k · 45k→0k · 45k→0k · 30k→0k · 30k→0k |
| Willow Lane, hoarder        | 1.1/–/– bankrupt day 1030 · 2.4/6.0/17.7 · 0.9/15.8/15.8 · 0.8/18.8/18.8 · 0.7/–/– bankrupt day 1060 · 0.9/7.7/8.4     | $15.0k to $25.2k | 7 to 27          | 0 to 7            | 2 to 30          | 2 of 6   | $559.6k to $924.7k (mean $802.5k)    | – · 1/1.1/1.6 · 1.3/1.6/1.6 · 1/1.5/1.4 · – · 1.5/1.6/1.5                         | 50k→✗ · 0k→0k · 5k→0k · 0k→0k · 50k→✗ · 0k→0k       |
| Willow Lane, grower         | 1.1/5.9/11.8 · 0.9/4.6/13.8 · 0.7/6.7/12.8 · 0.8/4.9/11.4 · 0.7/7.9/14.8 · 0.8/4.8/8.6                                 | $12.0k to $23.2k | 4 to 12          | 2 to 23           | 0 to 3           | 0 of 6   | $411.5k to $951.4k (mean $546.7k)    | 1.2/1.2/1.2 · 1.2/1/1.1 · 1.1/1.2/1 · 1.2/1.1/1.2 · 1.2/1.1/1.1 · 1.2/1.1/1.2     | 50k→0k · 50k→0k · 50k→0k · 50k→0k · 50k→0k · 50k→0k |
| The Exchange, good          | 15.7/19.4/25.6 · 8.6/12.6/15.2 · 3.8/8.2/13.7 · 7.6/11.6/15.5 · 3.9/11.3/20.9 · 6.6/12.5/15.9                          | $18.9k to $32.6k | 4 to 8           | 24 to 30          | 0                | 0 of 6   | $656.8k to $1165.5k (mean $977.7k)   | 1.4/1.3/1.4 · 1.2/1.4/1.4 · 1.4/1.4/1.4 · 1.3/1.4/1.4 · 1.2/1.4/1.4 · 1/1.4/1.4   | 10k→0k · 20k→0k · 45k→0k · 15k→0k · 40k→0k · 35k→0k |
| The Exchange, hoarder       | –/–/– bankrupt day 791 · 47.7/–/– · 11.7/17.1/21.2 · –/–/– bankrupt day 821 · 23.7/30.6/35.5 · –/–/– bankrupt day 641  | $13.5k to $29.8k | 5 to 25          | 29 to 30          | 0                | 3 of 6   | $530.5k to $1093.8k (mean $818.9k)   | – · 1.6/1.6/1.6 · 1.6/1.6/1.6 · – · 1.4/1.6/1.6 · –                               | 50k→✗ · 0k→0k · 0k→0k · 50k→✗ · 0k→0k · 50k→✗       |
| The Exchange, grower        | 12.6/15.6/19.5 · 14.6/20.0/27.3 · 3.0/13.4/26.7 · 6.7/10.8/16.4 · 2.9/7.0/– bankrupt day 281 · 6.5/9.8/16.6            | $8.8k to $24.3k  | 6 to 13          | 1 to 30           | 0 to 6           | 1 of 6   | $268.8k to $914.9k (mean $688.7k)    | 1.2/1.2/1.2 · 1.2/1.1/1.2 · 1.1/1.1/1.2 · 1.2/1.2/1.2 · – · 1.2/1.2/1.2           | 15k→0k · 30k→0k · 50k→0k · 50k→0k · 50k→✗ · 50k→0k  |
| The Boardwalk, good         | 4.8/12.0/17.7 · 4.3/12.9/18.8 · 4.3/9.9/19.0 · 4.0/38.0/– · 4.2/27.8/34.1 · 5.8/9.0/16.2                               | $2.7k to $29.3k  | 4 to 19          | 0 to 8            | 2 to 17          | 0 of 6   | $124.9k to $1121.6k (mean $657.2k)   | 1.4/1.4/1.4 · 1.4/1.3/1.4 · 1.4/1.3/1.3 · 1.2/1.1/1 · 1.3/1.3/1.3 · 1.4/1.4/1.4   | 30k→0k · 30k→0k · 30k→0k · 30k→0k · 30k→0k · 35k→0k |
| The Boardwalk, hoarder      | 4.6/15.8/36.7 · 4.6/23.8/37.2 · 5.6/15.7/26.4 · 5.0/–/– · 10.4/26.9/46.8 · 4.4/–/–                                     | $4.0k to $15.1k  | 6 to 19          | 0 to 2            | 6 to 13          | 0 of 6   | $166.6k to $577.2k (mean $390.9k)    | 1.3/1/1 · 1.6/1.6/1.3 · 1.6/1/1 · 1.3/1.3/1.6 · 1.1/1.6/1.1 · 1/1.3/1.3           | 0k→0k · 0k→0k · 0k→0k · 0k→0k · 0k→0k · 0k→0k       |
| The Boardwalk, grower       | 5.6/–/– bankrupt day 1001 · 4.7/–/– bankrupt day 791 · 4.5/25.9/38.8 · 7.0/11.8/22.2 · 3.9/22.9/35.2 · 4.5/–/–         | $0.8k to $12.7k  | 8 to 22          | 0 to 21           | 0 to 14          | 2 of 6   | −$18.2k to $449.1k (mean $141.6k)    | – · – · 1.4/1/1 · 1.2/1.1/1.2 · 1.1/1.2/1.2 · 1.2/1.2/1.1                         | 50k→✗ · 50k→✗ · 50k→40k · 50k→0k · 50k→0k · 50k→20k |
| High Pines, good            | 4.9/10.1/16.1 · 4.6/12.9/27.9 · 3.7/8.2/27.2 · 4.1/8.6/20.6 · 4.0/–/– bankrupt day 281 · 5.6/10.2/18.3                 | $7.2k to $34.6k  | 5 to 15          | 2 to 30           | 0 to 9           | 1 of 6   | $294.2k to $1227.0k (mean $649.7k)   | 1.4/1.4/1.4 · 1.3/1.4/1 · 1.4/1.4/1.4 · 1.4/1.4/1.4 · – · 1.4/1.4/1.3             | 40k→0k · 30k→0k · 50k→0k · 40k→0k · 50k→✗ · 40k→0k  |
| High Pines, hoarder         | 9.1/26.9/– · 4.5/15.0/25.2 · 5.0/26.9/33.4 · 3.9/20.9/28.1 · 4.1/22.8/28.8 · 4.3/10.7/18.6                             | $17.6k to $36.3k | 5 to 10          | 11 to 30          | 0 to 1           | 0 of 6   | $648.9k to $1357.3k (mean $1032.8k)  | 1/1.6/1.6 · 1.3/1.6/1.6 · 1.1/1.6/1.6 · 1.2/1.6/1.6 · 1.2/1.6/1.6 · 1.6/1.6/1.6   | 0k→0k · 0k→0k · 0k→0k · 25k→0k · 0k→0k · 0k→0k      |
| High Pines, grower          | 4.4/7.7/20.3 · 4.9/8.0/– bankrupt day 311 · 3.9/–/– bankrupt day 190 · 4.3/–/– · 3.9/9.4/16.7 · 5.7/9.7/15.4           | $2.6k to $26.4k  | 4 to 23          | 12 to 30          | 0 to 1           | 2 of 6   | $56.8k to $943.7k (mean $536.1k)     | 1.2/1.2/1.2 · – · – · 1.1/1/1 · 1.1/1.2/1.1 · 1.2/1.2/1.2                         | 50k→0k · 50k→✗ · 50k→✗ · 50k→0k · 50k→0k · 50k→0k   |
| The Orchard Estate, good    | 6.5/11.1/17.7 · 4.6/9.8/16.5 · 4.6/9.4/17.1 · 5.9/10.4/16.8 · 5.0/10.8/17.1 · 4.9/9.1/16.9                             | $50.2k to $80.8k | 3 to 6           | 21 to 30          | 0                | 0 of 6   | $1775.6k to $2897.5k (mean $2324.4k) | 1.4/1.4/1.4 · 1.3/1.4/1.4 · 1.4/1.4/1.4 · 1.4/1.4/1.4 · 1.4/1.4/1.4 · 1.4/1.4/1.4 | 50k→0k · 50k→0k · 50k→0k · 50k→0k · 50k→0k · 50k→0k |
| The Orchard Estate, hoarder | 5.4/12.8/21.0 · 12.0/18.8/25.7 · 8.3/14.5/20.0 · 8.4/18.7/24.8 · –/–/– · –/–/–                                         | −$0.8k to $88.7k | 6 to 31          | 3 to 28           | 0 to 27          | 0 of 6   | −$36.7k to $3115.5k (mean $1625.1k)  | 1.5/1.6/1.6 · 1/1.5/1.6 · 1.3/1.6/1.6 · 1.1/1.1/1.6 · 1/1/1 · 1/1/1               | 0k→0k · 0k→0k · 5k→0k · 0k→0k · 25k→20k · 40k→40k   |
| The Orchard Estate, grower  | –/–/– bankrupt day 130 · 4.1/10.3/18.5 · –/–/– bankrupt day 41 · –/–/– bankrupt day 41 · 3.6/10.7/16.6 · 4.6/11.9/20.0 | $42.0k to $46.0k | 1 to 6           | 11 to 30          | 0 to 1           | 3 of 6   | $1476.8k to $1584.3k (mean $1512.9k) | – · 1.2/1.2/1.2 · – · – · 1.1/1.2/1.2 · 1.2/1.2/1.2                               | 50k→✗ · 50k→0k · 50k→✗ · 50k→✗ · 50k→0k · 50k→0k    |

**Is there a dominant strategy?** No. No style is never lost and richest everywhere. Taking the 30 center-and-seed pairs one at a time, the good bot ends with the most money in 16, the hoarder in 12 and the grower in 2. The good bot earns its stars soonest in 20, the grower in 8 and the hoarder in 2, and the good bot is both richest and fastest in 13. Games lost: the good bot 1 of 30 (High Pines, seed 5, day 281), the hoarder 5 (Willow Lane 2, The Exchange 3) and the grower 8 (The Orchard 3, The Boardwalk 2, High Pines 2, The Exchange 1). The good bot is the best all-rounder, not a dominant strategy: the hoarder ends richer at High Pines in five seeds of six, and at Willow Lane in four of the six seeds it survives. Every style has a center where it is the wrong one. That is the shape the research asks for. The losses are not all equally fair:

- The hoarder's losses come slowly and in plain view. At The Exchange, seed 1, it stays at two treatment rooms and four staff, with four to seven guests a month, and borrows at ten paydays over twenty months, each with the five-day warning, before the end on day 791.
- Three of the grower's are the cliff entry 27 was meant to remove. At The Orchard, seeds 3 and 4, it borrows the whole $50,000 on day 0, builds ten rooms, spends $113,000 in its first month and is lost on day 41. A player can do the same, and nothing at the moment of borrowing shows what the first payday will come to.

**Does the hoarder match the good bot on stars?** No. Its third star comes later nearly everywhere:

| Center        | Good bot, third star (month)      | Hoarder                                           |
| ------------- | --------------------------------- | ------------------------------------------------- |
| The Boardwalk | 16 to 19 (one seed 34, one never) | 26 to 47, and two seeds never reach a second      |
| The Exchange  | 14 to 26                          | 21 and 36 in the two seeds that earn one          |
| High Pines    | 16 to 28                          | 19 to 33                                          |
| The Orchard   | 16 to 18                          | 20 to 26, with two seeds that earn no star at all |

Willow Lane is mixed (8 to 19 against 11 to 17). So stars do need what the hoarder gives up: marketing, borrowing and building early. A one-month payback also did not stop it building in the end: by year 4 it has as many rooms as the good bot at Willow Lane (7.8 against 7.0) and High Pines (11.5 against 11.4), and fewer only at The Boardwalk (8.8 against 10.3) and The Orchard (10.0 against 13.0). The audit's demand-coupling finding holds for the money, though. Nobody is ever turned away in year 4, in any game. Across styles, a room more brings 1.5 to 2 more guests a month (The Exchange: 8.4, 9.0 and 9.6 rooms bring 14.4, 15.9 and 16.0 guests). Only The Orchard pays clearly for size (13 rooms, 21.8 guests; 10 rooms, 15.1 guests). The hoarder's smaller, dearer center makes more money in year 4 than the good bot at Willow Lane ($25.7k a month against $17.9k), The Exchange ($35.2k against $29.2k) and High Pines ($36.7k against $20.0k). So building buys stars sooner, and a small center buys more money.

**How much of the income is side income, and does it win alone?** Classes and house calls as a share of all income in year 4, over the games not lost:

| Style    | Willow Lane | The Exchange | The Boardwalk | High Pines | The Orchard |
| -------- | ----------- | ------------ | ------------- | ---------- | ----------- |
| Good bot | 14%         | 22%          | 22%           | 13%        | 16%         |
| Hoarder  | 24%         | 30%          | 19%           | 19%        | 24%         |
| Grower   | 23%         | 26%          | 10%           | 8%         | 15%         |

Emergency rewards and prizes add another 4% to 17%. Side income is larger than the whole year-4 profit in only 9 of the 76 games not lost (5 at The Boardwalk). So no style wins on side income alone. But the hoarder's edge is side income:

- At Willow Lane and The Exchange its year-4 profit beats the good bot's by $7.8k and $6.0k a month, against $6.2k and $6.0k more side income.
- Most of that is the Qi Gong Studio. The good bot fills Willow Lane with treatment rooms and never fits one ("could not fit a qigong", month after month), so its class income there is 0%.
- The hoarder, building less early, fits a studio in its second year. At seed 2 the studio brings in $16k to $22k a month against $9k to $24k from every treatment room together.

A Qi Gong Studio is the best room in the game wherever it fits. The money one Instructor brings in is the audit's recommendation 6, confirmed.

**Where do the price levels settle?** At whatever cap the style sets:

- The good bot is at 1.4 in its last month in 25 of its 29 games.
- The grower is at its 1.2 cap in nearly every month after the first year.
- The hoarder is at 1.6 in every High Pines game, and elsewhere moves between 1.0 and 1.6 only because its reputation rules pull it down when reputation falls.

No style's guests are put off enough to stop it. From the second year on, prices put off 1.6% to 5.8% of arrivals for the good bot, 3.4% to 5.9% at the hoarder's 1.6, and 1.1% to 3.4% for the grower. None reaches even the good bot's 10% target, let alone the hoarder's 20%. So the sweet spot is the cap because there is no sweet spot: between 1.0 and 1.6 a higher price costs nothing but reputation, and the reputation cost comes from results, not from the price.

**What the game should change** (none of it changed here):

- **Demand with the building** (audit recommendation 5): arrivals that rise with each staffed treatment room, and a guest limit that binds. Nobody turned away in four years means the building's size limits nothing. The test is a hoarder that falls behind the good bot in money at every center, not only at The Orchard, while a well-run small center still earns its stars.
- **Side income** (recommendation 6): bring a Qi Gong Studio's take per Instructor down toward one treatment room's. Today it is the room that makes a cautious player rich, and the one a busy player never has room for. House calls, at 7% to 22% of income, are in line.
- **Prices with a cost:** let the share of guests put off climb steeply above about 1.3, so 1.6 puts off one in five, not one in twenty. The Money menu already counts the guests put off this month and last, and each treatment's price row counts its own, so the lever and its cost would be in sight. This is harder for the player who sets the cap and forgets it, and fair, because the cost shows before it bites.
- **The bank's loan before opening:** before lending, show what the first payday will come to beside the cash it leaves. A lender that hands out $50,000 on day 0 to a center lost 41 days later is a loss the player could not see coming. Do not lower the limit; the challenge stays and the warning comes first.
- **Late money:** every style still ends with $0.4M to $3.1M. Recommendation 5 is the place to start, since money with more guests to spend it on is a goal; the audit's other sinks wait on that.

## 21 October 2026: does a player who does what the game says survive?

The research's test of the communication pass ([research/fair-challenge.md](../research/fair-challenge.md)) is that a player who does what the game tells them survives. Measured with `yarn balance` on `integrate-audit` at `1a6de22`, every campaign center, seeds 1 to 3, four years, in the same terms as entry 31.

### 32. An advised player beside the baseline: the warnings work, the advisor's growth advice does not

**Found:** nothing measured whether the warnings and the advisor are actionable: entry 31 has a good player and a player who reads nothing, and no player who reads and does as told.

**Done** (`tests/balance/bot.ts`): `BOT=advised yarn balance` plays as the thoughtless baseline and, on top, does exactly what the game's toasts (read from the events drained each tick) and `sim.adviceNote()` (once a day) say, by the words each uses, and nothing they do not:

- a payday warning whose verdict is short past what the bank will lend: prices up 0.1 (to 1.4 at most), and if it says the books lose money, the least busy practitioner let go in a role with two or more;
- the bank calling the overdraft in: the same every day of the countdown (from the advisor's countdown, or the bank's last toast when the advisor is saying something else) until the bank says it no longer is;
- a line warning or the advisor's "goes home worse off" about a guest: that guest to the front of their line, or home if it says about 1 day;
- the summer notice: the good bot's `throttle()` (three guests a staffed table, two a consulting room, three) until autumn; the winter notice: one spare practitioner let go;
- the bottleneck advice: another of that room or desk, with someone to work it, when its cost is in the bank (a room let go of earlier is staffed first), or a hire when it says to hire another or that its staff keep being called away; at most once in the three days the advice looks back over;
- "a loan is cheaper", and the month-end red toast's "borrow it from the Money menu": one loan step; "Build a Staff Room" and "Hire a …": that; the comfort asks as the baseline already answers them.

Every action is noted with the words that caused it (`day 270: "The bank calls the overdraft in in 10 days: …" → let a therapist go`), with the note limit raised to 3,000 for this persona. The good bot's and the baseline's games are unchanged, star day for star day, from entry 31.

**Result,** the thoughtless baseline, the advised persona and the good bot. Bankruptcies are of the three seeds, with the day:

| Center             | Bot      | Stars at month (seed 1 · 2 · 3)                               | Profit a month     | Months at a loss | Lowest reputation | Months below 15% | Bankrupt           |
| ------------------ | -------- | ------------------------------------------------------------- | ------------------ | ---------------- | ----------------- | ---------------- | ------------------ |
| Willow Lane        | baseline | 3.1/–/– · 0.9/bankrupt day 581 · 0.7/–/–                      | −$5.9k to −$0.4k   | 12 to 32         | 7 to 30           | 0 to 4           | 1 (day 581)        |
|                    | advised  | 3.1/bankrupt day 671 · 0.9/bankrupt day 281 · 0.7/–/–         | −$0.7k to −$0.0k\* | 7 to 32          | 17 to 30          | 0                | 2 (days 281, 671)  |
|                    | good     | 1.1/8.9/15.0 · 0.9/8.0/10.9 · 0.7/4.9/12.1                    | $17.2k to $22.9k   | 6 to 12          | 3 to 7            | 1 to 4           | 0                  |
| The Exchange       | baseline | 7.7/–/– · 6.9/–/– · 5.8/–/–                                   | $0.7k to $5.0k     | 10 to 23         | 30                | 0                | 0                  |
|                    | advised  | 5.7/–/– · 6.7/–/– · 4.8/–/–                                   | $0.1k to $5.9k     | 11 to 26         | 30                | 0                | 0                  |
|                    | good     | 15.7/19.4/25.6 · 8.6/12.6/15.2 · 3.8/8.2/13.7                 | $23.4k to $30.8k   | 6 to 8           | 30                | 0                | 0                  |
| The Boardwalk      | baseline | 9.9/9.9/bankrupt day 1390 · 8.8/15.0/– · 3.9/bankrupt day 851 | −$3.0k to $0.7k    | 19 to 30         | 30                | 0                | 2 (days 851, 1390) |
|                    | advised  | 18.9/19.3/bankrupt day 1001 · 8.8/9.8/– · 3.9/–/–             | −$2.5k to $2.6k    | 9 to 18          | 30                | 0                | 1 (day 1001)       |
|                    | good     | 4.8/12.0/17.7 · 4.3/12.9/18.8 · 4.3/9.9/19.0                  | $13.7k to $29.3k   | 4 to 9           | 0 to 4            | 2 to 6           | 0                  |
| High Pines         | baseline | 5.8/–/– · 6.7/–/– · 6.9/–/–                                   | −$1.4k to $1.7k    | 19 to 31         | 23 to 30          | 0                | 0                  |
|                    | advised  | 8.9/–/– · 8.8/–/– · 46.8/–/–                                  | −$1.2k to $0.7k    | 20 to 28         | 23 to 30          | 0                | 0                  |
|                    | good     | 4.9/10.1/16.1 · 4.6/12.9/27.9 · 3.7/8.2/27.2                  | $7.2k to $34.6k    | 7 to 15          | 2 to 30           | 0 to 9           | 0                  |
| The Orchard Estate | baseline | –/–/– · –/–/– · –/–/–                                         | −$1.3k to −$0.6k   | 32 to 35         | 1 to 2            | 28 to 43         | 0                  |
|                    | advised  | bankrupt day 1420 · –/–/– · –/–/–                             | −$1.4k to −$0.6k   | 32 to 36         | 1 to 2            | 28 to 43         | 1 (day 1420)       |
|                    | good     | 6.5/11.1/17.7 · 4.6/9.8/16.5 · 4.6/9.4/17.1                   | $50.2k to $80.8k   | 3 to 6           | 21 to 30          | 0                | 0                  |

\* Willow Lane's advised seeds 1 and 2 end in months 22 and 9, so their profit is of the few months from the second year they lasted (seed 2 has none).

Guests sent home worse off, all three seeds together, baseline → advised: Willow Lane 4 → 0, The Exchange 6 → 2, The Boardwalk 5 → 6 (over 8 more months played), High Pines 9 → 0, The Orchard 0 → 0.

**Per center, does the advised player do better than the baseline?**

- **Willow Lane: no, worse.** Two games lost against one, and seed 2 lost in month 9 rather than month 19. The signal that failed is the bottleneck advice: in seed 2 it said a Massage Suite with 5 to 7 waiting needed another therapist (days 79 and 82) and a Consultation Room with 4 waiting needed another consultant, whose staff "keep being called away" (days 124 and 127), and the payroll went from $6.2k to $18.1k (the baseline's stays at $8.9k) against takings of $10k to $11k a month. The payday warning then said to let staff go, and the bot did, but only practitioners in a role with two, and the countdown that followed (day 270) ran out on day 281 with prices at 1.4 and three therapists let go in six days: the extra consultants are not practitioners and stayed. Seed 1 shows the two signals working against each other: from day 451 each payday warning has a therapist let go and, days later, the bottleneck advice has the empty Massage Suite staffed again (days 484 and 559), four times over until the bank calls the overdraft in on day 660. Seed 3, where the bottleneck spoke twice, does better than the baseline: 376 healed against 238, and no one sent home worse off.
- **The Exchange: yes, a little.** The first star comes sooner in every seed (5.7, 6.7, 4.8 against 7.7, 6.9, 5.8), with no game lost either way and profit much the same; the bottleneck and line warnings spoke rarely (4 to 14 notes a game). Its second star needs acupuncture, and "Acupuncture is now available. Build an Acupuncture Clinic and hire an Acupuncturist" was the advisor's nudge on 2,345 of the 4,320 days of its three games: a lever outside this persona's list, so neither persona gets further.
- **The Boardwalk: yes.** One game lost against two, months at a loss 9 to 18 against 19 to 30, and seed 3 plays out the four years (the baseline's is lost on day 851) with 463 healed against 229. The summer notice and the winter notice are the signals that helped: the limit on guests at once and a therapist let go before each winter. Seed 1 is lost sooner (day 1001 against 1390): the beach-facing wing bought on day 569 and the ice-cream parlor for $13,500 on day 950 (the baseline's own building, which both share) put the bank $17.8k into the red at a payday, past what the bank would lend, and $22k in the red with ten days is past either lever. On 2,098 of the 4,320 days of its three games the advisor said "A Air Conditioner has broken down. Your Caretaker will get to it", which sits above the bottleneck, loan and staff advice and stops them being given at all.
- **High Pines: no, worse.** No game lost either way, but the first star at months 8.9, 8.8 and 46.8 against 5.8, 6.7 and 6.9. The bottleneck advice again: in seed 3 it had a second and a third Consultation Room built on lines of 4 (days 107 and 118), with two consultants and two therapists hired in the same fortnight, so the payroll went from $9.9k to $18.0k with 17 guests a month, and the star's $25,000 in the bank took three more years. It does heal more (581 against 289 in seed 3) and nobody goes home worse off.
- **The Orchard Estate: no change.** Seeds 2 and 3 play as the baseline's to within a guest: the advisor never says anything this persona acts on (on every day it names a treatment nobody is qualified in, or acupuncture, and never the prestige these guests judge by). Seed 1 is lost on day 1420, a month before the end: the month-end red toast's "borrow it from the Money menu" had it take the last loan step at day 1380, so the next payday had no loan to cover it and went into the red with the books losing money; the baseline is one payday behind on the same road.

**What this says about the communication:** the warnings are actionable and the advisor's growth advice is not. The line warnings did what they promised: guests sent home worse off fall from 24 to 8 over the campaign (in 632 months played against 660). The season notices are the reason the Boardwalk is better. The payday warning names the right levers but cannot be acted on in time once a payroll is twice the takings. The bottleneck advice is what loses games: at a line of 4 (`BOTTLENECK.line`) it asks for another room or another member of staff with no regard for whether the takings can carry them, and the payday warning then asks for the same staff to go.

**Recommendations, for a later session (nothing changed here):**

1. The bottleneck advice should weigh the payroll: when `cashflow(s).net` would not carry the hire's salary (or the room's practitioner) at the pace, say so ("another therapist would cost $1,750 a month you are not making: prices up first") rather than ask for the hire. And "keep being called away" with a role's staff at or above its stations should name the Staff Room before another hire.
2. The overdraft countdown's "prices up" cannot work in ten days: the bank judges `cashflow`'s income pace, this month and last over the days they cover, so ten days at a higher price are a quarter of it, and a 40% rise lifts the pace by about a tenth. Staff down is the lever that works in time; the text should say so, or the bank should judge the price going forward.
3. "Staff down" should name who: the persona let go only practitioners in a role with two, and the extra consultants the bottleneck advice had hired stayed. The countdown could name the least busy member of staff, as the bottleneck already names the station.
4. A broken item the Caretaker never reaches (The Boardwalk's Air Conditioner, 2,098 days over three games) should drop below the advice it hides, or say why it is not being reached; and "A Air Conditioner" wants "An".
5. The month-end red toast's "borrow it" should not be given while the books lose money: it spends the loan room the next payday needs, and moves the end a payday forward (The Orchard seed 1).
6. A next persona could act on the advisor's training and new-discipline nudges too ("nobody is qualified … train", "Acupuncture is now available"), which are its most frequent nudge everywhere and the way to every second star, to see whether the advisor carries a player that far.

## 20 October 2026, night: challenging but fair

The deep-dive audit ([audits/deep-dive-audit.md](../audits/deep-dive-audit.md)) found the campaign's hard moments unfair rather than hard: a loss the player could not see coming, a reputation that only ever spirals, a summer with no lever against it, and goals that reward running empty. The rule for this pass, from [research/fair-challenge.md](../research/fair-challenge.md): the game must not get easier; it must warn before it punishes, name the lever, and leave time for it to work. Each change below was measured with `yarn balance` (every campaign center, seeds 1 to 3, four years a game) before and after, on the audit's bug-fix branch at `435febd`. Stars at month are given seed by seed; profit a month is averaged from the second year on; months at a loss, the lowest reputation (sampled daily) and months below 15% are of all 48. The bot plays like a good player; a new player does worse everywhere.

### 31. A thoughtless baseline beside the good bot, and the pass measured together

**Found:** every number in this log is the playtest bot's, and it plays like a good player: prices by how many guests they put off, marketing, rooms on the profit they are expected to make, house calls, staff let go and taken back on. The research's question is what the game does to the player who does none of that, since the audit's cliffs (a bankruptcy three days after a payday, a reputation that only spirals, a summer with no lever) hit that player first. Nothing measured it.

**Done** (`tests/balance/bot.ts`, `tests/balance/playtest.balance.ts`):

- `BOT=baseline yarn balance` plays a thoughtless new player (`BotMode`): the opening build (a desk, a consulting room, a massage room, two benches), then raises and promotions when asked for, every emergency taken and every house call and outbreak turned down, fines paid, nothing done about a mishap, the staff room, restroom and drinks the advisor asks for, heating when it is cold, a room or a desk and someone to work it only once a line has formed for it and its cost is in the bank, with no reserve kept for the wages, and never a price changed, a course taken, a loan asked for beyond what payday forces, or anything built that a star unlocks.
- Every run's log records the first thing to go against the center once it was open (`firstAdverse`: its twist's first blow, a stress outbreak, a mishap, a failed inspection, the rival opening, or someone quitting) so a loss within a month of it can be seen.
- The good bot, when the bank calls the overdraft in, now adds nothing back for a month: it had taken a practitioner back on the day after letting one go to clear the countdown, and a High Pines game (seed 3) that did so three times went bankrupt on day 401 in the first measurement of entry 30; with the month's restraint it earns its third star at 27.2.

**Result,** the pass as a whole, on the audit's bug-fix branch at `435febd` (entry 27's "before") → after all five changes, the good bot; and the thoughtless baseline on the same code, which has no "before" because it did not exist:

| Center             | Stars at month (seed 1 · 2 · 3)                                                                      | Profit a month                       | Months at a loss  | Lowest reputation   | Months below 15% |
| ------------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------ | ----------------- | ------------------- | ---------------- |
| Willow Lane        | 1.4/11.0/14.7 · 1.1/5.7/9.7 · 0.7/5.7/7.9 → 1.1/8.9/15.0 · 0.9/8.0/10.9 · 0.7/4.9/12.1               | $17.1k to $17.9k → $17.2k to $22.9k  | 7 to 9 → 6 to 12  | 0 to 11 → 3 to 7    | 2 to 6 → 1 to 4  |
| The Exchange       | 7.9/12.1/17.6 · 16.7/19.3/19.3 · 9.7/17.0/17.0 → 15.7/19.4/25.6 · 8.6/12.6/15.2 · 3.8/8.2/13.7       | $30.5k to $39.9k → $23.4k to $30.8k  | 5 to 9 → 6 to 8   | 30 → 30             | 0 → 0            |
| The Boardwalk      | 4.6/9.8/bankrupt day 393 · 4.8/14.8/24.0 · 4.0/38.9/– → 4.8/12.0/17.7 · 4.3/12.9/18.8 · 4.3/9.9/19.0 | −$20.4k to $10.3k → $13.7k to $29.3k | 8 to 14 → 4 to 9  | 0 to 7 → 0 to 4     | 3 to 16 → 2 to 6 |
| High Pines         | 6.6/14.8/22.8 · 4.6/21.4/29.2 · 7.8/bankrupt day 333 → 4.9/10.1/16.1 · 4.6/12.9/27.9 · 3.7/8.2/27.2  | $20.1k to $24.8k → $7.2k to $34.6k   | 7 to 11 → 7 to 15 | 0 to 30 → 2 to 30   | 0 to 3 → 0 to 9  |
| The Orchard Estate | bankrupt day 63 · 63 · 93 → 6.5/11.1/17.7 · 4.6/9.8/16.5 · 4.6/9.4/17.1                              | – → $50.2k to $80.8k                 | – → 3 to 6        | 25 to 30 → 21 to 30 | 0 → 0            |

| Center, the baseline | Stars at month (seed 1 · 2 · 3)  | Profit a month   | Months at a loss | Lowest reputation | Months below 15% | First adverse event, and the month after it                                                             |
| -------------------- | -------------------------------- | ---------------- | ---------------- | ----------------- | ---------------- | ------------------------------------------------------------------------------------------------------- |
| Willow Lane          | 3.1/–/– · 0.9/–/– · 0.7/–/–      | −$5.9k to −$0.4k | 12 to 32         | 7 to 30           | 0 to 4           | the rival opening, day 45: −$6.1k, +$2.6k, −$0.6k; no loss. Seed 2 bankrupt on day 581                  |
| The Exchange         | 7.7/–/– · 6.9/–/– · 5.8/–/–      | $0.7k to $5.0k   | 10 to 23         | 30                | 0                | the first rush hour, day 3 (the opening month's −$27k is the building): no loss                         |
| The Boardwalk        | 9.9/9.9/– · 8.8/15.0/– · 3.9/–/– | −$3.0k to $0.7k  | 19 to 30         | 30                | 0                | the rival opening, day 45: −$1.8k, −$1.3k, +$1.8k; no loss. Seeds 1 and 3 bankrupt on days 1390 and 851 |
| High Pines           | 5.8/–/– · 6.7/–/– · 6.9/–/–      | −$1.4k to $1.7k  | 19 to 31         | 23 to 30          | 0                | snowed in, day 44: −$1.0k, +$2.6k, +$0.3k; no loss                                                      |
| The Orchard Estate   | –/–/– · –/–/– · –/–/–            | −$1.3k to −$0.6k | 32 to 35         | 1 to 2            | 28 to 43         | the rival opening, day 45: −$0.6k, −$4.4k, −$0.9k; no loss, and no bankruptcy in four years             |

No seed of either bot is lost within a month of its first adverse event, which is the cliff the pass was for. The baseline loses, when it loses, slowly and in sight: Willow Lane seed 2 borrows at nine paydays over eighteen months, with the five-day warning before each, before the bank calls the overdraft in on day 570 and the game ends on day 581; The Boardwalk's two bankrupt games take 28 and 46 months of a payroll (eight to ten staff at price level 1, with nobody trained, so half the treatments fail) that the takings never covered. It is not punished for standing still: with seven rooms, no marketing and waits of 1 to 4 days it earns the first star everywhere but The Orchard, and at The Exchange it earns it sooner than the good bot (5.8 to 7.7 against 3.8 to 15.7), because the new first-star goal is about keeping up. It never earns a second star where one needs what a star unlocks (acupuncture at The Exchange, sound healing at High Pines, reiki at The Boardwalk), and The Orchard Estate, where picky guests judge a plain massage room, holds it at a reputation of 1 to 2 for three years with six guests a month and no star: the center that is hardest for a player who reads nothing, and the one whose message (prestige, from the first day) the interface session's objective breakdown is for. The good bot's games against the start of the pass: The Orchard no longer goes bankrupt in its first three months; The Boardwalk and High Pines no longer lose a game each to a payday; every center earns its third star in every seed; The Exchange's stars come one after another; and the Boardwalk's reputation still falls to 0 to 4 in a summer that the bot, without the throttle, does nothing about (entry 29 measures the throttle at 4 to 30). The slope is as steep as it was; the floor, the warnings and the levers are new.

**What the player can now see that they could not before,** over the pass: five days before a payday, what the bank will do; in the red, the pace of the books and the days left; that a line is about to cost reputation, and which guests; a fortnight before a season, how many guests to expect; a month goal's figures; and, in the guide, the shape of the reputation scale. What a new player cannot see, by this measure, is that a star unlocks what the next star asks for, and that The Orchard's guests want prestige from day one: both are the interface session's, and both are in the objective breakdown's gift.

### 30. Goals that ask for guests treated promptly, not for a center run empty

**Found:** three goals asked guests to keep 90% or 93% of their patience through their visit, on average, for a month (The Exchange's first star, The Boardwalk's and High Pines' second). A center that is growing has a line; the goal paid for having none, which is the opposite of the game's own loop, and held a star for a year or more (the audit's finding 3: The Boardwalk's second star at months 24 to 27 or never, with the center's reputation at 0 under it). The cure-rate goals counted only treatments, so a guest sent home untreated cost nothing toward them. And at The Exchange the third star's goals were all met before the second's slow one (10 guests healed with acupuncture, months 12 to 18), so the two stars landed on the same day. The research's shape for a quality goal is a count with a floor: so many done, at no worse than such a standard, in the same month.

**Done** (`src/core/data/types.ts`, `src/core/data/centers.ts`, `src/core/sim/goals.ts`):

- A new kind of goal, `monthHeals`: "Heal N guests in a month, waiting D days or less on average", judged over this month so far or the last finished one like the cure rate, with `averageWaitDays(tally)` the wait of everyone who left that month. The Exchange's first star asks 8 in 5 days, The Boardwalk's second 14 in 6, High Pines' second 12 in 6. The `patience` goal is gone (`averagePatience` stays for the Stats menu's chart).
- `cureRate` counts guests sent home untreated in its denominator: healed over healed, failed and sent, so culling the hard cases is no way to a cure-rate star. The label says "of guests treated or sent home".
- The Exchange's stars are gated so none can land with another: ★2 asks for heal 45, 10 with acupuncture, a 75% cure rate and 70% reputation (reputation moved down from ★3); ★3 for heal 110, 20 with acupuncture (up from 10), an emergency seen through and $60,000. Acupuncture opens at ★1, so ★2 cannot come with it, and ★3's twenty cannot come with ★2's ten. First tried was the brief's swap (acupuncture 10 up to ★3, the emergency down to ★2): ★2 then waited on an emergency, which is luck (seed 1 saw none it could take until month 22.9), and ★2 and ★3 still landed together in two seeds; with 70% reputation in ★2 instead, ★1 and ★2 landed together in two seeds, since ★1's new goal is the slow one for a bot that grows on lines.
- `Objective.detail` carries the figures behind a goal judged over a month ("This month: 6 of 10 (60%). Last month: 9 of 10 (90%)", "This month: 4 healed, waiting 2.0 days. Last month: …") for the interface's objective breakdown.

**Result,** before (29) → after. The "after" bot also holds off growing for a month after the bank calls the overdraft in (entry 31); the games where that never happens are the same bot as before.

| Center             | Stars at month (seed 1 · 2 · 3)                                                                | Profit a month                      | Months at a loss    | Lowest reputation    | Months below 15%   |
| ------------------ | ---------------------------------------------------------------------------------------------- | ----------------------------------- | ------------------- | -------------------- | ------------------ |
| Willow Lane        | 1.1/8.9/15.0 · 0.9/8.0/10.9 · 0.7/4.9/12.1 (unchanged)                                         | $17.2k to $22.9k (unchanged)        | 6 to 12 (unchanged) | 3 to 7 (unchanged)   | 1 to 4 (unchanged) |
| The Exchange       | 12.0/21.6/21.6 · 8.7/12.2/14.9 · 7.7/11.8/16.8 → 15.7/19.4/25.6 · 8.6/12.6/15.2 · 3.8/8.2/13.7 | $27.2k to $29.8k → $23.4k to $30.8k | 7 to 8 → 6 to 8     | 5 to 30 → 30         | 0 to 2 → 0         |
| The Boardwalk      | 4.8/22.8/34.8 · 4.3/12.6/23.3 · 4.3/10.7/16.3 → 4.8/12.0/17.7 · 4.3/12.9/18.8 · 4.3/9.9/19.0   | $12.0k to $38.2k → $13.7k to $29.3k | 4 to 9 (unchanged)  | 1 to 25 → 0 to 4     | 0 to 5 → 2 to 6    |
| High Pines         | 4.9/10.1/16.1 · 4.6/13.8/27.6 · 3.7/8.3/27.7 → 4.9/10.1/16.1 · 4.6/12.9/27.9 · 3.7/8.2/27.2    | $3.5k to $34.6k → $7.2k to $34.6k   | 7 to 21 → 7 to 15   | 0 to 30 → 2 to 30    | 0 to 11 → 0 to 9   |
| The Orchard Estate | 6.5/11.1/17.7 · 4.6/9.8/16.5 · 4.6/9.4/17.1 (unchanged)                                        | $50.2k to $80.8k (unchanged)        | 3 to 6 (unchanged)  | 21 to 30 (unchanged) | 0 (unchanged)      |

Goal by goal: The Exchange's first star now comes at months 15.7, 8.6 and 3.8 against 12.0, 8.7 and 7.7 (the same on average, 9.4 against 9.5), and it is always the month goal that holds it, since this bot's average wait runs 6.7 to 8.2 days over a game (it markets, and builds on lines); the thoughtless baseline of entry 31, with seven rooms and no marketing, waits 2 to 4 days and earns the star at 5.8 to 7.7. Its stars now come one after another in every seed (★2 at 19.4, 12.6 and 8.2, ★3 at 25.6, 15.2 and 13.7), ★2 held by the ten acupuncture heals and ★3 by the twenty, where before ★2 and ★3 landed on one day in seed 1 and the third came at 21.6, 14.9 and 16.8. The Boardwalk's second star comes at 12.0, 12.9 and 9.9 against 22.8, 12.6 and 10.7: two seeds the same, and seed 1 eleven months sooner, which is the year-long hold of the audit's finding 3 going, not an easing: the month goal is still the last of the three met, three to four months after heal 70 (8.9, 8.1, 7.5) and the cure rate (5.5, 4.5, 4.9). Its third star follows at 17.7 to 19.0 (was 16.3 to 34.8) because the fifteen reiki heals need the studio ★2 opens. High Pines' second star is held by heal 70 and the ten sound-healing heals, not by the month goal (met at 9.6 and 7.9 where it was not the last), so its stars are within a month of before. Willow Lane's and The Orchard's games are identical move for move: the cure-rate change costs nobody a star, since the bot sends nobody home. The Boardwalk's lowest reputation is worse on paper (0 to 4 against 1 to 25): with its second star a year sooner the center is bigger by its second summer, and seeds 2 and 3 now take the summer collapse of entry 29 that seed 1 took before; the lever for it is entry 29's, not a goal.

**What the player can now see that they could not before:** what a month goal is measuring, in figures, for this month and last (how many healed and how long they waited; how many healed of how many judged), so a star that is three heals or two days away reads as such; and that sending a guest home counts against the cure rate, in the goal's own words. `averageWaitDays`, `cureRate` and `Objective.detail` are there for the objective breakdown.

### 29. The seasons come with numbers, and a limit on guests at once

**Found:** The Boardwalk's summer brought 1.9 times the guests with no warning but a line in the bottom bar as it started, and a center that could not grow in time had no lever against it: every summer put 30 to 40 guests into a 9- or 10-room center, the wait ran past 20 days, and a dozen guests a month went home worse off at −6 each (entry 28's seed 6 went from 96 to 6 in one month). The research asks for the surge to be announced with figures and for a throttle: a way to take fewer guests on purpose, at a cost the player can see. The summer stays at 1.9 and the winter at 0.5; the seasons are not softened.

**Done** (`src/core/sim/twists.ts`, `src/core/sim/guests.ts`):

- `seasonOutlook(s, season)` says what a season means in guests a month: last month's arrivals scaled by the season's factor against the one they came in under. A fortnight before each summer and winter (`SEASON_AHEAD_DAYS`, 14, a dozen days more than a hire or a room takes) the message says so with the numbers and names the levers (rooms, staff, a limit on guests at once; in winter, the wages to budget for), and each season starts with its numbers rather than a line.
- An **intake cap** (`intakeCap`, set with `setIntakeCap`, read with `intakeLimit`, never below `INTAKE_CAP_MIN` of 4): the center lets in no more guests at once than the cap, below what the building takes. A guest who finds it full goes elsewhere, counted as `turnedAway` in the month and the game's stats (the Stats menu's "Found it full"), with their fee. A minimal control sits under the Money menu's Prices (−2, +2, no limit) until the interface session builds its own; the sim side is the rule.
- The bot, as a good player, can be told to throttle (`BOT_ON=throttle`): from a fortnight before summer until autumn it caps intake at three guests per staffed treatment table, two per consulting room and three more, and counts the guests it turned away last month toward what a new room is worth, since a throttled center has no line to build on.

**Result,** before (28) → after, the default bot: identical, every center, every seed. The messages change nothing the bot does, and the cap is off unless it is told to use it.

| Center             | Stars at month (seed 1 · 2 · 3)                            | Profit a month               | Months at a loss    | Lowest reputation    | Months below 15%    |
| ------------------ | ---------------------------------------------------------- | ---------------------------- | ------------------- | -------------------- | ------------------- |
| Willow Lane        | 1.1/8.9/15.0 · 0.9/8.0/10.9 · 0.7/4.9/12.1 (unchanged)     | $17.2k to $22.9k (unchanged) | 6 to 12 (unchanged) | 3 to 7 (unchanged)   | 1 to 4 (unchanged)  |
| The Exchange       | 12.0/21.6/21.6 · 8.7/12.2/14.9 · 7.7/11.8/16.8 (unchanged) | $27.2k to $29.8k (unchanged) | 7 to 8 (unchanged)  | 5 to 30 (unchanged)  | 0 to 2 (unchanged)  |
| The Boardwalk      | 4.8/22.8/34.8 · 4.3/12.6/23.3 · 4.3/10.7/16.3 (unchanged)  | $12.0k to $38.2k (unchanged) | 4 to 9 (unchanged)  | 1 to 25 (unchanged)  | 0 to 5 (unchanged)  |
| High Pines         | 4.9/10.1/16.1 · 4.6/13.8/27.6 · 3.7/8.3/27.7 (unchanged)   | $3.5k to $34.6k (unchanged)  | 7 to 21 (unchanged) | 0 to 30 (unchanged)  | 0 to 11 (unchanged) |
| The Orchard Estate | 6.5/11.1/17.7 · 4.6/9.8/16.5 · 4.6/9.4/17.1 (unchanged)    | $50.2k to $80.8k (unchanged) | 3 to 6 (unchanged)  | 21 to 30 (unchanged) | 0 (unchanged)       |

**The throttle, measured:** The Boardwalk, seeds 1 to 6, the bot without and with `throttle`:

| Seed | Stars at month, no throttle → throttle | Profit a month  | Months at a loss | Lowest reputation | Months below 15% |
| ---- | -------------------------------------- | --------------- | ---------------- | ----------------- | ---------------- |
| 1    | 4.8/22.8/34.8 → 4.8/14.6/–             | $12.0k → $21.3k | 9 → 4            | 1 → 30            | 5 → 0            |
| 2    | 4.3/12.6/23.3 → 4.3/14.9/22.9          | $15.2k → $10.9k | 8 → 10           | 25 → 9            | 0 → 2            |
| 3    | 4.3/10.7/16.3 → 4.3/26.8/35.3          | $38.2k → $10.5k | 4 → 12           | 15 → 4            | 1 → 2            |
| 4    | 4.0/14.5/19.3 → 4.0/–/–                | $14.6k → $8.5k  | 11 → 8           | 2 → 9             | 3 → 1            |
| 5    | 4.2/12.8/18.0 → 4.2/13.7/21.7          | $17.8k → $32.7k | 6 → 6            | 26 → 22           | 0 → 0            |
| 6    | 5.8/9.7/16.4 → 5.8/–/–                 | $17.8k → $6.9k  | 9 → 9            | 0 → 17            | 6 → 0            |

The throttle does what it is for: no seed falls below 4 (without it, three of six fall to 0, 1 and 2), the months below 15% go from 15 in six games to 5, and the two games that collapsed hardest (seeds 1 and 6) keep their name all year. It is no free lunch, and in the bot's hands it costs growth: three of the six throttled games stay at 8 rooms for four years and never earn the third star (seed 4 not the second), and the six make $15,200 a month on average against $19,300, because the bot builds on lines and a capped center has none; the guests it turns away count toward a room, but a bot sure of its 8 rooms never spent on a ninth. A player told, a fortnight ahead, that 34 guests a month are coming against 19 can hire and build instead, which is the point of the numbers; the cap is for the summer the building cannot grow for, and a throttled center still carries a summer's wait (seed 6 throttled: 25 days in months 17 and 18 from 8 rooms, costing it 56 to 27 before the cap bit) when it is too small for its own winter.

**Why a seed still reaches 0% without the throttle:** seed 6's month 19 brought 40 guests into a 10-room, 10-staff center with 40 inside at once; in month 20 the average wait reached 24 days, 14 guests went home worse (−84) and 9 stormed out (−27), and reputation fell from 96 to 6 in the month, then to 0.2 in month 21 as the backlog of 11 more worsened and 5 more walked. A month of 111 points of loss is more than the floor's damping (three quarters at 10%) can hold; that is the rule working as entry 28 says it should, a center that lets 25 guests a month end their visit badly deserves its 0, and the lever against it is now announced two weeks before, with the figures, and sits in the Money menu. Seed 1 does the same at months 20 and 44, from 23 and 20 arrivals a month into 9 and 11 rooms.

**What the player can now see that they could not before:** a fortnight before each summer and winter, how many guests a month to expect against last month and what to do about it; each season's numbers as it starts; how many guests found the center full, by month and over the game; and a limit on guests at once they can set, with its cost in fees said plainly. `seasonOutlook`, `intakeLimit` and `setIntakeCap` are there for the interface's own control and a season panel.

### 28. Reputation is dampened toward both ends, and the line warns before it costs

**Found:** gains tapered as reputation climbed (`1.15 − rep/120`, so +1.15 of each point at 0 and +0.32 at 100) and losses never did, so the scale had a ceiling and no floor: a center on a 60% cure rate with one guest in ten storming out settled at about 30 and one on 50% sank to 0, where every summer at The Boardwalk and every bad month at High Pines ended. And nothing said a line was about to cost reputation until a guest went home worse off at −6. The research's shape is CorsixTH's: below the midpoint every gain lands, above it every loss does, and each is damped toward its end of the scale.

**Done** (`changeRep`, `gainDamping` and `lossDamping` in `src/core/sim/economy.ts`, `REP_DAMPING` in `src/core/data/stakes.ts`): a gain lands in full up to 50%, then counts less, to two fifths at 90% and nothing at 100%; a loss lands in full down to 50%, then counts less, to three quarters at 10% and nothing at 0%. The per-event costs (failure −2.5, walk-out −3, worse off −6, quit −2) are as they were. Tuned on a probe of a center treating 15 guests a month with a tenth storming out: on a 60% cure rate it now settles at about 56 (was 30), on 50% it still sinks to about 13, on 70% at 75 (was 63), and on 90% at 96 rather than a flat 100, so a good name takes keeping (`tests/unit/stakes.test.ts` holds the probe). The line signal: `lineAtRisk(s, days)` lists the waiting guests whose condition runs out within so many days (`WORSE_AHEAD_DAYS`, 5), soonest first; the first time each month it is non-empty a message names the first of them and the cost, and the advisor counts them until the line is seen to.

**Result,** before (27) → after:

| Center             | Stars at month (seed 1 · 2 · 3)                                                                     | Profit a month                      | Months at a loss  | Lowest reputation   | Months below 15% |
| ------------------ | --------------------------------------------------------------------------------------------------- | ----------------------------------- | ----------------- | ------------------- | ---------------- |
| Willow Lane        | 1.4/11.0/14.7 · 1.1/5.7/9.7 · 0.7/5.7/7.9 → 1.1/8.9/15.0 · 0.9/8.0/10.9 · 0.7/4.9/12.1              | $17.1k to $17.9k → $17.2k to $22.9k | 7 to 9 → 6 to 12  | 0 to 11 → 3 to 7    | 2 to 6 → 1 to 4  |
| The Exchange       | 7.9/12.1/17.6 · 16.7/19.3/19.3 · 9.7/17.0/17.0 → 12.0/21.6/21.6 · 8.7/12.2/14.9 · 7.7/11.8/16.8     | $30.5k to $39.9k → $27.2k to $29.8k | 5 to 9 → 7 to 8   | 30 → 5 to 30        | 0 → 0 to 2       |
| The Boardwalk      | 4.6/9.8/18.6 · 4.8/14.8/24.0 · 4.0/38.9/– → 4.8/22.8/34.8 · 4.3/12.6/23.3 · 4.3/10.7/16.3           | $8.0k to $15.7k → $12.0k to $38.2k  | 10 to 14 → 4 to 9 | 0 to 3 → 1 to 25    | 3 to 16 → 0 to 5 |
| High Pines         | 6.6/14.8/22.8 · 4.6/21.4/29.2 · 7.8/bankrupt day 521 → 4.9/10.1/16.1 · 4.6/13.8/27.6 · 3.7/8.3/27.7 | −$1.4k to $24.8k → $3.5k to $34.6k  | 7 to 11 → 7 to 21 | 0 to 30 (unchanged) | 0 to 3 → 0 to 11 |
| The Orchard Estate | 4.8/9.8/17.5 · 5.0/10.8/17.4 · 6.6/10.1/18.1 → 6.5/11.1/17.7 · 4.6/9.8/16.5 · 4.6/9.4/17.1          | $62.7k to $65.7k → $50.2k to $80.8k | 4 → 3 to 6        | 3 to 26 → 21 to 30  | 0 (unchanged)    |

Willow Lane's stars come at about the months they did (the first at 0.7 to 1.1, the second at 4.9 to 8.9, the third at 10.9 to 15.0, none sooner than before), and The Exchange's and The Orchard's within a game's luck of before. The Boardwalk's summers still cut reputation by 40 to 80 points (seed 1: 90 in May to 12 in August, 1 at its lowest; seed 2: 84 to 36; seed 3: 83 to 33) but no longer to 0 for a quarter of the year: months below 15% fall from 3 to 16 a game to 0 to 5, every seed earns its third star, and the center makes money in the winter instead of losing it, which is the floor doing what the research says it should. High Pines is the one center worse off on paper: seed 2 spirals from month 16 and spends 11 months below 15%, with 4 to 12 guests a month going home worse for two years from a 13-staff, 11-room center whose average wait runs to 20 days; before the change seed 3 did the same and went bankrupt, so this is the center's brittleness moving from one seed to another (balance log 23 and the audit's "waits far longer than Two Point's"), not the rule. The slope is still there: a line that makes guests worse still costs the Boardwalk half its name in a summer and still holds a High Pines game under 40 for a year.

**What the player can now see that they could not before:** that a line is about to cost reputation, which guests and what each costs, five days before it does, once a month in the message and all the time in the advisor; and, in the guide, the shape of the scale, so a low reputation reads as something to climb out of rather than a sink. `gainDamping`, `lossDamping` and `lineAtRisk` are there for a reputation panel and a line warning in the interface.

### 27. Bankruptcy is a two-condition failure, with a countdown the player can see

**Found:** a payday the bank could not cover ended the game three days later, whatever the books looked like. The Orchard Estate went bankrupt on day 63 or 93 in every seed, from an opening that is sound by month six; a Boardwalk game went bankrupt on day 393 with the takings outrunning the wages, because the bot had borrowed to build; and nothing in the game said, before payday, what the bank was about to do. The research's pattern (Prison Architect, Two Point's debt): bankruptcy needs a negative balance _and_ negative cashflow, with a short visible grace and graded costs on the way down.

**Done** (`src/core/sim/economy.ts`, `src/core/data/rules.ts`):

- A payday the bank cannot cover still stops the game, but the wages are never left unpaid: borrow the difference (2% a month), or pay them into the red (5% a month). Past the loan, the dialog says the bank will lend no more and the wages go into the red. The three days to find unpaid wages are gone, with `PAYROLL_GRACE_DAYS`.
- `cashflow(s)` projects the month the center is on course for: takings at the pace of the last month or so (this month so far and the last finished one, over the days they cover), less the wages on the books and the interest. Building, training, marketing and fines are left out: the bank judges the business, not the building, so a one-off outlay that dips the bank can never end the game on its own. `projectedCashflow`, `wagesDue`, `daysUntilBankrupt`, `daysInRed` and `insolvent` are exported for the interface.
- The bank calls the overdraft in only when a payday leaves the center in the red deeper than the loan still to be had would clear _and_ the projection is negative. Then `INSOLVENCY_DAYS` (10, a third of a month: long enough for a price change or a leaver to show in the projection and for something to be sold, short enough that living there is no plan; the old three days passed in eighteen seconds) to get the bank back within what it will carry or the books into profit, starting paused, with the amount in the red and the loss a month in the message, a reminder halfway, and the advisor counting down. Either put right, and the countdown is called off; neither, and the staff walk out.
- Graded costs in the red: staff morale settles 10 lower (`RED_MORALE`), 20 lower after a month there (`RED_MONTH_MORALE`), and after a month any unhappy member of staff asks for a raise to stay, however fair their pay. The month-end message in the red says the rate, the pace of the books, and what the bank will do next.
- The payday warning five days ahead now says what the bank will do (lend, or let the wages go into the red, to what figure) and whether the books are making or losing money, with the countdown that follows.
- The bot, as a good player, pays into the red past the loan, and while the bank is calling the overdraft in raises prices to its top and lets go the practitioner doing least for their pay, one a day, never the last of a discipline, until the projection is positive.

**Result,** before → after:

| Center             | Stars at month (seed 1 · 2 · 3)                                                           | Profit a month                      | Months at a loss    | Lowest reputation   |
| ------------------ | ----------------------------------------------------------------------------------------- | ----------------------------------- | ------------------- | ------------------- |
| Willow Lane        | 1.4/11.0/14.7 · 1.1/5.7/9.7 · 0.7/5.7/7.9 (unchanged)                                     | $17.1k to $17.9k (unchanged)        | 7 to 9 (unchanged)  | 0 to 11 (unchanged) |
| The Exchange       | 7.9/12.1/17.6 · 16.7/19.3/19.3 · 9.7/17.0/17.0 (unchanged)                                | $30.5k to $39.9k (unchanged)        | 5 to 9 (unchanged)  | 30 (unchanged)      |
| The Boardwalk      | 4.6/9.8/bankrupt day 393 · 4.8/14.8/24.0 · 4.0/38.9/– → 4.6/9.8/18.6 · same · same        | −$20.4k to $10.3k → $8.0k to $15.7k | 8 to 14 → 10 to 14  | 0 to 7 → 0 to 3     |
| High Pines         | 6.6/14.8/22.8 · 4.6/21.4/29.2 · 7.8/bankrupt day 333 → same · same · 7.8/bankrupt day 521 | $20.1k to $24.8k → −$1.4k to $24.8k | 7 to 11 (unchanged) | 0 to 30 (unchanged) |
| The Orchard Estate | bankrupt day 63 · 63 · 93 → 4.8/9.8/17.5 · 5.0/10.8/17.4 · 6.6/10.1/18.1                  | – → $62.7k to $65.7k                | – → 4               | 25 to 30 → 3 to 26  |

The Orchard, played exactly as before (every discipline on day 0, $94,000 spent in the first month), pays its second and third paydays into the red, goes no deeper than −$11,146 (the audit's bankruptcy-off runs went to −$11,172), is back in the black by month 6 to 10, and earns its third star at months 17.4 to 18.1, against 17.2 to 19.5 with bankruptcy switched off in the audit. The opening is still a felt mistake: four months at a loss, reputation as low as 3, the bank calling the overdraft in twice (seeds 2 and 3, at the second and third paydays, both called off within days by prices to 1.4 and one leaver), and interest of $1,000 a month on a loan that is only paid off in month 10 or 11. The Boardwalk game that died of building loans now goes into the red twice in its second year, is called in once, lets one therapist go, and earns its third star at 18.6. High Pines seed 3 still goes bankrupt, on day 521 instead of 333: its reputation collapsed to 0 in month 9 (eight guests went home worse in one month), takings fell to $4,500 against $14,800 in wages, and it never recovered; the bank called the overdraft in three times, prices went to 1.4 each time, and on the third the bot could only let one practitioner go before the ten days ran out. That is the reputation spiral of the audit's finding 5, which the next entry is for, on top of a center overstaffed for its takings; a player who let go a second consultant or a caretaker would have cleared it. Neither Willow Lane nor The Exchange ever meets the rule, and their games are identical move for move.

**What the player can now see that they could not before:** five days ahead of payday, what the bank will do and whether the books are making or losing money; at a short payday, the choice between the loan and the red with both rates; while in the red, the pace of the books and what the bank does next; and when the overdraft is called in, the amount, the loss a month, the two ways out and the days left. `cashflow`, `projectedCashflow`, `daysUntilBankrupt` and `daysInRed` are there for the Money menu to show the same before payday.

## 19 October 2026: class-goers who get their class

Measured with a probe that follows every class-goer the playtest bot's games bring in (when they set off, reach the studio, lose patience and leave, and why), and with `yarn balance`, at The Orchard Estate, seeds 1 to 8, two years a game, against main at `4a62c80`. The Orchard's studio stands on land apart, a long walk from the street, the Staff Room and the drinks, so it shows the trouble most.

### 26. One class-goer in six went home without a class

**Found:** 17% of class-goers left disappointed: 9% with the Instructor not at the mat, 4% having got there too late, 4% with the Instructor on a break. Four things, each made worse by a long walk:

- The Instructor's Mat has no line of its own, as class-goers wait at the Practice Spots, so an Instructor never counted as having anyone waiting and went for a drink or a snack as soon as they wanted one, as staff with an empty line do. Leaving the mat sends everyone on a spot back to the line, and from the studio apart the drinks were most of a day away.
- Class-goers set off two days ahead and most got in a day early, then stood on the spots as they came free, so the next class's class-goers, arriving for it, were left in line behind them.
- Anyone still in line, not walking in, when a class ended was not put down for the next one, and three days on went home "too late".
- The walk in from the street drained patience as a wait in line does: 8 points on average, 14 for those who later missed their class.

**Done:** an Instructor with class-goers on the spots or in their lines holds off a drink or a snack until close to fed up, as other staff do with a line (`lineWaiting` in `src/core/sim/staffing.ts`). A spot calls a class-goer in early for a later class only while nobody for an earlier one is in line at the studio (`dueForSpot` in `src/core/sim/classes.ts`). Class-goers in line when a class ends are put down for the next, as those still walking in were. Walking in to a class no longer wears on patience; a line still does.

**Result:** 93% of class-goers had their class, from 83%. Away from the mat 6% (from 13%), too late 1% (from 4%). 25% more classes were held. From the second year, profit rose $6.2k a month and reputation 4 points, with fewer guests storming out. The stars came as before, to within a game's luck: the third at 17.5 months on average against 17.2. The Sound Healer's Singing Bowls, which have the same blind spot, were left as they are: changing them changed every game at The Orchard from its first months, and wants measuring on its own.

## 17 October 2026, late night: Experts learn every treatment

### 25. An Expert could be shut out of their discipline's last treatment

**Found:** qualification slots are one a rank, five for an Expert, and general courses take them as treatments do. A Shaman has five treatments to learn beyond Spirit Animal Reading, so one who had taken even one general course on the way up, often the only course there was while the stars had not yet opened the rest, could never learn the last. The same held, with a course or two more to spare, for every discipline: massage and sound have four to learn and three general courses besides, acupuncture and reiki three.

**Done** (`roomFor` in `src/core/sim/careers.ts`): an Expert can take any treatment course of their discipline without a free slot. General courses still need one, and slots still have to be filled before each promotion below Expert. Each treatment learned adds 10% to what counts as their fair pay, as before, so an Expert who learns the rest is a little less content until given a raise. Not measured with the bot, which sends practitioners on treatment courses only and so never met this.

## 17 October 2026, night: Qi Gong classes that pay their way

Measured with `BOT_ON=classes yarn balance` against `yarn balance` from `0405d9d` (0.30.3, with 12-place classes at $130) and the good bot of 23, at every campaign center, seeds 1 to 6, four years a game. Profit, reputation and guests are averaged from the second year on; months at a loss are of all 48. Games without classes play the same under the new rules, as nothing in them changes without a class-goer.

### 24. Classes cost a good player money, and not for the reason thought

**Found:** with classes, the bot made $4.9k a month less (23.5k against 28.4k), its reputation was 11 points lower and treatment guests came 16.1 a month against 18.6. In the 9 games of 30 where it built a studio, it was $15k a month less, 37 points of reputation lower, and 13.5 guests a month came against 21.6. It had been put down to class-goers counting against the guest limit, but that was hardly ever reached: those games held 34 guests on average against a limit of 75 or so, and letting class-goers off the limit alone changed nothing ($23.4k). Guests came less often because reputation fell, as it sets how often they arrive. Watching where it went (Orchard seed 4, three years): class-goers held their classes for +977 points of reputation all told, and those who **went home without a class** lost −1,839 (−1 each, against at most +0.5 for a class, and less at a good reputation). A third or more of class-goers missed their class, for three reasons:

- **The Instructor was away, and classes were booked anyway.** Every break means a walk to the Staff Room and back, a drink or a snack, and a rest. From a studio far from it (at the Orchard, in the second building, round by the street) that took 8 to 11 days, and every class day meanwhile was booked as usual.
- **The backlog never cleared.** Class-goers who missed a class stayed for the next one, but the next was booked full besides, so they stayed on until they gave up.
- **Class-goers set off too late.** The walk in from the street to the studio took 4 days at the Exchange, and they set off two days ahead. A class starts as soon as one class-goer reaches a spot, and lasts most of a day, so the rest got there after it. Those booked for a Thursday or a Friday gave up over the weekend, before Monday's class.

| Missed their class (of all booked) | Before | After |
| ---------------------------------- | ------ | ----- |
| The Orchard, seed 4                | 38%    | 16%   |
| High Pines, seed 3                 | 43%    | 23%   |
| Willow Lane, seed 1                | 31%    | 14%   |

**Done** (`src/core/sim/classes.ts`, `src/core/sim/guests.ts`):

- Places are booked only while the Instructor is at their mat, and class-goers due to set off while the Instructor is on a break, a course or a call stay at home (`bookClasses`, `admitClassgoers`, `instructorAway`). The studio's booking then reads "nobody booked, the Instructor being away from their mat", and a tip the first time says a Staff Room nearer the studio gets them back from a break sooner.
- A class books only the places left in the classes still to come up to its day, once the class-goers already waiting or on their way are counted (`classesThrough`), so those left over from a class that never happened take the next one's places.
- When a class ends, class-goers booked for it or an earlier one who are still on their way in are put down for the studio's next class (`finishClass`, `nextClassDay`). Those already waiting in line when every spot was taken still miss it as before.
- Class-goers have places of their own, their Practice Spots, and no longer count against the guest limit (`guestsCounted`). It made no difference that could be measured here, but a class let out to the shop can no longer keep treatment guests out of a small center.

The bot builds as many Practice Spots as its Instructor can lead, as class-goers no longer count against the limit (it sold spots while the building was nearly full, and built more only while there was room).

| Center             | Third star       | Profit a month         | Reputation | Guests a month   |
| ------------------ | ---------------- | ---------------------- | ---------- | ---------------- |
| Willow Lane        | 6/6, 6/6, 6/6    | $17.5k, $20.2k, $20.2k | 65, 63, 65 | 14.6, 14.4, 14.7 |
| The Exchange       | 6/6, 6/6, 6/6    | $24.8k, $19.8k, $24.6k | 94, 79, 89 | 18.0, 15.1, 16.5 |
| The Boardwalk      | 4/6, 3/6, 4/6    | $11.1k, $10.1k, $12.7k | 63, 58, 62 | 16.9, 15.8, 16.4 |
| High Pines         | 6/6, 6/6, 6/6    | $21.6k, $18.3k, $21.0k | 84, 76, 82 | 19.1, 17.5, 18.6 |
| The Orchard Estate | 6/6, 6/6, 6/6    | $66.8k, $49.1k, $73.9k | 94, 67, 92 | 24.7, 18.0, 23.3 |
| All                | 28, 27, 28 of 30 | $28.4k, $23.5k, $30.5k | 80, 69, 78 | 18.6, 16.1, 17.9 |

Each cell is without classes, with classes before, and with classes now. Only 9 games build a studio (Willow Lane 1, the Exchange 1 and 2, the Boardwalk 6, High Pines 3, the Orchard 1, 4, 5 and 6); the other 21 play much as without classes, though in 5 of them the bot plays differently from the moment it first weighs up a studio, which moves their profit by as much as the seeds do (High Pines 5, $32.8k against $25.6k, without ever building one). In the 9, classes now earn more than no classes in 8, by $2.9k to $20.6k a month, and the Exchange's seed 2 makes $3.4k less ($23.2k against $26.6k, from $7.5k before). Their profit is $51.2k a month against $43.0k without classes and $27.9k before, and their months at a loss 6.3 against 6.8 and 7.7.

What each rule added, all 30 games, profit a month with classes: $23.5k before; off the guest limit, $23.4k; booking only while the Instructor is at their mat, $28.7k; booking only the places left, $29.5k; putting latecomers down for the next class, $30.5k.

**Still open:**

- **A studio's reputation is still lower than without one** (83 against 89 in the 9 games): from 14% to 23% of class-goers still miss their class, nearly all while the Instructor is away. A break from a studio far from the Staff Room still takes days, and those already booked or waiting when it starts go home. A Staff Room beside the studio would mend it; the bot never builds one, nor keeps a day in the week free of classes for the Instructor to rest.
- **Class-goers queue at the Shop Counter for days.** At High Pines some waited there 10 days after their class. They no longer keep anyone out, but they are still in the building.

## 17 October 2026, evening: the bot plays more like a good player

Measured with `yarn balance` from `1b6bc16` and this change (0.30.3, with the fix that stops anything walling a person in, `0569e49`, and the class rules of 24): every campaign center at seeds 1 to 6, four years a game, against the same bot with its new behaviours switched off (`BOT_OFF=kit,emergencies,layout,mats,classes,courses`), which on 0.30.1 played all 30 games move for move as the bot did before. Profit, waits, guests and reputation are averaged from the second year on; months at a loss are of all 48.

### 23. The good player left easy wins on the table, and twice wrecked a game

**Found** (on 0.30.1): watching the bot's games turned up things no good player would do, or fail to do:

- **It walled its own Caretaker in.** At the Orchard (seed 4) it put a plant down on the tile the only Caretaker stood on, sealing them into four tiles of corridor at 0 energy. Nobody repaired anything for two and a half years, the Massage and Acupuncture tables stayed broken, reputation sat near 0 and the game ended $240k in debt. The game's own check let an item go on a person's tile as long as a tile next to it could be reached, which is how the pocket closed. The game no longer allows it (`0569e49`: the tile a person stands on and the one they are stepping into must both reach the street).
- **It never upgraded equipment** (+3% success a level, slower wear), never hung a chart (+2% for $250), and never trained a Caretaker in Mechanics to install upgrades.
- **It took every emergency**, and lost about half of them (−4 reputation each), including ones nobody on the staff was trained for.
- **A fifth to an eighth of treatments had no equipment.** Second and third treatment rooms went in at the smallest size, and a Stone Warmer or Stretch Rack then had nowhere to go. Equipment also waited on a cash reserve of a month's wages: once the bot chose courses by value (below), a poor High Pines center went months without the $600 rack while every Sports guest was botched at 20%, and its reputation fell to nothing.
- **Decor went in the dearest way:** a $650 statue for 4 points of prestige, when a window is $150 for 1.5 points (up to four), and a rug or a picture costs no floor.
- **A Sound Healer of rank 3 or 4 played to 2 mats**, the studio's starting pair, when they can play for 3 or 4.
- **Courses went to the cheapest technique**, so every therapist learned the same one first.
- **It never ran a Qi Gong Studio.**

**Done** (`tests/balance/bot.ts`, the bot only; no game rules changed). Six new behaviours, on by default, each of which `BOT_OFF` switches off:

- **kit:** a Caretaker on the Mechanics course once the first star opens upgrades, then upgrades bought one a day (least upgraded and busiest first) while the center pays its way, a chart in every room it helps, and a Recliner for every two practitioners trained in a technique that needs a rest;
- **emergencies:** takes on an emergency only if those trained in its technique, with its equipment in place, can heal enough in time at the chance their rank gives, and puts emergency guests first while one runs;
- **layout:** when equipment will not fit, pushes a wall out a tile, or failing that sells floor decor to make space; dresses treatment rooms with windows first (onto the street, or onto a quiet corridor), then pictures, hangings and rugs, then lamps and statues. While a goal asks for patience, it dresses with floor decor as before, which cheers the corridor where guests wait through the walls as a window does not;
- **mats:** a mat for every guest the best Sound Healer can play for;
- **classes:** a Qi Gong Studio once the second star opens it, while the center pays its way, with an Instructor, as many Practice Spots as they lead, a class every weekday (the week's class-goers are shared among its classes, so smaller crowds let out at once), and up to three Shop Counters for the crowd;
- **courses:** the course for the technique worth most, by how often guests come needing it, what they pay and how hard it is, and worth much more where nobody else is trained in it yet; equipment for a technique bought as soon as anyone is trained in it, borrowing if need be.

Three more were tried and are extras, off unless `BOT_ON` names them, since they gained nothing:

- **clear** (never put furniture on a tile someone stands on, and sell whatever walls anyone in): it saved the Orchard game above, but since the game stops anything walling anyone in, the bot does no better with it: 27 third stars of 30 with it against 28, and $0.7k a month more, which the seeds cannot tell from chance;
- **trouble** (take on stress outbreaks and calm the carriers, a Shaman's ward against mishaps): no difference that could be told from the seeds;
- **triage** (move a guest who would get worse before their turn up their line, past guests who can spare the wait): $2.6k a month less, as those passed lost more patience than it saved.

| Center             | Third star | Stars at month                      | Profit a month  | Months at a loss | Success rate  | Reputation | Guests a month |
| ------------------ | ---------- | ----------------------------------- | --------------- | ---------------- | ------------- | ---------- | -------------- |
| Willow Lane        | 6/6 → 6/6  | 0.9, 6.3, 12.4 → 0.9, 5.9, 11.3     | $12.5k → $20.7k | 9.8 → 8.7        | 81.7% → 94.6% | 59 → 70    | 13.5 → 15.9    |
| The Exchange       | 6/6 → 6/6  | 13.5, 18.2, 22.2 → 13.5, 18.1, 18.6 | $19.9k → $24.1k | 7.7 → 7.0        | 83.1% → 89.4% | 88 → 92    | 16.6 → 17.1    |
| The Boardwalk      | 5/6 → 5/6  | 4.7, 15.2, 22.8 → 4.7, 13.7, 22.4   | $8.3k → $11.4k  | 15.2 → 12.3      | 86.0% → 92.7% | 60 → 64    | 16.2 → 15.8    |
| High Pines         | 5/6 → 5/6  | 5.0, 12.1, 26.5 → 6.2, 19.2, 24.2   | $14.3k → $21.7k | 12.8 → 10.8      | 83.7% → 88.4% | 70 → 83    | 17.5 → 18.9    |
| The Orchard Estate | 5/6 → 6/6  | 8.4, 17.3, 24.9 → 5.8, 10.1, 16.7   | $27.9k → $71.5k | 15.7 → 6.2       | 86.3% → 95.3% | 64 → 87    | 17.8 → 22.3    |
| All                | 27 → 28/30 | 6.5, 13.7, 21.4 → 6.2, 13.4, 18.3   | $16.6k → $29.9k | 12.2 → 9.0       | 84.2% → 92.1% | 68 → 79    | 16.3 → 18.0    |

Of the two games it loses, the Boardwalk's (seed 3) never meets the second star's 93% patience, as one of the old bot's did not, and High Pines' (seed 2) heals 9 of the 15 the third star asks with reiki. The old bot loses an Orchard game (seed 4) that the new one wins.

**What each is worth**, from the same 30 games with one switched off. The first five were measured on 0.30.1 (before `layout` learned to push walls out and to keep floor decor for a patience goal, and with `clear` on and `classes` off), against $29.9k a month and 30 third stars with all of them; `classes` on the code measured above, against $29.9k and 28:

| Off         | Third star | Profit a month | Success rate | Reputation |
| ----------- | ---------- | -------------- | ------------ | ---------- |
| emergencies | 25/30      | $25.0k         | 91.6%        | 75         |
| kit         | 29/30      | $25.7k         | 87.2%        | 78         |
| layout      | 26/30      | $28.7k         | 90.8%        | 80         |
| mats        | 28/30      | $26.9k         | 92.1%        | 77         |
| courses     | 28/30      | $27.8k         | 92.2%        | 79         |
| classes     | 29/30      | $27.7k         | 91.9%        | 81         |

Before the class rules of 24, `classes` cost the bot $8k a month and 16 points of reputation, and was an extra. That was first put down to class-goers counting against the guest limit; 24 found the cost was the reputation lost to class-goers who missed their class.

**Still open:** at High Pines the first star comes a little later than before (6.2 months against 5.0) and the second much later (19.2 against 12.1), as kit and upgrades come before the rooms a long winter needs. A good player would also build a Staff Room beside a studio far from the first, and leave a weekday free of classes for the Instructor to rest (24, still open).

## 17 October 2026, afternoon: smaller Qi Gong classes

### 22. A class of 16 overwhelmed the center

**Found** (in play, at the Orchard Estate): a class of 16 to 20 ends all at once, and up to three quarters of its class-goers head for the Shop Counter and the restrooms together, three times a week. The shop line reached 108, the class-goers filled the corridors and counted against the building's guest limit, keeping paying guests out.

**Done:** an Instructor leads at most 12, from 6 as a Trainee: 6, 8, 9, 11 and 12 by rank (`CLASS_PLACES`, was 6, 8, 10, 13 and 16), so Trainees and Juniors are as before. A place costs $130 at standard prices (`CLASS_FEE`, was $120): an Expert's full class brings in $1,560 against $1,920, a fifth less, for a quarter fewer people in the building. Not measured with the bots, which rarely run a Qi Gong Studio to its full size; to be judged in play.

## 17 October 2026, after midnight: the Posture Lab

Measured with `yarn balance` and `BOT=old yarn balance` from clean exports of 0.29.0 (`97e9de3`, with this bot copied in) and of `e6e4e86`: every campaign center at seeds 1 to 3, and High Pines at seeds 1 to 9, four years a game. Profit and waits are averaged from the second year on; months at a loss are of all 48. With the new extras off, the copied bot plays 0.29.0 move for move as its own bot does, and wherever nobody is sent for a scan, the two commits play the same games.

### 21. The Posture Lab was a trap

**Found:** a scan only sees guests whose first consultation left the diagnosis short of the policy's target, and it did nothing a second consultation did not: either gets any diagnosis past the usual 75%, the scan charged $150 against a consultation's $200, and the lab needs a Consultant of its own. Only a Consultant of rank 1 or 2 is ever unsure (a first look gives 0.4 + 0.13 a rank + up to 0.15), so in a center with rank 3 Consultants the lab sees nobody at all. The bot hires the best applicant, nearly always rank 3 or better: 0.29.0's bot built a lab in 8 of its 21 games, and scanned anyone in only 4 of them, 2 to 6 guests a month. To measure the lab where it is used, the bot learned two extras, off unless named (`BOT_ON=junior,lab`): **junior** hires the cheapest Consultant going (in the games looked at, they stayed at rank 1), and **lab** builds a Posture Lab once the center pays its way, when the Consultants are all rank 2 or below or more than three wait a Consultation Room. With both, about 10 guests a month are scanned. On 0.29.0, building the lab in such a center cost $4.5k a month against the same games without one (a junior center that never built a lab, 9 games), worse in 8 of 9.

**Done:** a scanned guest's chance of success is 10% higher (`SCAN_SUCCESS` in `src/core/data/rules.ts`, a `scanned` flag on the guest set by the scan), and a scan costs $250 (`ASSESS_FEE`), a little more than a consultation. The Posture Lab and Posture Scanner say what a scan adds, the guest inspector shows "📐 Scanned" under the chance of success (which counts it), the tip on a second look mentions it, and the guide's step 8 says what the lab does and that it only sees the guests a junior Consultant is unsure about.

The bonus was chosen on whether the lab pays for itself in a center that uses it. Lab against no lab in junior centers, 17 games (Willow Lane and High Pines, seeds 1 to 21, where the junior bot without the extra never built one):

| Scan bonus | Profit a month, with the lab against without | Better with the lab |
| ---------- | -------------------------------------------- | ------------------- |
| 0.29.0     | −$4.5k (9 games)                             | 1 of 9              |
| 5%         | −$1.2k (median −$2.2k)                       | 5 of 17             |
| 8%         | −$1.2k (median −$1.9k)                       | 5 of 17             |
| 10%        | +$0.1k (median −$1.0k)                       | 6 of 17             |

It barely pays even at 10%. The lab's Consultant costs at least $1,700 a month, and about 10 scans a month bring back the extra $50 each and a tenth of a treatment fee ($900 to $2,500 before prices) each.

Overall, 0.29.0 → `2c6b8d9`:

| Bot                        | Third star    | Profit a month  | Months at a loss | Average wait, days | Success rate  |
| -------------------------- | ------------- | --------------- | ---------------- | ------------------ | ------------- |
| Good player (seeds 1–3)    | 14/15 → 14/15 | $19.1k → $20.0k | 13.3 → 12.4      | 9.0 → 9.1          | 84.3% → 84.8% |
| Good player, High Pines ×9 | 7/9 → 7/9     | $7.7k → $9.1k   | 19.3 → 17.4      | 9.1 → 9.5          | 81.7% → 83.2% |
| Cautious (seeds 1–3)       | 4/15 → 4/15   | $2.3k → $3.0k   | 23.7 → 22.5      | 7.9 → 8.3          | 79.6% → 81.2% |
| Cautious, High Pines ×9    | 0/9 → 0/9     | $1.5k → $2.7k   | 23.6 → 21.6      | 7.3 → 7.8          | 78.7% → 81.4% |
| Junior and a lab (1–3)     | 4/15 → 6/15   | $4.4k → $9.2k   | 23.3 → 17.1      | 15.1 → 14.9        | 78.0% → 83.5% |

Only the games that scan anyone change: for the good player one Exchange seed and four High Pines seeds, for the cautious one High Pines seed. Willow Lane, the Boardwalk and the Orchard play the same games. The stars come as before for both bots, so the game is no easier where a good player hires senior Consultants. Junior Consultants with a lab still make less than half of what senior ones do ($9.2k against $20.0k a month).

**Still open:** a lab is worth building only by a player who hires junior Consultants, and then only just. A player with rank 3 Consultants, or who trains their Consultants up, never sends anyone for a scan.

## 17 October 2026, after midnight: waits

### 20. Nothing said which stage held guests up, or why

**Found:** the advisor said "the line for the Massage Suite is getting long, build another" once six waited at one table, and "nobody staffing it, hire another" whenever a table with two waiting stood empty, even with its Massage Therapist only on a break. The breakdown behind 18 found the slow stage was often not the treatment (at Willow Lane, nearly half of all waiting was for the Consultation Room), and that a long line came as often from staff away from their table as from too few tables. Nothing in the game told those apart.

**Done** (`src/core/sim/bottleneck.ts`): each station keeps how much of the last few days it had a guest called or in hand, and how much it stood staffed, each a share that drifts toward the present (`trackBusy`, called from `updateStations`). The advisor finds the stage of a visit (check-in, consultation, a scan, each discipline's treatment, the shop) with the most waiting for each station, once at least four wait and at least two for each (`bottleneck`), and says why (`bottleneckAdvice` in `src/core/sim/advisor.ts`): stood empty more than 30% of the time, with fewer staff than stations, hire; with enough, they are being called away, so another member of staff or a nearer Staff Room; busy 80% of the time or more, another station and someone to work it; otherwise, more skilled staff or another station. It points at the station with the longest line. "Nobody staffing it" now only comes when nobody in the role is on the payroll. Each station's inspector shows its two shares.

Nothing here changes how the game plays: the playtest bot (which reads none of it) played Willow Lane and the Exchange move for move the same with it and without.

### 19. However long a line grew, as many guests came

**Found:** how often guests arrive depended on reputation, marketing, the season and how many disciplines were on offer, never on how long they would wait. A center with far more guests than it could treat kept getting them, and the only check was guests storming out, which costs reputation and following after the harm is done. Nothing told the player early that a line was too long for its staff.

**Done** (`lineFactor`, `lineArrivals` in `src/core/sim/demand.ts`, `LINE_PUT_OFF` in `src/core/data/rules.ts`): a discipline's line is the guests waiting for its treatment against its practitioners on the payroll (or a Sound Healer's mats). Up to three waiting for each puts nobody off; past that, each one more puts a tenth of new guests off it, up to half. Those put off do not come for another discipline instead: guests arrive less often by as much (`admitGuests` in `src/core/sim/guests.ts`). The Guests tab shows it as a factor like the others ("Line: 8 waiting for 2 Massage Therapists ×0.9"), advises on it before anything else, and says at the top what share of new guests long lines keep away.

Measured as in 18, forking both bots' games at five moments in each of 15 and playing each on for 60 days with and without the rule (150 pairs): most forks came out exactly the same, because both bots build another room when a line grows, so lines rarely pass three a practitioner. Over all of them, guests lost to waiting went from 136 to 131 with the good bot and 153 to 151 with the old, guests healed from 1,495 to 1,502 and 1,357 to 1,378, and the average wait from 9.70 to 9.63 days and 9.41 to 9.31. It is a check for a center well past what its staff can treat, which costs a player who keeps lines in hand nothing.

Whole games with 17 to 19 together against 0.29.1 (seeds 1 to 3, and 1 to 9 at High Pines for the good bot): the good bot earned its third star in 15 games of 18 against 16, with profit up at three centers and down at two by about as much as the seeds alone move it. The old bot did better, with the third star in 9 games of 15 against 4, though with three seeds a center can swing either way.

### 18. Staff left guests waiting to fetch a drink, or to clear another room

**Found:** a probe noted, whenever a treatment table stood empty with guests in its line, what the member of staff last at it was doing (both bots, every center, seeds 1 and 2, the second half of 18 months). They were fetching a drink or a snack 16% of the time with both bots, clearing bad vibes in some other room 8% and 4%, on a break or walking to one 29% and 21%, and training 14% and 29%. Staff went for a drink as soon as they were 60 thirsty or hungry and had nobody in hand, whoever was waiting.

**Done** (`wantedElsewhere` in `src/core/sim/staffing.ts`, `wants` in `src/core/sim/staff-needs.ts`): with guests waiting in their line, staff see to them first. A drink or a snack waits until they are 90 thirsty or hungry (`STAFF_NEED_HOLD`), short of the 100 at which their morale suffers, and bad vibes wait unless they are in their own room. Being taken off a duty or a room, a priority room short of someone, a soul to retrieve and a mishap to ward off still call them away at once. Breaks are left alone: when staff break is the policy's to say, and staff below 15 energy already work slowly and botch treatments.

Measured by forking games: both bots played every center (seeds 1 to 3) to days 240, 360, 480, 600 and 720, and each of those moments was played on for 60 days twice, with the same random numbers, with the rule and without (150 pairs). With it, the average wait fell from 10.8 to 9.9 days with the good bot and from 11.1 to 10.5 with the old, shorter in 53 forks and longer in 17 with the good bot, 42 and 23 with the old. Patience kept rose from 74.7% to 76.9% and from 72.7% to 74.1%, guests lost to waiting fell from 214 to 182 and from 202 to 182, and guests healed rose 5%. Every center did better with both bots. Whole games (seeds 1 to 3) move by more than the seeds alone do, and in both directions (the good bot's profit at High Pines $7.6k to $14.1k a month, the old bot's at the Exchange $4.5k to $1.7k), with the stars at much the same months, so the forks are the measure to go by.

### 17. Waits read in days, when a treatment itself takes days

**Found:** the wait goals and the No Waiting Around award counted the average wait in days ("Keep the average wait under 2.5 days for a month"), and the Stats menu charted it the same way. But a day is six seconds and one treatment takes one and a half to three days, so a center running well averaged 6 to 14 days, and the number meant nothing a player could see. What the player does see is each guest's patience bar. Patience as guests left was no good either: each stage seen to (check-in, consultation, treatment) gives back 30, so most guests leave with nearly all of it.

**Done:** each guest keeps the lowest their patience falls during their visit (`lowest` in `src/core/state/types.ts`, updated in `src/core/sim/guests.ts`), and each month sums it (`patienceTotal`, counted in `countVisit`), 0 for anyone who storms out. The wait goals became "Guests keep N% of their patience through the wait, on average, for a month" (`{ kind: 'patience' }`, judged in `src/core/sim/goals.ts`), the Stats chart became **Patience kept**, and the award is judged on it (`PATIENCE_BAR` in `src/core/sim/awards.ts`). A month from an older save, or with nobody leaving, shows a dash rather than 0%, and a month already under way when a save is upgraded goes without it, rather than count only some of its guests. A saved choice of the old wait chart shows the new one.

To keep each goal as hard as it was, both bots played every center for four years (seeds 1 to 3) on 0.29.1 with patience kept recorded. Month by month it follows the old average wait closely (correlation −0.88 to −0.97). Months under 3 days pass as often as months keeping 91%, and under 2.5 days as often as 92% to 94%; the first month each game met them came out the same at 87% to 89%, and at 93%. So the Exchange's first-star goal is 90%, and the Boardwalk's and High Pines' second-star goals are 93%. Neither bot ever won the old award in those games (2 days on average over a year at most, 0.2 less each year); on patience kept the best year came to 96%, most to 55% to 85%. Its bar is now 90%, a point more each year, at most 95%: hard, but winnable.

Measured with both bots from clean copies of 0.29.1 and of 0.29.1 with this change (seeds 1 to 3, and 1 to 9 at High Pines for the good bot): Willow Lane and the Orchard Estate, which have no wait goal, play move for move the same. At the other three the stars come within about a month of 0.29.1: the good bot's second star at High Pines in 8 games of 9 both ways, its third in 6 against 7, and the old bot's stars the same.

## 17 October 2026: staff who leave a class or a session

Measured with the walkout probe (3, below): six seeds of 70 days, Reception, a Consultation Room, a Massage Suite, a Qi Gong Studio with three Practice Spots, a Staff Room and an Instructor, reputation held at 70, counting the class-goers who went home disappointed by why. Since 70 days holds only one Instructor's break a seed, the same probe also ran over 24 seeds of 140 days, with the helpers' Staff Room (about a day's walk from the studio) and with one beside the studio.

### 16. The Sound Healer walked off mid-session

**Found:** the Singing Bowls never count as seeing anyone, so a healer left mid-session for a break, a drink or any other reason, and everyone lying on the mats went back to the line, part-treated. In the same probe with a Sound Bath Studio and a Sound Healer instead of the classes (every guest needing sound healing), the healer walked off 5 times in six seeds of 70 days, sending 6 guests back to the line, and 41 times in 24 seeds of 140 days, every time for a break, sending 57 back. Counting a session playing as someone in hand, as for the Instructor (1, below), held the healer to the end, but guests already on their way to a mat joined the session as it played and kept it going: the healer took on average 2 days to get away and up to 8.6.

**Done:** a sound bath playing counts as someone in hand (`inHand` in `src/core/sim/staffing.ts`), so the healer stays to the end of it. Once they want to be off for any reason (`wantsAway`), the mats call nobody more, anyone still on the way to a mat goes back to the line, and a session still waiting for its mats to fill does not start (`updateSession` in `src/core/sim/sessions.ts`), so the healer plays out only the guests already lying down. Walk-offs went to none in both (5 and 41 before), with as many guests treated (144 against 145, and 1,240 against 1,247). A healer now takes on average 1.4 days to get away and at most 4.5, a tired healer's one treatment; before, 0.1 days.

### 15. An Instructor's break cost a class

**Found:** 15 of the 30 disappointed class-goers had an Instructor on a break, and every break skipped a class day. A worn-out Instructor's break is not just the day and a half on the sofa: with the walk to the Staff Room and back it took 3.7 days in the probe, and 2.4 with the Staff Room next to the studio, longer than the two or three days between Monday's, Wednesday's and Friday's classes. Staff break as soon as their energy falls below the policy's level, which for an Instructor was as often the day after a class (a Saturday or a Thursday) as any other, so the break ran through the next class day. Holding off a break on a class day alone changed nothing: no break in the probe started on one.

Also, an Instructor below the policy's level stopped calling class-goers to the Practice Spots (the check that lets a tired Therapist finish their guest and go), so one held back from a break would stand at the mat with nobody to teach.

**Done** (`restDue` and `backForClass` in `src/core/sim/classes.ts`):

- an Instructor goes for a break only when the next class is at least two days off (`REST_GAP`: on the usual timetable, once Friday's is over), and then a little early, below 15 more energy than the policy's level (`REST_AHEAD`), so they are not worn down before the next chance. Until then they hold off, a class day's class included, unless their energy falls below 10 (`BREAK_EXHAUSTED`);
- a resting Instructor gets up in time to walk back for the next class, taking the walk back to be as long as the walk there was, with half a day to spare to call the class-goers to their spots (`REST_RETURN`), once rested to where they would have rested early. If that moment has passed, they rest in full;
- the Practice Spots call class-goers whenever the Instructor is not going for a break by these rules;
- the message for a class missed to a break says a Staff Room nearer the studio gets the Instructor back sooner, rather than a better one.

Disappointed class-goers in the probe went from 30 of 495 (6.1%: 15 on a break, 15 full) to 18 of 493 (3.7%: none on a break, 18 full). Over 24 seeds of 140 days, with the helpers' Staff Room, 6.9% to 5.9% (on a break 172 to 11, full 83 to 230) and class days skipped 144 to 132; with the Staff Room beside the studio, 4.6% to 1.3%, and class days skipped 114 to 66. Resting after any class rather than only before a two-day gap did worse (7.9% and 4.3%), and so did resting only 5 energy early (6.3% and 3.0%).

**Still open:** with the Staff Room a day's walk from the studio, most breaks still cost a class, as the walk there and back takes most of the weekend. Its class-goers now mostly wait for the next class and find it full, which is why "full" rose.

## 16 October 2026, after midnight: the release, as a good player finds it

### 14. For a good player, this branch is about as hard as 0.28.6

**Found:** the comparison in 11 used the old, cautious bot, and found this branch $2k to $4k a month more generous than the release. The new bot (13) plays like a good player, so it was run on both: 0.28.6 (its source with the new bot copied in) and this branch at `9c5d422`, from clean copies, seeds 1 to 3, four years a game, averaged from the second year on:

| Center             | Third star | Profit a month  | Months at a loss | Average wait, days |
| ------------------ | ---------- | --------------- | ---------------- | ------------------ |
| Willow Lane        | 3/3 → 3/3  | $11.3k → $16.6k | 13.0 → 9.3       | 14.1 → 12.3        |
| The Exchange       | 3/3 → 3/3  | $19.7k → $17.6k | 8.0 → 10.3       | 7.1 → 7.5          |
| The Boardwalk      | 2/3 → 3/3  | $3.5k → $5.0k   | 20.7 → 18.0      | 9.5 → 8.3          |
| High Pines         | 2/3 → 3/3  | $11.1k → $6.4k  | 16.7 → 19.0      | 9.3 → 9.3          |
| The Orchard Estate | 3/3 → 3/3  | $31.2k → $31.7k | 7.7 → 9.3        | 8.1 → 10.1         |

Profit goes up at two centers and down at two, by about as much as the seeds alone move it, and the stars come at much the same months. For a good player the branch is no easier than the release. What the old bot found was that the branch is kinder to a cautious player: demand that follows what the center can treat, and the arrivals boost, help most a player who does not chase prices and house calls.

**Done:** nothing; the tuning stays as in 11 and 12.

**Still open:** a good player finds both the release and the branch easy: the third star in 13 to 15 games of 15, at $5k to $32k a month. That comes from prices and house calls (13), which are as they were in 0.28.6, so it is a question for a later release, not this one.

## 16 October 2026, late night: a playtest bot that plays like a good player

### 13. The bot understated how easy the game is

**Found:** the playtest bot never touched prices, marketing or policy, never let anyone go, never saved toward a money goal and built rooms whenever a line was long, so a good player beat it everywhere and its numbers made the game look harder than it is. Judging whether a change makes the game too easy needs a bot that plays well.

**Done** (`tests/balance/bot.ts`, the bot only; no game rules changed). The bot now:

- **sets prices** each month, a tenth at a time, between 1.0 and 1.4: up while fewer than one guest in ten is put off by them and reputation is comfortable (at least 45, and any reputation goal met), down when more are put off or reputation falls short of a goal or drops. A discipline whose line runs past three a room costs up to 30% more on top, so the guests who would wait and walk out are priced off instead;
- **buys marketing** only where it can pay: word of mouth when a month of it could carry reputation to a goal, or the center has time to spare; a condition in the spotlight for a "heal so many with…" goal while that discipline has time to spare, or to send guests from a crowded discipline to an idle one; and a recruitment drive, holding out up to a week, when the only applicants for a practitioner are Trainees;
- **lets practitioners go** just before payday when a discipline's tables were busy well under 70% of the time and the season ahead is no busier (never the last of a discipline), leaves the room empty, and takes someone back on when another room would pay;
- **saves for an open money goal** once the rest of the star is met or the money is halfway there: no decor (unless a prestige goal asks for it), no land, no new discipline a goal does not need, no room that does not pay for itself within three months, and the loan paid down;
- **builds a treatment room on the profit it is expected to make**: the guests who gave up waiting for that discipline last month, plus the line beyond one a room, times the busiest of the next three months' seasons, healed at the discipline's own rate and paying its fees, less a salary and the room's cost spread over a year. It keeps space for a discipline the next star opens, giving up a spot while the room is still a plan if it would leave none; and when a goal needs a room that will not fit and there is no land left to buy, it knocks down a spare room for half its cost back, as a player can, and builds in its place;
- **takes house calls** when someone else in the role stays at work, or the line is short and no wait goal is open;
- **evens out lines**, moving guests from a station with nobody at it or a much longer line to another of the same kind, and lets at most half of any role go on a break at once.

Each can be switched off for a comparison: `BOT=old yarn balance` plays as the bot did before (checked to give the same games, move for move), and `BOT_OFF=prices,calls` switches single ones off (`BOT_FLAGS` in the bot). The month logs are as before, with the price level added.

Measured with `yarn balance` at `a9dbef7` (5% arrivals a discipline, the narrower following), every campaign center, seeds 1 to 3, four years a game. Guests, healed, waits and profit are averaged from the second year on; months at a loss are of all 48:

| Center             | Third star | Stars at month         | Guests a month | Healed a month | Average wait, days | Months at a loss | Profit a month  | Price level |
| ------------------ | ---------- | ---------------------- | -------------- | -------------- | ------------------ | ---------------- | --------------- | ----------- |
| Willow Lane        | 1/3 → 3/3  | 1, 15, 30 → 1, 4, 13   | 13.1 → 14.9    | 9.4 → 10.9     | 13.6 → 12.5        | 24.7 → 9.3       | $3.4k → $16.7k  | 1.00 → 1.32 |
| The Exchange       | 2/3 → 3/3  | 9, 13, 29 → 13, 18, 20 | 18.6 → 14.3    | 15.3 → 10.8    | 6.0 → 7.5          | 17.3 → 10.3      | $4.9k → $17.9k  | 1.00 → 1.37 |
| The Boardwalk      | 0/3 → 3/3  | 7, 14, – → 5, 13, 23   | 16.1 → 15.8    | 11.0 → 10.8    | 7.2 → 8.3          | 27.7 → 18.0      | −$2.8k → $5.5k  | 1.00 → 1.21 |
| High Pines         | 0/3 → 3/3  | 22, 22, – → 7, 29, 42  | 17.0 → 15.3    | 12.8 → 10.5    | 4.6 → 9.3          | 24.0 → 19.0      | $1.0k → $6.5k   | 1.00 → 1.29 |
| The Orchard Estate | 3/3 → 3/3  | 6, 25, 36 → 6, 14, 22  | 19.4 → 19.0    | 14.8 → 14.2    | 6.7 → 10.1         | 16.3 → 9.3       | $12.5k → $32.5k | 1.00 → 1.27 |

Stars at month is the average month each star came in the games that earned it. The new bot earns the third star in all 15 games against 6, makes 2.5 to 7 times the profit where the old one made any, spends 5 to 15 fewer months at a loss, and does it with much the same staff. It sees and heals a few fewer guests: it plays for money, not for the most guests through the door. At The Exchange its first star comes later, as running thin at high prices keeps the average wait over 3 days for longer. At The Boardwalk and High Pines the Reiki Studio for the third star fitted only after knocking down a second Massage Suite (in four games of six), the building being full with all its land bought; the old bot never built one there, and one of its High Pines games ended $195k in debt.

**What each behaviour is worth**, from the same games with one switched off, run before the bot learned to make space and with marketing as first tuned (three seeds, so a difference of a few thousand a month is within what the seeds alone do):

- **Prices** count most and everywhere: without them profit falls by $3k to $10k a month at every center, and The Boardwalk's third star comes in one game of three. At 1.3 to 1.4 only about 2% of guests are put off, since regulars and emergencies never balk, and reputation per heal falls by a tenth.
- **House calls** come next: $1,200 a day and up, against roughly $250 a day a practitioner earns in the center. Without them Willow Lane makes half as much.
- **Saving** gets the money goals sooner (The Boardwalk's third star in three games of three, one without; High Pines loses money without it).
- **Expansion on profit** helps where the old rule built too little (Willow Lane) but builds less than it should where seasons and the following swing (High Pines and The Boardwalk did better without it).
- **Marketing**, **payroll** and **lines** are within the seeds' noise, or slightly costly. Word of mouth at $3,000 a month rarely pays for itself.

**For the "too easy" question:** this bot is a fairer stand-in for a good player, and against the old one it finds the game much easier, mostly through prices and house calls, which cost a good player almost nothing. Its waits are longer than the old bot's (by up to 4.5 days at High Pines), as a player chasing money runs thin; so a good player will not find waiting guests the hardest thing to manage, but a cautious one may.

**Noted, not changed (game rules):**

- Raising prices to 1.4 costs very little: the put-off chance (35% of every tenth over 1.0) applies only to guests who are not regulars, and those are a small share in a settled center.
- House calls pay several times what a practitioner earns in the center, for one to three days away.
- Letting someone go has no cost, no notice and no severance, and a member of staff let go just before payday is not paid for the month they worked.
- The Boardwalk and High Pines, with all their land, have too little room for a fifth treatment room in the bot's layout without knocking one down, as the audit found.

## 16 October 2026, night: toned down for release, against the released game

The released 0.28.6 plays fair without being punishing, so it is the measure: the changes above should not make the game much easier than it. The playtest bot was run on 0.28.6 itself (its source, with the bot copied in) and on this branch, six seeds of every center each, four years a game. The bot is a cautious scripted player that never touches prices, marketing or policy and never lets anyone go, so a good player does better than either column; what counts is the difference between them.

### 11. The arrivals boost made the game too generous

**Found:** at 10% a discipline (10, below), profits rose by $1.4k to $9.2k a month at every center that offers more than massage.

**Done:** halved to 5%: a fifth discipline brings 20% more guests. Against the released game, with the narrower following (12, below) as well, averaged from the second year on:

| Center             | Profit a month  | Months at a loss | Average wait, days | Third star |
| ------------------ | --------------- | ---------------- | ------------------ | ---------- |
| Willow Lane        | $4.6k → $5.6k   | 20.5 → 20.7      | 11.4 → 12.1        | 4/6 → 4/6  |
| The Exchange       | $0.8k → $4.1k   | 27.3 → 19.0      | 4.5 → 6.2          | 2/6 → 4/6  |
| The Boardwalk      | −$6.7k → −$2.7k | 34.2 → 28.7      | 6.5 → 6.4          | 0/6 → 0/6  |
| High Pines         | −$0.2k → $1.8k  | 26.2 → 21.7      | 5.5 → 6.5          | 0/6 → 0/6  |
| The Orchard Estate | $3.1k → $6.0k   | 27.3 → 23.7      | 6.4 → 6.8          | 1/6 → 3/6  |

The branch is a little easier than the release: $2k to $4k a month more where there is more than massage to offer, most where the bot lost money for most of the game (The Boardwalk lost $6.7k a month on 0.28.6, and still loses $2.7k). Willow Lane, which never gets the boost, is the same within the seeds. The bot still spends 19 to 29 of its 48 months at a loss everywhere. Not all of the difference is the boost: on three seeds with no boost at all, the branch already made about $5k a month more at The Exchange and The Boardwalk than the release, from reputation that holds higher. Waits are up by up to a day and a half: guests waiting should not become the main thing to manage, so a faster walk to treatment is the next step before demand grows any further.

These runs played the bot from a clean copy of the branch; an earlier set was redone after another session started changing the bot in the same folder.

### 12. A following widened the gap between disciplines

**Found:** a review predicted it and the bot confirmed it. Massage's following climbed to 70 to 87 at every center, while the others mostly settled between 20 and 56. A following settles where a discipline's success rate puts it, and massage heals most reliably, while a niche discipline is idle most days, when followings fade. At up to 2.5×, a following of 87 drew twice what one of 32 did, on top of massage being the more popular.

**Done:** a following now multiplies a discipline's pull from 0.75 with none to 1.75 at 100 (was 0.5 to 2.5), so 87 against 32 draws 1.5× rather than 2×. It only moves guests between disciplines, not how many come. In the bot's games afterwards (six seeds), the smaller disciplines healed more and built bigger followings: acupuncture at The Exchange 3.4 heals a month (was 2.8) and a following of 59 (was 56); The Orchard's acupuncture and reiki ended at 50 and 64 (both were 46); sound healing at High Pines at 58 (was 37). Massage still leads, at 68 to 85. Acupuncture at The Boardwalk still fades, to 13, for reasons the bot's logs do not show.

**Still open:** walkouts take 2 from a following, so a discipline losing many guests to waiting can still grow. That was left as it is, since waiting should not become the main thing to manage; the walk to treatment is the better fix.

## 16 October 2026, evening: arrivals grow with what the center offers (a first step)

### 10. More disciplines brought no more guests

**Found:** the audit's finding 3 and the still-open note on 5: guests arrive at a pace set by reputation, the center and its grade, and nothing the player builds raises it. A new discipline only split the same guests, while adding a salary and a room.

**Done**, deliberately small so it can be playtested before it goes further: guests arrive 10% more often for each discipline past the first that has a finished room and a practitioner on the payroll (`OFFERING_ARRIVALS` in `src/core/data/rules.ts`, `offeringArrivals` in `src/core/sim/demand.ts`), so five disciplines bring 40% more. A room with nobody to work in it brings nobody. The Guests tab says how many disciplines are staffed and what that does to arrivals. The audit suggested 20% a discipline, and raising arrivals across the board made things worse in its experiment, so this starts at half that.

Measured with the playtest bot (`yarn balance`, every campaign center, three seeds, four years), before and after, averaged from the second year on:

| Center             | Guests a month | Healed a month | Average wait, days | Months at a loss | Profit a month |
| ------------------ | -------------- | -------------- | ------------------ | ---------------- | -------------- |
| Willow Lane        | 13.0 → 13.0    | 9.3 → 9.3      | 13.6 → 13.6        | 24.7 → 24.7      | $3.1k → $3.1k  |
| The Exchange       | 16.8 → 19.4    | 14.1 → 15.7    | 5.7 → 6.9          | 19.3 → 17.7      | $4.7k → $6.5k  |
| The Boardwalk      | 16.3 → 17.8    | 11.7 → 12.9    | 8.2 → 7.7          | 25.7 → 20.0      | $0.0k → $1.4k  |
| High Pines         | 15.3 → 17.3    | 11.4 → 13.1    | 4.9 → 7.2          | 27.7 → 22.3      | −$1.0k → $1.7k |
| The Orchard Estate | 14.2 → 20.8    | 10.0 → 15.4    | 6.1 → 10.9         | 26.7 → 18.3      | $5.7k → $14.9k |

Willow Lane, which only ever offers massage, is unchanged, as it should be. Everywhere else the extra guests are mostly healed, months at a loss fall by 2 to 8, and every center now makes money on average (High Pines lost $1.0k a month and The Boardwalk broke even before). The Orchard, which opens with the most disciplines, gains the most, and its second and third stars came in two games of three instead of one. Waits rose by a day or two, and by nearly five at The Orchard: the audit's other half of finding 3, a faster walk to treatment, is still to do.

**Still open:** whether 10% feels right in play (halved to 5% since: 11, above). The audit's 20% would roughly double these gains and the longer waits. Treatment rooms past one a discipline add nothing yet.

## 16 October 2026, later: a review of the above

A review of the changes below found four things worth fixing before they were merged.

### 6. A following could only shrink

**Found:** with 3 for a heal (less as the following grows) against 4 for a failure, a discipline had to heal 57% of its guests to grow at all from nothing, and 69% to hold 40; a Trainee heals about 55%. A following also faded every day, even on a day its practitioners were busy, so a new discipline started at 0 and mostly stayed there: the opposite of growing with results.

**Done:** a heal adds 5 (less as the following grows), a failure takes 3 and a guest who gives up waiting for their treatment 2. A discipline now holds its own healing about 40% of its guests from nothing, 50% at 40 and 75% at 80, so a following settles where the practitioners' results put it: about 27 for a discipline healing 45% of its guests, about 80 for one healing 75%. A discipline new to the center starts at 20 rather than 0, from the word that it is on offer, and a following fades only on a day nobody was treated in it, by a twentieth a month. The Guests tab and the guide said it faded "when nobody comes" when it faded every day; they now say what it does.

### 7. A staff challenge could ask a niche discipline for too many

**Found:** a challenge to heal guests in one optional discipline asked for 40% of what the whole center heals in the time, whatever that discipline's share of the guests. With sound healing drawing perhaps 10%, it asked for four times what the Sound Healer would see.

**Done:** it asks for the discipline's own share of the guests, from the same demand the Guests tab shows, with the same 20% stretch as the challenge for the whole center (at least 3).

### 8. "They got there after the class" was really "the class was full"

**Found:** every class-goer told they got to the studio after their class had finished had in fact been there all along, waiting behind a full class. A class is booked up to its spots, but class-goers who missed one class day wait up to three days for the next, so they and the next day's class-goers can outnumber the spots. Nothing told the player when more wanted a place than there were.

**Done:** when a class ends with every spot taken, anyone still waiting for that class or an earlier one is told the class was full, and so is the player when they give up: "every Practice Spot was taken… Another class day, or more spots, would fit them in." A tip says the same the first time a class is booked full with class-goers turned away. In the walkout probe (3, above) all 15 of the "late" were full classes.

### 9. A fine room counted for as much as a big following

**Found:** a room could triple its discipline's pull (up to 3 with five stars, a quiet room and spare mats), as much as a following of 75. Paired with a following that only shrank (6), the room was the one thing a player could do about demand, and a lavish Sound Bath Studio could draw nearly twice the guests of a plain Massage Suite with the same following, though sound healing is the less popular.

**Done:** a room can at most double its discipline's pull. Results, through the following, now count for more than the room.

## 16 October 2026: practitioners, demand and Qi Gong

### How it was measured

A throwaway harness ran the real simulation in two ways, three seeds each:

- **Kept busy.** One practitioner of each kind in the same 6×5 room, fully trained, without traits, on fair pay, with diagnosed guests for their discipline always waiting, for two months after ten days' warm-up. This measures what each can earn, not what they do earn.
- **A full center.** Reception, a Consultation Room, a room for every discipline and a Qi Gong Studio, every practitioner at rank 3, reputation held at 60 and guests arriving as usual, for two to six months. This measures what each actually earns.

The harness was not kept. Once `chore/balance-audit` is merged, its playtest bot is the better tool for the second measurement, since it builds and runs a center properly (the harness's small test rooms lacked the equipment for most techniques, so its treatments failed about half the time).

### 1. The Qi Gong Instructor walked off mid-class

**Found:** the Instructor's Mat never counts as seeing anyone (`serving` stays 0), so every reason staff may leave their post (a drink, a break, a priority room, smudging, a duty or room change) applied in the middle of a class. Leaving sent everyone on a Practice Spot back to the line, where they lost patience.

**Done:** a class under way counts as someone in hand (`inHand` in `src/core/sim/staffing.ts`), so the Instructor stays to the end and goes after. The Sound Bath's healer could still walk off mid-session, since a session plays on as long as guests keep lying down; they now play out the session and call nobody more to it (16, above).

### 2. Practice Spots had no limit

**Found:** each Practice Spot added to a studio's weekly draw, without end, so a studio full of spots drew class-goers without limit.

**Done:** an Instructor leads a class of up to 6 as a Trainee, then 8, 10 and 13, and 16 as an Expert (`CLASS_PLACES`). Spots past that stand empty and draw nobody. The studio's inspector says so, and a tip says to promote them the first time it matters.

### 3. Class-goers went home without a class, with the Instructor there

**Found:** about 15% of class-goers (74 of about 480) went home disappointed, three quarters of them Friday's, and about 1 class day in 6 was skipped. A class ran 10 seconds, close to two days, and nearly three with a tired Instructor, so on the old Monday, Wednesday and Friday timetable one class often ran through the next class day, which then had no class. Class-goers give up three days after their class day, as the day begins, so Friday's gave up on Monday morning just before Monday's class. The game never said why.

**Done:** a class runs 6 seconds, about a day, so it is over well before the next class day; and when class-goers go home without a class the player is told why, once for each class: no Instructor, the Instructor on a break or away from the mat, the class before still going, the day taken off the timetable, or they got there after it (`noteMissedClasses` and `giveUp` in `src/core/sim/classes.ts`). Measured over six seeds of 70 days, with the studio's three Practice Spots and reputation held at 70, about 6% went home disappointed afterwards (30 of 495) and about 1 class day in 17 was skipped.

A new studio briefly held classes on Monday and Thursday instead, to space them out, but the shorter class alone is enough: the same probe on Monday and Thursday had 8% disappointed (27 of 342) and 1 class day in 13 skipped, and fewer class-goers in all (315 against 465). Changing the default would also have quietly moved every older save's studio to two classes a week. A new studio still holds classes on Monday, Wednesday and Friday.

**Still open:** half of the 6% left were Instructors on a break that took up the whole class day, and half were left waiting because every spot was taken (8, above). Instructors now time their breaks around the classes (15, above), which leaves 3.7% disappointed, nearly all of them because the class was full.

### 4. What each practitioner earns when kept busy

**Found:** profit a month (revenue less pay), kept busy:

| Practitioner         | Trainee    | Experienced | Expert       |
| -------------------- | ---------- | ----------- | ------------ |
| Massage Therapist    | $4.5k      | $4.7k–7.6k  | $8.8k–9.5k   |
| Acupuncturist        | $3.8k      | $6.3k–7.3k  | $9.5k–11.0k  |
| Reiki Practitioner   | $3.5k–4.1k | $9.0k–9.7k  | $11.9k–12.4k |
| Shaman               | $5.8k–7.1k | $7.2k–8.4k  | $11.8k–12.3k |
| Qi Gong Instructor   | $4.1k–4.5k | $7.7k       | $12.8k       |
| Sound Healer, 2 mats | $12k–13k   | $21k–23k    | $25k–31k     |
| Sound Healer, 4 mats | $20k–25k   | $31k        | $44k–45k     |

Ranges are a bare room (prestige 3) and a dressed one (prestige 5). Five of the six are within about 20% of each other at the same rank. **The Sound Healer earns about 3× with two mats and nearly 4× with four**: one healer treats every mat at once, sound fees are the second highest (about $2,100 on average), and mats have no limit. **Rank matters most**: a fully trained Trainee fails about 45% of treatments and an Expert about 10%, so profit roughly triples from Trainee to Expert while pay doubles. **Room amenities hardly count**: prestige 3 against 5 moved profit by less than the seeds did, since each prestige star adds only 2% to the chance of success.

**Done:** a Sound Healer plays for up to 2 mats as a Trainee or Junior, 3 as Experienced or Senior, and 4 as an Expert (`SOUND_MATS`), as Practice Spots are capped by an Instructor's rank. Mats past that call nobody, start no session, and add nothing to the studio's pull. The bowls' inspector says how many the healer plays for, and a tip says so the first time mats stand empty. Kept busy with 4 mats afterwards: a Trainee $12.9k–16.5k a month (was $20k–25k), the same as with 2; Experienced $29k (was $31k); an Expert $44k–45k, unchanged, as an Expert plays for all 4.

**Still open:** the cap stops the Sound Healer earning without limit, but even at 2 mats they earn about 3× the others ($12k–13k against $3.5k–7k as a Trainee). Cutting sound fees to about 55% would bring 2 mats into line with one treatment table. Amenities could count for more in what a treatment earns.

### 5. Who comes for what made no sense, and the player could not see it

**Found:** a guest's condition was picked from every condition the center could treat, each counting once, so a discipline's share of guests was how many conditions had been written for it: massage 15, reiki 11, acupuncture 9, shamanism 9, sound healing 6. Each center's local favourites mostly favoured massage, sound's conditions unlock over the stars (3 at the first, 6 at the third), and guests whose condition nobody was trained for came 40% as often. At the stars a player actually plays, sound healing drew 11 to 23% of guests (massage 24 to 62%): about one sound guest a month, often none, while its busy earnings were the highest. In a full center of about 12 guests a month, every treatment practitioner lost money ($0.1k to $2.3k a month at rank 3); only the Qi Gong Instructor made money, as classes draw guests of their own. This is the audit's finding 3 (demand does not grow with the center) seen practitioner by practitioner.

**Done** (`src/core/sim/demand.ts`, save version 30): a guest picks a **discipline** first, then a condition within it. A discipline's pull is:

- its **popularity**, a deliberate number on the discipline rather than an accident of how many conditions it has: massage 1, acupuncture 0.8, reiki 0.7, sound healing and shamanism 0.6;
- its **following**, 0 to 100, as a multiplier from 0.5 to 2.5. It grows by 3 with each guest healed (less as it grows), falls by 4 with each failure and by 2 with each guest who gives up while waiting for the treatment, and fades by a tenth a month. Massage starts at 40 in a new game and anything new at 0, so a niche discipline starts quiet and grows with good results. Older saves start every discipline they have a room for at 40;
- the pull of its **finest room**, for every treatment room now and not just the Sound Bath Studio: 1, plus 0.35 a prestige star past the first, plus up to 0.6 for quiet, plus 0.2 for each spare sound mat, up to 3 (2 since: 9, above);
- how much of it the staff are **trained** for (an untrained condition counts 0.4), and the center's local favourites, averaged over its conditions so the number of conditions no longer counts.

The Stats menu has a new **Guests** tab showing each discipline's share of new guests, each factor with its multiplier, and the one thing that would draw the most more (training, word of mouth or the room). Every treatment room's inspector says how strongly it draws.

In the full center afterwards, shares were more even (massage 27 to 34%, the others 13 to 22%), but followings shrank in the harness's poorly equipped rooms, where failures outnumber heals. Profits were much the same: massage about even, the rest losing $0.9k to $2.5k a month, since there are still only about 12 guests a month to go round.

**Still open:**

- **Demand still does not grow with the center** (audit finding 3), which matters more than how it is split: arrivals that rise with each staffed discipline and with treatment rooms built. A first step since: 10, above.
- **The following's numbers need checking in a well-run center** with the playtest bot. They were retuned the same day (6, above), but only on paper.
- **The Sound Healer** (4, above).
