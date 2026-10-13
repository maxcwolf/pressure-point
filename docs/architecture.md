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

1. Move the camera for any keys held down.
2. `sim.tick(dt)` advances the game.
3. `view.render(dt)` draws it.
4. `sim.drain()` hands over what happened (sounds, toasts, floating text) and the interface shows it.
5. The interface redraws if something changed, or five times a second regardless.
6. Every twelve seconds, autosave.

Input goes the other way. Pointer and keyboard handlers in `src/app/` call the build tools or the simulation, and the next frame shows the result.

## The simulation (`src/core/`)

- **State is plain data.** `GameState` (`core/state/types.ts`) is JSON all the way down, so saving is `JSON.stringify`. Anything that can be rebuilt from it, such as the tile grid, is kept out of it.
- **Content is data too.** Rooms, items, roles, treatments and conditions are tables in `core/data/`. Adding one means adding an entry, not writing new logic.
- **Logic is functions.** Each file in `core/sim/` covers one area (guests, staffing, stations, building, economy and so on) as functions that take a `SimContext`: the state, the `World` grid built from it, the queue of events and the ambience grid. Functions that need none of that take no context and are pure.
- **`Sim` is the front door.** The rest of the game talks only to the `Sim` class, which runs the clock and passes each call to the function that does the work.
- **The game reports, it does not draw.** It queues events (`core/sim/events.ts`); the interface decides how to show them.
- **Random numbers are seeded.** Everything random goes through `core/random.ts`, so a test can replay a game exactly.

## Rendering (`src/render/`)

`View` owns the Three.js renderer and composes one object per layer: floor, rooms, items, people, litter, overlays, camera and picking. Each layer keeps its own meshes in step with the game state. Models are built in code, one file per item in `models/items/`, from the shared shapes and materials in `models/parts.ts`. There are no art files.

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

| Command             | What it covers                                                                  |
| ------------------- | ------------------------------------------------------------------------------- |
| `yarn test`         | Unit tests: the simulation, the grid, saves, and the pure functions everywhere. |
| `yarn test:e2e`     | The real game in a headless browser, driven by mouse and keyboard.              |
| `yarn test:desktop` | The built desktop app: sandbox, preload API, quitting, exporting a save.        |
| `yarn test:visual`  | A screenshot of every screen of the interface, compared with stored pictures.   |

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
- **Conventional Commits** for commit messages (`feat: ...`, `fix: ...`, `refactor: ...`).

## Common changes

**Add an item.** Add its type to `ItemType` and an entry to `ITEMS` in `core/data/`, then a model in `render/models/items/` and a line in that folder's `index.ts`. The compiler will not build until every item type has a model.

**Add a discipline** such as reiki. Add an entry to `DISCIPLINES`, a room, its items, a staff role, and its modalities and conditions, all in `core/data/`, then a model for each new item. The simulation, the menus and Settings pick it up from the data.

**Add something the desktop app can do.** Declare it in `electron/api.ts`, implement it in `preload.ts` and `main.ts`, and read it through `src/app/desktop.ts`. Check that the web build still works without it.
