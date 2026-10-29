# Make It Right

Drafted 27 October 2026, after Max's notes on [the mechanics review](mechanics-review.md): "I like the make it right mechanic."

An idea, not a plan: nothing here is decided. It is fourth in [the ranked list](README.md).

A guest who storms out of a line, or waits so long they go home worse off, today costs the center 3 or 6 points of reputation, and that is the end of them. With this idea they leave a complaint at Reception: a slip on the desk and a card with **Make it right**. Pressed, the guest comes back within two days, in a gold robe the center sent round with the voucher, goes to the front of their line and is treated free. Healed, half of what they cost comes back, and their review says why. Let down a second time, they are gone for good. The verb is choosing whom to win back, and when: a free guest at the front of a line is a gift in a quiet week and a storm-out waiting to happen in a busy one. It is the one rule of the [MS Serenity](ms-serenity.md) without the ship, at every center.

## The gap it fills

- **After the cliff, nothing.** The fairness grammar warns twice and gives counterplay before a loss: an amber then a red hourglass over a guest running out of patience, and two warnings before anyone goes home worse off (`warnWorsening` in `src/core/sim/worsening.ts`). Once they have gone, the loss is final. Max's rule for a hard moment is to keep the pressure and remove the cliff ([challenging but fair](../../research/fair-challenge.md)). This keeps every warning and every loss, and adds a way back after it that costs play, not money.
- **The people are interchangeable** (gap 4 in the [README](README.md)). The guest you let down has a name, a card and a second visit, and the player sees them walk back in.
- **A long, flat squeeze mid-center** (gap 9). A bad week leaves cards behind, and the week after decides which to answer. It is an active way out that spends table time, not a loan.
- **Offers have one right answer** (gap 3). This one does not: whether to answer depends on what the guest cost and how long the line is today.

## How it plays

**The moment.** Day 41 at The Exchange, a rush hour. Ada Twinge has waited nine days for Deep Tissue, and she walks out, arms folded. A pink slip goes on the spike at the Reception Desk, and a card joins the raise requests: "Ada Twinge stormed out of the Deep Tissue line after 9 days. Make it right: she comes back free, first in line." The rush lasts two more days. The player leaves the card, adds a bench, and on day 44, with the line down to two, presses **Make it right**. On day 45 Ada walks in from the street in a gold robe, and goes straight to the front of the Deep Tissue line. Healed, she floats "Made right", and her review reads: "They sent a gold robe to my house, which is how I knew they meant it."

**The verb.** **Make it right** on the card, or on the slip in the Reception Desk's inspector, which lists every complaint still open. Or the card's ✕, or nothing: a complaint not answered in 5 days lapses, and its slip goes in the desk's bin. There is no other button.

**The thing on the floor.** Pink slips on a spike at the Reception Desk, one for each open complaint, readable from the default zoom as a count: a fat spike is a bad week. The guest coming back is dressed head to foot in the center's gold, so everyone in the line can see who went first.

**Who to answer.** A guest who went home worse off cost 6, so half back is 3, more than a usual heal earns (about 2, from the heal branch in `src/core/sim/stations.ts`). Answer those. A storm-out cost 3, so half back is 1.5, less than a heal of someone new: answer it in a quiet spell, when the table would otherwise stand idle, and let it go in a rush.

| Answer        | Best when                                                                                                      |
| ------------- | -------------------------------------------------------------------------------------------------------------- |
| Make it right | the guest went home worse off; or a storm-out, and the line they left has slack today                          |
| Let it go     | a storm-out in a busy week, when a free guest at the front pushes a paying one toward the door; or a weak room |

## The jokes

Three PA lines to record, all name-free, for [announcements.md](../../dev/announcements.md):

- A complaint is filed, at most once a day: "Complaints may be left at reception. Please release them on the way out."
- A comped guest arrives, by turn: "Guests returning for a complimentary treatment are asked not to mention it."
- A comped guest arrives, by turn: "Guests in the gold robe go first. Please do not ask them why."

**Reviews,** a new good feeling, `made-right`, about the staff:

- "They sent a gold robe to my house, which is how I knew they meant it."
- "Second visit was free and first in line, which I would have liked the first time."
- "I gave them one star and they gave me a robe."

**The Local Rag's headline,** if it is built: {GUEST} STORMS OUT, IS ASKED BACK, LEAVES LOOSER.

## Rules and numbers

Every number is a first guess, to be set against the bot. A day is 6 seconds.

**The one rule: a guest let down by the wait can be asked back.**

- **What raises a complaint.** A visit that ends stormed out (`stormOut` in `src/core/sim/guests.ts`, −3) or worse off (`worseOff` in `src/core/sim/worsening.ts`, −`WORSE_REP`, 6). Both are the center's wait failing someone. Nothing else does: a guest sent home (−`SEND_HOME_REP`, 1) was the player's choice and is cheap already; a failed treatment is a cure that did not take, not a wait, and would make complaints routine; a guest put off by the price chose to go. Emergency guests and an occasion's guests raise none, since their own result already counts them, nor class-goers, nor a runner who found the door.
- **What it records.** The guest's id, name and look, their condition and how sure their diagnosis was, how it ended, the day, and the reputation it really took: read before and after `changeRep`, so the damping toward the ends of the scale is already in it.
- **The card** waits 5 days (30 seconds at normal speed), in the requests strip with the raise requests, and lapses after. Any number can be open at once.
- **The return.** Pressed, the guest is due the next day, and comes in on top of the usual arrivals: not in a new guest's place, as a regular due back is, since the cost is meant to be the table's time. If the center is at its limit of guests at once, they come the first moment it is not. They come back with the same ailment, at condition 70 whatever they left with, a little worse for the wait at home, and with full patience. If their diagnosis was already sure enough for the policy, they go straight to their treatment's line, as an emergency guest does; if not, through Reception and a consultation first.
- **The front of the line.** They join each line at its front and stay there (`placed`), and the player can move them as any guest. Under Emergencies First, an emergency guest still goes ahead of them (`nextInLine` in `src/core/sim/stations.ts`).
- **Free.** No fee for the consultation or the treatment, so no tip either, and they never balk at a price. What they buy at the Shop Counter or the vending machines they pay for.
- **Healed: made right.** Half the reputation the complaint took comes back, in place of a heal's usual gain. It is added straight, not through `changeRep`, so it is never more than half, at any reputation and under any sandbox setting. The heal counts as a heal everywhere else: the month's tally, goals, the casebook, the discipline's following. Their review gains `made-right`.
- **Let down again.** If the comped visit fails, or they storm out or go worse off again, that ending costs what it always costs, and they raise no second complaint. One comp a guest, ever.
- **Regulars.** An open complaint holds a regular's place among the twelve (`REGULARS_MAX`) and holds their due day, even if that visit took their loyalty to 0, so they come back as themselves. The comped visit then moves their loyalty by its stars, as any visit does (`afterVisit` in `src/core/sim/regulars.ts`). A complaint left to lapse, or a second failure, and the regulars' own rule applies as today.
- **The Orchard Estate** waives a fee half as much again (`picky.fee` 1.5), and its guests still expect its finer rooms: a comp there is dearer and easier to fail.

**How often.** A center that loses a few guests a month to the wait gets a few cards a month. A disastrous week gets many, and the player answers the dearest.

## Fair play

**Warned.** Nothing new to warn of: every loss it follows is warned twice already, and the card says what pressing it does, what it costs and what it can give back, before it is pressed. Its tooltip: "Free, first in line. Healed: +1.5 reputation back. Let down again: the usual loss, and no second chance."

**Counterplay.** It is counterplay. Answer the dear ones, answer when the line has slack, put the guest in a room that will work, or let it go.

**Not easier.** Every storm-out and worse-off costs what it costs today, and the best a comp can do is win back half, for a free session at the front of a line. A comp that fails costs the full price again. The good bot gets an extra, `comp` (off unless `BOT_ON` names it, as `machines` is, in `tests/balance/bot.ts`), which answers every complaint whose line has three or fewer waiting. Over seeds 1 to 6 at every center, `BOT_ON=comp` must earn each star within half a month of the bot without it, and its lowest month's reputation must be no more than 3 points higher. If it beats that, half becomes a third.

**Incentives point the right way.** Ignoring a complaint costs nothing beyond the loss already taken, so nothing pays for ignoring it. Answering it never gives back more than half. Treating the guest well the first time is always worth more than winning them back: a heal earns about 2, a storm-out and a comp come to −1.5 at best.

## Where it plugs in

**First slice, each checked in the code:**

- `src/core/sim/guests.ts`: `stormOut` and `src/core/sim/worsening.ts`: `worseOff` raise the complaint after their `changeRep`. `sendHome` in `src/core/sim/queues.ts` does not.
- `src/core/sim/guests.ts`: beside `admitGuests`, a comp due and room under `intakeLimit` brings the guest in. `spawnGuest` already brings back a known person through its `regular` argument (name and look, then `welcomeBack`); a comp passes its complaint the same way, with the condition, the diagnosis and condition 70. `decide` puts them at the front of the line it picks rather than the back.
- `src/core/sim/stations.ts`: the heal branch skips `guestFee` and the heal's `changeRep` for a comp, and adds the half back; `mindsPrice` in `src/core/sim/regulars.ts` returns 0 for them.
- `src/core/sim/records.ts` (`countVisit`), `src/core/sim/feelings.ts` (`writeReview`) and `src/core/data/feelings.ts`: the `made-right` feeling. `src/core/sim/regulars.ts`: `afterVisit` keeps a regular with an open complaint.
- `src/core/sim/events.ts`: `StaffRequest` is `'raise' | 'promotion'` today; the complaint card is a third request, about a guest. `src/ui/components/Toasts.tsx`: the requests strip and its `requestCard`.
- `src/ui/components/inspector/`: the Reception Desk's inspector lists the open complaints, each with Make it right.
- `src/render/models/character.ts`: the gold robe, as `VISITOR_CLOTHES` dresses a VIP or the inspector, top and bottom; the spike and slips on the desk's model.
- `src/core/sim/lessons.ts`: the stormed lesson gains a line, "A guest you let down can be asked back, free. Healed, half the reputation comes back."
- `src/app/play-events.ts` and [analytics.md](../../dev/analytics.md): one event, `complaint_closed`, with `end` (`stormed` or `worse`), `answer` (`comp` or `lapsed`) and `result` (`healed`, `failed`, `left`), to see whether players answer and which.

**New state:** `s.complaints`, each `{ id, name, look, condition, diagnosis, end, day, cost, comped? }`, and `Guest.comp`. The save version goes up from 40 (`SAVE_VERSION` in `src/core/state/game.ts`) to the next free number, and `upgradeSave` gives an old game none. No sandbox switch, since it adds no pressure. Three PA lines to record, the robe, the slips.

## Phases

**First slice (S to M), ships alone.** The rule, the card, the return in the robe, the front of the line, half back, the regulars' hold, the slips, the review feeling, the lesson line, the event and the `comp` rerun.

**Later, if it lands.** Each is one more rule, written up only once the first slice has been played:

- **The Serenity's table.** Aboard [the MS Serenity](ms-serenity.md) a complaint keeps its card for the whole voyage, a guest sent home counts too since nobody leaves the ship, and what a comp wins back is the table's mood as well as the half. The ship builds on this rule rather than writing its own.
- **Make it right for a failed treatment,** at a center whose twist is picky guests, if storm-outs and worse-offs prove too few to matter.
- **The Manifestation Board,** if it is built: the slips pinned on its corkboard rather than the desk's spike, beside the complaints it already turns into wishes.
- **In print,** once [The Local Rag](the-local-rag.md) exists: a made-right guest as a news kind, base 30, and its headline above.

## Decisions to make

Each has the default this doc assumes.

1. **What raises a complaint.** Storm-outs and worse-offs only (default). Send-homes are the player's choice; failed treatments would bury the strip in cards.
2. **What healed gives back.** Half the reputation it took, in place of a heal's usual gain (default). The other way is a heal's usual gain on top, which brings a storm-out out ahead of where it started.
3. **In addition, or in a new guest's place.** In addition (default), so the cost is the table's time. In a new guest's place, as a regular due back comes, the cost is a paying arrival, and a storm-out would never be worth answering.
4. **How long the card waits.** 5 days (default): long enough to let a rush pass, short enough that a bad month cannot be saved up and answered at leisure.
5. **What they come back in.** The gold robe (default), a whole-body color that reads at the default zoom; a gold voucher in hand would not.

## Risks

- **It becomes a reflex.** If every card is answered by habit, it is a tax, not a choice. The half back, the line it jumps and the full loss on a second failure are the guard; `complaint_closed` and the bot will show whether the storm-out cards are left as often as the worse-off ones are answered.
- **It softens the squeeze.** It is meant to be an active way out of a bad patch, not a gift. The `comp` rerun's target holds it, and a third is the next step down.
- **The slips are not seen.** A spike on a desk is small. If playtesters miss it, the card in the requests strip carries it alone, and that is enough.
- **A comp in a weak room fails again.** That is the risk the card prints, and it teaches where the weak room is.
- **Tone.** The joke is on the center's grand gestures, a robe sent round to someone's house, never on the guest's complaint, which was fair.
