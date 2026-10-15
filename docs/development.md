# Developing Pressure Point Institute

Everything for working on the game: running it from source, the tests, the checks, and where the code lives. How the pieces fit together is in [architecture.md](architecture.md), and how to publish a release is in [releasing.md](releasing.md).

The game is TypeScript, with Three.js for the 3D scene, Preact for the interface and Electron for the desktop app. It uses Yarn 4 through Corepack: run `corepack enable` once if `yarn` is not found.

## Running the game

```bash
yarn install
yarn dev        # in the browser at http://localhost:5183
yarn app        # as a desktop app (builds, then opens Electron)
yarn lab        # the model lab, at http://localhost:5183/lab.html
```

The model lab shows any model on its own: every item, a guest with each condition, each role of staff, and the scenery. Turn it about, check it against the tiles it covers and a person for scale, and try its moving parts, poses and session props. It reloads as you edit a model. Link straight to one with `lab.html?model=item:bench`, and add `&still` to stop everything moving. The lab is for the dev server only: the build makes the game's page alone.

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
yarn test:visual    # a screenshot of every screen of the interface and every model, compared with the stored pictures
yarn test:perf      # performance checks: draw calls, GPU memory over a long session, idle work
yarn bench          # the simulation's time per frame as the crowd grows, reported rather than checked
```

The first end-to-end run needs a browser: `yarn playwright install chromium`.

The unit tests seed the game's random numbers, so a failing run can be repeated exactly. They include hour-long sessions that check nothing goes missing, gets stuck or turns into `NaN`, and a restless player (`sim.chaos.test.ts`) who builds, demolishes, sells, moves, hires, fires and trains at random while the center runs. After every move, `inconsistencies()` in `tests/unit/helpers.ts` checks that no seat is held for someone not using it, no line holds a guest who has gone and nobody is left on a table with no one to serve them. `sim.work.test.ts` counts the simulation's costly grid work (routes, flood fills, rebuilds) in a busy center against a budget: counts, unlike timings, are the same on every machine. The end-to-end tests start the dev server themselves, or use one already running on its port (5183, or `E2E_PORT` for a second checkout such as a worktree, so its tests run its own code), and use the `window.pp` handle that dev builds expose to read game state and skip ahead in time. They do not hard-code where things are on screen: helpers in `tests/e2e/fixtures.ts` ask the running game where an item, a wall or a valid spot is, then click there (`game.clickItem('bench')`, `game.clickWall('east')`, `game.placeHeld()`). The unit, end-to-end and desktop suites run in CI on every push and pull request.

Speed: the browsers render with software WebGL, so the game looks the same with or without a graphics card, and drawing a frame that way is most of what a test costs. The end-to-end tests check behavior, not pixels, so the game skips drawing in them (`View.drawing`, switched off by the `draw` option in `playwright.config.ts`) and runs everything else, the scene included, so clicks still find what they aim at. That takes the suite from about four minutes to about one. The one test that checks the scene is drawn, and the steps that look at what ends up on screen, switch drawing back on (`test.use({ draw: true })`, `game.draw()`). The performance checks always draw. Unit tests get thirty seconds each rather than Vitest's usual five, since a few play an hour of the game and a busy machine slows them. A test waits for what it is checking (a spot on screen to move, a new game to start) rather than for a fixed time, or for a state it may already have passed.

The screenshot tests open the same saved game every time, paused, with the clock stopped and the 3D scene hidden (and not drawn), and compare 31 pictures of the title screen, the HUD, every menu, inspector and dialog, at three window sizes. One more picture is of the scene itself: empty rooms with windows on every side. `models.spec.ts` adds a picture of every model on its own, from the model lab held still, so a change to a shared part shows in every model that uses it; a model added to the lab without a picture fails the suite. After a change that is meant to be seen, run `yarn test:visual:update` and commit the new pictures in `tests/visual/screenshots`. The pictures were taken on macOS, so the suite is run locally and is not part of CI yet. Set `VISUAL_URL` to compare against another running build.

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

Before each commit, a second Husky hook runs ESLint and Prettier over the staged files, fixing what they can and staging the fixes ([lint-staged](https://github.com/lint-staged/lint-staged)), then checks the types of the whole project with `yarn typecheck`. A commit that still has lint or type errors stops there.

## Code map

| Path                  | What lives there                                                                                                                                                |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/core/`           | The game itself, as plain logic: no drawing, no interface, no browser                                                                                           |
| `src/core/data/`      | All tunable content: rooms, items, staff roles, treatments, conditions, rules, flavor text                                                                      |
| `src/core/state/`     | The shape of a game in progress (plain JSON), starting one, and upgrades for older saves                                                                        |
| `src/core/world.ts`   | Tile grid, placement rules, pathfinding                                                                                                                         |
| `src/core/sim/`       | The simulation, as functions grouped by area: guests, staffing, stations, building, economy and so on                                                           |
| `src/core/sim/sim.ts` | `Sim`: the clock, and the commands and questions the rest of the game uses                                                                                      |
| `src/app/`            | Running the game: startup, a game in progress, pointer and keyboard input, the frame loop                                                                       |
| `src/app/tools/`      | The build tools: a small class holding the tool in hand, over pure modules for geometry, hints and overlays                                                     |
| `src/storage/`        | Autosave, named save slots, export and import, and preferences that outlive a game                                                                              |
| `src/render/`         | The Three.js scene, one file per layer: floor, rooms, items, people, overlays, camera, picking                                                                  |
| `src/render/models/`  | The procedural models: shared parts, the people, and one file per item in `items/`                                                                              |
| `src/lab/`            | The model lab: a dev-only page for looking at any one model                                                                                                     |
| `src/ui/components/`  | The interface, in Preact: one component per panel, menu, inspector and dialog, each with its stylesheet                                                         |
| `src/ui/hooks/`       | How components reach the game and the interface's state                                                                                                         |
| `src/ui/lib/`         | The interface's decisions as small pure functions: what the menus offer, status text, chart sizing                                                              |
| `src/ui/theme/`       | The palette, and the styles everything shares                                                                                                                   |
| `src/ui/hud.ts`       | The interface's own state (open menu and dialog, messages), which the rest of the app talks to                                                                  |
| `src/audio.ts`        | Synthesized sound effects and music, and the announcer's voice                                                                                                  |
| `src/voice.ts`        | Which announcements have a recording, matched by their text                                                                                                     |
| `src/main.ts`         | The entry point                                                                                                                                                 |
| `electron/main.ts`    | Desktop app: the main process, which opens the window and locks it down                                                                                         |
| `electron/preload.ts` | Desktop app: hands the game the API in `electron/api.ts`, with the sandbox on                                                                                   |
| `brand/`              | The app icon and the logo, drawn in code. `yarn brand` renders them to `build/` (with a rounded-square `icon-mac.png` for macOS), `public/` and `src/ui/theme/` |
| `brand/announcer/`    | The announcer's clean recordings. `yarn announcer` (macOS) adds the speaker effect and writes them to `src/sounds/announcer/`                                   |

Disciplines, modalities, conditions, courses and equipment are all defined in `src/core/data/`. Adding a discipline means an entry in `DISCIPLINES`, a room, its items and a staff role, its modalities and conditions, and a model per item in `render/models/items/`. The simulation, menus and Settings pick it up from the data.

To give an announcement a voice, put the recording in `brand/announcer/`, run `yarn announcer`, and add the clip to `VOICE_LINES` in `src/voice.ts` under the announcement's exact text. A test fails if that text is not one the game announces. The speaker effect (band, horn, drive and echoes) is in `scripts/pa-speaker.mjs`.

How the pieces fit together, and the conventions the code follows, are in [architecture.md](architecture.md).

Issues found but not yet fixed are listed in [known-issues.md](known-issues.md), and planned work in [todo.md](todo.md).
