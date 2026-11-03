# Known issues

Issues found in the October 2026 audit, or along the way since, and left open, with where each one is and a way to fix it. The audit's fixes are in the history from `fix: free seats held elsewhere when a station is sold or demolished` onward; each came with a test that fails without it.

When one of these is fixed, add a test that fails without the fix, as for any bug, and take it off this list.

## Housekeeping

- **`regulars come back under their own name` failed once, under load,** in a full end-to-end run on 15 October 2026 while unit tests were running alongside, and passed alone straight after. Its waits were read again on 22 October 2026 and none waits on the wrong thing: the regular is spawned by ticking the game directly, and the inspector and the Regulars tab are waited for. No cause shows.
- **`clicking a toast about someone selects them and takes the camera there` failed once,** after 1.1 seconds, in a full end-to-end run on 15 October 2026 straight after the unit tests, and passed three times in a row alone straight after. No cause shows: Playwright checks that a click lands on the toast it means, and both waits after it poll for what they check.
- **CI runs end-to-end tests 2 at a time per machine, checked on 22 October 2026.** CI got the speedup from not drawing (`0c8b7ef`): each of the four parts took 5 to 11 minutes before it and about 1 minute after, and takes 1.3 to 3.2 minutes now with about twice the tests. The two workers stay busy (part 4 ran 267 seconds of tests in 140), so a third might help, but GitHub's machines have four cores and each test runs a whole browser with software WebGL, so try it on a branch and watch for retries before changing it. Part 4 took twice as long as the others, its slowest tests saved-games tests that drew each save's picture; tests that do not draw now skip the picture too.

## Karma

- **The campaign's karma doesn't cover every floor and wall as well as everything else.** The campaign's stars and achievements earn 52 karma (2 for each of the 15 stars, and 22 from the eleven achievements), exactly what the eleven items in the karma shop cost together (`tests/unit/karma.test.ts` checks it). The Carousel of Rebirth costs 10 more (`wheel_of_rebirth` in `src/core/data/items.ts`), bought from its card in the Rooms menu rather than the shop, and the floors and walls 13 more (`src/core/data/decor.ts`): 75 in all. Since 0.33.7 the Pressure Point Foundation adds up to 15 (three gifts of 1 karma at each of the five centers, `FOUNDATION_KARMA` in `src/core/data/karma.ts`), so a player who finishes the campaign and gives every gift has 67: every shop item and the Carousel (62), and 5 to spend on floors and walls, but not all of them. The changelog for the hidden achievements says finishing the campaign is enough to unlock everything, which holds for the shop alone; the guide says plainly that the rest is a choice. Fix, if it matters: say the same in the karma shop itself, or make the gifts worth enough to cover the floors and walls too.

## Saves

- **Versions 0.5.0 and earlier crash on a save from a newer version.** The current game refuses a newer save cleanly, but those old builds have no such check, so a save imported into one, or an autosave left when going back to one, crashes it at the title screen. This can't be fixed in a new build. It is only worth a line in the release notes if someone goes back to an old version.
