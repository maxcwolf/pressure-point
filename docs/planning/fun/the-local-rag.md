# The Local Rag

Drafted 27 October 2026. An idea, not a plan: nothing here is decided. It is first in [the ranked list](README.md).

Moved up after Max's review on 27 October 2026: "This is a great idea!" It is now the spine the other top ideas print into: the horoscope, the occasions, the staff's news, the guests won back and ZenMart's knock-offs.

Revised the same day against [the review](review.md). The first slice is the review's: one headline on payday, in the message every player already gets. The paper Max liked comes next, once the headline proves itself, cut down to one page.

Each center has a local paper. On payday it prints one headline about the biggest thing that really happened that month, with the real names in it: the Kneadmaster 9000 that caught fire, the guest on a really bad trip who found the door, the travel writer who called the Reiki Studio "just the right temperature". Later the headline grows into the paper: a front-page story, letters from real reviewers, and a masthead and a column for each center. It changes nothing in the sim. It tells the month's story back and gives the other ideas somewhere to print.

**What it adds on screen:** a masthead and a headline at the top of the payday message. **On the floor:** nothing. **The verb:** none; it is read. That is why the first slice is kept small enough to be a quick win.

## The gap it fills

- **The people are interchangeable** (gap 4 in the README). Regulars are a name and a number, and ZenMart has no face. A headline makes the Caretaker who beat out a fire into somebody.
- **The game makes stories, then forgets them.** `s.fire` keeps only the last fire, `s.visitReport` the last visit, `s.mishap` the current one. Runaways leave only a toast. The month's tally (`Tally` in `state/types.ts`) counts heals and waits, never who, where or what.
- **The jokes live in text players rarely read** (gap 5). The review is right that a two-page paper fights that gap with more text. One headline, in a message every player already gets, is the cheapest test of whether players read any of it.

## The first slice: one headline on payday (S)

**Where it goes.** The review puts the headline in the payday dialog's header. That dialog (`PayrollDialog.tsx`) opens only when the bank cannot cover the wages, and only with bankruptcy on; its header is "Payday, and the bank is short". Most paydays have no dialog. Every payday does have a message: `payWages` in `sim/economy.ts` posts "Payday: $4,210 in salaries." with the payday sound. The headline goes on top of that message. On a short payday both of the dialog's answers pay through `payWages`, so the message, headline and all, comes once the dialog is answered, never on top of the bank's bad news.

**What the player sees**, Willow Lane, month 7:

> **THE WILLOW LANE LEAFLET** · Issue 7
>
> **FIRE BRIGADE ARRIVES, FINDS FIRE OUT, LEAVES SLIGHTLY DISAPPOINTED**
>
> Also: Ada Twinge waits 11 days, can now describe the ceiling in detail.
>
> Payday: $4,210 in salaries.

The masthead is the center's paper's name and the issue, the month's number in this center. The headline is the month's lead, in capitals. "Also" is the next-biggest item's headline in sentence case, so it needs no templates of its own. The message uses the existing `ui-news` icon. It stays as long as any message of its length (`messageLife` in `ui/lib/messages.ts` counts its letters), or until dismissed with the setting at Until dismissed. Clicking it goes to the member of staff or the room the headline names, if they are still there, as other messages do through their `about`.

**Across a center.** Month 1: "WILLOW LANE OPENS; RANG PRAISED, AS REQUIRED." By month 6 the headlines have a cast: the Caretaker with the towel, the Senior lost to ZenMart, and Amanda Jablonsky, who makes the paper the month she is hired. When a star comes, it leads.

**The one new rule: the news log picks the lead.** One saved list, `s.news`, for the month in progress. Each item is `{ kind, day, who?, by?, room?, item?, n?, how? }`: `who` and `by` are names (a guest, a member of staff, a visitor), `room` a `RoomType`, `item` an `ItemType`, `n` a count or sum, `how` how it ended. At most 16 items. When it is full, a new item replaces the lowest-scoring one, so a busy month keeps its biggest moments. The longest wait is one item, overwritten whenever a guest who leaves beats it. The headline is printed when the wages are paid, and the log is cleared when `closeMonth` in `sim/records.ts` files the month. The year-end awards are held at the start of the new month (`holdAwards` in `sim/awards.ts`), so they lead January's headline.

Each item scores its kind's base plus its extras. The highest leads; the next is "Also". If nothing scores 20 or more, the quiet-month headline prints. Each kind's two or three templates take turns by issue number, so nothing else is saved. All numbers are first guesses.

| Kind                        | Base | Extras                                              |
| --------------------------- | ---- | --------------------------------------------------- |
| Bribe found out             | 70   |                                                     |
| Fire                        | 60   | +5 for each thing burnt; +10 if the brigade charged |
| Awards (Center of the Year) | 60   | 40 for any other award won                          |
| Runaway found the door      | 55   | 35 if calmed                                        |
| Star earned                 | 50   |                                                     |
| VIP                         | 50   | delighted 50, disappointed 45, satisfied 20         |
| Inspection failed           | 50   | passed with nothing found 25                        |
| Grade of standing           | 45   |                                                     |
| Amanda Jablonsky hired      | 45   |                                                     |
| Staff poached by ZenMart    | 40   | quit 30; made Expert 25                             |
| Overtook ZenMart            | 40   |                                                     |
| Emergency, outbreak         | 35   | +5 if it failed or escaped                          |
| Machine overload            | 35   |                                                     |
| Mishap                      | 30   | +15 if not prepared for; warded off by a Shaman 30  |
| ZenMart sale                | 25   |                                                     |
| Long wait                   | 10   | +3 a day past 6; never leads under 8 days           |

**A bribe nobody found out about** is not a headline. It can be the "Also": "The health inspector called on Day 12. This paper has no further questions."

**Money trouble never prints.** The bank's own messages already say it, beside this one.

**What the slice needs, and nothing more:**

- **State.** `s.news` on `GameState`. The save version goes up from 40 to the next free number, since sibling ideas may take one first; `upgradeSave` in `state/upgrade.ts` gives an old save `[]`.
- **Data and sim.** `data/headlines.ts` holds the six paper names and the headline bank. `sim/news.ts` holds `logNews` and `leadOf`, pure functions with unit tests; every template is filled from a sample log of its kind, so no placeholder is left empty.
- **Interface.** The `toast` event in `sim/events.ts` gains an optional `headline` (masthead, lead, also), which `Toasts.tsx` draws above the message's words.
- **Analytics.** `month_ended` ([analytics.md](../../dev/analytics.md)) gains `headline`, the lead's kind or `quiet`, to see how often a month has nothing to say.
- **Nothing else.** No dialog, card, setting, sound, icon or PA line. No bot rerun, since nothing in the sim changes.

**It proves itself** if, within two weeks of play, Max or a playtester quotes or screenshots a headline without being asked, and no headline is caught with a wrong fact.

## The paper (M), once the headline proves itself

**What it adds on screen:** **Read the paper** on the payday message, opening one page as a dialog that pauses the game, as every dialog does (`HudState.open` in `ui/hud.ts`). The latest issue is also kept under a **Paper** tab in the Stats menu (`TABS` in `StatsMenu.tsx`), so a message that fades loses nothing. The paper never opens on its own.

**One page**, short enough to read without scrolling:

- **The front page.** The masthead and motto. The lead headline over a story of two or three sentences, facts only, with the real names, rooms, days and sums. Each kind has one story template. "Also" as in the first slice. Each name is a link: a member of staff, or a regular still on the books, closes the paper and selects them; a room goes to it.
- **Letters to the editor.** Two of this month's reviews, the highest-starred and the lowest, word for word under the reviewers' real names. No review is printed twice.
- **The center's column**, one line, from the masthead table below.
- **One classified.**

> **THE WILLOW LANE LEAFLET** · _Folded by hand since last Tuesday._ · Issue 7
>
> **FIRE BRIGADE ARRIVES, FINDS FIRE OUT, LEAVES SLIGHTLY DISAPPOINTED**
> The Kneadmaster 9000 caught fire on Day 14. Two things burned before Hamish Crickmore, Caretaker, put it out with the extinguisher by the door. The fire brigade arrived half a minute later and did not charge.
>
> **Letters.** "I aged a year in that waiting area." Name and address supplied.
>
> **Florist Watch, day 204.** Still empty. A man looked in the window on Tuesday.
>
> **Classified.** LOST: one aura, red, last seen in the fire exit.

**Letter sign-offs**, by the review's stars. Five: "Yours, Ada Kneadham, much looser." Three: "Ada Kneadham, by email." One: "Name and address supplied." A regular signs with their visit count: "Percy Supple (fourth visit)."

**Classifieds**, one an issue. ZenMart's names a discount only while a sale is really on (`onSale` in `sim/rival.ts`), so the paper never hints at a sale that isn't happening.

- During a ZenMart sale: "ZENMART. Enlightenment, 25% off for 10 days. Terms apply to the soul."
- After ZenMart hires someone away: "WANTED: Massage Therapists. Must have hands. Lanyard provided. ZenMart."
- Otherwise: "LOST: one aura, red, last seen in the fire exit."

**PA lines**, one in three issues, by turn, as the paper lands. Each is a recording, so three:

- "This month's paper is out. Staff named in it may not sign copies."
- "Guests are reminded that the letters page is not a complaints procedure."
- "Copies of the local paper are at reception. One per aura."

**What the paper adds to the plumbing:** `s.paper`, the last issue as printed text with `read`, so a later version that rewords a template never changes an old issue. A `'paper'` `DialogId` and `PaperDialog.tsx` under `components/dialogs`. The Paper tab. The mottos, story templates, columns and classifieds in `data/headlines.ts`. The three PA lines in [announcements.md](../../dev/announcements.md) and, once recorded, `VOICE_LINES` in `src/audio/voice.ts`. One event, `paper_opened` (`issue`, `lead`, `from` as `message` or `stats`).

**Left out of the one-page paper,** any of which can come back once the paper is read: the second page; Inside Sources (one line on the weakest part of the reputation, which is the communication job of the Manifestation Board, not a paper's); corrections; the month in numbers, which the Stats menu already shows; the Avalanche held up by snow; a card of its own in the messages column; a Settings switch; the 12-issue list of used headlines; and the Year in Pictures, a large feature of its own with the risks of local storage and rendering off screen.

## Sibling slots (S each, as the siblings land)

Each is a news kind for the headline and, once the paper exists, a box that is simply missing until its idea is built.

- **The horoscope**, from [Under the Stars](under-the-stars.md): Madame Ostara's monthly horoscope as a column, the same lines it gave on the 1st, so the paper never tells first.
- **The occasions**, from [Grand Occasions](grand-occasions.md): the town's booked date as a notice ahead of it, and its result as the lead the payday after.
- **Staff news**, from [Staff Room Politics](staff-room-politics.md): a wedding notice, and a union win as the lead: "STAFF COLLECTIVE WINS GOING RATE; MANAGEMENT 'ALWAYS SUPPORTED IT'".
- **A guest won back**, from [Make It Right](make-it-right.md): a news kind, base 30. "{GUEST} STORMS OUT, IS ASKED BACK, LEAVES LOOSER."
- **A new room**, from [Couples and Groups](couples-and-groups.md): the first Couples Suite as a news kind, base 25. "COUPLES SUITE OPENS AT {CENTER}; LOCAL MAN TOLD TO BRING SOMEONE."
- **A package finished**, from [Courses of Treatment](courses-of-treatment.md): a news kind, base 15, so it leads only a quiet month. "{LOCAL} FINISHES TWO-PART PACKAGE, IS OFFERED A THIRD."
- **A knock-off across the street**, from [ZenMart Express](zenmart-express.md): its opening as a news kind, base 30. "ZENMART OPENS EXPRESS {DISCIPLINE}; {CENTER} TAKES ITS TIME."

## Mastheads

The first slice prints the paper's name. The paper adds the motto and the column, a single line each month, not an article.

| Center             | Paper                     | Motto                                 | Its column                                                                                                      |
| ------------------ | ------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Willow Lane        | _The Willow Lane Leaflet_ | Folded by hand since last Tuesday.    | **Florist Watch**: "Day 204. Still empty. A man looked in the window on Tuesday." Ends once the plot is bought. |
| The Exchange       | _The Exchange Ledger_     | Per my last edition.                  | **Markets**: "Calm: down 4. ZenMart: up 18 on news of layoffs. Lunch breaks: delisted."                         |
| The Boardwalk      | _The Boardwalk Bugle_     | Read it before the gulls do.          | **Benny Count**, this month's crowd against last: "212, up from 140. Two still had their beach badges on."      |
| High Pines         | _The Pines Avalanche_     | Published when the road is open.      | **The Road**: "Shut 4 days this month. Chains advised."                                                         |
| The Orchard Estate | _The Parish Pump_         | Established shortly before the vicar. | **From the Vicarage**, by turn (below)                                                                          |
| Gate 44            | _The Layover_             | Read it twice. You have time.         | **Departures**: "GUEST SPRINTS TO GATE 44 IN ROBE, MAKES FLIGHT, LEAVES SLIPPER", from [Gate 44](gate-44.md)    |
| The MS Serenity    | _The Serenity Daily_      | Printed daily. Delivered monthly.     | **Table Talk**: "TABLE 12 RECOMMENDS SPA; TABLE 9 DOES NOT.", from [The MS Serenity](ms-serenity.md)            |
| Sandbox            | _The Open Plot_           | Whatever you build, we print.         | **Planning Notices**: "A Consultation Room, 4×4, drawn up on Day 21. Objections to the editor by Friday."       |

**The vicar writes**, one a month, the first two only when their subject really came:

- "Someone at the Estate is being treated for Sour Grapes. I forgive them, eventually."
- "The wasps are back in the vestry. They are welcome at the evening service."
- "I won the croquet again. I mention it only because I was asked not to."

**The really bad trip.** The game shows a runner with their arms waving, clothes on. Headlines follow what the player sees.

## Headline bank

Placeholders, all printed in capitals: `{center}`; `{guest}`, `{staff}` and `{visitor}` (names, the visitor by their title from `VIPS` in `data/visits.ts`, such as A RETIRED SURGEON); `{room}`, `{item}`, `{condition}` and `{mishap}` (names); `{n}`, `{days}`, `{fee}` and `{target}` (numbers); `{grade}` (the standing grade); `{note}` (a room's verdict from `ASPECT_NOTES`, such as "spotless"); `{mess}` (the machine's overload `mess`); `{local}` (LOCAL MAN or LOCAL WOMAN, from `sexOfName`); `{thing}` (the commonest comfort or decor item in the building, or THE CEILING).

| #   | Kind, and when               | Headline                                                           |
| --- | ---------------------------- | ------------------------------------------------------------------ |
| 1   | Fire                         | {ITEM} CATCHES FIRE; {ROOM} "FINE, MOSTLY"                         |
| 2   | Fire, out before the brigade | FIRE BRIGADE ARRIVES, FINDS FIRE OUT, LEAVES SLIGHTLY DISAPPOINTED |
| 3   | Fire, beaten out             | {N} THINGS BURN IN {ROOM}; {STAFF} BEATS OUT LAST ONE WITH A TOWEL |
| 4   | Fire, brigade charged        | FIREFIGHTERS HOSE {ROOM}, CHARGE {FEE}, DECLINE MASSAGE            |
| 5   | Runner found the door        | GUEST ON "REALLY BAD" TRIP FINDS DOOR, KEEPS GOING                 |
| 6   | Runner calmed                | SHAMAN TALKS {GUEST} DOWN; WALLS CONFIRMED NOT MELTING             |
| 7   | VIP delighted                | {VISITOR} CALLS {ROOM} "{NOTE}"; STAFF DENY CLEANING SPECIALLY     |
| 8   | VIP disappointed             | {VISITOR} FINDS {ROOM} "{NOTE}", ASKS FOR A TAXI                   |
| 9   | VIP satisfied                | {VISITOR} VISITS {CENTER}, IS FINE ABOUT IT                        |
| 10  | Inspection, nothing found    | INSPECTOR FINDS NOTHING, CHECKS AGAIN, STILL NOTHING               |
| 11  | Inspection failed            | INSPECTOR FINDS {N} PROBLEMS, NEEDS SECOND CLIPBOARD               |
| 12  | Mushrooms found              | MUSHROOMS FOUND UNDER SHOP COUNTER; INSPECTOR TAKES ONE FOR TESTS  |
| 13  | Bribe, word got out          | INSPECTOR LEAVES {CENTER} EARLY, HEAVIER BY ONE ENVELOPE           |
| 14  | Storm and flood              | STORM FLOODS {CENTER} RESTROOM; GUEST LEAVES WITH TIDE TABLE       |
| 15  | Power cut                    | POWER CUT HITS {CENTER}; GUESTS "BARELY NOTICED, EYES WERE SHUT"   |
| 16  | Big freeze                   | PIPES FREEZE AT {CENTER}; ICICLES "NOT A FEATURE"                  |
| 17  | Wasps                        | WASPS TAKE THE SNACKS; VICAR BLAMES CROQUET CLUB                   |
| 18  | Warded off                   | SHAMAN WARDS OFF {MISHAP}; {MISHAP} UNAVAILABLE FOR COMMENT        |
| 19  | Machine overload             | {ITEM} {MESS} FOR SOME TIME; MANUAL STILL UNTRANSLATED             |
| 20  | ZenMart sale                 | ZENMART CUTS PRICES 25%; {CENTER} DOES NOT BLINK                   |
| 21  | Poached                      | {STAFF} DEFECTS TO ZENMART, IS ISSUED LANYARD                      |
| 22  | Overtook ZenMart             | {CENTER} OVERTAKES ZENMART; ZENMART "SENDING LIGHT"                |
| 23  | Quit                         | {STAFF} QUITS, CITING "EVERYTHING"                                 |
| 24  | Made Expert                  | {STAFF} MADE EXPERT; NAME BADGE REPRINTED                          |
| 25  | Amanda Jablonsky hired       | AMANDA JABLONSKY JOINS {CENTER}; MOHAWK "NOT NEGOTIABLE"           |
| 26  | Long wait                    | {LOCAL} WAITS {DAYS} DAYS, CAN NOW DESCRIBE {THING} IN DETAIL      |
| 27  | Emergency failed             | EMERGENCY: {N} OF {TARGET} HEALED; THE REST "STILL IN THE POSE"    |
| 28  | Outbreak contained           | STRESS OUTBREAK CONTAINED; NOBODY SPEAKING ABOUT THE SEATING PLAN  |
| 29  | Outbreak escaped             | STRESS ESCAPES {CENTER}, LAST SEEN HEADING FOR THE HIGH STREET     |
| 30  | Grade                        | {CENTER} NOW A {GRADE}; SIGN PAINTER BOOKED                        |
| 31  | Star                         | {CENTER} EARNS A STAR, PUTS IT SOMEWHERE SAFE                      |
| 32  | Center of the Year           | {CENTER} IS CENTER OF THE YEAR; ZENMART "DIDN'T WANT IT ANYWAY"    |
| 33  | Quiet month                  | {CENTER} HAS QUIET MONTH; WIND CHIMES QUESTIONED                   |
| 34  | First month                  | {CENTER} OPENS; RANG PRAISED, AS REQUIRED                          |
| 35  | First month, Sandbox         | GRAND OPENING; QUEUE FORMS IN ORDER OF AURA COLOR                  |

A handled emergency prints plainly: "{N} CASES OF {CONDITION} HEALED ON TIME." Kinds with one template print it every time; the busiest kinds (fires, VIPs, mishaps) have the most.

## Fair play

**Warned of.** Nothing to warn of: it adds no pressure. It prints only what already happened and was told at the time by a message, the PA or a report. The sibling slots that look ahead reprint forecasts the player already has, so nothing is told first, or only, in print.

**Counterplay.** None needed: it costs nothing and can be ignored.

**Not easier.** It never changes money, reputation, morale, demand or karma. Reading it earns nothing. It never names a fix: no hire, price or room to build.

**The tone.** The jokes land on the town, ZenMart, the vicar, the machines and the staff's dignity, never on the player's mistakes or anyone's illness. Bad news is printed dry and plain.

## Where it plugs in

Each checked in the code:

| Moment                          | Where it is logged                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Payday message                  | `payWages` in `sim/economy.ts`, from `monthEnd`, `takePayrollLoan` and `payIntoRed`                    |
| Fire, once the last is out      | `putOut` and `updateBlazes` in `sim/blazes.ts`, from `s.fire` (`FireReport`: item, burnt, how, fee)    |
| Runner found the door           | `foundDoor` in `sim/runaways.ts`; calmed, with who did it, in `calmedDown`                             |
| VIP or inspection               | `finishVisit` in `sim/visits.ts`: the `VisitReport`, its best and worst `RoomVerdict`, mushrooms found |
| Bribe, and whether word got out | `settleInspection` in `sim/visits.ts`                                                                  |
| Mishap, ward, flood             | `startMishap`, `endMishap` and `floodRestroom` in `sim/mishaps.ts`                                     |
| Machine overload                | `maybeOverload` in `sim/machines.ts` (its `mess`: "is kneading the empty air")                         |
| ZenMart sale                    | `updateSale` in `sim/rival.ts`                                                                         |
| Quit or poached                 | `fire(ctx, id, 'quit' \| 'poached')` in `sim/staffing.ts`                                              |
| Amanda Jablonsky hired          | `hire` in `sim/staffing.ts`, when the name is `AMANDA.name`                                            |
| Overtook ZenMart                | the `rival-passed` tip in `updatePoints`, `sim/rival.ts`                                               |
| Made Expert                     | `promote` in `sim/careers.ts`, when `expert(st)` turns true                                            |
| Emergency, outbreak             | `endEmergency` in `sim/emergencies.ts`, `endOutbreak` in `sim/outbreaks.ts`                            |
| Grade, star, awards             | `updateStanding` in `sim/standing.ts`, the `star` event in `sim/progress.ts`, `holdAwards`             |
| Longest wait                    | `countVisit` in `sim/records.ts`, from `g.waited` (in seconds; a day is `DAY_SECONDS`, 6)              |
| "Local man" or "local woman"    | `sexOfName` in `core/people.ts`                                                                        |

## Decisions to make

Each has a recommended default.

1. **Where the headline goes.** The payday message, not the payday dialog, which most paydays never open. _Recommended._
2. **Real names in headlines.** Yes, staff and guests alike, cameo names too. Never in a recorded line. _Recommended._
3. **Stored or rebuilt, for the paper.** Store the printed text of the last issue, a few kilobytes. _Recommended._
4. **A PA line every issue.** No: one issue in three, by turn, so three lines last. _Recommended._

## Risks

- **A wrong fact breaks it.** One headline that names the wrong room or a guest who never came, and it reads as random. Every headline is filled only from the log, and the unit tests feed each template a log of its kind.
- **It repeats.** A center runs about 36 months. Templates taking turns by issue, and real names in most of them, should hold; the busiest kinds may want a third template each.
- **Nobody notices it.** A message is easy to miss. That is the point of the first slice: if nobody quotes a headline, the paper waits.
- **The tone turns on the player.** Kept off the player's mistakes and anyone's illness, and money trouble never prints.
