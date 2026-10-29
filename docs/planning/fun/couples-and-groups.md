# Couples and Groups

Drafted 27 October 2026, after Max's notes on [the mechanics review](mechanics-review.md): "I like the couples and groups mechanic."

An idea, not a plan: nothing here is decided. It is seventh in [the ranked list](README.md).

From the first star, couples start booking in. They come in together, side by side, and they are seen together or not at all: two tables in one room, two Massage Therapists free at the same moment. The room for them is the **Couples Suite**, a Massage Suite with two tables, which draws couples of its own the way a signature machine draws its two ailments. Singles use its tables too, until a couple reaches the front of the line. Then one table waits for the other, with a RESERVED card on it, and the couple goes in together. The couple shares one patience, the average of the two, and writes one review. It is the spa trade's own staple, the couples' package, and it adds the one thing the game has never asked for: two members of staff free at once. The verb is timing: where the couple stands in the line, who is posted to the suite, and who is on a break when. Parties, the bachelorette party among them, come later as the same rule at a larger size.

## The gap it fills

- **Nothing asks two staff to be free at once.** Every treatment room holds the one table it came with. `massage_table` and the other tables are a room's `required` furniture, free with it, and none of them is in `ITEM_MENU` (`src/core/data/items.ts`), so no room can take a second. Scheduling is always one line, one table and one member of staff at a time, and the break policy (`breakLimit` in `src/core/sim/policy.ts`) rarely matters.
- **Groups are treated only on mats and in classes.** The Sound Bath Studio already holds a session until its mats fill (`sessionWait` in `src/core/sim/sessions.ts`, up to `SESSION_WAIT`, 8 seconds), and Qi Gong classes start together. Massage, the discipline every center has, never treats two people as one booking.
- **Growing is free** (the mechanics review's "Where the game is free"). Every pressure has the answer "one more of the same room". A Couples Suite is a second shape to grow in, with a cost of its own: a table that sometimes waits.
- **The people are interchangeable** (gap 4 in the [README](README.md)). A couple is two names who arrive, wait and leave as one, and a held table is a small story the player can see.
- **Paused time** (gap 11). Whether to move a couple up the line before a rush, or down it to keep both tables busy, is a decision made on a paused screen.

## How it plays

**The moment.** At The Exchange, a couple comes in from the plaza holding hands, and cannot let go. They check in together, see the Consultant together, and walk to the Couples Suite. A single is on one table, nearly done. The other table is free, and its therapist is at her post, but the couple is at the front of the line, so a small folded card goes up on the free table: RESERVED. The single climbs down, both tables are free, and the couple lies down side by side. When the treatment works, their hands spring apart.

**The verb: timing.** The player's levers are all ones the game has:

- **The line.** A couple is one entry in a table's line, with both names. Moving them up or down moves both. Moved down in a rush, the suite keeps both tables busy with singles; moved up, the couple goes in at the next moment both tables come free.
- **Who is posted.** **Assign to rooms** keeps two therapists to the suite. A third assigned there covers a break.
- **Breaks.** A therapist going on a break while a couple waits holds them up. The break limit for therapists in the Policy menu keeps one of the two at work.
- **Training.** One of the two couples' ailments needs Deep Tissue, so the suite wants two therapists trained in it, not one.
- **Building it at all.** Couples come only for a Couples Suite. A center without one never sees them.

**The things on the floor.** Couples walking in side by side and sitting on the same bench. The RESERVED card on a held table. Two therapists working in step in one room. The Clasped couple's joined hands, which come apart with a pop when the treatment works.

## The jokes

**PA lines,** three to record, all instructions:

- "The Couples Suite is booked in pairs. Guests are asked to bring one."
- "Tables marked reserved are held for couples. Single guests may look at them."
- "Partners are asked not to compare therapists until they have left the building."

**The room's card:** "Two tables, one candle and a strict policy on talking. Needs two Massage Therapists."

**Reviews:**

- From a couple whose table was held: "The table beside mine was reserved for my husband, and he was late."
- Matching Slump, healed: "Eleven years on one sofa, and this was the first time we unclenched together."
- Clasped, healed: "Our hands came apart for the first time since the wedding, with a pop."

**For [The Local Rag](the-local-rag.md)'s headline bank:** COUPLES SUITE OPENS AT {CENTER}; LOCAL MAN TOLD TO BRING SOMEONE

## Rules and numbers

Every number is a first guess, to be set against the bot. A day is 6 seconds.

**The one rule: a couple is called together.** A couple at the front of a Couples Suite table's line is called only when both of the suite's tables are free and both their therapists are at their posts. Until then, the table they lead holds: it calls nobody else, and a RESERVED card stands on it. The suite's other table finishes its own guest and then takes the couple's second partner before anyone in its own line. So a table never holds longer than what is left of the other table's session.

**The Couples Suite.** A massage room, opening at the first star at every campaign center and in the sandbox where massage is on. At least 3 by 5 tiles. Its `required` furniture is two Massage Tables and an Oil Cart, as the Sound Bath Studio requires its two mats. It costs $13,000, against $7,000 for a Massage Suite, so two tables in one room cost about what two rooms do. Singles use its tables as they use any Massage Suite's, and each table counts as a staffed station for arrivals and the guests let in at once (`capacity` in `src/core/sim/demand.ts`), as two suites' tables would.

**Who comes.** Couples come only once a Couples Suite stands with two therapists on the payroll, at a pace of their own: 20% of the center's pace for each suite, each arrival a pair. This is the pattern of a signature machine's own guests (`machineArrival` and `machineDemand`), which come at 35% of the pace for each machine. Partners are rolled as any two guests are, of either sex. Couples are never part of an emergency.

**Two couples' ailments,** each shared by both partners, so one diagnosis serves both:

| Ailment        | Description                                                                    | Treatment                        | Fee, each | Look                                               |
| -------------- | ------------------------------------------------------------------------------ | -------------------------------- | --------- | -------------------------------------------------- |
| Matching Slump | Eleven years on the same sofa. They now slump toward each other.               | Side-by-Side Swedish (`swedish`) | $1,100    | both leaning in, at the same angle                 |
| Clasped        | Held hands through a four-hour wedding and the drive home. The hands have set. | Deep Tissue Unclasping (`deep`)  | $1,350    | walking hand in hand; the hands spring apart cured |

Every therapist knows Swedish, so Matching Slump comes from the first day of the suite. Clasped comes once two therapists are trained in Deep Tissue, and like any Deep Tissue guest, each partner wants a Lounger after. The fees are a little above the single ailments' ($850 to $1,150), as a couples' package is, and they are the only premium: no bonus, no multiplier.

**A visit, step by step.**

- **Check-in:** one service at Reception for both. The partner stands behind.
- **Consultation:** one service for both, at a Consultation Room, charging two consultation fees. If the diagnosis is unsure, both go round again.
- **The price:** the first partner decides for both whether the price puts them off.
- **Waiting:** one entry in the suite's line. The partner takes the free seat nearest the other, or stands beside them. Each sees to their own needs, the toilet and the tea.
- **Patience:** each drains as any waiting guest's does, then both are set to their average, every step. When it runs out, both storm out.
- **Condition:** each worsens on their own. If either runs out, they go home together: the one worse off as worse off, the other as stormed out.
- **Treatment:** each partner's treatment rolls its own chance, and each pays if it works.
- **Leaving:** together, once both are done. One review, signed by both, with the stars of the worse visit and both partners' feelings.

**What a couple counts as.** Two guests, everywhere the game counts guests: heals, goals, the casebook, a storm-out's −3 each and going home worse off's −6. Only the review is one. Couples do not become regulars in the first slice.

## Fair play

**Warned.** The Couples Suite's card in the Rooms menu says that couples come only for it and are seen together. The first couple to arrive brings a tip: "A couple has come in for the Couples Suite. They are seen together, so one table will wait for the other." A held table shows its RESERVED card, and hovering it says why: "Reserved for Ada and Tom Kneadham: waiting for the other table." The guest inspector says "Here with Tom Kneadham. Seen together." over the shared patience bar. The patience and condition warnings come for a couple as for anyone, by line and then by name.

**Counterplay.** Every lever exists: the line, Assign to rooms, the break limit, training, and not building the suite. The first slice adds no button.

**Not easier.** The suite costs about two Massage Suites, its fees are only a little higher, and a held table earns nothing while it waits. The bot sets the target: a center with a Couples Suite should make about what the same floor with two Massage Suites makes, as a machine room is measured against the tables it replaces ([plans/machines.md](../../plans/machines.md)), with stars at month within the noise of today's. If couples make centers richer, their pace comes down.

**Incentives point the right way.** Building the suite is a choice, never a fine for not building it. A held table costs the player its time, not a penalty. Nothing pays for a couple beyond their fees.

## Where it plugs in

Each checked in the code:

- `src/core/data/rooms.ts`: a `couples` room, `required: ['massage_table', 'massage_table', 'oil_trolley']`, as `sound` requires `['singing_bowls', 'sound_mat', 'sound_mat']`. `canSell` in `src/core/sim/building.ts` already keeps a room's two of something.
- `src/core/data/items.ts`: `massage_table` and `oil_trolley` gain `alsoIn: ['couples']` (`roomsFor`, `goesIn`). The suite's other furniture follows as Couples Suites take more techniques.
- `src/core/sim/assignments.ts`: `canWorkIn` reads `def.where === type` alone, not `alsoIn`, so as written a therapist could not be assigned to the suite. It should use `goesIn`.
- `src/core/sim/demand.ts` and `src/core/sim/guests.ts`: the suite's pull beside `machineDemand`, and `admitGuests` spawning a pair through `spawnGuest`, as `machineArrival` brings a machine's guest. `Guest` in `src/core/state/types.ts` gains `partner?: number`.
- `src/core/sim/guests.ts`: `updateGuest` for the shared patience; `stormOut`, `leave` and `goWait` taking the partner along; `worsen` in `src/core/sim/worsening.ts` for going home together.
- `src/core/sim/stations.ts`: `nextInLine` and `updateStations` for the hold, and `callGuest` twice for the call. `completeService` checks in and diagnoses both at once. `goForTreatment` lets the first partner decide the price.
- `src/core/sim/sessions.ts`: `sessionWait`, the precedent for a station waiting for company.
- `src/core/sim/queues.ts`: `moveInLine`, `moveToStation` (only to another Couples Suite) and sending home move both.
- `src/core/sim/feelings.ts`: `writeReview` once for the pair; `afterVisit` is skipped for couples.
- `src/ui/components/inspector/StationInfo.tsx` for the line as one entry, `GuestInfo.tsx` for "Here with", and the held table's hover. The RESERVED card is drawn on the table while it holds.
- `tests/balance/bot.ts`: a flag `couples`, switched on with `BOT_ON=couples` as `BOT_ON=machines` is. From the first star, once two therapists are on the payroll, the bot builds a Couples Suite in place of its next Massage Suite and assigns two therapists to it. Six seeds at every center, against the same bot without it.

**New state:** `partner` on a guest and the new room type. The save version goes up from 40 (`SAVE_VERSION` in `src/core/state/game.ts`) to the next free number; an old game has no couples and needs nothing from `upgradeSave`. Three PA lines to add to [announcements.md](../../dev/announcements.md) and record. Models: the suite's room, the RESERVED card, the joined hands and the matching slump.

## Phases

**First slice (M), ships alone.** The Couples Suite, the pair, the hold, the shared patience, the one review, the two ailments, the line as one entry, the card and the tip, the bot flag and the rerun. Couples only, and massage only.

**Later, if it lands.** Each is one more rule, written up only once couples have been played:

- **Parties.** Three to eight guests who share one patience, are called two at a time into Couples Suites or all at once onto a Sound Bath's mats, and leave together once the last is done, with one review. The Boardwalk Blowout's bachelorette party in [Grand Occasions](grand-occasions.md) is this rule at eight, so the occasion builds on a rule the player knows rather than one of its own.
- **A couple on the mats.** A Sound Bath with two mats free takes a couple in one session.
- **Couples in the other disciplines.** A Couples Clinic for acupuncture, side-by-side cupping, and the suite's equipment (`stretch_rack`, `stone_warmer`) for Sports and Hot Stone couples.
- **Two ailments in one couple,** each partner their own: the pair needs two tables that between them treat both.
- **Regular couples,** greeted together at Reception.

## Decisions to make

Each has the default this doc assumes.

1. **A room of its own, or a second table in any Massage Suite.** The Couples Suite (default). Putting the Massage Table on sale in the Items menu would let every suite double its stations for the price of a table, which changes how the whole game buys stations.
2. **When it opens.** The first star, at every center with massage (default). The second star, if the first star already opens too much at once.
3. **Whether singles use its tables.** Yes (default), so it never stands idle while nobody comes. Couples only would make the hold free and the room a luxury.
4. **How long a table holds.** Until the other table's guest is done (default), so never longer than one session. With no hold, a couple waits for a moment both tables happen to come free, which in a busy suite may not come.
5. **One ailment for both, or one each.** One, shared (default): one diagnosis, one technique, one review.
6. **What a couple's losses count.** Each partner as a guest, as today (default). Counting the pair as one would be a discount on couples alone.

## Risks

- **The hold reads as a bug.** An empty table beside a long line looks broken. The RESERVED card, the hover and the first tip are the guard. Watch whether playtesters ask why a table is empty.
- **Breaks stall it.** A therapist on a break holds a couple up. The break limit and a third therapist are the answers; the bot should show couples waiting no more than about a day longer than singles.
- **The room is big for a small building.** Willow Lane's building is 16 tiles by 10 before its plots, and a 3-by-5 room is a lot of it. Try it with pencilled-in rooms before the minimum size is set.
- **Pairs reach everywhere in the code.** Every path that moves, sends home or removes a guest needs the partner: a storm-out, going home worse off, a station sold or moved under a held couple, a fire, a power cut, a runner on a really bad trip passing them. Each needs a unit test.
- **Tone.** The joke is on the couples' package and the trade that sells a relationship by the hour, never on who the couples are.
