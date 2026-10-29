# Courses of Treatment

Drafted 27 October 2026, after Max's notes on [the mechanics review](mechanics-review.md): "I like the courses of treatment mechanic."

An idea, not a plan: nothing here is decided. It is eighth in [the ranked list](README.md).

Some ailments come to need two sessions, one after the other. Stress Head gets Hot Stone De-steaming to let the steam out, then Cranio-sacral Lid Replacement to put the lid back on. A guest whose first session works pays for it, changes into a white robe and walks to the second line; the visit is healed, paid and reviewed once the second works. The Wellness Consultant prescribes the package only when someone on the payroll can deliver the second step, and a switch in the Policy menu stops prescribing them, so selling packages is the player's choice: more money per hour of table time and a heal in a second discipline, against a second line, a second roll and one heal for two sessions. The verb is flow: which rooms sit next to which, who is trained in the second step, and when a package is worth its table time. All of it rests on one new rule: a guest whose first step works goes on to the second step's line instead of home.

On screen it is a **package**, the spa trade's own word for the upsell, because a course is already what staff are sent on in a Training Room (`Staff.course`, `inspector/Courses.tsx`). The idea keeps its name here.

## The gap it fills

- **The disciplines never meet.** Each of the 62 ailments in `core/data/conditions.ts` names one `modality`, and `modalityOf` in `core/sim/treatments.ts` hands the whole visit that one technique. The five disciplines run as parallel lines that share a Reception, a Consultant and a waiting area, and nothing else. Layout is about the door, noise, warmth and the Staff Room, never about the walk from one treatment room to another. Two Point builds much of its flow on that walk; here a guest makes it at most once, and only when the player sells it.
- **The third star's techniques earn nothing** (gap 1 in the [README](README.md)). Distance Reiki, Chakra Balancing, Overtone Chanting, the Ayahuasca Ceremony and the Vision Quest (`star: 3` in `core/data/treatments.ts`) treat seven ailments between them. Even opened at the second star, as [Grand Occasions](grand-occasions.md) proposes, they wait for rare guests. As the second step of common ailments they get lines of their own.
- **The third star is more of the same** (gap 1). Every package in the first slice opens at the second star, so the stretch to the third has something new to build for.
- **The Recovery Lounge already proves the shape.** Eight techniques have `rest: true` (Deep Tissue, Cranio-sacral, Moxibustion, Electroacupuncture, Chakra Balancing, the Gong Bath, and the Mushroom and Ayahuasca Ceremonies), and send a guest to lie on a Lounger for `REST_SECONDS` (15) before they go (`core/sim/recovery.ts`). A guest already carries on from a treatment to a second place. A package makes the second place a line.

## How it plays

**The moment.** Willow Lane, month 5, the second star just in. Ingrid is back from her Cranio-sacral course. The next guest with Stress Head comes out of the Consultation Room with a package: Hot Stone De-steaming, then Cranio-sacral Lid Replacement. The Hot Stone works. The steam over their head drops to a wisp, they pay, change into a white robe and slippers, and pad down the corridor to Ingrid's line. Two days later her line has four robes in it and one of them is turning poor, and the player sees why: the Hot Stone suite is by the front door, Ingrid's suite is at the back, and the Recovery Lounge is in between, on the far side of the waiting area. The player moves the poorly robe up her line, and next month builds a second Massage Suite beside the Hot Stone one, with Ingrid assigned to it.

**The verb.** Flow, in three places the player already works:

- **Layout.** The first step's room, the second's and the Recovery Lounge close together, so a robe walks a few tiles, not the building. Moxibustion, Electroacupuncture and Cranio-sacral all need a rest, so in two of the three first packages the Lounger sits between the steps.
- **Staff.** Someone trained in the second step who is not already the bottleneck. A therapist trained in both can do both, but then their line holds the same guest twice.
- **Policy.** **Recommend packages**, on by default, beside Emergencies first. Off, the Consultant prescribes one session, which heals as it does today. The right answer turns on what the objectives ask and how long the second line is: on for money and a second discipline's heals, off for a heal count, a cure rate or a rush.

The line controls work as they do today: move a robe up the second line, or over to another table that does the step. Priority on the second step's room puts staff there first.

**On the floor.**

- A guest halfway through wears a white robe and slippers, their own clothes recolored as a visitor's are, with their symptom shrunk to half rather than away.
- The second step's line has robes among street clothes, which reads at the default zoom as how many are halfway.
- The guest's inspector: "Package: Hot Stone De-steaming ✓, then Cranio-sacral Lid Replacement, 3rd in line." A station's line marks each robe "2 of 2".
- The Treatments menu lists each package under its ailment, with the star and training that turn it on. The casebook names both steps.

## The jokes

**PA lines,** three to record, all policy:

- "Robes are issued between sessions and may be purchased at the gift shop." (13 words)
- "Staff will not discuss whether the second session is strictly necessary." (11)
- "The second session is included in the package, which is not included." (12)

**The second steps' names** carry most of the joke: Cranio-sacral Lid Replacement, Sports Commitment Training, Usui Trickle Charge, and in phase 2, Chakra Collection, Overtone Background Music, Vision Quest Retrieval and Distance Reiki Pickup.

**Reviews:**

- Stress Head: "Came in with steam coming out of my ears and left with a lid on."
- Cold Feet: "They warmed my feet, then had me practice walking down an aisle."
- Flat Battery: "Jump-started in one room and fully charged in another."
- Walked out between steps: "Paid for the first half. Was told the second half was the important one."
- Packages switched off: "One session, and it worked. The Consultant seemed disappointed."

**The Local Rag's headline bank,** if [The Local Rag](the-local-rag.md) is built: {LOCAL} FINISHES TWO-PART PACKAGE, IS OFFERED A THIRD.

## Rules and numbers

Every number is a first guess, to be set against the bot.

**The one rule: a package is two sessions in a row.** A guest prescribed one goes from a first step that works to the second step's line instead of home. The rest are its terms:

- **Prescribed** at the consultation, when the policy recommends packages and someone on the payroll, not leaving, is trained in the second step. Otherwise one session, as today. The Consultant sells only what the center can deliver.
- **The first step** is the ailment's treatment today, priced, rolled and put off by price as today. If it fails, the visit ends failed, as today, and the second never comes. If it works, the guest pays its fee, changes into the robe, has their condition refilled to full, takes a Lounger first if the step needs a rest, and then joins the second step's line. They get the usual 30 patience for being seen, and the center gets no reputation yet.
- **Between steps** they wait as any guest waits: patience drains, the condition worsens again from full, and the two warnings for a guest turning poor apply. A guest who storms out or runs out of condition between steps ends stormed or worse off, at the usual cost, and the first fee stays paid.
- **The second step** is never put off by price, since the guest is already in a robe. Its diagnosis is certain, and it has **+0.15** on its chance for the half the first step did, under the usual cap of 0.98. With a typical first step at about 0.8, a package heals about 0.76 of the time, against 0.8 for one session: a little worse for the guest, which is the satire, and the cost the switch weighs.
- **The second fee** is 1.2 times its technique's going rate, the average fee of the ailments it treats. A package earns a little more per second of table time than a single session and a little less per heal. It is paid only if the step works, as every fee is.
- **The heal** counts once toward every heal total, the cure rate and the casebook, and toward the healed-with goals of both steps' disciplines.
- **Nobody left to do the second step,** because the only one trained has quit or been let go: a guest halfway goes home healed on the first step alone. The Consultant has decided the first session was enough. Someone away on a course or a house call is waited for.
- **Emergencies** never send an ailment that would come as a package, so an emergency is never seven packages at once.
- **No machines** in the first slice, as either step.

**The first packages,** each opening at the second star wherever both its techniques are taught:

| Ailment      | First step, as today          | Then                          | Second fee | First met                               |
| ------------ | ----------------------------- | ----------------------------- | ---------- | --------------------------------------- |
| Stress Head  | Hot Stone De-steaming, $1,600 | Cranio-sacral Lid Replacement | $2,400     | Willow Lane: massage, then massage      |
| Cold Feet    | Moxa Toe Warming, $1,600      | Sports Commitment Training    | $1,700     | The Exchange: acupuncture, then massage |
| Flat Battery | Electro Jump Start, $1,900    | Usui Trickle Charge           | $1,700     | The Boardwalk: acupuncture, then reiki  |

The second fees: Cranio-sacral's ailments average $2,000, Sports' $1,400 and Usui's $1,400, each times 1.2 and rounded. Stress Head is weighted 2 at The Exchange and 1.5 at High Pines, and Cold Feet 2.5 at High Pines (`conditions` in `core/data/centers.ts`), so those centers see the most packages.

**Phase 2: the third star's techniques at work,** once Grand Occasions' phase 1 has opened them at the second star:

| Ailment            | First step                     | Then                                                                                  | Second fee |
| ------------------ | ------------------------------ | ------------------------------------------------------------------------------------- | ---------- |
| Blocked Qi         | Needling Unblocking, $1,000    | Chakra Collection: the needles push the blockage along, and it stops at a chakra      | $2,950     |
| Noisy Mind         | Sound Bath Quieting, $2,150    | Overtone Background Music: the mind is quiet now, which is unsettling                 | $3,000     |
| Lost Spirit Animal | Spirit Animal Matching, $1,600 | Vision Quest Retrieval: the reading finds where it went, and the quest goes to get it | $3,250     |
| Midlife Fog        | Mushroom Clearing, $2,800      | Distance Reiki Pickup: fetched back from wherever the mushrooms took them             | $2,750     |

Blocked Qi is a first-star ailment, common wherever acupuncture is taught, so Chakra Balancing gets a steady line from it. Noisy Mind gives Overtone Chanting one at High Pines and The Orchard Estate, and the Vision Quest and Distance Reiki get theirs at The Orchard Estate. **The Ayahuasca Ceremony stays a session of one.** At 20 seconds it is the longest session in the game and already ends on a Lounger; a second line after it would hold a guest for most of a week. Its job comes from opening at the second star, and Ego Overgrowth is its own.

## Fair play

**Warned.** A package never arrives unannounced. The second star's dialog names the packages it brings and the training each needs, and the Treatments menu lists them. The first package prescribed brings a tip naming the guest, both steps and the switch: "Recommend packages, in the Policy menu, turns them off." A guest halfway is in a robe, and between steps the same two warnings cover them as cover any waiting guest.

**Counterplay.** The switch. Training, since nobody trained in the second step means no packages. Rooms placed together, the Recovery Lounge between them, line order, Priority, and a second room for the second step.

**Not easier.** The bot gets `BOT_PACKAGES`, read from the environment as `BOT_STYLE` is (`botStyle` in `tests/balance/bot.ts`), with three values: `off`, which never prescribes one and is the game today; `on`, which leaves the switch on; and `choose`, which turns it off while the bot chases a heal count or a cure rate or while a second step's line holds more than 4, and on otherwise. The bot also learns to train a second step once it teaches the first. Six seeds at every center. The target: with `on`, the good bot's month for each star within half a month of `off`, either way, at every center; its median monthly profit before the third star no more than 10% above `off`; and no more guests going home worse off. `choose` should beat both fixed settings somewhere, and neither fixed setting should win everywhere. If `on` wins everywhere, the second fee comes down; if `off` does, the fee or the bonus goes up.

**Incentives point the right way.** Nothing pays the player for leaving a robe in line: a storm-out or a guest gone worse off costs what it always does. Finishing a package well is rewarded with the second fee and a heal in two disciplines. Nothing is free: the second fee is paid for in table time and a second roll. No karma.

## Where it plugs in

Each checked in the code:

- `core/data/types.ts`: `ConditionDef` gains `then?: { modality: Modality; treatment: string; fee: number }`.
- `core/data/conditions.ts`: `then` on Stress Head (`steam`), Cold Feet (`coldfeet`) and Flat Battery (`battery`).
- `core/state/types.ts`: `Guest` gains `step?: number`, 1 once the first step has worked, and `packaged?: boolean`. `Policy` gains `packages`.
- `core/sim/treatments.ts`: `modalityOf(g)` reads the step. Beside its 13 callers, about 13 places in `core/sim` read `conditionOf(g.condition)` directly, among them `successChance`, `completeService` and `guestFee` in `stations.ts` and `lineOf` in `worsening.ts`. Each that means "the technique this guest is waiting for" goes through `modalityOf`, and a unit test walks a package through both steps to catch any that were missed.
- `core/sim/stations.ts`: the consult branch of `completeService` sets `packaged`. Its heal branch, on a first step, earns the first fee, sets the step, refills `health` and leaves `outcome` empty, so `worsening` in `core/sim/worsening.ts`, true while there is no outcome, carries on unchanged. `goForTreatment` skips its put-off roll on a second step, `successChance` adds the bonus, and `guestFee` bills the second fee. `leftForSpecialist` already has a table pass over a guest waiting for a trained colleague.
- `core/sim/recovery.ts` and the `toRest` and `resting` case in `core/sim/guests.ts`: after the Lounger, `decide` already runs, and with the goal still `'treat'` it sends the guest to the second line through `pickStation`.
- `core/sim/records.ts`: `countVisit` once, at the end, adding to `healedBy` for both disciplines.
- `core/sim/emergencies.ts`: `offerEmergency`'s pool skips an ailment while it would be a package.
- `core/sim/policy.ts` (`PolicyChange`, `changedPolicy`) and `ui/components/menus/PolicyMenu.tsx`, beside the Emergencies first toggle.
- `core/data/feelings.ts`: two feelings for reviews, walked out halfway and finished a package.
- `render/models/character.ts`: the robe, as clothes, the way `VISITOR_CLOTHES` dresses a visitor; and the symptom at half size.
- `ui/components/inspector/GuestInfo.tsx` and `StationInfo.tsx` for the step; `ui/components/menus/TreatmentsMenu.tsx` and `CasebookTab.tsx` for the packages.
- **State and saves:** the guest's step and flag, and the policy. The save version goes up from 40 to the next free number, and `upgradeSave` gives the policy `packages: true` and every guest already in the building none.
- Recordings: the three PA lines, into [announcements.md](../../dev/announcements.md).

## Phases

1. **The rule and three packages (M).** Stress Head, Cold Feet and Flat Battery; the robe; the switch; the inspector lines and menus; `BOT_PACKAGES` and the rerun at every center. Ships alone. It proves itself if the rerun meets the target and a playtester moves a room, a member of staff or a robe for a package without being asked.
2. **The third star's packages (S),** once Grand Occasions' phase 1 has opened those techniques at the second star: Blocked Qi, Noisy Mind, Lost Spirit Animal and Midlife Fog. Data and a rerun.

**Later, if it lands:**

- **Packages first,** a policy beside Emergencies first, if players are seen moving robes up by hand.
- **A third step,** for one ailment, as a test.
- **A machine as a step,** such as the Kneadmaster 9000 to finish a massage package.
- **A center built on them.** St. Agatha's Rest Cure Sanatorium, the old wing [plans/campaign.md](../../plans/campaign.md) plans, where every guest is on a regimen of two or three steps. The rest cure was a course of treatment long before the wellness trade sold it as a package.
- **A halfway column** in the casebook, counting visits that ended between steps.

## Decisions to make

Each has the default this doc assumes.

1. **Where it starts.** Everywhere from the second star, wherever both steps are taught (default). The other ways are The Orchard Estate's twist, where every discipline is open, which piles a new rule on the hardest opening in the game (the good bot loses 27 to 29 of 72 Orchard games, [balance log](../../balance/log.md) entry 44) and reaches players a year in; or the twist of the next new center, St. Agatha's above, the best fit and the furthest off. Starting everywhere puts the first package at Willow Lane, in the stretch to the third star that most needs something new.
2. **The word on screen.** Package (default), since course is taken by the Training Room.
3. **Who turns packages on.** The switch and the training together (default). Without the switch, training a technique for its own ailments would force packages on a player who wants heals.
4. **The second fee.** 1.2 times the technique's going rate (default), or the same, which makes a package a plain loss in heals.
5. **The second step's bonus.** +0.15 (default), or none, which makes a package fail about a third more often than one session.
6. **Credit to both disciplines.** Yes (default). Without it, a package that ends in reiki does nothing for the reiki goals.
7. **The Ayahuasca Ceremony.** A session of one (default).

## Risks

- **Longer stays fill the building.** A package guest takes two sessions and two waits, and counts against the guests-at-once limit all the while. The limit and the arrival pace do not change, so the second line competes with new guests. That is the pressure; the bot's count of guests gone home worse off is the check.
- **Cure rate.** A package rolls twice. With the bonus it heals about 0.76 against 0.8, and High Pines' third star and The Orchard's second both ask for 80%. The switch is the answer, and the objective's detail should say how many packages it judged.
- **A switch nobody touches.** The Prices tab was opened by 2 of 8 players (balance log entry 46). If the switch goes the same way, the advisor names it when a second step's line is the longest in the building.
- **Reiki made easy.** Credit to both disciplines gives the reiki goals that held The Boardwalk and High Pines up a second source of heals. If the rerun shows those stars much earlier, a package credits its first step's discipline only.
- **A missed read.** About 13 places read a guest's prescription straight from the ailment. One missed prices or rolls the wrong step. One helper, and the test that walks a package through, are the guard.
- **The robe at the default zoom.** It must read as a robe, not a pale shirt. Check it in the model lab before anything else is drawn.
- **Tone.** The joke is the package, aimed at the trade. The guest is never the fool, and no package claims to treat a real illness.
