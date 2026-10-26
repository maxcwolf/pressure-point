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
