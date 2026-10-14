# Changelog

Each release's notes are taken from its section here. Keep them short.

## Unreleased

- **Fixed:** five rare cases found in the October audit, among them staff on their way out being put back to work and emergency guests counted as sent when they could not get in. The desktop app also turns down permission checks and connects to nothing but itself, and saves now carry a new version number, so older versions of the game refuse them rather than crash.

## v0.7.2

- **Resize a built room:** Resize in a room's inspector lets you drag any wall in or out. The door and windows move with their walls, the furniture has to stay inside, and floor added costs $200 a tile, with half back for floor given up.

## v0.7.1

- **The title screen fits the window:** it sizes itself to the window's height, and Campaign, Sandbox, Load game and Settings now open in place of the menu under the logo, with a Back button (or Esc), scrolling within themselves when they are long.
- **A proper macOS icon:** the app's icon is now a rounded square of its own, with the PPI card filling it, rather than a small card that macOS shrank onto a gray tile.
- **Rooms against the building's walls** use those walls instead of standing a second wall in front of them. Their windows are set into the building's wall, and the building's own windows make way.
- **Loans no longer count toward a bank balance goal,** so a star cannot be bought with borrowed money and paid back.
- **Running out of storage is no longer silent:** a failed autosave says so, once, and a new game is refused rather than started when there is no room to keep the old one.
- **Smoother autosaves:** the title screen's picture of the game is taken only on the way out, rather than at every autosave, which stalled a frame.
- **Fixed:** an emergency under way is called off, not failed, when its treatment is switched off; the desktop app runs one copy at a time, and a browser tab warns when another tab saves over its game; the game saves as the page is hidden, so a phone or Safari closing it loses nothing; a cancelled drag no longer leaves the camera panning; W, A, S and D pan on any keyboard layout; and the same save file can be imported twice.

## v0.7.0

- **A campaign:** Campaign on the title screen leads to a trail of centers, each with its own building, goals and guests. Start at Willow Lane, a small massage-only unit; a star there opens The Exchange downtown, with acupuncture, office ailments and rush hours. Earned stars are kept between games.
- **Saltmarsh,** the third center: a seaside town with seasons (busy summers, quiet winters), seaside ailments, sea air that wears equipment out faster, and reiki.
- **Karma:** campaign stars and eight achievements earn karma, spent in the karma shop or from the Items menu on items that stay unlocked in every center. It unlocks comfort and decor early, and three new items found nowhere else: a Massage Chair, a Bonsai and a Koi Pond.
- **Sandbox** on the title screen starts the open-ended game, as New game did before, now with settings for the starting money, the treatments on offer, and whether everything is unlocked from the start.
- **The announcer speaks:** some announcements are now read out over the center's speakers, after the chime, with the music turned down while they talk.

## v0.6.0

- **Messages take you there:** click a message or the advisor about someone or something, and the camera glides over with it selected.
- **Emergency offers can wait:** put one aside and it shrinks to a button with the days left to decide; press it to accept or decline. The offer itself now shows its countdown too.
- **Items menu filters:** by where an item goes (the corridors or a room) and what it is for (equipment, guest comforts, decor, things for staff).
- **A Stats menu:** charts of guests, outcomes, waiting times, money and reputation, month by month for a year. Choose which to show; the choice is remembered.
- **Guests put off by prices** are now counted on their own, and shown in the Money menu beside the price controls.
- **Morale at a glance:** in the Staff menu beside energy, and a last warning two days before someone quits: an alarm, a ⚠️ over their head and a countdown.
- **Fixed:** a batch of bugs found in an audit, among them refunds for torn-up rooms, saves that could not be read, staff vanishing as they quit and keyboard shortcuts firing on key repeat. The game also runs more smoothly, with lighter trees and music that costs nothing while switched off.

## v0.5.0

- **Reiki**, from the second star: build a Reiki Studio, hire a Reiki Practitioner, and treat eight new conditions with Usui reiki, crystals, sound baths and chakra balancing. It has its own switch in Settings.
- **Fixed:** an acupuncture emergency no longer asks for "Cupping massage" and the like.

## v0.4.1

- **A new title screen**, with the new logo, a picture of your latest game and its stats, and big buttons to get going.
- **An app icon** for macOS and Windows, and one for the browser tab.
- **Toilets get grubby** with use. A filthy one costs guests patience and spoils the room until a Janitor cleans it.
- The Janitor's description now lists everything they do.

## v0.4.0

- **Eight new items:** a Water Cooler and a Fire Extinguisher to start with, then with each star a Mindfulness Arcade, a Bookcase and an Espresso Machine, an Aquarium and a Pool Table, and a Trophy Cabinet.
- Bored guests play the arcade, staff rest faster with espresso, bookcases speed up training and a pool table lifts morale.
- **Fixed:** tea stations and snack machines now wear out with use, as they were meant to.

## v0.3.1

- **Fixed:** a window in a room's near wall is now a full window. Before, only its top showed above the building's outer wall.

## v0.3.0

- **Room blueprints:** furnish a room, add windows and move its door before you pay for it.
- **Windows** on any room, for more prestige.
- Placing furniture shows which square staff use and which guests use.
- Behind the scenes: reorganized code, a rebuilt interface and a sandboxed desktop app. Saved games carry over.

## v0.2.0

- **Acupuncture:** a new clinic, the Acupuncturist, four techniques and eight conditions, from the first star.
- **Settings:** switch acupuncture on or off, alongside sound and music.
- **Main menu and Exit** buttons in the pause menu, which Esc now opens.
- **Fixed:** clicks that drift a few pixels are no longer ignored.

## v0.1.2

- **Saved games:** named saves, with export and import, alongside the autosave.
- The layout now fits narrow browser windows.

## v0.1.1

- **New systems:** room prestige and decor, staff morale and raises, equipment wear, loans and prices, a Posture Lab, and emergencies.
- Items can be moved. Sound and music switches on the title screen.
- **Fixed:** furniture can no longer wall people in.

## v0.1.0

- First release: reception, consultation, massage with five modalities, training, staff, and star objectives.
