# Treatment machines

A plan, 21 October 2026, for big treatment machines: walk-in machines with an animated gag, each in a signature room of its own, and a few big machines for techniques we already have. What the machines are, and why, is in [machine-ideas.md](machine-ideas.md). This doc is how to build them.

Nothing here is chosen yet. The plan starts with the engine and one flagship machine, the Kneadmaster 9000 at Willow Lane, and then adds one center at a time.

## As built

All the phases below were built together on the `feat/treatment-machines` branch, ahead of the balance work in "What comes first", which is not in yet. Room prices, running costs and fees are first guesses kept as data, to be set again once that work is in. The bot builds machines only with `BOT_ON=machines`, so its pace without them is unchanged. Run `yarn balance` with and without it to compare profit a month and the bank at month 48, seed by seed.

Where it differs from the plan below:

- **The Wheel of Rebirth is the Carousel of Rebirth**, worked by a Massage Therapist trained in it, which is mostly pushing. `station.staff` was not widened, and every machine technique has a course.
- **No plug tag.** The power cut lists the machines it stops alongside everything else, and the storm stops the Aura Wash. A mishap only says it has stopped something when one is built.
- **By-products earn standing.** A guest the Cider Press heals goes away with a glass of cider, a feeling of its own that makes for a kinder review, and its barrels bring the wasps sooner (`drawnBy` on the mishap). Imprint art is not sold.
- **Not built yet:**
  - The Gong of Last Resort rattling the rooms next door.
  - Paid rides on the Carousel for bored guests.
  - Upgrade levels showing on the models.
- **Bars and markers** sit higher over a machine, read from its model. Every other item's are where they were.
- **Measured, 21 October 2026** (`yarn balance` with and without `BOT_ON=machines`, seeds 1 to 3, four years). Every machine treats its guests (a unit test plays each one), but none of them pays as priced. With no demand coupling yet, a machine's two ailments are a share of the guests its discipline already draws, so it heals a few a month at best:
  - The Kneadmaster paid back its room and running costs by day 534 and day 770 on the two Willow Lane seeds it was built on, yet the center made $3,700 a month less on one of them, having knocked down a Massage Suite to fit it.
  - The Pin Press healed 6 to 11 guests in two to three years and never paid back.
  - The Great Alphorn healed one guest in two years at High Pines, and took that center from $28,500 a month to a small loss.
  - The bot never built an Aura Wash. The Orchard Estate goes bankrupt on day 93 with or without machines, and on `main` too.
- **The lab** has a Machines group: each machine with a guest inside, and controls for the stage, how far through the session, the fake failure, smoking and down.

## What comes first

Two pieces of balance work go in before any machine, so the machines can be priced against them. They come from the review against the balance rework, which is written up in [machine-ideas.md](machine-ideas.md#against-the-balance).

1. **Demand that grows with every staffed treatment room,** the deep-dive audit's fifth recommendation. A machine room then brings guests because it is a staffed treatment room, with no special rule of its own.
2. **A sink for the late money.** Four of five centers end with $600,000 to $1,400,000 and nothing to spend it on. Machines should be one place that money goes. They get running costs, set once this work tells us how much a settled center should be spending each month.

The machines come after both. Their room prices, running costs and fees are then set against the good bot's profit a month, not guessed in advance.

## Where we are

**Treatments.** A technique (`ModalityDef`, `core/data/types.ts`) is done on its room's table or mat, an `ItemDef` with a `station` (`{staff, goal: 'treat', seconds, discipline}`). It may also need an `equipment` prop in the same room. That is only a presence check (`equipmentProblem`, `core/sim/treatments.ts`). The prop has no staff spot, no queue, no progress and no guest of its own. The largest footprint today is 2×2.

**Choosing a station.** `pickStation` (`core/sim/stations.ts`) already looks at every `treat` station of the guest's discipline in every room and takes the one with the lowest `stationScore`. That score counts the queue and the guest being served, adds 2.5 if no one is staffing it, 6 if its operator is unqualified, and 40 for any other problem delivering the treatment. A room can hold two kinds of station for the same discipline already. What's missing is a way to say which techniques each one does.

**Walking onto things.** An access spot has a tile, where the person walks to (`accessTile`, `core/world.ts`), and a pose point, where they end up (`accessPose`). `goTo` (`core/sim/movement.ts`) adds the pose point as a last waypoint. `moveAlong` glides straight to it, setting the pose, height and facing but leaving the person's tile alone. The Posture Scanner (`core/data/items.ts`) uses this already: the guest's tile is in front of the scanner, and their pose point is on its platform.

An access tile _inside_ a footprint doesn't work. `lay()` blocks every tile of an item that isn't walkable, `findPath` refuses a blocked goal, and `connected()` requires every access tile to be reachable. So `canPlaceItem` says "That would block the way".

**Special cases.** About 25 `type === 'x'` checks in the sim give items their own behavior ([todo.md](todo.md) wants them moved into data). Mishaps list the items they stop by hand (`core/data/mishaps.ts`). The Sweat Lodge's opening line is its own constant (`SWEAT_LODGE_OPEN`, `core/sim/ceremonies.ts`).

**Drawing.** Each item has a builder in `BUILDERS` (`render/models/items/index.ts`). Moving parts are named in `ItemParts` (`render/models/parts.ts`), and `mergeStill` leaves named parts unmerged. They are animated in `ItemsLayer.effects` (`render/items.ts`). The extraction cloud and the spirit animal (`render/ceremony.ts`) are the nearest thing we have to a treatment gag. Guests' symptoms are drawn in `render/models/character.ts`, and `poseChar` swaps them for the cured look (`cureRig`) once a guest is healed.

## Decisions

**1. A machine is a station, not equipment.** It is an `ItemDef` with a `station`, like a table, so it gets a staff spot, a queue, wear per use and session progress for free.

- A **signature machine** is the only required item of its room (cost 0, paid for in the room's price). Its ailments are new techniques in the center's own discipline, each marked `ModalityDef.machine: ItemType`. Keeping them inside an existing discipline means demand, training, house calls, the Settings toggles, prices, the casebook and the Treatments menu all pick them up with no new code. The operator learns "Operating the Kneadmaster 9000" in the Training Room like any other technique.
- A **big machine for a technique we already have** is either a second station in the room (the Hot Stone Kiln, which takes the place of the table and needs its own operator) or a booster that helps every station in its room (the Gong of Last Resort). Boosters suit group-session rooms, whose stations are mats.

**2. Walk-in uses the glide we already have.** The machine's access tile sits at its mouth, outside the footprint, and the pose point goes up to about 2.5 tiles inside it. This needs no changes to the world, placement, footprints or pathfinding, and rotation, room resizing and Caretaker repairs already work at any size. The guest's tile stays on the access tile, so anything reading it (warmth, for one) still works, and they glide straight back out when they're done. Anything fancier on the way in, such as being lifted, spun or hidden, is drawn only. The sim doesn't know about it.

A machine guests **walk through** (the Aura Wash) adds an `'exit'` access role. `completeService` moves the guest to it before they decide where to go next. `connected()` already requires every access tile to be reachable, so placement checks it for free. No tiles open inside a footprint: that would let others walk through the machine.

**3. Behavior is data.** One optional block on `ItemDef`:

```ts
machine?: {
  performs: readonly Modality[];   // what it does: its own ailments, or techniques we have
  selfContained?: boolean;         // needs no equipment for what it performs (default true)
  seconds?: number;                // session length, times this
  success?: number;                // added to the chance of success
  strain?: number;                 // staff energy, times this
  upkeep: number;                  // power and parts, paid each month with the wages
  runNoise?: number;               // noise only while it is serving
  runHeat?: number;                // heat only while it is serving
  overload?: { from: number; chance: number; bill: number }; // smokes past `from` wear, may overload after a use
  beside?: { room: RoomType; success?: number; seconds?: number }; // a combo with the room next door
  boosts?: { seconds?: number }; // a booster: every station in its room
}
plug?: boolean;                    // stopped by a power cut
```

There is no fee multiplier. A signature machine's ailments carry their own fees, like any ailment, and a machine for a technique we already have never raises the fee. It has to be a trade (faster, but hot, loud or hard on its neighbors), not a strict upgrade. Every machine has an `upkeep`, so owning one costs money every month and not only on the day it is bought.

Also:

- `ModalityDef.machine?: ItemType`: done only on that machine.
- `RoomDef.only?: readonly CenterId[]`, like `ConditionDef.only`.
- `RoomDef.opening?: string`: the opening line, so `SWEAT_LODGE_OPEN` becomes data.
- `MishapDef.stopsPlugged?: boolean`, checked in `mishapStopsType`, so a new machine needs no adding to a hand-kept list.
- `Item.overloaded?: boolean` in the state.

Everything reads these through one new module, `core/sim/machines.ts`:

- `treatsHere(it, mod)`
- `practicable(ctx, mod)`: the technique is unlocked and, for a machine technique, a finished room has a usable machine
- `roomForModality(mod)`
- `machineSeconds`, `machineSuccess`, `besideBonus`
- `machineUpkeep(ctx)`: the month's running costs for every machine owned
- `maybeOverload(ctx, it)`
- `running(it)`

No more `type ===` checks. The rest of the ~25 can move into data later, separately.

**4. Seeded games stay the same.** Candidates (`makeCandidate`, `core/people.ts`) and house calls (`makeCall`, `core/sim/calls.ts`) draw from the RNG once per technique in `MODALITY_ORDER`, so they skip machine techniques. Otherwise every existing seeded game would change. Demand (`conditionWeights`, `core/sim/demand.ts`) and the emergency pool (`core/sim/emergencies.ts`) only offer a machine's ailments once `practicable` says so. `maybeOverload` rolls only for items that have an `overload`. Machine ailments carry `only: [center, 'sandbox']`.

**5. Gags are drawn only, from what the sim already has.** `core` can't import `render`, and it doesn't need to. A gag reads:

- `it.serving`
- the guest's state: `'called'` while gliding in, `'served'` during the treatment
- `it.progress`, from 0 to 1
- `g.outcome`, set when the session ends

Beats are keyed to fractions of progress, not seconds, because session length varies with skill, energy and traits. Pausing and game speed then take care of themselves.

**6. Overloads never hurt anyone.** The machine smokes once its wear passes the overload threshold, so the player sees it coming. The overload roll comes after the session, once the guest has finished. An overload sets the wear to full and sets `overloaded`. That reuses the breakdown, `usable`, and the Caretaker's urgent repair, and the repair clears it. It also charges the machine's `overload.bill` for parts, so an overload costs money as well as time. This follows the rule that a center should be challenging but fair: tell the player, give them something to do about it, and keep the pressure without a cliff.

**7. A down machine's line is never left without a word.** Guests in line for a machine-only ailment have no table to be moved to, so a down machine is the one new cliff machines could bring.

- The moment the machine is unusable (overloaded, broken, or stopped by a mishap), `practicable` is false, so no more of its ailments arrive or are diagnosed.
- The toast names the line and what to do about it, the way the new line warnings do. For example: "The Kneadmaster 9000 has overloaded. 4 guests are waiting for it. A Caretaker can have it running in about a day."
- It opens the machine's inspector, where a Caretaker can be sent straight away.
- Guests already in the line wait as any line waits, so their patience is the clock the player is racing.

## The gag engine

All of it lives in `src/render/gags/`:

- **`types.ts`**: plain data, no THREE.
  - A `GagScript` has optional `approach` beats, then `beats`, then an optional `hiccup` (the fake failure: a chance, a stretch of progress and its own beats), then an `outro` with beats for healed and for failed, and an optional `operator` gesture.
  - A `Beat` runs `from` to `to` (fractions of progress) with an easing. It can move named parts (position, rotation, scale, spin, shake, glow), move the guest (hidden, offset, spin, scale, tilt), set particle rates, and show or hide props.
- **`eval.ts`**: a pure `gagFrame(script, input)`. The input is the stage (idle, approach, running or outro), progress, outro time, outcome, whether this is a hiccup run, and the time. It returns plain numbers for each part, the guest's overrides and the particle rates, so it can be tested in Node.
- **`apply.ts`**:
  - `applyGag(model, frame)` sets transforms relative to the rest poses taken when the model is built.
  - `applyGuestGag(rig, frame)` runs after `poseChar` and offsets, hides or spins the guest. `Crowd.gather` uses `traverseVisible`, so a hidden guest is properly hidden; hide its pick target too.
- **`particles.ts`**: pooled puffs, sparks, bubbles and foam, cycled by phase like the item puffs we already have, with nothing allocated per frame.
- **`clock.ts`**: a `GagClock` owned by `View`. It remembers each machine's last guest and starts the outro when `serving` empties with an outcome set. The outro's time comes from the sim's day, so pausing freezes it.
- **`scripts/<machine>.ts`**: one script per machine, in a `GAGS` table beside `BUILDERS`.

**Wiring.**

- `ItemsLayer.effects` (`render/items.ts`) plays the machine's side, next to the existing session and ceremony hooks.
- `PeopleLayer.update` (`render/people.ts`) plays the guest's side after `poseChar`.
- Both build their input through one shared `gagInputFor(sim, clock, it)`, so they can't drift apart.
- Operator moves become data: a `GESTURES` table in `render/pose.ts`, checked before the long chain of special cases there.

**The fake failure** is picked from a hash of the item's and the guest's ids, so it is the same every time it is drawn, never touches the seeded RNG, and changes nothing in the sim. A real failure plays the `failed` outro (a sad puff) beside the 💢 we already show. The cure itself is the existing swap to the cured look.

**Models.**

- `ItemParts` gains `rig`, `emitters` and `props`, each named, so `mergeStill` leaves them alone.
- Builders are passed the item's upgrade level, so each tier can add something visible. The items layer already rebuilds when the level changes.
- Two things move into the model, since a machine is taller than anything we have:
  - The progress bar sits at a fixed height (`render/items.ts`). Its height comes from the model's top instead.
  - The upgrade plate's position is a table by type (`render/models/plate.ts`).

**Lab.** A Machines group in the lab (`src/lab/catalog.ts`). Each machine has a progress slider, a choice of stage and outcome, a hiccup switch, and a guest standing at its pose point. These specimens are also what the visual tests take pictures of.

## Where each piece hooks in

- **Choosing a station:** `pickStation` and `stationScore` (`core/sim/stations.ts`) use `treatsHere` in place of the bare discipline test. A small `MACHINE_PULL` (about −0.5) breaks ties toward the faster machine. `sameKind` (`core/sim/queues.ts`) uses `treatsHere` too, so moving guests between lines respects it.
- **Staffing:** one more clause in `wantedElsewhere` (`core/sim/staffing.ts`). An operator at a machine with an empty line goes where there is a line they can work, instead of sitting idle.
- **Sessions:** service seconds and strain (`core/sim/stations.ts`), success (`successChance`), and no equipment check for self-contained machines (`deliveryProblem`, `core/sim/treatments.ts`).
- **Completing a session:** the overload roll after the wear is added, in `completeService`. Fees are untouched.
- **Running costs:** `machineUpkeep` is paid on payday beside the wages (`core/sim/economy.ts`), under a new `'upkeep'` spending category, so the books show it as a line of its own. The payday warning five days ahead counts it, and so does the loan prompt when the bank can't cover payday.
- **Noise and heat while running:** `sessionHeard` (`core/sim/noise.ts`) becomes "a group session playing, or this machine running"; heat goes in `core/sim/warmth.ts`.
- **Mishaps:** `stoppedByMishap` (`core/world.ts`) reads the plug.
- **Which room does a technique:** `roomForModality` replaces `DISCIPLINES[d].room` in stations, the advisor, guests and the UI's status and demand.
- **Arrivals:** nothing special. Once demand grows with every staffed treatment room (see "What comes first"), a machine room brings its share like any other room.

## Menus and inspectors

- **Rooms menu:** shows a room only where its `only` allows (the same filter goes in `templates.ts`). A machine room gets a "Signature machine" badge, the ailments it treats with their fees, and a karma lock for the Wheel of Rebirth.
- **Items menu:** big machines for techniques we have appear with equipment, perhaps as a Machines kind of their own (`ui/lib/catalog.ts`).
- **Item stats** (`ui/lib/item-stats.ts`) gains four chips:
  - what the machine performs, with its speed
  - its running cost a month
  - its noise or heat while running
  - "Smokes when worn", with the repair bill
- **Books:** running costs are a line of their own in the Money menu, so the player can see what the machines cost them each month.
- **Treatments menu:** a machine technique says "Done in the Kneadmaster Suite" instead of naming equipment, and whether the machine is down or overloaded.
- **Inspectors:**
  - The room's inspector lists what its machine performs.
  - The item's shows it smoking or overloaded.
  - A guest's status reads "Inside the Kneadmaster 9000".

## Saves

New item, room, technique, ailment and look values change the save's fingerprint. `SAVE_VERSION` goes from 32 to 33 (`core/state/game.ts`, and `save-version.test.ts`). `Item.overloaded` is optional, so `state/upgrade.ts` needs nothing.

The Wheel of Rebirth needs no new campaign storage. Its machine is karma-only (`karma`, no `unlock`), and its room is offered only once that machine can be bought.

## Balance bot

A `machines` flag in `tests/balance/bot.ts`:

- After the star that opens a machine room, the bot builds it once its profit allows (`buildRoom`, with a size entry), and trains the operator through the usual course.
- It leaves machine techniques out of its equipment loop, and its upgrade loop picks machines up by itself.
- `playtest.balance.ts` reports how many days each machine takes to pay for itself, counting its running costs.

Star days are not enough to check, because the risk runs the other way. Machines are more likely to make the late game richer than to make it harder. Each run compares, before and after, seed by seed as the balance log does:

- star days, which must not slip;
- profit a month;
- the bank at month 48.

A machine that doubles the late money gets caught. The aim is a bank at month 48 that is no higher than before, with the money spent on machines instead of sitting there.

## Tests

- **`machines.test.ts`:**
  - Guests for the table never go to the machine, and the reverse.
  - No machine ailments arrive before the room exists.
  - The speed multiplier works, and a machine never changes a fee.
  - Running costs are paid on payday, appear in the books, and count in the payday warning.
  - A seeded overload happens, charges its bill, and its repair clears it.
  - A down machine stops drawing its ailments, and the toast names its line.
  - A power cut stops a plugged machine.
  - Candidates and house calls never include machine techniques.
  - An operator leaves an idle machine for a line.
- **`gags.test.ts`:**
  - `gagFrame` is pure.
  - Beats cover the whole session.
  - The guest is hidden where the script says.
  - A hiccup is the same for the same ids.
  - The outro follows the outcome.
- **`world.test.ts`:**
  - Every machine fits its room's minimum size in all four turns, with its access tiles reachable.
  - Its pose point is inside the footprint, and the path ends on its access tile.
- **Data checks:**
  - `performs` stays inside the station's discipline.
  - Every machine technique's machine is required by exactly one room.
  - Every gag script names only parts its model has.
- **`model-cost.test.ts`:** a draw-call budget for machines, about 60 each, and a higher total.
- **Visual tests:** three frames of each machine (`machine:<type>:<stage>`) in `tests/visual/models.spec.ts`. New guest looks are picked up from the ailments by themselves.
- **One end-to-end test:** build the Kneadmaster Suite in the sandbox and see a guest treated.

## Phases

**Before phase 0: the balance work in "What comes first".** Demand that grows with every staffed treatment room, and a sink for the late money. These are their own pieces of work, not part of this plan.

**Phase 0: groundwork that changes nothing.** Every existing test passes unchanged.

- `machines.ts` with `treatsHere` and `practicable`, wired in.
- `roomForModality`.
- Noise and heat while running.
- The plug tag.
- Room opening lines as data.
- The bar height from the model, and the level passed to builders.

**Phase 1: the engine and the Kneadmaster 9000, at Willow Lane.**

- **Data:**
  - The machine.
  - The Kneadmaster Suite: at least 4×4, at the second star, Willow Lane and the sandbox. Its price and running cost are set against Willow Lane's profit a month once the balance work is in; $15,000 was the first guess.
  - One technique, with a course of two or three days, because waits are already long while practitioners are away on courses and house calls.
  - Running costs: the `upkeep` field, payday, the books line and the chip.
  - Chair-Shaped and Mall Back, with their two new looks.
- **Drawing:** the whole gag engine, the model, its script, the lab specimen, and the Therapist's gesture.
- **The rest:**
  - The menus and inspectors above.
  - Save 33.
  - The tests.
  - The bot's `machines` flag.

**Phase 2: the Hot Stone Kiln**, the first machine for a technique we have, with the operator rule and the `sameKind` filter. It is priced a tier above the table, never raises the fee, and pays for its speed in heat, gas and wear.

**Phase 3: machine systems.**

- Overloads end to end: smoke, the overload itself and its bill, the toast that names the stranded line, and the Caretaker's priority.
- Upgrade tiers that show on the model.
- Combos with the room next door.
- The Gong of Last Resort as the first booster.

**Phases 4 to 7: one center each**, each one room, one model and one script, most of it data:

- **The Pin Press**, at The Exchange.
- **The Aura Wash**, at The Boardwalk. It brings the `'exit'` access role.
- **The Great Alphorn**, at High Pines.
- **The Cider Press of Rebirth**, at The Orchard Estate. It brings by-products that earn standing, not money: a glass of cider on the way out gives a kinder review, and the barrels bring the wasps sooner.

**Phase 8: the Wheel of Rebirth**, bought with karma. If any practitioner is to work it:

- Widen `station.staff` to `Role | readonly Role[]`. That touches staffing, assignments, the advisor, the station inspector, classes and the assign tool.
- Add `ModalityDef.qualified: false` for a technique that needs no course.

Each phase is verified the same way:

- `yarn test`.
- `yarn balance`, with star days, profit a month and the bank at month 48 compared before and after, seed by seed.
- The machine in the lab at every stage.
- A sandbox game in the preview, watched until a guest goes in, gets the gag and comes out cured.
