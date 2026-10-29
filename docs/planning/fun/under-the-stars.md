# Under the Stars

Drafted 27 October 2026.

Revised 27 October 2026 after Max's review: the tarot reading is now a monthly horoscope by Madame Ostara, with the same truthful mechanics. Each center has a star sign, and the horoscope's sections stand for the event families. The cap of three cards is gone, so nothing due is left off.

Revised again 27 October 2026 against [review.md](review.md): the horoscope leads, as phase 1 and alone. Mercury's wear, doubt and blame numbers are gone; in a spell, a worn treatment machine runs its session backward, on the floor, with the Caretaker as the answer. The eclipse stays. The full moon, the staff star signs, the sandbox readers, the reversed PA line and most of the plumbing are cut.

An idea, not a plan: nothing here is decided.

On the 1st of each month Madame Ostara's horoscope comes out, headed with the center's star sign, and it tells the truth: its Career, Money, Health and Love name what the game's own event timers have already scheduled, and in which week. It is a communication feature in costume. The forecast is the game's rule for fairness, and a horoscope that is always right is the joke. Behind it, the sky gets two events, each forecast two weeks ahead and each with something to see: Mercury goes into retrograde twice a year and the machines run backward, and now and then an eclipse stops everyone where they stand.

## The gap it fills

- **Events run on a timetable, and nothing tells the player what is coming.** Each kind of event has its own timer in `GameState` (`nextCall`, `nextEmergency`, `nextVip`, `nextOutbreak`, `nextMishap`, `nextInspection`), rolled from a fixed range and scaled by the sandbox's Trouble or Emergencies setting. The ranges, in days, checked in the code:
  - a house call every 25 to 45 (`CALL_GAP_MIN`, `CALL_GAP_MAX` in `core/data/rules.ts`); The Exchange twice as often, every 12.5 to 22.5 (`calls.often: 2`), and The Orchard Estate 1.5 times as often (`calls.often: 1.5`);
  - an emergency 50 to 80 days after the last one ends, or 45 to 75 after one is turned down (`core/sim/emergencies.ts`), from the first star;
  - a VIP every 45 to 90 (`VIP_GAP_DAYS`), from the first star;
  - a stress outbreak every 70 to 110 (`OUTBREAK_GAP_MIN`, `OUTBREAK_GAP_MAX`), from the second star;
  - a mishap every 80 to 140 (`MISHAP_GAP_DAYS`);
  - the inspector every 120 to 180 (`INSPECTION_GAP_DAYS`); every 60 to 90 at The Orchard Estate (`inspections: 2`).
- With staff challenges (every 30 to 60), a settled center sees about 2.5 to 3 events a month. Each center has one kind of mishap, and Willow Lane has none (`chooseMishap` returns nothing without a center `mishap`).
- **The machines' gags are seen once and then left alone.** Six signature machines each play a scripted gag (`render/gags/scripts/`). Mercury gives the player a reason to look at one again.
- **Forewarning is the house rule for fairness.** [research/fair-challenge.md](../../research/fair-challenge.md): the player must see the cause, know the lever and have time to pull it. The Boardwalk already does this: a toast two weeks before each summer and winter (`seasonAhead`, `SEASON_AHEAD_DAYS = 14` in `core/sim/twists.ts`), then the PA as the season starts (`seasonNews`).
- **A recorded filler line sets it up:** "A polite reminder: Mercury is no longer in retrograde, so you have absolutely no excuse for your behavior."

## How it plays

**A typical month.** On the 1st, after payday, a toast brings the horoscope, and the PA says: "This month's horoscope is now available at reception. It is binding." It is headed with the center's sign, and each line names something due this month and the week it is due: under Career, the inspector in week 3; under Love, a regular back in week 1. Each line's tooltip says plainly what it means. The horoscope stays in the date's hover for the rest of the month. The player plans around it: a Caretaker sweep before the inspector, a spare practitioner kept free for the emergency, cash set aside for the mishap. The usual warnings still come on top (the VIP's letter five days ahead, the mishap's notice three days ahead).

**A Mercury spell,** at a center with a signature machine. Thirty days out, the date's hover says when Mercury goes into retrograde. Fourteen days out, a toast says what it does and what to do, and the PA reads the forecast. The player has two weeks to get the machine seen to and a Caretaker assigned to its room. For fifteen days, a machine worn to half runs its session backward: the Kneadmaster's chair spins the wrong way first, the arms un-knead the guest, fold away, and sit them up as hunched as they came in. "Rewound" floats over the machine, the guest pays nothing and goes back to the head of the line. Once a Caretaker has repaired it, it runs forward again. At a center with no machine, Mercury passes unmentioned: it has nothing to act on.

**An eclipse.** At most once a year. Forecast a month out in the hover and two weeks out by toast and PA. For half a day everyone stops where they stand and tilts their head back, the light dims, and the clock stops for them: nobody loses patience or gets worse, and nobody is treated. Then the guests who would have come arrive in a rush.

## The horoscope

**The centers' signs**, fixed in data:

| Center             | Sign      | Why                         |
| ------------------ | --------- | --------------------------- |
| Willow Lane        | Cancer    | Homely                      |
| The Exchange       | Taurus    | The bull market             |
| The Boardwalk      | Leo       | Summer, and showing off     |
| High Pines         | Capricorn | The mountain goat           |
| The Orchard Estate | Libra     | Balance, the autumn harvest |
| Sandbox            | Gemini    | Two of everything           |

**As the player sees it**, at Willow Lane on the 1st of month 10, with a Kneadmaster built:

> **Willow Lane · Cancer · month 10**
>
> **Career:** A stranger with a clipboard will enter your house in week 3.
>
> **Money:** Nothing in your chart. Drink some water.
>
> **Health:** Worry spreads through town in week 4 and walks to your door.
>
> **The sky:** Mercury goes backward from the 10th to the 24th, and so does anything with gears.
>
> **Love:** Someone who has lain on your table before returns in week 1.
>
> **Lucky number:** 108.

Hovering a line shows what it means: "The inspector is due in week 3 (days 15 to 21). Due means it comes once the center is free." "No emergency is due this month. House calls are not forecast." "A stress outbreak will be offered in week 4." "Mercury in retrograde, days 10 to 24: the Kneadmaster 9000, once worn to half, runs its sessions backward until a Caretaker repairs it." "Due back this month, as of the 1st: Margaret Hale. A regular can come twice in a month." "Lucky numbers are for fun."

**The lines**, one for each thing due, in Madame Ostara's voice:

| Section | Means                             | Madame Ostara says                                                                  |
| ------- | --------------------------------- | ----------------------------------------------------------------------------------- |
| Career  | The inspector is due              | "A stranger with a clipboard will enter your house in week 3."                      |
| Career  | A VIP is due                      | "Someone important will lie on your finest table in week 2."                        |
| Money   | An emergency will be offered      | "Many sore people arrive together in week 2, and every one of them pays."           |
| Health  | A stress outbreak will be offered | "Worry spreads through town in week 4 and walks to your door."                      |
| Health  | The center's mishap is due        | "Your building will have a bad day in week 1. Stay close to it."                    |
| Love    | A regular is due back             | "Someone who has lain on your table before returns in week 1."                      |
| The sky | Mercury in retrograde             | "Mercury goes backward from the 10th to the 24th, and so does anything with gears." |
| The sky | An eclipse                        | "On the 19th the sun takes half a day off."                                         |

A section with nothing due says "Nothing in your chart. Drink some water.", and its tooltip says nothing in that family is due. It is only ever shown when that is true.

**The smudged line,** at most once a month: "Someone who judges will come this month. The ink has run on the date." Its tooltip: "The inspector or a VIP is due this month. Which one, and the week, are not shown."

**Lucky number,** closing every horoscope: always above 30, so it never reads as a day ("41", "108", "333").

## Rules and numbers

All numbers are first guesses.

**The Monthly Horoscope.** No new sim rule: it reads what is already set.

- Cast on the 1st, once payday is settled: in `finishMonth`, which `monthEnd` in `core/sim/economy.ts` calls at once, or later when a held payday is paid.
- It reads the timers already set. On the 1st, each of `nextInspection`, `nextEmergency`, `nextOutbreak`, `nextMishap` and `nextVip` falling within the month makes a line, as do regulars' `due` days and any sky event. No timer is rolled early.
- Each line is shown only when the game would act on it: an outbreak needs two stars and the switch on, an emergency the first star and someone who can treat it, Mercury a signature machine.
- The sections are the families: Career for the people who judge you (the inspector, a VIP), Money for an emergency offer, Health for a stress outbreak or the center's mishap, Love for a regular due back, and the sky for Mercury and the eclipse. A section with nothing due shows its quiet line, which is then true.
- It is complete because every timer's gap but a house call's is longer than a month, even at the harshest sandbox settings (the shortest is an emergency turned down with Emergencies set to more often, 45 × 0.75, about 34 days; the inspector after a bribe comes back 30 days later, into the next month's horoscope). So each can come at most once a month, and the next one is set only after this one is over. House calls are left off the horoscope: The Exchange's can come twice in a month. Regulars are the other exception: each comes back 12 to 24 days after a visit (`REGULAR_GAP_DAYS`, halved for the most loyal, `returnGap` in `core/sim/regulars.ts`), so Love names the regulars due as of the 1st and its tooltip says so. It never promises that a regular will not come twice.
- "Due" is truthful, not exact. Something due waits for the center to be free: a snowed-in road, one offer on the table at a time. The tooltip says so.
- Every line due is shown; there is no cap. Priority sets the order the toast and the date's hover list them in: inspector, emergency, outbreak, mishap, VIP, sky, regular. The full horoscope keeps the classic order: Career, Money, Health, the sky, Love. Within a section the priority holds: the inspector before a VIP, an outbreak before the mishap.
- Each line names the week (days 1 to 7, 8 to 14, 15 to 21, 22 to 30), not the day. The VIP's letter and the mishap's notice still give the day. The sky's lines give the day, which the date's hover already shows.
- At most one line a month is smudged: it names the family ("someone who judges": the inspector or a VIP) and not the week. Its tooltip says exactly that. It is never wrong. The sky is never smudged.
- The lucky number forecasts nothing and is always above 30.
- The center's sign is a `sign` on each center in `core/data/centers.ts`. It changes no number.

**Mercury in retrograde.** One new sim rule.

- Days 10 to 24 of months 4 and 10, 15 days twice a year: 90 seconds each at normal speed. Like the snow at High Pines (`snowedIn`, `dice` in `core/sim/twists.ts`), it is a pure function of the calendar day (`calendarDay`): nothing drawn from the game's random stream, nothing saved.
- It reaches the six signature machines, the ones with a gag: the Kneadmaster 9000, the Pin Press, the Aura Wash, the Great Alphorn, the Cider Press of Rebirth and the Carousel of Rebirth. The boosters (the Hot Stone Kiln, the Octopus, the Geode, the Gong of Last Resort, the Spirit Fog Machine) have no gag to reverse and are left alone.
- **The rule:** in a spell, a signature machine at or past `WEAR_REPAIR` (50, the wear at which Caretakers already start repairing, in `core/data/rules.ts`) runs its session backward. The gag plays from end to start: `gagFrame` is a pure function of progress, so the clock feeds it `1 − progress`, with no hiccup, then the failed outro. The guest comes out as they went in, pays nothing, and goes back to the head of the machine's line. The session adds its wear as usual.
- Below 50 nothing changes, so a machine a Caretaker has seen to runs forward all spell.
- At a center with no signature machine, Mercury does nothing, and nothing mentions it: no hover line, toast, PA or horoscope line.
- What each machine looks like backward, all from its existing gag:
  - **The Kneadmaster 9000** (Willow Lane): the chair spins the wrong way first, the arms un-knead the guest a pair at a time and fold away, and the chair sits them up hunched.
  - **The Pin Press** (The Exchange): the outline sinks into the board, the hammer taps the stuck pin out, and the pins push the guest back out un-rebooted.
  - **The Aura Wash** (The Boardwalk): the guest walks the tunnel from the far end, is blown wet, rinsed, brushed and pre-soaked, and steps out pink and dripping where they went in.
  - **The Great Alphorn** (High Pines): the echo comes back first, the ring of sound rolls up the horn into it, the frost settles back on the guest, their hat lands on their head, and the Sound Healer breathes out.
  - **The Cider Press of Rebirth** (The Orchard Estate): the purple sourness runs up the spout and back into the vat, and the guest climbs out as sour as they went in.
  - **The Carousel of Rebirth** (karma, any center): it turns the other way, and the past lives come in reverse, seagull, goat, toga, ruff, before the guest hops off as themselves.

**Eclipse.** One new sim rule. In a year where `dice(year)` is under 0.5, on a day `dice` picks, never in a Mercury spell or a mishap. Half a day, 3 seconds at normal speed. Patience and condition stop draining, stations pause, and nobody arrives. For the half day after, guests arrive at twice the pace, so the day's guests still come, all at once. It adds nothing to the rating: the eclipse is a pause and then a rush, and the rush is the test.

## The jokes

**PA lines,** 8 to 14 words, six to record:

- The horoscope: "This month's horoscope is now available at reception. It is binding."
- Mercury, 14 days ahead: "Mercury enters retrograde on the tenth. From then, complaints will be referred to Mercury."
- Mercury, start: "Mercury is now in retrograde. Please do not stand behind the machines."
- Mercury, end: the recorded filler line, taken out of the filler rotation and played only here.
- Eclipse, 14 days ahead: "An eclipse is expected in two weeks. Management has been assured it is temporary."
- Eclipse, start: "Do not look directly at the eclipse. Guests may look at the gift shop."
- Eclipse, end: "The eclipse is over. The sun apologizes for any inconvenience."

**Reviews** from a guest whose session ran backward: "Did the whole session backwards and left exactly as tense as I came in." At the Cider Press: "The cider went back into me, and I could taste every sour thought." On the Carousel: "Rode the carousel the wrong way and remembered a life I haven't had yet."

**On the floor.** "Rewound" floats over a machine that has run backward. In an eclipse everyone tilts their head back, a few "Ooh" floats go up, and the light dims.

## Fair play

**How it is warned of.**

- The horoscope on the 1st, in the toast and then the date's hover all month. It changes no pressure: it shows what is already set.
- The date's hover in the bottom bar (`calendarTip` in `ui/lib/seasons.ts`) names the next Mercury spell (where a machine stands) or eclipse and its day, from 30 days out.
- A toast 14 days before each, saying what it does and what to do, as `seasonAhead` does for seasons. The PA reads the forecast.
- The PA on the day it starts, and "Retrograde" under the day in the bottom bar while a spell lasts.
- In a spell, a worn machine's inspector says "Runs backward in retrograde until repaired", and the first time one does, a toast names it and the fix: "The Kneadmaster 9000 is running backward. A Caretaker's repair puts it right."

**The counterplay.**

- Mercury: have the machine repaired before the spell, assign a Caretaker to its room (`rooms` on a member of staff), or hire a second. Upgrades wear more slowly (`upgradeWear`), so an upgraded machine reaches half later.
- The eclipse: have staff free for the rush after.

**Incentives.** Mercury never pays the player for anything: the halved blame is gone. A prepared player loses nothing, so Mercury never tips the choice of whether to build a machine, which is already close (a center with one makes about what the same plot full of tables makes: [plans/machines.md](../../plans/machines.md)). An unprepared one loses machine time and their guests' patience, and sees why. The eclipse moves the day's arrivals and removes none.

**Not easier.** No number is softened. The horoscope tells the player what the timers already hold, which is communication, not numbers.

## Where it plugs in

Checked in the code.

**Phase 1, the horoscope:**

- `core/sim/economy.ts`: `monthEnd`, called from the month branch in `core/sim/sim.ts`, and `finishMonth`, which runs once payday is settled.
- The timers: `GameState` in `core/state/types.ts`; set in `emergencies.ts` (`offerEmergency`), `outbreaks.ts`, `visits.ts` (`inspectionGap`), `mishaps.ts` (`MISHAP_RETRY_DAYS`) and `calls.ts`; regulars' `due` and `returnGap` in `regulars.ts`.
- `core/data/centers.ts`: each center's `sign`.
- `ui/components/Toasts.tsx`: the horoscope's toast, a card that opens the full horoscope, like the raise requests. `ui/lib/seasons.ts`: `calendarTip`, the date's hover.
- New: `core/data/horoscope.ts` for the lines, and `castHoroscope` in `core/sim/horoscope.ts`.
- State: `horoscope`, the month's lines, so what was said stays said. One save bump from `SAVE_VERSION = 40` (`core/state/game.ts`) to the next free number, with `upgradeSave` (`core/state/upgrade.ts`) filling `horoscope: null`.
- One play statistic, `horoscope_opened`, to learn whether players read past the toast.

**Phase 2, Mercury:** `core/sim/twists.ts` as the model; the end of a machine's session in `core/sim/stations.ts`; `WEAR_REPAIR` in `core/data/rules.ts`; `smoking` and `downNotice` in `core/sim/machines.ts`; the gag clock and `gagFrame` in `render/gags/` (`clock.ts`, `beats.ts`); `ui/components/inspector/ItemInfo.tsx` for the chip; `ui/components/StatsBar.tsx`, which already swaps the line under the day for "Rush hour" or "Snowed in". Nothing saved.

**Phase 3, the eclipse:** the arrival pace in `core/sim/guests.ts`; `lightScene` and `lightLevel` in `render/lighting.ts`, which already dim the light in a power cut; a head-tilted-back pose. Nothing saved.

PA lines go into `core/data/text.ts`, `audio/voice.ts` (`VOICE_LINES`) and [dev/announcements.md](../../dev/announcements.md).

## Phases

Each ships alone and is proven before the next is started.

1. **The Monthly Horoscope (M).** The centers' signs, the lines and tooltips, the toast and hover, the saved horoscope. Proven by a test that casts a year of horoscopes at every center and checks each line against what came, and each quiet line against nothing coming; then by `horoscope_opened` after a release. If [The Local Rag](the-local-rag.md) keeps a column, the horoscope is what it prints, but the toast and the date's hover carry it all the same: a warning must not wait on a paper the player can leave unread.
2. **Mercury in the machines (S).** The calendar, the backward session, the reversed gags, the hover, toasts, PA and "Retrograde". Proven by a test (a machine at 50 in a spell runs backward and its guest goes back to the head of the line; at 49 it runs forward), the six reversed gags in the lab, and a `yarn balance` run with `BOT_ON=machines`, the sky on and off.
3. **The eclipse (M).** The pause and the rush, the dimmed light and the pose. Proven by a test that a day's arrivals are the same with and without it.

## Decisions to make

Each has a recommended default.

1. **When Mercury comes.** Fixed: days 10 to 24 of months 4 and 10, the same every year, so it can be learned.
2. **Where Mercury reaches.** Only the six signature machines, and only where one is built. Elsewhere it is not mentioned, since the horoscope names only what the game acts on.
3. **One rule or one per machine.** One: a worn machine runs backward. Each machine's own gag, reversed, gives it its own look at no cost in rules.
4. **Weeks or days in the horoscope.** Weeks. The existing letters and notices still give the day.
5. **The centers' signs.** As listed. They change no number, so any can be swapped.
6. **The full moon.** Cut. Its reiki bonus and extra guests were modifiers nobody would see. It comes back only with something on the floor.
7. **Staff star signs.** Cut. A gray line and an unseen 3 points of morale did not earn their place. If they come back, it is as something drawn, such as a gold star on the uniform in their month.
8. **The eclipse.** Everyone stops where they stand, rather than walking outside to look, which would send every guest down the corridors at once.
9. **A sandbox switch.** None at first. Mercury is answered by a Caretaker, and the eclipse costs nothing over a day.

## Risks

- **"Due" that never comes.** An emergency with nobody to treat it is put off 20 days instead (`offerEmergency`), and a freeze outside winter is looked at again in 10 (`MISHAP_RETRY_DAYS`). The horoscope must run the same checks on the 1st, or a line can promise what does not arrive. Phase 1's test is the guard.
- **A gap that breaks the month rule.** The horoscope is complete only while every timer's gap is longer than 30 days. Any future change to a gap must keep that floor, or the horoscope must start rolling timers ahead.
- **Mercury is rarely seen.** On today's lots the bot fits a machine in 1 game of 30. If players build them as rarely, Mercury is a small thing few meet. Phase 2 is small for that reason.
- **A stalled line.** A worn machine with no Caretaker to repair it runs backward every session until one comes. That is no worse than a breakdown, which the game already has, and it is warned of two weeks ahead and named by a toast the first time.
- **The joke wears thin.** Six recordings in all, and Mercury only twice a year. The horoscope's lines repeat monthly; if they tire, each family can take a second line, picked by `dice` of the month.
- **Tone.** The joke is on the center and the planets, never on a guest who believes in them, and never on a real illness. The horoscope is addressed to the center, so it never teases a guest's sign.
