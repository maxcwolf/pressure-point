# More land, the Two Point way

A plan for making buying land feel like it does in Two Point Hospital and Two Point Campus. The first version, shipped in 0.25.0 on 15 October 2026, sold strips from the Money menu's Land tab: it worked, but it was a stopgap. This plan is for doing it properly, even where that means refactoring the game's model of the building, the renderer and the tests.

The phases at the end are each meant to ship on their own, with all tests green. Phases 1 to 6 are done and shipped in 0.27.0; phase 7 is for later. How far each got is noted under it.

## Where we started, in 0.26

- **One rectangle per building.** `Plot` (`core/data/map.ts`) is `x0..x1, y0..y1` plus a two-tile front door. Every center has one, fixed in `core/data/centers.ts`.
- **Land is strips.** `GameState.land` lists sides bought (`'west' | 'east' | 'back'`). `plotWith()` (`core/land.ts`) grows the rectangle by up to 4 tiles per purchase. The front never moves.
- **Bought from a menu.** The Money menu's Land tab lists the strips with a price. While it is open, the strips are tinted on the ground with floating For Sale sprites (`render/land-signs.ts`).
- **One fixed map.** The lot is 32 × 24 tiles for every center (`W`, `H` in `core/data/map.ts`). The street runs along the front at rows 20 to 22.
- **People walk in from the ends of the street.** `streetTile()` (`core/sim/chars.ts`) starts every guest, member of staff and visitor at x = 0 or x = W − 1. People leave by walking back to one and are removed when they reach it. So the map's width sets how long everyone walks, and so the pacing of every seeded test.
- **The camera turns.** It looks from any of four corners (`render/turn.ts`). The outer walls facing it are cut low and the ones across the building stand tall, so which walls are tall depends on the turn (`nearSides(turn)`, `shellWalls()` in `render/scenery.ts`).

## What Two Point does

**Two Point Hospital**

- Each hospital has extra plots around the starting building. They show as construction sites once they can be bought.
- Clicking a site shows its price, and buying it adds a ready-made building.
- Plots are designed by hand for each map. They are often whole separate buildings, linked across outdoor space, so hospitals grow in irregular shapes.
- Some maps sell no land at all, and more plots open as you progress. The numbered plots are part of the campaign's achievements.
- Sources: [Twinfinite](https://twinfinite.net/guides/two-point-hospital-buy-more-buildings-how-to/) and Steam discussions ([1](https://steamcommunity.com/app/535930/discussions/0/1737715419909396845), [2](https://steamcommunity.com/app/535930/discussions/0/1743356517520544766)).

**Two Point Campus** goes further. Sources: [Two Point Studios' creativity tools breakdown](https://www.twopointstudios.com/de/node/1888) and [Gamer Guides](https://gamerguides.com/two-point-campus/guide/getting-started/basics/how-to-buy-new-plots).

- Plots are found on the map itself. Hovering one shows a dotted outline, and clicking it shows its cost and build time. It can be bought while paused.
- A construction fence goes up and the work takes time. Nothing happens until the game is unpaused.
- A plot can be bought with its ready-made buildings or as a blank lot. You drag out a building's footprint the way you drag out a room, and edit buildings later without moving anyone out.
- The grounds are yours too: paths, lawns, hedges and fences, and outdoor items like trees, fountains and food trucks.
- Plots can be renamed, such as "Science Block 1."

**To check in the games before building:** what Hospital's plot prices scale with, whether either game lets you sell a plot back, and how Hospital gates plots (star level, a campaign milestone, or both). The sources above don't settle these. They decide details in phase 4, not the shape of the plan.

## The gaps

1. **Plots are not places.** Ours are strips worked out by arithmetic, not plots designed for each center with a shape and a character. A courtyard wing, a back annex or the shop next door would all qualify.
2. **No separate buildings.** Everything is one rectangle, so a center can never become a cluster of buildings with outdoor space between them.
3. **Bought from a menu, not from the world.** Two Point has you find a plot on the map, hover it for its outline and price, and click it to buy.
4. **No construction.** Land is usable the moment it is paid for.
5. **No room for the sandbox.** The map is the same size everywhere and the sandbox building nearly fills it, so it can grow by only 2 to 3 tiles on each side.
6. **Plots open only with the first star.** Two Point opens them over a center's progression.
7. **The outdoors is scenery.** Nothing can be built or placed outside.

## Target design

My recommendations, each open to Max's call (see [Decisions to make](#decisions-to-make)).

- **Hand-designed plots per center.**
  - Each center lists its plots in data. Each plot has:
    - an id and a name,
    - a footprint (one or more rectangles),
    - a price,
    - the star that opens it,
    - how it joins the building: sharing a wall, or as a separate building with its own entrance and a path to the main one.
  - Willow Lane might get the empty unit next door. The Exchange might get an upper-floor annex (still on the ground: no floors) and a courtyard block. The Boardwalk might get a beach-facing wing.
- **Buy from the world.**
  - An **Expand** button opens a mode where every plot for sale is outlined, with a For Sale board standing on it. The boards are models, not floating sprites.
  - Plots not yet open show the star that opens them.
  - Hovering a plot shows its name, size and price, and clicking it opens a confirmation. It works while paused, as in Campus.
  - The Land tab goes, or becomes a list that points into the world.
- **Construction time.** A fence and a few days' work before the plot can be built on. It's cheap to add once plots are places, and it gives buying some weight.
- **Bigger lots.** Each center has its own map size, with room for its plots. The sandbox gets a real neighborhood.
- **Separate buildings and the outdoors between them.**
  - Paths connect a plot's entrance to the street and to the other buildings. Guests and staff walk outside between buildings, which brings in the weather.
  - Outdoor items and drawing your own paths come later, Campus-style.
- **Later, perhaps: draw your own building** on a blank plot, the way a room is dragged out. This is Campus's biggest step beyond Hospital, and it lands naturally once buildings are footprints.

## What has to change

### The building model (`core/`)

- **Plot to footprint.**
  - Replace `Plot`'s rectangle with a footprint: the set of tiles inside the building, built from the rectangles of the center's base building and its bought plots.
  - Keep a mask (`Uint8Array`, one byte a tile) in `World` for fast lookups.
  - `inPlot()` and `World.inside()` read the mask.
  - `plotFits()` becomes a check per tile: inside the map, off the street, and every building reachable.
- **Entrances.**
  - Today there is one front door (`Plot.door`, with `outsideDoor()` and `lobbyTile()`). Each building gets its own entrance.
  - Guests and staff pick the nearest door to wherever they are headed, so `lobbyTile()` takes a destination.
  - The connectivity check in `World` (`world.ts`, around the `need(W - 1, SIDEWALK_Y)` line) must cover every entrance.
- **Outdoor zones.**
  - `Z_OUTSIDE` covers only the sidewalk and the path to the one door. It becomes a real outdoor area: paths between buildings, walkable, with the outdoor temperature.
  - `core/sim/warmth.ts` and `core/sim/spread.ts` treat the outdoors as outside, so walls between a building and a courtyard insulate.
- **State and saves.**
  - `GameState.land` becomes a list of plot ids, with construction in progress tracked per plot.
  - `upgradeSave` turns the old sides (`LandSide[]`) into equivalent rectangles: a "legacy strip" plot kind, so a building grown today keeps its exact shape.
  - This has to happen in phase 3, before any map changes size, not in phase 4. `LAND_LIMITS.east` is `W - 2`, and the last strip on a side takes whatever room is left (`nextPlot()`). So if a map got wider while saves still held sides, a save that bought land to the east would grow by more tiles. Work the strips out with the old map size and the center's own limits (the Boardwalk's `land: { back: 3 }`), store them as rectangles, then shift them with the rest of the save.
  - The save version goes up again.
- **Map size per center.**
  - `W` and `H` stop being constants and become the center's.
  - Imported today by `core/world.ts`, `core/data/map.ts`, `core/sim/chars.ts`, `core/sim/context.ts`, `core/sim/spread.ts`, `render/camera-math.ts`, `render/floor.ts`, `render/heatmap.ts`, `render/scenery.ts`, `render/snowfall.ts` and `app/game.ts`.
  - `tileIdx()` and `inBounds()` become methods of `World`, or take the width.
  - Every grid array (`zone`, `blocked`, the pathfinder's buffers, and `ctx.attract`, `ctx.noise` and `ctx.warmth`) is sized from it.
- **Arrivals that don't depend on the map's width.**
  - `streetTile()` starts people at a fixed distance along the sidewalk from the nearest entrance, not at the map's ends.
  - That spot will usually be in plain view, partway along the sidewalk. Today people leaving vanish where they reach it, and arrivals pop up there. So arriving and leaving need a short fade, or a walk off the map that the sim doesn't count, so walking time stays independent of the map's width.
  - This must come before any map grows. It is the one change that moves every seeded test, so it should move them once, on its own.
- **Growing the map at the back or the west moves the origin.**
  - Saves store absolute tile positions. A center whose map grows toward x < 0 or y < 0 needs every coordinate in an old save shifted:
    - rooms, with their doors and windows,
    - items,
    - every person's position, target and path,
    - litter,
    - visitors,
    - queued spots.
  - Write it as one `shiftSave(s, dx, dy)`.
  - Make a coordinate added later impossible to miss. Types don't exist at runtime, so a test can't walk them. Instead, give each saved type an exhaustive map of its fields to `'shift'` or `'keep'` (a `Record<keyof Room, …>` and so on), so a new field fails to compile until someone decides. Watch for the tuples: `Waypoint` is `[x, y, pose]`, and `Destination` is `[tx, ty, px, py, hasPose]`, whose last entry isn't a coordinate.
  - Test it on a save that has every kind of coordinate filled in.
  - Prefer growing maps east, or out past the road, where that avoids a shift. It can't always be avoided.

### Drawing (`render/`)

- **Outer walls from edges.**
  - `render/scenery.ts` builds the shell as four boxes from `x0..x1, y0..y1`. Instead, a pure function walks the footprint mask and returns wall segments: tile edges with inside on one side and outside on the other.
  - Each segment faces out one of four ways. It is low when that side faces the camera at the current turn (`nearSides(turn)`) and tall otherwise, the same cutaway rule as now. A wall facing away from the camera always has the building on the camera's side, so a tall one only ever hides the outdoors.
  - Corners need joins. At an outside corner, keep `shellWalls()`'s rule for which wall runs on over it: a tall wall before a low one, and along x before along z. That's what keeps phase 1's screenshots unchanged at every turn. Inside corners (an L, or round a courtyard) are new, and need a rule of their own.
  - Test it as plain data, like `render/outer-walls.ts` is, at all four turns.
- **Windows in the tall walls** (`outerPanes()` in `render/outer-walls.ts`) come from the tall segments rather than the four sides. `render/rooms.ts` places each pane at `plot.x0`, `x1`, `y0` or `y1`, so it takes the segment's position instead.
- **Room walls along the building's edge.** `alongOuterWall()` (`render/room-walls.ts`) compares a room with `x0`, `x1`, `y0` and `y1` and answers per side, as a `Record<Side, boolean>`. Once outer walls are segments, a room's side can lie partly along one, so it should answer per stretch of the room's side.
- **What is keyed or placed from the rectangle.** `plotKey()` (`render/shared.ts`) tells layers when the building has grown, and becomes a key of the footprint. The center's sign (`signSpot()`, `render/sign.ts`) and the rival's storefront across the street (`storefrontSpot()`, `render/storefront.ts`) stand by `plot.door`, and need to keep to the main building's entrance once there are more.
- **Floor, overlays and the heatmap** loop over `plot.x0..x1, y0..y1` in places (`ui/lib/overlays.ts`, `render/floor.ts`). They should loop over the footprint.
- **Scenery.**
  - `keptClear()` keeps trees off the footprint, the plots for sale (until bought, when a fence replaces them), the paths and the street.
  - The scenery already rebuilds when the building grows (`View.growScenery`), and that stays.
- **For Sale boards and construction fences**, as models in `render/models/`. Boards sit in the plot, not floating.
- **Camera.** The starting target is the footprint's middle, and `keepNearMap()` uses the center's map size.

### The interface (`ui/`, `app/tools/`)

- **An Expand tool** in `app/tools/`, beside the build tools. Hovering picks a plot (a new kind in `render/picking.ts`), the ground shows its outline, and a tooltip gives its name, size, price and star. Clicking opens a confirmation dialog.
- **Retire the Land tab**, or keep it as a list where clicking a plot glides the camera to it. The floating For Sale signs (`render/land-signs.ts`) and the heatmap's amber `'land'` palette (`render/heatmap.ts`) go with it, unless the Expand tool reuses the palette for its outlines.
- **A plot's own panel** once bought: its name (renamable), its construction progress, and its rooms.

## Tests to refactor

- **Seeded tests.**
  - Moving arrivals off the map's ends changes how long everyone walks, which shifts most seeded tests in `tests/unit`.
  - Do it in its own commit. Go through each failing assertion and decide whether the new value is right before updating it, rather than accepting new numbers wholesale.
  - Record anything odd in `docs/known-issues.md`.
- **Absolute layouts.**
  - `tests/unit/helpers.ts` places every test room at fixed tiles (`LAYOUT`, used about 40 times) that assume the sandbox building at `x0 = 3, y0 = 3`.
  - If the sandbox's map or building moves, give `LAYOUT` positions relative to the building's corner through a small helper, so the tests survive any later change of lot.
- **End-to-end fixtures.**
  - `tests/e2e/fixtures.ts` finds free spots inside `BX0..BX1, BY0..BY1`, now live getters on `pp.data` in `app/game.ts`. Give it the footprint's tiles instead.
  - `buildCenter()` places rooms at fixed coordinates too, so it needs the same relative positions.
- **Screenshots.** Every scene picture changes once walls come from edges and maps change size. Re-take them and look at each one, as usual.
- **New tests.**
  - Footprint edges and wall segments, as pure data: rectangles, L shapes, two buildings, a courtyard.
  - Every center's plot data is valid: inside the map, off the street, not overlapping another plot, every building reachable, and every star that opens a plot one the center has.
  - Old saves: the legacy strips keep their exact shape, and `shiftSave` moves every coordinate.
  - The Expand tool: picking, the dialog, buying while paused, construction finishing.
  - Walking between buildings outdoors, in the cold.

## Phases

Each phase ships on its own with everything green, in this order.

1. **Footprints, no change in play.**
   - `Plot` becomes a footprint built from rectangles, and today's strips become rectangles in it.
   - Walls, windows and room walls come from edges, at every turn of the camera.
   - Floor and overlays loop over the footprint.
   - Screenshots should not change. That is the test of the refactor.
   - **Done.** `core/footprint.ts` holds the footprint, its runs of wall and their corners, and `World.indoors` the mask. The scene's screenshots did not change.
2. **Arrivals from near the entrance.** `streetTile()` stops depending on the map's width, people fade in and out or walk off, and the seeded tests are re-checked once.
   - **Done.** People arrive and leave `STREET_WALK` (14) tiles along the pavement either side of the door (`streetEnds()` in `core/sim/chars.ts`), and grow from nothing or shrink away over the last tile (`streetFade()` in `render/people.ts`). One seeded test moved: half price earned more than full price on its one seed, as seed 7 already did before, so it now adds up three seeds.
3. **Map size per center.**
   - Old saves' strips become legacy-strip rectangles first, worked out on the old map (see [State and saves](#the-building-model-core)).
   - `W` and `H` become the center's, with `shiftSave` for any center whose origin moves.
   - The sandbox and the tighter campaign lots get room.
   - Until phase 4, the Land tab keeps selling strips, now with the new limits.
   - **Done.** Lots grow east only, so no center's origin moved and no `shiftSave` was needed; it waits for the first center that grows west or back. Every lot keeps its depth (`H`, 24) and its street; each center sets its own width (`width` in `CENTERS`, 32 unless it says): the sandbox 44, The Boardwalk and The Orchard Estate 40, The Exchange and High Pines 36, Willow Lane 32. The `World` keeps its own `w` and `h`, with `idx()` and `onMap()` in place of `tileIdx()` and `inBounds()`. Land is saved as rectangles (`Land` in `core/data/map.ts`), and save version 25 turns the old sides into strips worked out on the 32-tile lot they were bought on (`stripsBought()`). No seeded test moved.
4. **Hand-designed plots.**
   - Plot data per center, opened by stars or campaign progress, priced by hand.
   - The Expand tool, For Sale boards and the confirmation dialog.
   - The Land tab retires.
   - **Done.** Each center lists its plots in `CENTERS` (`PlotDef` in `core/data/map.ts`): two to four, each with a name, a blurb, its rectangles, a price and the star it opens at, and some only once another plot is the game's (`after`). The Exchange's wraps around a courtyard that stays outdoors. `plotOffers()` in `core/land.ts` says which are the game's, for sale or not yet, and prices a plot by its tiles the building has not already grown into, so old strips count. The 🏡 Expand button beside Rooms outlines the plots on the ground, names the one pointed at and its price, and a click asks to buy it (`BuyPlotDialog`). Every plot not yet the game's has a board on it: FOR SALE, the star it opens at, or SOON (`render/for-sale.ts`). The Land tab stays, as a list of the plots with Show me, which takes up Expand and glides the camera to the plot; a plot's own panel waits for phase 5, when it has progress and rooms to show.
5. **Construction.** A fence and a few days' work before a plot can be used.
   - **Done.** A plot bought is saved with the day the builders finish (`ready` on its `Land`): a day for every 20 tiles, and three at least (`buildDays()`), only while the game runs. Until then it stays outdoors, bare earth fenced off with SOLD on its board (`render/land.ts`, `render/models/fence.ts`), and a plot that comes after it waits for it. Then `updateLand()` grows the building into it. A bought plot has a panel of its own in the inspector, picked from its site, with Expand, or with Show me in the Land tab: its name, which can be changed, the builders' progress, then the rooms on it.
6. **Separate buildings and the outdoors.** Entrances per building, paths, guests and staff walking outside, and weather on the way.
   - **Done.** A plot can stand apart as a building of its own, with an `entrance` and a `path` of paving to the pavement (`PlotDef` in `core/data/map.ts`). Three do: the sandbox's garden pavilion, The Boardwalk's ice-cream parlor and The Orchard Estate's orangery. The footprint lists every entrance and path (`buildingsOf()` in `core/land.ts`). The `World` lays the paths as outdoors, puts a door at each entrance, numbers the buildings (`buildingAt()`), and checks every entrance can be reached. Outer walls hold back noise and warmth between buildings as a room's walls do (`spreader()`'s `outer`), and outdoors is as warm as the weather. Guests walking a path in a storm, or more than 15°F from just right, feel it (`core/sim/outdoors.ts`). Every entrance has a gap in its wall and lamps either side.
   - A plot standing apart starts at x 32 or beyond, clear of the strips an old save could hold, which reached x 30 at most; otherwise an old strip would join it to the building. The data test checks this against a building grown as far as strips ever went. A plot old strips cover whole is the game's already, and naming it notes it as land with no tiles of its own.
   - Each building's door faces the street, with its path straight to the pavement. A path between two buildings is always behind one of their tall walls, whichever way the camera turns, so nobody would see it walked. Guests still arrive at the front door and are seen at reception there. No seeded test moved.
7. **Later, Campus-style:** drawing your own building on a blank plot, paths, and outdoor items.

Phases 1 to 4 deliver most of the Two Point Hospital experience: plots found and bought in the world. Hospital's plots are often separate buildings, though, and those wait for phase 6. Phases 5 to 7 reach toward Campus.

## Decisions to make

- **Hand-designed plots, or generated ones?** I recommend hand-designed, a few per center. That is what makes Two Point's maps memorable, and it lets each center's plots fit its setting.
- **What opens a plot?** I recommend stars, per plot, with the first plot open from the start at the bigger centers. Campaign milestones could open some too.
- **Construction time?** I recommend a few in-game days, with a fence. It can be left out if it feels like waiting for nothing.
- **Selling land back?** I recommend no, unless one of the games does. It complicates everything for little play.
- **Separate buildings in the first round, or only joined plots?** I recommend joined plots first (phase 4), then separate buildings (phase 6). Walking outdoors touches the most systems.
- **Bigger lots and more plots, 21 October 2026.** The owner's judgement after the balance passes: the lots are too small, and larger areas to expand are a necessary addition. The playtest bot's games bear it out ([balance-log.md](balance-log.md) entries 37 and 38): in 28 of 30 games a new treatment room stopped fitting 3 to 23 months before the second star, in 23 of them with every plot already bought, and the treatment machines, which unlock at that star and need 4×5 to 3×7 tiles, can then only stand where a table was. The next round: a plot or two more for each center, some opening at the second and third stars, at least one sized for a machine room beside the tables, with the sandbox's spare 15 tiles to the east as the model. Keep the pressure: land is bought with money the center has to make, and the machines' running costs stay, so this is more game to play, not an easier one. The frame-rate caveat below still applies, so measure the bigger lots in the sandbox first.
- **How big should maps get, and which way?** Settled in phase 3: east only, by 4 to 12 tiles. It depends on frame rate: software WebGL in the tests and the draw-call budget. Measure with the sandbox first. Settle it before phase 3: growing west or back means shifting every old save, and growing east or out past the road doesn't. Phases 1 and 2 don't depend on any of these decisions.

## Risks

- **Seeded tests.** Phase 2 changes walking time for everyone. That is why it stands alone.
- **Old saves.** Shifting coordinates is easy to get subtly wrong. A type-driven test and a real save from Max's machine (`~/Library/Application Support/Pressure Point Institute`, copied, never touched) should both pass through it before release.
- **Performance.** Bigger maps mean bigger grids, more trees and longer paths. Check frame time and the draw-call budget in `tests/unit/model-cost.test.ts`.
- **Scope.** Phase 6 touches pathing, warmth, noise, weather and every system that assumes "inside." It is the one to pause before.
