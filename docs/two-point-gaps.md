# What Two Point has that we don't

An audit, 14 October 2026, of the systems and features in the Two Point games (mostly Two Point Hospital, with Campus and Museum where they add something) that Pressure Point Institute lacks. More scenarios are left out on purpose.

What Two Point does is from memory, not checked against the games. Each gap says what Two Point does, what we have, and how big a job it looks. The recommended order is at the end.

## What we already match

So the gaps below are read in proportion: we have rooms built by dragging, doors and windows, room resizing, furniture placed and moved, decor and room prestige, a diagnosis step that can need repeating, treatments that need qualified staff and equipment, staff energy and a staff room, morale, raise requests and quitting, traits, training courses, janitors for litter, plants, cleaning and repairs, equipment that wears out and breaks, guest thirst, hunger, bladder and boredom, vending and games that earn money, emergencies, loans, a global price level, monthly books and a stats view, star goals per center, twists per center, karma and achievements, a sandbox with settings, a PA announcer, and saves.

## Guests

**1. A condition that gets worse while it waits.** The heart of Two Point Hospital's tension is that patients' health drains while they queue, and they die if it runs out (then haunt the place). Our guests only lose patience: the worst that happens is they storm out, and the condition itself never changes. An equivalent without death: a condition that **flares up** the longer a guest waits, shown as a health bar, making treatment harder (lower success chance) and, at the bottom, sending them home worse off with a big reputation hit. It gives the player a reason to prioritize some guests over others, which today they have none. _Medium._

**2. A queue you can manage.** Two Point lets you open a room's queue, move a patient to the front, send someone to another room, or send them home. Our guests choose their station and line up on their own, and the player cannot touch it. A queue view in each station's inspector, with "to the front" and "send home", is the cheap half. _Small to medium._

**3. Center policy.** Two Point Hospital has a policy screen: how sure a diagnosis must be before treatment (we hard-code 75%), the treatment success chance below which a patient is sent home rather than treated, and the energy level at which staff go on break. Each is a number the sim already uses as a constant. _Small._ Pairs well with the next two.

**4. Seeing a guest's chances.** Two Point shows each patient's diagnosis certainty and the treatment's chance of success before it starts. We show diagnosis progress, but not the chance of success, so a guest who will be botched by an unqualified therapist gives no warning. _Small._

**5. Guest thoughts.** Two Point patients think things ("too cold", "this queue is too long", "nothing to do", "lovely room") and the hospital overview counts them, which is how a player finds out what is wrong. Our guests show an emoji bubble now and then. A thoughts list on the guest, and a tally of the commonest ones in the Stats view, would turn hidden causes into readable ones. _Small to medium._

**6. Visitors who judge you.** Two Point has VIP visits (a guest who tours the hospital and rates it, with a reward for a good score) and inspections. Our Fire Extinguisher's description already says "the inspectors like to see one", but there are no inspectors. The campaign plan has an inspector at The Orchard Estate; a VIP event would work in every center. _Medium._

**7. Something catching.** Two Point Hospital has epidemics: a contagious illness spreads unseen, and staff with a vaccination qualification hunt down the carriers against the clock for a reward. A themed version: a **stress outbreak** that spreads between guests waiting close together, with a Reiki Practitioner calming the carriers, offered like an emergency. _Medium._

## Staff

**8. Experience and levels.** Two Point staff gain experience by working, level up, and ask for a raise when they do; each level adds a qualification slot. Ours only grow through paid skill courses, so a therapist with 500 guests served is no better than on day one. Experience from `served`, a level-up toast, and a raise request on leveling would add a slow, rewarding loop. _Small to medium._

**9. General qualifications.** Beyond medical ones, Two Point has qualifications any role can take that change how they work: Customer Service (faster and friendlier at reception), Motivation (lifts colleagues' morale), Stamina (tires more slowly), Mechanics (repairs faster and more lastingly), Marketing, Research, Teaching. Ours are only treatment modalities plus a skill course. Four or five general courses, each a multiplier the sim already has (service speed, energy drain, repair time, morale), would give training a reason to exist for receptionists, consultants and janitors. _Small to medium._

**10. Assigning staff.** Two Point lets you assign staff to particular rooms, keep a doctor on one desk, or keep a janitor to one area. Ours go wherever they are needed, which is usually fine, but there is no way to keep your best therapist on the Hot Stone suite or a janitor in the restrooms. _Medium._

**11. More of a staff member's day.** Two Point staff have thirst, hunger and toilet needs like patients, use the same machines, and are made happier by the staff room's furniture. Ours have energy and morale only. Staff needs make guest-facing items do double duty. _Small to medium._

**12. Traits you can see.** Two Point's traits are often visible and funny as well as numeric: rude (upsets patients), litterbug, cheerful (lifts the room), slow learner, prankster. Our seven change speed, stamina and pay only. A few with visible behavior, good and bad, would make hiring choices more interesting. _Small each._

**13. A hiring pool with depth.** Two Point shows more applicants as the hospital levels up, lets you pay to look further (headhunting), and filters by qualification. We show three per role, refreshed each month and on each star. _Small._

**14. Year-end awards.** At each year end Two Point holds an awards ceremony: the hospital and its staff are nominated in categories, with prize money and a trophy. Easy to drive from `months` and our stats; it would also give the Trophy Cabinet something to hold. _Small._

## The building

**15. More land.** Two Point Hospital lets you buy extra plots, often whole separate buildings, as a level goes on. Our building is fixed per center. Now that the plot lives in the game state, buying an adjoining plot is possible, though walls, scenery and pathing all assume one rectangle. _Large._

**16. Moving, copying and templating rooms.** Two Point lets you pick up a built room, furniture and all, and move or rotate it; copy a room; and (in Campus) save a room as a template to stamp down again. We have resizing, door moves and windows. _Medium for move, medium for copy._

**17. Temperature.** Two Point has heating and cooling: radiators and air conditioners, rooms that are too hot or too cold, and patients and staff who mind. We have none. Seasons at Saltmarsh and the snow at High Pines would make it bite. _Medium._

**18. Overlays.** Two Point has overlays that color the floor by a measure (attractiveness, temperature and so on). We already compute how pleasant every tile is (`ctx.attract`) and how dirty every item is, so a decor overlay is close to free. _Small._

**19. Camera rotation.** Two Point's camera turns in 90° steps (or freely); ours looks from one side only, so anything behind a wall from that angle is hard to place. Needs walls that cut away facing the camera. _Medium._

**20. Decorating rooms themselves.** Campus and Museum let you change floors and wall coverings per room. Our rooms use their type's colors. _Small to medium._

## Money and growth

**21. Marketing.** Two Point Hospital lets you run campaigns: more patients in general, or more with a particular illness, for a fee over a set time. We control demand only through prices. Our centers already weight conditions, so a campaign is a temporary weight with a cost. _Small to medium._

**22. Research and equipment upgrades.** Two Point has a research room and researchers who work through projects that unlock new equipment and upgrade existing machines (more reliable, faster, more effective). We have nothing between "bought" and "broken". Upgrades alone, bought with money and some days of a janitor's or a technician's time, would add a long-term sink. _Large for research, medium for upgrades alone._

**23. Prices per treatment.** We have one price level for everything. Two Point has finer control over what treatments cost. Pricing each technique on its own lets players charge for a strong Hot Stone service without driving away Swedish guests. We already count guests put off by price. _Small._

**24. A casebook.** Two Point keeps a record per illness: how many seen, cured, failed and died, and the success rate. We count healed per discipline. Per-condition counts (and per-technique) in the Treatments menu would show where the center is weak. _Small._

**25. Mid-level challenges.** Two Point offers challenges partway through a level: heal so many of a condition by a date, reach a cure rate, build something, with a cash or karma reward. We have emergencies only. Our `GoalSpec` objectives already do the checking, so a challenge is an objective, a deadline and a reward. _Small._

**26. Insurance? Donations? Tickets?** Museum has donations and ticket prices, Campus tuition. Not a direct fit; a **membership** scheme (guests who pay monthly and come back regularly) would be our equivalent of a second income stream. _Medium._

## Rooms and treatments

**27. Breadth of rooms.** Two Point Hospital has some 30 kinds of room: several diagnosis rooms that each add certainty, a ward for patients who must stay, a pharmacy, research, marketing, and many treatment rooms. We have eight. Without adding disciplines, candidates that fit: a **Recovery Lounge** (some treatments leave guests needing a rest before they leave, like a ward), an **Herbal Dispensary** (a pharmacy, staffed, for a few conditions cured by a remedy), and one more diagnosis room alongside the Posture Lab. _Medium each._

**28. Treatment gags.** Two Point's rooms each have a short, funny animation of the cure. Ours pose people on tables. A small animation per technique, even just props moving, would go a long way. _Medium overall._

## Settings and polish

**29. A fuller sandbox.** Two Point's sandbox sets difficulty, money, how often illnesses and events come, whether epidemics and disasters happen, staff demands, and more. Ours sets money, treatments and unlock-all. Most of the switches would come free with the systems above. _Small, after them._

**30. Game settings.** Two Point has key rebinding, UI scale, edge scrolling, camera speed, and an autosave interval. We have sound, music and treatments. UI scale and edge scrolling are the most asked-for. _Small._

**31. A radio.** Two Point plays a radio station with a DJ, adverts and news between songs. We have the PA announcer and music. Possible once there are voiced lines enough. _Medium, mostly content._

## Recommended order

Ordered by how much depth each adds for the work, with the ones that reuse what exists first:

1. **Center policy** (3), **chances shown** (4) and **a queue you can manage** (2): small, and they turn guests from something that happens to you into something you manage.
2. **Mid-level challenges** (25) and **year-end awards** (14): small, built on the goals and records already there.
3. **Staff experience and levels** (8) with **general qualifications** (9): the staff side's long game.
4. **A worsening condition** (1): the biggest change to how the game feels, best done once the player has tools (1 to 3 above) to respond to it.
5. **Marketing** (21), **prices per treatment** (23) and **the casebook** (24): small economic levers.
6. **Overlays** (18) and **guest thoughts** (5): making what the sim already knows visible.
7. **VIP and inspector visits** (6), then **a stress outbreak** (7).
8. **Equipment upgrades** (22), **temperature** (17), **staff assignment** (10).
9. The large ones, when wanted: **more land** (15), **research** (22), **camera rotation** (19), **new rooms** (27).
