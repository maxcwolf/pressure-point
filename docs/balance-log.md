# Balance log

What was found to be off in how the game plays, how it was measured, and what was done about it, newest first. The wider audit of the campaign's pace and difficulty, with its playtest bot, is `docs/balance-audit.md` on the `chore/balance-audit` branch (15 October 2026); entries here refer to its findings by number.

A month is 180 seconds of game time (30 days of 6 seconds).

## 16 October 2026, evening: staff who leave a class or a session

Measured with the walkout probe (3, below): six seeds of 70 days, Reception, a Consultation Room, a Massage Suite, a Qi Gong Studio with three Practice Spots, a Staff Room and an Instructor, reputation held at 70, counting the class-goers who went home disappointed by why. Since 70 days holds only one Instructor's break a seed, the same probe also ran over 24 seeds of 140 days, with the helpers' Staff Room (about a day's walk from the studio) and with one beside the studio.

### 11. The Sound Healer walked off mid-session

**Found:** the Singing Bowls never count as seeing anyone, so a healer left mid-session for a break, a drink or any other reason, and everyone lying on the mats went back to the line, part-treated. In the same probe with a Sound Bath Studio and a Sound Healer instead of the classes (every guest needing sound healing), the healer walked off 5 times in six seeds of 70 days, sending 6 guests back to the line, and 41 times in 24 seeds of 140 days, every time for a break, sending 57 back. Counting a session playing as someone in hand, as for the Instructor (1, below), held the healer to the end, but guests already on their way to a mat joined the session as it played and kept it going: the healer took on average 2 days to get away and up to 8.6.

**Done:** a sound bath playing counts as someone in hand (`inHand` in `src/core/sim/staffing.ts`), so the healer stays to the end of it. Once they want to be off for any reason (`wantsAway`), the mats call nobody more, anyone still on the way to a mat goes back to the line, and a session still waiting for its mats to fill does not start (`updateSession` in `src/core/sim/sessions.ts`), so the healer plays out only the guests already lying down. Walk-offs went to none in both (5 and 41 before), with as many guests treated (144 against 145, and 1,240 against 1,247). A healer now takes on average 1.4 days to get away and at most 4.5, a tired healer's one treatment; before, 0.1 days.

### 10. An Instructor's break cost a class

**Found:** 15 of the 30 disappointed class-goers had an Instructor on a break, and every break skipped a class day. A worn-out Instructor's break is not just the day and a half on the sofa: with the walk to the Staff Room and back it took 3.7 days in the probe, and 2.4 with the Staff Room next to the studio, longer than the two or three days between Monday's, Wednesday's and Friday's classes. Staff break as soon as their energy falls below the policy's level, which for an Instructor was as often the day after a class (a Saturday or a Thursday) as any other, so the break ran through the next class day. Holding off a break on a class day alone changed nothing: no break in the probe started on one.

Also, an Instructor below the policy's level stopped calling class-goers to the Practice Spots (the check that lets a tired Therapist finish their guest and go), so one held back from a break would stand at the mat with nobody to teach.

**Done** (`restDue` and `backForClass` in `src/core/sim/classes.ts`):

- an Instructor goes for a break only when the next class is at least two days off (`REST_GAP`: on the usual timetable, once Friday's is over), and then a little early, below 15 more energy than the policy's level (`REST_AHEAD`), so they are not worn down before the next chance. Until then they hold off, a class day's class included, unless their energy falls below 10 (`BREAK_EXHAUSTED`);
- a resting Instructor gets up in time to walk back for the next class, taking the walk back to be as long as the walk there was, with half a day to spare to call the class-goers to their spots (`REST_RETURN`), once rested to where they would have rested early. If that moment has passed, they rest in full;
- the Practice Spots call class-goers whenever the Instructor is not going for a break by these rules;
- the message for a class missed to a break says a Staff Room nearer the studio gets the Instructor back sooner, rather than a better one.

Disappointed class-goers in the probe went from 30 of 495 (6.1%: 15 on a break, 15 full) to 18 of 493 (3.7%: none on a break, 18 full). Over 24 seeds of 140 days, with the helpers' Staff Room, 6.9% to 5.9% (on a break 172 to 11, full 83 to 230) and class days skipped 144 to 132; with the Staff Room beside the studio, 4.6% to 1.3%, and class days skipped 114 to 66. Resting after any class rather than only before a two-day gap did worse (7.9% and 4.3%), and so did resting only 5 energy early (6.3% and 3.0%).

**Still open:** with the Staff Room a day's walk from the studio, most breaks still cost a class, as the walk there and back takes most of the weekend. Its class-goers now mostly wait for the next class and find it full, which is why "full" rose.

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

**Done:** a class under way counts as someone in hand (`inHand` in `src/core/sim/staffing.ts`), so the Instructor stays to the end and goes after. The Sound Bath's healer could still walk off mid-session, since a session plays on as long as guests keep lying down; they now play out the session and call nobody more to it (11, above).

### 2. Practice Spots had no limit

**Found:** each Practice Spot added to a studio's weekly draw, without end, so a studio full of spots drew class-goers without limit.

**Done:** an Instructor leads a class of up to 6 as a Trainee, then 8, 10 and 13, and 16 as an Expert (`CLASS_PLACES`). Spots past that stand empty and draw nobody. The studio's inspector says so, and a tip says to promote them the first time it matters.

### 3. Class-goers went home without a class, with the Instructor there

**Found:** about 15% of class-goers (74 of about 480) went home disappointed, three quarters of them Friday's, and about 1 class day in 6 was skipped. A class ran 10 seconds, close to two days, and nearly three with a tired Instructor, so on the old Monday, Wednesday and Friday timetable one class often ran through the next class day, which then had no class. Class-goers give up three days after their class day, as the day begins, so Friday's gave up on Monday morning just before Monday's class. The game never said why.

**Done:** a class runs 6 seconds, about a day, so it is over well before the next class day; and when class-goers go home without a class the player is told why, once for each class: no Instructor, the Instructor on a break or away from the mat, the class before still going, the day taken off the timetable, or they got there after it (`noteMissedClasses` and `giveUp` in `src/core/sim/classes.ts`). Measured over six seeds of 70 days, with the studio's three Practice Spots and reputation held at 70, about 6% went home disappointed afterwards (30 of 495) and about 1 class day in 17 was skipped.

A new studio briefly held classes on Monday and Thursday instead, to space them out, but the shorter class alone is enough: the same probe on Monday and Thursday had 8% disappointed (27 of 342) and 1 class day in 13 skipped, and fewer class-goers in all (315 against 465). Changing the default would also have quietly moved every older save's studio to two classes a week. A new studio still holds classes on Monday, Wednesday and Friday.

**Still open:** half of the 6% left were Instructors on a break that took up the whole class day, and half were left waiting because every spot was taken (8, above). Instructors now time their breaks around the classes (10, above), which leaves 3.7% disappointed, nearly all of them because the class was full.

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

- **Demand still does not grow with the center** (audit finding 3), which matters more than how it is split: arrivals that rise with each staffed discipline and with treatment rooms built.
- **The following's numbers need checking in a well-run center** with the playtest bot. They were retuned the same day (6, above), but only on paper.
- **The Sound Healer** (4, above).
