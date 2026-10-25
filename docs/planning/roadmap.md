# Roadmap: after the Two Point audit

The order to build the gaps in [audits/two-point-gaps.md](../audits/two-point-gaps.md) and their themed versions, as releases that each ship on their own. Numbers in brackets are the gaps in that doc. The open decisions, each with a default, are at the end.

Two rules hold for every phase:

- **Saves.** Each phase that adds to the game state bumps `SAVE_VERSION` and fills the new fields in `upgradeSave`, so older games load and older versions refuse newer saves.
- **Settings and sandbox.** Each new event or pressure gets a sandbox switch as it lands (32), so the sandbox grows with the game rather than in one go at the end.

## Phase 1: Taking charge

Guests stop being something that happens to the player and become something to manage.

- **Policy** [3]: a Policy menu with the diagnosis threshold, until now the constant `DIAGNOSIS_TARGET` (75%), and a switch to call emergency guests first (Two Point's fast-track switch has nothing to do here, since guests already go straight to treatment once diagnosed). A **break policy**: how many of each role may be on a break at once, and the energy at which they go (today hard-coded at 18 in `staffing.ts` and `stations.ts`). Done in 0.8.0.
- **Chances shown** [4]: the chance of success, today worked out inline in `stations.ts`, moved into a pure `successChance` function and shown in the guest's inspector before treatment, with the reason when it is low (unqualified, missing equipment, tired). Done in 0.8.0, and shown in a station's line too.
- **Send home** [2]: a button in the guest's inspector. The guest leaves without paying for treatment; reputation takes a small knock, smaller than a failed treatment. Done in 0.8.0, from the guest's inspector or the line.
- **A queue you can manage** [2]: a station's queue in its inspector, with each guest's patience and chance of success, to move a guest up or down or to another station of the same kind. Done in 0.8.0: the other station is the one with the shortest line.
- **Room priority** [10]: a High priority switch on a room, so staff fill it first. Done in 0.8.0, and Caretakers see to it first too.

Done when every one has unit tests, the queue is covered end to end, and the tutorial mentions the queue.

## Phase 2: Goals along the way

Something to aim for between stars, built on the objectives that already exist.

- **Staff objectives** [27]: now and then a member of staff sets the center an objective with 90 to 180 days to meet it: heal so many guests, earn so much, reach a decor level, go so long without anyone quitting. Each is a `GoalSpec` with a deadline. Met, it pays money and staff morale (not karma, which is earned once per star and achievement, where a repeatable reward could be farmed by replaying). One at a time, shown under the star objectives. Done in 0.9.0, as staff challenges of two to four months.
- **Year-end awards** [14]: at the end of each game year, a ceremony dialog with eight awards, some for the center (best results, best value, cleanest) and some for staff (therapist of the year, caretaker of the year), each judged on the year's monthly records and won or lost against a bar that rises each year. Prizes are money and reputation, and a member of staff who wins one is delighted. Trophies won go on display in the Trophy Cabinet and under Awards in the Stats menu. (Built with healing record, busiest, shortest wait, fair prices, the books and the happiest team for the center, since cleanliness is not recorded month by month.) Done in 0.9.0; certificates to hang for each award won came in 0.28.2.

## Phase 3: Staff careers

The staff side's long game.

- **Experience and promotions** [8]: staff earn experience from the guests they serve and the jobs they do, through five ranks, which take the place of today's skill stars. At each promotion they ask for a raise, which they insist on; putting it off lowers morale. Each promotion opens a qualification slot, up to five, to be filled by training before the next promotion. The skill course goes; treatment courses fill slots. Done in 0.10.0.
- **General qualifications** [9]: Bedside Manner (guests lose patience more slowly with them), Motivation (works faster), Stamina (tires more slowly) for anyone; Customer Service for receptionists; Maintenance for caretakers (faster repairs). Each is a multiplier the sim already applies. Done in 0.10.0. Mechanics (0.21.0) and Smudging (0.13.0) came later.
- **Job assignment** [10]: in the staff inspector, switches for which stations a member of staff works and, for caretakers, which jobs (litter, plants, cleaning, repairs, stones). Done in 0.10.0, as Duties. Assigning staff to rooms followed in 0.15.0.
- **A hiring pool that grows** [13]: more applicants per role as stars are earned, a new one every so often instead of all at once each month, and reject to free a slot. Done in 0.10.0: up to six per role.
- **Traits you can see** [12]: four or five new traits with visible behavior, good and bad (a litterbug, a grump who upsets guests, a cheerful one who lifts the room, a quick learner, a green thumb who waters plants in passing). Done in 0.10.0: Litterbug, Grump, Ray of Sunshine, Quick Study and Green Thumb.

## Phase 4: Reading the center

Making what the sim already knows visible, so the player can tell what is wrong.

- **Guest feelings** [5]: each guest keeps a short list of what pleased and annoyed them (long wait, thirsty, filthy toilet, lovely room, unqualified therapist), shown in their inspector. Done in 0.11.0.
- **Guest reviews and reputation in parts** [35, 28]: a guest leaving rates the visit and writes a line from their strongest feelings. Reputation is split into results, experience, value, staff and word of mouth, each with a bar and its latest reviews, in a Reputation panel. The total works as it does today, so goals are unchanged. Done in 0.11.0, in the Stats menu's Reputation tab.
- **The casebook** [26]: for each condition, how many came, were healed, failed and stormed out, and its cure rate, in the Treatments menu. Done in 0.11.0, as a tab in the Stats menu instead.
- **Overlays** [18]: a button that colors the floor by decor (from `ctx.attract`), then guest patience, needs, and equipment wear and dirt. Calm and temperature join later. Done in 0.11.0, with staff energy as well; Calm and Temperature came in 0.13.0, and Condition in 0.31.0.

## Phase 5: The business side

New money levers, and new ways to earn.

- **Prices per treatment** [25]: each technique's own price, alongside the overall level, in the Money menu, with how many turned it down. Done in 0.12.0.
- **A retail counter** [36]: a Shop Counter in the lobby, run by a receptionist, selling books, crystals, oils and candles to guests on their way out. A healed guest who had a good visit buys more. Its own line in the books. Done in 0.12.0.
- **Marketing** [23]: campaigns bought for a month or more: one for word of mouth (reputation), one per condition (more guests with it, using the centers' existing condition weights), and one for applicants. No new room or qualification at first. Done in 0.12.0, for one to three months.
- **House calls** [37]: an offer, like an emergency's, to send a therapist out for a day or two for a fee. They are away and their station stands empty. The Exchange offers them most. Done in 0.12.0.

## Phase 6: Stakes

The biggest change to how the game feels, once the player has phases 1 to 4 to respond with.

- **A worsening condition** [1]: each guest has a condition bar that falls over the visit, faster for some conditions. It lowers the chance of success; at zero the guest leaves worse off, with a big reputation hit and a bad review. No deaths. Done in 0.13.0. In 0.31.0 a line warns twice before a guest in it goes home worse off, and a Condition overlay shows it.
- **Bad vibes** [42]: a failed treatment leaves a cloud in its room that lowers results and unsettles anyone in it, until a Reiki Practitioner, or a caretaker with a new Smudging course, clears it. Whoever clears it walks the room holding a smoking bundle of sage, wafting it around. Done in 0.13.0. A Shaman clears it twice as fast, from 0.23.0.
- **A stress outbreak** [7]: offered like an emergency. Stress spreads among guests waiting close together; the player has a few calming sessions to hand out to carriers, spotted by their symptoms, before too many leave. Done in 0.13.0, from the second star.

## Phase 7: Comfort

The building itself matters more.

- **Calm** [39]: items and crowds make noise, spreading like decor does; noise near a treatment room lowers its results and guests' experience. Treatment rooms keep out some noise; windows and doors let more in. A Calm overlay. Done in 0.13.0.
- **Fresh linens** [38]: each treatment table gets dirtier linens with use; a hamper fills; a caretaker launders them. Stale linens upset guests and lower results. Builds on today's dirt. Done in 0.13.0, with a Linen Hamper.
- **Temperature** [17]: radiators and air conditioners, each center's climate (cold at High Pines, hot The Boardwalk summers), and guests and staff who mind. A Temperature overlay. Staff needs (11) come in here, since heat makes people thirsty. Done in 0.13.0: staff thirst and hunger, no toilets. Thermostats came in 0.28.5.

**High Pines** opens after this phase, with snow, cold and Hot Stone in demand. Done in 0.14.0.

## Phase 8: Visitors and rivals

The outside world takes an interest.

- **VIPs and the inspector** [6]: a VIP writes ahead, tours a few rooms, and leaves a reward or a fine. The inspector visits every center now and then and looks for, among other things, a Fire Extinguisher. Done in 0.15.0, VIPs from the first star.
- **The center's standing** [43]: a grade from rooms, staff and prestige, from Back-Room Practice to Healing Institute, which raises arrivals and applicants and what guests expect. Done in 0.16.0: five grades, kept once reached.
- **A rival center** [40]: a healing-center franchise across the street, shown as a storefront in the scenery and a panel. It undercuts on price from time to time, tries to poach staff whose morale is low, and competes at the year-end awards. Done in 0.16.0, as ZenMart, with Center of the Year.

**The Orchard Estate** opens after this phase, with its picky guests and the inspector. Done in 0.16.0.

## Phase 9: Events

- **Mishaps** [41]: one per center, using the twist hooks: a power cut at The Exchange, a storm at The Boardwalk, a freeze at High Pines, and a fire drill anywhere. Each warns first, can be prepared for, and has a sandbox switch. Done in 0.17.0: wasps at The Orchard Estate too, and the sandbox has the power cut. The fire drill was dropped, so Willow Lane has no mishap. From 0.32.0 the storm also floods a restroom.

## Phase 10: Building tools

- **Move and copy rooms** [16]: pick up a built room with its furniture and set it down elsewhere, rotated if wanted; copy a room. Then **templates**, saved and exported to a file. All done, moving and copying in 0.18.0 and templates in 0.20.0: moving is free, a copy or a room from a template costs what building it would, and templates are kept for every game, with export and import.
- **Decorating rooms** [20]: wall and floor patterns per room, or per room type, with more patterns bought with karma. Done in 0.20.0: three floors and three walls free, nine more for 13 karma in all, and purely for looks.

Camera rotation and more land were put off to Phase 12, on 15 October 2026.

## Sound Healing

A fourth discipline, decided on 15 October 2026, built alongside Phase 10. Done in 0.19.0, as below.

- **A Sound Bath Studio and a Sound Healer,** opening at High Pines at its first star there, and from the start at The Orchard Estate.
- **Group sessions:** guests lie on mats while one healer plays for them all, so one healer serves several guests at once. The same machinery serves the Qi Gong Studio's classes later.
- **Five techniques:** Singing Bowls (moved from reiki, where it was the Sound Bath), Tuning Forks, Gong Bath, Crystal Bowls and Overtone Chanting. Reiki gets **Distance Reiki** in its place.
- **Noise both ways:** a gong carries to the rooms nearby, and a sound bath goes badly beside the arcade.

## The Shaman

A fifth discipline, wanted on 15 October 2026, planned the same day and built in stages. The first stage is done, in 0.23.0: the Ceremony Lodge and the Shaman, open at The Orchard Estate from the start and in the sandbox from the second star; five techniques (Spirit Animal Reading, Spiritual Extraction, Sweat Lodge, and the Mushroom and Ayahuasca Ceremonies, the last at the third star); set and setting, which count the lodge twice for the two ceremonies, and bad trips; and eight ailments, among them guests possessed by a chicken, a goat and Brent. The second stage is done too, in 0.23.0: the sweat shop announcement, voiced, once a game when the first Sweat Lodge opens; the Shaman clearing bad vibes twice as fast as sage and blessing the room for a week (4% more treatments work there); and soul retrieval, which sends a Shaman to anyone with morale below half to lift it by 40. The third stage is done as well, in 0.24.0: mushrooms sold under the Shop Counter while a Shaman supplies them, put away by a Policy when the health inspector writes ahead, and a big fine if the inspector finds them; paying the inspector off, for twice the fine, with a one-in-ten chance that word gets out; and a ward against a mishap, asked for from its notice, which holds three times in four. The vision quest is done too, with regulars, in 0.25.0: a sixth technique at the third star, and anyone it heals comes back as a loyal regular. Chosen at the start:

- **Psychedelic ceremonies:** mushrooms and ayahuasca, with animations to match, and set and setting: a noisy, dirty or gloomy room risks a bad trip.
- **Spiritual Extraction,** an exorcism, with a funny animation.
- **A sweat lodge,** announced over the speakers as a sweat shop before the announcer corrects herself.
- **Clearing bad vibes,** better than sage does.
- **Other ideas liked:** soul retrieval for burnt-out staff, spirit animal readings, blessing a room, a vision quest that brings a guest back as a regular, a ceremony to ward off a mishap, and integration in the Recovery Lounge after a ceremony.
- **Not wanted:** a cacao ceremony or a drum journey, and no Lion's Mane tea.
- **The gift shop sells psychedelic mushrooms** on the quiet, the shop counter doing a little business under the counter.

## Next, in order

Max's order, from 15 October 2026, once the Shaman's third stage is done:

1. **Game settings** [33]: key rebinding, edge scrolling and the autosave interval. Done in 0.24.0: a Controls section in Settings, kept for every game on the computer. Keys are kept by where they sit on the keyboard, a key already in use swaps over, and Esc and the arrows are fixed. Edge scrolling is off to begin with. Autosave every 12 seconds, minute or 5 minutes, or only on leaving.
2. **More land** [15]: buying the next plot over to grow the building. Done in 0.25.0: a Land tab in the Money menu from the first star, with plots up to four tiles deep to the west, the east and the back, at $250 a tile, outlined on the ground with For Sale signs. The building stays a rectangle and the map stays the same size, so each center grows to near the edge of its lot; the sandbox, already the biggest, has the least room left. The save version went up to 23, since an older version would not know the building had grown. In 0.27.0 it was done again the Two Point way, as planned in [plans/land.md](../plans/land.md): plots designed for each center, bought from the world with the Expand tool, a few days' building work behind a fence, lots as wide as each center needs, and some plots standing apart as buildings of their own, with a door and a path from the pavement. Land bought as strips keeps its shape.
3. **Difficulty presets:** Relaxed, Standard and Demanding. Done in 0.25.0, after regulars, for the sandbox: eleven settings, each easier, usual or harder, which scale numbers the game already has (guest arrivals and patience, applicants, wear, tiredness, salaries, fees, the loan limit, trouble, emergencies and challenges, and reputation gains). A preset sets them all, and any can then be changed on its own. As usual, a setting scales by exactly 1, so the campaign and seeded tests play as before. Per campaign center, and changing it in a game under way, are in the todo list.
4. **Regulars** [44]: guests who come back, greeted by name, and grow loyal. The Shaman's vision quest waits on them. Done in 0.25.0, before the difficulty presets: one in three guests who give four stars or more becomes a regular, up to twelve, and comes back every 12 to 24 days, looking the same. Loyalty rises with good visits and falls with bad ones; loyal regulars are more patient, back sooner, never balk at prices and tip 10%, 20% once devoted, and at no loyalty left they stop coming. Who becomes a regular, and when they are due, is settled by their id rather than the random numbers, so seeded runs are unchanged. The Vision Quest heals a new ailment, Lost Their Way, and makes a loyal regular of anyone it heals. The save version went up to 24.

## Phase 11: The long game

- **Machine upgrades** [24]: each treatment machine upgraded to be more reliable and effective, paid for and fitted by a caretaker with a Mechanics course. Research [24] can come later, if upgrades alone feel thin. Done in 0.21.0: three levels for each treatment table, mat and the Posture Scanner, one opening with each star, installed by a Caretaker with the Mechanics course. Each level slows wear and adds 3% to the chance a treatment works.
- **New rooms** [30, 44]: a Recovery Lounge (some treatments leave guests needing a rest), a Qi Gong Studio with group classes on a weekly calendar, and a second diagnosis room. The Recovery Lounge is done, in 0.21.0: no staff, open at the first star, with a Recliner for each guest resting at once. Six of the harder treatments need a rest after, and work 10% less often without a free Recliner. The Qi Gong Studio is done too, in 0.22.0: a Qi Gong Instructor leads classes on the days its timetable sets, for class-goers who come in just for them and book two days ahead. Since a day is only six seconds, a class starts on its day once the Instructor is in and someone is on a spot, and lasts ten seconds, rather than taking up a whole day. Class-goers skip Reception, as the walk in takes about two days. The speakers call a class at most once every two weeks (`CLASS_CALL_GAP`), not on every class day, with two lines taking turns. Six machine rooms followed in 0.31.0, one at each campaign center and the Carousel of Rebirth for karma. A second diagnosis room is still to come.
- **Regulars** [44]: guests who come back, greeted by name, and grow loyal. Done (see Next, in order).
- **Treatment gags** [31] and **a radio** [34], fitted in where there is room. **Game settings** [33] are done (see Next, in order). The treatment machines have gags of their own, from 0.31.0. Still open: a radio, and gags for the other techniques, which have only their own way of moving and a few props.

## Phase 12: More building

The two building tools put off from Phase 10.

- **Camera rotation** [19]: turn in steps, with the walls facing the camera cut away. Done in 0.26.0: Q and E, or the 🔄 button, turn a quarter at a time. Which walls stand tall is worked out from the turn, for the rooms, the building's shell and its windows, and looking from the south-east the building is drawn exactly as before.
- **More land** [15]: buy an adjoining plot to grow the building. Done, and done again the Two Point way in 0.27.0 (see Next, in order).

## Way down the line: a server

Only if the game grows to need it, since everything above works offline.

- **Community research** [45]: goals every player works toward together, unlocking items for everyone.
- **Other players' institutes** [45]: real players' centers in place of the made-up rival center, compared at the year-end awards, and their owners visiting as VIPs who judge by what their own center is good at.

No Steam Workshop.

## Decisions to make

Each has the default that the phases above assume.

1. **The order.** Phases in the order above, one release each, with High Pines after phase 7 and The Orchard Estate after phase 8. Taken, though phases 6 and 7 shared 0.13.0, and phases 8 and 10 took two releases each.
2. **No deaths.** A worsened guest leaves worse off with a bad review, never dies. Taken, in 0.13.0.
3. **Ranks replace skill stars.** Existing staff keep their skill as their rank, and the skill course goes. Taken, in 0.10.0.
4. **Reputation stays one number for goals.** The parts explain it but goals and arrivals still use the total. Taken, in 0.11.0.
5. **Marketing needs no room.** Campaigns are bought from the Money menu. A Marketing room, as Two Point has, can come later. Taken, in 0.12.0.
6. **The retail counter is staffed by a receptionist.** Not a new role. Taken, in 0.12.0.
7. **Bad vibes can be cleared without reiki.** A caretaker with a Smudging course can do it, so Willow Lane is not stuck. Taken, in 0.13.0.
8. **The rival center is offscreen.** A storefront in the scenery and a panel, not a second simulated building. Taken, in 0.16.0.
