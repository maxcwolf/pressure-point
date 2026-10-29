# ZenMart Express

Drafted 27 October 2026, after Max's notes on [the mechanics review](mechanics-review.md): "The zenmart copy idea is good too."

An idea, not a plan: nothing here is decided. It is sixth in [the ranked list](README.md).

Once a season ZenMart looks at what your center does most and opens a cheap, quick copy of it across the street. Two weeks ahead a COMING SOON board goes up on its forecourt and a note arrives: ZenMart Express Acupuncture, a quarter under standard, ten minutes a session, opening on the 12th for 20 days. While it runs, a guest just diagnosed for acupuncture who hears your price may walk out of your front door, cross the street and go in at ZenMart's. How many go turns on what you charge for that technique and how fine your best Acupuncture Clinic is. The player answers with a price for the season, a finer room, or, over a longer game, a second discipline strong enough that the first is not all the center does. It is the first thing in the game that plays against what the player does, and the first reason to set one discipline's prices apart from the rest. All of it rests on one new rule, which ships alone: while a run is on, the price check a guest already makes has a second roll, aimed at one discipline.

## The gap it fills

- **The rival is a scoreboard, not an opponent** (gap 6 in the [README](README.md)). Removing ZenMart made the game neither easier nor more interesting ([balance audit](../../audits/balance-audit.md), finding 5). Nothing it does reads the center: its points grow a fixed 0.6 a day toward a quarter above the center's standing (`RIVAL_GROWTH`, `RIVAL_CEILING` in `src/core/data/standing.ts`), and a sale cuts the whole arrival pace by the average price across every technique (`saleDraw`, `rivalDraw` and `averagePrice`, through `arrivalParts` in `src/core/sim/twists.ts`). It never looks at what the center does well, so the player never plays against it.
- **Prices are a lever nobody touches** (gap 8). Prices were changed in 4 of 28 sessions, and the Prices tab was opened by 2 of 8 players. At 1.3 to 1.4 almost no guest is put off, which is worth about a fifth of income ([balance log](../../balance/log.md), entries 46 and 48). Each technique has a price of its own (`setTechniquePrice` in `src/core/sim/economy.ts`), but nothing in the game gives one a reason to differ from the rest. Max sets a busy discipline to 1.2 and a new one to 0.8 by habit; the game never asks.
- **Nothing punishes leaning on one discipline.** A center can grow its first discipline for ever, and its others only for capacity.
- **A sale's draw is invisible, and less aimed than it says.** Its guests never enter the building: the sale slows the arrival pace (`arrivalParts`). Since a regular due back takes a new guest's place in that pace (`admitGuests` in `src/core/sim/guests.ts`), a sale today also slows the regulars, though its toast says it draws "guests who think you charge too much". ZenMart Express draws at the moment a guest hears the price, so regulars and emergencies are spared exactly as the price check spares them, and the guests it takes are seen leaving.

## How it plays

**The thing on the floor.** ZenMart's storefront across the street already puts out a banner in a sale (`StorefrontLayer`, `src/render/storefront.ts`). For a run it gets a second sign over the door, naming the copy, and for the two weeks before, a sandwich board reading COMING SOON. While the run is on, a guest it takes comes out of your front door, crosses the street and goes in at ZenMart's, with "Express is cheaper" floating over them. A busy run is a little procession across the road.

**The notice.** Fourteen days ahead, a toast with ZenMart's icon names the discipline, the day and the length, and the Standing tab gains a line under the sale's: "ZenMart Express Acupuncture from day 212 for 20 days. At today's prices and your finest Acupuncture Clinic (3 stars), about 1 new acupuncture guest in 7 would go." The line updates as the player changes the price or the room, so it is the forecast and the readout of every answer at once. ZenMart's warnings, a quick win in the README, come first: this builds on the line they put on the Standing tab.

**The verb: answer the copy.** Each answer is best in a state the player can read:

| Answer                      | What it costs                                                         | Best when                                                                                                                     |
| --------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Let them go**             | the fees of the guests who cross, and their heals                     | the discipline's line is long, more than two waiting for each practitioner: the guests lost would have waited, or stormed out |
| **Match their price**       | that discipline's fees at 0.75 of standard for 20 days, regulars' too | its line is short and a heal goal is open: every guest counts, and one lost is a heal lost                                    |
| **Polish the room**         | decor and floor for the finest room, once                             | the room is a star from the next, and money is no worry: it lasts past the run, and its pull draws guests anyway              |
| **Grow another discipline** | a room, a hire and courses, over seasons                              | the copy takes a share of the biggest discipline, so the less one discipline is the whole center, the less it can take        |

**Match their price** is a button on the notice toast and on the Standing tab's line. It sets each of the discipline's techniques to ZenMart Express's price for the run, and when the run ends a toast offers to put the old prices back. It is the Prices tab with the reason written on it. A player can still set any price by hand, and the Standing tab's line says what that price would lose.

**A season at The Exchange.** The center has leaned on acupuncture since the first star: two clinics, prices at 1.3. On day 198 the board goes up across the plaza and the note comes: ZenMart Express Acupuncture from day 212. The Standing tab says about 1 acupuncture guest in 4 would go at today's prices. The acupuncture line is short this month and a heal-10-with-acupuncture goal is open, so the player presses Match. The forecast falls to none. On day 232 the run ends and the player puts the old prices back. Next season ZenMart picks acupuncture again; this time both clinics have a line of five, so the player leaves the price alone and watches a few guests a week walk across. The season after, massage has grown to match acupuncture, and ZenMart Express Massage takes half as much from a center that is no longer one thing.

**At Willow Lane**, which offers massage alone for good, ZenMart Express Massage comes from the second star. Diversifying is not an answer there, so the answers are the price and the Massage Suite's prestige: the gentlest place to learn that a price is a decision.

## The jokes

**The sign over ZenMart's door,** one for each discipline it can copy. Things to draw:

| Discipline    | The sign                                    |
| ------------- | ------------------------------------------- |
| Massage       | ZENMART EXPRESS MASSAGE. 10 MINUTES. SEATED |
| Acupuncture   | ZENMART EXPRESS ACUPUNCTURE. FIVE NEEDLES   |
| Reiki         | ZENMART EXPRESS REIKI. DRIVE-THRU WINDOW    |
| Sound healing | ZENMART EXPRESS SOUND BATH. ONE GONG        |
| Shaman        | ZENMART EXPRESS VISION QUEST. BACK BY LUNCH |

**PA lines,** three to record, instructions and policy only:

- At the notice: "Guests are reminded that our treatments take as long as they take."
- During a run: "Guests leaving for the shop across the street must return their robe first."
- At the end: "Express treatments across the street have ended. Please resume waiting at the usual speed."

**ZenMart's notes,** in Kyle's voice from [Kyle from ZenMart](kyle-from-zenmart.md), signed by Kyle if he is built and by ZenMart if not:

- At the notice: "A note from Kyle: We loved your acupuncture so much we made it shorter. Opening on the 12th."
- At the end: "A note from Kyle: ZenMart Express Acupuncture has completed its journey. Thank you for holding space."

**The Local Rag's headline,** if it is built: "ZENMART OPENS EXPRESS {DISCIPLINE}; {CENTER} TAKES ITS TIME."

## Rules and numbers

Every number is a first guess, to be set against the bot.

**The one rule: a second roll at the price.** Today a new guest hears their treatment's price once they are diagnosed, and may be put off (`goForTreatment` in `src/core/sim/stations.ts`: `mindsPrice` times `putOffChance`). While a run is on, a guest for the copied discipline who is not put off rolls once more:

- **Chance** = `mindsPrice` × `EXPRESS_DRAW` × clamp((price − 0.75) / 0.5, 0, 1) × (1 − 0.15 × (prestige − 1)).
- **Price** is the one the guest hears, `priceFor` their technique, so each technique's own price counts. At 0.75 or under nobody goes; at standard, 0.2; at 1.25 or more, the full `EXPRESS_DRAW` of 0.4. Unlike a sale's draw, which stops growing at standard, this one keeps rising to 1.25, so high prices finally cost something while a run is on.
- **Prestige** is the level, 1 to 5, of the discipline's finest room (`bestRoom` in `src/core/sim/demand.ts`, `prestige` in `src/core/sim/ambience.ts`). Each star past the first takes 15% off, so a 5-star room keeps 40% of the draw.
- **Who is spared.** `mindsPrice` already gives emergencies and loyal and devoted regulars 0, and plain regulars half (`REGULAR_PUT_OFF`). A signature machine's own ailments never go: ZenMart has no Kneadmaster.
- **A guest who goes** leaves by the front door, as a guest put off by prices does, and walks to ZenMart's door rather than off along the pavement. The visit ends `'lured'`: no fee for the treatment, no reputation, no review, no change to the discipline's following (`followVisit` counts only heals, failures and those who gave up), and no place in the waits a goal counts. The Standing tab counts them: "Lost to ZenMart Express this run: 6".
- The roll comes from the game's random stream only while a run is on, so a game without one plays out as today.

| Constant           | First guess                                                                |
| ------------------ | -------------------------------------------------------------------------- |
| `EXPRESS_NOTICE`   | 14 days                                                                    |
| `EXPRESS_DAYS`     | 20 days                                                                    |
| `EXPRESS_GAP_DAYS` | 70 to 110 days from one run's end to the next's start, about once a season |
| `EXPRESS_PRICE`    | 0.75 of standard, the sale's own discount (`SALE_DISCOUNT`, 25%)           |
| `EXPRESS_DRAW`     | 0.4 at 1.25 of standard or dearer                                          |
| `EXPRESS_PRESTIGE` | 0.15 off for each star of the finest room past the first                   |

**When.** The first run is noticed 30 days after ZenMart's first sale ends, and never before the center's first star (its second at Willow Lane). A run and a sale never overlap: a sale due during a run, or its notice, waits until 5 days after the run ends. ZenMart Express opens only while the rival is open and switched on (`rivalOpen`).

**What it copies.** The discipline that healed the most guests over the last three finished months (`healedBy` on the month records in `s.months`), counted on the day of the notice. With fewer than three months, the months there are. Ties go to the discipline with the larger share of new guests on the Guests tab (`demand`). It can copy the same discipline twice in a row.

**How much it takes, roughly.** A mid-center whose biggest discipline brings 60 of its 100 guests a month, so about 40 in a 20-day run, at 1.3 with a 3-star room: if about 85% of them mind the price, 40 × 0.85 × 0.4 × 0.7 is about 10 guests lost, each a treatment fee and a heal. Matched, none go, and the discipline charges 0.75 of standard for 20 days, which from 1.3 is over two fifths off. Left alone with a long line, most of those 10 would have waited days for a table anyway.

## Fair play

**Warned ahead.** Fourteen days: the note, the COMING SOON board across the street, and the Standing tab's line with its forecast, which moves as the player answers. During the run: the sign, the guests crossing, and the count. A first-time tip names the three answers.

**Counterplay.** Every answer exists today: prices (with Match as a shortcut), the room's prestige, and the disciplines the center offers. The forecast counts all three.

**Not easier.** It is pressure on top of today's sales, never in place of one. The bot gets `BOT_EXPRESS`, read from the environment as `BOT_STYLE` is (`tests/balance/bot.ts`): `ignore`, `match` (Match on every notice), and `choose` (Match while the copied discipline's line is under two a practitioner, otherwise let them go). The target, over seeds 1 to 6 at every center: with `choose`, the good bot's star months and profit from the second year within the noise of main, never better; with `ignore`, measurably worse, so the run bites; and `choose` beating both fixed answers on profit at four centers of five, so no one answer is always right.

**Incentives point the right way.** Nothing pays the player for ignoring a run, and nothing pays them for beating one but the guests kept. Matching costs fees. No karma, and no change to ZenMart's standing points either way.

## Where it plugs in

Each checked in the code:

- `src/core/data/standing.ts`: the `EXPRESS_*` constants beside `SALE_GAP_DAYS`, `SALE_DAYS`, `SALE_DISCOUNT` and `SALE_DRAW`.
- `src/core/state/types.ts`: `Rival` gains `express` (the discipline, its first and last day, and the guests it has taken) and `nextExpress`, beside `saleUntil` and `nextSale`.
- `src/core/sim/rival.ts`: `updateExpress` beside `updateSale`, called from `updateRival`; `expressDraw` beside `saleDraw`; `updateSale` holds a sale due in a run. Toasts carry the `ui-rival` icon, as the sale's do.
- `src/core/sim/stations.ts`: `goForTreatment`, where `mindsPrice`, `priceFor` and `putOffChance` already make the first roll.
- `src/core/sim/records.ts`: `VisitEnd` gains `'lured'`; `countVisit` skips the review for it. `stats`, `tally` and the casebook entry gain the count.
- `src/core/sim/demand.ts` (`bestRoom`), `src/core/sim/ambience.ts` (`prestige`), and `healedBy` on the month records (`Tally` in types.ts) for the pick.
- `src/core/sim/economy.ts`: `setTechniquePrice` for Match their price, and `priceFor`.
- `src/core/sim/guests.ts`: `leave` for the walk out. The walk across the street is the renderer's, to the door at `storefrontSpot` in `src/render/storefront.ts`.
- `src/render/storefront.ts` and `src/render/models/storefront.ts` (`buildStorefront`): the sign and the COMING SOON board, shown as the sale banner is, from the rival's state.
- `src/ui/components/menus/StandingTab.tsx`: the line, beside the sale's "No sale on." with its forecast, the count and the Match button.
- **State:** the save version goes up from 40 (`SAVE_VERSION` in `src/core/state/game.ts`) to the next free number; `upgradeSave` gives `express: null` and sets `nextExpress` from the day.
- **Analytics:** `month_ended` gains `lured`; one event, `express_started` (discipline, the player's price for it at the notice and at the start), to see whether players move a price. See [analytics.md](../../dev/analytics.md).
- **Recordings:** the three PA lines, into [announcements.md](../../dev/announcements.md).

## Phases

**First slice (S to M), ships alone.** The run and its notice, the second roll, `'lured'`, the walk across, the sign and the board, the Standing tab's line with Match, the toasts, the three PA lines, `BOT_EXPRESS` and the rerun. It proves itself if players change a technique's price during runs, where today 2 players of 8 ever open the Prices tab.

**Later, if it lands.** Each is one more rule, written up only once the first slice has been played:

- **Guests who come back.** Some who crossed return a week later as new guests, a little worse: "ZenMart Express did my needles in nine minutes, and I felt every one." It must never pay the player for being undercut, so they come back no more than they left.
- **A review for staying.** A guest healed in the copied discipline during a run may say so: "Stayed for the full forty minutes while my sister went across the street for ten."
- **The spy** from [Kyle from ZenMart](kyle-from-zenmart.md) as how ZenMart chooses: catch him, and the next copy is of something else.
- **Gate 44's kiosk**, ZenMart Xpress, Gate 12, as the airport's copy, sized to its red-eyes.

## Decisions to make

Each has the default this doc assumes.

1. **What it copies.** The discipline with the most heals over the last three months (default), or the biggest share of new guests on the Guests tab on the day of the notice, which the player can read but which a long line can swing.
2. **On top of sales, or in place of some.** On top, never overlapping (default). In place of every other sale keeps the rival's pressure where it is today and only aims it.
3. **Willow Lane.** From the second star, copying massage, answered by price and prestige (default); or off at Willow Lane, so the first run meets acupuncture at The Exchange.
4. **Match their price.** A button that sets the discipline's techniques to 0.75 for the run and offers the old prices back at its end (default); or the Prices tab alone.
5. **The draw above standard.** It keeps rising to 1.25 (default), so a run is when high prices cost; or it stops at standard, as a sale's does.
6. **The sandbox.** Under the existing rival switch, with no switch of its own (default).

## Risks

- **Match is always right, or never.** The numbers are close by design: fees at three quarters of standard against up to two fifths of the guests. If `choose` cannot beat both fixed answers, `EXPRESS_DRAW` moves until it does.
- **It reads as another sale.** The sign names one discipline and the guests are seen crossing, which a sale's never are. If players still read it as a sale, the line on the Standing tab should lead with the discipline.
- **A chore of prices.** Changing prices twice a season by hand would be one. Match and its offer to put the prices back are the guard.
- **The squeeze.** A center short of money cannot afford to match, and loses guests besides. It can let them go: in the squeeze lines are long, and those are the guests it could least have seen. The rerun should check that months to the second star do not slip.
- **Tone.** The joke is on ZenMart's speed and its corners, never on the guests who cross and never on a real risk to health. No line suggests needles or anything else are reused.
