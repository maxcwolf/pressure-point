# Machine ideas

Ideas for big treatment machines, drafted 21 October 2026. Nothing here is planned: an idea moves to [todo.md](todo.md) or [roadmap.md](roadmap.md) once it is chosen. Like [item-ideas.md](item-ideas.md), this is a list to pick from. How the machines would be built is in [machine-plan.md](machine-plan.md).

Every treatment today is a pose on a table or mat, with at most a 1×1 or 2×2 prop beside it costing $600 to $2,600. [two-point-gaps.md](two-point-gaps.md) names this gap (item 31, "Ours pose people on tables"), and [ideas.md](ideas.md) suggests a signature room at each center. This doc fills both in: one big, silly machine room per center, a few big machines for techniques we already have, and one endgame machine bought with karma.

The machines get sillier center by center. Willow Lane's is something an overpriced spa might really sell, taken too far. By The Orchard Estate they are openly magical.

## What makes a Two Point machine fun

Two Point Hospital's machines are the part of the game people remember. A few things make them work, and each idea below aims at all of them:

- **The pun comes first, and the machine takes it literally.** Pandemic is a saucepan stuck on the head, so the Pans Lab pulls it off with a giant magnet. Turtle Head is a head sunk into the shoulders, so the Head Office plunges it back up. Grey Anatomy patients are drained of color, so the Chromatherapy room sprays them red, then green, then blue. The developers start from a bad pun or a picture and only then ask how a machine would cure it ([TheSixthAxis interview](https://www.thesixthaxis.com/2018/04/24/interview-two-point-hospital-devs-on-their-favourite-diseases-and-slapstick-vomit/), [Destructoid](https://destructoid.com/?p=234366)).
- **Three beats you can read from far away.** The patient goes in, something absurd and alarming happens, and they come out cured, with the change visible on their body. Every animation is broad enough to read with the camera zoomed out.
- **Fake failures that still work.** If the Extract-a-Pan's ankle braces aren't on, the magnet grabs the whole patient, swings them round and drops them, and the cure works anyway. Pebberley Island's Face Stamp often needs a second go. The Ward's cured monobrow escapes as a "monobeast" and has to be clicked.
- **Never a real illness.** The joke is on the made-up condition and the staff, never on anything a real person has.
- **The name is part of the joke.** Dehumorfier, Recurvery Unit, De-FIB, Melt'n Mould.
- **Fitting it in is the puzzle.** Ordinary rooms are 3×3 to 4×4. Later machines come in awkward shapes: the Recurvery Room is 3×5, Culture Shock's Danger Zone 3×7, Toad Hall 4×7, the Escape Room 5×9. Specialist rooms cost about $15,000 to $35,000 to build, and the top ones $50,000 to $60,000.
- **Systems around them.** Each use wears a machine down. Past halfway a janitor comes, and near the bottom it catches fire. A janitor with the Mechanics course fits two upgrade tiers. Slow machines mean building a second one. Theme Hospital went further: a worn machine could explode and kill everyone in the room. That is too harsh for us. Here, an overload is a comic mess, always warned of in advance, and there is always something the player can do about it.

Other games have a few ideas worth borrowing. Evil Genius chains its traps into combos and ends its campaign on one enormous doomsday machine. Theme Park lets you tune things for profit or happiness. Big Pharma's machines make by-products. Two Point's own Speedy Recovery trades speed against capacity with its two joke ambulances.

Each idea below gives rough numbers in the terms the data already uses. For comparison, rooms cost $2,500 to $11,000 today and ailments pay about $1,400 to $2,100. Machines sit a tier above both: a room at $15,000 to $45,000 and fees of $2,200 to $4,000. All of them are first guesses, to be priced again once the two pieces of balance work below are in.

## Against the balance

Reviewed on 21 October 2026 against the balance rework and its deep-dive audit of 20 October 2026. The machines fit the rules that work set, and they are in the right place in the game. Where they pull against it is money and demand, not fairness.

**Where they fit.** Every signature room opens at a center's second star. The good bot reaches that at months 8 to 13, and the thoughtless baseline never does. So the machines never touch the early game the balance work made fair. They are a reward for a center that already works. Overloads follow the rule to warn before punishing and to name what the player can do. Each mishap a machine is caught by is its center's own (a power cut, a storm, the snow, the wasps), and mishaps are announced three days ahead.

**One new cliff to design out.** Guests already in line for a machine-only ailment have no table to be moved to. When the machine goes down, that line is stranded. So:

- A down or overloaded machine stops drawing its ailments at once.
- The overload toast names the line and what to do about it, the way the new line warnings do: how many are waiting, how long the repair will take, and that a Caretaker can be sent now.

**Machines must cost money to run, not only to buy.** The audit's standing problem is that four of five centers end with $600,000 to $1,400,000 and nothing to spend it on. Against the good bot's monthly profit after the balance work, the rooms as first priced pay for themselves almost at once:

| Center             | Profit a month | Signature room | Pays back in       |
| ------------------ | -------------- | -------------- | ------------------ |
| Willow Lane        | $17k to $23k   | $15,000        | under a month      |
| The Exchange       | $23k to $31k   | $20,000        | about a month      |
| The Boardwalk      | $14k to $29k   | $24,000        | one to two months  |
| High Pines         | $7k to $35k    | $28,000        | one to four months |
| The Orchard Estate | $50k to $81k   | $32,000        | under a month      |

A machine that earns one and a half to two times a table's fee and pays for itself in a month makes the late money easier, not harder. Machines should be where that money goes. They get running costs the player chooses to carry:

- **A monthly running cost** for power and parts, paid with the wages and shown as its own line in the books. It is larger at the richer centers.
- **A repair bill when one overloads,** on top of the Caretaker's time.
- **Expensive upgrade tiers,** priced against the machine, not against a table.

The prices on each machine below are the room's and the machine's. The running costs are set once the late-money sink (below) is in, and the machines are priced against it.

**Grow demand the general way first.** The audit's fifth recommendation is arrivals that rise with each staffed treatment room, so that building is the right move everywhere. A machine room then brings guests because it is a staffed treatment room, like any other. If only machine rooms added arrivals, they would become the one build that grows demand, and the tables would keep the problem.

**By-products earn standing, not money.** The audit's sixth recommendation is to bring side income down, since class fees and house calls already outweigh healing at a settled center. So the Cider Press's cider and the Pin Press's framed outlines earn reputation or karma, not cash. This matters most at The Orchard Estate, which already makes two to three times what any other center does.

**Machines for techniques we have are trades, not strict upgrades.** At $6,000, a Hot Stone Kiln that is a quarter faster and 15% dearer per session, needing no stocking, would simply be the default at a center making $17,000 a month. Each of these machines gives something and takes something real: the Gong of Last Resort, fast but loud and hard on the rooms next door, is the model. None of them raises the fee.

**Short courses.** Waits run 8 to 21 days partly because practitioners are away on courses and house calls. A machine's course takes its operator off the floor again just after the room is paid for, so every machine course is short: two or three days.

**The order.** Build the machines in the order [machine-plan.md](machine-plan.md) gives, but only after the demand that grows with every staffed room and a sink for the late money are in. Price the machines against both, or the machines will spend the money problem instead of solving it.

## A signature machine room at each center

Each is a new room whose only required item is one big machine that the guest walks into. It cures two new pun ailments that belong to that center (and the sandbox), is worked by the center's own kind of practitioner, and opens at the center's second star. Each has a gag that plays out over the session, and one fake failure that plays now and then.

**1. Willow Lane: the Kneadmaster 9000** 💺. The plausible one, and the place to start. A shopping-mall massage chair that has gone much too far, with forty-eight padded arms and a cup holder. 3×3, worked by the Massage Therapist, in a Kneadmaster Suite of at least 4×4 costing about $15,000. It cures:

- **Chair-Shaped**, about $2,400: "Sat so long the chair moved out, and they kept the shape."
- **Mall Back**, about $2,200: "Carried someone else's shopping bags for eleven hours. Was not thanked."

The gag: the guest sits and the chair reclines. The arms unfold a pair at a time and knead, gently at first and then far too hard. The chair spins once, the guest's hair stands on end, and they get up standing straight. Now and then the chair snaps shut on the guest like a clam, and the Therapist kicks it until it opens again. When it overloads, it carries on kneading the empty air after the guest has gone, rattling about the room and making noise until a Caretaker unplugs it. It has a plug, so a power cut stops it. "Forty-eight hands, all of them firm. The manual is in a language nobody has identified."

**2. The Exchange: the Pin Press** 📌. A pin-art desk toy the size of a garage door. A 2×3 frame, worked by the Acupuncturist, in a room of at least 4×5 costing about $20,000. It cures:

- **Blue Screen**, about $2,800: "Froze mid-sentence in a meeting and has not restarted."
- **Out of Office**, about $2,600: "Body at work. Mind on a beach since March."

The gag: the guest steps up and ten thousand blunt pins press forward round them, and their outline rises on the back of the wall. The Acupuncturist walks round, finds the one pin still sticking out, and taps it in with a little hammer. The guest reboots. Now and then the outline on the back is Brent's, and they try again. Sessions are very quick, which suits The Exchange's rush hours, but the room is big for downtown. It has a plug. Its best outlines can be framed and hung in the room, adding to its prestige; they are not for sale.

**3. The Boardwalk: the Aura Wash** 🧽. A car wash for auras. A 2×4 tunnel that guests walk through, in one end and out the other, worked by the Reiki Practitioner, in a room of at least 4×6 costing about $24,000. It cures:

- **Salted**, about $2,900: "Sat on the beach so long their aura has a crust you could put on chips."
- **Washed Up**, about $3,000: "Arrived on the morning tide with a deckchair and no plan."

The gag: a pink pre-soak, then spinning brushes made of white-gloved hands (reiki, but faster), a rinse, and a hot-air blower. The guest walks out the far end fluffy and glowing. Now and then a seagull rides through on the guest's head and comes out very clean. Sea air wears it quickly, and it runs on water and power, so a storm stops it. When it overloads, foam floods out into the corridor as a puddle, like the Kombucha Tap's, until a Caretaker mops it up. With a Recovery Lounge next door, its guests need a shorter rest.

**4. High Pines: the Great Alphorn** 📯. An alphorn five tiles long. A 1×5 footprint, worked by the Sound Healer, in a long room of at least 3×7 costing about $28,000. Finding room for it is the point. It cures:

- **Echo**, about $3,200: "Everything they say comes back twice, a little quieter."
- **Snowed In**, about $3,000: "Has been snowed in since November. Not physically."

The gag: the guest stands in the bell. The Sound Healer takes an enormous breath, and a ring of sound rolls the whole length of the horn. The guest's hat and scarf blow off and the frost on them cracks. A moment later an echo comes back from the mountains, and the guest smiles. Now and then the note gets stuck, and the horn bulges along its length like a snake that has swallowed an egg, until the Sound Healer squeezes it out by hand. It is very loud while it plays and is heard across the building, so it wants Soundproof Panels and no neighbors that need quiet. When it overloads, a small avalanche slides off the roof and piles snow against the room's door until a Caretaker shovels it clear.

**5. The Orchard Estate: the Cider Press of Rebirth** 🍏. Openly magical. A great oak cider press, with a 3×3 vat and a barrel, worked by the Shaman, in a room of at least 5×5 costing about $32,000. It cures:

- **Sour Grapes**, about $3,800: "Resents everyone who has ever won anything, including the vicar."
- **Bad Apple**, about $3,600: "Rotten to the core, according to the croquet club."

The gag: the guest climbs into the vat. The Shaman chants and turns the great screw, and the lid comes down. Dark purple juice runs out into the barrel. The lid lifts, and the guest springs up rosy as an apple. Now and then the juice runs gold: "Wrong vintage. That was their inheritance." They press again. Its barrels of Sour Grape Cider aren't sold. A guest is given a glass on the way out, and the estate's picky guests leave kinder reviews for it, which is reputation, not money. But the barrels bring the wasps a day sooner, a trade-off with the estate's own mishap.

**6. Endgame: the Wheel of Rebirth** 🎠. Bought with karma, then open at every center. A reincarnation carousel, 5×5, in a room of at least 7×7 costing about $45,000. Worked by the Shaman at first, and by any practitioner once stations can take more than one kind of staff. It cures:

- **Old Soul**, about $4,000: "Thirty-four years old. Complains about the price of bread in shillings."
- **Past Life Hangover**, about $3,800: "Was a Tudor duke last time round and has not let it go."

The gag: the guest climbs onto a carousel horse, and it turns faster and faster. With each turn the guest rides as another of their past lives, in a ruff, then a toga, then as a goat (old friends from Possessed by a Goat), then a seagull, and at last they hop off as themselves. Now and then they step off still a goat, and the Shaman winds it back a notch. When nobody is being treated, bored guests may ride it for free, which makes them more patient. It is a comfort, not a till.

**Others to swap in.** If one of the above doesn't land, these fit the same centers:

- **Willow Lane: the Mangle**, a laundry mangle guests walk through. It cures **Creased**: the guest comes out flat, and the Therapist shakes them out like a sheet.
- **The Exchange: the Inbox Shredder**, for **Paper Cut Soul**.
- **The Boardwalk: the Rock Machine**, which makes seaside rock with the guest's name lettered all the way through, and the guest too.
- **High Pines: the Snow Globe**, which seals the guest in, gives them a shake, and lets them out when the snow settles. It cures **Stirred Up**.
- **The Orchard Estate: the Hedge Maze of Self-Discovery**, a huge 6×6 maze, as a second cure for Lost Their Way.

## Big machines for techniques we already have

These don't bring new ailments. They do a technique we already have in a different way, for a center that already works and has money to spend. Each one gives something and takes something real, so whether to buy one is a choice, not a given. None of them raises the fee, and each has a monthly running cost like the signature machines.

**Machines that take the place of the table.** A guest is treated on the machine instead, so it needs its own member of staff.

- **7. Hot Stone Kiln** 🏺. A pottery kiln for the Massage Suite. 2×2, about $12,000, a tier above the table. Hot Stone Therapy with no Stone Warmer to keep stocked, and sessions a quarter shorter, at the same fee. The catch:
  - It runs hot, warming the whole room while it works, which guests mind in summer.
  - It burns gas every month.
  - It wears twice as fast, and when it overloads a hot stone rolls out across the floor and leaves a repair bill.

  "A pottery kiln. The stones come out hot enough. So does everything else."

- **8. The Octopus** 🐙. A robot with eight arms for the Acupuncture Clinic. 2×2, about $14,000. Cupping, faster, at the same fee. Now and then it keeps a cup, and the cups have to be bought again. It is a little unsettling to wait beside. Cupping's own description already says guests look like they lost a fight with an octopus, and this is the octopus. "Gentle, tireless, and does not like being called 'it'."
- **9. The Geode** 💎. A split amethyst geode big enough to stand in, for the Reiki Studio. 2×2, about $14,000. Crystal Reiki done inside it is a little more likely to work and is handsome decor, but it is no faster, and it takes floor a second table could have used.

**Machines that help every session in their room.** These suit the rooms that hold group sessions on mats, where a second station doesn't fit.

- **10. The Gong of Last Resort** 🥁. A gong the size of a garage door, for the Sound Bath Studio. 2×3, about $9,000. Sessions in its room are a fifth shorter, but the noise carries much further, and it rattles the items in the rooms next door so they wear faster. "Struck once a session. Felt in the car park."
- **11. Spirit Fog Machine** 🌫️. A nightclub fog machine for the Ceremony Lodge. 1×1, about $3,000. Every trip in the room gets a good set and setting. Now and then it sets off the smoke alarm. "The alarm reports a good trip."

**Later, maybe: a Long-Distance Reiki Dish** 📡. A satellite dish on the roof that treats guests where they sit in the lobby. Treating a guest away from a station is a big piece of new code, so it waits.

## What makes them a game, not just something to watch

- **Overloads are a mess, never a disaster.** A machine smokes once it is three-quarters worn, so the player sees it coming. At full wear it overloads, but the guest inside always finishes first. Each machine's mess is its own joke (kneading the air, a flood of foam, an avalanche, a runaway stone), and a Caretaker clears it as an urgent repair.
- **Upgrades show.** Machines use the three upgrade levels we already have, and each level adds something to the model you can see.
- **Mishaps reach them.** A power cut stops anything with a plug, and a storm stops anything that runs on water. The Generator, already planned, is the answer to the first.
- **Combos with the room next door.** The Aura Wash with a Recovery Lounge; the Great Alphorn heard in a Sound Bath Studio.
- **They cost money to run.** Power and parts each month, a bill when one overloads, and expensive upgrades, so a settled center's money has somewhere to go.
- **A down machine stops drawing guests,** and the toast says who is stuck in its line and what will clear it.
- **By-products earn standing, not money.** The Cider Press's cider earns reviews; the Pin Press's framed outlines earn prestige.
- **They bring guests as any room does.** Once arrivals grow with each staffed treatment room, a machine room brings its share like any other, with no special rule of its own.

## Where to start

After the balance work: demand that grows with each staffed treatment room, and a sink for the late money, so the machines can be priced against both. Then the Kneadmaster 9000 at Willow Lane. It is the least silly, so it tests the machinery without the joke doing all the work. It belongs to the first center, so most players see it. And everything the later machines need (walking in, a gag played over the session, its own ailments, an overload) can be built for it first. [machine-plan.md](machine-plan.md) sets out that order.
