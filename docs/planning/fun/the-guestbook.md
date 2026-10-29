# The Guestbook: regulars with storylines

Drafted 27 October 2026.

An idea, not a plan: nothing here is decided.

Moved to the bottom of [the ranked list](README.md) after Max's review on 27 October 2026. Revised later that day against [the review](review.md) into a one-page pitch: four stories, each beat something a regular brings into the building, and the regular stays after the keepsake.

## The pitch

**The moment.** Gary is in the line for Reception, jogging on the spot. Next visit he has a race number pinned to his shirt. The one after, he comes in wrapped in a foil blanket. Then he walks in with a medal around his neck, and a toast says he has left the center a bench with his name on it.

**The verb.** Spot them and look after them. A regular on a story is known by what they carry, not by anything to read. A visit of 4 or 5 stars moves the story on, and they come back with the next thing. A worse visit holds it. Where to put Gary's Bench is the one new choice.

**The joke.** Each story is one object that changes visit by visit: a medal, a book that never opens, postcards piling up behind the Reception desk, a hat that gets smaller. The ending is a piece of decor with a name on it.

**The one rule.** A regular on a story moves one beat on each visit of 4 stars or more, and each beat is a prop they bring in. Ids and stars decide everything, never the random numbers.

**The cost.** M, mostly models: about a dozen small props, a jog on the spot, a postcard handover, the Guestbook tab and four keepsakes copied from the Certificate. The writing is light, and nothing is recorded.

## The four stories

Each runs four beats, from the regular's second visit.

1. **The Long Run** (Gary, any ailment, so Willow Lane has it). He jogs on the spot in line, then wears a race number, then a foil blanket, then a medal, which he keeps on for every visit after. Last review: "Finished. Everyone had gone home, but they left the tape up." Keepsake: **Gary's Bench**, plaque "He finished, eventually."
2. **The Book Club** (Mabel, any ailment). A thick book with a lighthouse on the cover, its bookmark at page 3 every visit. Next visit, a friend with the same book. On the last she comes with four of the club, each holding it unopened. Keepsake: **Mabel's Bench**, plaque "In loving memory of Mabel's lower back, which is fine now."
3. **The Same Three Places** (Percy, Lost Their Way). Each visit he hands a postcard to the Receptionist, who pins it on the wall behind the desk. Click one to read it: "Not in the garage either. — Percy", then "Checked the car. Checked under the car. — Percy". The last: "Found myself. I was in your waiting room the whole time. Lovely chairs." Keepsake: **Percy's Postcards**, framed. "Wish you were here. I was."
4. **A Smaller Hat** (Tristan, Ego Overgrowth). His head is back to its size and he arrives in an enormous hat. Each visit the hat is smaller, and on the last there is none. Last review: "Bought a smaller hat. It's a statement, the smaller hat." Keepsake: **Tristan's Old Hat**, on a plinth. "It used to fit."

## Rules and numbers

All first guesses.

1. **Who gets a story.** When a guest becomes a regular, they take a story that fits their first ailment and is not already running, picked by id. Gary and Mabel fit anyone; Percy needs Lost Their Way and Tristan Ego Overgrowth. At most four run at once, so most regulars have none, which keeps the props rare enough to notice.
2. **A beat.** On a 4- or 5-star visit the story moves on and the next prop comes with them next time. Three stars or fewer holds it, and the review is as today.
3. **The last beat** comes only to a loyal regular (50 or more), so it ends as they reach devoted.
4. **After the keepsake** the regular stays, with their last prop and the plain "Welcome back" greeting. Finishing well keeps the regular, their tip and the bench. A story whose regular stops coming goes into the Guestbook grayed and unfinished, and can start again with someone new.
5. **Mabel's club** is that day's walk-ins, not extra ones, so demand is unchanged.
6. **Keepsakes** are earned once, like a Certificate, cost $0 to place and give decor 2. Sold, one goes back to the Guestbook to place again. No money and no karma.

## Fair play

No new pressure. Today a regular's loyalty falls with no reason given until they quit. The Guestbook (today's Regulars tab, renamed) shows each story's beats and the last visit's loyalty change, so a regular slipping is seen two visits before they go.

## Where it plugs in

Each checked in the code on 27 October 2026.

- **The regular.** `Regular` in `src/core/state/types.ts` keeps nothing about the ailment, so the story needs the first one kept. `spawnGuest` in `src/core/sim/guests.ts` rolls a fresh ailment each visit.
- **Their visits.** `afterVisit`, `welcomeBack`, `greeting`, `takesToPlace` and `returnGap` in `src/core/sim/regulars.ts`. The greeting float is drawn at Reception in `src/core/sim/stations.ts` (line 458). `writeReview` and `reviewText` are in `src/core/sim/feelings.ts`.
- **The props.** The `held` slot (by `HeldKind`) and hats in `src/render/models/character.ts`. The inspector's clipboard is the model for a carried prop.
- **Keepsakes, copied from certificates.** `certificatesLeft` in `src/core/certificates.ts`; `newItem` in `src/core/sim/building.ts` fills in `trophy`; `src/core/build-rules.ts` (line 272) refuses a placement with none left; decor reaches patience and prestige through `decorOf` and `drainFactor` in `src/core/sim/ambience.ts`.
- **The tab.** `src/ui/components/menus/RegularsTab.tsx`, in `TABS` in `StatsMenu.tsx`; `regularTag` and `loyaltyNote` in `src/ui/lib/regulars.ts`. Keep the `regulars` class the end-to-end tests use.

## Later, if it lands

- **More stories with a visible beat**, one at a time. Candidates from the first draft: Steve's motorcycle on the sidewalk (Midlife Fog), Joan's feathers (Possessed by a Chicken), Ruth in a different century's clothes each visit (Past Life Hangover).
- **Setback reviews** that name what went wrong, in the story's voice.
- **Old faces**: a finished regular turning up at the next center.
- **The build work, after the pick:** story fields on `Regular`, the Guestbook in `GameState`, `Item.keepsake`, a save bump from 40, one bot rerun (Mabel's club changes who walks in, so seeded runs shift), and play events for beats and keepsakes.
- **Shelved:** couples, breakups, engagements and the ex. **Cut:** Kevin, Between Energies, The Standing Desk and After Brent.
