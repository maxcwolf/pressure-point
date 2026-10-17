# Balance log

What was found to be off in how the game plays, how it was measured, and what was done about it, newest first. The wider audit of the campaign's pace and difficulty, with its playtest bot, is `docs/balance-audit.md` on the `chore/balance-audit` branch (15 October 2026); entries here refer to its findings by number.

A month is 180 seconds of game time (30 days of 6 seconds).

## 16 October 2026, late night: a playtest bot that plays like a good player

### 13. The bot understated how easy the game is

**Found:** the playtest bot never touched prices, marketing or policy, never let anyone go, never saved toward a money goal and built rooms whenever a line was long, so a good player beat it everywhere and its numbers made the game look harder than it is. Judging whether a change makes the game too easy needs a bot that plays well.

**Done** (`tests/balance/bot.ts`, the bot only; no game rules changed). The bot now:

- **sets prices** each month, a tenth at a time, between 1.0 and 1.4: up while fewer than one guest in ten is put off by them and reputation is comfortable (at least 45, and any reputation goal met), down when more are put off or reputation falls short of a goal or drops. A discipline whose line runs past three a room costs up to 30% more on top, so the guests who would wait and walk out are priced off instead;
- **buys marketing** only where it can pay: word of mouth when a month of it could carry reputation to a goal, or the center has time to spare; a condition in the spotlight for a "heal so many with…" goal while that discipline has time to spare, or to send guests from a crowded discipline to an idle one; and a recruitment drive, holding out up to a week, when the only applicants for a practitioner are Trainees;
- **lets practitioners go** just before payday when a discipline's tables were busy well under 70% of the time and the season ahead is no busier (never the last of a discipline), leaves the room empty, and takes someone back on when another room would pay;
- **saves for an open money goal** once the rest of the star is met or the money is halfway there: no decor (unless a prestige goal asks for it), no land, no new discipline a goal does not need, no room that does not pay for itself within three months, and the loan paid down;
- **builds a treatment room on the profit it is expected to make**: the guests who gave up waiting for that discipline last month, plus the line beyond one a room, times the busiest of the next three months' seasons, healed at the discipline's own rate and paying its fees, less a salary and the room's cost spread over a year. It keeps space for a discipline the next star opens, giving up a spot while the room is still a plan if it would leave none; and when a goal needs a room that will not fit and there is no land left to buy, it knocks down a spare room for half its cost back, as a player can, and builds in its place;
- **takes house calls** when someone else in the role stays at work, or the line is short and no wait goal is open;
- **evens out lines**, moving guests from a station with nobody at it or a much longer line to another of the same kind, and lets at most half of any role go on a break at once.

Each can be switched off for a comparison: `BOT=old yarn balance` plays as the bot did before (checked to give the same games, move for move), and `BOT_OFF=prices,calls` switches single ones off (`BOT_FLAGS` in the bot). The month logs are as before, with the price level added.

Measured with `yarn balance` at `a9dbef7` (5% arrivals a discipline, the narrower following), every campaign center, seeds 1 to 3, four years a game. Guests, healed, waits and profit are averaged from the second year on; months at a loss are of all 48:

| Center             | Third star | Stars at month         | Guests a month | Healed a month | Average wait, days | Months at a loss | Profit a month  | Price level |
| ------------------ | ---------- | ---------------------- | -------------- | -------------- | ------------------ | ---------------- | --------------- | ----------- |
| Willow Lane        | 1/3 → 3/3  | 1, 15, 30 → 1, 4, 13   | 13.1 → 14.9    | 9.4 → 10.9     | 13.6 → 12.5        | 24.7 → 9.3       | $3.4k → $16.7k  | 1.00 → 1.32 |
| The Exchange       | 2/3 → 3/3  | 9, 13, 29 → 13, 18, 20 | 18.6 → 14.3    | 15.3 → 10.8    | 6.0 → 7.5          | 17.3 → 10.3      | $4.9k → $17.9k  | 1.00 → 1.37 |
| The Boardwalk      | 0/3 → 3/3  | 7, 14, – → 5, 13, 23   | 16.1 → 15.8    | 11.0 → 10.8    | 7.2 → 8.3          | 27.7 → 18.0      | −$2.8k → $5.5k  | 1.00 → 1.21 |
| High Pines         | 0/3 → 3/3  | 22, 22, – → 7, 29, 42  | 17.0 → 15.3    | 12.8 → 10.5    | 4.6 → 9.3          | 24.0 → 19.0      | $1.0k → $6.5k   | 1.00 → 1.29 |
| The Orchard Estate | 3/3 → 3/3  | 6, 25, 36 → 6, 14, 22  | 19.4 → 19.0    | 14.8 → 14.2    | 6.7 → 10.1         | 16.3 → 9.3       | $12.5k → $32.5k | 1.00 → 1.27 |

Stars at month is the average month each star came in the games that earned it. The new bot earns the third star in all 15 games against 6, makes 2.5 to 7 times the profit where the old one made any, spends 5 to 15 fewer months at a loss, and does it with much the same staff. It sees and heals a few fewer guests: it plays for money, not for the most guests through the door. At The Exchange its first star comes later, as running thin at high prices keeps the average wait over 3 days for longer. At The Boardwalk and High Pines the Reiki Studio for the third star fitted only after knocking down a second Massage Suite (in four games of six), the building being full with all its land bought; the old bot never built one there, and one of its High Pines games ended $195k in debt.

**What each behaviour is worth**, from the same games with one switched off, run before the bot learned to make space and with marketing as first tuned (three seeds, so a difference of a few thousand a month is within what the seeds alone do):

- **Prices** count most and everywhere: without them profit falls by $3k to $10k a month at every center, and The Boardwalk's third star comes in one game of three. At 1.3 to 1.4 only about 2% of guests are put off, since regulars and emergencies never balk, and reputation per heal falls by a tenth.
- **House calls** come next: $1,200 a day and up, against roughly $250 a day a practitioner earns in the center. Without them Willow Lane makes half as much.
- **Saving** gets the money goals sooner (The Boardwalk's third star in three games of three, one without; High Pines loses money without it).
- **Expansion on profit** helps where the old rule built too little (Willow Lane) but builds less than it should where seasons and the following swing (High Pines and The Boardwalk did better without it).
- **Marketing**, **payroll** and **lines** are within the seeds' noise, or slightly costly. Word of mouth at $3,000 a month rarely pays for itself.

**For the "too easy" question:** this bot is a fairer stand-in for a good player, and against the old one it finds the game much easier, mostly through prices and house calls, which cost a good player almost nothing. Its waits are longer than the old bot's (by up to 4.5 days at High Pines), as a player chasing money runs thin; so a good player will not find waiting guests the hardest thing to manage, but a cautious one may.

**Noted, not changed (game rules):**

- Raising prices to 1.4 costs very little: the put-off chance (35% of every tenth over 1.0) applies only to guests who are not regulars, and those are a small share in a settled center.
- House calls pay several times what a practitioner earns in the center, for one to three days away.
- Letting someone go has no cost, no notice and no severance, and a member of staff let go just before payday is not paid for the month they worked.
- The Boardwalk and High Pines, with all their land, have too little room for a fifth treatment room in the bot's layout without knocking one down, as the audit found.

## 16 October 2026, night: toned down for release, against the released game

The released 0.28.6 plays fair without being punishing, so it is the measure: the changes above should not make the game much easier than it. The playtest bot was run on 0.28.6 itself (its source, with the bot copied in) and on this branch, six seeds of every center each, four years a game. The bot is a cautious scripted player that never touches prices, marketing or policy and never lets anyone go, so a good player does better than either column; what counts is the difference between them.

### 11. The arrivals boost made the game too generous

**Found:** at 10% a discipline (10, below), profits rose by $1.4k to $9.2k a month at every center that offers more than massage.

**Done:** halved to 5%: a fifth discipline brings 20% more guests. Against the released game, with the narrower following (12, below) as well, averaged from the second year on:

| Center             | Profit a month  | Months at a loss | Average wait, days | Third star |
| ------------------ | --------------- | ---------------- | ------------------ | ---------- |
| Willow Lane        | $4.6k → $5.6k   | 20.5 → 20.7      | 11.4 → 12.1        | 4/6 → 4/6  |
| The Exchange       | $0.8k → $4.1k   | 27.3 → 19.0      | 4.5 → 6.2          | 2/6 → 4/6  |
| The Boardwalk      | −$6.7k → −$2.7k | 34.2 → 28.7      | 6.5 → 6.4          | 0/6 → 0/6  |
| High Pines         | −$0.2k → $1.8k  | 26.2 → 21.7      | 5.5 → 6.5          | 0/6 → 0/6  |
| The Orchard Estate | $3.1k → $6.0k   | 27.3 → 23.7      | 6.4 → 6.8          | 1/6 → 3/6  |

The branch is a little easier than the release: $2k to $4k a month more where there is more than massage to offer, most where the bot lost money for most of the game (The Boardwalk lost $6.7k a month on 0.28.6, and still loses $2.7k). Willow Lane, which never gets the boost, is the same within the seeds. The bot still spends 19 to 29 of its 48 months at a loss everywhere. Not all of the difference is the boost: on three seeds with no boost at all, the branch already made about $5k a month more at The Exchange and The Boardwalk than the release, from reputation that holds higher. Waits are up by up to a day and a half: guests waiting should not become the main thing to manage, so a faster walk to treatment is the next step before demand grows any further.

These runs played the bot from a clean copy of the branch; an earlier set was redone after another session started changing the bot in the same folder.

### 12. A following widened the gap between disciplines

**Found:** a review predicted it and the bot confirmed it. Massage's following climbed to 70 to 87 at every center, while the others mostly settled between 20 and 56. A following settles where a discipline's success rate puts it, and massage heals most reliably, while a niche discipline is idle most days, when followings fade. At up to 2.5×, a following of 87 drew twice what one of 32 did, on top of massage being the more popular.

**Done:** a following now multiplies a discipline's pull from 0.75 with none to 1.75 at 100 (was 0.5 to 2.5), so 87 against 32 draws 1.5× rather than 2×. It only moves guests between disciplines, not how many come. In the bot's games afterwards (six seeds), the smaller disciplines healed more and built bigger followings: acupuncture at The Exchange 3.4 heals a month (was 2.8) and a following of 59 (was 56); The Orchard's acupuncture and reiki ended at 50 and 64 (both were 46); sound healing at High Pines at 58 (was 37). Massage still leads, at 68 to 85. Acupuncture at The Boardwalk still fades, to 13, for reasons the bot's logs do not show.

**Still open:** walkouts take 2 from a following, so a discipline losing many guests to waiting can still grow. That was left as it is, since waiting should not become the main thing to manage; the walk to treatment is the better fix.

## 16 October 2026, evening: arrivals grow with what the center offers (a first step)

### 10. More disciplines brought no more guests

**Found:** the audit's finding 3 and the still-open note on 5: guests arrive at a pace set by reputation, the center and its grade, and nothing the player builds raises it. A new discipline only split the same guests, while adding a salary and a room.

**Done**, deliberately small so it can be playtested before it goes further: guests arrive 10% more often for each discipline past the first that has a finished room and a practitioner on the payroll (`OFFERING_ARRIVALS` in `src/core/data/rules.ts`, `offeringArrivals` in `src/core/sim/demand.ts`), so five disciplines bring 40% more. A room with nobody to work in it brings nobody. The Guests tab says how many disciplines are staffed and what that does to arrivals. The audit suggested 20% a discipline, and raising arrivals across the board made things worse in its experiment, so this starts at half that.

Measured with the playtest bot (`yarn balance`, every campaign center, three seeds, four years), before and after, averaged from the second year on:

| Center             | Guests a month | Healed a month | Average wait, days | Months at a loss | Profit a month |
| ------------------ | -------------- | -------------- | ------------------ | ---------------- | -------------- |
| Willow Lane        | 13.0 → 13.0    | 9.3 → 9.3      | 13.6 → 13.6        | 24.7 → 24.7      | $3.1k → $3.1k  |
| The Exchange       | 16.8 → 19.4    | 14.1 → 15.7    | 5.7 → 6.9          | 19.3 → 17.7      | $4.7k → $6.5k  |
| The Boardwalk      | 16.3 → 17.8    | 11.7 → 12.9    | 8.2 → 7.7          | 25.7 → 20.0      | $0.0k → $1.4k  |
| High Pines         | 15.3 → 17.3    | 11.4 → 13.1    | 4.9 → 7.2          | 27.7 → 22.3      | −$1.0k → $1.7k |
| The Orchard Estate | 14.2 → 20.8    | 10.0 → 15.4    | 6.1 → 10.9         | 26.7 → 18.3      | $5.7k → $14.9k |

Willow Lane, which only ever offers massage, is unchanged, as it should be. Everywhere else the extra guests are mostly healed, months at a loss fall by 2 to 8, and every center now makes money on average (High Pines lost $1.0k a month and The Boardwalk broke even before). The Orchard, which opens with the most disciplines, gains the most, and its second and third stars came in two games of three instead of one. Waits rose by a day or two, and by nearly five at The Orchard: the audit's other half of finding 3, a faster walk to treatment, is still to do.

**Still open:** whether 10% feels right in play (halved to 5% since: 11, above). The audit's 20% would roughly double these gains and the longer waits. Treatment rooms past one a discipline add nothing yet.

## 16 October 2026, later: a review of the above

A review of the changes below found four things worth fixing before they were merged.

### 6. A following could only shrink

**Found:** with 3 for a heal (less as the following grows) against 4 for a failure, a discipline had to heal 57% of its guests to grow at all from nothing, and 69% to hold 40; a Trainee heals about 55%. A following also faded every day, even on a day its practitioners were busy, so a new discipline started at 0 and mostly stayed there: the opposite of growing with results.

**Done:** a heal adds 5 (less as the following grows), a failure takes 3 and a guest who gives up waiting for their treatment 2. A discipline now holds its own healing about 40% of its guests from nothing, 50% at 40 and 75% at 80, so a following settles where the practitioners' results put it: about 27 for a discipline healing 45% of its guests, about 80 for one healing 75%. A discipline new to the center starts at 20 rather than 0, from the word that it is on offer, and a following fades only on a day nobody was treated in it, by a twentieth a month. The Guests tab and the guide said it faded "when nobody comes" when it faded every day; they now say what it does.

### 7. A staff challenge could ask a niche discipline for too many

**Found:** a challenge to heal guests in one optional discipline asked for 40% of what the whole center heals in the time, whatever that discipline's share of the guests. With sound healing drawing perhaps 10%, it asked for four times what the Sound Healer would see.

**Done:** it asks for the discipline's own share of the guests, from the same demand the Guests tab shows, with the same 20% stretch as the challenge for the whole center (at least 3).

### 8. "They got there after the class" was really "the class was full"

**Found:** every class-goer told they got to the studio after their class had finished had in fact been there all along, waiting behind a full class. A class is booked up to its spots, but class-goers who missed one class day wait up to three days for the next, so they and the next day's class-goers can outnumber the spots. Nothing told the player when more wanted a place than there were.

**Done:** when a class ends with every spot taken, anyone still waiting for that class or an earlier one is told the class was full, and so is the player when they give up: "every Practice Spot was taken… Another class day, or more spots, would fit them in." A tip says the same the first time a class is booked full with class-goers turned away. In the walkout probe (3, above) all 15 of the "late" were full classes.

### 9. A fine room counted for as much as a big following

**Found:** a room could triple its discipline's pull (up to 3 with five stars, a quiet room and spare mats), as much as a following of 75. Paired with a following that only shrank (6), the room was the one thing a player could do about demand, and a lavish Sound Bath Studio could draw nearly twice the guests of a plain Massage Suite with the same following, though sound healing is the less popular.

**Done:** a room can at most double its discipline's pull. Results, through the following, now count for more than the room.

## 16 October 2026: practitioners, demand and Qi Gong

### How it was measured

A throwaway harness ran the real simulation in two ways, three seeds each:

- **Kept busy.** One practitioner of each kind in the same 6×5 room, fully trained, without traits, on fair pay, with diagnosed guests for their discipline always waiting, for two months after ten days' warm-up. This measures what each can earn, not what they do earn.
- **A full center.** Reception, a Consultation Room, a room for every discipline and a Qi Gong Studio, every practitioner at rank 3, reputation held at 60 and guests arriving as usual, for two to six months. This measures what each actually earns.

The harness was not kept. Once `chore/balance-audit` is merged, its playtest bot is the better tool for the second measurement, since it builds and runs a center properly (the harness's small test rooms lacked the equipment for most techniques, so its treatments failed about half the time).

### 1. The Qi Gong Instructor walked off mid-class

**Found:** the Instructor's Mat never counts as seeing anyone (`serving` stays 0), so every reason staff may leave their post (a drink, a break, a priority room, smudging, a duty or room change) applied in the middle of a class. Leaving sent everyone on a Practice Spot back to the line, where they lost patience.

**Done:** a class under way counts as someone in hand (`inHand` in `src/core/sim/staffing.ts`), so the Instructor stays to the end and goes after. The Sound Bath's healer can still walk off mid-session; that needs a different fix, since a session plays on as long as guests keep lying down.

### 2. Practice Spots had no limit

**Found:** each Practice Spot added to a studio's weekly draw, without end, so a studio full of spots drew class-goers without limit.

**Done:** an Instructor leads a class of up to 6 as a Trainee, then 8, 10 and 13, and 16 as an Expert (`CLASS_PLACES`). Spots past that stand empty and draw nobody. The studio's inspector says so, and a tip says to promote them the first time it matters.

### 3. Class-goers went home without a class, with the Instructor there

**Found:** about 15% of class-goers (74 of about 480) went home disappointed, three quarters of them Friday's, and about 1 class day in 6 was skipped. A class ran 10 seconds, close to two days, and nearly three with a tired Instructor, so on the old Monday, Wednesday and Friday timetable one class often ran through the next class day, which then had no class. Class-goers give up three days after their class day, as the day begins, so Friday's gave up on Monday morning just before Monday's class. The game never said why.

**Done:** a class runs 6 seconds, about a day, so it is over well before the next class day; and when class-goers go home without a class the player is told why, once for each class: no Instructor, the Instructor on a break or away from the mat, the class before still going, the day taken off the timetable, or they got there after it (`noteMissedClasses` and `giveUp` in `src/core/sim/classes.ts`). Measured over six seeds of 70 days, with the studio's three Practice Spots and reputation held at 70, about 6% went home disappointed afterwards (30 of 495) and about 1 class day in 17 was skipped.

A new studio briefly held classes on Monday and Thursday instead, to space them out, but the shorter class alone is enough: the same probe on Monday and Thursday had 8% disappointed (27 of 342) and 1 class day in 13 skipped, and fewer class-goers in all (315 against 465). Changing the default would also have quietly moved every older save's studio to two classes a week. A new studio still holds classes on Monday, Wednesday and Friday.

**Still open:** half of the 6% left are Instructors on a break that takes up the whole class day, and half were left waiting because every spot was taken (8, above); a worn-out Instructor's break runs about a day and a half. Letting them rest straight after a class instead of before one would help.

### 4. What each practitioner earns when kept busy

**Found:** profit a month (revenue less pay), kept busy:

| Practitioner         | Trainee    | Experienced | Expert       |
| -------------------- | ---------- | ----------- | ------------ |
| Massage Therapist    | $4.5k      | $4.7k–7.6k  | $8.8k–9.5k   |
| Acupuncturist        | $3.8k      | $6.3k–7.3k  | $9.5k–11.0k  |
| Reiki Practitioner   | $3.5k–4.1k | $9.0k–9.7k  | $11.9k–12.4k |
| Shaman               | $5.8k–7.1k | $7.2k–8.4k  | $11.8k–12.3k |
| Qi Gong Instructor   | $4.1k–4.5k | $7.7k       | $12.8k       |
| Sound Healer, 2 mats | $12k–13k   | $21k–23k    | $25k–31k     |
| Sound Healer, 4 mats | $20k–25k   | $31k        | $44k–45k     |

Ranges are a bare room (prestige 3) and a dressed one (prestige 5). Five of the six are within about 20% of each other at the same rank. **The Sound Healer earns about 3× with two mats and nearly 4× with four**: one healer treats every mat at once, sound fees are the second highest (about $2,100 on average), and mats have no limit. **Rank matters most**: a fully trained Trainee fails about 45% of treatments and an Expert about 10%, so profit roughly triples from Trainee to Expert while pay doubles. **Room amenities hardly count**: prestige 3 against 5 moved profit by less than the seeds did, since each prestige star adds only 2% to the chance of success.

**Done:** a Sound Healer plays for up to 2 mats as a Trainee or Junior, 3 as Experienced or Senior, and 4 as an Expert (`SOUND_MATS`), as Practice Spots are capped by an Instructor's rank. Mats past that call nobody, start no session, and add nothing to the studio's pull. The bowls' inspector says how many the healer plays for, and a tip says so the first time mats stand empty. Kept busy with 4 mats afterwards: a Trainee $12.9k–16.5k a month (was $20k–25k), the same as with 2; Experienced $29k (was $31k); an Expert $44k–45k, unchanged, as an Expert plays for all 4.

**Still open:** the cap stops the Sound Healer earning without limit, but even at 2 mats they earn about 3× the others ($12k–13k against $3.5k–7k as a Trainee). Cutting sound fees to about 55% would bring 2 mats into line with one treatment table. Amenities could count for more in what a treatment earns.

### 5. Who comes for what made no sense, and the player could not see it

**Found:** a guest's condition was picked from every condition the center could treat, each counting once, so a discipline's share of guests was how many conditions had been written for it: massage 15, reiki 11, acupuncture 9, shamanism 9, sound healing 6. Each center's local favourites mostly favoured massage, sound's conditions unlock over the stars (3 at the first, 6 at the third), and guests whose condition nobody was trained for came 40% as often. At the stars a player actually plays, sound healing drew 11 to 23% of guests (massage 24 to 62%): about one sound guest a month, often none, while its busy earnings were the highest. In a full center of about 12 guests a month, every treatment practitioner lost money ($0.1k to $2.3k a month at rank 3); only the Qi Gong Instructor made money, as classes draw guests of their own. This is the audit's finding 3 (demand does not grow with the center) seen practitioner by practitioner.

**Done** (`src/core/sim/demand.ts`, save version 30): a guest picks a **discipline** first, then a condition within it. A discipline's pull is:

- its **popularity**, a deliberate number on the discipline rather than an accident of how many conditions it has: massage 1, acupuncture 0.8, reiki 0.7, sound healing and shamanism 0.6;
- its **following**, 0 to 100, as a multiplier from 0.5 to 2.5. It grows by 3 with each guest healed (less as it grows), falls by 4 with each failure and by 2 with each guest who gives up while waiting for the treatment, and fades by a tenth a month. Massage starts at 40 in a new game and anything new at 0, so a niche discipline starts quiet and grows with good results. Older saves start every discipline they have a room for at 40;
- the pull of its **finest room**, for every treatment room now and not just the Sound Bath Studio: 1, plus 0.35 a prestige star past the first, plus up to 0.6 for quiet, plus 0.2 for each spare sound mat, up to 3 (2 since: 9, above);
- how much of it the staff are **trained** for (an untrained condition counts 0.4), and the center's local favourites, averaged over its conditions so the number of conditions no longer counts.

The Stats menu has a new **Guests** tab showing each discipline's share of new guests, each factor with its multiplier, and the one thing that would draw the most more (training, word of mouth or the room). Every treatment room's inspector says how strongly it draws.

In the full center afterwards, shares were more even (massage 27 to 34%, the others 13 to 22%), but followings shrank in the harness's poorly equipped rooms, where failures outnumber heals. Profits were much the same: massage about even, the rest losing $0.9k to $2.5k a month, since there are still only about 12 guests a month to go round.

**Still open:**

- **Demand still does not grow with the center** (audit finding 3), which matters more than how it is split: arrivals that rise with each staffed discipline and with treatment rooms built. A first step since: 10, above.
- **The following's numbers need checking in a well-run center** with the playtest bot. They were retuned the same day (6, above), but only on paper.
- **The Sound Healer** (4, above).
