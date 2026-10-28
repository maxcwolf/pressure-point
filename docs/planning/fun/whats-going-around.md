# What's Going Around

Drafted 27 October 2026, after Max chose it from [the research drip options](options/research-drip/index.html): "The research drip recommendations sounds great, but i would want to ensure that the system works well with the actual game play flow."

An idea, not a plan: nothing is built until Max has read this. It answers gap 3 of the [Two Point fun gaps review](../../audits/two-point-fun-gaps.md), "a research drip between the stars", and sits beside [Grand Occasions](grand-occasions.md), which reworks the third star.

Every six to eight weeks an ailment goes around town. A week ahead, a dialog in the star dialog's look names it, says why it is going around and what it opens, and the PA reads one line. For the next 30 days guests with it come on top of the usual ones, about a quarter of all new guests, each wearing the ailment's prop. If the technique that treats it is still waiting on a star, the wave opens it early, with its kit. The verb is **chase it or let it pass**. Chasing costs a course, a practitioner off the floor while they learn, the kit, maybe a Recovery Lounge, and a line that crowds the others. Letting it pass costs nothing: a wave guest the center cannot treat turns around at the door and says they will come back later.

The heart of this doc is [one wave through the code](#one-wave-through-the-code), step by step, with what has to change at each step, so it can be checked against the game as it plays today.

## The gap it fills

- **Nothing new between the stars.** Rooms, techniques and items arrive in three lumps (`unlockedUpTo` in `src/core/state/game.ts`, each technique's `star` in `src/core/data/treatments.ts`). At The Exchange a good player waits about four months between lumps, and the third star opens no technique at all, since the center has only massage and acupuncture.
- **No "a new thing has arrived" moment.** Two Point's new illness with a fanfare is the beat the review missed most. Today the closest thing is an emergency (`src/core/sim/emergencies.ts`), which only ever offers guests the center can already treat, so it never brings anything new.
- **After the last star, nothing comes.** That part is for later, once the first slice has been played: [After the last star](#after-the-last-star).

## How it plays

**The moment.** Day 158 at The Exchange, a month and a half after the first star. The player has an Acupuncture Clinic with one table and one Acupuncturist. The game pauses on a dialog: GOING AROUND TOWN, **Cold Feet**. "Got them before a big decision. Never got rid of them." The trading floor's bonuses were announced, then postponed, and half of Mercer Street has them. From day 165, for 30 days, guests with Cold Feet. Moxibustion opens now, ahead of the second star: train an Acupuncturist in the Training Room, and the Moxa Burner is in the Items menu. Not ready in time? They turn around at the door and come back another time. Nothing is lost.

The PA: "Cold Feet is going around. Moxibustion is open; train an Acupuncturist now."

Under the objectives, a card: **Going around: Cold Feet**, in 7 days, for 30 days, with three lines that tick as the player gets ready: Moxibustion open (✔), someone trained in it (⚠ until they are), a Moxa Burner in a room (⚠ until there is).

**Chasing.** The player sends the Acupuncturist on the Moxibustion course ($2,200, 7 days), so for a week the one acupuncture table stands empty and the acupuncture line grows. They buy a Moxa Burner ($900). Moxibustion needs a rest after, so the Recovery Lounge they skipped is suddenly worth building. From day 165 guests with cold blue feet walk in on top of the usual crowd, about one for every three usual guests, and the acupuncture line doubles. Rush days at The Exchange make it worse. Each one healed pays Cold Feet's $1,600.

**Passing.** The player has no money for the course, or no second Acupuncturist to spare in a rush week. They leave it. From day 165 a guest with cold blue feet now and then walks up to the door, reads the sign, shrugs, and walks off with a "Next time" bubble. Nobody waits, nobody is charged, the intake cap never notices, and reputation does not move.

**Afterward.** On day 195 the wave ends. Moxibustion stays open either way. If someone trained in it, Cold Feet guests keep coming as they would after the second star. If nobody did, nothing changes until someone does.

## The one rule

**For 30 days, guests with one named ailment arrive on top of the usual ones, and whatever treats it is open. A wave guest the center cannot treat turns around at the door at no cost.**

Everything else is plumbing for that rule: the clock that picks the ailment, the warning, the card, and the door.

## One wave through the code

A day is 6 seconds (`DAY_SECONDS`) and a month 30 days (`DAYS_PER_MONTH`), both in `src/core/data/rules.ts`. Each step names the file and function, what it does today, and what changes. Line numbers are as of `88273a00` (0.34.3).

### 1. The clock: when a wave is due

**Today.** Every periodic event has a `next…` day on `GameState` and is checked once a second in `Sim.step` (`src/core/sim/sim.ts`, the `s.slowT` block, lines 264 to 289): `updateEmergency`, `updateOutbreak`, `updateChallenge`, `updateCalls`, `updateVisits`, `updateRival`, `updateMishaps`. Gaps are rolled with `irnd`/`rnd` from `src/core/random.ts` and scaled by `tuning(s, 'chances' | 'trouble')` from `src/core/difficulty.ts`.

**Change.** A new `src/core/sim/waves.ts` with `updateWaves(ctx)`, called in that same block. New state, in `src/core/state/types.ts` with defaults in `startingState` (`src/core/state/game.ts`):

```ts
wave: { condition: ConditionId; warned: number; starts: number; ends: number; opened: boolean; came: number; healed: number; turned: number } | null;
nextWave: number; // the day the next wave is announced; Infinity while none is scheduled
features: Partial<Record<FeatureId, boolean>>; // the features being tested, each on or off in this game (see below)
opened: Modality[]; // techniques opened early by a wave, kept for good
```

**When.** The first slice schedules one wave only: when the first star is awarded (`awardStar` in `src/core/sim/progress.ts`, line 44), at The Exchange, `nextWave = day + 38`, so the wave starts 45 days after the star. If the second star comes first, the wave is dropped, since there is nothing left for it to open early. The full feature rolls every wave 42 to 56 days after the last one ends, from the first star, scaled by `tuning(s, 'chances')`.

**Not in the same week as the others.** Today only emergencies and outbreaks keep out of each other's way (`updateEmergency` waits while `s.outbreakOffer` or `s.outbreak` is set, and the other way round). The wave yields to everything that asks the player for a decision, because its own decision needs a clear week. On the day it is due, `updateWaves` checks the 14 days from the warning to the end of the wave's first week against:

| Clock           | Where                             | Today's spacing                                                              | Clash if, in those 14 days                                         |
| --------------- | --------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Emergency       | `emergencies.ts`, `nextEmergency` | first day 75, then 50 to 80 days after one ends, 8-day offer, 25 days to run | `s.offer` or `s.emergency` is set, or `nextEmergency` falls inside |
| Stress outbreak | `outbreaks.ts`, `nextOutbreak`    | from 2 stars, day 90, then 70 to 110 days, 12 days to run                    | `s.outbreakOffer` or `s.outbreak`, or `nextOutbreak` inside        |
| Mishap          | `mishaps.ts`, `nextMishap`        | day 75, then 80 to 140 days, 3 days' notice; The Exchange's is the power cut | `s.mishap`, or `nextMishap` inside                                 |
| Inspector       | `visits.ts`, `nextInspection`     | day 60, then 120 to 180 days, 5 days' notice                                 | `s.visitNotice` is the inspector's, or `nextInspection` inside     |

If any clashes, the wave moves 7 days later and checks again, at most four times, and then goes ahead. Two things are left out of the check on purpose. VIPs, house calls, staff challenges and ZenMart's sales and job offers are small, frequent or ask nothing of the player's plan: a house call comes every 25 to 45 days at The Exchange (`often: 2`), and a check against it would hold every wave. The Exchange's rush hours (`inRush` in `src/core/sim/twists.ts`, two days in every six) are the center's weather, not an event, and a wave in a rush is the center being itself. The days covered later in the wave are not protected: as [Grand Occasions](grand-occasions.md) puts it, nothing goes quiet, and an emergency landing in the third week of a wave is the game being the game.

### 2. Picking the ailment

**First slice.** Cold Feet (`coldfeet`, treated by `moxa`), fixed, at The Exchange only. It is the one the page showed, Moxibustion is star 2 and needs a kit, a course and a rest, so all three costs of chasing are on the floor.

**The full rule**, in `pickWave(ctx)` in `waves.ts`, from the conditions in `src/core/data/conditions.ts`:

- **Before the last star:** a condition whose technique is the next star's (`MODALITIES[m].star === s.stars + 1`), in a discipline the center has and the player has not switched off (`enabled` in `src/core/sim/treatments.ts`, which reads `disciplineOn` in `game.ts`), and whose discipline's room is open by now (`unlockedUpTo(s) >= ROOMS[room].unlock`). Each technique is picked at most once; that is what spreads the next star's lump out. If none qualifies, a condition the center can already treat that has not gone around yet, so the wave is a crowd with no unlock, as the page's first wave (Tension Headband) was.
- **Excluded:** machine-only techniques (`MODALITIES[m].machine`): their guests come for the machine through `machineArrival` in `src/core/sim/guests.ts`, and a machine room is its own lump. Conditions marked `only` for another center (`conditionHere` in `conditions.ts`), until after the last star. Any condition in an emergency, outbreak or occasion running at the time.
- **Class-goers** (`src/core/sim/classes.ts`) roll their own conditions through `rollCondition` and are never treated; a wave never touches them.
- **Weighting:** the center's own weights (`conditions` in `src/core/data/centers.ts`) favor its local ailments, as arrivals do today.

### 3. The week's warning

**Today.** A mishap is the nearest thing: an announce of its warning, a toast "in 3 days", a notice card with a countdown bar in the top-center column (`MishapNotice.tsx`, `noticeShare` in `src/ui/lib/mishaps.ts`). The star dialog is raised by a sim event (`{ type: 'star' }` in `src/core/sim/events.ts`, routed by `Hud.handle` and `raise` in `src/ui/hud.ts` to `Modal.tsx`).

**Change.** On `s.wave.warned`, `updateWaves` emits:

- `{ type: 'wave' }`, a new `SimEvent`, which `Hud.handle` raises as a new `DialogId` `'wave'`, with a case in `src/ui/components/dialogs/Modal.tsx` showing `WaveDialog`, in the star dialog's look (the mock in `DripMocks.tsx` is its picture). It pauses the game as every dialog does, and queues behind a dialog already showing (`src/ui/lib/dialogs.ts`).
- `{ type: 'announce', text }` with the PA line. It can ship as text only: a line with no entry in `VOICE_LINES` (`src/audio/voice.ts`) plays the chime and shows the banner with no voice. It goes on the to-record list in [announcements.md](../../dev/announcements.md).
- A card under the objectives, beside `ChallengeCard` and `OutbreakCard` in `src/ui/components/Objectives.tsx`, read from `s.wave`: the ailment, days to the start or days left, and three readiness lines (technique open, someone qualified, a kit in a room), each a tick or an amber warning, the same check the step 5 door makes.

**The PA lines**, 8 to 14 words, each an instruction:

- Warning (12): "Cold Feet is going around. Moxibustion is open; train an Acupuncturist now."
- Start (13): "Guests with Cold Feet arrive from today. Moxibustion is in the Acupuncture Clinic."
- Start, if the center is not ready (12): "Guests with Cold Feet will come back later, once we are ready for them." (Built so: one line whatever is missing, so it can be recorded; the advisor names what is missing.)

They are templates: `{ailment} is going around. {technique} is open; train {a role} now.` The wave's end is a toast, not a PA line.

**The advisor.** `nudge` in `src/core/sim/advisor.ts` is first-match-wins. A new `waveAdvice(ctx)` goes just after the emergency offer's line (`s.offer`, step 7 of the chain), as a tip, never an alarm:

- In the warning week, while not ready: "Cold Feet goes around in 5 days. Train an Acupuncturist in Moxibustion, or let it pass.", naming the next thing missing: the room, the course, the kit or the Recovery Lounge.
- During the wave, while guests are turning back: "Guests with Cold Feet are coming back later. Build a Recovery Lounge for the rest after Moxibustion to see them.", with the same next thing missing.

**The lesson.** None. The dialog is the explanation, every time, in two lines, and a lesson card queued behind it would say the same thing twice. The guide gets a short section.

### 4. Opening the technique early

**Today.** One function decides whether a technique is open: `unlocked(ctx, m)` in `src/core/sim/treatments.ts` (line 59), which is `unlockedUpTo(s) >= MODALITIES[m].star && enabled(ctx, discipline) && machineBuilt(s, m)`. `Sim.unlocked` wraps it. It feeds the Training Room's course list (`treatmentsToLearn` in `src/core/sim/careers.ts`, `courses` in `training.ts`, `Courses.tsx`), house calls (`makeCall` in `calls.ts`), emergencies (`offerEmergency`), the guests' conditions (`sentFor` in `demand.ts`), `modalityAdvice` in the advisor, the Treatments menu, the price list, the marketing tab, the room inspector, and the bot.

**Change.** `unlocked` becomes `(unlockedUpTo(s) >= def.star || s.opened.includes(m)) && enabled(...) && machineBuilt(...)`. A wave adds its technique to `s.opened` on its warning day. That one change carries most of it. Five places compare `star` directly and need the same treatment:

- `averagePrice` in `src/core/sim/economy.ts` (line 764), which the `fairMonth` goal reads: it should use `unlocked`.
- The locked card's "Unlocks at star N" in `TreatmentsMenu.tsx` (line 83): an opened technique is simply open, with a chip "Open early: Cold Feet went around".
- `treatmentsUnlockedAt` in `src/ui/lib/unlocks.ts` (line 40), used by `StarDialog.tsx`: at the second star it must leave out what is already open, or the star announces Moxibustion a second time.
- `makeCandidate` in `src/core/sim/people.ts` (line 209), which lets an applicant arrive already knowing a technique if `def.star <= s.stars`. Left as it is: an applicant never arrives trained in an early technique. Training is the cost of chasing, and a lucky applicant would skip it.
- `upgrades.ts` and land use `starsEarned`, which is not touched: a wave opens a technique, never an upgrade level or a plot.

**The kit.** A technique's `equipment` is gated separately: the Moxa Burner is `unlock: 2` in `src/core/data/items.ts` (line 419), and `itemOpen` in `src/core/campaign.ts` (line 108) is what the Items menu (`ItemsMenu.tsx`, line 80), the room catalog (`src/ui/lib/catalog.ts`) and templates (`src/core/templates.ts`) ask. The gate is in the interface only: `placeItem` in `src/core/sim/building.ts` never checks it. `itemOpen` gains a third case, an item that is the `equipment` of a technique in `s.opened`. Without it the player could train for Moxibustion and never buy the burner, and every session would be botched for `'no-equipment'` (`equipmentProblem` in `treatments.ts`). The bot, which already places kit for any `sim.unlocked` technique without asking `itemOpen` (`bot.ts`, line 2346), would hide that bug, so it needs a test of its own.

**Does it stay open?** Yes, the technique and its kit stay open for good once the wave is announced, whether the player chased it or not. Closing something the dialog said was open would be a broken promise, and the second star would then reopen it as if new. What keeps that from costing a player who passed is step 5's second half.

### 5. Arrivals, and the door

**Today.** `admitGuests` in `src/core/sim/guests.ts` (line 166) counts down `spawnT`; when it runs out, a guest comes in if `guestsCounted(s) < intakeLimit(ctx)`, or is counted as turned away (`countTurnedAway`, no reputation cost). The pace is `arrivalPace` (line 118): `between = (30 − 0.2 × reputation) / pace / staffed / lines / difficulty`, with `pace` from `arrivalParts` in `twists.ts`, which multiplies in the center, rush hours and seasons, the grade, ZenMart's draw (`1 − rivalDraw`, `src/core/sim/rival.ts`) and a mishap (the storm's 0.35). Snow stops arrivals altogether (`cutOff`). A signature machine draws guests on top: `ArrivalPace.machines` adds its own guests a month, and `machineArrival` picks one of them by share, rolling only while a machine draws anyone "so seeded games keep" their numbers. A guest's condition otherwise comes from `rollCondition` → `chooseCondition` in `demand.ts` (line 455): first a discipline by its pull, then a condition by `weighed` (line 177), which keeps only conditions `sentFor` can send for and weighs them by the center's weights, `UNTRAINED_PULL` (0.4) when nobody is qualified, and a marketing campaign's `CONDITION_BOOST` (3).

**Change: the wave is a demand like a machine's.** `arrivalPace` gains a `wave` term while `s.wave` is running: `wavePerMonth = tables × WAVE_SHARE`, with `WAVE_SHARE = 1/3`, so wave guests are a quarter of all new guests. It adds to `perMonth` as a machine's does, so the seconds between arrivals shrink, and a new `waveArrival(ctx, pace)` beside `machineArrival` picks the wave's condition by its share of the pace. Because it rides on `pace`, everything already in the pace applies to the wave for free:

- **Rush hours** at The Exchange bring wave guests in at 2.4 times the pace on rush days and 0.6 in a lull, like everyone else.
- **Seasons** at The Boardwalk (1.9 in summer, 0.6 in winter), the storm (0.35), and ZenMart's draw (up to 0.6) scale the wave too: a sale across the street takes wave guests as it takes the rest.
- **Snowed in** at High Pines: `admitGuests` returns before anything when `cutOff`, so no wave guest climbs the road either. The wave's days still pass; a wave that falls in snow is a quieter wave.
- **Lines put guests off** (`lineArrivals`): a long wave line slows new arrivals of every kind, which is part of what chasing costs.
- **The intake cap** applies as it does to anyone (`intakeLimit`, `INTAKE_CAP_MIN` 4): a full center turns wave guests away at no cost, as today.
- **Regulars** keep taking a new guest's place (`dueRegular`); a regular is never a wave guest.
- **Seeded games outside a wave** roll exactly as today, since `waveArrival` rolls only while a wave runs, as `machineArrival` does.

**Change: the door.** A wave guest is spawned by `spawnGuest` (line 241) like anyone. At the moment they arrive, `waveArrival` asks `waveReady(ctx)`: is anyone on the staff qualified in the technique (`quals`) and at work, neither leaving nor away on a house call or a course (`atWork` in `demand.ts`), is there a usable kit (`ctx.world.usable`) in a finished room of its discipline, and is that room offered? And, for a technique that needs a rest after, is there a Recovery Lounge? (Added after the first rerun, balance log 50: without it the bot's chased waves healed 9 of 52.) If not, the guest is spawned already leaving (`goal: 'leave'`), turns around on the path with a "Next time" bubble, is never counted by `guestsCounted`, and adds one to `s.wave.turned`. Nobody waits, nobody worsens, no fee, no reputation. If the player gets ready halfway through, the next wave guest comes in.

**Why the door and not Reception.** Today a guest with an ailment nobody can treat properly is not sent away: Reception and the consultation never check (`completeService` in `src/core/sim/stations.ts`, line 434), `pickStation` finds any table of the discipline (`treatsHere` in `machines.ts` checks the discipline only), and the session is botched. `successChance` (`stations.ts`, line 179) multiplies the chance by `BOTCH_FACTOR` (0.35, `rules.ts` line 22) for `'unqualified'` or `'no-equipment'`, and a failure costs 2.5 reputation, 3 points of the discipline's following and a puff of bad vibes. With no table of the discipline at all, the guest waits by the door until they storm out (3 reputation) or go home worse (`WORSE_REP`, 6). Sending a guest home by hand costs `SEND_HOME_REP` (1). So without the door, letting a wave pass would cost a botch or a storm-out per guest: about 25 reputation over a month at The Exchange. With it, passing costs nothing, and the costs of chasing are the honest ones: the course and the week it takes, the kit, a Recovery Lounge, the line.

**After the wave.** `sentFor` (`demand.ts`, line 171) is what lets ordinary guests be sent for a technique. For a technique in `s.opened` but not yet past its star, it also asks `waveReady` for that technique: an early technique draws ordinary guests only once someone can do it. So a player who passed sees no Cold Feet guests at all until the second star, when Moxibustion opens for everyone as it does today, with today's botches if nobody trained. A player who chased keeps getting them at the usual weight.

### 6. The fee

**Today.** A heal pays `treatmentFee` (`stations.ts`, line 79): the condition's `fee` × `priceFor(s, m)` (the price level × the technique's own price, clamped to 0.5 to 2, `economy.ts` line 728) × the picky center's `fee` (1.5 at The Orchard) × the difficulty's fees. A new guest balks in `goForTreatment` (`stations.ts`, line 348) with chance `mindsPrice × putOffChance(priceFor, reputation)`, which is 0 at a price of 1 or below and climbs from 3% at 1.1 to 34% at 1.4 (`PRICE_PUT_OFF` in `economy.ts`); one balk spoils the month for a `fairMonth` goal.

**The page promised 25% more while it lasts.** With the wave's guests on top of the usual ones (step 5), they are already the reward, and a surcharge raises two problems. Counted in `putOffChance`, it would turn a price level of 1.3 into 1.625 for wave guests, a put-off chance near 70%, and wreck `fairMonth`. Left out of it, it is money for nothing. The first slice ships without it (decision 2). If it comes back later, it goes in a helper beside `priceFor` that `guestFee`, `goForTreatment`, the heal's reputation and `notePriced` in `harms.ts` all call, so the number the guest pays is the number shown and the number judged.

### 7. The star goals

Goals are measured in `objectiveFor` (`src/core/sim/goals.ts`, line 69). Monthly ones read this month or last (`recentMonths`), and each visit's ending is counted in `countVisit` (`src/core/sim/records.ts`). A wave guest who turns around at the door is counted as a new ending, `later`, which no goal reads.

| Goal                               | Measured as                                            | A wave chased                                                                        | A wave passed                               |
| ---------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------- |
| `cureRate`                         | healed ÷ (healed + failed + sent), at least 10 a month | more heals; a session without a Recovery Lounge works less often, and failures count | unchanged: turned-back guests are not in it |
| `monthHeals`                       | heals this month, and the average wait under N days    | more heals; a longer acupuncture line raises the average wait                        | unchanged                                   |
| `fairMonth`                        | prices above 1, N heals, and no guest priced out       | more guests who may balk, as any new guest may                                       | unchanged                                   |
| `healed` (with `discipline`)       | heals for good, by discipline (`healedBy`)             | Moxibustion counts as acupuncture: The Exchange's second star wants 10, the third 20 | unchanged                                   |
| `reputation`                       | `s.reputation`                                         | heals raise it; failures and storm-outs from the longer line lower it                | unchanged                                   |
| `noQuits`                          | days since anyone quit                                 | a busier month tires staff                                                           | unchanged                                   |
| `balance`                          | money less the loan                                    | course, kit and lounge out, fees in                                                  | unchanged                                   |
| `emergencies`, `prestige`, `grade` | as today                                               | barely moved                                                                         | unchanged                                   |

**Never unreachable:** passing changes nothing a goal reads. **Never trivial:** at The Exchange's pace a wave brings roughly eight to twelve guests in the month, so a chased wave can carry most of the second star's 10 acupuncture heals. That is the reward for a real cost, not a gift, but it must not make stars come much sooner. The bot's target (below) holds it: with chasing on, the second star comes no more than half a month earlier on average than with waves off.

### 8. Saves, the sandbox, the switches

- **Saves.** `SAVE_VERSION` in `game.ts` is 40 (line 136). The new fields (`wave`, `nextWave`, `features`, `opened`, and `later` in the stats) get defaults in `startingState`, and `upgradeSave` in `src/core/state/upgrade.ts` (line 259) fills any missing key from `startingState` through `fill`, so an old game loads with no wave, nothing opened, and `nextWave` at `Infinity` until its next star. The version goes to the next free number with a line in the changelog comment above it; other branches bump it too, so the number is set at merge time.
- **The sandbox.** No waves in the first slice: it is The Exchange only. Later, the sandbox takes the same Feature testing switch as every other game (see [Switching it on and off](#switching-it-on-and-off)), rather than a switch of its own on the sandbox panel. With `unlockAll` on, a wave still brings its crowd and opens nothing, since everything is open.
- **Discipline switches.** A wave is never picked for a discipline switched off. If the player switches its discipline off during the warning or the wave, the wave ends quietly, as `setDiscipline` in `treatments.ts` withdraws an emergency today.
- **Analytics.** One event, `wave_ended`, in `happenings` in `src/app/play-events.ts`, compared once a second as `emergency_ended` is: `condition`, `technique`, `opened_early`, `came`, `healed`, `turned`, and `chased` (true if anyone was trained in the technique, or a kit bought, between the warning and the end). A row in [analytics.md](../../dev/analytics.md) and a case in `tests/unit/play-events.test.ts`. It answers the one question that matters: do players chase, and does passing happen.

### 9. The bot

**Today.** The good bot in `tests/balance/bot.ts` learns of open techniques through `sim.unlocked`, `sim.courses` and `unlockedUpTo`. `train` (line 2409) sends one person on one course at a time, picked by `bestCourse` (line 3008): the local weight × the fee × (0.9 − difficulty). `unlocks` (line 2327) buys kit for every unlocked technique in every room of its discipline. `handleEvents` (line 1770) takes every emergency and outbreak, since `brave` is on.

Left alone, the bot would chase every wave by accident: Moxibustion becomes unlocked, `bestCourse` likes its $1,600 fee, and `unlocks` buys the burner. That would measure nothing.

**Change.** A new flag, `chase`, an extra in `BOT_EXTRAS` until it is measured. In `handleEvents`, on the wave's warning day, the bot decides once and notes why (`this.note`):

- **Chase** when all of these hold: a second practitioner of the discipline, or its line at 4 or fewer, so the course does not empty the room; the course, the kit and a month's wages in hand; and the discipline's room built. Then it trains, buys the kit, and builds a Recovery Lounge if the technique needs a rest and there is none.
- **Pass** otherwise. `bestCourse` and `unlocks` skip techniques in `s.opened` that are not yet past their star unless the bot chose to chase, so passing really is passing.

**The rerun.** The first slice is one wave at one center, so `BALANCE_CENTERS=exchange`, 12 seeds, four years, three runs: waves off (`features.waves` false), waves on with `chase`, and waves on with every wave passed. What it has to show:

- **Passing costs nothing.** With every wave passed, star months, profit and the lowest reputation match waves off, seed for seed, within noise.
- **Chasing is worth something, usually.** With `chase`, more heals and more profit over the year on average.
- **Passing is sometimes right.** At least a few seeds where the bot passed and did better than a chase would have: run the chase decision both ways on those seeds and compare the month after. If chasing always wins, chasing costs too little, and the share or the course length moves.
- **No star much sooner.** The second star no more than half a month earlier on average with `chase` than with waves off.

[balance/harness.md](../../balance/harness.md) asks for 72 seeds before a call; 12 are enough to see which way it leans and to set the first numbers.

## Switching it on and off

Max asked for the feature to be one that can be turned on and off while it is being tested. Waves get a switch in Settings, under a new heading, **Feature testing**, which every feature still being tried out shares, so the next one (an occasion, a Make It Right card) is a row more, not a new design.

**Where it goes.** Settings is one list under headings, drawn by `SettingsPanel` in `src/ui/components/SettingsPanel.tsx` and shared by the title screen and the in-game Settings dialog (`SettingsDialog.tsx`, opened from the pause menu). Feature testing is a heading of its own, just above Cheats, with one `SettingRow` per feature: an icon, the name, a line on what it does, and the switch.

> **Ailments going around** · Testing
> Every six to eight weeks an ailment goes around town, a week's warning first, and opens its treatment early. For now only The Exchange, after its first star.

**What the switch is.** The Treatments rows already show the pattern (`isOn` in `SettingsPanel`): in a game, the switch is that game's own; on the title screen, it is the default for new games.

- **In a game:** the row flips `s.features.waves` through a sim method, `sim.setFeature('waves', on)`, so it is saved with the game, and a save keeps the setting it was played with. Loading an old save gives it the default.
- **On the title screen:** the row sets the default for new games, kept in local storage under a new key, `pressure-point-features`, beside the discipline prefs in `src/storage/settings.ts` (`loadFeaturePrefs`, `saveFeaturePref`). A new game copies it into `s.features` at boot (`src/app/boot.ts`). Today boot copies the sandbox's switches only for a sandbox game ("a campaign center decides everything itself"), so the feature copy goes outside that branch: a tester's switch has to reach campaign games, The Exchange first.
- **The list of features** is one table in `src/core/data/features.ts`: `FEATURES: Record<FeatureId, { name, desc, icon, default }>`, with `featureOn(s, id)` in `game.ts` returning `s.features[id] ?? FEATURES[id].default`. Every check in this doc that says "while waves are on" is `featureOn(s, 'waves')`: `updateWaves`, the wave term in `arrivalPace`, `sentFor`'s early-technique check, the objectives card and `waveAdvice`.

**Turning it off mid-game.**

- A wave in its warning week or running **ends quietly**: no more wave guests come, the card goes, and no PA line plays. Guests already inside stay and are treated as any guest.
- **What a wave opened stays open.** Moxibustion and its burner stay in the menus, since the player may have paid for the course and the kit already, and taking them away would cost them for a switch they flipped. An early technique keeps drawing guests only once someone can do it, as in step 5.
- `nextWave` is kept, so turning it back on resumes the schedule.

**Turning it on mid-game.** If the center is The Exchange with one star and its wave has not come yet, the wave is announced 7 days later, clock checks and all, so a tester does not wait 38 days. Anywhere else nothing happens until the conditions in step 1 are met.

**Getting a wave now.** A cheat console command, `wave`, in `src/core/sim/cheats.ts` beside `star` and `money`: it announces the wave at once, skipping the clock checks, and `wave end` ends it. Like every cheat it marks a campaign game as cheated (`s.cheated`), so it is for testing, not for play.

**Telling games apart in the play statistics.** `setting_changed` already records the flip (`track` in the `flip` helper in `SettingsPanel`). Every event also carries the game's properties from `gameProps` in `src/app/analytics.ts`; adding `features: ['waves']` there lets every chart split games with waves from games without, which is how the first slice is judged in real play as well as by the bot. A row in [analytics.md](../../dev/analytics.md).

**The bot** sets `s.features.waves` directly for each run, and the three-way rerun in step 9 is the switch, off and on.

**The default.** Off (recommended, decision 8): the build that carries it plays exactly as before for anyone who has not turned it on, Max and chosen testers turn it on, and the default flips to on, the row leaving Feature testing, once the first slice is judged.

## After the last star

The first slice leaves out the late game, where the gap bites hardest. Each of these is a rule of its own, for once the first wave has been played.

- **Visiting ailments.** After the last star, a wave brings an ailment marked `only` for another center: Sea Legs (needling) from The Boardwalk, Frozen Stiff (Swedish) from High Pines. Its technique is open already, so the decision is pure capacity. It touches `conditionHere` (the wave's own guests skip it), the casebook (`CasebookTab.tsx`, which lists conditions seen here), and the symptom props, which exist for every condition. About 2 days.
- **A new discipline once a year.** After the last star, once a year, a wave brings a discipline the center does not have: sound healing at The Exchange, through Noisy Mind. That is the one change that gives a finished center new rooms and new specialists. It is the big one: `disciplines` in `centers.ts` is a fixed list read by `disciplineHere`, so it becomes the list plus `s.disciplinesAdded`, read by the Settings switches, the Hire menu and applicants (`people.ts`), the room list (`roomHere`), the Treatments menu, the standing grade and the bot, and the guide explains it. About 6 to 8 days, and a balance run of its own.
- **The cadence for every center.** Waves every 42 to 56 days from the first star, the pick in step 2, five centers' worth of causes (one line each, the joke on the wellness industry; at The Exchange on the bosses, never the workers). About 3 days.
- **In the horoscope and the Rag.** If [Under the Stars](under-the-stars.md) is built, the wave's warning day is a timer like the others, so Madame Ostara names it under Health. If [The Local Rag](the-local-rag.md) is built, a wave is a headline: COLD FEET SWEEPS MERCER STREET; BONUSES STILL POSTPONED.
- **ZenMart Express,** if built, copies the discipline that healed most, which after a chased wave is often the wave's.

## The jokes

Each wave has a cause, one line in the dialog, aimed at the wellness industry, or at The Exchange at the bosses:

- Cold Feet, The Exchange: "The trading floor's bonuses were announced, then postponed, and half of Mercer Street has them."
- Text Neck: "A wellness podcast told everyone to put their phones down. They listened on their phones."
- Knotted Up: "The firm's new wellness app sends a reminder to relax every eleven minutes."
- Sea Legs, from The Boardwalk: "Management's team-building cruise came back. Management stayed on the boat."
- Noisy Mind, the sound healing wave: "A sound bath opened in the lobby of the Exchange Tower. It is next to the jackhammers."

The "Next time" bubble on a guest who turns around is the one visual gag the first slice needs.

## First slice

Exactly what the page promised, plus what the walkthrough found it needs to be fair.

- **One wave at The Exchange:** Cold Feet, opening Moxibustion and the Moxa Burner, announced 38 days after the first star and running 30 days from 45, moved for the four clocks in step 1, dropped if the second star comes first.
- **The warning:** the dialog (new `DialogId`, `SimEvent` and Modal case), the warning PA line as text, the objectives card with its three readiness lines, and `waveAdvice`.
- **The rule:** wave arrivals as a share of the pace beside `machineArrival`, and the door (`waveReady`, the "Next time" bubble, the `later` ending).
- **The plumbing:** `s.opened` in `unlocked`, `itemOpen`, `averagePrice`, the Treatments menu chip and `treatmentsUnlockedAt`; `sentFor` asking `waveReady` for early techniques.
- **The switch:** the Feature testing section in Settings, `features` on the game, the new-game default, the `wave` cheat command, and `features` in the play statistics' game properties.
- **State and save:** `wave`, `nextWave`, `features`, `opened`, `later`; the save version; `wave_ended`.
- **Tests:** unit tests for the clock and its clash check, the door, the item gate, the star dialog not announcing Moxibustion twice, and an old save loading; the play-events test.
- **The bot:** `chase`, and the three-way rerun at The Exchange.

About 6 to 8 days: the page's 5 to 7, and a day for the Feature testing switch. It ships with the picture-only mock commit (`8949d53a`, `src/ui/components/DripMocks.tsx`) dropped.

## Decisions for Max

Each has the answer this doc assumes.

1. **On top of the usual guests, or instead of some of them.** On top (recommended). Instead, a quarter of the usual arrivals would become wave guests, and passing would lose a quarter of a month's fees: chasing would always be right.
2. **The 25% surcharge.** Drop it from the first slice (recommended); the extra guests are the reward. Keeping it means deciding whether guests balk at it, and either answer is bad: counted, it wrecks `fairMonth` at any price level over 1; not counted, it is money for nothing.
3. **Where a guest who cannot be treated goes.** They turn around at the door with a "Next time" bubble, uncounted, at no cost (recommended). The other place is the Reception desk, which is more visible but takes the receptionist's time and an intake slot, a small cost for passing.
4. **Does the technique stay open after the wave?** Yes, for good, with its kit, but it draws ordinary guests only once someone can do it (recommended). Closing it again would break the dialog's promise and announce it twice.
5. **Which clocks a wave makes room for.** Emergencies, outbreaks, mishaps and the inspector, for the warning week and the first week of the wave, by moving the wave up to four times a week later (recommended). Not VIPs, house calls, staff challenges, ZenMart or rush hours.
6. **Applicants already trained in an early technique.** No (recommended): training is the cost of chasing, and a lucky hire would skip it.
7. **A lesson card for the first wave.** No (recommended): the dialog explains every time; a section in the guide.
8. **The Feature testing switch's default.** Off (recommended) until the first slice is judged, so nobody meets waves who has not turned them on; then on, and the row leaves Feature testing. The other way, on from the first build, puts it in front of every playtester at once, with the switch to turn it off.

## Risks

- **Chasing is always right.** This is the "accept every emergency" problem again. The guard is that the costs are real and on the floor: an empty table for the week of the course, a longer line for everyone, a Recovery Lounge. The rerun has to find seeds where passing was better, or a number moves.
- **A wave lands on a bad week.** The four-clock check keeps the decision week clear, and passing is free, so a wave can never be the thing that tips a squeezed center over.
- **The door is not seen.** A guest who turns around is small. The card's counter ("3 came back later") and the advisor carry it if playtesters miss them.
- **Two systems open techniques.** Stars and waves now both do. Everything that asks whether a technique is open must go through `unlocked`; the five places in step 4 that compare `star` directly are the known ones, and a test that opens a technique early and checks each screen guards the rest.
- **Tone.** The joke is on the industry that sells a cure for the ailment of the month, and at The Exchange on the bosses who caused it, never on the guests who caught it.
