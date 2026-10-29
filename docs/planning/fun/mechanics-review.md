# Mechanics review of the fun ideas

Written 27 October 2026, against every doc in this folder after its revision, and the code on main at 0.34.3. It asks one question of each idea: what does the player decide that they could not before, and is it a decision worth making twice? It does not repeat [review.md](review.md)'s notes on writing, which still hold. A review, not a plan: nothing here is decided, and Max's tiers in [the README](README.md) stand.

**Max's answer, the same day.** He likes all four new mechanics, and each now has a design doc: [Make It Right](make-it-right.md), [Couples and Groups](couples-and-groups.md), [Courses of Treatment](courses-of-treatment.md) and [ZenMart Express](zenmart-express.md), the ZenMart that copies you. He cut Essence & Abundance: he disliked the name and found the mechanic confusing. Its section below is kept as written. The other decisions in the last section are still open.

## The short version

- **Read for mechanics, the order changes.** The ranked list puts delight first, which suits Max's notes. But only three of the top six add a decision: Grand Occasions, Staff Room Politics and Essence & Abundance. Offers With a Catch sharpens one that exists. The Local Rag and the horoscope add none. They are communication, which the game needs, but not play.
- **The two best mechanics are in the two new centers:** Gate 44's per-guest deadline, and the MS Serenity's sore passenger who can be won back. Both can come to the five centers that exist for far less than a center costs.
- **Each real mechanic at the top has a problem in the code.** The Fun Run's one lever is to take out nearly every bench at Willow Lane. Staff Room Politics' rapport feeds on morale, so a struggling center struggles more. Essence & Abundance's fixed fold date makes its best play a schedule, and its slump puts recruits in ZenMart's reach.
- **Four mechanics the folder lacks,** each built on a system the game already runs: Make It Right, Couples and Groups, Courses of Treatment, and a ZenMart that copies you.

## The yardstick

Four questions, most important first:

1. **What scarce thing does it spend?** A table's time, someone's day, a place in the line, floor space, a date. Not money: money piles up from the second star, and a center clears $20k to $53k a month after its third ([balance log](../../balance/log.md), entry 49). A decision that costs only money stops being one.
2. **Is more than one answer right,** depending on something the player can see?
3. **Can a player get better at it?** Reading a forecast is a skill once. Laying out a waiting area or ordering a line is a skill for good.
4. **Does it touch what is already there:** lines, layout, morale, the rival, the seasons? Mechanics that combine with the old ones make stories. Ones bolted on beside them make chores.

And one test of fit: Max is paused about two thirds of the time. Mechanics that reward planning on a paused screen, such as a board, a layout or a date, fit how the game is played. Ones that need fast clicks, such as a chase or an escort, fit worse.

## Where the game is free

The gap table in the README lists symptoms. Under most of them is one pattern: things that should cost something cost nothing, so the right answer never changes.

| Free today                 | Evidence                                                                                                                            | What puts a price on it                                   |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Saying yes to an offer     | `offerEmergency` offers only conditions someone on the payroll is trained in, so a yes can always be seen through. Max took 7 of 7. | Offers With a Catch: "next week" and the forecast         |
| Swapping a member of staff | Letting go costs only the wages since payday. The bot swapped 404 times in 30 games (entry 47).                                     | Staff Room Politics: the photo and the Let Go line        |
| Waiting for the third star | Third stars ask for money in the bank and days without a quit.                                                                      | Grand Occasions                                           |
| Growing                    | Every pressure has the same answer, build or hire more, and the bot buys nearly every plot (entry 38).                              | Nothing, beyond Gate 44's and the Serenity's narrow hulls |
| Raising prices             | 1.3 to 1.4 is nearly free and worth about a fifth of income (entry 46).                                                             | Nothing in the top six. See a ZenMart that copies you.    |

The best ideas in the folder are the ones that charge for something free. The two rows with nothing against them are where a new mechanic pays most.

## The ideas, by what they add to play

| Idea                | The decision it adds                               | What it spends                                    | As a mechanic                                           |
| ------------------- | -------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------- |
| The Local Rag       | None                                               | Nothing                                           | None, by design                                         |
| Under the Stars     | None of its own: more notice                       | Nothing                                           | Thin. Caretakers mostly prevent Mercury before it shows |
| Grand Occasions     | How to get the whole center ready for a known date | Two months of building and training for one line  | Real. The best for the five centers                     |
| Staff Room Politics | Who to keep, and who works beside whom             | A better applicant against a settled pair         | Real, but narrower than it reads                        |
| Essence & Abundance | How many recruits to carry                         | Guests' patience against cash and morale          | Real, but its fixed date solves it                      |
| Offers With a Catch | Now, later or elsewhere                            | A promise on a date, reputation, a room's verdict | Real. Sharpens the decision that exists                 |
| Gate 44             | Who to fit in before their flight, and with what   | A table's time against a deadline                 | Strong. The folder's best                               |
| The MS Serenity     | Whom to win back                                   | A free treatment slot                             | Strong, and it travels                                  |
| Loose Spirits       | Which job a Caretaker does first                   | A Caretaker's time                                | Thin                                                    |
| Kyle from ZenMart   | Keep the line short in a sale                      | Nothing new                                       | Thin. The notes are a fairness fix                      |
| The Guestbook       | Where to put a keepsake                            | Nothing                                           | Thin                                                    |

## The ideas, one by one

Only what this review adds.

### Grand Occasions

**What it adds.** A date set by the town, known 60 days ahead, that the whole center gets ready for. It is the one idea that gives the two months after the second star a target, and money a use before the third. It is the folder's best mechanic for the centers that exist, and phase 1, the third star's content at the second, is right whatever else is built.

**The Fun Run's lever is to strip the waiting area.** A waiting guest takes any free seat within 11 tiles of their line: `goWait` calls `findAccess(ctx, 'seat', ax, ay, 11)` in `core/sim/guests.ts`. Willow Lane's building is 16 tiles by 10 (`plot: { x0: 7, x1: 22, y0: 8, y1: 17 }` in `core/data/centers.ts`). So "benches moved away from the Sports line" means nearly every bench in the building, for three days, and every other guest pays for it. The rule's only answer takes something away, and it reverses what the campaign has taught about benches since the tutorial. Two ways to give it an answer in the layout:

- **Runners look for a seat only within 3 tiles of their line.** The player lays out a warm-up strip: open floor by the Sports and Deep Tissue suites, with the benches further down the corridor. The waiting area stays; its shape changes.
- **Runners need floor to jog on.** A runner who finds an open 2-by-2 spot near their line jogs there and holds. One who finds none sits and seizes. The answer is floor, which the player makes rather than takes.

The doc lists a Stretch Rack per Sports table as a lever. That is the Sports equipment itself (`stretch_rack`, `where: 'massage'` in `core/data/items.ts`), needed to give Sports at all, so it is no answer to sitting.

**Without the seat rule, it is an emergency.** Twelve runners, already diagnosed, at condition 80, two thirds of them for Sports: the test is whether Sports is trained, as an emergency's is. The seat rule is all that is new, so it is worth getting right before the frame is built around it.

**The group is the rule to keep.** The Boardwalk Blowout's bachelorette party, eight guests with one patience who leave together, is a better rule than its occasion. It belongs in everyday play: see Couples and Groups below. Snowed In's lodgers stay the strongest one-off rule.

### Offers With a Catch

**What it adds.** Answers that spend different things, and a promise, "next week", that the building can grow into. Its five rules for a good offer are the best yardstick in the folder.

**The play is in changing the forecast, not reading it.** A card that says "3 to 5 healed of 5 needed" and stops is a reading test, and once players trust it, the answer is whatever it says. The doc's own example has the right form: "6 to 8 with Rosa back from her course on day 15." Make the second clause a rule. Every forecast that falls short names what would close the gap in time: a course that ends, a house call that comes back, an applicant in the Hire menu. Then "next week" means "go and do that".

**Retail therapy has nothing on the floor that decides it.** It moves an outbreak's money from the bonus to the Shop Counter. A spatial answer keeps the doc's rules better. **A quiet room:** carriers wait only in a room the player picks, a Recovery Lounge or a spare suite, where they reach nobody outside it, and the room does nothing else for the outbreak's 12 days. It spends a room. It is best when one stands spare, and worst in a small building.

**The Guidebook's unannounced writer is the doc's one test of skill:** an ordinary guest with a notebook, found by looking. Spotting them and moving them up the line is play a paused player enjoys. Lead with it.

### Staff Room Politics

**What it adds.** A reason to keep people, and something on the floor for morale: photos, notes, an argument in the corridor.

**Placement is a narrow lever.** `assignRoom` refuses any room where the role has no station (`canWorkIn` in `core/sim/assignments.ts`), so a Massage Therapist moves only between Massage Suites and an Acupuncturist between clinics. Who works beside whom is mostly fixed by a layout built months before. At Willow Lane, with one or two suites, there is nobody to move. The levers that really work on a tense pair are pay, rest and letting go, which are the morale levers the game has.

**Rapport follows morale, so it adds to whatever is already happening.** Content pairs bond and get +4. Unhappy pairs feud and lose stations. In the mid-center squeeze morale is already low, since paying into the red lowers it, so a center short of money also loses stations to arguments. That is a loop that pushes the way things are already going: the kind of cliff Max asks to remove ([challenging but fair](../../research/fair-challenge.md)). Drive rapport from something the player chooses that is not morale. Two candidates:

- **Hard days together.** Staff who work through the same emergency, outbreak, mishap or occasion in neighboring rooms bond. A rough week leaves photos, not feuds: "Ingrid and Mo, Mandatory Wellness Week, Year 2."
- **Quirk pairs.** Each quirk gets on with one quirk and grates on another, printed on the applicant's card: "Can't stand a Chatterbox." Hiring is the decision players make most often and read most closely, so the verb becomes hiring for the team, where it will be seen.

**The feud may cost too little to see.** Half a day for two stations, at most once in 10 days, and one day in three when allowed: about 5% of two stations' time. That is the size [review.md](review.md) called too small to feel in Loose Spirits. Let the noise carry the cost. Noise already spoils treatments nearby, so an argument outside a suite shows in failed treatments as well as in an empty room.

**Ship the friends half first.** It is the half that answers gap 4, by giving a swap a cost the player can see, and it adds no new pressure. The feud can follow once the source of rapport is settled.

### Essence & Abundance

**What it adds.** The one offer that runs for months, with its cost on the floor. The tension is real: lines are longest when money is shortest, so the scheme pays best exactly when its cost hurts most.

**The fixed day makes the best play a schedule.** Have a Word costs a recruit 15 morale, and so does Phase Two. Every recruit takes the hit either way, so the only reason to speak to one early is a long line. Otherwise, keep everyone to the last ten days and cash out. A player who has done it once knows the answer. The decision is in the doc's "Later" list: printed odds of the fold that rise each month ("Fold risk this month: 10%. Next month: 20%."). Then every payday asks the question again, the risk is printed, and the fold can come before the player is ready, warned as a percent. That is push-your-luck inside the fairness rule, and it is the version to build first.

**The slump puts recruits in ZenMart's reach.** The floor of 26 keeps everyone above the quit clock (`MISERABLE_MORALE`, 25) but inside ZenMart's job offers (`POACH_MORALE`, 35) and the raise requests (under 56, in `updateMorale`). Morale moves back toward its target at 3% of the gap a second, so a 15-point hit takes about ten days to wear off. Any recruit under 50 when the scheme folds lands below 35, and the scheme is joined in the squeeze, when morale is low. Either hold ZenMart's next job offer until ten days after the fold, or print on the card that Phase Two leaves the team open to offers.

**The player cannot choose who joins.** Whoever starts a break first while Kayleigh is in joins, and the player can only prune. A second Staff Room is the one way to keep someone away from her. Say so on the card, so building one is a choice made for a reason.

### Under the Stars

**It adds little to play, by design.** The horoscope lengthens notice on events that already give it: the VIP's letter and the inspector's notice five days ahead, a mishap's three. Most preparations take less than that. Longer notice matters where preparing is slow, such as training for an emergency, but an emergency can be turned down, so knowing early changes little. Its worth is trust and tone, which Max asked for. Count it as communication.

**Mercury is mostly prevented before it is seen.** A machine runs backward from `WEAR_REPAIR` (50), the wear at which Caretakers already start repairing. With a Caretaker free, the window is short, and by the doc's own figure the bot fits a machine in 1 game of 30. To make it a decision rather than a rare gag, set its threshold below the Caretakers', at 30 say. Then a service before the spell is a job the player has to ask for, two weeks ahead, which is what the forecast is for.

**Too much forecast flattens a month.** If every event is in the horoscope, the month reads as a checklist. The smudged line is the right instinct. Consider leaving the mishap to its own three days' notice, so something still arrives as news.

### The Local Rag

No mechanic, and none is wanted. It is the cheapest thing in the folder and the idea Max liked most, so build the headline in a gap, as polish. It does not count toward the question this review asks.

### Gate 44

**The folder's best new mechanic.** Every guest has a deadline on a board, so the lines become a scheduling puzzle: who fits, with what, and who to let go. It spends table time, the scarcest thing in the game. It rewards planning on a paused screen, and a player gets better at it.

**Keep the decisions in the building, or it becomes clicking.** A guest is moved one at a time (`moveInLine` in `core/sim/queues.ts`), and once Earliest Flight First does the sorting, the per-guest play left is letting go. The levers that scale are the building's: how many rooms are Express and where they are, which techniques the roster has, and policy. Add a second policy beside Earliest Flight First: **Express when it won't fit**, which sends a guest whose full session cannot finish before final call to an Express room at check-in. Then a click on one guest is finesse, not a chore.

**Red-eyes may never be a choice.** A consultation takes a day and an Express Swedish about 0.7 of one (60% of 1.2), so a red-eye with 1 to 2 days fits only with nobody ahead of them. If almost none can be fitted, their ×1.25 fee is never a temptation, only noise. The bot run should show a good layout fitting some.

**It could come home early.** The Exchange's office workers already arrive in rush hours. A share of them on a lunch break, due back at their desks by a day shown over their heads, would teach the deadline at the second center for one guest field and a policy, and give Gate 44 something to build on. Whether the mechanic stays Gate 44's own is Max's call.

### The MS Serenity

**The folder's best answer to gap 4.** A mistake becomes a person still aboard, with friends, whom the player can win back. Comping is service recovery, which the spa trade does for real, and it is a verb that spends a slot, not money.

**It does not need a ship.** See Make It Right below. If the comp comes to every center first, what the Serenity adds is the table: a sore passenger's friends.

**The table's −20 patience is a modifier.** The cloud has to carry it: big enough to read at the default zoom, and on the tablemates in line as well as on the promenade.

### The three parked

- **Loose Spirits:** a Caretaker job with a doorway in it. The ending where it settles into a member of staff is the good part. Thin as a mechanic, so parked is right.
- **Kyle from ZenMart:** the notes are a fairness fix and should ship. The leaflets make a sale something on the floor, since a short line in a sale is a defense, but ZenMart stays a scoreboard. See a ZenMart that copies you.
- **The Guestbook:** a decor reward. Parked is right.

### Below the top six, worth moving up for mechanics

- **The Hand** (second wave): picking up staff and dropping them where they are needed, while paused. It is the verb the genre expects, and the direct answer to a crisis: a fire, a runner, a flood.
- **Takeover openings** (second wave): the only answer in the folder to gap 2 at the five centers. A failing practice to sort out is a puzzle made of the building tools, the game's strongest system.
- **Ley Lines and the Dowser** (wild card 3): the one idea that makes each plot a different layout puzzle, again through the building tools. Shown on an overlay once dowsed, so it is a map to read, not a hidden multiplier.
- **The Cosmic Ledger** (wild card 2): ties the bribe, the mushrooms and AccreditedIsh.com into one trade-off the player runs up on purpose.
- **Today's Intention** (mode 1): saves already replay from their seed, so a daily seeded challenge with two mutators is the cheapest replayability on the list.

## Four mechanics the folder does not have

Each builds on a system the game runs today, and each charges for something free. Sizes are first slices.

### Make It Right

From the Serenity, for every center. A guest who storms out (−3 reputation, `stormOut`) or goes home worse off (−6, `WORSE_REP`) leaves a complaint at Reception: a card pinned on the desk, and a toast with **Make it right**, kept for 5 days. Pressed, they come back within two days for their treatment, free, at the front of its line, with full patience, and in a gold robe, so the guests behind them can see who went first. Healed, half the reputation they cost comes back and their review says so. A regular keeps their loyalty. Let down again, they are gone for good.

- **What it spends:** the front of a line, and the fee. It is best when a line has slack, and worst in a rush, when the free guest pushes a paying one toward a storm-out of their own.
- **Why:** it is the step the fairness grammar is missing. The game warns twice and gives counterplay before the cliff, but after it a loss is final. This is a way back that costs play, not money. It answers gap 4, since the guest you let down has a name and a second visit, and gap 9, as an active way out of a bad patch.
- **Incentives:** it never gives back more than was lost, ignoring it costs nothing new, and finishing it well is rewarded. One comp a guest.
- **Size:** S to M. A list of complaints on `GameState`, a guest who comes back as a regular does (`spawnGuest` already takes a known person), a toast card like the raise requests, and the robe.
- **A line:** "Guests returning for a complimentary treatment are asked not to mention it."

### Couples and Groups

The spa trade's staple. Now and then two guests book together, from the first star, and later a party. They must be treated at the same time in one room, so the room needs two or more tables and as many practitioners free at once. They share one patience, the average, as the Blowout's bachelorette party does, write one review, and leave together if it runs out.

- **What it spends:** two staff free at the same moment, and a bigger room. Every treatment room holds the one table it came with, since the tables are a room's own furniture and not on sale in the Items menu, so no decision today needs two staff free at once. This one does, in a room of its own with two tables, and it makes who is on a break when a question of scheduling. (Corrected after the review: it first said a room could already hold two tables.)
- **Why:** the sim already treats groups, on Sound Bath mats and in Qi Gong classes. This brings it to everyday massage and acupuncture, and the Blowout's party becomes the big version of something the player knows.
- **Size:** M. A pair on the guest, a room check, two stations claimed together, one review.
- **A line:** "Couples are asked to relax at the same time."

### Courses of Treatment

Some ailments need two treatments in order: two techniques ("Cupping, then Swedish") or two disciplines ("Acupuncture, then Reiki"). After the first, the guest walks to the second line and waits again, and the cure counts once both are done. The Recovery Lounge is already a second stop of this kind.

- **What it spends:** a second wait, and the walk between rooms. Which rooms sit next to each other matters, and so do staff in two disciplines and the order of two lines.
- **Why:** today the disciplines run as parallel lines that never meet. A pair ties them together, gives the third star's techniques a place as the second step of common ailments, and makes layout a puzzle about flow, which is where Two Point's fun lives.
- **Risk:** a guest stays in the building twice as long, so arrivals and patience must allow for it. Start with a few ailments at one center, as its twist: The Orchard Estate, where every discipline is open and guests are pickiest, or the next new center.
- **Size:** M to L. A diagnosis that prescribes two, a guest who carries the second, the casebook and reviews.

### A ZenMart that copies you

Each season ZenMart looks at the discipline bringing you the most new guests, which the Guests tab already counts, and opens a cut-price version of it: "ZenMart Express Acupuncture. 25% off. 10 minutes." A note comes two weeks ahead. While it runs, it draws that discipline's price-minding guests, as a sale draws today but aimed at one discipline, and less for each star of prestige on your finest room in it, shown on the Standing tab.

- **What it spends:** a choice of where to grow. The answers are to build up a second discipline, raise that room's prestige, or cut that discipline's price for the season, the first reason the game gives to touch one technique's price (gap 8).
- **Why:** ZenMart plays against what the player does (gap 6), with levers that exist, and it is the first thing in the game to punish leaning on one discipline.
- **Size:** S to M on top of the sale (`saleDraw` and `rivalDraw` in `core/sim/rival.ts`), which already draws by price. The note is Kyle's, if he is built.

## A mechanics-first order

Max's tiers stand. If the aim is new play, this is the order by fun per week of work, each step shipping alone:

1. **Third-star content at the second star** (S). Every review agrees.
2. **Offers phase 1,** with a forecast that names what would close the gap (S to M). The most direct fix for "accept everything", met every session.
3. **Make It Right** (S to M). Every center, and the fairness grammar's missing step.
4. **The Fun Run, with a seat rule that has an answer in the layout** (M). The proof of Grand Occasions.
5. **Staff Room Politics, friends first,** with rapport from hard days or quirk pairs (S to M).
6. **Couples and Groups** (M).
7. **A ZenMart that copies you** (S to M), after ZenMart's warnings.
8. **Essence & Abundance, with printed odds** (M).

Then the centers: Gate 44 first, with Express when it won't fit, since its mechanic is the strongest, and the Serenity after it. Courses of Treatment waits for whichever center is next, as its twist.

In the gaps, as polish: the Rag's headline, ZenMart's warnings, the horoscope and the Manifestation Board.

## Decisions for Max

Each has the default this review would take.

1. **The Fun Run's seat rule.** Runners look for a seat within 3 tiles (default), or they need open floor to jog on.
2. **Where rapport comes from.** Hard days together (default), quirk pairs, or morale as the doc has it.
3. **Essence & Abundance's fold.** Printed rising odds in the first slice (default), or the stated day.
4. **Which new mechanics get docs.** Make It Right first (default), then Couples and Groups and a ZenMart that copies you. Courses of Treatment with the next center.
5. **Gate 44's deadline at The Exchange.** Kept Gate 44's own (default), or a lunch-break share of The Exchange's office workers first.
