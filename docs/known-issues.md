# Known issues

Issues found in the October 2026 audit and left open, with where each one is and a way to fix it. The audit's fixes are in the history from `fix: free seats held elsewhere when a station is sold or demolished` onward; each came with a test that fails without it.

When one of these is fixed, add a test that fails without the fix, as for any bug, and take it off this list.

## Housekeeping

- **Screenshot tests can catch a panel mid-animation under load.** On 14 October 2026 a full screenshot run, straight after an end-to-end run, failed the two room inspectors and the karma dialog with the whole panel shifted, then passed them twice each alone. If it keeps happening, wait for the pop-in animation to finish before each picture.
- **`warns when the game is also open in another tab` timed out once, under load,** in a full run on 14 October 2026 that took 5.7 minutes instead of the usual 2.4, and passed three times in a row alone straight after.
- **An end-to-end test failed once, under load.** `the camera pans and zooms` failed in one full run on 14 October 2026 that took twice as long as usual, and passed three times in a row alone straight after. Its details were overwritten by the rerun. If it fails again, keep `test-results/` before rerunning.
