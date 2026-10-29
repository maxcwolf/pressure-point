# Offers With a Catch

Drafted 27 October 2026.

Revised 27 October 2026 after Max's review: rebuilt around five rules for a good offer and a "best when" test for every answer. The MLM moved to a doc of its own, Essence & Abundance, which Max cut later the same day (see Cut, below). The deck went from eight cards to two that reuse existing systems (The Guidebook kept, The Rescue Base new), with the rest cut or held for later. On the existing offers, "take some", the long booking and the outbreak kit were cut as sliders; "next week", "have them come in" and forecast lines were added, and the referral now costs reputation.

An idea, not a plan: nothing here is decided. Ranked ninth in [the README](README.md).

Today an offer is a yes or a no, and the yes nearly always wins. This idea gives the three offers we have (emergencies, house calls and stress outbreaks) real answers, each best in a state the player can read, and adds two cards built from systems the game already runs. If the shape works, more cards follow.

## What makes a good offer

The rules this doc holds itself to. An answer that fails them is cut.

1. **The best answer depends on something on screen.** Each answer is best in some state the player can read before choosing: cash against payday, who is in and who is away, a line's length, the season or the rush, reputation, ZenMart's standing. The card prints the reading it turns on, as Into the Breach shows the enemy's move before you commit. If one answer wins whatever the state, it goes.
2. **Answers spend different things.** Seven guests or four is a slider, not a choice. Each answer pays or costs in its own currency: money, reputation, staff energy or a station's time, guests' patience, ZenMart's standing. Reigns' four meters and Frostpunk's laws work this way.
3. **Some answers are promises.** At least one answer commits the player to dated days ahead, and the building can change before they come. Breaking the promise costs what the card said.
4. **Known risk against unknown, with the odds printed.** Where chance enters, the card prints it as a percent or as a score the player can see today and improve, unlike Slay the Spire's event rooms.
5. **Turning it down is free, and sometimes right.** Declining costs nothing, and every offer has a readable state in which declining is best.

## The gap it fills

The evidence agent ranked this third of eleven gaps: offers have one right answer, and events run on a timetable.

- **Accepting wins.** `offerEmergency` (`src/core/sim/emergencies.ts`) only offers conditions someone on the payroll can treat. Success pays 70% of the guests' fees as a bonus and 4 reputation; failure costs 4. An outbreak pays $2,000 plus $1,000 a star for letting no more than 2 plus half the stars leave stressed. Max took 7 of 7 emergencies and 5 of 5 outbreaks, and the bot's `brave` habit, which takes everything, came out about even with the bot that picks ([balance log](../../balance/log.md), 24 October, "the bot plays as the owner does"). A choice whose answers come out even is not being felt.
- **The variety is thin.** Six emergency causes (`EMERGENCY_CAUSES`), five outbreak causes (`OUTBREAK_CAUSES`), five VIPs (`VIPS`). A house call is always "send someone for 1 to 3 days" (`makeCall`).

## How it plays

**What the player sees.** The column at the top center keeps the emergency, outbreak and house call panels, each with its ✕ and its time bar. The Accept button becomes a short stack of answers: the name and what it pays on the first line, the catch on a second line in smaller type. Above the stack, one gray line gives the reading the answers turn on: "On today's staff: about 3 to 5 healed, 5 needed." A plain **Turn it down** sits under the stack. An answer that cannot be taken now is grayed, with the reason ("Needs a staffed Shop Counter").

**A month at The Exchange, two stars in.** On day 4 the Exchange Tower asks for an Acupuncturist for two days. The center has one, with six waiting. Sending her pays $1,200; having the client come in pays $600 and costs one place in the line, and the card says her Acupuncture Clinic scores 58 today. The player has the client come in. On day 11 a flash mob forgot to warm up: seven guests with Text Neck. The forecast line reads "3 to 5 healed of 5 needed; 6 to 8 with Rosa back from her course on day 15." Taking them now pays $9,300 if it works. Next week pays $6,700, on a date printed on the card. Referring them to ZenMart pays $1,400 at once and costs a point of reputation. The player books them for day 18. On day 18 a bus pulls up.

## The existing offers

Every number is a first guess, to be measured with the bot. Each table's last column is the test: the readable state in which that answer is best.

### Emergency (from ★1, as now)

| Answer                                 | Pays                                                                                            | Costs                                                                                                                                     | Best when                                                                                                                              |
| -------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Take them now**                      | their fees, and 70% of them as a bonus with +4 reputation if 60% are healed in 25 days (as now) | their line fills today; −4 reputation if it fails                                                                                         | today's forecast covers the target                                                                                                     |
| **Next week**                          | their fees, a 50% bonus and +2 reputation                                                       | a promise: they all arrive on the day printed, 7 days on, with the same target and the same −4; the next emergency comes a week later too | today's forecast falls short but next week's covers it: the therapist is back from a course or a house call, or a hire arrives in time |
| **Refer them to ZenMart** (while open) | 15% of the bonus, at once                                                                       | −1 reputation, and ZenMart gains 5% of its standing points, fading over 60 days                                                           | neither forecast covers it, cash is short of payday, and ZenMart is well behind on the Standing tab                                    |
| **Turn it down**                       | nothing                                                                                         | nothing                                                                                                                                   | neither forecast covers it, and ZenMart is close behind, or reputation is near a star's threshold                                      |

Cut: **take some** (half the guests at 55%). It was the first answer at a smaller size, and the existing "emergencies first" policy already lets a player manage a big group.

**The forecast** is the bot's `canSeeThrough` (`tests/balance/bot.ts`) moved into the sim: staff trained in the technique, half their time over the 25 days, at their rank's chance. It counts staff due back from a course or a house call by the day in question, and prints a range, not a point. The referral's points are kept apart from the rival's own (`rival.referred`), so `rivalCeiling` does not wipe them the next day; 5% is a delighted VIP in reverse (`RIVAL_VIP_KNOCK`).

### House call (as now)

| Answer                      | Pays                                                                                                   | Costs                                                                                                                   | Best when                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Send someone** (as now)   | $600 a day for 1 to 3 days, +15% a rank, at your prices (`callFee`)                                    | their station stands empty; the Send buttons show the line left behind (`callCost`)                                     | two or more in the role, or a short line, and a long call                                        |
| **Have them come in**       | one day's fee at rank 1 if the client's verdict on the room is 40 or more; +1 reputation at 70 or more | the client goes first in its line; under 40, half the fee and −1 reputation. The card prints the room's score today     | one in the role, and a room that scores 40 or more                                               |
| **A standing booking** (★2) | the call three times, 20 days apart, at 0.85 times each, and a fourth fee if all three are kept        | a promise: the dates are on the card, a date nobody goes on costs 2 reputation, and no other house call comes meanwhile | a spare in the role for 60 days, and nothing on the dates: no course, no summer at The Boardwalk |
| **Turn it down**            | nothing                                                                                                | nothing                                                                                                                 | one in the role, a long line, and a weak room                                                    |

Cut: **the long booking** (twice the days at 1.3 times a day). It was "send someone" at a bigger size.

### Stress outbreak (★2, as now)

| Answer                                    | Pays                                                                                                                           | Costs                                                                                       | Best when                                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **Contain it** (as now)                   | $2,000 plus $1,000 a star and +3 reputation, if no more than 2 plus half the stars leave stressed                              | carriers plus 3 calming sessions (`SPARE_CALMS`) to hand out; −5 reputation if it gets away | benches spread out, and time to watch the waiting area                                 |
| **Retail therapy** (staffed Shop Counter) | for 12 days, stressed guests walk to the Shop Counter three times as often; the card prints its last 12 days' takings, tripled | no calming sessions and no bonus: only a cure calms a carrier. Same limit, same +3 or −5    | a Shop Counter that sells well, and lines short enough that carriers are healed fast   |
| **Turn it down**                          | nothing                                                                                                                        | nothing                                                                                     | a packed waiting area: the card counts guests within reach of another (`SPREAD_RANGE`) |

Cut: **the kit** ($1,500 for more calming sessions). It only bought safety, and Max and the bot already contain outbreaks easily, so it would be dead or make them easier. The outbreak still pays for a bet the player rarely loses, which [the gameplay audit](../../audits/gameplay-audit.md) chose to leave; retail therapy at least puts the bet on the floor, as a sweating line at the Shop Counter.

## Two cards

Each is built from systems the game runs today, and each comes off an existing timer, so there is no new deck clock yet. A card waits 8 days (`OFFER_DAYS`) in the same column, in a gold color beside `notice.emergency`.

**The Guidebook** (★3, every center). From the third star, one VIP letter in three says the VIP is writing the regional guidebook. The card names which of the five `VIPS` it is and what they care about, with the lowest and average scores of the center's treatment rooms on that aspect today (`aspectScores`). The thing on the floor: an unannounced writer is an ordinary guest with a notebook, findable by anyone who looks.

| Answer               | Pays                                                                   | Costs                                                                                                 | Best when                                                                             |
| -------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **Name the day**     | as a VIP visit now: $1,500 a star and +4 reputation if delighted       | as now: 5 days' notice, tours 3 to 5 rooms; −4 if disappointed                                        | one or two rooms fall short on what they care about, and can be fixed in 5 days       |
| **Come unannounced** | no prize; if delighted, +6 reputation and 5% more arrivals for 90 days | arrives unmarked within 20 days and judges the rooms they are treated and wait in; −4 if disappointed | every room scores 70 or more on what they care about today, and cash is not the worry |
| **Turn it down**     | nothing                                                                | nothing; the next letter comes as usual                                                               | several rooms score under 40, or a rebuild is under way                               |

**The Rescue Base** (★2, High Pines and The Boardwalk). The mountain rescue hut and the lifeboat station are already house-call clients there (`centers.ts`). One of their calls in three comes as this card instead: the team needs a base for a 4-day exercise. The things on the floor: coiled rope and a stretcher on the Staff Room table, orange jackets (yellow oilskins at The Boardwalk) on the hooks, and a thank-you card pinned up afterward.

| Answer                                   | Pays                                                                                                          | Costs                                                                                                                 | Best when                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **The Staff Room**                       | +3 reputation on the last day, then 3 to 5 of the team come in as guests, with conditions the staff can treat | the Staff Room is out of use for 4 days, as a flooded restroom is: breaks restore no energy, unless there is a second | staff energy is high, or there is a second Staff Room                |
| **Lend them a practitioner** (your pick) | the same, and they come back with +20 morale and 6 experience                                                 | away 4 days and unpaid, their station empty, as on a house call                                                       | a role with two people, or someone whose morale is low               |
| **Turn it down**                         | nothing                                                                                                       | nothing                                                                                                               | tired staff and one person in every role, or summer at The Boardwalk |

It is the one card with no money in it: everyone's energy against one station's line, for reputation and a few guests.

**Cut:**

- **Essence & Abundance**, Kayleigh's oils scheme: moved to a doc of its own, then cut on 27 October 2026 after Max's notes on [the mechanics review](mechanics-review.md): "I hate the name", and "that mechanic is just confusing".
- **The Yoga Retreat**: an emergency for one room at a better fee. Its two answers were one answer at two sizes, and "all six" won whenever the room was free.
- **The Fun Run**: [Grand Occasions](grand-occasions.md) owns Willow Lane's fun run, as it owns The Boardwalk's bachelorette party. Its delayed emergency is now the emergency's own "next week", and the water station was the same answer, smaller.
- **Guru Weekend**: the same axes as the oils scheme (a grifter, the Shop Counter, printed scandal odds), with no counterplay for the scandal, so both answers were a coin flip on reputation. Its "Silence" signing line meets the bar and is kept for a later card.
- **Unplugged**: a feature in itself (new conditions, a locker, sneaking and fetching), built on a noise multiplier, beside The Exchange's own wellness week in Grand Occasions.

**Later, if it lands:**

- **The Film Crew** (The Boardwalk, The Orchard Estate): your finest room closed for 2 days for big money and a dated airing, or the lobby for half and cables underfoot. It needs a room taken out of action without stranding its line, as [the machine ideas](../machine-ideas.md) warn.
- **The lifestyle columnist's free treatment**, the influencer card recast with an existing VIP: free and first, judged loudly; or full price, in line, judged quietly.

## The lines

Recorded, for [docs/dev/announcements.md](../../dev/announcements.md):

- **Next week:** "Emergencies booked in advance must arrive in a state of emergency."
- **The referral:** "Guests we cannot see today are welcome to be seen across the street."
- **Retail therapy:** "Guests feeling stressed are reminded that the gift shop is a calming space."
- **The Guidebook, unannounced:** "Staff are asked to treat every guest as if they were writing a guidebook."
- **The Rescue Base:** "The Staff Room is closed for a rescue exercise. Staff may rest standing."

## Fair play

**Warning.** Every answer names its cost and reward before it is chosen, and every card prints the reading it turns on: the forecast, the room's score, the Shop Counter's takings, the guests within reach. Chances are percents or scores the player can see today. Every later effect is dated: next week's day, the standing booking's three dates, the guidebook's "within 20 days", the exercise's last day. Every offer waits as now and can be put aside.

**Counterplay.** Turning down is always free. The forecast counts what the player can change: courses, hires, house calls. Room scores rise with decor, cleaning and repair. Retail therapy is answered by short lines; the Staff Room by a second one.

**Not easier.** Nothing makes an offer safer for free. Next week pays less and keeps the full penalty. The referral pays little, costs reputation and feeds the rival. Having a client come in pays a day, not the call. Retail therapy takes the calming sessions away. The forecast is information, not softer numbers. Nothing pays karma, since offers repeat.

**No dominant answer: how to measure it.** The bot gets `BOT_OFFERS`, which fixes one answer for every offer: `first` (what `brave` does now), `second`, `third`, `decline`, or `choose`, which reads the card's forecast line. Six seeds at every center. An answer dominates if, as a fixed policy, it is no worse than every other on months to each star, profit a month from the second year, and reputation, at every center; if one does, its numbers move until it doesn't. The target is that `choose` beats every fixed policy and each fixed policy wins somewhere. In play, `offer_answered` gains an `option`, and an answer taking more than 70% of players' answers to its offer is looked at again.

**Switch.** One sandbox switch, **Offers with a catch**, for the two cards, beside the outbreak switch in `SandboxPanel.tsx`. Off, the three old offers keep their answers.

## Where it plugs in

**Checked in the code:**

- `src/core/sim/emergencies.ts`: `offerEmergency` sets `total`, `target` and `reward`; `acceptEmergency(ctx)` gains the answer and, for next week, an arrival day; `endEmergency` reads it.
- `src/core/sim/calls.ts`: `makeCall`, `callFee`, `callCost`, `acceptCall(ctx, staffId)`, `updateCalls` (the timer the Rescue Base rides on).
- `src/core/sim/outbreaks.ts`: `offerOutbreak`, `acceptOutbreak`, `lostMax`; `SPARE_CALMS` and `SPREAD_RANGE` in `src/core/data/stakes.ts`.
- `src/core/sim/rival.ts`: `rivalOpen`, `rivalPoints`, `rivalCeiling`; `RIVAL_VIP_KNOCK` in `src/core/data/standing.ts`.
- `src/core/sim/visits.ts` (`aspectScores`, `vipScore`) and `src/core/data/visits.ts` (`VIPS`, `VIP_DELIGHTED`, `VIP_DISAPPOINTED`, `VIP_PRIZE`, `VIP_GAP_DAYS`), for the Guidebook; `world.flooded` in `src/core/sim/mishaps.ts`, the model for a Staff Room out of use; `SHOP_CHANCE` in `src/core/data/business.ts`.
- `src/ui/components/EmergencyOffer.tsx` (the column and its `PARTS`), `HouseCallOffer.tsx`, `OutbreakOffer.tsx`; `SandboxPanel.tsx` and `src/app/boot.ts` for the switch.
- `src/app/analytics.ts` (`answerOffer`) and `src/app/play-events.ts` (`OfferKind`); [docs/dev/analytics.md](../../dev/analytics.md) for `offer_answered`.
- `tests/balance/bot.ts`: `handleEvents`, `houseCall`, `canSeeThrough`, the `brave` flag.

**New state:** an `answer` on `Emergency`, `Outbreak` and `HouseCall`, an arrival day on `Emergency`, the standing booking's dates, the guidebook visit's mode, the lent Staff Room or practitioner, and `rival.referred`. The save version goes up from 40 to the next free number, and `upgradeSave` gives anything running the first answer.

## Phases

1. **Answers on the three offers** (S to M). The answer stack, the forecast lines, `BOT_OFFERS`, `option` on `offer_answered`, the save version. Ships alone.
2. **The two cards** (S to M). The Guidebook and the Rescue Base, and the switch. Then look at the numbers before anything from "Later" is drawn up.

## Decisions to make

1. **Forecast lines on the cards.** The emergency's "3 to 5 healed of 5 needed", the room scores, the Shop Counter's takings. They turn a gamble into a read, which is the point, but they also say a lot. Default: yes, as ranges, not points.
2. **The referral.** It now costs a point of reputation as well as ZenMart's standing, so it is no longer cash for nothing. Default: keep it, shown only while ZenMart is open.
3. **Have them come in, from the first star.** Default: yes; the client in the line is the thing a first-star player can see.
4. **The cards ride existing timers.** One VIP letter in three from ★3, one rescue-client call in three from ★2. Default: yes, and no deck clock until a third card exists.

## Risks

- **More reading.** Three or four answers and a forecast line is more text in the one place players must read. The buttons stay two lines each, and the gray line says the one thing the answers turn on.
- **The forecast could solve the puzzle.** If `choose` simply follows it and wins by a mile, the ranges widen.
- **Next week stacks pressure.** An emergency booked for day 18 can land beside a mishap or an outbreak offer. That is a promise working as meant, but the bot's waits are the check.
- **The referral may still become the default** for players who ignore ZenMart. If it takes more than 70% of answers, its fee comes down.
