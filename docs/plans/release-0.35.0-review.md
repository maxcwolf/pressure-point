# Closing out the 0.35.0 review

A plan, 28 October 2026, for everything the pre-tag review of 0.35.0 left open. Four fixes went in on the day (the bubble over tall heads, Former Influencer as the one costly quirk, Holds Space kept from Caretakers, the wave dialog's date and a switched-off wave coming back). What is left falls into five streams. A, B and C can run at the same time, each in its own worktree; D waits for A; E goes last, on main.

The review itself: six Opus reviewers over quirks, waves, the UI code, the symptom models in the lab, a Playwright play-test, and the check suite, plus a replay of six balance games against a v0.34.3 worktree. The stance throughout is [challenging but fair](../balance/log.md): communicate, give counterplay, keep the pressure, remove the cliff.

## Decisions to make first

Each has a recommendation; the streams below assume it.

1. **Healing Hands is a trap.** A 10% second chance on rolls that already succeed 75 to 90% of the time adds one to two heal percentage points, for 25% more pay. Recommended: a rescue of one failed treatment in three (`hands` in `src/core/data/staff.ts`), description to match. Alternative: keep the odds and drop its pay to ×1.10.
2. **Holds Space only reaches station work**, not Caretaker chores, soul retrieval, wards or calming runaways, while its description says "colleagues working nearby". Recommended: narrow the description to colleagues at a desk, table or mat. Alternative: extend the effect to chores, which have no post.
3. **Burnout Survivor never quits and cannot be poached**, since the floor of 35 sits above the miserable threshold and the poach threshold. Recommended: keep both and write them into the description. Alternative: let a rival poach them.
4. **A ready center cannot turn a wave away** short of removing the burner. Recommended: a Let them in / Turn them back switch on the wave card, default in. Alternative: wait for Max's own play of The Exchange before adding anything.
5. **One to three quirks, or one to two.** Recommended: keep one to three until stream D has measured; `QUIRKS_MAX` in `src/core/people.ts` is the lever.
6. **Waves in 0.35.0.** Recommended: they stay behind the Feature testing switch, off, whatever Max's play finds; the release note already says so.

## Stream A: quirks that show and pay their way

Core and UI. Files: `src/core/data/staff.ts`, `src/core/sim/stations.ts`, `careers.ts`, `staffing.ts`, `src/ui/components/common/QuirkChips.tsx`, `menus/HireMenu.tsx`, `menus/StaffMenu.tsx`, `inspector/StaffInfo.tsx`, `inspector/StaffCompare.tsx`, `menus/looks.ts`, `menus/TreatmentsMenu.tsx`, `docs/guide.md`, `CHANGELOG.md` (the quirks line only), `tests/unit/quirks.test.ts`, the hire and inspector visual snapshots.

1. **A cue in play for every rare quirk.** None of the four shows anything when it fires. Healing Hands: a floater over the table on a rescue, and a tally in the inspector ("Healing Hands saved 4 treatments"). Former Influencer: a reputation floater on each heal, and the same tally. Holds Space: a line in the holder's inspector ("Holding space for 3 colleagues") and one in each sped-up colleague's ("Working 15% faster: Priya holds space"), and `StaffCompare` showing the sped-up speed. Survivor: the description rewritten per decision 3.
2. **Healing Hands** per decision 1; **Holds Space** wording per decision 2.
3. **Hire cards.** A row stretches to its tallest card (344px with four quirks against about 248px), so the salary pill floats mid-card over empty space. Pin the salary and the buttons to the bottom and let the quirk list take the slack. The "rare ·" word should not end a line on its own.
4. **Staff menu rows** vary by 4px because the rare chip's border adds height: give every chip the same box. Chips that are written out should not repeat their description in a tooltip, and should not show a help cursor inside a row that selects on press. Put the quirk names and descriptions into the row button's label so keyboard and touch players get them too.
5. **Guide and leftovers.** The tutorial line (guide step 18's opening) still says quirks are green and red, without the gold rare chip. `em.good`/`em.bad` in `menus/looks.ts` are unused. `TreatmentsMenu`'s early check duplicates `openedEarly()` in `waves.ts`.
6. **Tests and pictures.** Unit tests for each cue and tally. A visual fixture with a three-quirk card plus a rare one, and the inspector of such a hire: today's baselines use the old fixture save with no quirks.

## Stream B: waves that read right

Core and UI. Files: `src/core/sim/waves.ts`, `progress.ts`, `src/app/boot.ts`, `play-events.ts`, `src/ui/components/dialogs/WaveDialog.tsx`, `Objectives.tsx`, `src/ui/lib/dialogs.ts`, `menus/TreatmentsMenu.tsx`, `docs/guide.md` (the Feature testing section only), `CHANGELOG.md` (the waves line only), `tests/unit/waves.test.ts`, `play-events.test.ts`, new visual snapshots.

1. **Reopen the dialog.** Once closed, the cause, the guests-a-week figure and the lounge note are gone. Clicking the Going around card opens it again.
2. **The line check counts the wrong staff.** `Objectives.tsx` counts every member of the role; count those trained in the technique.
3. **Ready means on site.** `qualified` in `waves.ts` counts staff away on a house call, sick or on holiday.
4. **Small text.** "In 1 days"; a text ⚠ where the rest of the UI uses the `ui-warning` icon; the "Open early, before star 2" chip wrapping its "2" onto its own line; the card collapsing to one line once every check is met, so it fits the narrow objectives panel for 37 days.
5. **Queued dialog.** `stillDue` in `src/ui/lib/dialogs.ts` does not cover `wave`, so a dialog waiting behind another opens for a wave already ended.
6. **The switch's edges.** `scheduleWave` in `progress.ts` runs with the feature off; gate it. Games are created with `features: {}`, so a future default flip would turn waves on in every save: have boot write explicit values.
7. **Dead code and drift.** `stats.later` is written and never read. `chased` in `play-events.ts` is "any came in", not "trained or bought the kit" as the design doc says; make the doc match. Stale comments at `sim.ts` (`waveReady` leaves out the lounge) and `play-events.ts:208`.
8. **Opt-out switch** per decision 4.
9. **Pictures.** Visual snapshots of the wave dialog, the card warning and running, and the Feature testing section; `settings.png` predates the section.

Gate: Max plays The Exchange with the switch on. The bot's chase healed 17 of 30 with one Acupuncturist; what a good player's chase does is the open measure in balance log entry 51.

## Stream C: symptom models, round 11

Render only. Files: `src/render/models/character-heads.ts`, `character-bodies.ts`, `character.ts`, `pose.ts`, `src/lab/main.ts`, `tests/unit/body-language.test.ts`, `model-cost.test.ts`. Every change is shown at play size and close up, front, side and from the game camera, standing, sitting and lying, and nothing merges until Max approves it by name, as in rounds 1 to 10 (`docs/planning/fun/options/symptoms/approvals/`).

1. **Scattered reads as a normal guest** from the game camera: the pieces float straight up, so from above and in front the gaps close. Offset the head and torso sideways and forward with a slow circular drift, and ease the cure's snap-back over the puff instead of one frame.
2. **The G-clamp is a red stick** from above: its frame sits behind the head. Turn it to the side so the frame shows, clear of the face.
3. **Eight props sink 8 to 12 cm into the table** while lying: the storm cloud, bottle, tumbler, snow globe, cactus pot, egg, apple core and plug cable. Shell props (bottle, tumbler, globe, pot) hide while lying as the chair does; head props sit at pillow height; the storm's lightning stops while lying as its rain does.
4. **The giant phone is put away lying but not sitting**, where it sticks half a meter into desks and the next guest. Put it away while sitting too, or hold it small in the lap.
5. **Faces.** The apple core's pips read as extra eyes and its cap hides the face from above; the lobster's feelers cross the face from the game angle.
6. **Sitting shells.** A sitting bottle or cactus guest's shell goes down through the bench. Shorten it to the bench while seated, or hide it as while lying; show both in the lab for the choice.
7. **Lab.** `&healed=1` is read before the model is built, so it does nothing; apply it after. Add `&pose=sit|lie` if the lab has no way to pose for the approval sheets.
8. **Budget.** The catalog costs 3890 of 3900 draw calls. Trim the parts that cannot batch (the bottle and tumbler have four each, the monitor two) before raising the budget.

## Stream D: measure the quirks

Balance harness, after A merges. Files: `tests/balance/bot.ts`, `tests/balance/harness.ts` (or wherever the per-game output is written), `docs/balance/log.md`.

1. **Log quirks.** The harness output records head count and wages only. Record each hire's quirks, and per game: flaws hired, rares hired, payroll share from quirk pay.
2. **The bot reads the card.** It picks the best rank then the cheapest, so it never takes a rare and leans into flaws, which cost more than they save. Weigh each applicant's quirks at what they are worth (speed, stamina, walk and the rares) against their pay and pick the best value in the top rank. The bot stands in for a good player, and a good player reads the card.
3. **Run it.** Five centers, 24 seeds, four years, HEAD against a v0.34.3 worktree, about an hour at six slots; 72 seeds if the difference is within the noise. Stars by month, games lost, bank at month 47, payroll, and the quirk counts. Log it as entry 52.
4. **Decide the lean.** The two games lost in the six-game spot check (High Pines seed 1, Willow Lane seed 1) were won on v0.34.3, but six seeds with reshuffled dice prove nothing. If stars come more than a month sooner, or more games are lost, the levers are `QUIRKS_MAX`, the flaw pay discounts and Holds Space's 15%. The target is the same stars as 0.34.3 within noise.

## Stream E: release

On main, last.

1. `sim.chaos.test.ts` seed 2 ran 40 seconds against a 30-second limit in the full suite and passed alone; give that file a longer timeout before CI meets it.
2. Commit `docs/README.md` with the 18 planning files it links to, or the links break.
3. New visual baselines from A, B and C, then the full suite, e2e, visual and desktop.
4. Version 0.35.0, the changelog section renamed, tag and push, per `docs/dev/releasing.md`.

## Order

C first, since its approval rounds take the longest and need Max. A and B alongside it. Each stream edits only its own changelog and guide lines, so the merges are clean; none bumps the save version. D once A is in. E once everything is. Max's own part: the six decisions, a play of The Exchange with waves on, and the round 11 approvals.
