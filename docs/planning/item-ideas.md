# Item ideas

Ideas for new items, drafted 16 October 2026. Nothing here is planned: an idea moves to [planning/todo.md](todo.md) or [planning/roadmap.md](roadmap.md) once it is chosen. Like [planning/ideas.md](ideas.md), this is a list to pick from.

**Chosen on 16 October 2026**, and moved to [planning/todo.md](todo.md): Soundproof Panels (1), Wind Chimes (5), the Generator (7), placed outside only (done: the first item outdoors, and the first mishap item, `heldOffBy` on its mishap), the Fortune Teller Machine (10), the Kombucha Tap (11), the Staff Fridge (16) and wall hangings (24). The rest are still open.

## What makes a Two Point item fun

Two Point's items are fun for a few reasons, and each idea below aims at one or more of them:

- **Each one answers a need you can see.** A patient says they're cold, so you buy a radiator. The item explains itself.
- **The useful ones bring a trade-off.** An arcade cures boredom but makes litter, and vending machines earn money but need restocking or repairs. Where you put them is a decision.
- **There's always something nicer to buy.** Kudosh items cost more than they need to, look grand and add prestige. They give the player a reason to keep earning after the center works.
- **They're funny.** Every description is a joke, and the best items have a little animation that makes you watch them.
- **Some belong to one place.** A hospital in a snowy region feels different because of what you build there.

We have most of the basics already: seats, drinks, snacks, an arcade, bins, plants, decor at every price, radiators and air conditioning, a hamper, a bookcase, a coffee machine and a pool table. The gaps are mostly in the last three points: things to watch, things that belong to a place, and items that interact with the systems we've built since the first batch (noise, temperature, linens, bad vibes, regulars, reviews, mishaps, the inspector, stress outbreaks).

Each idea gives its rough numbers in the terms `ItemDef` already uses, says whether it is **data only** (a new entry in [items.ts](../../src/core/data/items.ts) and some art) or needs **new code**, and names the Two Point item it echoes where there is one.

## Items that use what we already have

These fit systems already in the sim. Most are data only or need a small hook, so they are the cheapest way to make the item menu richer.

**1. Soundproof Panels** 🟫. Wall-side foam panels in a frame. `where: 'any'`, 1×1, $350, `noise: -4`, no decor (they are not pretty). Calm already matters, but the only fixes are moving things or the Fountain and Koi Pond, which cost a lot and only soothe a little. A cheap, ugly panel gives the player a straight choice between calm and prestige. _Data only._ "Absorbs sound, light and joy in equal measure."

**2. White Noise Machine** 📻. A little speaker that hisses softly. Treatment rooms only, $400, `noise: -2`, `wear: 0.5`. Smaller than the panel and it fits inside a room, but it has a plug, so a power cut stops it, exactly when the generator wasn't hired. _Data only_, plus adding it to the power cut's `stops` list. "Plays the sound of rain, forever. Some guests need the restroom more often."

**3. Self-Watering Planter** 🌿. A plant in a planter with a water reservoir, so it never needs a Caretaker. $350, `decor: 1`, karma 2. Compare the $120 Potted Plant, which needs watering, and the $900 Bonsai, which doesn't: this is the middle choice once the Caretakers are busy. _New code, small_: a flag that keeps it off the watering list. Echoes Two Point's plants, which wilt when no janitor waters them.

**4. Hot Towel Cabinet** 🧖. A little steel cabinet of rolled, steaming towels. Massage Suite and Acupuncture Clinic, $800, unlock 1, `heat: 2`. Each session in its room uses a towel and earns a small tip, 4% more chance of the treatment working while it has towels in it, and adds to the hamper, so the Caretaker's laundry run comes round faster. A treatment booster that costs effort, not just money. _New code, small_: it holds towels the way a Stone Warmer holds heat.

**5. Wind Chimes** 🎐. Hung by a door. `where: 'any'`, $450, `decor: 2`, `noise: 1`. Bad vibes in the room it's in clear on their own over a few days, slowly, without a Reiki Practitioner or a Caretaker with Smudging. Useful at Willow Lane, where neither may be around yet, and it makes a little noise, so it's no good beside a sound bath. _New code, small._ "Tinkles whenever anyone walks past, or thinks about walking past."

**6. Stress Ball Bowl** 🔴. A bowl of squishy stress balls on a stand. Corridor, $200, unlock 1. A stressed guest who passes squeezes one and calms down a little, and during a stress outbreak, stress spreads more slowly near it. Every so often a guest walks off with one, and the bowl runs out until a Receptionist refills it. A cheap answer to outbreaks that still needs looking after. _New code, small to medium._

**7. Generator** 🔋. A bulky diesel generator, placed outdoors only (chosen on that condition), 2×1, $2,800, `noise: 8`. Owned, it keeps the power on through every power cut without paying for a hired one each time, but it's loud, so it goes outside, where the building's outer walls hold back its noise. Nothing can be placed outdoors yet, so it needs a first step of phase 7 of [plans/land.md](../plans/land.md). The first of the **mishap items**: something the player can buy once, ahead of time, instead of paying each time. Others in the same family: **Storm Shutters** on windows (The Boardwalk), **Pipe Lagging** as a room upgrade (High Pines) and a **Wasp Trap** (The Orchard Estate). _New code, small each_: a mishap checks for its item before it counts as unprepared.

**8. Fire Extinguisher, made to matter.** No new item: the inspector already wants one near every room. A broken or missing extinguisher next to a room could appear as a line in the inspector's report, and the Fire Extinguisher could wear a little each month until a Caretaker checks it. _New code, small._

## Things to watch and spend on

Two Point's best items are fun to watch and earn a bit of money. These all have something animated and a reason to put one in the lobby.

**9. Aura Photo Booth** 📸. A curtained booth with a flash. Corridor, 1×1, $1,800, karma 4, `sale: 30`, `noise: 3`. A guest goes in, the flash goes off, and they come out holding a photo of their aura, colored by how they are feeling: green after a good treatment, muddy brown after a long wait. A guest leaving happy is much more likely to use it. Reviews can mention their aura ("My aura came out beige. Treatment was nice."). A second shop, more fun to look at than the counter. _New code, medium_: a use that depends on mood, and a review line. Echoes Two Point's photo booths in Campus and Museum.

**10. Fortune Teller Machine** 🔮. A Zoltar-style cabinet with a turbaned mannequin behind glass. Corridor, $1,400, karma 3, `sale: 10`, `wear: 3`, `noise: 4`. It's a `play` item like the arcade, but each guest who plays gets a fortune, shown in a speech bubble ("You will wait a little longer."). Now and then the fortune is "You will be healed today", and that guest is more patient for the rest of their visit. _Data only_ for the arcade side; _small_ for the fortunes. "Its predictions are right about half the time, which is better than the stock market."

**11. Kombucha Tap** 🍶. A wooden barrel with a tap. Corridor, $1,100, unlock 2, `sale: 20`, `wear: 2.5`. It's a drink, like tea, and earns more, but when it's worn it **fizzes over**, leaving a puddle on the floor that slows guests down and makes them unhappy until a Caretaker mops it up. A drink that earns more and goes wrong in a way you can see, like Two Point's vending machines. _New code, small_: a puddle is litter of a new kind. "Alive, technically. Please do not name it."

**12. Wishing Well** 🪙. A little stone well. Corridor, 2×2, $2,500, karma 5, `decor: 5`. Guests passing toss in a coin now and then, which is a little money, more from guests who are happy. A Caretaker fishes the coins out once a month, and a full well looks a bit sad. Prestige that pays for itself, slowly. Echoes Two Point Museum's donation boxes. _New code, small._

**13. Zen Rock Garden** 🪨. A shallow tray of raked sand and three stones, with a little rake. Corridor or Recovery Lounge, 2×2, $1,200, karma 3, `decor: 4`. A bored guest can rake it instead of playing a game: it's slower than the arcade but silent, and it makes no litter. Afterwards the pattern is messed up, and its decor drops until a Caretaker re-rakes it. The quiet alternative to the arcade, for a sound bath's neighbors. _New code, small_: a `play` access without the noise, and decor that goes down with use. "Rake it clockwise to relax. Rake it anticlockwise at your own risk."

**14. Claw Machine** 🧸. Full of plush chakras. Corridor, $1,600, karma 3, `sale: 15`, `noise: 5`. A guest who plays usually loses (patience drops a little, money comes in), and sometimes wins a plush and is delighted for the rest of the visit. The winner carries it home, held as a prop in the art. _New code, small._ Echoes Two Point's arcade and prize machines.

## Staff items

Staff have energy, morale, thirst and hunger now, and only the Staff Room's couch, coffee machine and pool table to look after them.

**15. Nap Pod** 🛏️. A futuristic egg-shaped bed. Staff Room, 1×2, $2,000, karma 4. A member of staff on a break in it gets their energy back twice as fast as on the couch, but one in ten oversleeps and is late back. Strong, with a cost the player can watch. _New code, small._ "Sleep in the future, today."

**16. Staff Fridge** 🧊. A humming fridge covered in passive-aggressive notes. Staff Room, $600, `noise: 1`. Staff thirst and hunger are seen to here for free on a break, instead of queuing at the guests' tea and snacks. Fewer staff in the lobby queues, and the snacks earn from guests only. _New code, small_: one more place staff look for food and drink. "Someone has eaten Brent's yogurt. Brent knows who."

**17. Motivational Poster** 🖼️. A kitten hanging from a branch, captioned "Hang in there". Staff Room or Training Room, $80, `decor: 1`. A little morale for staff who spend time in the room, and stacking more than two does nothing. Cheap and silly. Better as a wall item (see 24). _Data only_ as a floor item, with morale added the way the pool table's is. Echoes Two Point's inspirational posters.

**18. Employee of the Month Board** 🏅. A cork board with a photo. Staff Room, $300, karma 2. Once a month it picks the member of staff who served the most, shows their name in a toast, and gives them a little morale. Everyone else's morale goes down a bit, unless they're a Ray of Sunshine. Ties into the year-end awards. _New code, small._

## Signature items for each center

These belong to one center, unlocked at its first star and available there only (and in the sandbox), so each center has things to build that the others don't. They pair well with the signature rooms in [planning/ideas.md](ideas.md).

**19. Willow Lane: Community Noticeboard** 📌. Covered in flyers for lost cats and drum circles. Corridor, $250, `decor: 1`. Regulars who pass it are a little more loyal, and new guests who read it are more likely to become regulars. A small start for the regulars system at the first center. _New code, small._

**20. The Exchange: Phone Locker** 📱. A wall of little locked cubbies. Corridor near reception, 2×1, $900. Guests hand in their phones at check-in. Text Neck, Desk Slump and Crossed Wires treatments work 8% more often, but guests waiting without their phone get bored much faster. A trade-off that fits a business district. _New code, small._ "Your phone will be fine. It is in a better place."

**21. The Boardwalk: Seashell Fountain** 🐚. A fountain in a giant scallop. Corridor, 2×1, $1,400, `decor: 5`, `noise: -2`, `heat: -3`. Cheaper than the Koi Pond and cools the air around it, which is handy in summer at The Boardwalk. Seagulls sometimes land on it and steal a snack from a nearby guest. _Data only_, plus the gulls as a gag.

**22. High Pines: Hot Cocoa Urn** ☕. A big copper urn with a ladle. Corridor, $900, `sale: 15`, `heat: 3`. A drink that warms whoever drinks it, so a cold guest stops losing patience for a while. In winter a guest is far more likely to pick cocoa than tea. _New code, small._ Also at High Pines: a **Ski Rack** by the door, where guests stand their skis, a bit of decor that gets knocked over now and then and blocks the corridor until a Caretaker stands it up again.

**23. The Orchard Estate: Apple Barrel** 🍎. A barrel of windfall apples. Corridor, $500, `decor: 2`. Free snacks for hungry guests, so it earns nothing, but guests love it. In harvest week it attracts the wasps, and they arrive a day sooner. The estate's picky guests expect one. _Data only_, plus a mishap hook.

## Bigger ideas

These need more than an item, but would make items more fun across the board.

**24. Wall items.** Two Point has a whole category of things that hang on walls, like posters, paintings, clocks and certificates, which add decor and character without taking up floor space. We have none: every item stands on a tile. A wall slot on each wall tile of a room, with a few items to hang:

- **Framed Diploma** (from a qualification course, free, adds a little to the guests' trust in that therapist),
- **Clock**, which makes guests lose patience a little faster when they can see it, but gets staff back from breaks sooner,
- **Chakra Chart** and **Meridian Poster** for the treatment rooms,
- **Landscape painting**, in a different subject for each center,
- and the Motivational Poster from 17.
  _New code, medium to large_: placing on walls, drawing items on walls that turn with the camera, and walls cut low hiding what hangs on them.

**25. Item gags.** Two Point items are worth watching because they do things: the vending machine eats a coin, a radiator clanks. A small animation per item, even just props moving, is to items what treatment gags ([audits/two-point-gaps.md](../audits/two-point-gaps.md), item 31) are to rooms. Starting points: the Granola Dispenser shaking a stuck bar loose, the Gong shimmering after it's struck, the Fortune Teller's hands waving over the crystal ball, and the Koi in the pond following a guest along the edge. _Medium overall._

**26. A center cat.** A cat bed (`where: 'any'`, $400, karma 4) brings a cat that wanders the center. Guests it rubs against are happier and more patient, and staff it visits in the Staff Room get a little morale. Sometimes it falls asleep on an empty treatment table, and the next guest can't use it until a member of staff moves it. Two Point has no pets, but Campus's mascots and Museum's ghosts and creatures are the same kind of delight. _New code, medium_: a wandering creature with simple behavior and its own art. "Not a therapy cat. Has not been told."

## Where to start

Chosen on 16 October 2026: see the top of this doc. Of what's left, the Aura Photo Booth (9) and one signature item per center (19 to 23) would add the most for the least work. The other mishap items in 7 fit best once the Generator has set the pattern, and the Motivational Poster (17) belongs with the wall hangings.
