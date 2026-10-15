# To do

Work planned for the game itself. Bugs and risks found in the October 2026 audit are in [known-issues.md](known-issues.md), and ideas not yet decided on in [ideas.md](ideas.md).

Tick an item off when it is done, with the commit or release it landed in.

## Next up

- [ ] **More PA announcer lines.** New filler lines for the announcer, recorded and run through the PA speaker effect like the thirteen there are (`yarn announcer`), and recordings for the event lines that have none yet: opening day, staff wanted, seasons, snow, emergencies and stress outbreaks. Listed word for word under [Audio](#audio).
- [x] **Rename the Janitor** to something that fits all they do now (cleaning, repairs, plants, stones, linens and laundry, and sage with the Smudging course). Now the **Caretaker**, which the role was already called in the code, so saved staff carry over; the Janitor of the Year award is now Caretaker of the Year, and saved trophies are renamed with it.
- [ ] **Mishaps, a second pass.** A storm could flood a restroom, out of action until a Caretaker mops it, as [two-point-gaps.md](two-point-gaps.md) suggests. Not done in Phase 9.
- [x] **Show which way an item faces when placing it.** Items with a front and a back, such as desks, benches and the Singing Bowls, get a small teal arrow on the floor at their front while held, so it is clear which way they will face before they go down.
- [ ] **A cheat console.** A console opened with a key, taking commands such as adding money, reputation or karma, earning a star, spawning guests or an emergency, unlocking everything, and skipping ahead in time. For testing and for fun; achievements could be withheld in a game where it has been used.

## Audio

Announcer lines that have no recording yet. A recording plays only when its text matches the banner exactly, punctuation included, so record each line word for word. Put each file in `src/sounds/announcer/` as a kebab-case `.m4a`, run it through the PA speaker effect (`yarn announcer`), and add it to `VOICE_LINES` in `src/voice.ts`. When a line is added or changed in the code, update this list.

- Filler lines, now and then (`ANNOUNCEMENTS` in `src/core/data/text.ts`)
  - [x] Guests are reminded that clothing is mandatory in the hallways.
  - [x] Attention male visitors, please do not completely remove your pants while using the urinal.
  - [x] Welcome, seekers. We remind you that enlightenment is a journey, and our gift shop accepts all major credit cards.
  - [x] A polite reminder: Mercury is no longer in retrograde, so you have absolutely no excuse for your behavior.
- Opening day (`src/core/sim/progress.ts`)
  - [x] The healing center is now open. Please form an orderly line in order of your aura’s color code.
  - [x] More opening lines to alternate with it, recorded as `healing-center-open-2.mp3` and on. Three more: `OPENING_LINES` in `src/core/sim/progress.ts`.
- Staff wanted (`contextAnnouncement` in `src/core/sim/advisor.ts`)
  - [x] Caretaker needed. The corridors are getting gross.
  - [x] Receptionist needed at the Reception Desk.
  - [ ] Receptionist needed at the Shop Counter.
  - [x] Wellness Consultant needed at the Consultation Room.
  - [x] Wellness Consultant needed at the Posture Lab.
  - [x] Massage Therapist needed at the Massage Suite.
  - [x] Acupuncturist needed at the Acupuncture Clinic.
  - [x] Reiki Practitioner needed at the Reiki Studio.
  - [ ] Sound Healer needed at the Sound Bath Studio.
  - [ ] Shaman needed at the Ceremony Lodge.
- The first Sweat Lodge (`SWEAT_LODGE_OPEN` in `src/core/sim/ceremonies.ts`)
  - [x] The sweat shop... I mean, sweat lodge, is now open.
- Seasons, at The Boardwalk (`SEASON_NEWS` in `src/core/sim/twists.ts`)
  - [ ] Winter is here. The promenade is empty, so watch the budget until spring.
  - [ ] Spring! The first day-trippers are back in town.
  - [ ] Summer at last, and the town is packed. Expect a crowd.
  - [ ] Autumn. The visitors are heading home.
- Snow, at High Pines (`SNOW_NEWS` in `src/core/sim/twists.ts`)
  - [ ] Snowed in! The road up the mountain is closed, so nobody new can get here for a day or two.
  - [ ] The snowplow has been through, and the road is open again.
- Emergencies (`EMERGENCY_CAUSES` in `src/core/data/text.ts`)
  - [x] Emergency incoming! A yoga retreat attempted a group pose and it went badly.
  - [x] Emergency incoming! The city fun run turned out to be an unfun run.
  - [x] Emergency incoming! An all-hands meeting ran three hours over with no chairs.
  - [ ] Emergency incoming! A flash mob forgot to warm up.
  - [ ] Emergency incoming! The local choir held one note for far too long.
  - [x] Emergency incoming! A furniture store ran a build-it-yourself weekend.
- Stress outbreaks (`OUTBREAK_CAUSES` in `src/core/data/stakes.ts`)
  - [ ] Stress outbreak! The office block across the road has just had its quarterly review.
  - [ ] Stress outbreak! Exam results are out at the college.
  - [ ] Stress outbreak! A wedding party has arrived, and the seating plan did not go well.
  - [ ] Stress outbreak! The phone network went down for an hour.
  - [ ] Stress outbreak! A yoga retreat let out early and nobody is speaking to each other.
- Visits, as a visitor writes ahead (`VISIT_NEWS` in `src/core/data/visits.ts`)
  - [x] A VIP will be visiting in five days. Look busy.
  - [x] The health inspector is on the way. Hide the sage.
- Standing, as the center rises a grade (`updateStanding` in `src/core/sim/standing.ts`)
  - [ ] We are now a Wellness Studio. Thank you for bringing us your knots.
  - [ ] We are now a Wellness Center. Thank you for bringing us your knots.
  - [ ] We are now a Healing Center. Thank you for bringing us your knots.
  - [ ] We are now a Healing Institute. Thank you for bringing us your knots.
- Mishaps, as each is announced, starts and ends (`MISHAPS` in `src/core/data/mishaps.ts`)
  - [x] The power company will be working on the lines this week. Expect a power cut.
  - [x] The power is out. Anything with a plug is now a very expensive ornament.
  - [ ] The power is back. Please stop meditating by candlelight.
  - [x] A storm is coming in off the sea later this week. Batten down the hatches.
  - [x] The storm has arrived. Please keep away from the windows... and Brent.
  - [x] The storm has passed. The seagulls are back, and so are the guests.
  - [ ] A big freeze is forecast later this week. The pipes are nervous.
  - [ ] The pipes have frozen. Please hold on, in every sense.
  - [ ] The pipes have thawed. Normal flushing is resumed.
  - [ ] It is harvest week in the orchards, and the wasps have noticed.
  - [ ] Wasps have found the snacks. Please walk calmly and do not wave your arms.
  - [ ] The wasps have gone back to the orchards.

## Requested 14 October 2026

- [x] **A reiki picture in the README**, beside the acupuncture one.
- [x] **Clicking a message takes you to what it is about.** A toast or advisor line about a member of staff (asking for a raise, quitting, finishing a course) selects them and moves the camera to them. One about an item (broken down, out of stones) opens that item's inspector. One about a room opens the room.
- [x] **"Cupping massage" in a popup.** Acupuncture techniques were called massage in the emergency offer. Fixed in v0.5.0 (`6f57783`); every place that names a treatment now goes through `modalityLabel`.
- [x] **A morale bar in the Staff menu**, next to energy, for everyone at once. The inspector already had one.
- [x] **A stronger warning before someone quits.** When a member of staff is a day or two from walking out, an alarm toast, a line from the advisor, and a marker over their head until it is dealt with.
- [x] **Guests put off by prices.** Count the guests who turn down a treatment because of its price, and show it in the Money menu next to the price controls.
- [x] **A Stats view you can arrange.** More figures than the Money menu shows today (arrivals, healed, failed, stormed out, put off by prices, waiting times, income by treatment), each as a small chart, with a choice of which to show, remembered between games.
- [x] **Filter the Items menu by room and type**, so the list for a room shows only what goes in it, and decor, comforts and equipment can be picked out.
- [x] **An emergency offer that can be put aside.** Dismissing the popup tucks it into a small button that shows the time left to decide; pressing it brings the offer back to accept or decline.
- [x] **More than one sandbox.** A campaign of centers in different places, each with its own map, goals and twist, as Two Point Hospital does with its hospitals, alongside a free sandbox with its own settings. Designed in [campaign.md](campaign.md). All four phases are done: Willow Lane, The Exchange and The Boardwalk, karma and achievements, and sandbox settings.
- [x] **High Pines and The Orchard Estate**, the fourth and fifth centers, as planned in [campaign.md](campaign.md). Both done.
- [x] **Resize a built room**, by dragging its walls, as Two Point Hospital's room editing allows. Done: Resize in the room's inspector; the door and windows move with their walls, the furniture has to stay inside, the room keeps its minimum size, and floor added costs $200 a tile, with half back for floor given up.
- [x] **Room walls against the building's outer walls.** The outer wall's own window panes sit at fixed spots, so a room built against it cuts through them, and the room's windows sit inside the outer wall and look doubled. The outer wall should leave its panes out where a room's wall runs along it, and a room's windows on that side should be set into the outer wall instead of a second wall in front of it. Done: a room's side along the outer wall uses that wall, its windows are set into it, and the building's own windows make way.

## Requested 15 October 2026

- [x] **Remove the fire drill mishap.** Each center gets only its own mishap now, and Willow Lane has none.
- [x] **Rename Saltmarsh** to something more fitting. Now **The Boardwalk**, in the code too (`boardwalk`); no saves used it yet.
- [x] **"Thank you for your custom"** in the grade announcements was British English. Now "Thank you for bringing us your knots."
- [x] **Assign staff to rooms.** Select a member of staff, press Assign to rooms, and click one or more rooms; they then take posts and do their chores only there, as Two Point Hospital allows. Done: the rooms are colored while assigning, the room's inspector lists who is assigned there, Anywhere undoes it, and a Receptionist, whose desk and counter are in the corridors, has no rooms to be assigned to.
- [x] **Announce visits over the speakers.** A VIP or the health inspector writing ahead is announced, with a recorded line, as well as the message.
- [x] **Pay off the health inspector.** A fast follow to the next release: when the inspector finds violations that would hurt the business, offer to make them go away for a relatively large sum. Pairs with the mushrooms under the shop counter, which the inspector can fine you for. Done, unreleased: a failed report offers to pay the fine or make it go away for twice as much (at least $10,000), and one time in ten word gets out. Closing it without choosing pays the fine the next day.
- [ ] **A really bad trip, now and then.** A tiny chance that a bad trip sends the guest running round the institute like a crazy person, freaking out the guests they pass (a bad feeling, a little lost patience, maybe a stress outbreak) until a member of staff calms them or they find the door. For after the Shaman's stages are done.

## Roadmap

The phases in [roadmap.md](roadmap.md), from the gaps in [two-point-gaps.md](two-point-gaps.md). Its decisions to make are still open.

- [x] **Phase 1, taking charge:** policy, chances shown, send home, a queue you can manage, room priority. Two Point's fast-track switch has nothing to do here, since guests already go straight to treatment once diagnosed, so it became calling emergencies first.
- [x] **Phase 2, goals along the way:** staff objectives and year-end awards. Challenges pay money and morale rather than karma: karma is earned once per star and achievement, and a repeatable reward would let a replay farm it.
- [x] **Phase 3, staff careers:** experience and promotions, general qualifications, job assignment, a hiring pool that grows, traits you can see.
- [x] **Phase 4, reading the center:** guest feelings, reviews and reputation in parts, the casebook, overlays. The casebook went in the Stats menu, which now has tabs, rather than the Treatments menu.
- [x] **Phase 5, the business side:** prices per treatment, a retail counter, marketing, house calls.
- [x] **Phase 6, stakes:** a worsening condition, bad vibes cleared with sage, stress outbreaks. Treatment calms a stressed guest as well as a calming session does, and the calming sessions are handed out by clicking, with no one sent to give them.
- [x] **Phase 7, comfort:** calm, fresh linens, temperature and staff needs. Noise and warmth carry like decor does, held back by the walls of each room they pass through. Changing linens is part of a Caretaker's cleaning, and needs a Linen Hamper to take fresh ones from. Staff thirst and hunger only, no toilets: they are seen to between jobs from the guests' own drinks and snacks. Sandbox switches for stress outbreaks (missed in phase 6) and the weather. High Pines comes next.
- [x] **Phase 8, visitors and rivals:** VIPs and the inspector, the center's standing, a rival center. Then The Orchard Estate. VIPs and the inspector are done: the inspector visits every center, not only The Orchard Estate, with a notice five days ahead; VIPs from the first star. The standing and the rival are done: five grades on points for rooms, prestige and staff, kept once reached; ZenMart opens on day 45 at every center, with sales, job offers to staff below 35 morale, and Center of the Year. The Orchard Estate is done too.
- [x] **Phase 9, events:** a mishap per center. Every 80 to 140 days from day 75, announced three days ahead: a power cut at The Exchange and in the sandbox, a storm at The Boardwalk, a big freeze at High Pines (winter only), and wasps at The Orchard Estate; Willow Lane has none. A fire drill anywhere was built, then taken out at Max's request. Each has a price to prepare for it, paid from the notice at the top of the screen. A power cut dims the lights and a storm brings rain. The storm breaks equipment rather than flooding the restrooms as [two-point-gaps.md](two-point-gaps.md) suggested; that is under Next up.
- [x] **Phase 10, building tools:** move and copy rooms, templates, and decorating rooms. Moving is free, and a copy or a room from a template costs what building it would. Templates are kept for every game and export to a file. Decorating is for looks alone, with three floors and three walls free and nine more for karma. Camera rotation and more land moved to Phase 12.
- [ ] **Phase 11, the long game:** machine upgrades, new rooms, regulars, treatment gags, a radio, game settings. Machine upgrades are done: three levels for each piece of treatment equipment, installed by a Caretaker with the Mechanics course. The Recovery Lounge and the Qi Gong Studio are done too. To record: "Qi Gong is starting in the studio. Please move slowly, and with intention." and "Qi Gong Instructor needed at the Qi Gong Studio." for the announcer.
- [ ] **Phase 12, more building:** camera rotation and more land, put off from Phase 10.
- [ ] **Difficulty settings.** Presets for a new game (Relaxed, Standard, Demanding) alongside finer settings, the way Two Point's sandbox has them: how many applicants turn up and how often, how often guests arrive and how patient they are, how quickly equipment wears and staff tire, salaries and prices, loan limits, emergency and challenge frequency, and how fast the award bars rise. A preset fills the settings in, and any can then be changed. For the sandbox first, then perhaps per campaign center.
- [ ] **Way down the line:** a server for community research and other players' institutes as rivals and VIPs.
