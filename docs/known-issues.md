# Known issues

Issues found in the October 2026 audit and left open, with where each one is and a way to fix it. The audit's fixes are in the history from `fix: free seats held elsewhere when a station is sold or demolished` onward; each came with a test that fails without it.

When one of these is fixed, add a test that fails without the fix, as for any bug, and take it off this list.

## Decisions to make

These work as written, but may not work as intended. Each needs a decision before it is changed.

### Borrowed money counts toward a star

The bank balance objective (`checkStars` and `objectives` in `src/core/sim/progress.ts`) compares `money` with the goal and ignores `loan`. A player can borrow the maximum, collect the star and its cash prize, then repay the loan in full, ending up with the star and the prize.

If loans should not count, compare `money - loan` with the goal, in both functions so the objective shown still decides the star, and say so in the objective's label.

### Starting a new game when storage is nearly full loses the old one

`archiveAutosave` (`src/storage/saves.ts`) copies the autosave into the Previous game slot before a new game starts. If that copy does not fit, it gives up silently and leaves the old game in the autosave slot. The new game's first autosave is small enough to fit, and overwrites it. This needs storage close to the browser's limit, but then the game is lost without a word.

A fix needs a decision on what the player sees: for example, refuse to start the new game and ask them to delete or export a save first.

### Autosaves fail silently once storage is full

`save()` in `src/app/game.ts` ignores the `false` that `autosave()` returns when storage is full. The game keeps playing and keeps trying, and the stored game falls further and further behind with nothing on screen to say so.

A toast the first time an autosave fails (and not every 12 seconds after) would let the player free up space.

### The autosave picture costs a long frame every 12 seconds

Each autosave also takes a picture of the view for the title screen (`view.snapshot()` in `src/render/view.ts`), which draws the scene again and reads the canvas back. Under software WebGL that took about 250 ms, against about 1 ms for a normal frame, and showed up as a hitch at the moment of the autosave. A real graphics card is far faster, but the readback still stalls.

The picture is only seen on the title screen, so it could be taken less often (once a minute) or only when leaving the game. `yarn test:perf` reports frame times and would show the difference.

## Latent risks

These have not been seen to go wrong, but would if the code around them changed.

- **`repathAll` can cancel a firing** (`src/core/sim/movement.ts`). If a member of staff who is leaving cannot find a route, it calls `staffIdle`, which puts them back to work on the payroll. `resetUsers` in `building.ts` guards against this; `repathAll` does not. It needs someone walled in mid-walk, which the placement rules prevent.
- **`canMoveItem` with an item not in the list** (`src/core/sim/building.ts`). `indexOf` returns -1 and `splice(-1, 1)` would lift out the last item instead. Every caller passes an item fresh from `world.item(id)`, so it cannot happen today.
- **A station staffed by someone posted elsewhere** (`updateStations` in `src/core/sim/stations.ts`) clears `staffId` but goes on using that member of staff for the rest of the step, so one person could serve at two stations. Nothing has been seen to cause it.
- **An emergency guest who cannot find a way in still counts as sent** (`updateEmergency`): `pending` goes down even when `spawnGuest` fails, which would make the target harder to reach.
- **The guest cap counts blueprints** (`admitGuests` in `src/core/sim/guests.ts`): `14 + rooms × 5` includes rooms not yet built.

## Housekeeping

- **One end-to-end test failed once.** `an emergency offer can be put aside and brought back before it lapses` failed in one full run on 14 October 2026 and passed in every run since, alone and in the full suite. The failure's details were lost before they were read. If it happens again, keep `test-results/` and look at what the offer said.

- **Materials are dropped without `dispose()`.** These are a speech bubble per person, the glow on battery and bulb guests, the marker sprites, a room's sign on each rebuild, and some item models' own materials when an item is moved. Three.js frees these when they are garbage-collected, and `yarn test:perf` shows no growth, so they hold no GPU memory, but disposing them would make that explicit.
- **The HUD unsubscribes and subscribes again on every redraw**, because `useRedraw` (`src/ui/hooks/use-redraw.ts`) returns a new function each time and `Hud.tsx` lists it as an effect dependency. Harmless, and cheap.
- **Electron hardening.** There is a permission request handler but no `setPermissionCheckHandler`, and the production content security policy still allows `connect-src ws: http://localhost:*`. Neither can be exploited without a way to inject content first.
- **The `SAVE_VERSION` number is not raised when content is added.** Saves are now checked for content the game does not know, so a newer save is refused cleanly instead of crashing, but versions from before that check (0.5.0 and earlier) still accept saves from newer versions and crash on them.
