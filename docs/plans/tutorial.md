# Tutorial mode: design and plan

A plan, 22 October 2026, for a tutorial that walks a first game at Willow Lane through its opening and explains each thing the first time it happens, on by itself for the first campaign game and switched off (or on again) in Settings. It builds on the first-game heads-ups of 0.32.2 rather than replacing them. The mockups of the options are on the canvas [Tutorial Mode Mockups](https://claude.ai/artifact/2m9vMpKHMt6LeyVsRjqniW).

**Status, 25 October 2026: built.** The recommendation (A and C together) shipped in 0.33.0, all three phases (`86b110d2`, `b5429c8d`, `8d7d334c`), with changes since in 0.33.1 (the pause and play steps, the applicants' ring), 0.33.4 (a lesson on money) and Unreleased (a lesson on the first cold snap, and lessons once each across the campaign). Two things were not done: the announcer's opening line, and drawn pictures for the lessons, whose strips use the game's icons. Where the build went another way from the design below, a note marked "As built" says how.

## What the Two Point games do

Checked on 22 October 2026 against the fandom wikis (read through their API), Steam discussions, patch notes, reviews and let's-play captions. The interface's finer behavior (whether buttons pulse, whether a card has a Next button) is not documented anywhere readable, so what is said of it below comes from players describing the screen and is marked _unverified_.

**There is no tutorial mode in any of the three games, and no switch for one.** The tutorial is the first level of the career: Hogsport in Hospital, Freshleigh Meadows in Campus, Memento Mile in Museum. It is on by default because it is the level, it cannot be skipped (only the intro video can), and starting a new career plays it again ("oh right, we have to go through that"). The options screens have nothing about it. The only related setting is a filter on the advisor's messages: Hospital's **Advisor Messages** (added in patch 1.06, October 2018, after a launch-week chorus of "he's Dr. Clippy"), with levels such as Exclude Low Priority and High Priority Only, or off; Museum's **Advisor Filter** (Show All, Hide Low Priority, Hide All) and a Status Icon Filter. Sandbox has no tutorial in any of them and is locked until the tutorial level's first star. ([TPH wiki: Tutorial](https://two-point-hospital.fandom.com/wiki/Tutorial), [Preferences](https://two-point-hospital.fandom.com/wiki/Preferences), [Patches](https://two-point-hospital.fandom.com/wiki/Patches); [TPC wiki: Freshleigh Meadows](https://two-point-campus.fandom.com/wiki/Freshleigh_Meadows); [TPM wiki: Memento Mile](https://two-point-museum.fandom.com/wiki/Memento_Mile); [Steam: Advisor Filter](https://steamcommunity.com/app/2185060/discussions/0/603024075879670845))

**The tutorial is a chain of objectives, one at a time, in the same panel as the star goals.** Each step is a small, countable thing (build a reception desk; hire an assistant; build a GP's office; hire a doctor), it appears only once the one before is done, and the star objectives take over when the chain ends, with no "tutorial complete" screen. Hogsport runs to about 18 steps and 25 to 30 minutes; Memento Mile to about 17; Freshleigh to 16 plus a set of optional side objectives that quietly expire at the first summer break. Every few steps hand out a reward: a room or item unlocked (Museum: Info Stand, Ticket Booth, Donation Stand, Staff Room, Gift Shop, each arriving with a reason to use it), which is the part reviewers praised most ("drip-fed the intricacies one by one", PC Gamer on Museum; "of all the tutorials I've dealt with in Two Point games, Museum's is the best", Shacknews). Hospital's chain, in order: look around, Reception Desk, Assistant, GP's Office, Doctor, a timed look-around (zoom, rotate, pitch), diagnose, Pharmacy and Nurse, cure, Janitor and extinguishers, benches and machines, Staff Room, Toilets and bins, further diagnosis, Ward, two more GP's offices, De-Lux Clinic, then the star rating and Kudosh explained. ([TPH wiki: Hogsport](https://two-point-hospital.fandom.com/wiki/Hogsport); [PC Gamer: Museum](https://www.pcgamer.com/games/sim/two-point-museum-review/); [Shacknews: Museum](https://www.shacknews.com/article/143212/two-point-museum-review-score))

**Nothing is blocked, and the build order is enforced by the world, not the interface.** Players build ahead freely (and in Campus at launch, building past the prompts before starting the year broke the first year, which was patched). What gates the opening is that nobody arrives until the GP's office has a doctor, or until the academic year is started, or until a Ticket Booth is placed. Time runs at normal speed; players pause for themselves. The first patient in Hogsport is scripted (always Grout, diagnosed at once) so the first cure is quick. Money is generous ($200,000 in Hogsport, £500,000 at Freshleigh), and Hogsport's patients all carry a hidden "+10% happiness" trait. ([Steam: building ahead broke the year](https://steamcommunity.com/app/1649080/discussions/0/5234891274083049081/))

**The advisor is a text card at the bottom of the screen with a figure beside it.** In Hospital, Albert Crank stands as a full 3D figure above a wide slate card at the bottom center, about half the screen wide and two lines tall, with keywords in yellow; he is not voiced. The card says what to do and where ("come down here to Hire, then Assistant"; "have a look at the message list in the bottom right"). No source confirms pulsing buttons or arrows; players describe finding the menus themselves. Museum's explainer cards pair a square picture of the mechanic in action with the text (the wiki keeps the art: Ticket-Booth-Tutorial, Gift-Shop-Tutorial and so on). Each level opens with a briefing card, and each star arrives as a letter on headed paper. ([TPH wiki image: the opening](https://static.wikia.nocookie.net/two-point-hospital/images/9/90/Tutorial-Albert_Crank_Opening.png); [TPC wiki: Interface](https://two-point-campus.fandom.com/wiki/Interface))

**Later levels teach the same way.** Each new hospital opens with its own short chain that unlocks the level's new system under a "licence" (Flottering: Training; Mitton: Research; Flemington: Marketing), and each Museum chapter opens with tutorial-tagged objectives for what is new there. Problems are left to the advisor and the tannoy as they happen. ([TPH wiki: Flottering](https://two-point-hospital.fandom.com/wiki/Flottering))

**What went wrong, and what players asked for:**

- The advisor nags: tips firing a second after the thing they are about, the same tip over and over, advice that ignores the state of the hospital. Both studios' fix was a filter, which players then found coarse and undocumented.
- Arbitrary steps that are not needed for the star (Hogsport's second GP's office).
- Deep systems go untaught: diagnosis certainty and thresholds fill Hospital's forums; Campus's Advice screen names problems but "doesn't teach how the systems work" (IGN); Museum's expeditions stall progress; players stuck at one star did not understand the star cap.
- Too many pop-ups at once mid-tutorial.
- No way to skip it for a veteran.

**Theme Hospital (1997)** had a click-by-click tutorial (order the desk, accept, rotate, place; select, browse, choose, place the receptionist), each click with its own error line, and its fan rebuild CorsixTH puts a Tutorial on/off switch on the New Game window. Two Point moved to objective-sized steps with flavor text. ([CorsixTH strings](https://raw.githubusercontent.com/CorsixTH/CorsixTH/master/CorsixTH/Lua/languages/english.lua))

## What we have already

0.32.2 is closer to Two Point than it looks:

- The **advisor** at the bottom left walks the opening in order (desk, Receptionist, Consultation Room, Consultant, Massage Suite, Therapist), and the center opens only once the three are built and staffed, which gates the guests exactly as Two Point does. After that it nudges about whatever matters most, weighed and worded for the state of the game, with a "Show me" that glides the camera. It never repeats a tip: `tipOnce` keeps 37 first-time tips in `seenTips`.
- The **first-game heads-ups** (`primer.ts`): a first Willow Lane game with no campaign stars says what the center will need a little before the trouble (a Caretaker, Smudging, a Staff Room), under a "Coming up" kicker and as a toast, with a "Getting ready" checklist under the objectives, and ends them for good with a word once all are in place.
- **Harm cards** explain a failure the third time it happens for the same reason, with the numbers and a button to the fix.
- The **tool hint** at the top says what the tool in hand does and why it cannot be used here.
- The **objectives panel** opens each objective to the numbers behind it.

What it lacks, which a tutorial would add:

1. **A name and a switch.** None of this is called a tutorial, and none of it can be turned off, or on again for a replay.
2. **Pointing.** "Open the Items menu" does not say where the Items menu is. A first player with nine round buttons, five system buttons and a bar of figures has to read the labels.
3. **The interface itself.** The camera (pan, turn, zoom), pausing and speed, clicking a guest or a member of staff to see their inspector, the line in a station's inspector, the overlays, the objectives' numbers: none is ever introduced.
4. **The moment something happens for the first time.** The first guest walking in, the first heal, the first payday, the first failed treatment, the first star: each is where a two-line explanation lands best, and today each gets at most a toast.
5. **A clear end.** The heads-ups end with a toast; a tutorial should hand over.

## Options

Three shapes, on a scale from pointed to quiet. The mockups show each on the real opening screen.

### A. Guided opening

Two Point's chain, with pointing. The advisor's spot holds a **step card** instead of the plain note: a kicker (Tutorial · step 2 of 12), a title, a sentence or two, **Show me** and a small **Skip the tutorial**. The thing the step wants is **ringed in gold** and pulses: the Items button while the menu is closed, the Reception Desk card once it is open, the Build button once the room is planned. The ring follows the player through the menu rather than opening it for them. The "Getting ready" list becomes a **Tutorial** list with the step in hand and the ones done. Nothing is blocked, the game runs, and the advisor's urgent nudges (someone about to quit, a guest about to go home worse off, the bank) take the spot back when they fire.

- For: the surest teaching of the interface. The step is always visible and always points somewhere. Easy to skip, step by step or all at once.
- Against: the most chrome. A ring that chases the pointer through three menus can feel like being led by the nose, which is the "holds your hand" complaint. More to build: a target for every step and a ring in three components.

### B. Coach in the corner

The lightest change. The advisor as today, with a **Tutorial** kicker over its opening nudges, a **Point me there** link in the note that rings the button (or card) for a few seconds and then stops, and the heads-ups' checklist extended to the whole opening. No step count, no skip beyond the Settings switch, no cards elsewhere. The interface is taught by one toast each the first time it matters ("W, A, S and D move the camera; Q and E turn it").

- For: smallest build, nothing new on screen, nothing to skip. Fits how the advisor already talks.
- Against: it teaches only what the advisor happens to say. The first guest, the first payday and the first failure still arrive without a word, and a toast about the camera keys is easy to miss. It is the heads-ups renamed.

### C. Lessons

Museum's drip-feed, in moments. The opening chain stays as the advisor does it today (with B's pointing), and the teaching goes into **lesson cards** that open the first time something happens: a dialog over the game, which pauses, with a strip of pictures and a few lines, **Show me** (to the guest, the staff, the room) and **Got it**. Eight or so in a game: your first guest (check in, consultation, treatment, pay, and the two bars on everyone), your first heal (the money, the reputation figure, the objectives), staff tiring, your first payday, a treatment failed (chance of success, bad vibes, Smudging), losing patience (benches, tea, the line in a station's inspector), someone wants a raise, your first star (what it opened, karma). Each is shown once a game, kept in `seenTips` like a tip, and the star one folds into the star dialog that exists.

- For: teaches the systems players actually get lost in, at the moment they first bite, which is what every Two Point review asked for and none of the three games does. Pictures do the work. A card can be read in ten seconds.
- Against: a dialog that pauses the game is an interruption, and eight of them in the first hour is a lot if they all land in the same ten minutes (the first guest, the first heal and the first money arrive within a day of each other). Pictures are work: one illustration per lesson, in the game's style.

### The recommendation: A for the opening, C for the moments

Build A's step card and ring for the opening chain, and C's lesson cards for the first-time moments, with B's rule that nothing ever blocks. Two Point's lesson is that the chain teaches the interface and the moments teach the game, and that the chain without the moments leaves diagnosis, money and morale untaught. A alone does the first; C alone does the second. Together they are the tutorial. Keep the lesson count at eight, spaced by what triggers them (the first guest and the first heal are one lesson, not two, since they are a day apart), and never show two in the same day.

## The design

### The switch

- **Settings** gets a **Help** heading above Treatments, with a **Tutorial** row: "Walk a new Willow Lane game through its opening, pointing at each button, and explain each thing the first time it happens. On by itself for your first campaign game." The toggle is kept in `storage/settings.ts` beside the discipline preferences and applies to new games; in the pause menu's Settings it also stops or restarts the game in progress, like a discipline switch.
- **The rule at a new game** (`boot.ts`, where the primer is switched on today): the tutorial is on when the setting is on, the center is Willow Lane, and the campaign has no stars yet. The sandbox and the other centers never get it; their openings are already covered by the advisor and the center cards.
- **A replay**: the Willow Lane card in the campaign panel shows a **Tutorial** switch under its Play button, set by the rule (on before the first star, off after) and remembered for the next replay, so a player can play Willow Lane again with it or without it without touching Settings.
- **Skip the tutorial** on the step card turns it off for this game and says so in a toast ("The tutorial is off. Settings turns it back on."). The lessons stop too.
- Turned off in a first game, the heads-ups of 0.32.2 carry on as they are, so a player who skips still gets the Caretaker, Smudging and Staff Room warnings.

As built: one setting covers the steps and the lessons together, stored as `on`, `off` or `done` (`done` once a game has handed over, so the next Willow Lane game starts without the steps but keeps the lessons). The switch on Willow Lane's card is that same setting, not a `tutorialReplay` of its own. The lessons are a flag of their own on the state (`lessons`) and come in every campaign center, not only Willow Lane.

### The opening chain

Twelve steps, each a small function over the state as `primer.ts` does it (`due` and `done`), in order, with a target to ring:

1. **Look around.** W, A, S and D or the screen's edges move the camera, Q and E turn it, the wheel zooms, Space pauses. Done when the camera has moved and turned, or after 20 seconds. No ring.
2. **Place a Reception Desk** near the entrance. Rings the Items button, then the Reception Desk card, then nothing while it is in hand (the tool hint takes over). Done: `hasItem(reception_desk)`.
3. **Hire a Receptionist.** Rings Hire, then the Receptionist tab, then the first Hire button.
4. **Build a Consultation Room.** Rings Rooms, then the card, then nothing while dragging (the hint says "drag out the floor"), then the Build button on the plan panel. Done: `hasRoom(consult)`.
5. **Hire a Wellness Consultant.**
6. **Build a Massage Suite.**
7. **Hire a Massage Therapist.** Done opens the center, and the first lesson (your first guest) follows when they walk in.
8. **Put down two Benches.** Due once the center is open. Done: two benches.
9. **Hire a Caretaker.** The heads-up as today, due after the first heal.
10. **Train a Caretaker in Smudging**, by way of a Training Room. As today.
11. **Build a Staff Room.** Due as anyone tires (`PRIMER_TIRING`). As today.
12. **See the land for sale.** The heads-up on land being added to `primer.ts` on main (uncommitted at the time of writing: at the first star, what came up for sale and when to buy), which becomes the chain's last step.

A Restroom is left to the advisor's "crossing their legs" nudge, since by then the player has built three rooms. The chain ends with a **handoff card** in the advisor's spot: "That's the basics. From here the advisor speaks up when something needs you, and the objectives at the top left earn your first star. Click any objective for the numbers behind it." Then the tutorial is done for good in this game, as the heads-ups are today.

As built (`OPENING` in `src/core/sim/tutorial.ts`): the chain is thirteen steps, not twelve. A **Pause the clock** step comes second and a **Start the clock** step once the desk, both rooms and all three hires are in (0.33.1), then the two Benches, ten for the opening; the Caretaker, Smudging and Staff Room heads-ups follow as steps. Looking around counts as done after two game days rather than 20 seconds. The heads-up on land stayed a heads-up of its own at the first star rather than the chain's last step, and the Benches wait behind any heads-up that is due.

### The step card

Replaces the advisor's note while a step is in hand, in the same spot, the same cream bubble with the advisor's face:

- A kicker, **Tutorial · step 4 of 12**.
- A title in bold, the step's label.
- One to three sentences: what, where, and why in a few words.
- **Show me**: a teal button that opens the menu the step wants (or glides to the thing), which is where the ring then sits.
- **Skip the tutorial**, small and grey, to the right.

The advisor's weightier nudges keep their place above the opening walk-through in `nudge()`, so a member of staff about to quit or a guest about to go home worse off takes the spot until it is seen to, and the step card comes back after.

### The ring

A gold ring, 4 pixels, with a slow pulse, drawn by a `.guide` class on whichever element the step's target names. `HudState` works the target out each redraw from the step and what is open (`tutorialTarget()`), and the components that can carry it check their own id against it: the build buttons (`menu:items`), a menu's role tab and cards (`hire:receptionist`, `item:reception_desk`, `room:consult`), the plan panel's Build button (`plan:build`). The ring never moves the camera or opens anything by itself; Show me does that.

As built: `HudState.guide()` works out the target, not `tutorialTarget()`. It also rings the clock's buttons (`speed:0`, `speed:1`) and the Items menu's filters, and on a hiring step it rings the whole row of applicants rather than the first Hire button (0.33.1).

### The Tutorial list

The "Getting ready" group under the objectives becomes **Tutorial**: the steps done ticked, the step in hand in bold, and the ones to come in grey, with the count in the heading (Tutorial · 4 of 12). Folded to the count and the step in hand after the first five, opening on a click, so it does not crowd out the star objectives.

### The lessons

A `LessonDialog` over the game, which pauses it as any dialog does, raised by the sim through a new event (`{ type: 'lesson', id }`) and shown once a game, kept in `seenTips` under `lesson-<id>`:

| Lesson             | When                           | What it says and shows                                                                                                                                      |
| ------------------ | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Your first guest   | The first guest walks in       | A four-picture strip: check in at the desk, a consultation, a treatment, paying. Everyone has a patience bar and a condition bar; click anyone to see them. |
| Your first heal    | The first heal                 | The money and reputation in the bottom bar; the objectives at the top left count toward a star; a star opens new rooms, treatments and items.               |
| Staff tire         | Anyone's energy under 50       | Worn out, staff work slowly and botch treatments; a Staff Room; the Staff menu shows everyone's energy. Replaces the Staff Room heads-up toast.             |
| Payday             | The first payday               | Wages go out at the end of each month; the Money menu's Payroll tab shows the next one against the bank; loans and the red.                                 |
| A treatment failed | The first failure              | The chance of success in a guest's inspector and what lowers it; bad vibes over the room; Smudging or a Reiki Practitioner clears them.                     |
| Losing patience    | The first guest who storms out | Benches, tea and a Restroom keep guests patient; the line in a station's inspector moves guests up or sends them home.                                      |
| A raise            | The first raise request        | Underpaid staff ask and then quit; ranks and promotions; the card at the right.                                                                             |
| Your first star    | Star 1                         | Folded into the star dialog that exists: a paragraph on what the star opened and on karma.                                                                  |

Each lesson has a square picture per panel, drawn in the game's clay style as the Museum cards are (a job for `scripts/`, from the game's own scene at the right moment, or hand drawn). Until the pictures exist the strip shows the icons the game has (`room-`, `role-`, `ui-`), which is enough to ship.

As built (`LESSON_IDS` in `src/core/sim/lessons.ts`): nine lessons. The seven above the star, and the star as a paragraph in the star dialog, as planned; then **Money**, the first time the bank holds less than the next payday takes, with a Show me to the Loan tab (0.33.4), and **the first cold snap**, with a Radiator or an Air Conditioner put in hand (Unreleased). Every trigger is checked once a second from the state (`checkLessons`), not from the events in `guests.ts`, `stations.ts` and the rest. Since Unreleased each lesson comes once across the campaign, in whichever center it first happens (`recordLesson` in `src/storage/campaign.ts`), not once a game. The strips still use the icons: no pictures were drawn.

### Pacing

Unchanged. Guests arrive only once the center is open, which is Two Point's gate. Time runs; a lesson pauses while it is read, and the step card never does. No scripted first guest and no hidden patience bonus: the memory of this project's balance work is that the first game should communicate, not soften.

As built (0.33.1): the step card still never pauses by itself, but its second step asks the player to pause the clock while the opening is built, and a later step asks them to start it again. A player who never pauses is not asked to start it.

### Counting it

Three play-statistics events, beside `menu_opened`: `tutorial_step` (step id, day, whether Show me was pressed), `tutorial_skipped` (the step it was skipped at), `lesson_shown` (id, day). With them the dashboard can say where first players stop.

As built: `tutorial_step` carries the step id only (each step counted once as it is first reached, in `src/app/analytics.ts`), and `tutorial_skipped`, `tutorial_done`, `lesson_shown` and `lesson_show_me` are sent from `src/ui/hud.ts`.

## The plan

### Phase 1: the switch and the chain

- `src/storage/settings.ts`: the `tutorial` preference, on by default, with `loadTutorialPref` and `saveTutorialPref`; a `tutorialReplay` preference for the campaign card.
- `src/core/state/types.ts`, `game.ts`, `upgrade.ts`: `tutorial: boolean` on the state in place of `primer`, save version 37, the upgrade reading `primer` into it.
- `src/app/boot.ts`: the rule at a new game.
- `src/core/sim/tutorial.ts`: the steps, built from `primer.ts` (which it replaces): `STEPS` with `due`, `done`, `card` (title, text) and `target`; `tutorialStep(ctx)`, `tutorialLines(ctx)`, `tutorialDone(ctx)`; `skipTutorial(ctx)`.
- `src/core/sim/advisor.ts`: the opening walk-through reads from the steps; `warnPrimer` becomes `warnTutorial`, saying each step's heads-up once as today and ending with the handoff.
- `src/ui/hud.ts`: `tutorialTarget()`; `skipTutorial()`.
- `src/ui/components/TutorialCard.tsx` (and `.css`): the step card, drawn by `Advisor.tsx` in place of the note while a step is in hand.
- `src/ui/components/BuildButtons.tsx`, `menus/HireMenu.tsx`, `menus/ItemsMenu.tsx`, `menus/RoomsMenu.tsx`, `PlanPanel.tsx`: the `.guide` class; `src/ui/theme/buttons.css`: the ring.
- `src/ui/components/Objectives.tsx`: the Tutorial list in place of Getting ready.
- `src/ui/components/SettingsPanel.tsx`: the Help heading and the Tutorial row, working on the game in progress through `sim.setTutorial(on)`.
- `src/app/analytics.ts`, `play-events.ts`: the three events.
- Tests: `tests/unit/tutorial.test.ts` from `first-play.test.ts` (order, due and done for each step, skip, the handoff once, nothing in a sandbox or a second game); `tests/e2e/game.spec.ts`: the ring on the Items button in a first game, following into the menu, gone after Skip; the Settings switch stopping it; a visual snapshot of the step card.
- `docs/guide.md` (Settings), `CHANGELOG.md`.

Medium: two to three days.

**Done** in 0.33.0 (`86b110d2`). As built, `primer.ts` stays and `tutorial.ts` builds on it rather than replacing it: `tutorial` and `lessons` sit beside `primer` on the state, not in its place (save version 37, as planned), and `warnPrimer` stays in `advisor.ts` beside `warnTutorial`, which is in `tutorial.ts`. The steps are `OPENING`, each with a `want` rather than a `target`, read through `currentStep`, `tutorialLines` and `warnTutorial`; there is no `tutorialStep(ctx)` or `tutorialDone(ctx)`, and no `tutorialTarget()` (see The ring).

### Phase 2: the lessons

- `src/core/sim/lessons.ts`: the triggers, each a small function over the state checked once a day or on the event that causes it (the first guest in `guests.ts`, the first heal and failure in `stations.ts`, payday in `economy.ts`, a raise in `careers.ts`), raised through `emit(ctx, { type: 'lesson', id })` and kept in `seenTips`.
- `src/ui/hud.ts`: a `lesson` dialog, raised like the star dialog (in line behind whatever is showing, never two in a day).
- `src/ui/components/dialogs/LessonDialog.tsx`: the strip, the text, Show me and Got it; `StarDialog.tsx`: the tutorial paragraph.
- Pictures: a first pass from the game's icons; a second from rendered scenes.
- Tests: each lesson once, in order, never two in a day, none with the tutorial off; a visual snapshot of a lesson.

Medium: two days, more for pictures.

**Done** in 0.33.0 (`b5429c8d`), with the icons for pictures; the second pass from rendered scenes was not done.

### Phase 3: the replay switch and polish

- `src/ui/components/CampaignPanel.tsx`: the Tutorial switch on the Willow Lane card.
- The camera step: `view` reports whether it has panned and turned.
- The announcer: a line for the opening ("Welcome to Willow Lane") if the voiced set has room.
- `docs/guide.md`: a Tutorial section under How to play.

Small: a day.

**Done** in 0.33.0 (`8d7d334c`, `ba1c136f`), except the announcer's line: none was added for the tutorial, and the opening-day lines every center has (`src/core/sim/progress.ts`, listed in [dev/announcements.md](../dev/announcements.md)) play as before.

## Decisions to make

1. **A, C, or both.** The recommendation is both, A for the opening chain and C for the moments. B is the fallback if the whole thing has to be a day's work. _Built: both._
2. **Where the switch lives.** Settings (Help heading) plus the Willow Lane card, or Settings alone. _Built: both._
3. **Whether lessons pause.** The recommendation is yes, as every dialog does; the alternative is a card at the top center like the harm cards, which does not pause and can be ignored. _Built: they pause, as every dialog does._
4. **Pictures or icons** for the lesson strips in the first release. _Built: icons, and still icons._
