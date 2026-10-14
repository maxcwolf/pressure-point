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

## Roadmap

The phases in [roadmap.md](roadmap.md), from the gaps in [two-point-gaps.md](two-point-gaps.md). Its decisions to make are still open.

- [x] **Phase 1, taking charge:** policy, chances shown, send home, a queue you can manage, room priority. Two Point's fast-track switch has nothing to do here, since guests already go straight to treatment once diagnosed, so it became calling emergencies first.
- [x] **Phase 2, goals along the way:** staff objectives and year-end awards. Challenges pay money and morale rather than karma: karma is earned once per star and achievement, and a repeatable reward would let a replay farm it.
- [x] **Phase 3, staff careers:** experience and promotions, general qualifications, job assignment, a hiring pool that grows, traits you can see.
- [ ] **Phase 4, reading the center:** guest feelings, reviews and reputation in parts, the casebook, overlays.
- [ ] **Phase 5, the spa business:** prices per treatment, a retail counter, marketing, house calls.
- [ ] **Phase 6, stakes:** a worsening condition, bad vibes, a stress outbreak.
- [ ] **Phase 7, comfort:** calm, fresh linens, temperature and staff needs. Then High Pines.
- [ ] **Phase 8, visitors and rivals:** VIPs and the inspector, the center's standing, a rival spa. Then The Orchard Estate.
- [ ] **Phase 9, events:** a mishap per center.
- [ ] **Phase 10, building tools:** move and copy rooms, templates, decorating rooms, camera rotation, more land.
- [ ] **Phase 11, the long game:** machine upgrades, new rooms, regulars, treatment gags, a radio, game settings.
- [ ] **Way down the line:** a server for community research and other players' institutes as rivals and VIPs.
