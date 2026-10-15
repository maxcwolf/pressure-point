# Announcer lines

What the announcer says over the speakers, and which lines still need recording. A recording plays only when its text matches the banner exactly, punctuation included, so record each line word for word. Put each file in `src/sounds/announcer/` as a kebab-case `.m4a`, run it through the PA speaker effect (`yarn announcer`), and add it to `VOICE_LINES` in `src/voice.ts`.

## Recorded

The twelve filler lines in `ANNOUNCEMENTS` (`src/core/data/text.ts`).

## To record

Opening day (`src/core/sim/progress.ts`)

1. The healing center is now open. Please form an orderly line of ailments.

Staff wanted (`contextAnnouncement` in `src/core/sim/advisor.ts`)

2. Caretaker needed. The corridors are getting crunchy.
3. Receptionist needed at the Reception Desk.
4. Receptionist needed at the Shop Counter.
5. Wellness Consultant needed at the Consultation Room.
6. Wellness Consultant needed at the Posture Lab.
7. Massage Therapist needed at the Massage Suite.
8. Acupuncturist needed at the Acupuncture Clinic.
9. Reiki Practitioner needed at the Reiki Studio.

Seasons, at Saltmarsh (`SEASON_NEWS` in `src/core/sim/twists.ts`)

10. Winter is here. The promenade is empty, so watch the budget until spring.
11. Spring! The first day-trippers are back in town.
12. Summer at last, and the town is packed. Expect a crowd.
13. Autumn. The visitors are heading home.

Snow, at High Pines (`SNOW_NEWS` in `src/core/sim/twists.ts`)

14. Snowed in! The road up the mountain is closed, so nobody new can get here for a day or two.
15. The snowplow has been through, and the road is open again.

Emergencies (`EMERGENCY_CAUSES` in `src/core/data/text.ts`)

16. Emergency incoming! A yoga retreat attempted a group pose and it went badly.
17. Emergency incoming! The city fun run turned out to be neither.
18. Emergency incoming! An all-hands meeting ran three hours over with no chairs.
19. Emergency incoming! A flash mob forgot to warm up.
20. Emergency incoming! The local choir held one note for far too long.
21. Emergency incoming! A furniture store ran a build-it-yourself weekend.

Stress outbreaks (`OUTBREAK_CAUSES` in `src/core/data/stakes.ts`)

22. Stress outbreak! The office block across the road has just had its quarterly review.
23. Stress outbreak! Exam results are out at the college.
24. Stress outbreak! A wedding party has arrived, and the seating plan did not go well.
25. Stress outbreak! The phone network went down for an hour.
26. Stress outbreak! A yoga retreat let out early and nobody is speaking to each other.

## Perhaps

Visits arrive as a message today, not over the speakers. If they are announced too, lines such as:

- A VIP will be visiting in five days. Look busy.
- The health inspector is on the way. Hide the sage.

When a line is added or changed in the code, update this list.
