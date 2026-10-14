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
- [ ] **More than one sandbox.** A campaign of centers in different places, each with its own map, goals and twist, as Two Point Hospital does with its hospitals, alongside a free sandbox with its own settings. Draft design in [campaign.md](campaign.md), waiting on the decisions at its end.
