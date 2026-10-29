# Review of the fun ideas

Written 27 October 2026, against the seven design docs and the ranked list in this folder, the game's own PA lines (`docs/dev/announcements.md`), ailment blurbs (`src/core/data/conditions.ts`) and review lines (`src/core/data/feelings.ts`). It is a critique with tweaks, not a plan.

## The short version

The gap analysis is good and the code checking is careful. The ideas built on it mostly answer "the game needs more fun" with more content: more cards, more lines, more named people, more modifiers. Only two of the seven give the player a new thing to do or a new thing to watch. Three of the seven answer the gap "the jokes live in text nobody reads" with more text. The second-biggest gap (every center opens the same way) and the prices gap get nothing in the top seven. Every doc is sized M, and every doc wants a save bump, a bot rerun, new models and a sheaf of PA lines to record, so the seven together are a year of solo work and about 60 recordings on top of the 38 still owed.

The jokes are flat for a few repeatable reasons: they are long, they explain themselves, they lean on one rhythm and one trick, they borrow the office-satire vein instead of the wellness one, and they overuse Brent. The game's own best lines are short, institutional and literal. The docs' best lines are the ones that follow that pattern: the headline bank and the shop product names.

## What holds up

- The gap table and its evidence. Keep it as the yardstick.
- The "Where it plugs in" sections. They are accurate and will save real time.
- **Open the third star's techniques and items at the second star.** One function, one rerun, clearly right. Do it regardless.
- **Snowed In, With Company** (nobody can leave until the plow). The one occasion with a genuinely new rule that fits its center.
- **The Monthly Reading.** A communication feature in costume: the forecast is the game's fairness rule, and the tarot that tells the truth is a good joke. It is buried as phase 2 of the astrology doc.
- **The Clipboard Man** (spot the spy) and **the mascot chase.** The two Kyle stunts with a real verb, buried in phases 3 and 4.
- **Keepsakes** (a bench with a regular's name on it). Visible, cheap, the kind of thing players screenshot.
- **The headline bank.** FIRE BRIGADE ARRIVES, FINDS FIRE OUT, LEAVES SLIGHTLY DISAPPOINTED. {STAFF} QUITS, CITING "EVERYTHING". INSPECTOR FINDS NOTHING, CHECKS AGAIN, STILL NOTHING. The right form: short, declarative, filled with real names.
- **Shop product names.** Thieves' Mist (Ethically Sourced Thieves). Peppermint, But Louder. Bodhi's Breath (canned). The Thunderstone Method, Vol. 9: Letting Go of Volumes 1 to 8. Nouns, literal, no explanation.
- **Colonel the Chicken** and **Kyle promoted whether he wins or loses.** Good single jokes.
- Cheap ideas buried below the top seven that deserve to be above half of it: the Manifestation Board, the inspector with a memory, In the Zone, The Hand, Takeover openings.

## Where the ideas go wrong, as patterns

1. **Content where a verb was needed.** Ask of each idea: what does the player do, or see on the floor, that they could not before? Loose Spirits: chase a thing (but it is the runner again). Grand Occasions: prepare for a date (good). Offers: read more buttons. Kyle: click a man out. Guestbook: read reviews. Rag: read a page. Under the Stars: read a hover and lose equipment a little faster. Two of seven.
2. **Fighting the text gap with text.** Gap 5 says players do not read the jokes. The Guestbook puts stories in review lines, the Rag prints a two-page paper, Offers puts the jokes on card buttons. Each doc's own risk list says "players may not read it".
3. **Invisible modifiers presented as events.** Mercury is wear ×1.25, certainty −0.10 and half blame on two outcomes. Full moon is +5 to reiki. Nobody will feel any of it. The game's strengths list says the comedy comes out of the systems on the floor: a runner, a puddle, a flood. A multiplier is not on the floor.
4. **Five of everything.** Five bespoke occasions with five new rules, seven escapees with twenty-one mischiefs, eight cards of which three are size L each, twelve regulars' stories, forty headlines plus letters plus columns plus corrections plus classifieds plus pictures. Each doc should prove its shape with one and stop.
5. **Incentives pointing the wrong way.** An ignored escapee pays a fee (the lazy answer is rewarded; the doc calls this a money pump and keeps it). A regular whose story ends well leaves and takes their 20% tip with them (finishing well is punished; the doc calls this a risk and keeps it). "Refer to ZenMart" pays cash now for nothing (the doc expects it to become the default and keeps it).
6. **Booking your own exam.** Grand Occasions lets the player pick the date with 30 days' notice and mutes every other pressure for the fortnight. A finale you take only when ready, in a building the game has gone quiet around, is not a test. The fairness grammar is warn, give counterplay, remove the cliff. It is not remove the pressure.
7. **A chore dressed as a character.** Kyle is "a man walks in, click to escort him out", 30 to 40 times a center, with the pressure accounting rearranged so nothing changes. The doc's own risk says it becomes a chore. It will, and faster for a player who pauses two thirds of the time.
8. **Gaps 2, 8 and 9 go unanswered.** Every center opens the same way (gap 2) gets only Takeover openings at rank 15. Prices (gap 8) gets Seekers and Skeptics at rank 8. The mid-center squeeze (gap 9) gets Pilgrimages. The top seven cluster on gaps 1, 3, 4 and 5.
9. **Ranking by convergence and uniqueness.** "Six agents reached astrology" is why it is ranked second. Six copies of the same model converging measures the most obvious idea, not the best. Uniqueness weighted equal to fun is why The Hand (unique 2) sits at 13 and Under the Stars (unique 5) at 2. Rank by fun per week of work.
10. **Pre-building the whole feature.** Each doc carries state fields, save versions, bot flags, analytics events, four phases and nine decisions before anyone has said yes. The design doc should come after the pick. A pitch is a page: the moment, the verb, the joke, the one rule, the cost.
11. **Register drift.** The game's text is mostly American (restroom, pants, mall, vending). The docs lean hard British: hen party (7 mentions), regatta (10), fortnight, biscuits, the council, Head Office, a Dowager Duchess. "Head Office" also invents a fiction: the player owns the center. The vicar and the high street already exist, so keep those.

## The seven, one by one

### 1. Grand Occasions

**Problem.** Five set pieces, five new sim rules, five bot behaviors, a medal system with three weighted lines, floors, full marks, replays, purses, trophies, floor finishes and Encores. Four of the five are an emergency in costume: runners are a group with Knotted Up, the merger is rush hour all week, the regatta is summer plus a group, the Duchess is a VIP with a schedule. Scoring "7 of 12 healed: 45 marks" is a spreadsheet, not a feeling. The player books the date and the game mutes itself around it.

**Tweak.** Keep phase 1 (the unlock). Build Snowed In alone and see whether the shape works. The town fixes the date at the second star, 60 days out, no moving it; the readiness checks are the fairness. Nothing is muted: the finale is when the mishap and the emergency land on top. One judged line, not three ("everyone's patience inside, averaged"), one threshold for the star, and no medals, purses or replays. If Snowed In lands, the other centers get a variant of the _same_ shape (cut off and overfull) rather than four new rule sets.

### 2. Under the Stars

**Problem.** Three invisible multipliers and a halved penalty make up the headline event. The eclipse pause and rush is the one visible thing. The Reading is the one useful thing. Both are in later phases. Star-sign lines are weak. Deborah and Brent as sandbox readers are more Brent and an invented Head Office. The reversed audio line is a joke for the doc's reader, not the player.

**Tweak.** Lead with the Reading, as its own small feature: on the 1st, three cards that name what the timers already hold. Drop Mercury's wear, doubt and blame numbers. If Mercury stays, it must be visible on the floor, and the machines are where to put it: the Kneadmaster runs backwards, the Carousel turns the other way, the Posture Scanner reads the wrong guest, the Pin Press stamps the wrong condition. One Mercury behavior per machine, each a thing to watch, each with the Caretaker as counterplay. Keep the eclipse. Cut the sandbox readers and the reversed line.

### 3. Loose Spirits

**Problem.** It is the runner with a different model: same pill, same Send, same dispatch order, same three-day refund. The mischief costs (0.25 reputation a stop, 5 patience nearby) are too small to feel, so the Send decision is empty. Ignoring it pays a fee. Seven kinds, each with three mischiefs, three items, achievements and a chicken is not M. The chakra hunt is whack-a-mole. The Knot is picked first for coverage, and it is the least funny of the set.

**Tweak.** Give it a verb that is not "chase". An escapee changes the place it is in: the knot ties off a doorway and guests path around it until a Caretaker unties it; the Earworm perches in the waiting area and everyone within two tiles hums, which is noise, answered by benches moved, a Soundproof Panel or a Sound Healer; the chicken roosts on a table, which is out until shooed. Each is answered by a room or a staff type the player already has. Ignored, it settles into a member of staff, not a guest: the Massage Therapist now has Knotted Up and works slower until a colleague treats them. That is a cost with counterplay, and the healer needing healing is the better joke. Ship one escapee. For Willow Lane, the Tension Headband snapping off and pinging about the corridor is funnier to watch than a rolling knot.

### 4. Offers With a Catch

**Problem.** Phase 1 (options on the three existing offers, measured by the bot) is right. The deck is where it balloons: Unplugged, Guru Weekend and Essence & Abundance are each a feature, and five of the eight cards are the same shape (an outside party arrives with a crowd and a catch). Many "options" are big versus small (all seven guests or four), which is a slider, not a dilemma. The referral is cash for nothing.

**Tweak.** Build phase 1 and the two cards that reuse existing systems. Make every option trade a different currency: one costs money, one costs reputation, one costs a member of staff's time or morale, one feeds ZenMart. Cut the referral or make it cost reputation as well as standing. Of the big three, keep only Essence & Abundance, because it is the one card about staff and the one that satirizes the real wellness industry, and strip its spreading rule to "one recruit per break with Kayleigh, folds on a stated day".

### 5. Kyle from ZenMart

**Problem.** The memos are the real fix (nothing about ZenMart is warned of today). The rest is an escort chore with the pressure re-split so the player feels no difference. Kyle is written as a LinkedIn man: per my last email, take this offline, circle back. The office vein is the tiredest satire available and it is also used in Unplugged, Merger Week, After Brent and the Exchange Ledger.

**Tweak.** Ship the memos and the Standing-tab countdown alone, as a communication fix. Drop "See him out" as a routine verb; let Kyle walk in, do his thing and leave on his own, so his visits are something to watch, not something to click. Start the stunt deck with the spy and the mascot chase, because those have verbs. Rewrite Kyle as a wellness man, not an office man: relentlessly positive, calls competition "abundance with two doors", sends light, hands out crystals, thanks you for your energy. He is funnier against the player's own center that way, and the satire lands on the industry.

### 6. The Guestbook

**Problem.** Twelve stories told in the one channel the gap analysis says nobody reads. Most stories happen at home (a sourdough named Kevin, a standing desk, job-hunting for energies) and are sitcom B-plots, two of them dated memes. Only the book club and the ex happen in the building. Finishing a story well removes a devoted regular.

**Tweak.** A beat must be visible in the building, not a line in a review: Gary jogs on the spot in line, then arrives in a foil blanket, then with a medal; Percy hands a postcard to Reception; Mabel brings the club. Cut to four stories with a visible beat per visit and a keepsake. The regular stays after the keepsake, with a settled greeting. Phase 2's couples, breakups and engagements are a soap sim; shelve them.

### 7. The Local Rag

**Problem.** A two-page monthly paper with letters, columns, corrections, classifieds, Inside Sources and a Year in Pictures, which changes nothing and the doc expects many players to dismiss unread.

**Tweak.** The headline is the whole product. One masthead, one headline with real names, one "Also" line, printed in the payday dialog's header, where every player already looks on payday. No dialog, no pages, no letters. Ship that and see whether anyone screenshots it before building anything else.

## Why the jokes are flat

Counted against the game's own lines, which average 8 to 16 words and speak with institutional authority about absurd things ("Please do not tip the therapists. They fall over." "The herbal tea is herbal. That is all we are prepared to say." "A reminder that relaxation is mandatory.").

1. **They explain themselves.** The joke lands, then a second sentence lands it again. "Nobody is going to chase you. Somebody is going to chase you." "Please do not hum along. You are humming along." "Looking forward to some healthy competition. Mostly healthy for us." "Still thinking about Willow Lane. Not in a weird way." "They promise to be quiet. They are lying." The statement-then-undercut shape appears about forty times across the seven docs. Once a doc, it is a joke; forty times, it is a tic.
2. **One rhythm.** Short. Short. Turn. Nearly every review line and story beat has it: "New shoes. Same hamstring." "Started a sourdough. Named it Kevin. Kevin is thriving. I'm not." The game's own reviews vary: "I went in for a wee and came out with a tide table." is one sentence with the joke on the last word.
3. **The announcer narrates instead of announcing.** "We are told it is like floating in infinity, in a cupboard." "They are lying." "She is having a day." The house announcer never comments. It issues instructions and policy. The gap between its total authority and what it is saying is the joke.
4. **Office satire in a wellness game.** Circle back, per my last email, synergy, offline, quick sync, KPI, Reply-All Reflex, Synergy Burn, Quarterly Dread. It is in five docs. The Exchange is the one center where it belongs, as its twist. Everywhere else the target is wellness nonsense, which the game already does best: "enlightenment is a journey, and our gift shop accepts all major credit cards."
5. **Brent is explained.** The whole joke of Possessed by Brent is that nobody knows who Brent is. The game mentions him in four lines. The docs mention him 31 times, give him a spirit, a backstory (ZenMart's first wellness manager, lost on a 2009 retreat), a tarot deck, a sitcom aftermath and a storyline. Explaining him kills him. Cut every new Brent.
6. **Borrowed set pieces.** The banana runner, Colonel Mustard, a sourdough named Kevin, #notsponsored (sponsored), the oils boss babe, the Dowager Duchess, "Documentary Pending", the hen party in matching costumes. If the reader has seen the joke on the internet, cut it.
7. **Too long to record.** PA lines of 20 to 30 words over gameplay. The recorded ones are half that. Two Point's reviewers complained of tannoy lines wearing thin; the answer is fewer, shorter lines per trigger, not nine per feature.
8. **Observations instead of things.** The game's best jokes are literalized nouns you could draw: a Cold Shoulder frozen solid, a singing bowl used for salad, a tide table from the restroom. The docs' best lines are the same kind (the shop products, "Will respond on return. Will not return.", "LOST: one aura, red, last seen in the fire exit"). Most of the rest are observations.

Before and after, to show the bar:

| Doc             | As written                                                                                                                          | Tighter, in the house voice                                                                                    |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Loose Spirits   | "Would the loose chicken spirit please return to the Ceremony Lodge. Nobody is going to chase you. Somebody is going to chase you." | "A chicken has come out of a guest in the Ceremony Lodge. Please do not encourage it."                         |
| Loose Spirits   | "An earworm is loose in the building. Please do not hum along. You are humming along."                                              | "Guests humming in the waiting area will be charged for a session."                                            |
| Under the Stars | "Mercury goes into retrograde in two weeks. Please back up your files, and your feelings."                                          | "Mercury enters retrograde on the tenth. Complaints after that date will be referred to Mercury."              |
| Under the Stars | "Please do not look directly at the eclipse. Please do not look directly at the receptionist either. She is having a day."          | "Please do not look directly at the eclipse. Guests who need something to look at may look at the gift shop."  |
| Kyle            | "Memo from Kyle: Per my last email, our sale starts in 5 days. 25% off everything, enlightenment included."                         | "A note from Kyle: Sending light ahead of our sale on the 12th. Competition is just abundance with two doors." |
| Offers          | "A film crew would like to use the building. They promise to be quiet. They are lying."                                             | Cut. The card already says it.                                                                                 |

Lines in the docs that already meet the bar and should be kept as written: "This month's reading is now available at reception. It is binding." "Bodhi will be signing copies of his book, 'Silence', in the lobby. Bodhi will not be speaking." "Would the gentleman from ZenMart please stop handing out leaflets in the waiting area. Thank you, Kyle." "I have had a hundred birthdays and this was certainly one of them." "Accredited by the Board of Certifying Accreditors (Accredited)."

## Rules for the next pass

To give the session, for both the ideas and the writing.

**Ideas.**

1. Every idea names the verb or the thing on the floor it adds. If the honest answer is "something to read", it is a quick win, not a top-seven idea.
2. One new sim rule per idea. Prove the shape with one instance before writing four more.
3. Pressure goes on the floor where it can be seen, never into a multiplier.
4. Incentives point the right way: never pay the player for ignoring the thing, never punish them for finishing well, never offer cash for nothing.
5. The player does not book their own exam, and the game does not go quiet for the finale.
6. Reuse the cast before inventing one: the inspector, the five VIPs, the vicar, Rang, Amanda Jablonsky, ZenMart. Every new named person is a model, a voice and a save field.
7. Rank by fun per week of work. Convergence between agents counts for nothing. Uniqueness is a tiebreaker.
8. Answer gaps 2, 8 and 9 before adding a fifth idea to gap 5.
9. A pitch is a page: the moment, the verb, the joke, the one rule, the cost. The state fields, save version, bot flags and phases come after the pick.
10. No Brent.

**Writing.**

1. PA lines are 8 to 14 words. Cut the second sentence if it restates the first.
2. The statement-then-undercut shape ("Nobody will chase you. Somebody will chase you.") is allowed once a doc.
3. The announcer issues instructions and policy. It never comments, hedges or narrates.
4. The satire target is wellness. Office-speak only at The Exchange.
5. Prefer a thing to an observation. If the joke can be drawn, it is the right kind.
6. Vary the rhythm. Not everything is Short. Short. Turn.
7. If the joke has been on the internet, cut it.
8. American register, as the game: restroom, not toilet; bachelorette, not hen party; two weeks, not fortnight; no Head Office.
9. Three good lines per feature, not nine. Each is a recording.
10. Names stay out of recorded lines (the docs already know this).

## What I would build from this list

In order, each small enough to ship alone:

1. Third-star content at the second star (S, from Grand Occasions phase 1).
2. The Manifestation Board (S, quick win): complaints as pinned wishes that go to the problem. It is the communication pass the house rules keep asking for, in the game's voice.
3. Kyle's memos and the sale countdown (S, from Kyle phase 1), as a warning fix with no escort verb.
4. One headline in the payday dialog (S, from the Rag).
5. The Monthly Reading (M, from Under the Stars phase 2), on its own.
6. One escapee with a place-changing verb and the settles-into-staff ending (M, from Loose Spirits).
7. Snowed In, With Company, town-booked, one judged line, as the proof of Grand Occasions (M to L).

Then look again at Takeover openings (gap 2) and Seekers and Skeptics (gap 8), which nothing in the top seven touches.
