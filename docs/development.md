# Developing Pressure Point Institute

Everything for working on the game: running it from source, the tests, the checks, and where the code lives. How the pieces fit together is in [architecture.md](architecture.md), and how to publish a release is in [releasing.md](releasing.md).

The game is TypeScript, with Three.js for the 3D scene, Preact for the interface and Electron for the desktop app. It uses Yarn 4 through Corepack: run `corepack enable` once if `yarn` is not found.

## Running the game

```bash
yarn install
yarn dev        # in the browser at http://localhost:5183
yarn app        # as a desktop app (builds, then opens Electron)
```

Build the installers into `release/`:

```bash
yarn dist:mac   # .dmg for Apple silicon and Intel
yarn dist:win   # .exe installer (x64)
```

## Testing

```bash
yarn test           # unit tests: grid, placement, pathfinding, saves and the whole simulation
yarn test:e2e       # end-to-end tests: the real game in a headless browser, driven by mouse and keyboard
yarn test:desktop   # the built desktop app, launched for real
yarn test:visual    # a screenshot of every screen of the interface, compared with the stored pictures
yarn test:perf      # performance checks: draw calls, GPU memory over a long session, idle work
yarn bench          # the simulation's time per frame as the crowd grows, reported rather than checked
```

The first end-to-end run needs a browser: `yarn playwright install chromium`.

The unit tests seed the game's random numbers, so a failing run can be repeated exactly. They include hour-long sessions that check nothing goes missing, gets stuck or turns into `NaN`, and a restless player (`sim.chaos.test.ts`) who builds, demolishes, sells, moves, hires, fires and trains at random while the center runs. After every move, `inconsistencies()` in `tests/unit/helpers.ts` checks that no seat is held for someone not using it, no line holds a guest who has gone and nobody is left on a table with no one to serve them. `sim.work.test.ts` counts the simulation's costly grid work (routes, flood fills, rebuilds) in a busy center against a budget: counts, unlike timings, are the same on every machine. The end-to-end tests start the dev server themselves and use the `window.pp` handle that dev builds expose to read game state and skip ahead in time. They do not hard-code where things are on screen: helpers in `tests/e2e/fixtures.ts` ask the running game where an item, a wall or a valid spot is, then click there (`game.clickItem('bench')`, `game.clickWall('east')`, `game.placeHeld()`). The unit, end-to-end and desktop suites run in CI on every push and pull request.

The screenshot tests open the same saved game every time, paused, with the clock stopped and the 3D scene hidden, and compare 31 pictures of the title screen, the HUD, every menu, inspector and dialog, at three window sizes. One more picture is of the scene itself: empty rooms with windows on every side. After a change that is meant to be seen, run `yarn test:visual:update` and commit the new pictures in `tests/visual/screenshots`. The pictures were taken on macOS, so the suite is run locally and is not part of CI yet. Set `VISUAL_URL` to compare against another running build.

The desktop tests cover the shell around the game: that the page is sandboxed and cannot reach Node, that it is handed only the small API in `electron/api.ts`, that it cannot be sent to another address, and that Exit, Main menu and exporting a save work in the app. Each run uses a throwaway profile, so it never touches your own saved games. To test a packaged app instead of the build in this folder, set `PP_APP` to its executable.

The performance checks run the real game in the browser, like the end-to-end tests, but one at a time and on a port of their own (5184), so they never test a dev server already open on the usual one. Software WebGL makes timings vary, so they check what does not: how many draw calls a working center takes, that GPU geometries, textures and shaders stay level through ten minutes of busy play, and how much the Saves dialog reads from storage while it sits open. Frame times are measured and shown as annotations in the report, and fail only on a runaway. `yarn bench` times the simulation alone, from 25 to 200 guests, and writes the figures to `test-results/bench-sim.json`: run it before and after a change that might cost time. CI runs both and keeps their reports.

Every bug fix comes with a test that fails on the old code and passes on the fix, so the bug cannot quietly come back.

## Code quality

```bash
yarn typecheck      # TypeScript, with its strictest settings, over the game, the tests and the config files
yarn lint           # ESLint with typescript-eslint's strict, type-aware rules
yarn format:check   # Prettier
```

`yarn lint:fix` and `yarn format` fix what they can. CI runs all three checks on every push and pull request.

Every function has a one-line JSDoc comment saying what it does, with no tags: the types already say the rest. The linter insists on it.

The rest of the conventions are in [architecture.md](architecture.md#conventions).

TypeScript is held at 6.x for now: typescript-eslint needs the compiler's JavaScript API, which TypeScript 7 does not ship yet.

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat: ...`, `fix: ...`), in lowercase. commitlint checks each one as you commit, through a Husky hook that `yarn install` sets up, and CI checks every pushed commit again.

## Code map

| Path                  | What lives there                                                                                               |
| --------------------- | -------------------------------------------------------------------------------------------------------------- |
| `src/core/`           | The game itself, as plain logic: no drawing, no interface, no browser                                          |
| `src/core/data/`      | All tunable content: rooms, items, staff roles, treatments, conditions, rules, flavor text                     |
| `src/core/state/`     | The shape of a game in progress (plain JSON), starting one, and upgrades for older saves                       |
| `src/core/world.ts`   | Tile grid, placement rules, pathfinding                                                                        |
| `src/core/sim/`       | The simulation, as functions grouped by area: guests, staffing, stations, building, economy and so on          |
| `src/core/sim/sim.ts` | `Sim`: the clock, and the commands and questions the rest of the game uses                                     |
| `src/app/`            | Running the game: startup, a game in progress, pointer and keyboard input, the frame loop                      |
| `src/app/tools/`      | The build tools: a small class holding the tool in hand, over pure modules for geometry, hints and overlays    |
| `src/storage/`        | Autosave, named save slots, export and import, and preferences that outlive a game                             |
| `src/render/`         | The Three.js scene, one file per layer: floor, rooms, items, people, overlays, camera, picking                 |
| `src/render/models/`  | The procedural models: shared parts, the people, and one file per item in `items/`                             |
| `src/ui/components/`  | The interface, in Preact: one component per panel, menu, inspector and dialog, each with its stylesheet        |
| `src/ui/hooks/`       | How components reach the game and the interface's state                                                        |
| `src/ui/lib/`         | The interface's decisions as small pure functions: what the menus offer, status text, chart sizing             |
| `src/ui/theme/`       | The palette, and the styles everything shares                                                                  |
| `src/ui/hud.ts`       | The interface's own state (open menu and dialog, messages), which the rest of the app talks to                 |
| `src/audio.ts`        | Synthesized sound effects and music                                                                            |
| `src/main.ts`         | The entry point                                                                                                |
| `electron/main.ts`    | Desktop app: the main process, which opens the window and locks it down                                        |
| `electron/preload.ts` | Desktop app: hands the game the API in `electron/api.ts`, with the sandbox on                                  |
| `brand/`              | The app icon and the logo, drawn in code. `yarn brand` renders them to `build/`, `public/` and `src/ui/theme/` |

Disciplines, modalities, conditions, courses and equipment are all defined in `src/core/data/`. Adding a discipline means an entry in `DISCIPLINES`, a room, its items and a staff role, its modalities and conditions, and a model per item in `render/models/items/`. The simulation, menus and Settings pick it up from the data.

How the pieces fit together, and the conventions the code follows, are in [architecture.md](architecture.md).

Issues found but not yet fixed are listed in [known-issues.md](known-issues.md).
