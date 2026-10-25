# Polish pass: the October features up to Two Point's bar

A review, 22 October 2026, of what merged to `main` since 0.31.0 (the Unreleased section of [CHANGELOG.md](../../CHANGELOG.md)): the really bad trip, the flooded restroom, the Gong of Last Resort's rattle, rides on the Carousel of Rebirth, the Generator and items outdoors, floor paid for at build, standing earned by working, the rival's ceiling, more land, the first paydays on the campaign cards, and the small icons. The yardstick is the one [audits/two-point-gaps.md](../audits/two-point-gaps.md) set: in a Two Point game every event is announced, seen and heard, has a lever the player can see and a stake they can feel, and is funny on the way through.

**The verdict.** The mechanics are sound and every feature has unit tests that read as the rules, an end-to-end test where the player touches it, and a guide sentence. What is thin is presentation and stakes, and almost all of that is in the really bad trip: it is the first guest-driven event in the game and it arrives with a toast, a pose and a button, where a stress outbreak arrives with a pill, an announcement, a countdown and a reward. The flood and the Generator each want one or two touches to be seen working. The rest is finished.

The rule from [research/fair-challenge.md](../research/fair-challenge.md) holds throughout: nothing here makes the game easier. Where a stake is added, the warning and the lever come with it.

Four pieces of work, in this order. A is the one that matters and goes first; B and C are small and independent of A and of each other; D is a bundle of gags, each its own commit.

| Piece                         | Done when                                                                                             |
| ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| A. The bad trip as an event   | a runner is found, sent to and settled without opening an inspector, and ignoring one costs something |
| B. The flood seen and felt    | a Caretaker mops, the water moves, and a guest who found the restroom under water says so             |
| C. The Generator seen working | it puffs and rumbles only while it carries the center, and a day on diesel costs money                |
| D. Small gags                 | each is one commit with a test                                                                        |

## How to work

- **Read first:** [dev/development.md](../dev/development.md) (how the code is laid out, the test suites and what each is for, the `window.pp` handle the end-to-end tests use), [dev/architecture.md](../dev/architecture.md), the Shamanism paragraph and item 26 (mishaps) of [guide.md](../guide.md), and the code named under each piece before changing it. The sim is in `src/core/sim/`, pure and seeded; the renderer in `src/render/` reads the sim and never writes it; the interface in `src/ui/` asks `Sim` for what it shows. Every change to the game goes through a `Sim` method.
- **Branch from `main`** in a worktree, on one branch for the whole pass, and commit each numbered change below on its own with a lowercase Conventional Commit (`feat:`, `fix:`, `test:`, `docs:`). Never push, never open a pull request: this is a solo project and the owner merges local branches. If `main` is mid-merge when you start, say so and wait.
- **Every commit that changes a rule comes with a test that fails without it,** in the suite beside the one the feature already has (`tests/unit/runaways.test.ts`, `tests/unit/storm-flood.test.ts`, `tests/unit/outdoor-items.test.ts`, `tests/unit/machine-neighbors.test.ts`). Rendering changes get a model-lab specimen in `src/lab/catalog.ts` and a picture in `tests/visual/models.spec.ts` where there is one already for the thing (the runner and the puddles both have one). Interface changes that the player clicks get a step in the existing end-to-end test in `tests/e2e/game.spec.ts` rather than a new test.
- **Before finishing:** `yarn typecheck`, `yarn lint`, `yarn test` (the unit suite), the end-to-end tests that touch what changed (`yarn e2e -g "bad trip"` and so on; see development.md for how they find a dev server), the visual pictures that changed, a sentence in [guide.md](../guide.md) where the player meets each change, one line per piece under Unreleased in [CHANGELOG.md](../../CHANGELOG.md) in the same voice as the lines there, tick the items in [planning/todo.md](../planning/todo.md) that these close, and a balance-log entry for A (see A.7). Keep [dev/announcements.md](../dev/announcements.md) in step with any announcer line added.
- **Words.** Match the game's voice: plain, short, dry, in sentences; names before mechanics ("Priya is on the way"); no exclamation marks outside the announcer; `money()` for sums; `tipOnce` text explains the why and the lever. The guide is written for a player, not a developer.
- **Numbers** live in `src/core/data/rules.ts` (or the item's own definition in `src/core/data/items.ts`) with a one-line comment giving the intent, never bare in the sim. Each is a starting point: say in the balance-log entry what was measured and whether it moved.
- **Decisions already made.** Do not re-open: the runner costs reputation at the door; the pill is the lever; a Shaman is the best calmer; the Generator costs money per day it runs; flood water is noticed and slows. The owner's standing rule is "challenging but fair": warn before it punishes, name the lever, leave time for it to work.

## A. The bad trip as an event

**What it does well.** `src/core/sim/runaways.ts` is clean: the roll is drawn aside from the game's stream (`rollRunaway`), the runner releases every claim, cannot be sent home, keeps running through a rebuild (`repathAll` halts them), and the chase re-targets as they move (`followRunner`). The pose in `src/render/pose.ts` (arms up, head whipping round) reads at a glance, the lab has a specimen (`mood:runaway`), and `tests/unit/runaways.test.ts` covers the rules one by one. The constants are at the foot of the set-and-setting block in `rules.ts`: `RUNAWAY_CHANCE` 0.1, `RUNAWAY_SECONDS` 60 (ten days, at `DAY_SECONDS` 6), `RUNAWAY_SPEED` 3.2, `RUNAWAY_PAUSE` 2.5, `FREAK_RANGE` 1.5, `FREAK_PATIENCE` 10, `FREAK_STRESS` 0.35, `CALM_SECONDS` 2.

**What falls short of the bar.**

1. **No stake.** `foundDoor` only toasts and calls `leave`: a runner who finds the door after ten days costs nothing beyond the failed ceremony already charged in `badTrip` (`BAD_TRIP_REP` 1.5 on top of the failure). Freaked guests lose 10 patience and a feeling, which a healthy center shrugs off. A player who ignores the event loses nearly nothing, so the lever is not worth pulling. Compare the stress outbreak (`src/core/sim/outbreaks.ts`): a pass pays money and reputation, a fail costs both.
2. **Three clicks to the lever.** The toast selects the runner; the inspector has the button (`CalmRunner` in `GuestInfo.tsx`). Everything else that needs the player's hand in a hurry (a mishap, an outbreak, an emergency, a house call) sits as a pill at the top with its button on it and a countdown. The toast also scrolls away, and the advisor line is the only thing left pointing at them.
3. **Who goes is a lottery.** `calmerFor` sends the nearest free member of staff by straight-line distance: a Receptionist leaves the desk with a line at it (`free` only refuses someone at a post that is `serving`, and a desk never is), a Caretaker mid-corridor goes ahead of the Shaman standing in the lodge door. The role whose whole discipline is set and setting has no part in the one event the lodge causes. The button's title says only "the nearest member of staff who is free".
4. **Not heard, and only half seen.** It starts with the generic `error` sound and the runner's bubble shows for `RUNAWAY_PAUSE` at each stop (`say(g, 'bubble-stressed', RUNAWAY_PAUSE)` in `runStep`), so between stops nothing marks them in a crowd. No PA line, though the announcer comments on every other event, and nobody near them reacts: guests and staff walk on as if nothing were happening.
5. **Freaking out through walls.** `freakOut` is a distance check only, so a runner in the corridor freaks out a guest on a table in the suite beside them, whose lost patience means nothing and whose review gains a line about a thing they never saw.
6. **No first-time tip.** The mechanic is one bad trip in ten, so most players meet it once a year; the toast tells them what to do, but nothing says why or what it costs.
7. **The bot never sees one.** `tests/balance/bot.ts` calms outbreak carriers (`calmCarriers`, called from the step when `flags.trouble` is on) and never a runner, so the Orchard's balance figures are measured with every runner left to find the door.

**Changes.** Each is a commit, in this order.

### A.1 A stake at the door, and a reward for the save

- `rules.ts`: `RUNAWAY_DOOR_REP = 1.5` ("What a runner who finds the door costs in reputation, on top of the bad trip") and `RUNAWAY_SAVE_DAYS = 3` ("Calmed within this many days of starting to run, they leave grateful and the center earns back a point of reputation"). A day is `DAY_SECONDS`; the runner's clock is `g.runaway`, counting down from `RUNAWAY_SECONDS`, so "within three days" is `RUNAWAY_SECONDS - g.runaway <= RUNAWAY_SAVE_DAYS * DAY_SECONDS` at the moment they are calmed.
- `runaways.ts`: `foundDoor` calls `changeRep(ctx, -RUNAWAY_DOOR_REP)` (from `./economy`) and gives the guest a new feeling `ran-out` before `leave`. `calmedDown` checks the save window: inside it, `changeRep(ctx, +1)` and the float reads "Calmed in time" (kind `good`); outside it, the float reads "Calmed" as now. The start toast gains the stake: "…Select them and calm them down, or they will find the door and the center's name will suffer."
- `src/core/data/feelings.ts`: `ran-out` (bad, part `experience`, icon `feeling-bad-trip`): text "Ran out of the institute still tripping", lines "I ran. Nobody came. The hedge was kind." and "I left through what I am fairly sure was a wall." Add the id to `FeelingId` in `src/core/data/types.ts`.
- Tests: `ends when they find the door` grows an assertion on reputation and the feeling; a new case `earns a point back when calmed within three days, and nothing after` runs the calm at two points on the clock.
- Guide: the Shamanism paragraph says what the door costs and what a quick calm earns back.

### A.2 A pill while anyone is running

- New `src/ui/components/RunnerNotice.tsx`, mounted beside `OutbreakOffer` (find where `OutbreakOffer` is rendered: `Hud.tsx` renders `EmergencyOffer`, which stacks the others; follow that). Pattern: `OutbreakOffer`'s tucked-away form, a `Button` with `class="panel offer-pill runner-pill"` holding an `IconText` (`feeling-bad-trip`) and the thin `Bar` the mishap pill uses, with `value` the share of `RUNAWAY_SECONDS` left and `class` `thin bad` under a day. One pill per runner, newest first; cap at three with "+2 more" in the text if it ever happens.
- Text: "Fern is on a really bad trip: 7 days to the door". Clicking the pill's body selects the runner and takes the camera there, the way clicking a toast with an `about` does (find how the toast click reaches the camera in `src/ui/components/Toasts.tsx` or wherever toasts live, and call the same thing). A second control on the pill is the lever: a small `Button` reading "Send Priya" when `sim.canCalm(g)`, naming `sim.calmerFor(g)` (expose it on `Sim` as `calmerFor(g): Staff | undefined`, beside `canCalm` and `calmerOf`), which calls `sim.calm(g.id)` and plays `error` on failure as the inspector's button does. While someone is on the way or there, the pill's second control is replaced by the `calmingNote` from `src/ui/lib/calming.ts`. With nobody free it reads "Nobody free to go", with the inspector button's explanation as its title.
- The inspector's `CalmRunner` stays, using the same `calmerFor` name in its label ("Send Priya to calm them down"). The advisor's line stays as the fallback after the pill.
- CSS: follow `.mishap-pill` / `.outbreak-pill` in the stylesheet (grep for `offer-pill`); the pill has two children, so give the button row the `btnrow` treatment the offers use at small size.
- Tests: in `tests/e2e/game.spec.ts`, the bad-trip test clicks the pill's "Send …" button instead of opening the inspector first, then checks the inspector still shows the calming note when the runner is selected. A unit test in `tests/unit/standing-ui.test.ts`-style for any pure helper you add to `src/ui/lib/calming.ts` (the pill's text and the days-to-the-door wording).

### A.3 Who goes, in order

- `runaways.ts`: `calmerFor` ranks, then takes the first: (1) a Shaman (`st.role === 'shaman'`); (2) any practitioner or Instructor who is `idle`, `wander`, `toPost` or `toJob` on a job that is not `soul`, `ward` or `calm`; (3) a Caretaker; (4) a Receptionist, and never one whose post is a `reception_desk` with anyone in its `queue`. Within a rank, by distance as now. Put the order in a small table in the file's head comment. `free` keeps its other rules.
- `rules.ts`: `CALM_SHAMAN = 0.5` ("A Shaman talks a runner down in this share of the time") and `CALM_BEDSIDE = 0.75` ("Bedside Manner takes this much off anyone's time"). In `followRunner`, where `st.timer = CALM_SECONDS / traitSpeed(st.traits)` is set, multiply by the Shaman share and, if the staff member holds the Bedside Manner qualification (find its id in `src/core/data/` and how other code checks `st.quals`), by the Bedside share.
- The inspector button's title and the pill's "Send …" title say who and why: "Priya (Shaman) is nearest and best for it: a Shaman talks them down in half the time."
- Tests: a case that, with a Caretaker nearer and a Shaman farther, sends the Shaman; one that never sends a Receptionist with a line; one that times a Shaman's calm against a Caretaker's.
- Guide: who is sent, and that a Shaman and Bedside Manner are quicker.

### A.4 Seen and heard

- **A bubble the whole time.** In `startRunning`, `say(g, 'bubble-stressed', RUNAWAY_SECONDS)` and drop the re-say in `runStep` (keep the sweaty bubble on each guest freaked out). In `calmedDown` and `foundDoor`, the new bubble replaces it (`bubble-relieved` 4 seconds, already there in `calmedDown`).
- **A yelp.** `src/audio/audio.ts`: add `yelp` to `SfxName` and `SFX` as two falling sawtooth notes (start from `[[520, 0, 0.1, 0.14, 'sawtooth'], [380, 0.08, 0.16, 0.12, 'sawtooth']]` and tune by ear in the lab or the game); `startRunning` emits `{ type: 'sfx', name: 'yelp' }` instead of `error`. `calmedDown` keeps `heal`.
- **The announcer.** `startRunning` emits `{ type: 'announce', text: … }` once per runner, with one of two lines picked by `g.id % 2`: "Would the guest running through the lobby please note that the ceiling is not, in fact, melting." and "A reminder that the walls are load-bearing and cannot be reasoned with." Add both to [dev/announcements.md](../dev/announcements.md) under a new "A really bad trip (`src/core/sim/runaways.ts`)" heading as ⬜ not recorded, and bump its counts. An unrecorded line still shows on the banner; `VOICE_LINES` in `src/audio/voice.ts` is left alone.
- **Heads turn.** In `poseChar` (`src/render/pose.ts`), beside the stressed glance: for any guest or staff member who is not `lie` or `served`, if a runner is within `FREAK_RANGE + 1` tiles, yaw the head toward them (`headZ` is the side-to-side axis the stressed glance uses; compute the yaw from `Math.atan2` of the offset against `c.facing`, clamp to about ±0.6). The pose function is given a `Char` and not the sim, so pass the runners in through the `WoW`/style argument or a small per-frame list the people layer builds (`src/render/people.ts` already walks every guest each frame: collect those in state `running` once, then hand the list to `poseChar`). Keep it cheap: a runner is rare, so the list is almost always empty and the check is one length test.
- Tests: a unit case that the bubble lasts the run; the lab specimen's `bubbleT` already does this, so the picture should not change. A new `tests/unit` case in `audio`'s tests if there are any for `SFX` names; otherwise none for the sound.

### A.5 Only in the same room or corridor

- `freakOut`: skip `o` when `ctx.world.zoneAt(o.tx, o.ty) !== ctx.world.zoneAt(g.tx, g.ty)` and when `o.state === 'served'` or `'called'`. The zone of a room is its id and the corridor is `Z_CORRIDOR`; see `src/core/world.ts`.
- Tests: a guest on a table one tile across the wall is not freaked; one in the same corridor is.

### A.6 A tip the first time

- `startRunning`: `tipOnce(ctx, 'runaway', 'One bad trip in ten runs. They freak out everyone they pass, and if they find the door the center's name suffers. Send someone from the pill at the top: a Shaman is quickest.', 'info', { kind: 'guest', id: g.id })` after the toast.
- Test: the tip comes once across two runners.

### A.7 The bot sends someone, and it is measured

- `tests/balance/bot.ts`: beside `calmCarriers`, a `calmRunners()` that, for each guest in state `running` with `sim.canCalm(g)`, calls `sim.calm(g.id)`; call it from the same place as `calmCarriers` but unconditionally (every persona would click a pill). Count in the month log what the bot already counts for outbreaks: runners started, calmed, calmed within `RUNAWAY_SAVE_DAYS`, and found the door; read the report's month-log format before adding columns, and add only what the report prints.
- Measure: `BOT_STYLE=good`, seeds 1 to 6, four years, at The Orchard Estate and the sandbox (the only places ceremonies run), before this piece and after, through `yarn balance` and `yarn balance:report after.json before.json` as [balance/harness.md](../balance/harness.md) describes. Write balance-log entry 43 in the log's format (read entries 40 to 42 first): the runner rate against `RUNAWAY_CHANCE` (about one in ten failed ceremonies), how many were calmed and within how many days, how many found the door, and the Orchard's stars and year-4 profit against entry 42. Done when the rate is as the constant says, the bot calms most runners within three days, and the Orchard's stars come within a month of entry 42. If the door cost moves the Orchard's reputation cliffs up, say so and leave the number; the owner tunes.

## B. The flood seen and felt

**What it does well.** The rule is right: three puddles on the open floor (`floodTiles`, `floodRestroom` in `src/core/sim/mishaps.ts`), the lamp red (`lampStates` in `src/render/room-lamp.ts`), every toilet and sink out of action (`World.usable` reads `flooded`), the Caretaker ahead of ordinary litter (urgency 2 in `findWork`), nothing drawn from the stream unless it floods, and `$800` or a ward keeps it dry. The advisor asks for a Caretaker when there is none, and the inspectors say "Flooded".

**What falls short.**

1. **Mopping looks like picking up a wrapper.** A Caretaker on a flood puddle uses the litter chore's stance; nothing in `pose.ts` or the models knows it is water.
2. **The water does not move.** `buildPuddle` in `src/render/models/puddle.ts` lays four flat blue discs.
3. **Nobody says anything.** A guest who needed the toilet and found the restroom under water gets no feeling; one who walks through the water is not slowed or bothered: `inPuddle` in `src/core/sim/novelties.ts` reads only `l.puddle`, and `noticeSurroundings` in `guests.ts` skips flood water on purpose for the litter feeling.

### B.1 A mop

- A mop prop: a thin handle (`cyl`) and a grey head (`soft` or a squashed `capsule`), built in `src/render/models/` (a `mop.ts` beside `puddle.ts`, using `parts.ts` helpers and the `owned` material pattern), attached to the Caretaker's rig the way the Shaman's feathers or the smudge stick are (find how a staff member's held prop is shown: grep `wafting` in `pose.ts` and the rig in `src/render/models/character*.ts`).
- Pose: in `poseChar`, a Caretaker in `doingJob` whose job is `litter` and whose litter has `flood` set pushes the mop to and fro (both arms forward, a slow `Math.sin(t * 2.6)` sweep across, a slight lean). The pose function is handed a `Char`; the people layer knows the sim, so it resolves "is this litter a flood puddle" once per frame per Caretaker on a litter job and passes a flag, as A.4 passes the runners.
- Lab: a specimen "Caretaker mopping" under Moods or the staff group, and a picture in `tests/visual/models.spec.ts`.

### B.2 Water that moves

- `buildPuddle(id, flood)`: for flood water, share one `MeshStandardMaterial` per puddle with a small `emissive` tint, and in `LitterLayer.update` (or an `animate(t)` it gains, called from where the layer is ticked) wobble that material's `emissiveIntensity` (0.05 to 0.15) and scale the pools' radii by 2 to 3 percent on `Math.sin(t * 1.3 + id)`. No new draw calls: the pools stay as they are, only their material and scale move. Check `tests/unit/model-cost.test.ts` still passes.
- The puddle specimen's picture is re-taken only if it changes at `t = 0`; keep the still frame the same if you can.

### B.3 Felt by the guests

- `novelties.ts`: `inPuddle` counts `l.flood` as well as `l.puddle`, so flood water slows (`PUDDLE_SLOW`) and gives `puddle` with the sweaty bubble as kombucha does. Give flood water a feeling of its own instead of `puddle`: `wet-feet` (bad, `experience`): "Waded through a flooded restroom", lines "The restroom was a rock pool. I did not ask for a rock pool." and "I went in for a wee and came out with a tide table."
- A guest who goes looking for a toilet and finds none usable: find where a `toilet` need fails to claim an access spot (`findAccess` returns nothing, in `guests.ts` around the `need` handling) and, if any restroom is flooded, give `wet-feet`'s cousin `no-restroom` (bad, `experience`): "Found the restroom under water", lines "I held it. For two days. I am a changed person." Only when a flood is the reason; a center with no restroom at all keeps whatever it does now.
- The flood toast adds: "…and the guests will mind."
- Tests in `storm-flood.test.ts`: a guest walking through flood water is slowed and feels it; a guest needing the toilet with the only restroom flooded gets the feeling.

## C. The Generator seen working

**What it does well.** The placing rule for the grounds is thorough (`onGrounds`, `canPlaceOutdoors` in `src/core/build-rules.ts`), the mishap notice names it and says when it is worn (`announceMishap`), and it wears by the day as well as by the cut (`wearByTheDay` in `upkeep.ts`). `tests/unit/outdoor-items.test.ts` covers all of it.

**What falls short.**

1. **It looks the same on and off.** The housing's lamp is lit whenever it is unbroken, and its smoke cue (`generator: 'smoke'` in `WEAR_LOOKS`) is the wear puff every machine has. During a power cut nothing on the lawn says it is carrying the building.
2. **Diesel is free.** It costs `$2,800` once and a day on it costs only wear. Every machine has `upkeep`; the Generator is the one exception.

### C.1 Chugging while it carries the center

- `src/render/items.ts`: `effects` passes `running: this.running(it)`, which today is only the heater share. Extend `running` to return 1 for the item that is `mishapHolder(s)` while the mishap has `started` and is not `prepared` (import from `src/core/sim/mishaps.ts` as `lighting.ts` does), else 0 for anything that is not a heater.
- `src/render/item-cues.ts`: a new cue for a running generator: puffs from the exhaust stack (the stack's position is in `buildGenerator`; mark the stack part in `partsOf(g)` as `exhaust` so the cue finds it) on a short loop while `c.running > 0`, the lamp part at full brightness while running and dim (`emissiveIntensity` a third) while standing by, and a small `rotation.z` shudder on the housing at about 8 Hz, 0.01 radians. Keep the wear puffs as they are for wear.
- Sound: `src/audio/audio.ts`: a low rumble (a looped sawtooth at about 55 Hz under a lowpass, gain 0.04, started and stopped like the lounge loop) that plays while any generator is running and the camera is within about 12 tiles of it; the people/items layer or the app's audio hook knows camera distance (find how the gong's or the machines' sounds are placed, if any; if nothing is positional, play it unplaced at low gain and say so in the commit).
- Lab: the generator's specimen gains a "running" control if specimens take controls (several do: see `controls` in `catalog.ts`); a picture of it running.

### C.2 A day on diesel costs

- `src/core/data/items.ts`: `dailyCost: 150` on the generator ("What a day carrying the center through a cut costs in diesel"), and `dailyCost?: number` on `ItemDef` in `types.ts` with the same comment.
- `upkeep.ts`: in `wearByTheDay`, where the holder is given its full `wear` for a day on, `spend(ctx, dailyCost, 'upkeep')` and a float at the item (`emit float`, kind `bad`, text `money(-150)`) so the cost is seen on the lawn. It goes under the same `upkeep` ledger line as the machines; rename that line in `MoneyMenu.tsx` from "Machine upkeep" to "Machines and the Generator" only when a generator exists, else leave it.
- `payrollOutlook` and the payday warnings read `machineUpkeep(s)` for the month ahead; leave them, since a cut is two days and the sum is small, but say so in the commit.
- The item's card (`desc`) and the guide's item 26 say "and costs $150 a day it runs".
- Tests in `outdoor-items.test.ts`: a day carrying the center spends 150 under `upkeep`; a day standing by spends nothing.

## D. Small gags

Each one commit, one test, no measurement.

### D.1 The rattle is felt by people

- `pose.ts`: anyone in a room the Gong rattles (the people layer can read `sim.rattledRooms()` once a frame, as `items.ts` does, and pass a flag) dips the head on each strike: `headX += 0.12 * max(0, rattle(t, c.id)) / 0.025` using `rattle()` exported from `item-cues.ts`, so it is in step with the furniture. Not for anyone `lie` on a table in that room beyond a flinch of a third.
- The room's sign plaque shakes with the furniture: find where plaques are built (`models/sign-plaque.ts`) and whether `animateCues` reaches them; if it does not, skip and say so.
- Test: `machine-neighbors.test.ts` already checks which rooms rattle; add nothing in the sim. A visual picture is enough.

### D.2 A ride worth reviewing

- A feeling `rebirth-ride` (good, `experience`, icon the carousel's `item-fortune-teller` or a feeling icon that fits): "Had a ride on the Carousel of Rebirth", lines "I rode the carousel. I was briefly a goat. Ten out of ten." and "Went round three times as a seagull. Would go round again." In `guests.ts` where `played` is given after a `play` need, give `rebirth-ride` instead when the item used is `wheel_of_rebirth`.
- Test: a ride ends in that feeling, not `played`.

### D.3 The day you overtake ZenMart

- `src/core/sim/rival.ts`: in `updatePoints`, two `tipOnce`s: `'rival-ceiling'` the first time the course becomes `ceiling` ("ZenMart has stopped growing: it cannot stand more than a quarter above you. Grow, and it grows; delight a VIP, and it slips."), and `'rival-passed'` the first time `standingPoints(ctx).total` exceeds `s.rival.points` after the rival has opened ("Your standing has passed ZenMart's. Center of the Year is yours to lose."), kind `good`, with the `ui-rival` icon via a `toast` if `tipOnce` cannot take an icon (it cannot today: add an optional `icon` to `tipOnce`, since it only forwards to `toast`).
- Test in `standing.test.ts`: each fires once.

### D.4 The runner on the overlays

- `src/render/halos.ts`: `HalosLayer.update` rings only when an overlay has set a `value`. Add a standing `extra` ring: with `value` null, still ring any guest in state `running` in the bad color (`conditionColor(0, …)`), scaled up a fifth, so a runner is findable from any view. With an overlay on, the runner keeps its red ring over the overlay's value.
- Test: none in the sim; the visual interface picture is enough if one covers an overlay, else skip the picture.

## Not worth doing

Looked at and left alone: floor paid for at build (the hint shows the price as you drag, and the refund rule is said in the inspector), more land (the plots open at the stars and the For Sale boards say what each is for), standing earned by working (the tab says exactly where the points come from and what staffing an idle room adds), the first paydays on the cards, and the small icons. Each already says what it does where the player looks.
