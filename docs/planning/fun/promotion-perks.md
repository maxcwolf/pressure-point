# Promotion Perks

Drafted 2 November 2026 with Max, from the review of what to build next ([planning/ideas.md](../ideas.md), under Staff). Max settled the frame the same day: which promotions bring a choice, what applicants bring, and what Promote all does. He then changed what applicants bring: a perk from a hire is rare, and a Senior or Expert hire earns their choices by settling in. The perks and every number are first guesses.

Built on 7 November 2026 and merged that day. Name on the Door's regulars ask for them by name: one they heal remembers them and will wait behind 3 more guests (`ASKED_FOR_PULL`) to be seen by them again, until someone else heals them. On the same day Max asked for every upside a little stronger and every cost a little lower, so the numbers in the game are about a fifth better and a third cheaper than those below (`src/core/data/perks.ts` has them). Max then asked that every pair make a specialist, as the Receptionist's does (desk or Shop Counter): the Consultant's became Diagnostician and Triage, the Acupuncturist's Needle Artist and Fire and Glass, the Shaman's Trip Sitter and Earth Keeper, the Massage Therapist's and Sound Healer's each favor their own techniques, and a Firm Hand sends one in three of their other massages to rest rather than every one. The tables below are the first draft. The bot has not been rerun with perks, so the numbers are still guesses.

At the promotions to Senior and to Expert, the player picks one of two perks for the person promoted. Each perk is a trade-off, and which one is right depends on something the player can see in their own center. An applicant above Experienced almost never brings a perk. A Senior or Expert hire earns the choices their rank owes them by settling in: once they have earned as much experience in the center as the promotion would have taken, the same choice card comes. So someone raised in the center has their perks the day they are promoted, and a hire has them only after a while. The verb is shaping a person, and the reason to keep someone is what they have become, not a penalty on letting them go.

## The gap it fills

- **The people are interchangeable** (gap 4 in the [README](README.md)). The good bot swapped staff 404 times in 30 games ([balance log](../../balance/log.md), entry 47), mostly a rank 4 for a 5 (151) or a 3 for a 4 (140).
- **Courses already stop the churn, for practitioners only.** On 92% of the days the bot had a better applicant for a role, the weakest practitioner knew a technique the applicant did not, so it kept them (entry 47). Consultants have three courses and Receptionists one more, so they are the ones swapped. Perks are an investment for every role, the way courses are for practitioners.
- **A promotion is a click.** `promote` (`src/core/sim/careers.ts`) adds a rank, a qualification slot, fair pay and +10 morale (`PROMOTION_CHEER`). Nothing is decided. A rank is worth exactly what an applicant's rank is worth: +9% on the chance a treatment works (`SKILL_SUCCESS`), more mats or Practice Spots, a surer diagnosis.

## How it plays

**The choice.** Priya, a Consultant, is ready to be Senior. The promotion card is as it is today. Promoted, a second card waits beside the raise and promotion cards: "Priya is now Senior. How does she work?" It has two buttons, each with its perk's chip, what it does and what it costs:

- **Thorough:** "Each consultation is surer. Each takes longer."
- **Quick Read:** "Consultations go faster. Each is less sure."

The player looks at the Consultation Room's line, which is long, and at the diagnosis setting in Policy, which is at 75%. Quick Read. Six months later a Senior Consultant, Dana, applies. Her card says she has no perk yet and will choose once she has settled in. Hired, she works as a Senior with nothing to tilt her either way. Once she has seen enough guests, a card comes: "Dana has settled in. How does she work?" Until then Priya, raised here, is the one who fits the center.

**Promote all** promotes everyone ready, as today, and leaves a choice card for each. A choice can wait: nothing is lost while it does. After 30 days they choose for themselves, by their quirks (below), and a toast says what they picked.

**On the applicant's card,** a Senior or Expert applicant says what they are owed and when: "Will choose a Senior perk once settled in (35 experience)." Their inspector shows the same with a bar, as it shows the way to the next rank. Now and then one arrives with a perk already, from their last job, shown gold under their quirks like a rare quirk: "Quick Read (her last place's idea)".

**In the inspector,** the perks sit under the quirks with their chips, and the Staff menu's row shows them beside the quirk chips. The Let Go dialog says what goes with them: "Priya's Quick Read was chosen here."

## The perks

Each Senior pair is about how they work, and is different for each role. The Expert pair is about what they leave behind, and is the same for everyone who sees guests. Every number is a first guess, to be set against the bot.

### At Senior

| Role                | One way                                                                                                                                                | The other way                                                                                                              | What decides it                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Receptionist        | **Charmer:** guests they check in lose patience 15% more slowly in the lobby. Check-in is 10% slower.                                                  | **Upseller:** at the Shop Counter, guests buy 30% more often. Guests they check in lose patience 5% faster.                | A long lobby wait, or a Shop Counter to fill                 |
| Wellness Consultant | **Thorough:** each consultation adds 0.1 more certainty (`CONSULT_GAIN`). Consultations take 30% longer.                                               | **Quick Read:** consultations are 25% faster. Each adds 0.08 less certainty.                                               | The Consultation Room's line, and Policy's diagnosis setting |
| Massage Therapist   | **Firm Hand:** +5% on every massage technique. Every massage they give needs a rest after, not only the three marked `rest`.                           | **Light Touch:** none of theirs need a rest. −5% on Deep Tissue, Sports and Cranio-sacral.                                 | Recliners free in the Recovery Lounge                        |
| Acupuncturist       | **Gentle Needles:** guests in their line lose patience 20% more slowly. Treatments take 10% longer.                                                    | **Rapid Points:** treatments are 15% faster. −4% on every technique.                                                       | Whether the clinic's line is long or impatient               |
| Reiki Practitioner  | **Clears as They Go:** between guests, they clear bad vibes in their own room at half a Smudger's pace. Treatments take 10% longer.                    | **Unbothered:** bad vibes take half as much off their chance. Their own failures leave twice the vibes (`VIBES_PER_FAIL`). | Who else clears vibes, and how often treatments fail there   |
| Sound Healer        | **Big Gong:** one more mat (4 at Senior, 5 at Expert, `SOUND_MATS`). Their sessions make 2 more noise, and carry.                                      | **Hushed:** no noise leaves their studio. −5% on Gong Bath and Overtone Chanting.                                          | What is next door to the Sound Bath Studio                   |
| Qi Gong Instructor  | **Crowd-Pleaser:** 2 more Practice Spots (`CLASS_PLACES`). Class-goers become regulars half as often.                                                  | **Devotee-Maker:** class-goers become regulars twice as often. One Practice Spot fewer.                                    | Room for more mats, or room for more regulars                |
| Shaman              | **Steady Guide:** a failed ceremony turns into a really bad trip half as often, and they talk a runner down twice as fast. Ceremonies take 20% longer. | **Deep Diver:** +6% on every ceremony. Really bad trips twice as likely.                                                   | How well set and setting are kept in the lodge               |
| Caretaker           | **Fixer:** repairs 30% faster, and goes to them first. Litter and cleaning 20% slower.                                                                 | **Neat Freak:** litter, cleaning and linens 30% faster. Repairs 20% slower.                                                | Machines and wear, or a dirty, busy building                 |

### At Expert

For everyone who sees guests:

- **Mentor:** colleagues of a lower rank posted within 5 tiles (a Ray of Sunshine's reach, `CHEER_RANGE`) earn experience 50% faster. Two Mentors in reach do not add up. The Mentor works 10% slower, teaching as they go.
- **Name on the Door:** regulars they have healed ask for them. In their line, a regular loses patience half as fast again (on top of `REGULAR_PATIENCE`) and tips 10% more. In return their morale settles 5 lower, and each raise they ask for is 20% rather than 10% (`RAISE_STEP`).

For Caretakers, who see no guests:

- **Mentor,** as above, for Caretakers of a lower rank.
- **Knows Every Pipe:** equipment they repair wears 25% more slowly afterward, until its next repair. They will not do litter again: Litter is struck off their duties for good.

Mentor is the one perk that pays back the time it takes to raise someone, which is the point of the whole idea: a center with a Mentor raises its own faster than it can hire.

### Picking for themselves

When the 30 days run out, each perk has a list of quirks that suit it, and they take the side with more: Brisk, Power Walker and Chatterbox suit the faster side, Tireless, and the Bedside Manner course, the patient side, Ray of Sunshine suits Charmer and Mentor, Grump suits Unbothered, Former Influencer suits Name on the Door. With a tie, it is settled by their id, so no random number is drawn.

### Applicants and settling in

**Settling in.** A hire above Experienced is owed the choices of the promotions they did not have here: a Senior is owed the Senior choice, and an Expert the Senior choice and then the Expert one. Each comes once they have earned, in the center, the experience that promotion takes (`RANK_XP`):

| Hired as | Senior choice                          | Expert choice                               |
| -------- | -------------------------------------- | ------------------------------------------- |
| Senior   | 35 experience after hiring (80 to 115) | at their promotion to Expert, as for anyone |
| Expert   | 35 experience after hiring             | 45 more after that, 80 in all               |

A hire starts at the experience their rank needs (`xp: RANK_XP[skill - 1]` in `src/core/state/game.ts`), and an Expert goes on earning it, so the count is the experience they have earned since they were hired. Settling in is not held up by an empty qualification slot, as a promotion is, since nothing about it is a rank. Once a choice is due it is the same card as a promotion's, and after 30 days they pick for themselves.

**A rare perk.** About one Senior or Expert applicant in ten brings a single perk from their last job, about as rare as a rare quirk (one in seven). An Expert who brings one is still owed the other choice. It is settled by a hash of the applicant's id, after every other roll, so the random numbers everyone else draws stay where they are, as Amanda Jablonsky's quirks do (`makeCandidate` in `src/core/people.ts`). A perk does not change anyone's pay.

**Why settling in rather than none.** With no perks at all, an Expert hire would be an Expert for good with nothing the player chose, and hiring one would be a dead end. Settling in keeps a hire worth having and puts the cost of churn where it belongs: whoever takes the place of someone raised here starts with nothing chosen, and has to earn it.

## The jokes

Three lines a feature. PA lines are instructions and carry no names.

**The choice:**

- Card: "Priya is now Senior. How does she work?"
- Mentor, in the inspector: "Has a mug that says MENTOR. Bought it herself."
- Settling in: "Dana has settled in. She has stopped calling it 'your center'."

**On the floor:**

- PA, for Name on the Door: "Guests are reminded that all of our therapists are available, and fine."
- PA, for Big Gong: "The Acupuncture Clinic would like the Sound Bath Studio to know that they can hear it."
- Toast, when they pick for themselves: "Mo got tired of waiting and chose Firm Hand. He says it was always going to be Firm Hand."

**Letting go:**

- Let Go dialog: "Priya's Quick Read was chosen here. The next one will have their own ideas."

## Fair play

**Warned ahead.** Every perk says what it does and what it costs before the player picks it, in numbers, on the card. Nothing about a perk is hidden.

**Counterplay.** The choice is the counterplay: each pair is built so that a state the player can read (a line, a Recovery Lounge, a neighbor's noise) says which side is better. A wrong pick is never ruinous, since each side costs at most about what it gives.

**Not easier.** Each perk is a trade-off, but a pick made for the center will usually come out ahead, so perks will make the game a little easier. The bot rerun, with `swap` on, must show the good bot's star months, its money and its quits within the noise of today's. If perks make it easier, `SKILL_SUCCESS` or the morale base comes down by the difference, so a raised team earns back what a churned one gives up.

**Incentives point the right way.** Nothing punishes letting someone go. A raised member of staff is worth more because of what they have; a new hire costs no more than today, works as well as today's from the first day, and earns their perks in time.

**A choice left waiting costs nothing.** Promote all never forces a decision, and a card waiting a month resolves itself.

## Where it plugs in

Checked in the code on 2 November 2026:

- `src/core/data/perks.ts`, new: the perks, in the shape of `TraitDef` (`src/core/data/types.ts`), so `speed`, `stamina` and `walk` reuse what `traitProduct` and `traitSpeed` (`src/core/data/staff.ts`) already read. Most perks are a multiplier on a number the sim already has: service speed, `CONSULT_GAIN`, `SOUND_MATS`, `CLASS_PLACES`, `VIBES_PER_FAIL`, `RAISE_STEP`, patience drain, shop chance (`SHOP_CHANCE`), Caretaker job speed.
- `src/core/sim/careers.ts`: `promote` adds the choice it is owed at ranks 4 and 5; `promoteAll` leaves the choices waiting; `gainXp` brings a hire's owed choice once they have settled in.
- `src/core/sim/events.ts`: `StaffRequest` gains `'perk'`, beside `'raise'` and `'promotion'`, for the card.
- `src/core/sim/stations.ts`: `chanceFactors` gains a `perk` term, so the reason a treatment worked or failed can name it.
- `src/core/sim/ceremonies.ts` and `src/core/sim/runaways.ts`: Steady Guide and Deep Diver on the really bad trip.
- `src/core/sim/vibes.ts`: Clears as They Go.
- `src/core/sim/regulars.ts` and `src/core/sim/classes.ts`: Devotee-Maker, Crowd-Pleaser and Name on the Door.
- `src/core/people.ts`: `makeCandidate` gives the rare Senior or Expert applicant a perk.
- `src/core/sim/staffing.ts`: hiring sets what a Senior or Expert is owed, and from what experience.
- `src/ui/components/inspector/StaffInfo.tsx`, the Staff menu's rows, the applicant card and `ConfirmFire.tsx`: the perks shown, and the choice card.
- `tests/balance/bot.ts`: the bot picks by the same rule as staff who pick for themselves, until it has a better one.

**New state:** on `Staff`, `perks: PerkId[]`, `perkDue: ('senior' | 'expert')[]` for choices waiting on a card, and `settling: { perk: 'senior' | 'expert'; at: number }[]` for a hire's choices still to be earned, each with the experience it comes at. The save version goes up from 48 (`SAVE_VERSION` in `src/core/state/game.ts`), and `upgradeSave` gives every Senior and Expert already working the choices they are owed, at once, so the feature turns up as cards in a game under way. Nobody can tell who was raised and who was hired in an old save, so all of them count as settled in. No sandbox switch.

## Phases

**First slice (M), ships alone.** The frame and every perk that is a multiplier on a number the sim already has: the choice card, Promote all, picking for themselves, applicants, the inspector and Staff menu, the save upgrade, and the bot rerun. That is all of them but three.

**Second slice (S to M).** The three that need new behavior: Clears as They Go (a Reiki Practitioner who smudges between guests), Knows Every Pipe (wear that remembers who repaired it) and Name on the Door's regulars asking for someone.

**Later, if it lands:**

- **A pin on the uniform** for each perk, readable at the default zoom, so a raised team can be told apart on the floor.
- **Old Hands** ([README](README.md), Modes): staff raised to Expert carry between centers with their perks.
- **A retraining course** to change a perk, dear and slow. Left out at first, since a choice that can be undone cheaply is not a choice.

## Decisions to make

Each has the default this doc assumes.

1. **Which promotions bring a choice.** Senior and Expert. _Settled by Max, 2 November 2026._
2. **What applicants bring.** Almost never a perk: about one Senior or Expert applicant in ten brings one. A hire above Experienced earns the choices their rank owes them by settling in, after the experience each promotion takes. _Settled by Max, 2 November 2026,_ in place of random perks for every applicant, his first answer that day. Settling in stays at 35 experience a choice (Max, the same day), though a Senior hire's Senior choice then comes at 115, shortly before their promotion to Expert at 125; half a rank's span, which would space the two cards apart, was turned down.
3. **What Promote all does.** Promotes now, and the choice waits on a card. _Settled by Max, 2 November 2026._
4. **How long a choice can wait.** 30 days, then they pick for themselves (default). The other way is that it waits for good, which leaves cards piling up for a player who never opens them.
5. **Whether a perk changes pay.** No (default). A perk is a trade-off, not a quirk worth paying for, and a raise for it would make picking feel like a bill.
6. **Whether perks are shared or per role at Senior.** Per role (default), which means nine pairs to write and tune. The other way is three shared pairs for everyone: less writing, less character.

## Risks

- **The bot picks badly, so the rerun undersells it.** A rule that reads the line or the Recovery Lounge before picking is worth writing before the numbers are trusted.
- **Rank still wins.** +9% a rank is a lot. If the bot still swaps a Senior with a perk for an Expert without a fitting one, the perks are too weak to matter; Mentor, which shortens the climb, is the one to watch.
- **Settling in feels like a wait with no reason.** The applicant's card and the inspector's bar have to say what is owed and how far off it is, or a hired Expert's first card will look like a bug.
- **The settling-in numbers.** 35 experience is the same span a raised Consultant takes to go from Experienced to Senior. If it comes so soon that a hire is as good as a raised colleague within weeks, the head start means little; the bot's swap log will say how long hires take to settle.
- **Too many cards.** Two choices a career for 20 staff is 40 cards over a center's life, spread over years. Promote all and the 30 days keep it from piling up, but watch a late center's card rail.
- **Perks nobody reads.** If the chips are as easy to skip as the quirks were before 0.35.0, the choice is just a click. The card has to put the trade-off in numbers, and the reason a treatment failed has to name a perk when one played a part.
