# Balance log

What was found to be off in how the game plays, how it was measured, and what was done about it, newest first. The wider audit of the campaign's pace and difficulty, with its playtest bot, is `docs/balance-audit.md` on the `chore/balance-audit` branch (15 October 2026); entries here refer to its findings by number.

A month is 180 seconds of game time (30 days of 6 seconds).

## 17 October 2026, later: Qi Gong classes that pay their way

Measured with `BOT_ON=classes yarn balance` against `yarn balance` from `0405d9d` (0.30.3, with 12-place classes at $130) and the good bot of 23, at every campaign center, seeds 1 to 6, four years a game. Profit, reputation and guests are averaged from the second year on; months at a loss are of all 48. Games without classes play the same under the new rules, as nothing in them changes without a class-goer.

### 24. Classes cost a good player money, and not for the reason thought

**Found:** with classes, the bot made $4.9k a month less (23.5k against 28.4k), its reputation was 11 points lower and treatment guests came 16.1 a month against 18.6. In the 9 games of 30 where it built a studio, it was $15k a month less, 37 points of reputation lower, and 13.5 guests a month came against 21.6. It had been put down to class-goers counting against the guest limit, but that was hardly ever reached: those games held 34 guests on average against a limit of 75 or so, and letting class-goers off the limit alone changed nothing ($23.4k). Guests came less often because reputation fell, as it sets how often they arrive. Watching where it went (Orchard seed 4, three years): class-goers held their classes for +977 points of reputation all told, and those who **went home without a class** lost −1,839 (−1 each, against at most +0.5 for a class, and less at a good reputation). A third or more of class-goers missed their class, for three reasons:

- **The Instructor was away, and classes were booked anyway.** Every break means a walk to the Staff Room and back, a drink or a snack, and a rest. From a studio far from it (at the Orchard, in the second building, round by the street) that took 8 to 11 days, and every class day meanwhile was booked as usual.
- **The backlog never cleared.** Class-goers who missed a class stayed for the next one, but the next was booked full besides, so they stayed on until they gave up.
- **Class-goers set off too late.** The walk in from the street to the studio took 4 days at the Exchange, and they set off two days ahead. A class starts as soon as one class-goer reaches a spot, and lasts most of a day, so the rest got there after it. Those booked for a Thursday or a Friday gave up over the weekend, before Monday's class.

| Missed their class (of all booked) | Before | After |
| ---------------------------------- | ------ | ----- |
| The Orchard, seed 4                | 38%    | 16%   |
| High Pines, seed 3                 | 43%    | 23%   |
| Willow Lane, seed 1                | 31%    | 14%   |

**Done** (`src/core/sim/classes.ts`, `src/core/sim/guests.ts`):

- Places are booked only while the Instructor is at their mat, and class-goers due to set off while the Instructor is on a break, a course or a call stay at home (`bookClasses`, `admitClassgoers`, `instructorAway`). The studio's booking then reads "nobody booked, the Instructor being away from their mat", and a tip the first time says a Staff Room nearer the studio gets them back from a break sooner.
- A class books only the places left in the classes still to come up to its day, once the class-goers already waiting or on their way are counted (`classesThrough`), so those left over from a class that never happened take the next one's places.
- When a class ends, class-goers booked for it or an earlier one who are still on their way in are put down for the studio's next class (`finishClass`, `nextClassDay`). Those already waiting in line when every spot was taken still miss it as before.
- Class-goers have places of their own, their Practice Spots, and no longer count against the guest limit (`guestsCounted`). It made no difference that could be measured here, but a class let out to the shop can no longer keep treatment guests out of a small center.

The bot builds as many Practice Spots as its Instructor can lead, as class-goers no longer count against the limit (it sold spots while the building was nearly full, and built more only while there was room).

| Center             | Third star       | Profit a month         | Reputation | Guests a month   |
| ------------------ | ---------------- | ---------------------- | ---------- | ---------------- |
| Willow Lane        | 6/6, 6/6, 6/6    | $17.5k, $20.2k, $20.2k | 65, 63, 65 | 14.6, 14.4, 14.7 |
| The Exchange       | 6/6, 6/6, 6/6    | $24.8k, $19.8k, $24.6k | 94, 79, 89 | 18.0, 15.1, 16.5 |
| The Boardwalk      | 4/6, 3/6, 4/6    | $11.1k, $10.1k, $12.7k | 63, 58, 62 | 16.9, 15.8, 16.4 |
| High Pines         | 6/6, 6/6, 6/6    | $21.6k, $18.3k, $21.0k | 84, 76, 82 | 19.1, 17.5, 18.6 |
| The Orchard Estate | 6/6, 6/6, 6/6    | $66.8k, $49.1k, $73.9k | 94, 67, 92 | 24.7, 18.0, 23.3 |
| All                | 28, 27, 28 of 30 | $28.4k, $23.5k, $30.5k | 80, 69, 78 | 18.6, 16.1, 17.9 |

Each cell is without classes, with classes before, and with classes now. Only 9 games build a studio (Willow Lane 1, the Exchange 1 and 2, the Boardwalk 6, High Pines 3, the Orchard 1, 4, 5 and 6); the other 21 play much as without classes, though in 5 of them the bot plays differently from the moment it first weighs up a studio, which moves their profit by as much as the seeds do (High Pines 5, $32.8k against $25.6k, without ever building one). In the 9, classes now earn more than no classes in 8, by $2.9k to $20.6k a month, and the Exchange's seed 2 makes $3.4k less ($23.2k against $26.6k, from $7.5k before). Their profit is $51.2k a month against $43.0k without classes and $27.9k before, and their months at a loss 6.3 against 6.8 and 7.7.

What each rule added, all 30 games, profit a month with classes: $23.5k before; off the guest limit, $23.4k; booking only while the Instructor is at their mat, $28.7k; booking only the places left, $29.5k; putting latecomers down for the next class, $30.5k.

**Still open:**

- **A studio's reputation is still lower than without one** (83 against 89 in the 9 games): from 14% to 23% of class-goers still miss their class, nearly all while the Instructor is away. A break from a studio far from the Staff Room still takes days, and those already booked or waiting when it starts go home. A Staff Room beside the studio would mend it; the bot never builds one, nor keeps a day in the week free of classes for the Instructor to rest.
- **Class-goers queue at the Shop Counter for days.** At High Pines some waited there 10 days after their class. They no longer keep anyone out, but they are still in the building.

## 17 October 2026, afternoon: smaller Qi Gong classes

### 22. A class of 16 overwhelmed the center

**Found** (in play, at the Orchard Estate): a class of 16 to 20 ends all at once, and up to three quarters of its class-goers head for the Shop Counter and the restrooms together, three times a week. The shop line reached 108, the class-goers filled the corridors and counted against the building's guest limit, keeping paying guests out.

**Done:** an Instructor leads at most 12, from 6 as a Trainee: 6, 8, 9, 11 and 12 by rank (`CLASS_PLACES`, was 6, 8, 10, 13 and 16), so Trainees and Juniors are as before. A place costs $130 at standard prices (`CLASS_FEE`, was $120): an Expert's full class brings in $1,560 against $1,920, a fifth less, for a quarter fewer people in the building. Not measured with the bots, which rarely run a Qi Gong Studio to its full size; to be judged in play.

## 17 October 2026, after midnight: the Posture Lab

Measured with `yarn balance` and `BOT=old yarn balance` from clean exports of 0.29.0 (`97e9de3`, with this bot copied in) and of `e6e4e86`: every campaign center at seeds 1 to 3, and High Pines at seeds 1 to 9, four years a game. Profit and waits are averaged from the second year on; months at a loss are of all 48. With the new extras off, the copied bot plays 0.29.0 move for move as its own bot does, and wherever nobody is sent for a scan, the two commits play the same games.

### 21. The Posture Lab was a trap

**Found:** a scan only sees guests whose first consultation left the diagnosis short of the policy's target, and it did nothing a second consultation did not: either gets any diagnosis past the usual 75%, the scan charged $150 against a consultation's $200, and the lab needs a Consultant of its own. Only a Consultant of rank 1 or 2 is ever unsure (a first look gives 0.4 + 0.13 a rank + up to 0.15), so in a center with rank 3 Consultants the lab sees nobody at all. The bot hires the best applicant, nearly always rank 3 or better: 0.29.0's bot built a lab in 8 of its 21 games, and scanned anyone in only 4 of them, 2 to 6 guests a month. To measure the lab where it is used, the bot learned two extras, off unless named (`BOT_ON=junior,lab`): **junior** hires the cheapest Consultant going (in the games looked at, they stayed at rank 1), and **lab** builds a Posture Lab once the center pays its way, when the Consultants are all rank 2 or below or more than three wait a Consultation Room. With both, about 10 guests a month are scanned. On 0.29.0, building the lab in such a center cost $4.5k a month against the same games without one (a junior center that never built a lab, 9 games), worse in 8 of 9.

**Done:** a scanned guest's chance of success is 10% higher (`SCAN_SUCCESS` in `src/core/data/rules.ts`, a `scanned` flag on the guest set by the scan), and a scan costs $250 (`ASSESS_FEE`), a little more than a consultation. The Posture Lab and Posture Scanner say what a scan adds, the guest inspector shows "📐 Scanned" under the chance of success (which counts it), the tip on a second look mentions it, and the guide's step 8 says what the lab does and that it only sees the guests a junior Consultant is unsure about.

The bonus was chosen on whether the lab pays for itself in a center that uses it. Lab against no lab in junior centers, 17 games (Willow Lane and High Pines, seeds 1 to 21, where the junior bot without the extra never built one):

| Scan bonus | Profit a month, with the lab against without | Better with the lab |
| ---------- | -------------------------------------------- | ------------------- |
| 0.29.0     | −$4.5k (9 games)                             | 1 of 9              |
| 5%         | −$1.2k (median −$2.2k)                       | 5 of 17             |
| 8%         | −$1.2k (median −$1.9k)                       | 5 of 17             |
| 10%        | +$0.1k (median −$1.0k)                       | 6 of 17             |

It barely pays even at 10%. The lab's Consultant costs at least $1,700 a month, and about 10 scans a month bring back the extra $50 each and a tenth of a treatment fee ($900 to $2,500 before prices) each.

Overall, 0.29.0 → `2c6b8d9`:

| Bot                        | Third star    | Profit a month  | Months at a loss | Average wait, days | Success rate  |
| -------------------------- | ------------- | --------------- | ---------------- | ------------------ | ------------- |
| Good player (seeds 1–3)    | 14/15 → 14/15 | $19.1k → $20.0k | 13.3 → 12.4      | 9.0 → 9.1          | 84.3% → 84.8% |
| Good player, High Pines ×9 | 7/9 → 7/9     | $7.7k → $9.1k   | 19.3 → 17.4      | 9.1 → 9.5          | 81.7% → 83.2% |
| Cautious (seeds 1–3)       | 4/15 → 4/15   | $2.3k → $3.0k   | 23.7 → 22.5      | 7.9 → 8.3          | 79.6% → 81.2% |
| Cautious, High Pines ×9    | 0/9 → 0/9     | $1.5k → $2.7k   | 23.6 → 21.6      | 7.3 → 7.8          | 78.7% → 81.4% |
| Junior and a lab (1–3)     | 4/15 → 6/15   | $4.4k → $9.2k   | 23.3 → 17.1      | 15.1 → 14.9        | 78.0% → 83.5% |

Only the games that scan anyone change: for the good player one Exchange seed and four High Pines seeds, for the cautious one High Pines seed. Willow Lane, the Boardwalk and the Orchard play the same games. The stars come as before for both bots, so the game is no easier where a good player hires senior Consultants. Junior Consultants with a lab still make less than half of what senior ones do ($9.2k against $20.0k a month).

**Still open:** a lab is worth building only by a player who hires junior Consultants, and then only just. A player with rank 3 Consultants, or who trains their Consultants up, never sends anyone for a scan.

## 17 October 2026, after midnight: waits

### 20. Nothing said which stage held guests up, or why

**Found:** the advisor said "the line for the Massage Suite is getting long, build another" once six waited at one table, and "nobody staffing it, hire another" whenever a table with two waiting stood empty, even with its Massage Therapist only on a break. The breakdown behind 18 found the slow stage was often not the treatment (at Willow Lane, nearly half of all waiting was for the Consultation Room), and that a long line came as often from staff away from their table as from too few tables. Nothing in the game told those apart.

**Done** (`src/core/sim/bottleneck.ts`): each station keeps how much of the last few days it had a guest called or in hand, and how much it stood staffed, each a share that drifts toward the present (`trackBusy`, called from `updateStations`). The advisor finds the stage of a visit (check-in, consultation, a scan, each discipline's treatment, the shop) with the most waiting for each station, once at least four wait and at least two for each (`bottleneck`), and says why (`bottleneckAdvice` in `src/core/sim/advisor.ts`): stood empty more than 30% of the time, with fewer staff than stations, hire; with enough, they are being called away, so another member of staff or a nearer Staff Room; busy 80% of the time or more, another station and someone to work it; otherwise, more skilled staff or another station. It points at the station with the longest line. "Nobody staffing it" now only comes when nobody in the role is on the payroll. Each station's inspector shows its two shares.

Nothing here changes how the game plays: the playtest bot (which reads none of it) played Willow Lane and the Exchange move for move the same with it and without.

### 19. However long a line grew, as many guests came

**Found:** how often guests arrive depended on reputation, marketing, the season and how many disciplines were on offer, never on how long they would wait. A center with far more guests than it could treat kept getting them, and the only check was guests storming out, which costs reputation and following after the harm is done. Nothing told the player early that a line was too long for its staff.

**Done** (`lineFactor`, `lineArrivals` in `src/core/sim/demand.ts`, `LINE_PUT_OFF` in `src/core/data/rules.ts`): a discipline's line is the guests waiting for its treatment against its practitioners on the payroll (or a Sound Healer's mats). Up to three waiting for each puts nobody off; past that, each one more puts a tenth of new guests off it, up to half. Those put off do not come for another discipline instead: guests arrive less often by as much (`admitGuests` in `src/core/sim/guests.ts`). The Guests tab shows it as a factor like the others ("Line: 8 waiting for 2 Massage Therapists ×0.9"), advises on it before anything else, and says at the top what share of new guests long lines keep away.

Measured as in 18, forking both bots' games at five moments in each of 15 and playing each on for 60 days with and without the rule (150 pairs): most forks came out exactly the same, because both bots build another room when a line grows, so lines rarely pass three a practitioner. Over all of them, guests lost to waiting went from 136 to 131 with the good bot and 153 to 151 with the old, guests healed from 1,495 to 1,502 and 1,357 to 1,378, and the average wait from 9.70 to 9.63 days and 9.41 to 9.31. It is a check for a center well past what its staff can treat, which costs a player who keeps lines in hand nothing.

Whole games with 17 to 19 together against 0.29.1 (seeds 1 to 3, and 1 to 9 at High Pines for the good bot): the good bot earned its third star in 15 games of 18 against 16, with profit up at three centers and down at two by about as much as the seeds alone move it. The old bot did better, with the third star in 9 games of 15 against 4, though with three seeds a center can swing either way.

### 18. Staff left guests waiting to fetch a drink, or to clear another room

**Found:** a probe noted, whenever a treatment table stood empty with guests in its line, what the member of staff last at it was doing (both bots, every center, seeds 1 and 2, the second half of 18 months). They were fetching a drink or a snack 16% of the time with both bots, clearing bad vibes in some other room 8% and 4%, on a break or walking to one 29% and 21%, and training 14% and 29%. Staff went for a drink as soon as they were 60 thirsty or hungry and had nobody in hand, whoever was waiting.

**Done** (`wantedElsewhere` in `src/core/sim/staffing.ts`, `wants` in `src/core/sim/staff-needs.ts`): with guests waiting in their line, staff see to them first. A drink or a snack waits until they are 90 thirsty or hungry (`STAFF_NEED_HOLD`), short of the 100 at which their morale suffers, and bad vibes wait unless they are in their own room. Being taken off a duty or a room, a priority room short of someone, a soul to retrieve and a mishap to ward off still call them away at once. Breaks are left alone: when staff break is the policy's to say, and staff below 15 energy already work slowly and botch treatments.

Measured by forking games: both bots played every center (seeds 1 to 3) to days 240, 360, 480, 600 and 720, and each of those moments was played on for 60 days twice, with the same random numbers, with the rule and without (150 pairs). With it, the average wait fell from 10.8 to 9.9 days with the good bot and from 11.1 to 10.5 with the old, shorter in 53 forks and longer in 17 with the good bot, 42 and 23 with the old. Patience kept rose from 74.7% to 76.9% and from 72.7% to 74.1%, guests lost to waiting fell from 214 to 182 and from 202 to 182, and guests healed rose 5%. Every center did better with both bots. Whole games (seeds 1 to 3) move by more than the seeds alone do, and in both directions (the good bot's profit at High Pines $7.6k to $14.1k a month, the old bot's at the Exchange $4.5k to $1.7k), with the stars at much the same months, so the forks are the measure to go by.

### 17. Waits read in days, when a treatment itself takes days

**Found:** the wait goals and the No Waiting Around award counted the average wait in days ("Keep the average wait under 2.5 days for a month"), and the Stats menu charted it the same way. But a day is six seconds and one treatment takes one and a half to three days, so a center running well averaged 6 to 14 days, and the number meant nothing a player could see. What the player does see is each guest's patience bar. Patience as guests left was no good either: each stage seen to (check-in, consultation, treatment) gives back 30, so most guests leave with nearly all of it.

**Done:** each guest keeps the lowest their patience falls during their visit (`lowest` in `src/core/state/types.ts`, updated in `src/core/sim/guests.ts`), and each month sums it (`patienceTotal`, counted in `countVisit`), 0 for anyone who storms out. The wait goals became "Guests keep N% of their patience through the wait, on average, for a month" (`{ kind: 'patience' }`, judged in `src/core/sim/goals.ts`), the Stats chart became **Patience kept**, and the award is judged on it (`PATIENCE_BAR` in `src/core/sim/awards.ts`). A month from an older save, or with nobody leaving, shows a dash rather than 0%, and a month already under way when a save is upgraded goes without it, rather than count only some of its guests. A saved choice of the old wait chart shows the new one.

To keep each goal as hard as it was, both bots played every center for four years (seeds 1 to 3) on 0.29.1 with patience kept recorded. Month by month it follows the old average wait closely (correlation −0.88 to −0.97). Months under 3 days pass as often as months keeping 91%, and under 2.5 days as often as 92% to 94%; the first month each game met them came out the same at 87% to 89%, and at 93%. So the Exchange's first-star goal is 90%, and the Boardwalk's and High Pines' second-star goals are 93%. Neither bot ever won the old award in those games (2 days on average over a year at most, 0.2 less each year); on patience kept the best year came to 96%, most to 55% to 85%. Its bar is now 90%, a point more each year, at most 95%: hard, but winnable.

Measured with both bots from clean copies of 0.29.1 and of 0.29.1 with this change (seeds 1 to 3, and 1 to 9 at High Pines for the good bot): Willow Lane and the Orchard Estate, which have no wait goal, play move for move the same. At the other three the stars come within about a month of 0.29.1: the good bot's second star at High Pines in 8 games of 9 both ways, its third in 6 against 7, and the old bot's stars the same.

## 17 October 2026: staff who leave a class or a session

Measured with the walkout probe (3, below): six seeds of 70 days, Reception, a Consultation Room, a Massage Suite, a Qi Gong Studio with three Practice Spots, a Staff Room and an Instructor, reputation held at 70, counting the class-goers who went home disappointed by why. Since 70 days holds only one Instructor's break a seed, the same probe also ran over 24 seeds of 140 days, with the helpers' Staff Room (about a day's walk from the studio) and with one beside the studio.

### 16. The Sound Healer walked off mid-session

**Found:** the Singing Bowls never count as seeing anyone, so a healer left mid-session for a break, a drink or any other reason, and everyone lying on the mats went back to the line, part-treated. In the same probe with a Sound Bath Studio and a Sound Healer instead of the classes (every guest needing sound healing), the healer walked off 5 times in six seeds of 70 days, sending 6 guests back to the line, and 41 times in 24 seeds of 140 days, every time for a break, sending 57 back. Counting a session playing as someone in hand, as for the Instructor (1, below), held the healer to the end, but guests already on their way to a mat joined the session as it played and kept it going: the healer took on average 2 days to get away and up to 8.6.

**Done:** a sound bath playing counts as someone in hand (`inHand` in `src/core/sim/staffing.ts`), so the healer stays to the end of it. Once they want to be off for any reason (`wantsAway`), the mats call nobody more, anyone still on the way to a mat goes back to the line, and a session still waiting for its mats to fill does not start (`updateSession` in `src/core/sim/sessions.ts`), so the healer plays out only the guests already lying down. Walk-offs went to none in both (5 and 41 before), with as many guests treated (144 against 145, and 1,240 against 1,247). A healer now takes on average 1.4 days to get away and at most 4.5, a tired healer's one treatment; before, 0.1 days.

### 15. An Instructor's break cost a class

**Found:** 15 of the 30 disappointed class-goers had an Instructor on a break, and every break skipped a class day. A worn-out Instructor's break is not just the day and a half on the sofa: with the walk to the Staff Room and back it took 3.7 days in the probe, and 2.4 with the Staff Room next to the studio, longer than the two or three days between Monday's, Wednesday's and Friday's classes. Staff break as soon as their energy falls below the policy's level, which for an Instructor was as often the day after a class (a Saturday or a Thursday) as any other, so the break ran through the next class day. Holding off a break on a class day alone changed nothing: no break in the probe started on one.

Also, an Instructor below the policy's level stopped calling class-goers to the Practice Spots (the check that lets a tired Therapist finish their guest and go), so one held back from a break would stand at the mat with nobody to teach.

**Done** (`restDue` and `backForClass` in `src/core/sim/classes.ts`):

- an Instructor goes for a break only when the next class is at least two days off (`REST_GAP`: on the usual timetable, once Friday's is over), and then a little early, below 15 more energy than the policy's level (`REST_AHEAD`), so they are not worn down before the next chance. Until then they hold off, a class day's class included, unless their energy falls below 10 (`BREAK_EXHAUSTED`);
- a resting Instructor gets up in time to walk back for the next class, taking the walk back to be as long as the walk there was, with half a day to spare to call the class-goers to their spots (`REST_RETURN`), once rested to where they would have rested early. If that moment has passed, they rest in full;
- the Practice Spots call class-goers whenever the Instructor is not going for a break by these rules;
- the message for a class missed to a break says a Staff Room nearer the studio gets the Instructor back sooner, rather than a better one.

Disappointed class-goers in the probe went from 30 of 495 (6.1%: 15 on a break, 15 full) to 18 of 493 (3.7%: none on a break, 18 full). Over 24 seeds of 140 days, with the helpers' Staff Room, 6.9% to 5.9% (on a break 172 to 11, full 83 to 230) and class days skipped 144 to 132; with the Staff Room beside the studio, 4.6% to 1.3%, and class days skipped 114 to 66. Resting after any class rather than only before a two-day gap did worse (7.9% and 4.3%), and so did resting only 5 energy early (6.3% and 3.0%).

**Still open:** with the Staff Room a day's walk from the studio, most breaks still cost a class, as the walk there and back takes most of the weekend. Its class-goers now mostly wait for the next class and find it full, which is why "full" rose.

## 16 October 2026, after midnight: the release, as a good player finds it

### 14. For a good player, this branch is about as hard as 0.28.6

**Found:** the comparison in 11 used the old, cautious bot, and found this branch $2k to $4k a month more generous than the release. The new bot (13) plays like a good player, so it was run on both: 0.28.6 (its source with the new bot copied in) and this branch at `9c5d422`, from clean copies, seeds 1 to 3, four years a game, averaged from the second year on:

| Center             | Third star | Profit a month  | Months at a loss | Average wait, days |
| ------------------ | ---------- | --------------- | ---------------- | ------------------ |
| Willow Lane        | 3/3 → 3/3  | $11.3k → $16.6k | 13.0 → 9.3       | 14.1 → 12.3        |
| The Exchange       | 3/3 → 3/3  | $19.7k → $17.6k | 8.0 → 10.3       | 7.1 → 7.5          |
| The Boardwalk      | 2/3 → 3/3  | $3.5k → $5.0k   | 20.7 → 18.0      | 9.5 → 8.3          |
| High Pines         | 2/3 → 3/3  | $11.1k → $6.4k  | 16.7 → 19.0      | 9.3 → 9.3          |
| The Orchard Estate | 3/3 → 3/3  | $31.2k → $31.7k | 7.7 → 9.3        | 8.1 → 10.1         |

Profit goes up at two centers and down at two, by about as much as the seeds alone move it, and the stars come at much the same months. For a good player the branch is no easier than the release. What the old bot found was that the branch is kinder to a cautious player: demand that follows what the center can treat, and the arrivals boost, help most a player who does not chase prices and house calls.

**Done:** nothing; the tuning stays as in 11 and 12.

**Still open:** a good player finds both the release and the branch easy: the third star in 13 to 15 games of 15, at $5k to $32k a month. That comes from prices and house calls (13), which are as they were in 0.28.6, so it is a question for a later release, not this one.

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

**Done:** a class under way counts as someone in hand (`inHand` in `src/core/sim/staffing.ts`), so the Instructor stays to the end and goes after. The Sound Bath's healer could still walk off mid-session, since a session plays on as long as guests keep lying down; they now play out the session and call nobody more to it (16, above).

### 2. Practice Spots had no limit

**Found:** each Practice Spot added to a studio's weekly draw, without end, so a studio full of spots drew class-goers without limit.

**Done:** an Instructor leads a class of up to 6 as a Trainee, then 8, 10 and 13, and 16 as an Expert (`CLASS_PLACES`). Spots past that stand empty and draw nobody. The studio's inspector says so, and a tip says to promote them the first time it matters.

### 3. Class-goers went home without a class, with the Instructor there

**Found:** about 15% of class-goers (74 of about 480) went home disappointed, three quarters of them Friday's, and about 1 class day in 6 was skipped. A class ran 10 seconds, close to two days, and nearly three with a tired Instructor, so on the old Monday, Wednesday and Friday timetable one class often ran through the next class day, which then had no class. Class-goers give up three days after their class day, as the day begins, so Friday's gave up on Monday morning just before Monday's class. The game never said why.

**Done:** a class runs 6 seconds, about a day, so it is over well before the next class day; and when class-goers go home without a class the player is told why, once for each class: no Instructor, the Instructor on a break or away from the mat, the class before still going, the day taken off the timetable, or they got there after it (`noteMissedClasses` and `giveUp` in `src/core/sim/classes.ts`). Measured over six seeds of 70 days, with the studio's three Practice Spots and reputation held at 70, about 6% went home disappointed afterwards (30 of 495) and about 1 class day in 17 was skipped.

A new studio briefly held classes on Monday and Thursday instead, to space them out, but the shorter class alone is enough: the same probe on Monday and Thursday had 8% disappointed (27 of 342) and 1 class day in 13 skipped, and fewer class-goers in all (315 against 465). Changing the default would also have quietly moved every older save's studio to two classes a week. A new studio still holds classes on Monday, Wednesday and Friday.

**Still open:** half of the 6% left were Instructors on a break that took up the whole class day, and half were left waiting because every spot was taken (8, above). Instructors now time their breaks around the classes (15, above), which leaves 3.7% disappointed, nearly all of them because the class was full.

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
