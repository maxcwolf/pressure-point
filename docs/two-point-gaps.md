# What Two Point has that we don't

An audit, 14 October 2026, of the systems and features in the Two Point games (mostly Two Point Hospital, with Campus and Museum where they add something) that Pressure Point Institute lacks. More scenarios are left out on purpose.

Each gap says what Two Point does, what we have, and how big a job it looks, with a source. The sources are mostly the [Two Point Hospital wiki](https://two-point-hospital.fandom.com/) (abbreviated _wiki_ below; links are to its pages), Steam discussions and patch notes, checked on 14 October 2026. Anything a source could not confirm is marked _unverified_. The recommended order is at the end.

## What we already match

So the gaps below are read in proportion: we have rooms built by dragging, doors and windows, room resizing, furniture placed and moved, decor and room prestige, a diagnosis step that can need repeating, treatments that need qualified staff and equipment, staff energy and a staff room, morale, raise requests and quitting, traits, training courses, janitors for litter, plants, cleaning and repairs, equipment that wears out and breaks, guest thirst, hunger, bladder and boredom, vending and games that earn money, emergencies, loans, a global price level, monthly books and a stats view, star goals per center, twists per center, karma and achievements, a sandbox with settings, a PA announcer, and saves.

## Guests

**1. A condition that gets worse.** In Two Point Hospital every patient's health drains from the moment they arrive, faster for some illnesses and where hygiene is poor. At zero, or from a failed treatment, they die, and half the time leave a ghost that only a janitor with Ghost Capture can remove. Our guests only lose patience: the worst that happens is they storm out, and the condition itself never changes. An equivalent without death: a condition that **flares up** over a visit, shown as a bar, making treatment less likely to work and, at the bottom, sending the guest home worse off with a big reputation hit. It gives the player a reason to put some guests ahead of others, which today they have none. _Medium._ ([wiki: Patients](https://two-point-hospital.fandom.com/wiki/Patients), [Death](https://two-point-hospital.fandom.com/wiki/Death), [Ghosts](https://two-point-hospital.fandom.com/wiki/Ghosts))

**2. A queue you can manage.** A room's Queue tab lets you drag patients into a new order, or onto another room of the same type. The patient's own inspector has **Send Home**, and **Send for Treatment** once the diagnosis is at least 50% certain. Our guests choose their station and line up on their own, and the player cannot touch it. _Small to medium._ ([wiki: Rooms](https://two-point-hospital.fandom.com/wiki/Rooms), [Steam discussion](https://steamcommunity.com/app/535930/discussions/0/1737715419902043851/))

**3. Policy.** Two Point Hospital's Policy tab sets the **diagnosis threshold**, how certain a diagnosis must be before a patient goes for treatment (90% by default; we hard-code 75%), and a **fast-track** switch that sends a patient straight to treatment when it is already known. A separate **break policy**, on the staff overview, sets how many of each kind of staff may be on a break at once, and for how long. There is no automatic send-home threshold; sending home is done by hand (item 2). Each setting is a number our sim already uses as a constant. _Small._ ([wiki: Diagnosis](https://two-point-hospital.fandom.com/wiki/Diagnosis), [Overview](https://two-point-hospital.fandom.com/wiki/Overview), [Steam discussion](https://steamcommunity.com/app/535930/discussions/0/1737715419902371784))

**4. Seeing a guest's chances.** Two Point shows each patient's diagnosis certainty and the chance their treatment will work, and the illness list shows cure rates. We show diagnosis progress but not the chance of success, so a guest about to be botched by an unqualified therapist gives no warning. _Small._ ([Steam discussion](https://steamcommunity.com/app/535930/discussions/0/3145179089265845359))

**5. Guest feelings.** Two Point Hospital gives patients and staff **feelings** ("Too cold: radiators would be nice", thirsty, bored, scared of a ghost), and each person's inspector lists their top complaints and positives. The overview shows averages and the advisor counts unhappy patients; a hospital-wide tally of feelings is _unverified_. Our guests show an emoji bubble now and then. A feelings list in the guest inspector, and the commonest ones in the Stats view, would turn hidden causes into readable ones. _Small to medium._ ([wiki: Feelings](https://two-point-hospital.fandom.com/wiki/Feelings))

**6. Visitors who judge you.** VIPs write ahead, tour three to six rooms, judge them by their own criteria, and leave a reward, or a reputation loss or fine. The health inspector is one of them and visits every hospital, ready or not. Our Fire Extinguisher's description already says "the inspectors like to see one", but there are no inspectors. The campaign plan has an inspector at The Orchard Estate; VIPs would work in every center. _Medium._ ([wiki: Visitors](https://two-point-hospital.fandom.com/wiki/Visitors))

**7. Something catching.** In an epidemic, four people are infected and a disease-control agency sends 20 vaccines. The player spots carriers by their symptoms (staff can carry it too) and clicks Vaccinate in their inspector. It fails if more than two carriers leave or the vaccines run out, and pays cash, reputation and Kudosh if not. No qualification is involved. A themed version: a **stress outbreak** among waiting guests, with a limited number of calming sessions to hand out. _Medium._ ([wiki: Epidemics](https://two-point-hospital.fandom.com/wiki/Epidemics))

## Staff

**8. Experience and promotions.** Two Point staff earn experience by working, through five ranks. When ready they send a promotion letter. Promotion carries a small raise they will not do without, and putting it off makes them unhappy. Each promotion opens a qualification slot, up to five, which has to be filled by training before the next promotion. Ours only improve through paid skill courses, so a therapist with 500 guests served is no better than on day one. Our skill stars (1 to 5) could become the rank. _Small to medium._ ([wiki: Staff Training](https://two-point-hospital.fandom.com/wiki/Staff_Training))

**9. General qualifications.** Besides medical ones, Two Point Hospital has personal development courses any role can take: **Bedside Manner**, **Emotional Intelligence**, **Motivation** (makes them work faster and better themselves), **Stamina Training**, and **Training Masterclass** (makes them a better teacher). Some are for one kind of staff: **Customer Service** for assistants on reception, and for janitors **Maintenance** (faster repairs), **Mechanics** (installs machine upgrades) and **Ghost Capture**. **Marketing** and **Research** let staff work in those rooms. Ours are only treatment techniques plus a skill course. A few general courses, each a multiplier our sim already has (service speed, energy drain, repair time, guest patience), would give receptionists, consultants and janitors something to train for. _Small to medium._ ([wiki: Staff Training](https://two-point-hospital.fandom.com/wiki/Staff_Training))

**10. Job assignment and room priority.** Two Point Hospital's job assignment screen switches each member of staff on or off for each room type (doctors and nurses) or each task (janitors: repairs, upgrades, toilets, ghosts, plants and so on). It does not tie anyone to one room or area; zones are a Two Point Museum feature. Any room can be set to **high priority** so staff fill it first, or closed to stop its running costs. Ours go wherever they are needed, so there is no way to keep a janitor off watering duty or fill the Hot Stone suite first. _Medium._ ([wiki: Staff](https://two-point-hospital.fandom.com/wiki/Staff), [Janitor](https://two-point-hospital.fandom.com/wiki/Janitor), [Rooms](https://two-point-hospital.fandom.com/wiki/Rooms))

**11. More of a staff member's day.** Two Point staff have thirst, hunger and toilet needs as patients do, mostly seen to on their breaks, and heat makes them thirstier. Ours have energy and morale only. Staff needs make guest-facing items do double duty. _Small to medium._ ([wiki: Staff](https://two-point-hospital.fandom.com/wiki/Staff))

**12. Traits you can see.** Two Point staff have one to three fixed traits, many of them visible and funny: Nasty (upsets patients), Litterer, Stupid (learns slowly), Positive, Sleepy, Entertainer (dances), Gross (makes people sick), Romantic, Green Fingers. Our seven change speed, stamina and pay only. A few with visible behavior, good and bad, would make hiring choices more interesting. _Small each._ ([wiki: Traits](https://two-point-hospital.fandom.com/wiki/Traits))

**13. A hiring pool that grows.** Two Point Hospital shows more applicants per kind of staff as the hospital levels up (to eight), brings a new one every 15 days, lets you reject one to free the slot, and sorts by ability, qualifications and salary. Recruitment marketing campaigns bring applicants faster, or with a chosen qualification; paid headhunting is _unverified_. We show three per role, refreshed each month and on each star. _Small._ ([wiki: Staff](https://two-point-hospital.fandom.com/wiki/Staff), [Marketing](https://two-point-hospital.fandom.com/wiki/Marketing))

**14. Year-end awards.** At each year end there is an awards ceremony, with eight awards per hospital including staff ones (Janitor of the Year), paying cash, Kudosh and reputation, and the trophies kept under the overview's Awards tab. Easy to drive from our monthly records; it would also give the Trophy Cabinet something to hold. _Small._ ([wiki: Hospital Awards Ceremony](https://two-point-hospital.fandom.com/wiki/Hospital_Awards_Ceremony))

## The building

**15. More land.** Two Point Hospital lets you buy extra plots, shown as construction sites around the hospital. Our building is fixed per center. Now that the plot lives in the game state, buying an adjoining plot is possible, though walls, scenery and pathing all assume one rectangle. _Large._ ([Twinfinite guide](https://twinfinite.net/guides/two-point-hospital-buy-more-buildings-how-to/))

**16. Moving, copying and templating rooms.** Two Point Hospital has all three: pick a built room up, furniture and all, to move or rotate it; copy and paste a room (added in 2018); and save rooms as templates (added in 2020). Campus has them too. We have resizing, door moves and windows. _Medium each._ ([wiki: Rooms](https://two-point-hospital.fandom.com/wiki/Rooms), [Changelist](https://two-point-hospital.fandom.com/wiki/Changelist), [templates blog](https://community.twopointcounty.com/two-point-studios/two-point-hospital/blogs/9-room-templates-deep-dive))

**17. Temperature.** Radiators and air conditioners, regions with temperate, cold and hot climates, and patients and staff who mind. Failing machines give off heat. We have none. Seasons at Saltmarsh and the snow at High Pines would make it bite. _Medium._ ([wiki: Hospitals](https://two-point-hospital.fandom.com/wiki/Hospitals))

**18. Overlays.** Two Point Hospital has twelve: attractiveness, health, patient happiness, staff happiness, temperature, thirst, hunger, staff energy, hygiene, toilet, boredom and maintenance. We already compute how pleasant every tile is (`ctx.attract`), every guest's needs and every item's wear and dirt, so several overlays are close to free. _Small._ ([wiki: Visualisation Modes](https://two-point-hospital.fandom.com/wiki/Visualisation_Modes))

**19. Camera rotation.** Two Point's camera turns freely (middle mouse, or Q and E) and tilts. Ours looks from one side only, so anything behind a wall from that angle is hard to place. Needs walls that cut away facing the camera. _Medium._ ([wiki: Preferences](https://two-point-hospital.fandom.com/wiki/Preferences))

**20. Decorating rooms.** Two Point Hospital lets you set each room's wall and floor patterns (added in 2019), for one room or every room of a type, with patterns unlocked by Kudosh and your own images through an Interior Designer. Our rooms use their type's colors. Patterns would be a natural karma purchase. _Small to medium._ ([wiki: Room Customisation](https://two-point-hospital.fandom.com/wiki/Room_Customisation))

**21. Hygiene.** People and areas have a hygiene level. Low hygiene makes patients' health drain faster, and sinks, hand dryers and sanitizers raise it. We have dirt on items and litter on floors, but nothing on people. Matters only alongside item 1. _Small to medium._ ([wiki: Hospitals](https://two-point-hospital.fandom.com/wiki/Hospitals))

**22. Disasters.** Fires, earthquakes, electrical storms and volcanic eruptions damage machines and leave debris. Our Fire Extinguisher does nothing but look reassuring. A center-specific one (a storm at Saltmarsh, a power cut at The Exchange) would fit the twist system. _Medium._ ([wiki: Disasters](https://two-point-hospital.fandom.com/wiki/Disasters))

## Money and growth

**23. Marketing.** Campaigns need a Marketing room and an assistant with the Marketing qualification, and run three to twelve months. General campaigns raise reputation rather than arrivals; illness campaigns change which conditions arrive, not how many; recruitment campaigns bring applicants. We control demand only through prices. Our centers already weight conditions, so an illness campaign is a temporary weight with a cost. _Small to medium._ ([wiki: Marketing](https://two-point-hospital.fandom.com/wiki/Marketing))

**24. Research and machine upgrades.** Doctors with the Research qualification work through projects that unlock rooms, qualification levels and machine upgrades, plus repeatable projects for cash or Kudosh. Janitors with Mechanics install the upgrades. We have nothing between "bought" and "broken". Upgrades alone, paid for and fitted by a janitor, would add a long-term goal. _Large for research, medium for upgrades alone._ ([wiki: Research](https://two-point-hospital.fandom.com/wiki/Research))

**25. Prices per treatment.** The Prices screen lists everything chargeable (diagnosis, each treatment, vending) with its own price, plus a global adjustment. We have the global one only. Pricing each technique lets players charge for a strong Hot Stone service without driving away Swedish guests. We already count guests put off by price. _Small._ ([wiki: Prices](https://two-point-hospital.fandom.com/wiki/Prices))

**26. A casebook.** The illness list shows, for each illness, its treatment cost, reputation, cure rate, and how many were cured, untreatable, died and stormed out. We count healed per discipline. The same per condition in the Treatments menu would show where the center is weak. _Small._ ([wiki: Patients](https://two-point-hospital.fandom.com/wiki/Patients))

**27. Staff objectives.** Partway through a level, staff send letters setting an objective with 90 to 180 days to meet it: cure 10, 20, 40 or 80 patients, earn $100,000, reach 70% attractiveness, upgrade a machine, go 90 days without a death. The reward is staff happiness and Kudosh, not usually cash. There are also timed online challenges against rival hospitals. We have emergencies only. Our `GoalSpec` objectives already do the checking, so an objective is a goal, a deadline and a reward. _Small._ ([wiki: Staff Objectives](https://two-point-hospital.fandom.com/wiki/Staff_Objectives), [Online Challenges](https://two-point-hospital.fandom.com/wiki/Online_Challenges))

**28. Reputation in parts, and a center level.** Two Point Hospital splits reputation into medical, patients, prices, staff and publicity, each shown in the overview, so a player can tell which part is dragging. It also has a **hospital level**, up to 30, from rooms, staff and prestige, which drives arrivals and applicant slots. We have one reputation number. _Small for the breakdown, medium for a level._ ([wiki: Overview](https://two-point-hospital.fandom.com/wiki/Overview), [Hospitals](https://two-point-hospital.fandom.com/wiki/Hospitals))

**29. Other income.** Museum earns from tickets, donations, gift shops and sponsorships; Campus from tuition per course and dorm rent. A **membership** scheme (guests who pay monthly and come back regularly) would be our equivalent of a second income stream. _Medium._ ([Dexerto](https://www.dexerto.com/gaming/how-to-earn-money-fast-in-two-point-museum-3141694), [Gfinity](https://www.gfinityesports.com/guides/two-point-campus-make-money))

## Rooms and treatments

**30. Breadth of rooms.** Two Point Hospital's base game has 30 kinds of room: nine for diagnosis (the Ward also treats), fourteen more for treatment, and seven facilities including the Pharmacy, Research and Marketing; its expansions add more. We have eight. Without adding disciplines, candidates that fit: a **Recovery Lounge** (some treatments leave guests needing a rest before they leave, like a ward), an **Herbal Dispensary** (a pharmacy, staffed, for a few conditions cured by a remedy), and one more diagnosis room alongside the Posture Lab. _Medium each._ ([wiki: Rooms](https://two-point-hospital.fandom.com/wiki/Rooms))

**31. Treatment gags.** Every Two Point treatment room has its own animation of the cure, like the De-Lux Clinic's claw swapping a light bulb head. Ours pose people on tables. A small animation per technique, even just props moving, would go a long way. _Medium overall._ ([wiki: De-Lux Clinic](https://two-point-hospital.fandom.com/wiki/De-Lux_Clinic))

## Settings and polish

**32. A fuller sandbox.** Two Point Hospital's sandbox sets cash, Kudosh, an income multiplier, how often patients arrive, which illnesses appear, objectives, the hiring pool, temperature, what is unlocked, and which plots are owned, with switches for staff objectives, emergencies, VIP visits, disasters and epidemics. Ours sets money, treatments and unlock-all. Most switches would come free with the systems above. _Small, after them._ ([wiki: Sandbox Mode](https://two-point-hospital.fandom.com/wiki/Sandbox_Mode))

**33. Game settings.** Two Point Hospital has key rebinding, an edge-scrolling switch and an autosave interval; UI scale and camera speed are _unverified_. We have sound, music and treatments. _Small._ ([wiki: Preferences](https://two-point-hospital.fandom.com/wiki/Preferences), [PCGamingWiki](https://www.pcgamingwiki.com/wiki/Two_Point_Hospital))

**34. A radio.** Two Point Radio has three DJs, adverts and news between songs; tracks can be switched off and your own music added. We have the PA announcer and music. Possible once there are voiced lines enough. _Medium, mostly content._ ([wiki: Two Point Radio](https://two-point-hospital.fandom.com/wiki/Two_Point_Radio))

## Further afield

Not gaps worth closing soon, but part of what makes Two Point feel complete:

- **Rival hospitals** compete on leaderboards and at the awards, and some of their bosses visit as VIPs. ([wiki: Rival Hospitals](https://two-point-hospital.fandom.com/wiki/Rival_Hospitals))
- **Community research** (the Superbug Initiative): shared goals across all players, unlocking unique items. ([wiki](https://two-point-hospital.fandom.com/wiki/The_Superbug_Initiative))
- **Steam Workshop** for sharing room art and sandbox hospitals.
- **Campus social life**: clubs, parties and events on a calendar, friendships and romances. ([PCGamesN](https://www.pcgamesn.com/two-point-campus/guide))
- **Ambulances** (Hospital's Speedy Recovery expansion): road and air ambulances that need staff with driving or flying qualifications.

## Themed versions

Some Two Point systems don't fit a healing center as they are, but a version of them does. These are ours, not Two Point's.

**35. Guest reviews** (from reputation in parts, 28). Guests leave a star rating and a one-line review as they go ("Lovely hot stones. Someone was playing pool next to my reiki."). Reputation is split into results, experience, value, staff and word of mouth, so the player can see which part is dragging. Reviews are how feelings (5) reach the player.

**36. A retail counter** (from the Pharmacy and Museum's gift shop). A receptionist-staffed counter in the lobby sells books, crystals, oils and candles to guests on their way out, more after a good treatment. A second income stream, as real healing centers have.

**37. House calls** (from ambulances). Send a therapist out for a day to an office or a hotel for a fee, leaving the center short while they are gone. At The Exchange, desk-massage contracts with the office towers.

**38. Fresh linens** (from hygiene, 21). Treatment tables need fresh towels and sheets. Used linens pile up in a hamper until a janitor takes them to be laundered. A guest on a stale table is unhappy, and results suffer.

**39. Calm** (alongside temperature, 17). A healing center should be quiet. Arcades, pool tables, crowds and the snack machine make noise, and noise near a treatment room hurts its results. Its own overlay, and a real decision about where the fun items go. Two Point has nothing like it.

**40. A rival center** (from rival hospitals). A healing-center franchise across the street undercuts your prices, poaches unhappy staff, and competes with you at the year-end awards.

**41. Mishaps** (from disasters, 22). One per center: a power cut at The Exchange stops the stim units and turns the lights off; a storm at Saltmarsh floods the restrooms; a snowstorm freezes the pipes at High Pines. A fire drill anywhere sends everyone outside, and the Fire Extinguisher finally matters.

**42. Bad vibes** (from ghosts). A failed treatment leaves a lingering cloud in its room that unsettles everyone who comes in, until someone clears it: a Reiki Practitioner, or a janitor trained in smudging.

**43. The center's standing** (from the hospital level, 28). The center climbs through grades (Back-Room Practice, Wellness Center, Healing Institute) from its rooms, staff and prestige, which drive arrivals, applicants and what guests expect.

**44. Regulars and group classes** (from Campus's social life). Guests come back, are greeted by name and grow loyal. A studio runs group yoga or meditation sessions from a weekly calendar, a different rhythm from one-on-one treatments.

**45. Other players' institutes** (from community research and rival hospitals). Way down the line, with a server: research goals shared by every player, other players' centers appearing as rivals, and their owners visiting as VIPs.

Left out: Steam Workshop sharing.

## Plan

The order to build all this in is in [roadmap.md](roadmap.md).
