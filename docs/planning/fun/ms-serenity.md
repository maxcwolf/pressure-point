# The MS Serenity

Drafted 27 October 2026.

An idea, not a plan: nothing here is decided. It is the second of the new centers in [the ranked list](README.md), and one of the two Max has said he likes, beside the airport in [Gate 44](gate-44.md).

The player runs the spa deck of a cruise ship. Every guest is a named passenger on the voyage's manifest, about 150 of them, and every one of them stays aboard until the ship is home, however their visit went. A guest who storms out of the line is on the promenade the next morning, under a little rain cloud, walking past the spa's windows. Their tablemates hear about it at dinner and come in already short of patience. A guest who leaves delighted sends their table in, three or four of them together, saying so at Reception. The player's new verb is to **make it right**: comp a sore passenger a treatment, bring them back to the front of the line, and turn their table around. The ship calls at a port every 10 days, which empties the spa for a day and brings back a wave of passengers who paid to see a rock. A voyage is a month. At turnaround everyone goes down the gangway and the next manifest walks up it.

## The gap it fills

- **The people are interchangeable** (gap 4). A guest today is a name that leaves and never comes back unless they become one of at most 12 regulars (`REGULARS_MAX`, `src/core/data/regulars.ts`). On the ship the whole crowd is a cast for a month, and the faces repeat. [Gate 44](gate-44.md) is the opposite: strangers you never see again, against a departures board.
- **Every center opens the same way** (gap 2). The Serenity opens with massage, acupuncture and sound healing on day one (`unlockedFrom: 1` in its `CenterDef`), and its first lesson is the manifest, not the Reception, consultation, suite ladder.
- **A storm-out is a number** (`stormOut` in `src/core/sim/guests.ts` costs 3 reputation, and the guest is gone). Here it is a person still on board, with a table, and something the player can do about it. That is an answer to the mid-center squeeze too (gap 9): a bad week has an active way out that costs a treatment slot, not a loan.
- **The third star** (gap 1) ends in the Crossing, a set piece built from this center's one rule.

What it teaches that no center before it does: **the guests remember, and so do their friends.** Every other center forgives a bad day by forgetting it. The ship keeps it for the rest of the voyage, and gives the player a way to win it back.

## How it plays

**The verb and the things on the floor.** The player sees sore passengers on the promenade under their rain clouds, tables walking in together ("Table 12 sent us"), and towel animals. The player does one new thing: clicks a sore passenger, on the promenade, in their toast or in the manifest, and presses **Comp a treatment**.

**The manifest (the one new rule).** Every guest is a passenger, and stays aboard until turnaround whatever happened.

- **Each passenger** has a name, a cabin and a table of eight, shown in their inspector: "Cabin 7041 · Table 12 · second visit".
- **Who comes in.** How often guests arrive is set as it is now (`arrivalPace` in `src/core/sim/guests.ts`). The manifest settles who: a regular due back first, as now; then a tablemate sent by a delighted passenger; then anyone aboard who has not been sore this voyage, those who have not visited yet more likely. A passenger can come back with a new ailment, up to 3 visits a voyage, so the same faces turn up again and again.
- **Sore.** A passenger whose visit ends stormed out, sent home or worse off (`Outcome` `'stormed'`, `'sent'` or `'worse'`) is sore until turnaround. They walk the promenade under a rain cloud and never come back on their own. Each of their tablemates who comes in arrives with 20 less patience and the cloud over them, and their inspector says why: "Heard about the wait at Table 12."
- **Make it right.** A sore passenger gets a toast with **Comp a treatment**, kept like the raise-request cards until it is answered or the voyage ends. Comped, they come back within a day for their treatment free, go to the front of its line, and arrive with full patience. Healed, they are **made right**: the cloud goes, their review counts a star higher ("came back"), and their table hears that instead. Let down a second time, they stay sore and cannot be comped again. If [Make It Right](make-it-right.md) is built first, at every center, the ship builds on its rule rather than writing its own: aboard, the card lasts the voyage, a guest sent home counts too, since nobody leaves the ship, and what a comp wins back is the table's mood as well as the reputation.
- **Delighted.** A passenger who gives five stars sends up to three tablemates who have not visited, within two days. They walk in together, with 10 more patience, and take the place of new arrivals, as a regular due back does.
- **Regulars are repeat cruisers.** Within a voyage they come back as regulars do now (`returnGap`, 12 to 24 days). At turnaround each one rebooks for the next voyage: half of plain regulars, three quarters of loyal ones, every devoted one.
- **Turnaround.** On the last day of the month everyone disembarks; anyone still waiting goes ashore without a fee and without a reputation loss, and arrivals taper over the voyage's last two days so few are caught. Reputation carries across voyages as now: it is the cruise line's rating of the spa. Sore and delighted do not: a new manifest has heard nothing.

**The voyage and the port rhythm.** A voyage is 30 days, a month, so payday is turnaround. The ship calls at a port on days 10 and 20, and is home on day 30. Until the player opens the spa (`s.open`) the ship sits in its home port, so fitting out has no clock. The rhythm is data, in the shape of rush hours and seasons:

- **Port day:** most passengers are ashore. Arrivals run at 0.4 of usual. The lobby empties and the gangway fills.
- **The three days after a port:** arrivals at 1.4, and Excursion Regret comes in far more often.
- **Sea days:** arrivals at 1.1, and Deck Chair Claim more often.
- **At each port** 20 passengers go ashore for good and 20 new ones board, so a sore table can thin out. The health inspector and a visiting VIP (one of the five in `VIPS`, `src/core/data/visits.ts`) board at a port, with the usual notice, and stay aboard as passengers for the rest of the voyage.

The bottom bar shows the rhythm where it shows rush hours and snow: "At sea · Gull Rock in 4 days".

**A typical voyage, month 9.** Day 1: the new manifest is aboard, and the first passengers come in for Deck Chair Claim. Day 4: a Hot Stone line runs long, and a woman from Table 9 storms out. Her toast offers a comp; the player has no free table for two days, so leaves it. Day 6: two of Table 9 come in under the cloud, and one of them storms out too. Now the player comps both, and moves a Therapist onto Hot Stone. Day 8: both are back at the front of the line, healed, made right; the clouds go. Day 10: Gull Rock, and the lobby is empty but for a Caretaker. Days 11 to 13: a wave of rock T-shirts. A man from Table 12 gives five stars, and on day 14 three of his table walk in together. Day 30: everyone goes ashore, the paper lands, and payday is due.

**The hull.** The building is the spa deck, long and narrow: about 28 tiles by 6, on a lot 56 wide. The street is the promenade, with passengers strolling it, and beyond the rail is the sea. Rooms fit end to end along one corridor, so walking is the puzzle. Plots, in the order they come up:

| Plot                                      | Blurb                                                                | Star | Price   |
| ----------------------------------------- | -------------------------------------------------------------------- | ---- | ------- |
| The stern sun deck                        | The open deck aft, roofed over with a striped awning                 | 1    | $14,000 |
| The Lido Deck's forgotten corner          | Between the pool bar and a lifeboat, where deck chairs are forgotten | 1    | $11,000 |
| The old casino, closed after the incident | A room of its own off the promenade, with space for a machine        | 2    | $26,000 |
| The forward observation lounge            | Glass on three sides at the bow, and the best view on the ship       | 2    | $18,000 |
| The crew bar                              | Behind a door marked CREW ONLY, which the crew have agreed to share  | 3    | $16,000 |

**Disciplines.** Massage, acupuncture and sound healing from the start; reiki at the second star; Qi Gong classes ("sunrise Qi Gong on the Lido") at the studio's star as elsewhere. No Shaman: the cruise line's insurer has read about the Sweat Lodge. The third-star techniques that remain (Distance Reiki, Chakra Balancing, Overtone Chanting) open at the second star, as [Grand Occasions](grand-occasions.md) proposes everywhere.

**Three local ailments,** found only aboard:

| Ailment              | Description                                                                  | Treatment              | When                        |
| -------------------- | ---------------------------------------------------------------------------- | ---------------------- | --------------------------- |
| **Deck Chair Claim** | Put a towel on a lounger at six, and has sat bolt upright guarding it since. | Deep Tissue Releasing  | Sea days                    |
| **Excursion Regret** | Paid $140 to see a rock, and is wearing the T-shirt.                         | Cupping Refund         | The three days after a port |
| **Upsold**           | Came in for a foot rub and left carrying a $300 jar of mud.                  | Sound Bath Unburdening | Any day                     |

Each is drawn: a rolled beach towel under the arm, a T-shirt with a rock on it, a jar of mud held in both hands. Upsold aims at the cruise spa trade's own habit, the hard sell at the end of a treatment.

**The machine: the Turndown Service.** A towel-folding machine the size of a cabin, worked by a Massage Therapist, opened at the second star. 2×5, in a room of at least 4×7 costing about $26,000, which fits the old casino. The guest lies down, two brass arms fold them in a giant towel into a swan, a chocolate is placed on the pillow and the lights dim; then they are unfolded, crisp. Now and then they come out as a towel monkey hanging from the ceiling hook, and the Therapist lifts them down. When it overloads it folds the room's bench, bin and plant into swans until a Caretaker shakes them out. It cures:

- **Towel Animal Anxiety**, about $2,700: "Woke to a towel swan on the bed, then a monkey, and last night something with eight legs."
- **Turned Down**, about $2,500: "Got back to the cabin to find the bed turned down, and took it personally."

**The mishap: Muster Drill.** Announced three days ahead like every mishap (`MISHAP_NOTICE_DAYS`). Unprepared, for one day every guest and member of staff stands on the promenade in an orange life jacket: nothing is treated, nobody arrives, and nobody waiting loses patience. Prepared for $900 ("Volunteer as a muster station"), the passengers muster in the lobby and treatments go on, in life jackets.

**ZenMart at Sea.** A kiosk on the Lido by the pool, the storefront model shrunk to a booth across the promenade, selling seaweed detox wraps. It draws passengers away as the rival does now (`rivalDraw`, `src/core/sim/rival.ts`), from the same 150.

**House calls** go to the bridge, the engine room, the cabaret company and the Owner's Suite (`calls.clients`).

**The cast, reused.** The inspector and the five VIPs board at ports, as above. Rang Dipkin, from the cameo names (`CAMEOS`, `src/core/data/text.ts`), is on every manifest at Table 12. Amanda Jablonsky applies as she does anywhere. The Captain is never seen.

**Three stars.**

1. Heal 30; reputation 45%; finish a voyage with 4 or fewer passengers sore at turnaround.
2. Heal 90; heal 15 with sound healing; cure rate 75%; 5 tables sent in by a delighted tablemate in one voyage.
3. Heal 180; reputation 75%; the Crossing.

**The Crossing,** the Grand Occasion. At the second star the cruise line sets the date: a repositioning cruise about 60 days out, two voyages on, not to be moved. It replaces one voyage: 14 days at sea with no port, so every day is a sea day, nobody boards or goes ashore, and the same 150 are aboard all the way. Every crossing opens with a Muster Drill, announced with the date. On day 7 the ship crosses the line (the route does not cross the equator, so the Captain draws one on the pool deck), and 12 passengers, newly initiated, come in Off Balance, for Chakra Balancing. The game does not go quiet: emergencies and the rival carry on. **One judged line:** passengers sore at the Captain's Gala on the last night. The star needs **6 or fewer**. Made right does not count as sore. A miss costs nothing beyond the voyage, and the line sets another crossing 60 days later.

## The jokes

The PA is the cruise director, who gives instructions and policy, never comments. Three lines to record:

- "Passengers are reminded that the towel animals are decorative. Please do not feed them."
- "Every spa treatment ends with a short presentation on seaweed. Attendance is included."
- "Tonight we cross the line. The Captain will draw it on the pool deck."

The Muster Drill's own lines: warning "The Captain will hold a muster drill this week. Attendance is required."; start "This is a drill. Proceed to your muster station. Mud masks may stay on."; end "The drill is over. Life jackets go back under the bed."

**The daily program.** [The Local Rag](the-local-rag.md) is the ship's daily program, slipped under the cabin doors: _The Serenity Daily_, "Printed daily. Delivered monthly." Its headlines come from the manifest: "TABLE 12 RECOMMENDS SPA; TABLE 9 DOES NOT." "GULL ROCK EXCURSION SELLS OUT; ROCK UNCHANGED." "PASSENGER IN 7041 MADE RIGHT, DENIES IT."

**Reviews,** a few in the ship's own voice: "My table sent me, and I have sent my table's table." "Five stars, though I would rather not be a swan again." "Spent the sea days on a lounger and the port days at the spa, which I gather is backwards."

**The cruise line** is the Doldrum Line ("Nowhere, slowly"). It sets the dates and rates the spa; it is never a character.

## Rules and numbers

All numbers are first guesses.

- **Voyage:** 30 days; ports on days 10 and 20; turnaround on day 30, with payday. Arrivals ×0.4 on a port day, ×1.4 for three days after, ×1.1 at sea, tapering to ×0.5 over the last two days. Excursion Regret's weight ×6 in the three days after a port and ×0.5 otherwise; Deck Chair Claim ×3 at sea, ×0.5 on and after port days; Upsold ×2.5 always.
- **Manifest:** 150 aboard; 19 tables of eight; 20 swapped at each port; at most 3 visits a voyage a passenger.
- **Sore:** tablemates arrive with −20 patience while the sore passenger is aboard and not made right. No reputation cost beyond today's (−3 for a storm-out, `SEND_HOME_REP` for a send-home, `WORSE_REP` for worse off).
- **Comp:** the treatment's fee is waived; back within 1 day; front of the line; full patience. One comp per passenger per voyage.
- **Delighted:** five stars sends up to 3 tablemates within 2 days, with +10 patience, in place of new arrivals.
- **Repeat cruisers:** rebook at turnaround at 50%, 75% and 100% by loyalty.
- **Muster Drill:** 1 day, $900 to prepare, gap as other mishaps (`MISHAP_GAP_DAYS`, 80 to 140).
- **Crossing:** 14 days, 12 Off Balance passengers on day 7, the star at 6 or fewer sore of 150.
- **Karma:** 2 for each star and the usual few for achievements, as the other centers. A karma-only item matches the stars' 6, as the Fireplace and Topiary do: the **Ship in a Bottle**, "The Serenity, in a bottle. Smaller, calmer, and never late into port." Nothing repeatable pays karma; comps and tables pay nothing but the guests themselves.

## Fair play

**Warned.** A sore passenger is a toast the moment it happens, with the button on it, and a cloud on the floor that stays where the player can see it. A tablemate's lower patience is in the patience bar and their inspector names the cause. The port schedule is in the bottom bar from day one. The Muster Drill has three days' notice and its price. The Crossing's date, its drill and its one line are known 60 days ahead.

**Counterplay.** Comp the sore; heal well enough to delight, which sends tables your way; benches, tea and shorter lines keep anyone from going sore in the first place, as they do everywhere. A thin table drifts ashore at port. A whole bad voyage ends at turnaround with reputation's usual damping, so a disaster is bounded at a month.

**Not easier.** Every storm-out costs what it costs now, and then keeps costing: its table comes in shorter-tempered for the rest of the voyage. A comp is a free treatment and a slot taken from a paying guest. The delighted table brings no extra guests, only better ones. Turnaround clears the grudges but never the reputation lost.

**The incentives point the right way.** Ignoring a sore passenger never pays: they cost their table's patience until the voyage ends. Finishing well is never punished: a delighted guest's table comes, and a devoted regular sails again.

## Where it plugs in

Checked in the code:

- `src/core/data/types.ts`: `CenterId` gains `'serenity'`; `CenterDef` gains an optional `voyage` (`days`, `ports`, `aboard`, `swap`) and its port paces; `scenery` gains `'ship'`; `GoalSpec` gains a voyage goal (sore at turnaround, tables sent).
- `src/core/data/centers.ts`: the entry, with `plot`, `width: 56`, `plots`, `disciplines: ['acupuncture', 'sound', 'reiki']`, `qigong: true`, `unlockedFrom: 1`, `conditions`, `calls`, `mishap: 'muster'`; `CAMPAIGN` gains it.
- `src/core/sim/twists.ts`: `arrivalParts` reads the port day into `time`, as it reads rush hours and seasons; `updateTwists` announces each port as it does each season.
- `src/core/sim/guests.ts`: `admitGuests` picks the passenger as it picks `dueRegular`; `spawnGuest` already takes a `Regular` to come back as, and a passenger is the same idea.
- `src/core/sim/regulars.ts`: `afterVisit`, called from `writeReview` in `src/core/sim/feelings.ts`, is where a visit's end marks a passenger sore, delighted or made right.
- `src/core/data/conditions.ts`: five ailments with `only: ['serenity']`; `src/core/data/mishaps.ts`: `MishapId` gains `'muster'`.
- `src/ui/components/Toasts.tsx`: the comp card, beside the raise cards; `src/ui/components/menus/StatsMenu.tsx`: a Manifest tab beside the regulars.
- `src/core/state/game.ts`: `SAVE_VERSION` (40) goes to the next free number; a new center needs nothing from `upgradeSave`.

**New:** the manifest on `GameState` (a few bytes a passenger: cabin, table, visits, state; looks made from the id as regulars' are); the hull, promenade, rail and sea; the rain cloud, the towel animals, the life jackets, the three ailment props; the Turndown Service and its gag; the kiosk; the Ship in a Bottle; about eight PA recordings.

## Phases

1. **The ship and the manifest (L).** The hull, the plots, the voyage clock with port days as arrival data, the manifest with sore, comp, delighted tables and repeat cruisers, the three local ailments, the comp card and the Manifest tab, three stars with the Crossing's line stubbed as "6 or fewer sore at a turnaround". A bot flag that comps. This is the slice that proves the rule.
2. **The Turndown Service and the Muster Drill (M).** Its room, gag and ailments; the mishap.
3. **The Crossing (M),** in the Grand Occasions frame, once that frame is built.

## Later, if it lands

- **Deliveries and hires only at port.** An item bought at sea stands as a crate where it will go and unpacks at the next port, as land waits for its builders (`ready` on `Land`); a hire boards at the next port; a quitter works their notice until port. The risk is that it is slow. Against that: a leg is 60 seconds at normal speed; sea days are the busiest days, so there is always something to do; anything under $500 comes at once from the purser's stores; rooms can be built at sea and only their equipment waits. Measure it before shipping it.
- **The swell.** Forecast four days ahead, two days long, about one a voyage. The ends of the hull pitch and the middle does not: waiting guests standing at the bow and stern lose patience faster, and a Caretaker can bolt a room down once. It would make "midships" a place, but it is a second rule.
- **Port Day Specials.** A price for port days only, the lever cruise spas really pull, for gap 8.

## Decisions to make

Each has the default this doc assumes.

1. **Where in the campaign.** After The Orchard Estate, and after Gate 44 if both are built: the airport teaches one guest's clock, the ship the whole crowd's memory (default). It could go before the old wing if that is built later.
2. **How long a voyage is.** 30 days, so turnaround is payday (default); 60 days would let the faces repeat more but delays the clean slate.
3. **Comp cost.** The fee waived (default), or a flat $200 voucher.
4. **Does a delighted table add guests?** No, it takes new arrivals' places (default); adding them makes delight a demand lever, which may make good centers snowball.
5. **No Shaman aboard.** Default yes; it trims the third-star content to three techniques.
6. **Stress outbreaks aboard.** Off (default). A spreading condition on a cruise ship reads as the real thing, whatever it is called.

## Risks

- **The rule is invisible.** If the cloud and the "Table 12 sent us" walk-in do not read at default zoom, the manifest is a list nobody opens. The cloud must be big.
- **Comping becomes routine.** If every sore passenger is comped as a reflex, it is a tax, not a decision. The one-comp rule and the lost slot are the guard; the bot run should show comps on a minority.
- **The promenade fills with clouds.** A bad voyage could put 20 sore passengers on the deck. That is the point, but it must look like weather, not clutter.
- **Size.** It is XL: a new scenery, a new lot shape, a voice for the cruise director. Phase 1 is the test, and it reuses the street, the regulars and the arrival hooks.
- **The ports are rush hours renamed.** In phase 1 they only move arrivals and ailments. If the port day does not feel like an event, the deliveries rule under "Later" is what gives it weight, and that is the one to try next.
- **A sore table punishes one early mistake for a month.** Twenty passengers swap at each port and comps cost one slot each, so a bad day 2 can be repaired; the bot should show sore counts falling over a voyage, not climbing.
- **Old saves** are untouched; the center is new.
