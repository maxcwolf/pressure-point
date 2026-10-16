# Balance audit: pace, difficulty and flow

An audit, 15 October 2026, of how the campaign plays at the default (Standard) settings, against the aim that it should feel like Two Point Hospital: easy to get going, money that is rarely the worry early on, more patients than you can handle, a reputation that moves slowly, and pressures that arrive one level at a time.

The short version: the game is not too hard in the way Two Point's late levels are hard. It is **brittle**. Small numbers of guests, harsh reputation swings, guests turning up for treatments the center cannot give, and every pressure system switched on in the first three months of every center combine into spirals that a player cannot easily climb out of, while the stars that are hard are hard for reasons the player cannot see (a sample size, a money goal against a loan). The fixes are mostly numbers and gating, not new systems.

## How this was measured

Reading the code gives the rules; it does not say how they add up. So a **playtest bot** ([tests/balance/bot.ts](../tests/balance/bot.ts)) plays each campaign center through the real simulation, as a competent but unhurried player would. It opens with reception, a consultation room and a massage suite. It adds a staff room, restroom, seats, drinks, plants, bins, extinguishers, a linen hamper, and heating or cooling as the weather asks. It hires the best applicant for each station (and a second receptionist for a Shop Counter: see the bug in 7), and builds a Training Room as soon as anyone is untrained in something guests arrive with. It trains staff one at a time, builds each discipline's room and equipment as stars unlock them, and adds rooms where lines are long while the center turns a profit. It buys land when it runs out of room, takes a loan when it must, gives raises when asked, promotes, accepts emergencies, prepares for mishaps, and declines outbreaks and house calls.

`yarn balance` runs it: every center, five seeds, four in-game years each. The runs are deterministic by seed, so a tuning change can be compared against the same games. All the figures below are medians over the five seeds unless they say otherwise.

The bot's limits, so the figures are read fairly. It never fires anyone, so it rides out a loss-making winter with a full payroll. It does not save toward a money goal. It does not manage lines, prices, policy or marketing. A good human player will beat it everywhere; a new one will do worse. What matters is where it stalls, and why.

## The pace in numbers

| Center             | ★1           | ★2          | ★3          | Months below 15% rep | Months at a loss | Lowest cash | Avg wait | Healed | Guests/month (yr 1 → yr 3) |
| ------------------ | ------------ | ----------- | ----------- | -------------------- | ---------------- | ----------- | -------- | ------ | -------------------------- |
| Willow Lane        | 0.8 mo (5/5) | 8.0 (5/5)   | 25.7 (3/5)  | 2                    | 21 of 48         | −$13k       | 10 days  | 76%    | 10 → 16                    |
| The Exchange       | 8.8 (4/5)    | 11.1 (4/5)  | 35.0 (4/5)  | 0                    | 18               | −$12k       | 4 days   | 85%    | 12 → 18                    |
| The Boardwalk      | 8.6 (5/5)    | 11.6 (5/5)  | never (0/5) | 0                    | 28               | −$44k       | 4.5 days | 65%    | 16 → 16                    |
| High Pines         | 6.7 (5/5)    | 9.3 (4/5)   | 42.1 (1/5)  | 0                    | 36               | −$116k      | 4.5 days | 66%    | 14 → 13                    |
| The Orchard Estate | 5.5 (5/5)    | never (0/5) | never (0/5) | 4                    | 39               | −$226k      | 5 days   | 53%    | 11 → 11                    |

Months are in-game. A month is 180 seconds at normal speed (30 days of 6 seconds), so Willow Lane's third star at 26 months is about 77 minutes at 1×, or 26 at 3×.

What the objectives were waiting on (the last objective met before each star):

| Center             | ★1 held up by                                                           | ★2 held up by                                          | ★3 held up by                                                        |
| ------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------- |
| Willow Lane        | nothing (heal 5, under a month)                                         | **70% cure rate in a month** (months 3–5 for the rest) | **$25,000 in the bank after the loan** (2 of 5 never)                |
| The Exchange       | **average wait under 3 days** in rush hours (other two done by month 3) | **10 healed with acupuncture**                         | **$60,000 in the bank** (never)                                      |
| The Boardwalk      | **$20,000 in the bank**                                                 | wait under 2.5 days                                    | **15 healed with reiki** (never: no money or room left for a studio) |
| High Pines         | **$25,000 in the bank**                                                 | 10 with sound healing                                  | 15 with reiki (never)                                                |
| The Orchard Estate | heal 30 / 50% rep                                                       | **a Massage Suite of prestige 4** (never)              | —                                                                    |

Two Point Hospital, for comparison (sources in the research notes at the end): a day is 4 seconds and a year 24 to 27 minutes at 1×; every hospital starts at 50% reputation; the first hospital starts with $200,000 and its first six rooms cost about $38,000; its first star is "cure 3 patients"; the base campaign is about 38 hours, roughly 2.5 hours a hospital.

## Findings

Ordered by how much each one shapes the feel of the game.

### 1. Reputation is a knife-edge, not a slow dial

A healed guest adds about 2 points, tapering as reputation climbs (`changeRep` multiplies gains by `1.15 − rep/120`). A failed treatment takes 2.5, a guest who storms out 3, one who gets worse 6, someone quitting 2. Losses never taper.

Worked through, the reputation a center settles at depends on its success rate like this: 85% success settles above 100; 70% settles near 80; **60% settles near 50; below about 55% it falls to zero.** A mix of guests the staff are not trained for (35% of the usual chance) pushes a center straight through that edge, and in the bot's Willow Lane games reputation went from 42% to 18% in one month.

Two Point's are gentler and symmetrical: **+1 for a cure, −1 for an ineffective treatment, −2 for a death, −0.5 for a rage quit, −0.25 for being sent home.** Ours treat a failure as worse than a success is good, a walk-out as worse than a failure, and a guest who gets worse as three times a cure.

_Experiment:_ failure −1.25, walk-out −1, worse −3, starting reputation 45 instead of 30. **No month below 15% reputation in any center** (the baseline had 2 at Willow Lane and 4 at The Orchard), The Exchange's first star two months sooner, and 10 to 25% more guests from the higher reputation. Nothing became trivial: The Orchard still stalls for its other reasons.

### 2. A new star brings guests the center cannot treat yet

Earning a star unlocks new techniques, and guests start arriving with conditions that need them at once (`rollCondition`; weight 0.4 when nobody is trained, and **weight 1 whenever someone is trained, even if the equipment is missing**). Treated anyway, they succeed about a third as often (`BOTCH_FACTOR` 0.35), each failure costs 2.5 reputation and leaves bad vibes (60 of 100) that take up to 15% off the next treatments in that room and lower staff morale. With one Massage Suite, a failure makes the next failure likelier.

At Willow Lane, the first star (under a month in) unlocks Deep Tissue and Sports: four of the six massage conditions. With one untrained therapist, about 40% of guests now get a 30% treatment. The fix needs a Training Room ($4,500 plus a $400 desk), a course ($1,500 to $1,800) and a Stretch Rack ($600), and the only therapist off the floor for 6 days, at the moment the bank is empty (see 4). The first bot, which waited for the money instead of borrowing, never recovered: reputation 3%, a year of losses.

At The Orchard, where everything from the first two stars is open on day one, guests arrive needing any of about 20 techniques across five disciplines. In the bot's games, guests sent to rooms without the right equipment had a 16 to 30% chance.

Two Point does not botch: a patient whose illness has no treatment room is diagnosed and then sent home or waits, for a small reputation cost.

_Experiments:_

- **Untrained weight 0.4 → 0.1.** A modest gain, mainly at The Orchard (healed 53% → 62%, second star reached once). It does not cover missing equipment, which is the bigger leak there.
- **Bad vibes per failure 60 → 30.** The biggest effect of any single change at the tutorial. Willow Lane's third star in all five games at 19 months (from three of five at 26), 88% healed (from 76%), 11 months at a loss instead of 21, and waits halved. No effect at The Orchard, where Reiki Practitioners and the Shaman clear a room completely before its next guest, so the size of a failure's cloud never matters there.

### 3. Demand does not grow with the center

Guests arrive every `30 − 0.2 × reputation` seconds (a 5-day gap at 0%, about 1.7 days at 100%), times the center's twist and 8% a grade. **Nothing else raises it: not a new discipline, not a new room, not more staff.** A new discipline only splits the same guests across more conditions, while adding a specialist's salary ($1,600 to $1,900 a month at rank 1) and a room, and equipment for each technique.

So the bot's centers saw 10 to 18 guests a month throughout, and The Orchard, opened with five disciplines and their specialists ($18,000 a month in wages in one game), had about 11 guests a month against that payroll. Every center past Willow Lane spent most of its months at a loss.

This is the opposite of Two Point, where demand outruns you, more rooms mean more patients cured, and money becomes easy by mid-level (players report $50,000 to $80,000 a month in profit; "money is too easy" is a common complaint). Here the rational play is to build as little as possible, which is not the game.

Two smaller parts of the same problem:

- **Throughput per room is low.** A treatment cycle at Willow Lane took about 24 seconds, of which about 10 were the treatment: the rest was the guest walking over from a seat up to 11 tiles away (`goWait`) and the therapist getting back to the table. One suite manages 7 to 10 treatments a month.
- **Monthly sample size.** Cure-rate and wait goals count only a month with at least 10 guests treated (`MONTH_SAMPLE`). A one-suite tutorial center treats 8 to 10 a month, so Willow Lane's second star waits on the dice of a busy month.

_Experiment:_ raising arrivals alone (gap `21 − 0.13 × reputation`, about 40% more guests) made things **worse**: waits doubled, Willow Lane spent 12 months below 15% reputation, The Exchange's first star slipped from 9 to 21 months. More demand without the money to staff for it only lengthens lines. Demand has to grow with what the player builds and be affordable.

### 4. The money curve is inverted

| Center             | Starting money | A comfortable opening* takes | Left over, in months of a modest payroll     |
| ------------------ | -------------- | ---------------------------- | -------------------------------------------- |
| Willow Lane        | $20,000        | 100%                         | 0.0                                          |
| The Exchange       | $25,000        | 80%                          | 0.8                                          |
| The Boardwalk      | $30,000        | 66%                          | 1.5 (and it opens in winter, at 0.6× guests) |
| High Pines         | $35,000        | 57%                          | 2.2                                          |
| The Orchard Estate | $45,000        | 44%                          | 3.7                                          |

\* Reception, Consultation Room, Massage Suite, Staff Room, Restroom, two benches and a tea station: $19,900. The payroll is a rank-3 receptionist, consultant, therapist and caretaker, $6,750 a month.

The tutorial is the tightest start in the campaign. Every bot game at Willow Lane needed a loan by day 25 to 30, before the first payday, and the same was true at The Exchange. In Two Point the first hospital's core rooms are about a fifth of its starting money.

Two more money problems:

- **Money goals are the commonest blocker** (The Boardwalk ★1, High Pines ★1, Willow Lane ★3, The Exchange ★3), because money is tight and the loan counts against them. They also teach the opposite of growing.
- **There is no floor.** Money can fall without limit. Bot games ended at −$100,000 to −$350,000 with nothing happening but nothing being affordable. Two Point warns at −$150,000 and ends the game at −$300,000.

### 5. Every pressure arrives in the first three months, in every center

In a new game, at any center, the tutorial included:

| Day | What starts                                                                                                                         |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 30  | Staff challenges; VIPs (from the first star)                                                                                        |
| 40  | House calls                                                                                                                         |
| 45  | **The rival opens**: sales that draw away up to 30% of guests, poaching, and a draw of 5% for each grade it stands above the center |
| 60  | The health inspector                                                                                                                |
| 75  | Emergencies (from the first star); mishaps (all but Willow Lane)                                                                    |
| 90  | Stress outbreaks (from the second star)                                                                                             |
| 360 | The awards                                                                                                                          |

At 6 seconds a day, that is everything within nine real minutes of opening the first center. The rival grows on its own clock (`RIVAL_GROWTH` 0.45 points a day), reaching Wellness Center after about 9 months and Healing Center after about 19, which a center on Willow Lane's small plot can barely match.

_Experiment:_ no rival at all. Not easier: Willow Lane slower and more often in a slump, The Exchange's first star three months later. The extra guests it no longer draws away lengthen lines the center cannot yet staff, as in the arrivals experiment. So the rival is not what makes the campaign hard. The case for holding it back is flow: one thing at a time to learn.

Two Point introduces its pressures over the campaign: the inspector visits from the first hospital; other VIPs from the second and third; the training room on the third; earthquakes on the fifth; marketing on the sixth; epidemics on the **ninth** of fifteen; rivals are only leaderboards and award ceremonies. The campaign's slow build comes from that order as much as from the numbers.

### 6. The scenario ramp has a spike and a plateau

- **The Exchange's first star is the hardest first star in the campaign.** Heal 15 and 40% reputation are done by month 3; "average wait under 3 days for a month" during rush hours (2.4× arrivals two days in six, guests 25% less patient) held the star to month 9 in four games and stopped it in the fifth. It is the second center, straight after a tutorial whose first star takes under a month.
- **High Pines repeats The Boardwalk's numbers** (heal 25 / 70 / 160, 45% reputation), so the fourth center is no step up from the third, apart from the cold.
- **The Orchard's second star** asks for a Massage Suite of prestige 4 (with picky guests expecting two stars more than the grade asks), an 80% cure rate, and Wellness Center, on top of the flood in 2 and 3. No bot game got there.
- **Willow Lane's third star** asks for $25,000 in the bank after the loan, which two of five bot games never reached in four years.

### 7. Bugs found along the way

- **A receptionist posted at the Shop Counter never goes back to the desk.** Staff choose a post by line length when they are free, but once at a post they only leave it for a priority room, a break, a drink, bad vibes or a duty change (`staffing.ts`, the `atPost` case). With one receptionist and a Shop Counter (which the guide suggests from the first star), the Reception Desk had a line and **nobody at it 76% of the time** in a bot game at The Exchange, until the receptionist next took a break. Guests storm out at the door. The same holds for any two stations of one role. A free member of staff whose station has no line should move to an unmanned station of their role that has one.
- **Guests come for techniques the center has no equipment for** (2, above): `rollCondition` checks only qualifications.

## What to change

In order. Each is a number or a gate unless it says otherwise; the experiments above and the combined run below are the evidence.

1. **Fix the receptionist stuck at the Shop Counter** (7). Small. Before the bot worked round it, it was the main cause of walk-outs at The Exchange once the counter went in.
2. **Reputation on Two Point's terms** (1): failure −1.25, walk-out −1, worse off −3, quitting −1, starting reputation 45 to 50, keep the taper on gains. Small.
3. **Do not send guests for what cannot be delivered** (2): count equipment as well as qualifications in `rollCondition`; drop the untrained weight to 0.1; and when a diagnosed guest's treatment cannot be delivered properly, let them be **referred on** (they pay the consultation, leave with −0.25 reputation and no bad vibes), as Two Point sends home the untreatable. Halve `VIBES_PER_FAIL`. Small to medium.
4. **Make demand grow with the center** (3): arrivals that rise with each discipline offered with a staffed room (for example +20% each) and with treatment rooms built (diminishing), so building out pays as it does in Two Point. Pair it with a shorter walk to treatment: guests waiting nearer their station's door, or a faster call-in. Medium, and needs its own round of `yarn balance`.
5. **Turn the money curve round** (4): Willow Lane $40,000, The Exchange $40,000, The Boardwalk $45,000 (it opens in winter), High Pines $45,000, The Orchard $45,000 as now (see the combined run below); or keep the money and make the first month's salaries due at the end of the second month. Replace the bank-balance goals early in the campaign with profit goals ("a month in profit"), keeping balance goals for third stars. Add an overdraft floor: a warning, interest on a negative balance, and in Standard and Demanding a game over well below zero. Small.
6. **Introduce pressures center by center** (5). A `pressures` list per center, with every system switched on in the sandbox as now:
   - Willow Lane: the inspector (first visit after day 120), emergencies after the first star. No rival, challenges, house calls, VIPs or outbreaks.
   - The Exchange: adds VIPs, staff challenges, house calls (its office contracts) and the power cut.
   - The Boardwalk: adds the storm and stress outbreaks.
   - High Pines: adds the big freeze, and the rival.
   - The Orchard Estate: everything, with the inspector twice as often.

   And let the rival grow with the center rather than by the calendar: its grade follows the center's, a grade behind at first. Medium.

7. **Smooth the scenario ramp** (6):
   - The Exchange ★1: wait under 5 days, or move the wait goal to ★2.
   - Willow Lane ★2: a 70% cure rate with a monthly sample of 6, or swap the cure rate for "heal 15 with no failures in a month".
   - High Pines: heal 30 / 85 / 180.
   - The Orchard: open what the first star brings (`unlockedFrom: 1`), ★2 prestige 3 and 75% cure rate, and in return a longer ★3 (heal 250) so it stays the longest center.
   - The Boardwalk and High Pines ★3: reiki from the first star at The Boardwalk, or a goal that a full building can meet.

   Small.

8. **Then retune the clock if it still feels slow.** A day is 6 seconds against Two Point's 4. With 1 to 7 fixed, measure again before touching it; the bot's third stars at 26 to 42 months are 1.3 to 2 hours at 1×, which is in Two Point's range per hospital.

### What the combined changes did

Items 2, 3 (the untrained weight and bad vibes only) and 5 (the money only), together: failure −1.25, walk-out −1, worse −3, starting reputation 45, untrained weight 0.1, bad vibes 30 a failure, and starting money of $40,000, $40,000, $45,000, $45,000 and $60,000. Nothing from 1, 4, 6 or 7.

| Center             | ★1        | ★2         | ★3          | Months below 15% rep | Months at a loss | Healed        |
| ------------------ | --------- | ---------- | ----------- | -------------------- | ---------------- | ------------- |
| Willow Lane        | 0.7 (5/5) | 5.0 (5/5)  | 20.8 (4/5)  | 0 (was 2)            | 14 (was 21)      | 83% (was 76%) |
| The Exchange       | 7.5 (5/5) | 10.5 (5/5) | never (0/5) | 0                    | 27               | 80%           |
| The Boardwalk      | 3.9 (5/5) | 13.7 (5/5) | never (0/5) | 0                    | 19 (was 28)      | 70%           |
| High Pines         | 6.7 (5/5) | 11.4 (3/5) | never (0/5) | 0                    | 32               | 66%           |
| The Orchard Estate | 4.8 (5/5) | 12.7 (5/5) | 20.4 (5/5)  | 0 (was 4)            | 8 (was 39)       | 81% (was 53%) |

What it shows:

- **The spirals are gone.** No center spent a month below 15% reputation, and every first and second star was reached in every game but two second stars at High Pines.
- **The tutorial is a tutorial.** Willow Lane's three stars came at about 1, 5 and 21 months: about 2 minutes, 15 minutes and an hour at 1×.
- **The Orchard swung from impossible to the easiest**, level with Willow Lane. With items 2 and 3 fixed, its extra $15,000 is too much: keep it at $45,000, or keep the money and raise its goals. The last center should take the longest.
- **What is left are the walls in 6 and the money goals.** The Exchange's third star stopped only on "$60,000 in the bank" (the bot does not save toward it, but a goal that asks the player to stop growing for months is the wrong shape). The Boardwalk's and High Pines' stopped only on "15 healed with reiki": in those games the building was full before reiki opened at the second star, so the studio was never built. Reiki opening at the first star there, or a goal that does not need a fifth discipline in a small building, would fix that.

## Tools

- `yarn balance` plays every campaign center with the bot and writes `test-results/balance.json`. Set `BALANCE_CENTERS`, `BALANCE_SEEDS` and `BALANCE_DAYS` to narrow it.
- The bot is in [tests/balance/bot.ts](../tests/balance/bot.ts), the runner in [tests/balance/playtest.balance.ts](../tests/balance/playtest.balance.ts).

## Research notes: Two Point Hospital

From the Two Point Hospital wiki (two-point-hospital.fandom.com) unless noted, checked 15 October 2026.

- Clock: a day is 4 s, a year about 24 to 27 min at normal speed (_Hospitals_). Every level starts on 1 January.
- Length: about 38 h main campaign, 73 h with extras (HowLongToBeat, via isthereanydeal.com), so about 2.5 h a hospital for 15 hospitals.
- Starts: Hogsport $200,000 and 50% reputation; most hospitals 50%; late ones 31 to 40%, Rotting Hill 17% (_Hogsport_, _Rotting Hill_).
- Hogsport's stars: cure 3 Lightheadedness; then cure 25, earn $200,000 and reach level 6; then cure 30, earn $400,000, hospital value $750,000. Tumble (5th): cure 50 / 100 / 200 with 50 / 70 / 80% cure rate. The final level's 3★ asks for 1,000 cures.
- Room prices: GP's Office $5,800, Pharmacy and Ward $7,600, General Diagnosis $7,100, Staff Room $5,100, Toilets $5,600. Illnesses pay about $5,000 to $9,000 each.
- Reputation: +1 cure, −1 ineffective treatment, −2 death, −0.5 rage quit, −0.25 sent home or waited too long (_Hospitals_).
- When things arrive: inspector from Hogsport; reporter at Lower Bullocks; mayor and health minister at Flottering; training room at Flottering; earthquakes from Tumble; marketing at Flemington; epidemics from Duckworth-upon-Bilge, the ninth hospital (_Visitors_, _Disasters_, _Epidemics_).
- Bankruptcy: a warning at −$150,000, the end at −$300,000 (_Money_).
- Designers: "If you want to just enjoy the game, you can one-star the levels" (Mark Smart, PCGamesInsider, 2018); stars are meant to be returned to later with later unlocks (Ben Hymers, TheSixthAxis, 2018).
