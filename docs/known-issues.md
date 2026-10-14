# Known issues

Issues found in the October 2026 audit and left open, with where each one is and a way to fix it. The audit's fixes are in the history from `fix: free seats held elsewhere when a station is sold or demolished` onward; each came with a test that fails without it.

When one of these is fixed, add a test that fails without the fix, as for any bug, and take it off this list.

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
