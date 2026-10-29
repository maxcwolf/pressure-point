# Staff Room Politics

Drafted 27 October 2026. Revised the same day against [review.md](review.md): one sim rule first, pressure on the floor, a short list for later.

An idea, not a plan: nothing here is decided.

Staff who work near each other start to have opinions about each other. Put two contented people a few tiles apart for a season and they become friends. A photo of them goes up on the Staff Room noticeboard, and each is a little happier while the other is nearby. Put two unhappy people side by side and they get on each other's nerves. A note goes up on the board first. Ten days or more later, if nothing changes, they start a feud: now and then both leave their posts, meet in the corridor between their rooms and argue for half a day, loud enough for every waiting guest to hear. The verb is placement. Who works next to whom becomes a choice, and so does keeping a settled team rather than swapping its weakest member for a slightly better applicant. All of it rests on one new rule, which ships alone: neighbors' rapport moves a little every day, up if both are content and down if either is not. Romance, a staff union, an Away Day and a pizza party wait in a short list for later, if the first rule lands.

## The gap it fills

- **The people are interchangeable** (gap 4 in the [README](README.md)). The good bot swapped staff 404 times in 30 games ([balance log](../../balance/log.md), entry 47). It found that letting someone go costs only the wages since payday (`payOff` in `fire`, `src/core/sim/staffing.ts`): "Nobody else's morale moves."
- **No one depends on anyone else.** `moraleTarget` (staffing.ts, line 228) reads pay, energy, the room, warmth, thirst and hunger, a Pool Table, posters, litter, a pending promotion and the bank. The only colleague it reads is a Ray of Sunshine within 5 tiles (`cheeredUp`, `CHEER_RANGE` 5 and `CHEER_MORALE` 6 in `src/core/sim/careers.ts`). A Grump only sours guests (`src/core/sim/stations.ts`, line 442).
- **Unhappiness has nowhere to show on the floor.** An unhappy member of staff today is a red bar, a raise card, and later a quit warning. Nothing in the building changes until they leave.
- **The Staff Room is a battery.** It holds Squishy Couches, an Espresso Machine, a Staff Fridge, a Pool Table and posters, and every one of them is a number.

## How it plays

**The thing on the floor.** Every Staff Room gets a noticeboard on its back wall. It is drawn with the room, as its floor and trim are, and is not an item to buy or place. It holds two kinds of paper:

- **a photo** for each pair of friends, pinned with a gold star;
- **a note** for each pair who are getting on each other's nerves, with a red pin once it is a feud.

The board is readable from the default zoom as a count: lots of photos is a happy building, and red pins are trouble. Clicking the Staff Room lists the board in its inspector under **Noticeboard**, newest first, each name a link.

**A settled team.** No toast says when two people become friends. The player who opens Ingrid's inspector sees a line under her quirk: "Gets on with: Mo, Priya." Ingrid and Mo work in neighboring Massage Suites, and when they pass in the corridor they wave. A good applicant turns up for Mo's job. The Let Go dialog adds a line: "Ingrid and Priya get on with Mo." The swap may still be right. But Mo's photo comes down with him, the new hire starts with nobody, and the player can see that.

**Trouble on the floor.** Fergus is a Grump and underpaid, and he is posted next to Ingrid. A note goes up on the board, and a toast says once: "Notes are going up in the Staff Room about Ingrid and Fergus." Both inspectors read "Can't stand: Fergus" in amber. The player has at least 10 days and the levers they already know:

- **make Fergus content:** a raise, rest, a warmer room, whatever his morale bar's reasons say;
- **move one of them** with **Assign to rooms**, so they are no longer neighbors;
- **put the Grump with another Grump**, or next to a Ray of Sunshine, who cannot be got down;
- **let one go**, which takes their notes down with them.

**A feud.** If nothing changes, the line turns red, the pin turns red, and a toast names the levers. From then on, every so often, when both are at their posts with nobody in hand, they get up, meet in the corridor between their rooms and argue. For half a day both stations stand empty, and the noise reaches the waiting guests. The PA asks for calm. The feud cools on its own once they are apart or both content again.

## The jokes

Three lines a feature. PA lines are instructions and carry no names. Notes and toasts can name people.

**Friends:**

- The photo, as the inspector's Noticeboard lists it: "Ingrid and Mo in matching cucumber eye masks, Year 2."
- Inspector, two Grumps who get on: "Gets on with: Mo. Neither of them likes the wind chimes."
- Let Go dialog: "Ingrid and Priya get on with Mo. His photo will come down."

**Tension,** on the board:

- "Whoever keeps cleansing my mug with sage: it was already clean. —I."
- "The salt lamp is a shared salt lamp, Fergus."
- In a feud, pinned through the middle of Ingrid's note: "Your aura is on my half of the couch. —F."

**The argument:**

- PA: "Disagreements between staff are to be held in a calm, centered voice."
- PA: "Staff may resolve their differences in the Staff Room, between eleven and eleven-oh-five."
- Toast: "Ingrid and Fergus are arguing outside the Reiki Studio, in front of the whole line."

## Rules and numbers

Every number is a first guess, to be set against the bot. A day is 6 seconds.

**The one rule: rapport between neighbors.** Every pair of staff has a rapport from −100 to 100, starting at 0. It is kept only for pairs that have moved off 0. Once a game day, in the day roll of `Sim.tick` (`src/core/sim/sim.ts`, line 232), each pair whose posts are within 5 tiles of each other (the Ray of Sunshine's reach) changes:

- **both content** (morale 45 or more): +0.5 a day. Friends are made in about 80 days, a season.
- **either unhappy** (morale under 45): −1 a day. Unhappiness spreads faster than friendship.
- **not neighbors:** a negative rapport eases back toward 0 by 0.5 a day. A positive one stays where it is, so friends who are moved apart are still friends.

Posts are where staff work (`Staff.post`). Staff with no post, such as Caretakers, count by the rooms they are assigned to, or not at all if they work anywhere. Why neighbors and not shared breaks: a busy member of staff tires from full to the default `BREAK_AT` 18 in about a month (at most 0.42 energy a second, times a treatment's `strain`), and rests for about a day at `BREAK_REST` 9. `tryBreak` takes the nearest free `rest` seat anywhere (`findAccess` in `src/core/sim/claims.ts`), and a couch seats two. Any two staff share a break about once a year. That is too rare to build on.

**Two quirks join in.** These are rules about the same rapport, not new rules.

- **A Grump** counts as unhappy beside anyone but another Grump. Beside another Grump, the pair counts as content.
- **A Ray of Sunshine's** rapport never falls below 0, with anyone.

**What each band does.**

| Band    | From                                      | Until     | On the floor                                                                                    | Effect                                                                                       |
| ------- | ----------------------------------------- | --------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Friends | rapport 40                                | below 20  | a photo on the board; a wave (`bubble-happy`) when they pass within 2 tiles, at most once a day | +4 to `moraleTarget` while posted within 5 tiles of a friend; one bonus however many friends |
| Tense   | rapport −20                               | above −10 | a note on the board; an amber inspector line; a toast once per pair                             | none                                                                                         |
| Feud    | rapport −40, after at least 10 days tense | above −20 | the note's pin turns red; a red inspector line; a toast naming the levers; arguments            | none beyond the arguments                                                                    |

**The argument.** Once a game day, for each pair in a feud, if both are at their posts and neither has anyone in hand (`inHand` in staffing.ts): 1 chance in 3, and at most once every 10 days for the pair. Both go idle, walk to the walkable corridor tile nearest the midpoint of their posts, and stand there facing each other for half a day (3 seconds), with `bubble-angry`. Each makes noise 5, a Pool Table's, through `updateNoise` (`src/core/sim/noise.ts`), which today counts items and guests but no staff. Their stations stand empty, and the guests in their lines wait. Rapport falls 5 more. Neither loses morale. The PA plays one of its two lines, at most once a day.

**What churn costs.** Nothing new. Someone who leaves takes their photos and notes with them. Their friends lose the bonus until they make a new friend. Nobody is punished for letting someone go. They lose what a settled team had.

## Fair play

**Warned ahead.** A feud needs at least 10 days as tense first. In that time there is a note on the board, an amber line in both inspectors and a toast. A feud's toast names the levers before the first argument can happen, and arguments come at most every 10 days.

**Counterplay.** Every lever already exists: pay and conditions (whatever `moraleTarget` reads), **Assign to rooms** (`assignRoom` in `src/core/sim/assignments.ts`), placing a Grump with a Grump or a Ray of Sunshine, or letting someone go. The rule adds no new button.

**No surprise quits.** A feud changes nobody's morale. Its cost is on the floor: two stations empty for half a day, and noise. So it can never start the quit clock (`MISERABLE_MORALE` 25) or let ZenMart poach someone (`POACH_MORALE` 35).

**Not easier.** Friends add morale, and feuds take stations away. The bot rerun, with today's `swap` flag on, must show the good bot's mean staff morale, its quits and its star months within the noise of today's. If friends make it easier, the base of 62 in `moraleTarget` comes down by the difference, so a settled team earns back what a churned one gives up.

**Incentives point the right way.** Nothing pays the player for ignoring a feud. Keeping a team together is rewarded by what it gains, never by a penalty on letting someone go.

## Where it plugs in

**First slice, each checked in the code:**

- `src/core/sim/sim.ts`: the daily block in `Sim.tick` (line 232), beside `wearByTheDay`, for rapport and the argument roll.
- `src/core/sim/staffing.ts`: `moraleTarget` for the friends' +4; `staffIdle` and `goTo` to send the pair to argue; `fire` takes their bonds off the board.
- `src/core/sim/careers.ts`: `habitOf` for the Grump and Ray of Sunshine rules, and the `cheeredUp` distance check as the model for "within 5 tiles".
- `src/core/sim/noise.ts`: `updateNoise` gains arguing staff as a source.
- `src/core/sim/events.ts`: `toast` and the `announce` event.
- `src/ui/components/inspector/StaffInfo.tsx`: the "Gets on with / Can't stand" line after the quirks (`traitOf(t).desc`).
- `src/ui/components/inspector/RoomInfo.tsx`: a Noticeboard section for a Staff Room, as the Qi Gong Studio has its `Timetable`.
- `src/ui/components/dialogs/ConfirmFire.tsx`: who gets on with them.
- The renderer: the board, photos and pins on the Staff Room's back wall (`staffroom` in `src/core/data/rooms.ts`), read from the sim.

**New state:** `s.bonds`, a list of `{ a, b, rapport, tenseFrom, lastArgument }` for pairs off 0. The save version goes up from 40 (`SAVE_VERSION` in `src/core/state/game.ts`) to the next free number, and `upgradeSave` starts every old game with no bonds. No sandbox switch, no bot flag, no new HUD. There are 2 PA lines to add to [announcements.md](../../dev/announcements.md) and record.

## Phases

**First slice (S to M), ships alone.** The rule, the three bands, the two quirks, the noticeboard, the inspector line, the Let Go line, the argument, and the bot rerun. Nothing else in this doc is needed to play it.

**Later, if it lands.** Each item below is one more rule, written up only once the first slice has been played:

- **Sit Them Down.** A button on a tense or feud line in the inspector. Both sit in the Staff Room for half a day. The odds are stated: tense goes back to 0 four times in five; a feud goes back to tense half the time.
- **Staff Rooms in Assign to rooms,** so breaks go where the player says. Worth it only if breaks become a source of rapport.
- **The Away Day,** booked from the Staff Room's inspector with a week's notice. The meditation teacher, one of the five VIPs in `src/core/data/visits.ts`, runs it. Everyone who goes is out for the day, and each tense pair rolls stated odds to make up or fall out. PA: "Staff on the Away Day should return all paintball equipment before treating guests."
- **Romance.** Friends at 70 may become a couple: happier anywhere, slower in the same room. A breakup comes with five days' warning and leaves two exes who count as tense for 60 days. A wedding gives a day off for both. PA: "Guests are asked not to throw rice in the Sound Bath Studio."
- **The Staff Room Collective.** Three or more underpaid friends post a note ("MEETING THURSDAY. COOKIES PROVIDED. NOT BY MANAGEMENT."), then a demand card beside the raise cards: the going rate for all of them within 10 days. Meet it, and for a year none of them asks for a raise and ZenMart cannot hire them away. Refuse it, and after three days' notice comes a warned work-to-rule. PA, once it is met: "Management recognizes the Staff Room Collective, effective immediately, and always has."
- **The Wellness Initiative,** a pizza party in lieu of a raise. Cheap morale for a week, nothing for anyone waiting on a raise, and less than nothing for a Grump. PA: "The Wellness Initiative is in the Staff Room. One slice per member of staff."
- **In print,** once [The Local Rag](the-local-rag.md) exists: a feud, a wedding and a union win as headlines, such as "STAFF COLLECTIVE WINS GOING RATE; MANAGEMENT 'ALWAYS SUPPORTED IT'".

## Decisions to make

Each has the default this doc assumes.

1. **Where rapport comes from.** Neighbors' posts (default). Shared breaks are the classic, but they are rare here (about once a year a pair), unless breaks get shorter and more frequent, which is its own balance change.
2. **Whether a feud costs morale.** No (default): its cost is the argument, on the floor. A morale cost would be a hidden multiplier and could start the quit clock.
3. **The friends' bonus.** +4 to the morale target while near a friend (default), close to a Ray of Sunshine's 6. The other way is no bonus, only the photo: friendship then carries no reason to keep people.
4. **The noticeboard.** Drawn on every Staff Room's back wall (default), or a free item the player places. Drawing it costs no build step and puts it in every existing save.
5. **The threshold for unhappy.** Morale under 45 (default). The raise request comes under 56, so a pair can go tense before anyone asks for a raise, as an early warning.

## Risks

- **The wrong verb.** Placement already has strong reasons behind it: rooms, lines, Staff Room distance. If friendships never change where a player posts anyone, the rule only decorates. Watch for players opening **Assign to rooms** after a tense toast.
- **It reads as a penalty.** Feuds are the visible half. Photos, the wave and the Let Go line have to make the good half felt. If playtesters only notice the notes, the bonus should show more: a heart on the morale bar's tooltip, or friends sitting together on breaks.
- **Too much paper.** A center with 30 staff has 435 pairs, but only neighbors can bond. The board shows at most 8 photos and every note, so it stays readable.
- **Softer by stealth.** The friends' bonus is a gain. The rerun sets the base down if needed.
- **The board at the default zoom.** It has to read as a count from the game's camera. Check it in the model lab before writing more notes.
