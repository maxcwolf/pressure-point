# Known issues

Issues found in the October 2026 audit, or along the way since, and left open, with where each one is and a way to fix it. The audit's fixes are in the history from `fix: free seats held elsewhere when a station is sold or demolished` onward; each came with a test that fails without it.

When one of these is fixed, add a test that fails without the fix, as for any bug, and take it off this list.

## Housekeeping

- **Screenshot tests can catch a panel mid-animation under load.** On 14 October 2026 a full screenshot run, straight after an end-to-end run, failed the two room inspectors and the karma dialog with the whole panel shifted, then passed them twice each alone. If it keeps happening, wait for the pop-in animation to finish before each picture.
- **`warns when the game is also open in another tab` timed out once, under load,** in a full run on 14 October 2026 that took 5.7 minutes instead of the usual 2.4, and passed three times in a row alone straight after.
- **Two saved-games tests timed out once, under load.** `a named save can be made, then loaded from the title screen` and `a save can be overwritten, and deleting asks twice` (`tests/e2e/game.spec.ts`) each hit the 60-second limit on a click in a full end-to-end run straight after a screenshot run on 15 October 2026, and passed alone straight after.
- **Two more end-to-end tests failed once, under load.** `takes the title screen's picture of the game on the way out, not at every autosave` and `regulars come back under their own name` (`tests/e2e/game.spec.ts`) failed in a full run on 15 October 2026, while unit tests were running alongside, and passed alone straight after.
- **`clicking a toast about someone selects them and takes the camera there` failed once,** after 1.1 seconds, in a full end-to-end run on 15 October 2026 straight after the unit tests, and passed three times in a row alone straight after.
- **The autosave test waits 12 seconds of real time** (`the autosave brings a game back after a reload` in `tests/e2e/game.spec.ts`), for the autosave timer to fire. It is the slowest end-to-end test. Calling the autosave directly through `window.pp`, or making its interval a setting the test can shorten, would cut it to a second.
- **`makes unqualified treatment mostly fail` still fails on seed 12.** Since 16 October 2026 its guests are kept patient and well and the therapist has a Staff Room (`tests/unit/sim.modalities.test.ts`), so 14 to 17 knotted guests are treated on seeds 11 and 13 to 16, well past the 9 it needs. Seed 12 draws fewer guests and treats only 6. Counting a share rather than a number would make it hold on that seed too.
- **CI timing since the faster test pipeline is unchecked.** The local runs dropped from minutes to about a minute (`0c8b7ef`), with 2 workers on CI against 4 locally. Check a GitHub Actions run to see whether CI got the same speedup, and whether 2 workers is still right there.

## Interface

- **The Sound Healer sits at chair height over the Singing Bowls' floor cushion.** Their seat at the bowls has no height of its own (`h` in its access in `src/core/data/items.ts`), so they sit as if on an invisible chair. The Shaman's seat at the Ceremony Mat has `h: -0.3`, which puts them on their cushion; the same would fix the Sound Healer, with the screenshots that show them redone.

- **The bottom bar cuts off the last speed button** on windows 1240 to 1450 pixels wide. Below 1240 the round buttons shrink and everything fits, and above 1450 there is room, but in between the bar is wider than the window. Lowering the `max-width: 1240px` breakpoint in the stylesheet to about 1450, or letting the bar wrap, would fix it. Add a screenshot test at 1300 pixels.

## Saves

- **Versions 0.5.0 and earlier crash on a save from a newer version.** The current game refuses a newer save cleanly, but those old builds have no such check, so a save imported into one, or an autosave left when going back to one, crashes it at the title screen. This can't be fixed in a new build. It is only worth a line in the release notes if someone goes back to an old version.
