# Gate 44 Serenity Lounge

Drafted 27 October 2026.

An idea, not a plan: nothing here is decided. It grows the first of [the ranked list's](README.md) new centers into a center doc, after Max's note on 27 October 2026: "In terms of new levels, i like the idea of an airport and a cruise ship." The cruise ship is [The MS Serenity](ms-serenity.md).

A healing lounge airside at Gate 44: a long, narrow strip of concourse between the moving walkway and the windows onto the runway. Every guest arrives with a flight, and the flight is on the departures board by the door from the moment they walk in. Travelers come off the walkway in waves, rolling suitcases, twice in every six days. When final call comes they go, healed or not, and a guest still on the table runs for the gate in one of the lounge's robes and leaves a slipper on the carpet. The player's new verb is **fitting people in**: reading the board, putting the earliest flights first or not, sending a short-of-time guest to an Express room, and letting go of someone who will not make it. Everything here is drawn on the floor: the board, the waves, the bubble with a boarding pass, the Express sign, the sprint, the slippers, and delayed travelers lying across the benches.

## The gap it fills

- **What it teaches.** Every pressure so far is either a rate the player builds against (arrivals, rush hours, seasons, wear, cold) or a decay hidden inside each guest (patience, a worsening condition). Emergencies are the only deadlines, and they are opt-in batches. Gate 44 is the first center where the deadline is known ahead, shown on the floor, and shared by a whole flight, so the question changes from "how many can I take?" to "who can I fit, and with what?"
- **Every center opens the same way** (gap 2). This one opens with massage and acupuncture together, a departures board already on the wall, and no sound healing ever. Its early build is short sessions near the door, not a Massage Suite then a Staff Room.
- **The third star is more of the same** (gap 1). Each star here asks about the twist itself: the share of guests who boarded healed.
- **Paused time** (gap 11). A board of who leaves when is something to plan against while paused, which is how Max plays.

## How it plays

**Arriving.** A guest's ticket is set at the door: a flight number, a destination and a boarding day. It is on the board, in their inspector ("Boards in 4 days: PP 212 to Tucson"), and, once boarding is a day off and they are still waiting, as a boarding-pass bubble over their head, the way thirst and annoyance already show. Patience still runs as everywhere, but the flight usually comes first.

**The banks.** The airport runs on a six-day cycle, as The Exchange's rush hours do: a morning bank on days 1 and 2, an evening bank on days 4 and 5. In a bank the travelers pour off the walkway, and flights board. So deadlines bunch: everyone on the evening bank must be done by its first day, and the two days before it are a race. The bottom bar says "Morning bank" or "Evening bank" where it says "Rush hour" at The Exchange.

**The board.** A big split-flap board stands on the wall by the front door from the start. Clicking it opens its inspector: the next eight flights, each with its time, its status (on time, delayed two days, boarding, final call, departed) and our guests on it, healed, waiting or on a table. A name there selects the guest.

**Fitting people in.** Four levers exist today: moving a guest up a line, the diagnosis threshold in Policy, sending a guest home, and building more. The center adds two. **Earliest flight first** sits in Policy beside Emergencies first and orders every line by boarding time. It is not always right: in a crush it spends tables on guests who will miss their flight anyway. **Express rooms** (phase 2) are any treatment room with Express switched on in its inspector; a lit EXPRESS sign goes up over its door. Express sessions are shorter, less likely to work and pay less. A guest is sent to one only when their full session will not fit, or when the player sends them from their inspector.

**Final call.** At the start of a flight's bank its guests leave. A guest still in line walks to the gate unhealed. A guest on a table gets up and runs in the robe, and one left slipper drops on the carpet for a Caretaker to pick up. A session at least three quarters through is finished in a hurry first and may still work.

**Delays.** Now and then the board posts a delay, at least two days before the flight was due. It is more time, so a guest can be moved from Express to a full session. Delayed travelers with nothing to do lie across a bench and sleep with their bags, taking three seats, so others stand. More benches, the Recovery Lounge, or treating them early are the answers.

**Across the center.** Massage and acupuncture are open from the first day. The first star brings the Soul Scanner, the second reiki, the Shaman and the Body Clock in Gate 45, and the third the airport's busiest day.

## The jokes

**Things to draw.** The board's flaps clattering as a delay goes up. A clay person in a white robe sprinting along the walkway, slipper-less on one foot. A small heap of left slippers by the gate desk. The Soul Scanner, a security arch that beeps and rolls a gray tray out the far side with what it found in the guest's coat: a grudge (a crumpled note), a voicemail from 2014 (a flip phone), an ex's hoodie. Across the walkway, ZenMart's kiosk, signed **ZenMart Xpress, Gate 12**, directly opposite Gate 44.

**PA lines**, at most three for each feature, all instructions:

| Feature      | Line                                                                                 | Words |
| ------------ | ------------------------------------------------------------------------------------ | ----- |
| Final call   | "Passengers on final call must leave the table now. Oil may be carried on."          | 14    |
| Boarding     | "Boarding is by group. Group one is anyone whose chakras are aligned."               | 12    |
| Delays       | "Delayed passengers may lie down on the benches. Please lie down in boarding order." | 14    |
| The sprint   | "Robes leaving the lounge at a run will be billed to the airline."                   | 13    |
| Slippers     | "Lost slippers may be claimed at Gate 44. Left feet only."                           | 11    |
| Soul Scanner | "Please remove all grudges and place them in a gray tray."                           | 11    |
| Soul Scanner | "Passengers who beep may be asked to talk about it."                                 | 10    |
| Soul Scanner | "Inner children may not pass through the scanner unaccompanied."                     | 9     |
| Body Clock   | "The Time Zone Room is open. Please set your body to local time."                    | 13    |

**Reviews**, three: "Boarded with one slipper and the calmest neck in row 31." · "The arch found a grudge in my coat and let me keep the tray." · "They called my flight before they called my name."

**The Rag.** If [The Local Rag](the-local-rag.md) is built, the concourse's free paper is **_The Layover_**, motto _"Read it twice. You have time."_ Its headlines: GUEST SPRINTS TO GATE 44 IN ROBE, MAKES FLIGHT, LEAVES SLIPPER · SOUL SCANNER FINDS {N} GRUDGES IN ONE DAY; TRAYS RUN SHORT · {STAFF} FINISHES DEEP TISSUE AT A RUN.

## Rules and numbers

Every number is a first guess for the bot to set.

**Tickets.** Banks start on days 1 and 4 of each six-day cycle; boarding is at a bank's start. Arrivals run at ×2.2 in a bank and ×0.5 between, as rush hours do (`rush: { peak: 2.4, lull: 0.6 }` at The Exchange).

| Ticket       | Share | Boards                               | Time on arrival | Fee   |
| ------------ | ----- | ------------------------------------ | --------------- | ----- |
| Connection   | 55%   | two banks on                         | 5 to 6 days     | ×1    |
| Long layover | 30%   | four banks on                        | 11 to 12 days   | ×1    |
| Red-eye      | 15%   | the night between banks (day 3 or 6) | 1 to 2 days     | ×1.25 |

Sessions run 7 to 20 seconds, 1.2 to 3.3 days (`seconds` in `src/core/data/treatments.ts`), and a consultation 1 day. So a red-eye fits an Express Swedish and little else, and the slow techniques (Cranio-sacral, Gong Bath, the Ayahuasca Ceremony) belong to long layovers.

**Boarding unhealed.** No fee and −1 reputation, what sending a guest home costs today (`SEND_HOME_REP`), and a review that mentions it. It is not a storm-out (−3): the guest did not choose to go. It is a new visit end, `boarded`, beside `stormed` and `worse`. Nothing brings them back for being ignored.

**Final call on a table.** At 75% through or more, the session ends at once and rolls its chance less 10 points, paying only if it works. Under 75%, it stops, unpaid. Either way the robe goes too ($30 on the books) and a slipper is dropped.

**Express** (phase 2). 60% of the session, the chance of success 15 points lower, 60% of the fee. Machines have no Express.

**Delays.** One flight in six, by 1 to 3 days, posted two or more days before it was due. A delayed guest lies across a bench once seated with nothing to do. The delay is the airline's: a feeling in the review that the reputation does not count.

**The center.**

| Field           | Value                                                                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Place and blurb | "Airside at the far end of Concourse C" · "Travelers with a flight to catch, in waves. Finish them before final call, or watch them run."                           |
| Plot            | `{ x0: 6, x1: 37, y0: 11, y1: 17, door: [21, 22] }`, width 56: 32 tiles long and 7 deep, so two rows of 3-deep rooms and a one-tile corridor, or one row and a hall |
| Scenery         | `'terminal'`: patterned carpet, the walkway for the road, Gate 44's desk and jet bridge east of the door, planes taxiing past the back windows                      |
| Climate         | `{ average: 66, swing: 1 }`: the terminal's own                                                                                                                     |
| Start money     | $40,000                                                                                                                                                             |
| Disciplines     | `['acupuncture', 'reiki', 'shaman']`, `unlockedFrom: 1`; no sound healing; Qi Gong classes on                                                                       |
| Conditions      | `{ carryon: 3, pillow: 2.5, limbo: 2.5, neck: 2 }` (Text Neck already fits)                                                                                         |
| Mishap          | `'fog'`                                                                                                                                                             |
| House calls     | `{ often: 1.5, clients: ['the cabin crew lounge', 'the control tower', 'the first-class lounge'] }`                                                                 |

**Plots**, in the house style:

| Plot                        | Blurb                                                                                                                         | Where                                | Price   | Star |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------- | ---- |
| The shuttered pretzel stand | The kiosk to the west, still smelling of cinnamon                                                                             | x 2–5, y 13–17                       | $6,000  | 0    |
| The old smoking lounge      | A glass room behind the lounge, aired out since 2007                                                                          | x 12–27, y 7–10                      | $15,000 | 1    |
| Gate 45                     | Closed for refurbishment since 2009: a building of its own past the gate, with room for a machine and a path from the walkway | x 45–53, y 10–17, door south at x 48 | $26,000 | 2    |
| The lost property office    | Behind the lounge, three shelves deep in umbrellas                                                                            | x 28–37, y 6–10                      | $16,000 | 3    |

**Ailments**, found only here, in `src/core/data/conditions.ts` style:

| Ailment                | Description                                                                               | Treatment                                  | Fee    | Look                                           |
| ---------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------ | ------ | ---------------------------------------------- |
| Carry-On Shoulder      | Carried a bag sized exactly to the frame for four terminals. The shoulder kept the shape. | Deep Tissue Unpacking (`deep`), structural | $1,250 | one shoulder hiked, a strap mark               |
| Neck Pillow Dependency | Wore the neck pillow off the plane. The head will not stay up without it.                 | Needle Weaning (`needling`)                | $1,100 | horseshoe pillow, head lolling                 |
| Layover Limbo          | Between flights so long they have stopped believing in a destination.                     | Spirit Animal Rebooking (`reading`)        | $1,700 | walks leaning back, under a bar nobody can see |

**The machine: the Body Clock** (second star, in Gate 45). A station clock four tiles across, standing against a wall, so the long lot is the place for it. Worked by the Acupuncturist, who winds it by a crank: the meridian clock, taken literally. The guest is strapped to the minute hand and wound round past little city names on the dial until the hand stops at HERE and a cuckoo comes out. Fake failure: one turn too many, and the guest climbs off at TOMORROW, yawning; it works anyway. Overload: it strikes thirteen, over and over, which is noise. A 4×1 footprint in a Time Zone Room of at least 4×5, about $24,000, sessions of 8 seconds. It cures **Watch Stack** ($2,400): "Crossed eleven time zones and kept a watch for each one." (arms ringed with wristwatches) and **Red-Eye** ($2,300): "Landed at 5:40 in the morning and has stayed there." (one red eye, a paper cup).

**The Soul Scanner** (first star). The second diagnosis room on [the todo list](../todo.md) (phase 11), made the way the Posture Lab is: a room that runs itself, with an arch in place of the Posture Scanner. Guests walk straight through in 2 seconds, against 6 for a consultation. It makes certain any condition that is not massage's (acupuncture, reiki, Shaman), so those guests skip the Consultant. It does not read bodies, so massage guests still see one. A room of at least 3×3, $8,000.

**The mishap: fog.** Announced three days ahead, as every mishap is. For two days nothing flies: no arrivals, and every flight on the board slides back two days. That much is a gift. The cost is the terminal's stranded travelers, eight of them, who walk in and sleep across the benches, snoring (noise 3 each). Prepare for $1,000, "Put out cots at the far gates", and they sleep there. Warning: "Fog is forecast this week. Every flight will be grounded for two days." Start: "All flights are grounded. Passengers may meditate at their gates until further notice." End: "Flights are cleared to depart. Please roll up your yoga mats."

**Goals.** One new kind, `{ kind: 'onTime'; percent: number }`: of the guests whose flights boarded in the last 30 days (at least 20), this share boarded healed.

| Star | Objectives                                                                  |
| ---- | --------------------------------------------------------------------------- |
| 1    | Heal 25 · reputation 45% · on time 50%                                      |
| 2    | Heal 80 · 10 with acupuncture · on time 65% · reputation 65%                |
| 3    | Heal 180 · 15 with reiki · on time 70% · the Busiest Travel Day of the Year |

**The occasion: the Busiest Travel Day of the Year**, in the revised [Grand Occasions](grand-occasions.md) frame. At the second star the airport sets the date about 60 days out, at the start of a morning bank, and it goes up as the top row of the departures board, where it stays; it cannot be moved. PA when it is set: "The busiest travel day of the year is now on the departures board." On the day: "All lounge seating is now standing room. Please breathe in turns." It runs one six-day cycle with both banks at ×2.6 arrivals and a third of the flights delayed, posted two days ahead as always. Nothing else goes quiet: emergencies, outbreaks and the banks carry on. One judged line: **of the day's travelers, the share who boarded healed; 55% or more earns it.** The board's row shows a readiness check from a week out: "Expected: about 70 travelers. Last cycle, 41 boarded healed of 58." A miss costs the day itself, and the airport sets another 60 days on.

**Karma.** Its stars add 6 and the Foundation's gifts 3, as at every center. One achievement, **On Time** (2 karma): a month in which every guest who boarded, at least 20 of them, boarded healed. The karma-only item to match the stars is the **Baggage Belt** (6 karma, $1,800): a short loop of unclaimed bags going round, which bored guests stand and watch as they play the arcade. Totals go to 78 earned against 81 to buy everything, so a player who does it all still chooses.

## Fair play

**Warned.** A guest's deadline is shown from the moment they arrive, and only the airline moves it, with two days' notice on the board and a PA call. Banks run on a fixed cycle shown in the bottom bar. A boarding-pass bubble appears a day ahead over anyone still waiting. Fog comes with three days' notice and a price to prepare. The busiest day is on the board 60 days ahead with a readiness check.

**Counterplay.** The line order, Earliest flight first, the diagnosis threshold, sending home early, Express rooms, the Soul Scanner to skip the consultation, short techniques, rooms by the door, and more benches for delays. No cliff: a guest who misses out costs a fee and one point of reputation, not a storm-out's three or a worse-off guest's six.

**Why it is not easier.** No number is softened. Patience runs at the usual rate, and the deadline sits on top of it. Express pays 60% and works less often. A missed guest pays nothing. Red-eyes pay more only to tempt. The bot target is the third star at about The Orchard Estate's month, with a median month's profit no higher than The Orchard's.

## Where it plugs in

Checked in the code, kept to what a center needs:

- `src/core/data/types.ts`: `CenterId` (line 761) gains `'gate44'`; `CenterDef` (line 764) gains `flights?: Flights` (bank peak and lull, ticket shares and windows, delay chance and days); `scenery` gains `'terminal'`; `GoalSpec` gains `onTime`.
- `src/core/data/centers.ts`: the entry, and `'gate44'` after `'orchard'` in `CAMPAIGN`, so The Orchard Estate's first star opens it (`src/core/campaign.ts`).
- `src/core/sim/twists.ts`: banks reuse the shape of `inRush`, `arrivalParts` and `rushOutlook`; boarding, delays and final calls go in a new `updateFlights` beside `updateTwists`.
- `src/core/sim/guests.ts`: `spawnGuest` gives a ticket; a `board` beside `stormOut` and `leave`. `src/core/sim/records.ts`: `VisitEnd` gains `'boarded'`.
- `src/core/sim/stations.ts` (`pickStation`, `stationScore`) for Express; `src/core/sim/policy.ts` for Earliest flight first beside `emergenciesFirst`.
- `src/core/data/rooms.ts` (`assess`, the Posture Lab) and `posture_scanner` in `src/core/data/items.ts` as the models for the Soul Scanner; `fireplace` there for the Baggage Belt's karma.
- `src/core/data/mishaps.ts`: `MishapId` gains `'fog'`. `src/ui/lib/status.ts` (`conditionNote`) is the model for the flight line, and `StatsBar.tsx` for the bank label. `src/render/models/storefront.ts` for the kiosk.
- A save version past 40, whichever is free.

## Phases

1. **The deadline (L).** The center as data, its lot and scenery, the board, tickets, banks, final call, the sprint and the slipper, delays on the benches, `boarded`, Earliest flight first, `onTime`, the three ailments. The levers are the ones the game already has. The bot learns to triage. This proves the one new rule.
2. **Express (M).** The room switch, the sign, routing, and the guest inspector's override.
3. **The Soul Scanner, the Body Clock and the fog (M each).** Then the kiosk, the Baggage Belt and On Time.
4. **The busiest day (S),** once Grand Occasions' frame exists, since it is the deadline rule turned up and needs no rule of its own.

## Decisions to make

Each has the default this doc assumes.

1. **Campaign slot.** Sixth, straight after The Orchard Estate (default): the Orchard opens everything, and this is the next new thing to do with it. The old wing (St. Agatha's) and The MS Serenity follow in either order; the ship's ports on a timetable build on what the lounge teaches.
2. **What boarding unhealed costs.** No fee and −1 reputation (default). A storm-out's −3 punishes the player for the airline's clock; nothing at all makes deadlines toothless.
3. **A table at final call.** Finish if 75% through (default), or always stop. Always stopping makes every late start a pure loss.
4. **Express by room** (default), or per guest. By room is spatial and drawn; per guest is one more button on every inspector.
5. **No sound healing here** (default). Its sessions are the longest, and it gives the center a roster of its own.
6. **The Soul Scanner** at Gate 44 and in the sandbox first (default), at every center after a rerun.
7. **The occasion's date.** Set by the airport 60 days out (default), or the real day before Thanksgiving in late November, as Max's example had it, which can mean a wait of most of a year.
8. **Fog on the busiest day.** Kept off it (default): fog hands out time, so here it would soften the finale, not add to it.

## Risks

- **Clutter.** A countdown on every head would be noise. The bubble shows only within a day of boarding and only for guests still waiting; the rest lives in the inspector and on the board.
- **The bot.** Without triage (who goes Express, who is let go) the rerun cannot set the on-time goals.
- **Six-second days.** Banks are on the six-day cycle for the reason rush hours are: anything shorter flickers past.
- **The narrow lot.** Seven tiles deep may be too tight; try it with pencilled-in rooms before the plots are fixed.
- **It reads as emergencies.** Emergencies are a batch with one date; here every guest has their own, and the skill is the order.
- **The sprint is fun.** Players may court it. The lost fee under 75% and the slippers on the carpet are the brake; watch it in play.
- **Tone.** Airport security jokes stay on the arch and its trays; never threats, never a real illness.
