# Roadmap: after the Two Point audit

The order to build the gaps in [two-point-gaps.md](two-point-gaps.md) and their themed versions, as releases that each ship on their own. Numbers in brackets are the gaps in that doc. The open decisions, each with a default, are at the end.

Two rules hold for every phase:

- **Saves.** Each phase that adds to the game state bumps `SAVE_VERSION` and fills the new fields in `upgradeSave`, so older games load and older versions refuse newer saves.
- **Settings and sandbox.** Each new event or pressure gets a sandbox switch as it lands (32), so the sandbox grows with the game rather than in one go at the end.

## Phase 1: Taking charge

Guests stop being something that happens to the player and become something to manage.

- **Policy** [3]: a Policy menu with the diagnosis threshold, until now the constant `DIAGNOSIS_TARGET` (75%), and a switch to call emergency guests first (Two Point's fast-track switch has nothing to do here, since guests already go straight to treatment once diagnosed). A **break policy**: how many of each role may be on a break at once, and the energy at which they go (today hard-coded at 18 in `staffing.ts` and `stations.ts`).
- **Chances shown** [4]: the chance of success, today worked out inline in `stations.ts`, moved into a pure `successChance` function and shown in the guest's inspector before treatment, with the reason when it is low (unqualified, missing equipment, tired).
- **Send home** [2]: a button in the guest's inspector. The guest leaves without paying for treatment; reputation takes a small knock, smaller than a failed treatment.
- **A queue you can manage** [2]: a station's queue in its inspector, with each guest's patience and chance of success, to move a guest up or down or to another station of the same kind.
- **Room priority** [10]: a High priority switch on a room, so staff fill it first.

Done when every one has unit tests, the queue is covered end to end, and the tutorial mentions the queue.

## Phase 2: Goals along the way

Something to aim for between stars, built on the objectives that already exist.

- **Staff objectives** [27]: now and then a member of staff sets the center an objective with 90 to 180 days to meet it: heal so many guests, earn so much, reach a decor level, go so long without anyone quitting. Each is a `GoalSpec` with a deadline. Met, it pays money and staff morale (not karma, which is earned once per star and achievement, where a repeatable reward could be farmed by replaying). One at a time, shown under the star objectives.
- **Year-end awards** [14]: at the end of each game year, a ceremony dialog with eight awards, some for the center (best results, best value, cleanest) and some for staff (therapist of the year, caretaker of the year), each judged on the year's monthly records and won or lost against a bar that rises each year. Prizes are money and reputation, and a member of staff who wins one is delighted. Trophies won go on display in the Trophy Cabinet and under Awards in the Stats menu. (Built with healing record, busiest, shortest wait, fair prices, the books and the happiest team for the center, since cleanliness is not recorded month by month.)

## Phase 3: Staff careers

The staff side's long game.

- **Experience and promotions** [8]: staff earn experience from the guests they serve and the jobs they do, through five ranks, which take the place of today's skill stars. At each promotion they ask for a raise, which they insist on; putting it off lowers morale. Each promotion opens a qualification slot, up to five, to be filled by training before the next promotion. The skill course goes; treatment courses fill slots.
- **General qualifications** [9]: Bedside Manner (guests lose patience more slowly with them), Motivation (works faster), Stamina (tires more slowly) for anyone; Customer Service for receptionists; Maintenance for caretakers (faster repairs). Each is a multiplier the sim already applies.
- **Job assignment** [10]: in the staff inspector, switches for which stations a member of staff works and, for caretakers, which jobs (litter, plants, cleaning, repairs, stones).
- **A hiring pool that grows** [13]: more applicants per role as stars are earned, a new one every so often instead of all at once each month, and reject to free a slot.
- **Traits you can see** [12]: four or five new traits with visible behavior, good and bad (a litterbug, a grump who upsets guests, a cheerful one who lifts the room, a quick learner, a green thumb who waters plants in passing).

## Phase 4: Reading the center

Making what the sim already knows visible, so the player can tell what is wrong.

- **Guest feelings** [5]: each guest keeps a short list of what pleased and annoyed them (long wait, thirsty, filthy toilet, lovely room, unqualified therapist), shown in their inspector.
- **Guest reviews and reputation in parts** [35, 28]: a guest leaving rates the visit and writes a line from their strongest feelings. Reputation is split into results, experience, value, staff and word of mouth, each with a bar and its latest reviews, in a Reputation panel. The total works as it does today, so goals are unchanged.
- **The casebook** [26]: for each condition, how many came, were healed, failed and stormed out, and its cure rate, in the Treatments menu.
- **Overlays** [18]: a button that colors the floor by decor (from `ctx.attract`), then guest patience, needs, and equipment wear and dirt. Calm and temperature join later.

## Phase 5: The business side

New money levers, and new ways to earn.

- **Prices per treatment** [25]: each technique's own price, alongside the overall level, in the Money menu, with how many turned it down.
- **A retail counter** [36]: a Shop Counter in the lobby, run by a receptionist, selling books, crystals, oils and candles to guests on their way out. A healed guest who had a good visit buys more. Its own line in the books.
- **Marketing** [23]: campaigns bought for a month or more: one for word of mouth (reputation), one per condition (more guests with it, using the centers' existing condition weights), and one for applicants. No new room or qualification at first.
- **House calls** [37]: an offer, like an emergency's, to send a therapist out for a day or two for a fee. They are away and their station stands empty. The Exchange offers them most.

## Phase 6: Stakes

The biggest change to how the game feels, once the player has phases 1 to 4 to respond with.

- **A worsening condition** [1]: each guest has a condition bar that falls over the visit, faster for some conditions. It lowers the chance of success; at zero the guest leaves worse off, with a big reputation hit and a bad review. No deaths.
- **Bad vibes** [42]: a failed treatment leaves a cloud in its room that lowers results and unsettles anyone in it, until a Reiki Practitioner, or a caretaker with a new Smudging course, clears it. Whoever clears it walks the room holding a smoking bundle of sage, wafting it around.
- **A stress outbreak** [7]: offered like an emergency. Stress spreads among guests waiting close together; the player has a few calming sessions to hand out to carriers, spotted by their symptoms, before too many leave.

## Phase 7: Comfort

The building itself matters more.

- **Calm** [39]: items and crowds make noise, spreading like decor does; noise near a treatment room lowers its results and guests' experience. Treatment rooms keep out some noise; windows and doors let more in. A Calm overlay.
- **Fresh linens** [38]: each treatment table gets dirtier linens with use; a hamper fills; a caretaker launders them. Stale linens upset guests and lower results. Builds on today's dirt.
- **Temperature** [17]: radiators and air conditioners, each center's climate (cold at High Pines, hot The Boardwalk summers), and guests and staff who mind. A Temperature overlay. Staff needs (11) come in here, since heat makes people thirsty.

**High Pines** opens after this phase, with snow, cold and Hot Stone in demand.

## Phase 8: Visitors and rivals

The outside world takes an interest.

- **VIPs and the inspector** [6]: a VIP writes ahead, tours a few rooms, and leaves a reward or a fine. The inspector visits every center now and then and looks for, among other things, a Fire Extinguisher.
- **The center's standing** [43]: a grade from rooms, staff and prestige, from Back-Room Practice to Healing Institute, which raises arrivals and applicants and what guests expect.
- **A rival center** [40]: a healing-center franchise across the street, shown as a storefront in the scenery and a panel. It undercuts on price from time to time, tries to poach staff whose morale is low, and competes at the year-end awards.

**The Orchard Estate** opens after this phase, with its picky guests and the inspector.

## Phase 9: Events

- **Mishaps** [41]: one per center, using the twist hooks: a power cut at The Exchange, a storm at The Boardwalk, a freeze at High Pines, and a fire drill anywhere. Each warns first, can be prepared for, and has a sandbox switch. Done: wasps at The Orchard Estate too, and the sandbox has the power cut. The fire drill was dropped, so Willow Lane has no mishap.

## Phase 10: Building tools

- **Move and copy rooms** [16]: pick up a built room with its furniture and set it down elsewhere, rotated if wanted; copy a room. Then **templates**, saved and exported to a file. Moving and copying are done: moving is free, a copy costs what building it would.
- **Decorating rooms** [20]: wall and floor patterns per room, or per room type, with more patterns bought with karma.
- **Camera rotation** [19]: turn in steps, with the walls facing the camera cut away.
- **More land** [15]: buy an adjoining plot to grow the building. The largest piece of work here.

## Phase 11: The long game

- **Machine upgrades** [24]: each treatment machine upgraded to be more reliable and effective, paid for and fitted by a caretaker with a Mechanics course. Research [24] can come later, if upgrades alone feel thin.
- **New rooms** [30, 44]: a Recovery Lounge (some treatments leave guests needing a rest), a Qi Gong Studio with group classes on a weekly calendar, and a second diagnosis room.
- **Regulars** [44]: guests who come back, greeted by name, and grow loyal.
- **Treatment gags** [31], **a radio** [34] and **game settings** [33] (key rebinding, edge scrolling, autosave interval), fitted in where there is room.

## Way down the line: a server

Only if the game grows to need it, since everything above works offline.

- **Community research** [45]: goals every player works toward together, unlocking items for everyone.
- **Other players' institutes** [45]: real players' centers in place of the made-up rival center, compared at the year-end awards, and their owners visiting as VIPs who judge by what their own center is good at.

No Steam Workshop.

## Decisions to make

Each has the default that the phases above assume.

1. **The order.** Phases in the order above, one release each, with High Pines after phase 7 and The Orchard Estate after phase 8.
2. **No deaths.** A worsened guest leaves worse off with a bad review, never dies.
3. **Ranks replace skill stars.** Existing staff keep their skill as their rank, and the skill course goes.
4. **Reputation stays one number for goals.** The parts explain it but goals and arrivals still use the total.
5. **Marketing needs no room.** Campaigns are bought from the Money menu. A Marketing room, as Two Point has, can come later.
6. **The retail counter is staffed by a receptionist.** Not a new role.
7. **Bad vibes can be cleared without reiki.** A caretaker with a Smudging course can do it, so Willow Lane is not stuck.
8. **The rival center is offscreen.** A storefront in the scenery and a panel, not a second simulated building.
