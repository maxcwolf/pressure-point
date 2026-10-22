# Known issues

Issues found in the October 2026 audit, or along the way since, and left open, with where each one is and a way to fix it. The audit's fixes are in the history from `fix: free seats held elsewhere when a station is sold or demolished` onward; each came with a test that fails without it.

When one of these is fixed, add a test that fails without the fix, as for any bug, and take it off this list.

## Housekeeping

- **`regulars come back under their own name` failed once, under load,** in a full end-to-end run on 15 October 2026 while unit tests were running alongside, and passed alone straight after. Its waits were read again on 22 October 2026 and none waits on the wrong thing: the regular is spawned by ticking the game directly, and the inspector and the Regulars tab are waited for. No cause shows.
- **`clicking a toast about someone selects them and takes the camera there` failed once,** after 1.1 seconds, in a full end-to-end run on 15 October 2026 straight after the unit tests, and passed three times in a row alone straight after. No cause shows: Playwright checks that a click lands on the toast it means, and both waits after it poll for what they check.
- **CI runs end-to-end tests 2 at a time per machine, checked on 22 October 2026.** CI got the speedup from not drawing (`0c8b7ef`): each of the four parts took 5 to 11 minutes before it and about 1 minute after, and takes 1.3 to 3.2 minutes now with about twice the tests. The two workers stay busy (part 4 ran 267 seconds of tests in 140), so a third might help, but GitHub's machines have four cores and each test runs a whole browser with software WebGL, so try it on a branch and watch for retries before changing it. Part 4 took twice as long as the others, its slowest tests saved-games tests that drew each save's picture; tests that do not draw now skip the picture too.

## Interface

- **The Sound Healer sits at chair height over the Singing Bowls' floor cushion.** Their seat at the bowls has no height of its own (`h` in its access in `src/core/data/items.ts`), so they sit as if on an invisible chair. The Shaman's seat at the Ceremony Mat has `h: -0.3`, which puts them on their cushion; the same would fix the Sound Healer, with the screenshots that show them redone.

- **The bottom bar cuts off the last speed button** on windows 1240 to 1450 pixels wide. Below 1240 the round buttons shrink and everything fits, and above 1450 there is room, but in between the bar is wider than the window. Lowering the `max-width: 1240px` breakpoint in the stylesheet to about 1450, or letting the bar wrap, would fix it. Add a screenshot test at 1300 pixels.

## Saves

- **Versions 0.5.0 and earlier crash on a save from a newer version.** The current game refuses a newer save cleanly, but those old builds have no such check, so a save imported into one, or an autosave left when going back to one, crashes it at the title screen. This can't be fixed in a new build. It is only worth a line in the release notes if someone goes back to an old version.
