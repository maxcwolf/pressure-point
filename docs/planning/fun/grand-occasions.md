# Grand Occasions

Drafted 27 October 2026.

Revised 27 October 2026 after Max's review: The Exchange's Merger Week is now Mandatory Wellness Week, and The Boardwalk's Regatta Week is now the Boardwalk Blowout, with a bachelorette party in place of the hen party. Revised again the same day against [the review](review.md): the town sets the date and nothing goes quiet; each occasion has one judged line, one mark for the star and one new rule at most; the Fun Run proves the shape; The Orchard's occasion stars the retired surgeon, one of the game's five VIPs, in place of a new Duchess; medals, purses, replays, trophies, finishes and Encores are cut to one line under "Later, if it lands".

An idea, not a plan: nothing here is decided.

Each campaign center ends on a set piece. At the second star the town names the day of a big occasion that pushes the center's own twist to its limit: a fun run down Willow Lane's high street, a law firm's compulsory week of wellness at The Exchange, the summer's biggest week on The Boardwalk, an avalanche that shuts High Pines in with its guests, and a VIP's hundredth birthday at The Orchard Estate. The date is 60 days off and cannot be moved. The player gets one judged line and the mark it needs, and gets ready. Making the mark is the third star's headline goal, in place of today's waits for money in the bank and days without a quit. The third star's techniques and items open at the second star, so the occasion is where they get used. The rest of the game does not go quiet for it.

## The gap it fills

- **The third star is more of the same, then a wait.** The 15 campaign stars in `src/core/data/centers.ts` use 9 of the 12 goal kinds in `GoalSpec` (`src/core/data/types.ts`, lines 734 to 756). The third stars are the first two with bigger numbers, plus $25,000, $60,000 or $150,000 in the bank (Willow Lane, The Exchange, The Orchard) or 30 or 60 days without a quit (Willow Lane, The Boardwalk, High Pines).
- **The waits hold stars up and teach the wrong thing.** Willow Lane's third star waited on "$25,000 in the bank after the loan" in months 9 to 10 ([deep-dive audit](../../audits/deep-dive-audit.md), "What held each star up"). The [balance audit](../../audits/balance-audit.md) calls money goals "the commonest blocker" that "teach the opposite of growing". The [gameplay audit](../../audits/gameplay-audit.md) finds "no quits" free once day 30 comes.
- **No goal asks about what makes a center itself:** its rush hours, seasons or snow, its classes, its picky guests.
- **The third star's content comes after the center is finished.** `unlockedUpTo` in `src/core/state/game.ts` (line 293) returns `max(stars, unlockedFrom)`. Distance Reiki, Chakra Balancing, Overtone Chanting, the Ayahuasca Ceremony and the Vision Quest (`star: 3` in `src/core/data/treatments.ts`), the Brew Pot, Wall Fountain, Trophy Cabinet, Gong of Last Resort and Spirit Fog Machine (`unlock: 3` in `src/core/data/items.ts`) and sprinklers (`SPRINKLER_STAR = 3`, `src/core/data/blazes.ts`) all open with the last star and are never needed for anything.
- **Smaller:** after the last star a center makes a median $20k to $53k a month and ends four years on $0.5M to $1.4M ([balance log](../../balance/log.md), entry 49). The Foundation's gifts are a sink, not play.

## How it plays

**Across a center.** The first two stars are as today. The second star's dialog adds a line: "The town has set the day of the High Street Fun Run: day 312." The third star's objectives list it as one line: "The High Street Fun Run: heal 9 of its 12 runners." Its detail shows what happens, the day, the one new rule, the judged line and its mark. The occasion runs for 5 to 14 days. A result card says whether the mark was made, with the line's count and two reviews from its guests. Making it ticks the objective, and the star comes once the other third-star goals are met too.

**The date.** The town sets it at the second star: 60 days off, or the first day of the occasion's season after that. The player cannot move it. Sixty days is two months to train, build and hire for one known line.

**A typical month before it.** At the second star the PA reads the occasion's line and the banner adds the date. Seven days out, the occasion takes the notice slot at the top of the screen that mishaps use, with a countdown, the judged line and a readiness check under it: each a check or an amber warning ("Runners will want Sports massage. Nobody here is trained in it."). Three days out the PA reminds everyone.

**Nothing goes quiet.** Mishaps, emergencies and stress outbreaks come as they would, each with its own warning: a mishap's 3 days' notice, an emergency's offer that can be turned down. The finale is when they land on top. That is the test.

**During it.** The notice keeps the line live. A toast says when it slips, with what to do: "4 runners healed, 5 days left. The star needs 9: move runners up the Sports line, or send a second therapist." The occasion's guests wear something to tell them apart: race numbers, lanyards, a veil and sash, a hundredth-birthday badge.

**A miss.** The star waits and nothing else is lost. The town sets the occasion again, 60 days after it ends.

This doc owns two set pieces that could also be cards in [Offers With a Catch](offers-with-a-catch.md): Willow Lane's fun run and the bachelorette party, which belongs to the Boardwalk Blowout. Offers With a Catch deals no bachelorette card and no fun run at Willow Lane.

Two sibling ideas fit in if they are built: a regular from [The Guestbook](the-guestbook.md) who jogs on the spot in line (Gary, in its examples) can run in the Fun Run, and [The Local Rag](the-local-rag.md)'s payday headline can report each occasion.

The two new centers being written up, [Gate 44](gate-44.md), an airport lounge, and [MS Serenity](ms-serenity.md), a cruise ship's spa deck, bring occasions of their own in their docs.

## The proof: the High Street Fun Run

Prove the shape with the Fun Run, not Snowed In: every player meets Willow Lane first and soonest, Max picked it, and it has a real rule on the floor, a waiting room laid out for guests who must not sit down. Snowed In comes second.

**The moment.** The race comes down Willow Lane's high street. Over its first 3 days 12 runners come in from it, in race numbers, already diagnosed and straight to their line, as emergency guests do, but with condition starting at 80, not 65. A third each have Knotted Up (Deep Tissue), Stiff Upper Everything (Sports) and Gym Lock (Sports), all first-star techniques. Any time of year.

**The one rule: runners who sit down seize up.** A runner standing jogs on the spot, and their condition holds. A runner who takes a seat worsens at three times the usual rate, and gets up bent in the shape of the bench. Runners take a seat as any guest does, if one is free within 11 tiles of their line (`goWait`). Standing still costs patience: a seated guest loses it at 0.6 of the standing rate (`SEAT_DRAIN`). So the player chooses where runners wait: benches moved away from the Sports and Deep Tissue lines, open floor beside them, and a short enough line that standing does not run their patience out.

**Judged.** Runners healed: 9 of 12 for the star. A runner who finds the center full counts as not healed.

**Levers.** Sports and Deep Tissue courses, a Stretch Rack per Sports table, a Recovery Lounge, benches moved and floor cleared, and the line controls in a table's inspector.

**Lines.**

- PA, start: "Runners are asked to keep moving. Please do not offer them a seat."
- PA, mid: "Runners are reminded that the finish line is outside, not in Reception."
- Review: "Sat on your bench for one minute and was carried to the table folded like a deckchair."

## The other four

Each is the same shape: a day set by the town, one judged line with one mark, and one new rule at most. The center's own twist turned up is not a new rule.

**The Exchange: Mandatory Wellness Week.** Halberd & Finch, the law firm (already a house-call client in `centers.ts`), post record profits and, in lieu of this year's pay rise, book their whole staff a compulsory week at your center. They come in single file, on their phones, in lanyards that say MANDATORY FUN. The partners do not come. The twist turned up: for 7 days every day is a rush day, arrivals at the rush's peak (2.4) and its impatience (1.25) all day (`inRush`, `src/core/sim/twists.ts`). **The one rule:** the firm block-books 8 places at every Qi Gong class held that week, on top of the usual class-goers (`bookClasses`, `src/core/sim/classes.ts`). **Judged:** the firm's staff seen to, healed or through a class, of all who came: 70% for the star. **Levers:** tables and a second Consultation Room for the crowd, a Qi Gong Studio with 8 or more Practice Spots, an Instructor ranked high enough to lead 8, and class days set in its inspector. Its slip toasts come as the waiting room's union demands, each still naming the lever: "The waiting room has unionized. Demand: waits under 5 days. The firm's offer: a pizza party. Yours: a second table." The jokes land on the firm and its bosses, never its staff.

- PA, start: "In lieu of a pay rise, every employee will receive one (1) shoulder massage."
- PA, classes: "Attendance at this week's Qi Gong classes is voluntary and will be recorded."
- Review: "Was told to relax by a man whose bonus is my salary."

**The Boardwalk: The Boardwalk Blowout.** The summer's biggest week on the shore, somewhere inside May to September. The day-trippers, shoobies or bennys depending on which end of the shore you ask, come in tank tops, and the gym bros among them do push-ups in the line. A quarter of them have Far Out (Distance Reiki), from a nap on a pool float, or Off Balance (Chakra Balancing), from the Tilt-A-Whirl: third-star techniques, open since the second star. The twist turned up: 10 days at summer's arrivals (1.9) with a heatwave of 10°F on top (`outdoorTemp`, `src/core/sim/warmth.ts`). **The one rule:** on day 3 a bachelorette party of 8, all Lobstered (Swedish), waits as one. The bride leads a fist-pumping conga in a veil and sash, and one bridesmaid carries a giant stuffed banana won at the ring toss. They share one patience, the average, and write one review. If it runs out they leave together, and it counts as one guest storming out, not eight. **Judged:** the week's guests healed, the party counting as eight: 65% for the star. **Levers:** Air Conditioners, Swedish tables enough for eight (Couples Suites, if [Couples and Groups](couples-and-groups.md) is built first: the party is that rule at eight), the Distance Reiki and Chakra Balancing courses, and benches together for the party.

- PA, the party: "A bachelorette party has arrived. They will be seen together, or not at all."
- PA, the line: "Push-ups in the line will not be billed as a treatment."
- Far Out, the occasion's blurb: "Fell asleep on a pool float at noon and woke up past the buoys at four."

**High Pines: Snowed In, With Company.** A day inside November to March. Snow climbs the windows a little each day. The day before, the last bus up brings 8 guests, and then the road is shut for 8 days: nobody arrives (`snowedIn` and `cutOff`, `src/core/sim/twists.ts`). **The one rule:** nobody leaves either. A guest healed while it is shut stays as a lodger until the plow: they eat, drink, use the restrooms, feel the cold, get bored and play cards on the benches like any waiting guest, but cannot storm out. No cliff: nobody can leave. **Judged:** everyone's patience inside, averaged once a day while it is shut: 50 for the star. **Levers:** snacks, drinks, restrooms and Radiators for a crowd, benches, and an arcade or pool table away from the treatment rooms.

- PA, three days out: "The avalanche is due in three days. Please stock snacks, drinks and patience."
- PA, start: "The road is closed. There is plenty of herbal tea. There is nothing else."
- PA, end: "Guests may leave with the snowplow, which cannot take the choir."

**The Orchard Estate: The Surgeon's Hundredth.** The retired surgeon, the VIP who cares most about cleanliness (`VIPS` in `src/core/data/visits.ts`), turns one hundred and spends a 5-day weekend at the estate. She runs a gloved finger along every table she passes. **The one rule:** she has an itinerary, a booked treatment on each of her first 4 days (Hot Stone, Crystal Bowls, Chakra Balancing, a Vision Quest), and goes first in any line. Each room she uses is judged as a VIP judges one (`aspectScores` and `vipScore`), cleanliness three times over (`VIP_CARES`), plus whether the treatment worked. **Judged:** her verdict, averaged over the four: 70, the mark at which a VIP is delighted (`VIP_DELIGHTED`), for the star. **Levers:** Caretakers and cleanliness first, then linens, warmth and calm in four rooms, the Spirit Fog Machine, and the Chakra and Vision Quest courses.

- PA, start: "The good towels are out for the birthday, and nobody is to use them."
- PA, mid: "Staff will scrub in before entering any room with the birthday guest in it."
- Her review: "I have had a hundred birthdays and this was certainly one of them."

## Rules and numbers

Every number here is a first guess, to be set against the bot.

- **Opens** at the second star, in the campaign. The third star's techniques and items open at the same time: once two stars are earned, `unlockedUpTo` counts three. At The Orchard, whose `unlockedFrom: 2` opens the second star's content from the start, the third's still waits for the second star. Upgrade level 3, the third-star plots and the Foundation stay at the third star: the first two go through `starsEarned`, and the Foundation through `s.stars` (`foundationOpen` in `src/core/sim/foundation.ts`), none through `unlockedUpTo`.
- **The date.** Set by the town at the second star, 60 days off, or the first day of the occasion's season after that: the Boardwalk Blowout May to September, Snowed In November to March, the rest any time. Not movable.
- **The mark.** One judged line and one number for the star, as above. Every occasion guest who goes home worse off costs the usual −6 reputation and counts against the line.
- **A guest who finds the center full** is counted, as `stats.turnedAway` already counts them (`src/core/sim/records.ts`), and counts as not healed, so a low intake limit is no way round the line.
- **A miss** costs nothing beyond what happened on the day. The town sets it again 60 days after it ends.
- **The star's own $15,000 grant** is the only money. No purse.

## Fair play

**How it is warned of.** The occasion, its rule, its line and its mark are known from the second star. 60 days' notice, a PA line at the second star and 3 days out, and the notice at the top of the screen from 7 days out with a readiness check under the line. Toasts as the line slips, each naming a lever. The same notice and toasts for every occasion, so one learned at Willow Lane reads the same at High Pines.

**The counterplay.** Every occasion is built from systems the player already runs, and its line names its levers. The one new pressure each has a cushion: a runner who stands holds their condition, the bachelorette party's walk-out counts as one guest, lodgers cannot storm out, and the surgeon goes first in any line. Every other event that lands during it keeps its own warning. A miss costs only the day's own consequences and 60 days.

**Why it is not easier.** It swaps two goals that wait (money in the bank) or come free (no quits) for a test of the whole center under its own twist turned up, on a day the player did not choose, with the rest of the game still running. Opening the third-star content a star early adds tools, but the occasions are built to need them. The mark is to be set so that the good bot makes it at the first try in about two games of three, and the third star's median month does not come more than a month earlier than today at any center.

## Where it plugs in

Only what the proof needs, each checked in the code:

- `src/core/data/types.ts`: `GoalSpec` gains `{ kind: 'occasion' }`; `CenterDef` (which holds `unlockedFrom`, line 801) gains `occasion`.
- `src/core/data/centers.ts`: Willow Lane's third tier becomes heal 40 and the occasion. The others' tiers change as their occasions land.
- `src/core/sim/goals.ts`: `objectiveFor` and `objectiveDetail` for the line and its detail. `checkStars` in `src/core/sim/progress.ts` needs no change.
- `src/core/state/game.ts`: `unlockedUpTo` (line 293). One save version bump from 40 (or the next free number) for `GameState.occasion` (its day and the line's tally) and a mark on each occasion guest.
- `src/core/sim/emergencies.ts`: guests that arrive diagnosed (`spawnGuest(ctx, condition, true)`).
- `src/core/sim/guests.ts`: `goWait` (a seat within 11 tiles, else a standing spot) and `seatDrain`. `src/core/sim/worsening.ts`: `worsen`, three times over for a seated runner, nothing for a jogging one. `src/render/pose.ts`: `treadmill`, which already walks someone on the spot for the model lab.
- `src/core/sim/mishaps.ts` and `MISHAP_NOTICE_DAYS` (3) in `src/core/data/mishaps.ts`: the pattern for notice. `src/ui/components/MishapNotice.tsx`: the notice's place on screen.
- `src/ui/components/dialogs/StarDialog.tsx` and `AwardsDialog.tsx`: the models for the second star's line and the result card.
- `tests/balance/bot.ts`: the bot must get ready for the line before the rerun can set the mark.
- Recordings: the 11 PA lines above, added to [announcements.md](../../dev/announcements.md).

## Phases

1. **Third-star content at the second star** (S). One change in `unlockedUpTo`, with the bot rerun. Ships on its own and is worth doing even if nothing else here is.
2. **The frame and the Fun Run** (M). The date, the notice, the line, the result card, the runners' seated rule, the save version, the bot getting ready, and Willow Lane's third tier changed. Rerun at Willow Lane, and a playtest: does the player read the readiness check and move the benches?
3. **Snowed In** (M), if the Fun Run lands. Lodgers.
4. **The other three** (S to M each). The block booking, the group with one patience, the itinerary guest. One a release, with a rerun at each center.

## Later, if it lands

Medals, purses and replays after the third star, trophies and floor finishes, and Encores (retreat weeks the player designs): none until the one-line version has been played.

## Decisions to make

Each has the default this doc assumes.

1. **The occasion is the third star's headline goal.** The other way is occasions as a post-game only, which players who stop at three stars never see. Default: the third star's goal.
2. **When the third-star content opens.** At the second star (default), or at the occasion's date. The second star is one rule in one function and gives time to train.
3. **Which occasion proves the shape.** The Fun Run (default), or Snowed In as the review suggests: Snowed In's rule is the stronger one, but it sits at the fourth center, so its playtest comes a year of play later.
4. **Which third-star goals go.** Only the money and no-quits goals (default). The reiki goal that held The Boardwalk and High Pines up in months 22 to 40 stays until the rerun says otherwise.

## Risks

- **The bot has to play it.** The bot needs to read the line and get ready: courses, rooms, comforts, and for the Fun Run where the benches go. Without that, the rerun cannot set the mark.
- **Stacking may be a cliff.** With nothing muted, a mishap and an emergency on the occasion's first day could sink the line. Each is warned on its own and the emergency can be turned down; the rerun should count how often a miss follows one, and if it is often, the town's date should at least miss a mishap already on notice.
- **The seated rule may not read.** A runner worsening on a bench must be seen: the bent pose, the readiness check ("Runners on benches seize up. 6 seats are near the Sports line.") and the toast. A playtest is the check.
- **Seasonal waits.** A player who reaches the second star in October waits until May for the Boardwalk Blowout. If it drags, the Blowout could come in any month with its own heat.
- **Old saves.** A game at two stars on an older version finds its third goals changed. Say so in the changelog. Games with three stars lose nothing.
- **Tone.** Mandatory Wellness Week's jokes are on the firm and its bosses, never its staff. The Blowout's are on boardwalk culture (the traffic, the ring toss, the push-ups), never on who people are. Read every line against that before it is recorded.
