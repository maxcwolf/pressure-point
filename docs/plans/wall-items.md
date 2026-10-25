# Wall items, and better windows

A plan, 16 October 2026, for two pieces of work that share the same walls:

1. **Wall items.** Things you buy and hang on a wall rather than stand on the floor: posters, charts, a clock, paintings, a television. They take no floor space, so a cramped room can still be made finer.
2. **Better windows on the outside walls.** The building's own windows, and room windows set into the outside walls, look unfinished today, and they behave differently depending on which way the camera faces.

No new kinds of window: windows stay one kind, bought from a room's inspector as now. Only how they look changes.

## Where we are

**Walls.** A room's walls sit just inside its edge tiles (`render/room-walls.ts`), 0.12 thick and 1.25 high, or 0.3 high when that side faces the camera (`nearSides(turn)` in `render/turn.ts`). The building's outer wall sits just outside the building's tiles, 0.28 thick and 2.0 high, or about 0.4 when cut low. It has no game state: it is worked out from the footprint (`wallRuns()` in `core/footprint.ts`, drawn by `render/outer-walls.ts` and `render/scenery.ts`). A room side along the outer wall has no wall of its own: the outer wall stands in for it.

**Windows.** A window is a `WallSpot` (`{x, y, dx, dy}`: the room tile inside, and the way out) in `Room.windows`, $150 each. Each one adds a little prestige and lets in noise. Windows move, turn and copy with their room, and are kept in templates. Nothing is ever hung on a wall today. Picking never hits a wall: wall tools find the nearest edge of the room from the point on the floor (`World.nearestDoor()`).

**What the camera sees.** At any turn the walls on the far sides stand tall and the near ones are cut low. A tall wall always faces the camera with its inner face. So:

- a room's inside faces are seen on its far walls;
- the outer wall's inside face is seen along the far sides of the building;
- the corridor face of a room's wall is never seen standing tall. Its far walls face away from the camera, and its near walls are cut low.

That last point shapes where wall items can go.

## What's wrong with the windows today

Seen in the sandbox at turns 0 and 2:

1. **The building's own windows look like stickers.** They are flat pale-blue boards 1.5 wide, every third tile along the tall outer walls (`outerPanes()`, `render/outer-walls.ts`), floating 0.02 off the wall. They have no frame, no sill and no glazing bars.
2. **They vanish when the wall is cut low.** Turn the camera and the near sides of the building have no windows at all, so the same wall has windows or none depending on the turn.
3. **Room windows in a low outer wall stand up like a fence.** On a low wall, a room's window keeps its full sill and pane, about a tile high, above a wall 0.4 high, with jambs at every tile. A row of them reads as a railing or a hutch, not a window.
4. **Two styles on one wall.** Along a tall outer wall, a room's window has a framed pane with jambs in the room's trim color, set among the building's frameless panes. The two do not look like the same building.
5. **Side-by-side windows don't join.** Two room windows next to each other are two frames with a doubled jamb between them, rather than one wider window.
6. **The glass is flat.** One pale blue, with no hint of sky or reflection, so it reads as a blue panel.

## Target design

### Windows

- **One window for the outside walls.** The building's windows and room windows in the outer wall are the same model: a frame in the building's trim color, glazing bars, a sill inside and out, and glass with a soft sky gradient and a glint. A room's window in the outer wall is drawn as a building window. The room's own trim shows only on its inside sill.
- **Cut low, a window is cut too.** On a low wall, a window is drawn as its cut section: the sill, and the frame and glass up to the top of the wall. It doesn't vanish and doesn't stand up. This applies to the building's windows, room windows in the outer wall, and (decision 3) room windows in inner walls too.
- **Neighbours join.** Windows next to each other along a wall are drawn as one wide window, with a glazing bar where they meet.
- **The building's windows become game facts.** Where they go moves from `render/outer-walls.ts` to `core/footprint.ts`, so the game knows which spots of the outer wall have a window. A wall item can't be hung over one. A room against the outer wall still loses the building's windows along it, as now, and the player gives it windows of its own.

### Wall items

- **Bought from the Items menu, hung on a wall.** The new **On the walls** filter lists them. In hand, the item snaps to the wall face nearest the cursor that it can hang on, with a ghost, a teal arrow showing which way it faces, and R to step along the wall. Esc puts it down, as with any item.
- **Where they hang:**
  - on the inside of a room's walls;
  - on the inside of the outer wall, in corridors.

  Not on the corridor side of a room's walls, which is never seen standing tall (decision 1). Not over a door, a window, or one of the building's windows. One wall item per tile of wall. A two-tile item, such as a tapestry, needs two free tiles side by side.

- **Seen when the wall stands tall.** On a low wall a wall item is drawn as a small colored chip on top of the wall, so it can still be found and clicked. It works the same either way.
- **What they do.** Most add decor, counted for the room or the corridor in front of them just as a floor item's is, so they feed prestige and how pleasant a spot is. A few do something more. The list is below.
- **Like any other item.** Inspector, Move and Sell, and a power cut stops anything with a plug. They move, turn and copy with their room, and are kept in templates. When a room is resized, a wall item on a wall that moves goes with it along the wall, as windows do. One that no longer fits is sold back at half.

## The items

Prices and numbers are first guesses, to be tuned. "Decor" counts like a floor item's.

| Item                      | Icon | Where                       | Cost   | Opens      | What it does                                                                                                                                        |
| ------------------------- | ---- | --------------------------- | ------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Motivational Poster       | 🖼️   | Staff Room, Training Room   | $80    | start      | A kitten on a branch: "Hang in there". A little morale for staff who spend time in the room, from up to two.                                        |
| Landscape Painting        | 🏞️   | anywhere                    | $400   | start      | Decor 3. Each center has its own subject: a willow, the skyline, the pier, the pines, the orchard.                                                  |
| Chakra Chart              | 🌈   | Reiki Studio, Sound Bath    | $250   | star 1     | Decor 1, and treatments in the room work 2% more often. One counts.                                                                                 |
| Meridian Poster           | 🧍   | Acupuncture Clinic, Massage | $250   | star 1     | Decor 1, and treatments in the room work 2% more often. One counts.                                                                                 |
| Wall Clock                | 🕰️   | anywhere                    | $150   | start      | Staff on a break in its room come back sooner. Guests waiting within sight of it lose patience a little faster: they can see how long it is taking. |
| Television                | 📺   | corridor                    | $1,200 | star 1     | Waiting guests within a few tiles lose patience more slowly. Noisy. It has a plug.                                                                  |
| Tapestry (2 wide)         | 🧶   | anywhere                    | $700   | star 2     | Decor 4, and it soaks up a little noise.                                                                                                            |
| Prayer Flags (2 wide)     | 🎏   | anywhere                    | $350   | karma 2    | Decor 2. They flutter.                                                                                                                              |
| Living Wall               | 🌿   | anywhere                    | $1,800 | karma 4    | A panel of ferns and moss. Decor 5. A Caretaker waters it like a plant.                                                                             |
| Wall Fountain             | 💧   | anywhere                    | $2,200 | karma 5    | Water down a slate panel. Decor 5, soothes the noise around it.                                                                                     |
| Certificate of Excellence | 📜   | anywhere                    | free   | each award | One for each award won at the year-end ceremony, to hang where guests can see it: decor 2. The Trophy Cabinet keeps the trophies.                   |

Ten to buy and one earned, so the menu grows without crowding. The Television and the Wall Clock are the two with a real trade-off. The charts are the treatment rooms' version of decor.

## What has to change

### The game (`core/`)

- **Where a wall item hangs.** An `ItemDef` gets `mount: 'wall'`. A wall item is an ordinary `Item`:
  - its `x, y` is the floor tile it faces, so the room or corridor it belongs to, and its decor and prestige, come from the same `zoneAt(it.x, it.y)` as now;
  - its `rot` is the way it faces, out from the wall;
  - a two-tile item runs along the wall from there.

  `World.rebuild()` leaves wall items out of `blocked` and `reserved`, and pathing, claims and access never see them.

- **Which faces are walls.** A pure `wallFaces(world)`, kept up to date in `rebuild()`, lists every wall face something can hang on: room edges facing out, and corridor tiles along the outer wall facing out. It leaves out door spots, windows and the building's windows. `canPlaceWall(type, spot)` checks it, and that the wall is free, and where the item may go.
- **The building's windows.** `outerPanes()`, and `against()` beside it, move from `render/outer-walls.ts` to `core/footprint.ts`, so the game knows which tiles of the outer wall have a building window.
- **Windows, doors and wall items keep out of each other's way.** Adding a window or moving a door onto a wall item's spot is refused, with "Take the poster down first" naming the item. Building a room against the outer wall where a corridor wall item hangs is refused too, as a window facing in is now.
- **Moving rooms.** `layoutOf`, `turnLayout` and `placeLayout` turn wall items as they turn the door and windows (`turnSpot`), not as floor furniture. `resizeRoom` carries them along their wall with `carryWallSpot()`, and sells back at half any that no longer fit. `templates.ts` reads and checks them.
- **What they do.**
  - Morale from posters, like the Pool Table's.
  - Treatment chances from charts, as a line in `stations.ts` beside the stale-linens and noise penalties.
  - The clock's patience drain, and the Television's patience boost, in `guests.ts` beside `seatDrain`.
  - Watering the Living Wall goes in with plants. Noise and decor need nothing new.
- **Saves.** New item types, so `SAVE_VERSION` goes up and the save-version fingerprint with it.

### Drawing (`render/`)

- **Wall items.** `ItemsLayer` places a wall item against its wall: on the face, at a height for a room wall or the outer wall, turned to face out. It shows the model when that wall stands tall at the current turn, and the chip when it is cut low. It doesn't re-sync on a turn today (only the rooms do, through `rooms.setTurn`), so `View.turnCamera` tells it too. Each item has a model in `render/models/items/`, as now, with the wall face at z = 0 and the front at +z, and the model lab shows them on a stretch of wall.
- **Windows.**
  - A shared window model (`render/models/window.ts`) draws the frame, glazing bars, sills and gradient glass, tall or cut low, any number of tiles wide.
  - `outerSideBoxes()` and `syncPanes()` use it for the outer wall; `sideBoxes()` uses it for inner walls, if decision 3 says so.
  - Neighbouring window tiles on one stretch are joined before drawing.
  - The glass gets one small gradient texture, shared, so the look costs no extra draw calls.
- **Picking.** Wall items are clicked like other items, through their model, or their chip when cut low.

### The interface (`ui/`, `app/tools/`)

- **Items menu.** An **On the walls** filter, and a "Wall" place label on each card.
- **Placing.** The item tool knows when it holds a wall item: it snaps to the nearest wall face from the cursor, shows the ghost on the wall and the face as a highlight, and gives the reason when it can't hang there. R steps to the next free tile along the wall.
- **Inspector.** As for any item, plus what it does: "Treatments here work 2% more often".

## Tests

- **Unit:**
  - `wallFaces` on rooms of every shape, against the outer wall, beside doors and windows, and with the building's windows;
  - hanging, refusing and selling;
  - windows and doors refused over a wall item;
  - moving, turning, copying and resizing a room with wall items;
  - templates with wall items, old and new;
  - each item's effect;
  - the save version.
- **Rendering:**
  - the window model's boxes, tall and cut low, one tile and joined;
  - where the building's windows go, now from `core/footprint.ts`, the same spots as before;
  - a wall item's place and facing at each turn, and model or chip.
- **End to end:** hang a poster from the Items menu, turn the camera and click its chip, move it, sell it.
- **Screenshots:** the scene picture with the new windows, the Items menu, and a picture of every wall item model.

## Phases

Each ships on its own.

1. **Better windows.** The shared window model, the cut-low rule, joining, and the building's windows moved into `core/`. The game plays exactly as before; only the pictures change. **Done:** one window model (`render/windows.ts`) for every wall, a white frame with glazing bars, a ledge and gradient glass, cut low as a section on top of its wall; neighbours joined; the building's windows worked out in `core/footprint.ts` (`buildingWindows()`) and shown in every wall, whichever way the camera faces. They are now on whole tiles, two wide with two tiles of wall between, centered along each wall, rather than 1.5 wide every three tiles across tile edges, which would have left no free stretch of wall for corridor wall items.
2. **Wall items, the machinery.** `mount: 'wall'`, wall faces, placing, the chip, moving, resizing, templates, saves. Three items to prove it: the Motivational Poster, the Landscape Painting and the Wall Clock. **Done:** `ItemDef.mount`, with a wall item's tiles the floor in front of it and its `rot` the way it faces (`wallSpotsOf()`, `rotFacing()`); `World.wallFace()`, `nearestWall()` and `hungAt()`, and `canPlaceItem()` checking a wall item against them. The building's windows keep away from anything hung in a corridor, so one never comes back over it when a room goes (`World.buildingWindows()`). Resizing carries wall items with their walls and sells any left without one; the building growing over a wall takes down what hung on it (`takeDownLoose()`). Drawn by `render/hung.ts`, as the model while its wall stands tall and a chip on top of it while cut low, redrawn on every turn of the camera. Two changes from the plan: the Motivational Poster goes in the Staff Room only, and lifts everyone's morale as the Pool Table does, rather than only staff who spend time in the room; and R does nothing to a wall item in hand, which always faces out from the wall nearest the cursor. Save version 27.
3. **The rest of the items.** The charts, the Television, the Tapestry, the Prayer Flags, the Living Wall and the Wall Fountain, and their effects and models. **Done:** the charts go in either of two kinds of room (`ItemDef.alsoIn`, `goesIn()`), the Television stops in a power cut and the Wall Fountain in the freeze, and the Living Wall is watered as a plant is (`isWatered()`). One change from the plan: the Prayer Flags, the Living Wall and the Wall Fountain open at stars 1, 2 and 3 rather than for karma, since the campaign hands out exactly the karma its karma items cost. Save version 28.
4. **Certificates.** One earned for each award at the year-end ceremony, hung from the awards dialog or the Items menu. **Done:** each certificate keeps the award it stands for (`Item.trophy`), the ones still to hang are worked out from the trophies (`certificatesLeft()` in `core/certificates.ts`), it is free and taken down rather than sold, and a copy of a room leaves its certificates behind. Save version 29.

## Decisions to make

Each has a default the plan assumes.

1. **Not on the corridor side of room walls.** The camera never sees that face standing tall, so anything hung there would only ever show as a chip. Default: not allowed. Corridors hang things on the outer wall only.
2. **A chip when cut low.** Default: a small colored chip on top of the low wall. The alternative is hiding it entirely, as Two Point does, which makes it hard to find to move or sell.
3. **The cut-low window rule inside too.** Default: yes, inner room windows get the same model and rule, so every window in the game looks alike.
4. **The building's windows stay where they are.** Default: yes, every third tile as now, now known to the game. The alternative is letting the player add and remove them, which is the custom windows we are leaving out.
5. **Certificates are free and earned.** Default: yes, one per award, so the awards leave something in the building.

## Risks

- **Wall items aren't floor items, but share their type.** A lot of code takes an item to stand on its tiles: blocking, access, claims, rugs under furniture, the restless-player test's moves. Each check has to skip wall items. The chaos test and `inconsistencies()` cover most of it, and phase 2 adds wall items to the restless player's moves.
- **Draw calls.** Joined windows and one shared glass texture keep phase 1 level. Wall items are small models like any other, so `model-cost.test.ts` will need a little more budget.
