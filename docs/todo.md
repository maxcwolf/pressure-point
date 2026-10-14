# To do

Work planned for the game itself. Bugs and risks found in the October 2026 audit are in [known-issues.md](known-issues.md).

Tick an item off when it is done, with the commit or release it landed in.

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
- [x] **More than one sandbox.** A campaign of centers in different places, each with its own map, goals and twist, as Two Point Hospital does with its hospitals, alongside a free sandbox with its own settings. Designed in [campaign.md](campaign.md). All four phases are done: Willow Lane, The Exchange and Saltmarsh, karma and achievements, and sandbox settings.
- [ ] **High Pines and The Orchard Estate**, the fourth and fifth centers, as planned in [campaign.md](campaign.md).
- [x] **Resize a built room**, by dragging its walls, as Two Point Hospital's room editing allows. Done: Resize in the room's inspector; the door and windows move with their walls, the furniture has to stay inside, the room keeps its minimum size, and floor added costs $200 a tile, with half back for floor given up.
- [x] **Room walls against the building's outer walls.** The outer wall's own window panes sit at fixed spots, so a room built against it cuts through them, and the room's windows sit inside the outer wall and look doubled. The outer wall should leave its panes out where a room's wall runs along it, and a room's windows on that side should be set into the outer wall instead of a second wall in front of it. Done: a room's side along the outer wall uses that wall, its windows are set into it, and the building's own windows make way.

## From the Two Point audit

The first three picks from [two-point-gaps.md](two-point-gaps.md), which has the rest.

- [ ] **Policy, chances shown, and a queue you can manage** (gaps 2, 3, 4 and 10). A policy screen with the diagnosis threshold (75% today, hard-coded; Two Point defaults to 90%) and a fast-track switch for guests whose condition is already known. A break policy: how many of each role may be on a break at once, and for how long. Each guest's chance of success shown before treatment starts, with Send Home in the guest's inspector. A station's queue in its inspector, to reorder guests or move one to another room of the same type. Any room can be set to high priority, so staff fill it first.
- [ ] **Staff objectives and year-end awards** (gaps 27 and 14). Partway through a game, a member of staff sets an objective with 90 to 180 days to meet it (heal so many guests, earn so much, reach a decor level, go so long without anyone quitting), rewarded with staff morale and karma. An awards ceremony at each year end, with awards for the center and its staff paying money, karma and reputation, and trophies for the Trophy Cabinet.
- [ ] **Experience, promotions and general qualifications** (gaps 8 and 9). Staff earn experience from their work, through five ranks (the skill stars). Each promotion comes with a raise they insist on, and putting it off upsets them. It also opens a qualification slot, up to five, to be filled by training before the next promotion. General courses: Bedside Manner, Motivation and Stamina for anyone, Customer Service for receptionists, Maintenance for janitors, each changing how they work.
