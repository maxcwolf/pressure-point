# Architecture

Pressure Point Institute is a browser game that also ships as a desktop app. The same code runs in both: the desktop app is an Electron window around the web build.

## The layers

| Folder         | What it is                                                             | May import from                  |
| -------------- | ---------------------------------------------------------------------- | -------------------------------- |
| `src/core/`    | The game itself: rules, state and content. No browser, no drawing.     | Nothing outside itself           |
| `src/storage/` | Saved games and preferences, kept in the browser's storage.            | `core`                           |
| `src/render/`  | The 3D picture of the game, in Three.js.                               | `core`                           |
| `src/ui/`      | The interface over the picture, in Preact.                             | `core`, `storage`, and app types |
| `src/app/`     | Startup, input, the build tools and the frame loop. Wires the rest up. | Everything above                 |
| `electron/`    | The desktop app's main process and preload script.                     | Nothing in `src/`                |

Dependencies point toward `core`. A lint rule and a separate TypeScript project (with no browser types) stop `core` importing anything outside itself, so the whole game can run in a unit test with no page and no renderer.

## One frame

`src/app/loop.ts` runs this once per frame:

1. Move the camera for any keys held down, or the mouse at the edge of the window if edge scrolling is on.
2. `sim.tick(dt)` advances the game.
3. `view.render(dt)` draws it.
4. `sim.drain()` hands over what happened (sounds, toasts, floating text) and the interface shows it.
5. The interface redraws if something changed, or five times a second regardless.
6. Autosave, every five minutes unless the player has chosen otherwise (`storage/controls.ts`). The game is also saved as it is left or hidden, whatever the choice.

Input goes the other way. Pointer and keyboard handlers in `src/app/` call the build tools or the simulation, and the next frame shows the result.

## The simulation (`src/core/`)

- **State is plain data.** `GameState` (`core/state/types.ts`) is JSON all the way down, so saving is `JSON.stringify`. Anything that can be rebuilt from it, such as the tile grid, is kept out of it.
- **Content is data too.** Rooms, items, roles, treatments and conditions are tables in `core/data/`. Adding one means adding an entry, not writing new logic.
- **Logic is functions.** Each file in `core/sim/` covers one area (guests, staffing, stations, building, economy and so on) as functions that take a `SimContext`: the state, the `World` grid built from it, the queue of events and the ambience grid. Functions that need none of that take no context and are pure.
- **`Sim` is the front door.** The rest of the game talks only to the `Sim` class, which runs the clock and passes each call to the function that does the work.
- **The game reports, it does not draw.** It queues events (`core/sim/events.ts`); the interface decides how to show them.
- **Every game is set in a center** (`core/data/centers.ts`): the sandbox, or one of the campaign's. A center decides where the building stands on the lot (its `Plot`), the starting money, and the objectives for each star. The `World` works out the building's footprint (`core/footprint.ts`) from the center's plot and the land bought next to it: the rectangles it is built from, its front door, and a mask of the tiles inside. Each center lists the plots of land it sells (`PlotDef`), and `core/land.ts` says which are for sale and for how much. A plot either joins the building or stands apart with its own entrance and a path of paving outdoors; the `World` numbers the buildings, and walking between them is ordinary pathfinding through each entrance's door. Nothing else assumes a fixed building or a rectangle. The outer walls, their windows and the rooms against them are worked out from the footprint's edges (`render/outer-walls.ts`, `render/room-walls.ts`), and the scenery is built again when it grows. Objectives are small specs (`GoalSpec`) that `core/sim/goals.ts` checks against the game.
- **The campaign is kept apart from saved games** (`storage/campaign.ts`): the best stars in each center, the achievements earned and the items unlocked with karma. Its rules are pure functions in `core/campaign.ts`. A game only carries its own `achieved` list, topped up from the campaign when it starts, so an achievement is never awarded twice; karma is always worked out from the stars and achievements, never stored.
- **Random numbers are seeded.** Everything random goes through `core/random.ts`, so a test can replay a game exactly.

## Rendering (`src/render/`)

`View` owns the Three.js renderer and composes one object per layer: floor, rooms, items, people, litter, overlays, camera and picking. Each layer keeps its own meshes in step with the game state. Models are built in code, one file per item in `models/items/`, from the shared shapes and materials in `models/parts.ts`. There are no art files. Every part is a draw call, and a part that casts a shadow is a second one, so only parts big enough to show a shadow cast one: `trimShadows` turns it off for the rest of each item and person as it is built. An item's parts that never move are merged into one mesh for each material as it is built (`models/merge.ts`), and every copy of that item shares the merged shapes; the parts its `ItemParts` name are left alone so they can still move. A finished room's walls, the building's shell and its back-wall windows are merged the same way, into shapes of their own that are freed with them (`owned` in `disposal.ts`). People are drawn in batches (`crowd.ts`): the same part of everyone, such as every head or every left shoe, is drawn in one go, each in its own color, so a crowd costs hardly more than a few people. Each person keeps their own meshes, posed as usual, and the batches copy where they are just before each frame is drawn. Someone seen from afar, under about 100 pixels to the meter, is drawn with stand-ins for their finely built parts that have about half the sides, made alongside each shape in `models/character-detail.ts`: from there, the full shapes' sides would be finer than a pixel and cost as much to draw.

What is selected shows over everything (`overlays.ts`): the ring is drawn a second time, faint, only where something stands in front of it, and a chevron bobs over a selected person above any speech bubble. The pointer looks at what is under it once a frame at most (`app/pointer.ts`), and whatever a click would select glows: a room's floor under a faint sheet, a person or item under copies of its parts drawn over it, which leaves the crowd's batches alone and costs a few draw calls only while something is hovered.

## Interface (`src/ui/`)

- `hud.ts` holds the interface's own state: which menu and dialog are open, and the toasts and announcements on screen. The rest of the app talks to it.
- `components/` has one component per panel, menu, inspector and dialog, each with its stylesheet beside it. Components read the game through `hooks/` and redraw when `hud.ts` says to.
- `lib/` holds the decisions as pure functions: what the menus offer, status text, chart sizing.
- `theme/` holds the palette and the styles everything shares.

Buttons act on press, not release, through the shared `Button` component.

## Desktop app (`electron/`)

`main.ts` opens one window and locks it down: sandboxed, no navigation away from the game, no new windows, every permission refused. `preload.ts` hands the page the small API declared in `api.ts`, and `src/app/desktop.ts` is where the game reads it. In a browser that API is absent and the game hides what depends on it.

The built game is loaded as a file on purpose. Saved games are kept per address, so serving it any other way would hide every save a player already has.

## Saved games (`src/storage/`)

The autosave and up to twenty named saves live in the browser's storage, with export and import to move a game between the browser and the app. `SAVE_VERSION` in `core/state/game.ts` marks the format, and `core/state/upgrade.ts` fills in whatever an older save lacks. When a field is added to `GameState`, give it a default there.

## Tests

| Command             | What it covers                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| `yarn test`         | Unit tests: the simulation, the grid, saves, and the pure functions everywhere.                 |
| `yarn test:e2e`     | The real game in a headless browser, driven by mouse and keyboard.                              |
| `yarn test:desktop` | The built desktop app: sandbox, preload API, quitting, exporting a save.                        |
| `yarn test:visual`  | A screenshot of every screen of the interface, and of the scene, compared with stored pictures. |
| `yarn test:perf`    | Draw calls, GPU memory over a long session and idle work, in the real game in a browser.        |
| `yarn bench`        | The simulation's time per frame as the crowd grows. Reported, not checked.                      |

End-to-end tests find things by meaning (`game.clickItem('bench')`), not by screen coordinates.

## Conventions

- **Strict TypeScript, ESLint and Prettier.** `yarn typecheck`, `yarn lint` and `yarn format:check` must pass; CI runs them.
- **Every function has a one-line JSDoc comment** saying what it does. No tags and no type annotations: the types say the rest. The linter requires it.
- **Small pure functions, exported and tested.** Keep classes and components thin and put the working out in functions that can be tested alone. `src/app/tools/`, `src/ui/lib/` and `src/core/sim/` are the models to follow.
- **Classes are for long-lived objects that own state**, such as the view, a render layer, the audio engine or the tool in hand. Everything else is functions.
- **File names:** component files are PascalCase (`Objectives.tsx`, with `Objectives.css` beside it). Every other file is lowercase or kebab-case.
- **Type-only imports use `import type`**, so they load nothing at run time. The linter requires it.
- **Every bug fix comes with a test** that fails on the old code and passes on the fix.
- **American English** in code, comments, interface text and docs.
- **Conventional Commits** for commit messages (`feat: ...`, `fix: ...`, `refactor: ...`), in lowercase. commitlint checks each message as it is committed (a Husky hook, set up by `yarn install`) and again in CI.

## Common changes

**Add an item.** Add its type to `ItemType` and an entry to `ITEMS` in `core/data/`, then a model in `render/models/items/` and a line in that folder's `index.ts`. The compiler will not build until every item type has a model.

**Add a center.** Add its id to `CenterId` and an entry to `CENTERS`: a plot that passes `plotFits`, starting money and three stars of goals. A new kind of objective is a case in `GoalSpec` and in `objectiveFor`.

**Add a discipline.** Add an entry to `DISCIPLINES`, a room, its items, a staff role, and its modalities and conditions, all in `core/data/`, then a model for each new item. The simulation, the menus and Settings pick it up from the data.

**Change the icon or the logo.** Edit `brand/icon.mjs` or `brand/wordmark.mjs` and run `yarn brand`, which renders the app icon (`build/icon.png`, picked up by the installers), the favicon (`public/favicon.svg`) and the logo on the title screen (`src/ui/theme/logo.png`). Commit what it writes. The banner at the top of the README (`docs/assets/hero.jpg`) is a picture with the logo in it, so it needs redrawing too.

**Add something the desktop app can do.** Declare it in `electron/api.ts`, implement it in `preload.ts` and `main.ts`, and read it through `src/app/desktop.ts`. Check that the web build still works without it.
