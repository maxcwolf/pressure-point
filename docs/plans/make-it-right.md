# Make It Right

A plan, 3 November 2026, for building [Make It Right](../planning/fun/make-it-right.md): a guest the center let down leaves a complaint, and the player can ask them back, free and first in line, to win back half of what they cost. The design doc has the reasoning, the jokes and the risks; this has the decisions, the rules as they will be built, and where each piece goes, checked against the code at `f5e3a257` (after 0.36.0).

Steps 1 to 3 are built: the rule (`src/core/sim/complaints.ts`), the card at the side and the Reception Desk's Complaints (`src/ui/components/Complaints.tsx`), the gold robe (`ROBE` and `detailRobe`) and the spike of slips on the desk's model. Each complaint also keeps how many days its guest had waited, for the card to say. Step 4 is built too: the `made-right` feeling, with a gold robe for its icon, which a guest made right writes about above anything else that pleased them; the Rag's `made-right` story, one a quarter, which keeps how the complaint's visit ended on the guest as `Guest.compEnd`; the lesson line, at the end of the stormed lesson's words, since its four pictures are the most a card has; and the three PA lines, in the game and listed in [announcements.md](../dev/announcements.md) but not recorded yet. Step 5 is still to do.

The robe's gold is a deep amber, `0xda8f00`, with a faint glow of its own: the Shaman's poncho and the Caretaker's bib are golds already, and no gold clears them by the 15 the guests' clothes keep, so the robe stays more than 8 from every uniform, 15 from every guest's clothes, and is told apart by its shape, to the knee with a cream sash. The lab shows it on any guest with **Asked back**. The slips show only complaints still waiting for an answer, so pressing Make it right takes one off the spike.

## Words

In the interface: a **complaint**, **Make it right**, and a guest **asked back**. Never "voucher", "refund" or "comp", which sound like money. In code the record is a `Complaint`, and a guest who came back for one has `Guest.comp`.

## Decisions

Settled by Max on 3 November 2026, unless marked as the design doc's default:

1. **Who leaves a complaint:** a guest who storms out (`stormOut`, −`STORM_REP` 3), one who goes home worse off (`worseOff`, −`WORSE_REP` 6), and one who goes home mortified after an accident (`goHomeMortified` in `src/core/sim/accidents.ts`, −`ACCIDENT_REP` 3). Accidents came in 0.36.0, after the design doc, and were added because the center let that guest down as surely as a long wait does. Nobody else: not a guest sent home, a failed treatment, a guest put off by a price, an emergency guest, an occasion's guest, a class-goer, a runner who found the door, or someone who was only waiting at the Shop Counter.
2. **Healed, half comes back:** half the reputation the complaint really cost, in place of a heal's usual gain (`HEAL_REP` 1.8 and its terms), added straight rather than through `changeRep`, so it is never more than half at any reputation or setting.
3. **The card waits 5 days,** then lapses.
4. **The whole first slice at once:** the rule, the card, the gold robe, the front of the line, the half back, the regulars' hold, the slips on the Reception spike, the review feeling, the Rag's headline, the play statistic and the bot rerun.
5. **In addition to the usual arrivals** (the design doc's default), so what a complaint costs is the table's time, not a paying guest.
6. **One chance a guest** (default): a guest asked back who is let down again pays the usual loss, and raises no second complaint.
7. **Emergencies still go first** (default): with Emergencies First on, as it is in new games since 0.36.0, an emergency guest goes ahead of a guest asked back.

## Rules

Every number is a first guess, to be set against the bot. A day is 6 seconds.

**A complaint.** Raised right after the loss's `changeRep`, with what it really took: reputation read before and after, so the damping toward the ends of the scale is in it. It keeps the guest's id, name and look, their condition and diagnosis, the technique they were waiting for if they had one, how it ended (`stormed`, `worse` or `accident`), the day and the cost. Any number can be open.

**The card,** one for every complaint open, beside the raise, promotion and training cards: "Ada Twinge and 2 more left complaints". Each complaint in its list says how it ended and what answering it does, with **Make it right** and ✕:

- "Ada Twinge stormed out of the Deep Tissue line after 9 days."
- "Bo Kettle went home worse off after 14 days waiting for Cupping."
- "Cy Plover went home after an accident in the waiting area."

The tooltip on Make it right: "Free, first in line. Healed: +1.5 reputation back. Let down again: the usual loss, and no second chance." A complaint not answered in `COMPLAINT_DAYS` (5) lapses quietly; ✕ drops it at once.

**Asked back.** Pressed, the guest is due the next day, on top of the usual arrivals. If the center is at its limit of guests at once (`intakeLimit`), they come the first moment it is not; a center that is snowed in (`cutOff`) waits for the road. They come in a gold robe, with the same ailment, at condition `COMP_CONDITION` (70) whatever they left with, full patience, and the diagnosis they had: sure enough for the policy, and they go straight to their treatment's line as an emergency guest does; if not, through Reception and a consultation first.

**First in line.** They join each line they reach at its front, `placed` so it keeps them there, and the player can move them as any guest. An emergency guest still goes ahead of them under Emergencies First (`callOrder` in `src/core/sim/stations.ts`).

**Free.** No consultation fee and no treatment fee, so no tip, and they never balk at a price (`mindsPrice` returns 0). They pay at the Shop Counter and the vending machines as anyone does.

**Made right.** Healed, they float "Made right", `COMP_SHARE` (0.5) of the complaint's cost comes back, and their review gains the `made-right` feeling. The heal counts everywhere else as a heal: the month's tally, goals, the casebook, the discipline's following, a staff member's experience.

**Let down again.** A failed treatment, a storm-out, going worse off or an accident costs what it always costs, and raises no complaint.

**Regulars.** An open complaint holds a regular's place among the `REGULARS_MAX` (12) and their due day, even if the visit took their loyalty to 0, so they come back as themselves. The visit they are asked back for moves their loyalty by its stars, as any visit does. A complaint that lapses or is dropped lets the regulars' own rule apply as today.

## State

- `GameState.complaints: Complaint[]`, each `{ id, name, look, condition, diagnosis, modality?, end, waited, day, cost, regular?, due? }`: `id` is the guest's, `due` is set once answered. A complaint leaves the list when its guest arrives, when it lapses, or when it is dropped.
- `Guest.comp?: number`, on the guest asked back: what the complaint cost, for the heal to know what to give back.
- `SAVE_VERSION` goes from 48 to 49 (`src/core/state/game.ts`), and `upgradeSave` gives an older game an empty list. No sandbox switch, since it adds no pressure.

## Where it plugs in

**Sim:**

- `src/core/sim/complaints.ts`, new: `fileComplaint`, `answerComplaint`, `dropComplaint`, the daily lapse, and the arrival of anyone due.
- `src/core/sim/guests.ts` (`stormOut`), `src/core/sim/worsening.ts` (`worseOff`) and `src/core/sim/accidents.ts` (`goHomeMortified`): `fileComplaint` after their `changeRep`, unless the guest is ruled out (decision 1) or was already asked back.
- `src/core/sim/arrivals.ts`: `admitGuests` brings in a guest due back before the usual arrivals, outside `spawnT`, when `guestsCounted` is under `intakeLimit`; `spawnGuest` takes the complaint as it takes a `Regular` today, for the name and look, and sets condition, diagnosis and `comp`.
- `src/core/sim/lines.ts`: `decide` puts a guest with `comp` at the front of the line it picks (`unshift`, `placed`), and goes straight to treatment when the diagnosis is sure enough.
- `src/core/sim/stations.ts`: the consultation fee and the heal branch of `completeService` skip `guestFee`, the tip and the heal's `changeRep` for a `comp` guest, and add `COMP_SHARE` of the cost straight to reputation.
- `src/core/sim/regulars.ts`: `mindsPrice` gives 0 for a `comp` guest; `afterVisit` keeps a regular with an open complaint.
- `src/core/data/feelings.ts` and `src/core/sim/feelings.ts`: the `made-right` feeling, good, about the staff, with the design doc's three review lines.
- `src/core/sim/news.ts`, `src/core/data/headlines.ts` and `NewsKind`: a `made-right` story, base 30, with "{GUEST} STORMS OUT, IS ASKED BACK, LEAVES LOOSER" and a line each for worse off and an accident.
- `src/core/sim/lessons.ts`: the stormed lesson gains "A guest you let down can be asked back, free. Healed, half the reputation comes back."
- `src/core/sim/sim.ts`: `answerComplaint` and `dropComplaint` on `Sim`.

**Interface:**

- `src/ui/components/Toasts.tsx`: a `ComplaintCard` beside `RequestCard`, which takes staff only. Its list shows each complaint with its two buttons; one complaint shows them on the card itself. The strip over an open inspector counts it as a request.
- The Reception Desk's inspector: a **Complaints** section listing every one open, with the same buttons.
- `src/render/models/character.ts`: the gold robe for a `comp` guest, top and bottom, as `VISITOR_CLOTHES` dresses a VIP. `src/render/`: a spike on the Reception Desk with a pink slip for each complaint open, up to five.
- Three PA lines from the design doc, in [announcements.md](../dev/announcements.md), recorded with `yarn announcer`.

**Play statistics:** one event in `src/app/play-events.ts` and [analytics.md](../dev/analytics.md), `complaint_closed`, with `end` (`stormed`, `worse`, `accident`), `answer` (`asked-back`, `dropped`, `lapsed`) and, for one asked back, `result` (`healed`, `failed`, `stormed`, `worse`, `accident`).

## Balance bot

An extra, `comp`, off unless `BOT_ON` names it (`BOT_EXTRAS` in `tests/balance/bot.ts`): the bot answers every complaint whose line has three or fewer waiting, and every worse-off one whatever the line. Over seeds 1 to 6 at every center, `BOT_ON=comp` against the good bot without it must:

- earn each star within half a month of it;
- keep its lowest month's reputation no more than 3 points higher.

If it beats that, `COMP_SHARE` goes from a half to a third, and the rerun is done again. The log records complaints filed, answered, healed and lapsed, by end. The result goes in [balance/log.md](../balance/log.md).

## Tests

**Unit** (`tests/unit/complaints.test.ts`):

- a storm-out, a worse-off and an accident each file a complaint with what reputation really took; a send-home, a failure, a price balk, an emergency guest, a class-goer and a shop-only guest file none;
- the card lapses after 5 days, and ✕ drops it;
- answered, the guest arrives the next day on top of the usual arrivals, waits for room under the limit and for a cleared road, at condition 70 with full patience;
- they go to the front of the line and stay there, behind an emergency under Emergencies First;
- healed, no fee and exactly half back at reputations near both ends; failed again, the usual loss and no second complaint;
- a regular with an open complaint keeps their place at loyalty 0;
- an old save loads with no complaints.

**End to end** (`tests/e2e/game.spec.ts`): a storm-out leaves a card; Make it right from it, and from the Reception Desk's inspector; the guest walks back in, first in line.

## Order of work

1. **The rule:** state, `complaints.ts`, the three ways to file one, the return, the front of the line, free, half back, regulars, the save upgrade and the unit tests.
2. **The card and the desk:** `ComplaintCard`, the Reception Desk's Complaints, and the end-to-end test.
3. **On the floor:** the gold robe and the spike of slips, checked in the model lab at the default zoom.
4. **The words:** the `made-right` feeling, the Rag's story, the lesson line and the three PA lines.
5. **Measured:** the play statistic, the `comp` extra and the rerun, then [the guide](../guide.md) and the changelog.

Steps 3 and 4 touch different files from each other and from step 2, and can run side by side once step 1 is in.
