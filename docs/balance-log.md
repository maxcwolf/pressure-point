# Balance log

What was found to be off in how the game plays, how it was measured, and what was done about it, newest first. The wider audit of the campaign's pace and difficulty, with its playtest bot, is `docs/balance-audit.md` on the `chore/balance-audit` branch (15 October 2026); entries here refer to its findings by number.

A month is 180 seconds of game time (30 days of 6 seconds).

## 16 October 2026, later: a review of the above

A review of the changes below found four things worth fixing before they were merged.

### 6. A following could only shrink

**Found:** with 3 for a heal (less as the following grows) against 4 for a failure, a discipline had to heal 57% of its guests to grow at all from nothing, and 69% to hold 40; a Trainee heals about 55%. A following also faded every day, even on a day its practitioners were busy, so a new discipline started at 0 and mostly stayed there: the opposite of growing with results.

**Done:** a heal adds 5 (less as the following grows), a failure takes 3 and a guest who gives up waiting for their treatment 2. A discipline now holds its own healing about 40% of its guests from nothing, 50% at 40 and 75% at 80, so a following settles where the practitioners' results put it: about 27 for a discipline healing 45% of its guests, about 80 for one healing 75%. A discipline new to the center starts at 20 rather than 0, from the word that it is on offer, and a following fades only on a day nobody was treated in it, by a twentieth a month. The Guests tab and the guide said it faded "when nobody comes" when it faded every day; they now say what it does.

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

**Still open:** half of the 6% left are Instructors on a break that takes up the whole class day, and half got there after the class (often because every spot was taken); a worn-out Instructor's break runs about a day and a half. Letting them rest straight after a class instead of before one would help.

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
- the pull of its **finest room**, for every treatment room now and not just the Sound Bath Studio: 1, plus 0.35 a prestige star past the first, plus up to 0.6 for quiet, plus 0.2 for each spare sound mat, up to 3;
- how much of it the staff are **trained** for (an untrained condition counts 0.4), and the center's local favourites, averaged over its conditions so the number of conditions no longer counts.

The Stats menu has a new **Guests** tab showing each discipline's share of new guests, each factor with its multiplier, and the one thing that would draw the most more (training, word of mouth or the room). Every treatment room's inspector says how strongly it draws.

In the full center afterwards, shares were more even (massage 27 to 34%, the others 13 to 22%), but followings shrank in the harness's poorly equipped rooms, where failures outnumber heals. Profits were much the same: massage about even, the rest losing $0.9k to $2.5k a month, since there are still only about 12 guests a month to go round.

**Still open:**

- **Demand still does not grow with the center** (audit finding 3), which matters more than how it is split: arrivals that rise with each staffed discipline and with treatment rooms built.
- **The following's numbers need checking in a well-run center** with the playtest bot. They were retuned the same day (6, above), but only on paper.
- **The Sound Healer** (4, above).
