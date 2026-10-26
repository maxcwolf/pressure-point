# Pencilled rooms

A plan, 26 October 2026, for letting players lay out their center before they can pay for it. Phase 1 is built in this branch; phases 2 and 3 come later, each in a session of its own.

What a player wants: "I know I want another Consultation Room in that corner at the second star, but I don't want to pay for it now, and I don't want a bench ending up there." Today the only way to keep a space is to build the room, or to remember.

## The idea

A **pencilled room** is a sketch of a room on the floor: a kind of room, a rectangle and a door. It costs nothing, does nothing, and holds its space until the player builds it or erases it. Nothing else may be built over it.

Three other ways were weighed and turned down, and are not to come back by the side door:

- a free paint layer, as in RimWorld, where any tiles can be marked for anything;
- blueprints that stay open, walls and furniture and all, without being paid for;
- template ghosts: a saved room put down as a placeholder, furniture included.

A sketch is footprint and door only. It is the smallest thing that answers the question.

## Words

In the interface it is "pencil in", "pencilled in" and "sketch". Never "plan" (the blueprint's `phase: 'plan'` already means something), never "reserve" or "reserved" (`World.reserved` already means door and access tiles), never "blueprint" (that is the thing you pay for). In code the thing is a `Sketch`.

## Decisions

1. **It does not block walking.** It is paint on the floor. Nobody paths round it, and `World.lay`, pathing, upkeep, prestige, standing, demand, assignments, the inspector, VIPs and the bot never see it.
2. **Where it can go.** Inside the building, by the rules a room's floor follows, or wholly on one plot of land that is not yours yet. Nowhere else outdoors, and not half on each. Phase 2 decides what happens when the plot is built on; until then a sketch there just stays.
3. **Footprint and door only.** No furniture.
4. **Nothing is built over it.** An item whose footprint or access spots touch a sketch, a room or another sketch drawn over one, and a room resized into one are all turned down with the sketch named ("That's pencilled in for a Consultation Room. Erase the sketch first."), with the usual shake and pulse, and the sketch is selected so its Erase button is one click away. Nothing clears a sketch on its own.
5. **No list yet.** The Pencil in tab in the Rooms menu says "3 pencilled in · $9,500 to build them all": each sketch at what a room that size costs (`roomCost`, the same as the drag hint and `finishCost`).
6. **Campaign and sandbox, every center, from the start.** The tutorial pays it no mind: its ring and its steps never follow the sketch tool. One first-time tip as the first sketch lands: "Pencilled in. Click it and press Build here when you're ready. Nothing is charged until then."

## State

`GameState.sketches: Sketch[]`, each `{ id, type, x, y, w, h, door, day }`, with the door a `WallSpot` and `day` the day it was drawn. Sketches are not rooms, so nothing that reads `s.rooms` sees them. The save version goes up; an older save gets an empty list, and a sketch of a kind of room this version has never heard of is dropped.

## The three ways in

**A. The Rooms menu.** A third pill, "✎ Pencil in", beside Rooms and Templates. While it is on it is orange, a line under the tabs says "Drag a room out to keep its space for later. Nothing is charged until you build it.", the room cards keep their prices, and a card picks up the sketch tool for its kind of room rather than the room tool. Locked cards stay locked. Under the cards, one line counts the sketches and what they would cost. Esc, or the pill again, turns it off.

**B. The sketch tool.** `{ kind: 'sketch', phase: 'drag' }` then `{ kind: 'sketch', phase: 'door' }`, the room tool's two first steps: the same drag, the same green and red tiles, the same minimum size, plus the plot allowance. The hint names the price it will cost one day and says nothing is charged now. The door is any wall of the rectangle where a room's door could go, or on a plot for sale any edge at all. A click on the door puts the sketch down with the placement sound and keeps the tool in hand for another of the same kind, until Esc. Esc in the door step goes back to the floor.

**C. The blueprint, rescued.** The blueprint panel gets "✎ Pencil in for later" between Cancel and Build room: it keeps the floor and the door as a sketch, refunds the windows and extras as Cancel does, closes the blueprint and selects the sketch. When the bank cannot cover the blueprint, the panel says so: "You have $2,340: not enough to build this yet."

## On the floor

Painted into the floor's canvas after the rooms, at no cost in draw calls: the room's trim as a faint fill, diagonal hatching, a dashed outline over a cream one, and the door as an orange stretch of edge. Its label (the room's icon, name and "pencilled in · 4×4") is HTML placed over the floor each frame, as floating money is. Selected, it has the gold outline a selected room has, just inside its edge, and hovered it has the room's faint sheet.

## Its panel

Click a sketch (on its floor, when no person or item is in front of it) and the inspector shows: its icon and name with a dashed "✎ pencilled in" chip; chips for its size, what it costs to build, and "✔ Fits here today" or "⚠ Doesn't fit today" with the reason, checked again whenever the world changes; a line saying the day it was drawn, who it needs once it opens, and that nothing can be placed on it; and **Erase**, **Move** and **Build here · $4,000**.

- **Erase** takes it away. No confirmation: it cost nothing.
- **Move** erases it and puts the sketch tool for its kind in hand, the hint saying to drag it out again.
- **Build here**, where it fits, goes straight to the blueprint in that rectangle with that door, the first required item in hand, as the door click of the room tool does; where the bank cannot cover the room it is turned down with the usual line and the sketch stays. Where it no longer fits, it opens the room tool in its drag step with the sketch's rectangle as the drag, so one click takes it or a drag replaces it, and the sketch is kept until a room lands on its tiles. That is the one build allowed onto a sketch: its own. A blueprint opened from a sketch and then cancelled puts the sketch back.

## Rules

In `core/build-rules.ts`: `sketchAt(world, x, y)` and `sketchOverlap(world, rect)`, read-only, and one more check each in `canPlaceItem` (footprint and access spots, on the floor or on a wall), `roomRectValid` (with a sketch's id passed to spare its own build), `resizeValid`, `onGrounds` for things outdoors, and the sketch drag itself, which may not overlap another sketch or a room. Templates and moved or copied rooms go through `roomRectValid`, so they are turned down too.

## Play statistics

`sketch_drawn`, `sketch_built` and `sketch_erased`, found the way `room_built` is, by comparing the game with how it last stood, and new `action_refused` actions for the sketch tool (`draw_sketch`, `place_sketch_door`, `build_sketch`), never the room tool's.

## Phases

1. **Pencilled rooms** (this branch): everything above.
2. **A fit that keeps up.** A sketch rechecks whether it fits as the world changes, says so on its label ("⚠ doorway blocked", amber), and the Pencil in tab's line counts the ones that no longer fit. A sketch on a plot is carried into the building when the builders are done, or flagged if it no longer fits.
3. **Sketches that remember a room.** A sketch can carry a saved template, built whole when it is built, and a Plans overlay shows every sketch at once.

## Phase 2: a fit that keeps up

A plan, 26 October 2026, for the second phase, built in a branch of its own after phase 1 was merged.

1. **One answer, worked out once.** `world.sketchFit(sk)` says where a sketch stands: it **fits**; it **waits** for its land (it is on a plot not built on yet, so there is no floor to judge it on); its **doorway is blocked** (its floor is free, but the tile its door opens onto is not corridor, has something on it, or is another sketch); or it **no longer fits** (its floor is taken, or the room would cut someone off). The answer is kept per sketch until `world.version` or the grids change, so the floor, the labels, the count line and the panel share one check and none of them pays for it twice. `world.sketchFits` is the same answer as a plain check, as phase 1 had it.
2. **On the floor.** A sketch that is blocked or no longer fits is painted amber (`#c98a1a`) in place of its trim: the wash, the hatching and the dashed outline. Its door keeps its orange. Its label's small line reads "⚠ doorway blocked" or "⚠ no longer fits" in place of "pencilled in · 4×4", the label in the warn colors with an amber edge. A sketch waiting for its land is painted and labelled as one that fits: nothing has gone wrong with it.
3. **The count line.** "3 pencilled in · $9,500 to build them all · one no longer fits", or "· 2 no longer fit". Blocked doorways count; sketches waiting for land do not.
4. **The panel.** A sketch waiting for its land says "⌛ Waits for its land" with the reason ("That land is not yours yet", or "The builders are at work there"), not "⚠ Doesn't fit today".
5. **No door onto a sketch.** A room's door, its door moved, a room resized so its door opens somewhere new, a template or a moved room, and a sketch's own door, indoors or on a plot, are all turned down where the door would open onto a sketch's floor, with the `onSketch` line and the sketch selected. A sketch drawn over another sketch's doorway is turned down the same way, so no sketch can block another. A room or an item put in front of a sketch's door is still allowed, as in phase 1: that is what "⚠ doorway blocked" is for.
6. **Sketches on plots.** Buying a plot and the builders finishing it leave every sketch on it where it is. Once the building has grown into the plot the sketch is inside, and is judged as any other: a door left facing the new outer wall, or a floor over the tiles kept clear inside a new entrance, shows amber.

Nothing in the save changes: the answer is worked out, never stored.

## Phase 3: sketches that remember a room

A plan, 26 October 2026, for the third phase, built in a branch of its own after phase 2 was merged, from five mockups Max approved. It lets a sketch carry a saved template, and adds a Plans overlay. The ban on template ghosts above still holds in spirit: a template pencilled in is still paint on the floor, footprint and door, with its furniture drawn as outlines only, not models, and it blocks nobody.

### A. A sketch that remembers a room

1. **State.** `Sketch` gains `layout?: Layout` and `template?: string`: the template's layout as it was pencilled in, turned as it was put down, and its name. Templates live in the browser, not the save, so the layout is copied into the save. A sketch with a layout has the layout's size, door and kind of room. The save version stays at 40: both are optional, and an older save has none. On load, `upgradeSave` reads each layout as a template file is read (`readLayout`, with renamed items followed); one whose kind of room or items this version does not know, or whose size no longer matches its sketch, is dropped and the sketch kept, plain.
2. **Pencilling a template in.** The Rooms menu's ✎ Pencil in pill becomes a switch of its own (`hud.pencil`) beside the Rooms and Templates tabs, rather than a third tab, so it can be on over either. On the Templates tab, a card's button reads "Pencil in" and picks up the template tool with `sketch: true`: the same preview, centered on the cursor, R to turn it and the same `layoutValid` check (plus phase 2's rule that no sketch stands in another's doorway). A click pencils it in with the layout and its name attached, plays the placement sound and keeps the tool in hand for another. Hint: "✎ Cozy 4×4 · Massage Suite template · click to pencil it in · $7,350 when built · nothing charged now · R turns it · Esc cancels", the price being the template's `copyCost`. A locked template (`templateLock`) stays locked; its price does not dim the card.
3. **On the floor.** As any sketch, plus each remembered piece of floor furniture's footprint as a darker wash with a dashed outline in the trim, and each window as a short blue stretch of its edge. Its label reads `Massage Suite` with `from "Cozy 4×4" · pencilled in` under it.
4. **Its panel.** The price chip is the template's full price (`copyCost`: the room at its size, furniture past the required, and windows). A chip "Template: Cozy 4×4", and the line "Remembers a Massage Table, an Oil Trolley, a Plant and 2 windows. Built whole when you build it. Pencilled in on Day 21. Needs a Massage Therapist once it opens." (furniture named from `ITEMS` and counted, the required first as the layout lists them). **Forget template** drops the layout and the name and leaves a plain sketch, its kind, floor and door unchanged. **Erase** as before. **Move** picks it up into the template tool with the same layout, put back as it was on Esc.
5. **Build here.** The whole room at once, through `buildLayout`, as building from a template does: no blueprint. Turned down with "\"Cozy 4×4\" costs $7,350. You can't afford it yet." where the bank cannot cover it, and with the fit's reason where it no longer fits; the sketch stays either way. Built, the sketch goes, the room is selected, and `sketch_built` carries `template: true`.
6. **Its fit.** For a sketch with a layout, `sketchFit` asks `layoutValid` (sparing the sketch itself) in place of `roomRectValid` and `doorValid`, so amber means the same thing as the Build here refusal: floor taken or furniture cutting someone off is "no longer fits", a doorway not clear is "doorway blocked". A layout this version cannot build (furniture it does not know, or a layout `layoutProblem` turns down) no longer fits, with "This template needs items this version doesn't have" or the problem as its reason, until Forget template clears it.

### B. The Plans overlay

1. **In the picker.** "Plans", last, with a ✎ icon of its own. It colors nothing: `heatTiles` gives no tiles and `drawOverlay` sets no heat for it, and the `overlay_shown` event fires as for any overlay.
2. **The veil.** While it is on, the floor's canvas is repainted with a navy wash at 18% over everything but the sketches, which are painted after it and so stand out. No new mesh and no draw calls: the floor is repainted once as the overlay goes on and off.
3. **The labels.** Every sketch's label shows, the selected one too, its small line saying its price and fit: "$4,000 · fits", "$7,350 · from "Cozy 4×4"", "⚠ doorway blocked", "⚠ no longer fits", "$4,000 · waits for its land".
4. **The key.** In place of the overlay key, top right: "✎ Plans", the line "3 pencilled in · $14,350 to build them all." with "One no longer fits." or "2 no longer fit." after it, and a row per sketch: its icon and name, its size or template and the day it was drawn, a fit chip ("✔ fits", "⌛ waits", "⚠ doorway", "⚠ doesn't fit"), its price, **Go** (the camera to its middle) and **Build** (Build here). **Hide plans** turns the overlay off. Building or erasing from the list leaves the overlay on, and the sketch drops out of it.

### Words

"Pencil in" and "sketch" as before; "Plans" only as the overlay's name, never for a sketch on its own (the blueprint's `phase: 'plan'` is untouched).
