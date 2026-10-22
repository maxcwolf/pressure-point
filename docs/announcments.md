# Announcements

Every line the PA announcer can say, recorded or not, in one place. A recording plays only when its text matches the banner exactly, punctuation included, so record each line word for word. Put the clean recording in `brand/announcer/` as a kebab-case `.mp3`, run `yarn announcer` (macOS) to add the PA speaker effect and write the `.m4a` to `src/sounds/announcer/`, and add it to `VOICE_LINES` in `src/voice.ts`. See [development.md](development.md).

When a line is added or changed in the code, update this list.

Key: ✅ recorded, ⬜ not recorded yet.

43 recorded, 35 still to record.

## Filler lines, now and then (`ANNOUNCEMENTS` in `src/core/data/text.ts`)

- ✅ Guests are reminded that the knots are not contagious.
- ✅ Would the owner of a red aura please move it from the fire exit.
- ✅ Please do not tip the therapists. They fall over.
- ✅ Staff members are reminded that whale song is not a valid doctor’s note.
- ✅ Guests are asked not to hum along with the fountain.
- ✅ The herbal tea is herbal. That is all we are prepared to say.
- ✅ Please keep your chakras aligned and your belongings with you.
- ✅ Guests leaving face-shaped marks on the towels will be charged.
- ✅ A reminder that relaxation is mandatory.
- ✅ The lost and found now holds one flip-flop and a sense of urgency.
- ✅ Please breathe in. Further instructions will follow.
- ✅ Guests are reminded that clothing is mandatory in the hallways.
- ✅ Attention male visitors, please do not completely remove your pants while using the urinal.
- ✅ Welcome, seekers. We remind you that enlightenment is a journey, and our gift shop accepts all major credit cards.
- ✅ A polite reminder: Mercury is no longer in retrograde, so you have absolutely no excuse for your behavior.
- ✅ Reminder: Screaming into the void is permitted only between the hours of two and four PM.
- ✅ Visitors are reminded that sighing heavily does not count as breathwork.

## Opening day (`src/core/sim/progress.ts`)

- ✅ The healing center is now open. Please form an orderly line in order of your aura’s color code.
- ✅ The healing center is now open. Praise Rang!
- ✅ The healing center is now open. Please align your chakras, empty your wallets, and form an orderly line.
- ✅ The healing center is now open. Management requests that you leave your negative energy... and your lawyer, at the door.

## Staff wanted (`contextAnnouncement` in `src/core/sim/advisor.ts`)

- ✅ Caretaker needed. The corridors are getting gross.
- ✅ Receptionist needed at the Reception Desk.
- ⬜ Receptionist needed at the Shop Counter.
- ✅ Wellness Consultant needed at the Consultation Room.
- ✅ Wellness Consultant needed at the Posture Lab.
- ✅ Massage Therapist needed at the Massage Suite.
- ✅ Acupuncturist needed at the Acupuncture Clinic.
- ✅ Reiki Practitioner needed at the Reiki Studio.
- ✅ Qi Gong Instructor needed at the Qi Gong Studio.
- ⬜ Sound Healer needed at the Sound Bath Studio.
- ⬜ Shaman needed at the Ceremony Lodge.

## A Qi Gong class (`CLASS_LINES` in `src/core/sim/classes.ts`, taking turns, at most once every two weeks)

- ✅ Qi Gong is starting in the studio. Come cultivate your inner energy, because your outer energy is frankly exhausting.
- ✅ Qi Gong is now starting. If you cannot feel the invisible ball of energy between your hands, please simulate one for the comfort of others.

## The first Sweat Lodge (`SWEAT_LODGE_OPEN` in `src/core/sim/ceremonies.ts`)

- ✅ The sweat shop... I mean, sweat lodge, is now open.

## The first of each machine room (`opening` on each room in `src/core/data/rooms.ts`)

- ⬜ The Kneadmaster 9000 is now open. Please keep your hands inside the chair. It has plenty of its own.
- ⬜ The Pin Press is now open. Please press firmly, and only once.
- ⬜ The Aura Wash is now open. Please remove any loose chakras before entering.
- ⬜ The Great Alphorn is now open. You will hear it. You will hear it again a moment later.
- ⬜ The Press House is now open. Bring us your bitterness. We are told it has a lovely finish.
- ⬜ The Carousel of Rebirth is now open. Please remain seated until you are yourself.

## Seasons, at The Boardwalk (`SEASON_NEWS` in `src/core/sim/twists.ts`)

- ⬜ Winter is here. The promenade is empty, so watch the budget until spring.
- ⬜ Spring! The first day-trippers are back in town.
- ⬜ Summer at last, and the town is packed. Expect a crowd.
- ⬜ Autumn. The visitors are heading home.

## Snow, at High Pines (`SNOW_NEWS` in `src/core/sim/twists.ts`)

- ⬜ Snowed in! The road up the mountain is closed, so nobody new can get here for a day or two.
- ⬜ The snowplow has been through, and the road is open again.

## Emergencies (`EMERGENCY_CAUSES` in `src/core/data/text.ts`)

- ✅ Emergency incoming! A yoga retreat attempted a group pose and it went badly.
- ✅ Emergency incoming! The city fun run turned out to be an unfun run.
- ✅ Emergency incoming! An all-hands meeting ran three hours over with no chairs.
- ⬜ Emergency incoming! A flash mob forgot to warm up.
- ⬜ Emergency incoming! The local choir held one note for far too long.
- ✅ Emergency incoming! A furniture store ran a build-it-yourself weekend.

## Stress outbreaks (`OUTBREAK_CAUSES` in `src/core/data/stakes.ts`)

- ⬜ Stress outbreak! The office block across the road has just had its quarterly review.
- ⬜ Stress outbreak! Exam results are out at the college.
- ⬜ Stress outbreak! A wedding party has arrived, and the seating plan did not go well.
- ⬜ Stress outbreak! The phone network went down for an hour.
- ⬜ Stress outbreak! A yoga retreat let out early and nobody is speaking to each other.

## A really bad trip (`RUNAWAY_LINES` in `src/core/sim/runaways.ts`, one or the other by the guest)

- ⬜ Would the guest running through the lobby please note that the ceiling is not, in fact, melting.
- ⬜ A reminder that the walls are load-bearing and cannot be reasoned with.

## Visits, as a visitor writes ahead (`VISIT_NEWS` in `src/core/data/visits.ts`)

- ✅ A VIP will be visiting in five days. Look busy.
- ✅ The health inspector is on the way. Hide the sage.

## Standing, as the center rises a grade (`updateStanding` in `src/core/sim/standing.ts`)

- ⬜ We are now a Wellness Studio. Thank you for bringing us your knots.
- ⬜ We are now a Wellness Center. Thank you for bringing us your knots.
- ⬜ We are now a Healing Center. Thank you for bringing us your knots.
- ⬜ We are now a Healing Institute. Thank you for bringing us your knots.

## Mishaps, as each is announced, starts and ends (`MISHAPS` in `src/core/data/mishaps.ts`)

- ✅ The power company will be working on the lines this week. Expect a power cut.
- ✅ The power is out. Anything with a plug is now a very expensive ornament.
- ⬜ The power is back. Please stop meditating by candlelight.
- ✅ A storm is coming in off the sea later this week. Batten down the hatches.
- ✅ The storm has arrived. Please keep away from the windows... and Brent.
- ✅ The storm has passed. The seagulls are back, and so are the guests.
- ⬜ A big freeze is forecast later this week. The pipes are nervous.
- ⬜ The pipes have frozen. Please hold on, in every sense.
- ⬜ The pipes have thawed. Normal flushing is resumed.
- ⬜ It is harvest week in the orchards, and the wasps have noticed.
- ⬜ Wasps have found the snacks. Please walk calmly and do not wave your arms.
- ⬜ The wasps have gone back to the orchards.
