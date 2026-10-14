# Known issues

Issues found in the October 2026 audit and left open, with where each one is and a way to fix it. The audit's fixes are in the history from `fix: free seats held elsewhere when a station is sold or demolished` onward; each came with a test that fails without it.

When one of these is fixed, add a test that fails without the fix, as for any bug, and take it off this list.

## Housekeeping

- **An end-to-end test failed once, under load.** `the camera pans and zooms` failed in one full run on 14 October 2026 that took twice as long as usual, and passed three times in a row alone straight after. Its details were overwritten by the rerun. If it fails again, keep `test-results/` before rerunning.
