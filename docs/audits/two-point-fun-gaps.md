# Two Point fun gaps, 27 October 2026

A fresh look at what makes Two Point Hospital fun that this game does not have yet, made 27 October 2026 on main at 0.34.3. The reviewer read the code under `src/core/`, the player's guide and the changelog, and played the game in the browser: the sparse day-21 Willow Lane autosave, and two centers the playtest bot built for the late game, a three-star Orchard Estate at day 900 (17 rooms, 20 staff, $340,000 in the bank) and a one-star Boardwalk at day 760, loaded as saves. The model lab was used to look at a guest's symptom and a treatment in progress up close. On purpose, nothing under `planning/`, `plans/`, `research/` or `audits/` was read, the [14 October gaps audit](two-point-gaps.md) included, so this is a second opinion rather than a follow-up: where it agrees with the earlier audit, that is two reviewers landing in the same place.

The comparison is with Two Point Hospital as shipped, from memory of playing it. It is about feel, not systems, and it is ranked by how much fun each gap costs.

## The short version

The game already has nearly every system Two Point Hospital has. What it is missing is mostly the things that made people laugh and lean in, not the things that made them think. Four gaps carry most of the cost:

1. **The cure as a show.** Only the eleven machines have a gag you stop to watch; the other nineteen treatments look the same.
2. **Symptoms that change the silhouette.** Most of the sixty-two ailments are a prop, so a crowd reads as a crowd.
3. **A research drip between the stars.** Nothing new arrives between a center's three stars, and after the third the money piles up with nothing to spend it on.
4. **Staff you remember.** One quirk at most, often none, and morale is a bar with no reason.

## What is not missing

So that the list below is read as a list of gaps and not a list of everything: queue dragging, policies, room prestige, overlays, VIPs, the inspector, emergencies, stress outbreaks standing in for epidemics, year-end awards, karma standing in for Kudosh, standing grades standing in for hospital level, training and ranks, raises, marketing, loans, land, templates, per-center twists and a recorded announcer are all here and work. Regulars, house calls, written reviews, Qi Gong classes, a rival across the street, weather and fires are things Two Point never had.

## The gaps, biggest first

### 1. The cure as a show

In Two Point every illness has its own slapstick cure you stop to watch: the bulb unscrewed and a head screwed on, the pan hammered off, the animals vacuumed up, the potion that goes up in smoke, and the failed cure is a joke of its own. The cure animation is the reward for the whole visit, and it is why players zoom in rather than out.

Here only the eleven machines have gag scripts (`src/render/gags/scripts/`), and those are good, the harmless fake failure included. The other nineteen treatments across the five disciplines look the same: a guest on a table or a mat, a practitioner rocking, a puff of sparkles and a hop (`showCure` in `src/render/pose.ts`). Deep Tissue, Cranio-sacral, Cupping, Moxibustion and Chakra Balancing are told apart by their fees and their lines in the Treatments menu, not by anything on the screen. A failure is a thumbs-down bubble, a sound and the bad-vibes cloud. This is the single largest source of Two Point's fun, and most of the catalog here goes without it.

### 2. Symptoms that change the silhouette

Two Point's patients are a cube, a mummy, a clown, a lightbulb, a man made of rock. You read the waiting room from across the map and it is funny every time, and the symptom is the first thing a new player asks about.

Here most of the sixty-two ailments are a small prop or accessory (`Visual` in `src/core/data/types.ts`): steam puffs over the head, a headband, a phone held up, a hen, a cork. The goat's horns, Chair-Shaped and Gym Lock, which change the body or the pose, are the right idea. Zoomed in on the Orchard save's crowd of some thirty guests at the game's usual distance, the reviewer could not tell most conditions apart; the Condition overlay says who is worst off, but not what is wrong with them. The names and descriptions are as funny as Two Point's; the pictures do not carry them.

### 3. A research drip between the stars

Two Point's Research room turns money and a staff skill into a path the player chooses, and it keeps "a new thing has arrived" moments coming through the middle of every level: a cure machine, a machine upgrade, a new illness announced with a fanfare that demands a new room. It is a money sink, a reason for one more room and one more specialist, and the reason a big hospital has thirty-odd room types.

Here everything arrives in three lumps per center, at the stars, plus the karma shop, and equipment upgrades are bought from the item's inspector with nothing to research. Between stars nothing new turns up, and the room count stops at eighteen. After the third star the Orchard save sat on a third of a million dollars with "Nothing left to prove. For now." in the objectives panel and the Foundation's gifts as the only sink. The late game of each center is where this gap is felt most.

### 4. Staff you remember

Two Point's staff have a portrait, up to three traits, a line of bio and a job-satisfaction breakdown, so hiring is an argument with yourself about a person, and firing one is a small wrench.

Here a member of staff has at most one of the twelve quirks (`TRAITS` in `src/core/data/staff.ts`), and all three receptionist applicants in the Orchard save read "No notable quirks". The inspector shows morale as a bar with no reason attached, though `moraleTarget` in `src/core/sim/staffing.ts` knows every reason. There are no portraits and no bios. The staff challenges, soul retrieval and Amanda Jablonsky are exactly the right seeds; the hire decision today is rank against salary.

### 5. Diagnosis as a pinball machine

Two Point routes a patient through a GP hub and up to six diagnosis rooms, gaining certainty at each, and the GP queue is the puzzle every layout is built around: where to put the second GP's office, which diagnosis rooms to double up, when to treat at 60%.

Here the visit is desk, Consultation Room, treatment, with the Posture Lab as the one branch and up to four consultations (`src/core/sim/stations.ts`). That is thinner, which may be right for a wellness center, but it means a layout has one chokepoint and the diagnosis slider in Policy has little to bite on.

### 6. Consequences you can see on the map

Two Point's failures stay in the world: a death, a ghost scaring the corridor, a janitor chasing it with a vacuum. Bad vibes and the sage are a good equivalent for a failed treatment. A guest who goes home worse off, though, just vanishes, and the consequence arrives as a red text card; three of those stacked up in the first minute of the loaded Orchard save. Two Point puts the consequence in the scene and the card is secondary.

### 7. A voice beyond the PA

The forty-three recorded announcements are a real strength. Two Point adds a radio station with DJs, adverts for in-world brands and a rotation of tracks, and that is where much of the world's personality lives. Here the music is one generative lounge loop (`src/audio/audio.ts`), which wears over a long session, and ZenMart is the only brand with a name.

### 8. Set-piece arrivals

Two Point's emergencies land by helicopter on a pad you built, and epidemics come with a vaccination countdown. The fire brigade's siren truck and the bad-trip runner show this game can do it. The "Possessed by a Goat" emergency in the Orchard save, though, was a small card at top left and five guests who walked in like anyone else.

### Smaller

- The awards ceremony and the star screen are card lists rather than a scene.
- There is no co-op or versus play, which is out of scope for a solo alpha.

## How it was looked at

- The code under `src/core/data/` and `src/core/sim/`, read for what each system does today; `src/render/gags/`, `src/render/pose.ts` and the model lab (`/lab.html`) for what a guest and a treatment look like.
- The player's guide (`docs/guide.md`), the architecture doc and the changelog back to 0.33.3.
- The game in the browser at 1440×900: the Willow Lane autosave on the title screen, then two saves the playtest bot (`tests/balance/bot.ts`) built with `machines` on, seed 2, for 900 days at The Orchard Estate and 760 days at The Boardwalk, written as save files and loaded. The menus, inspectors, overlays, Stats tabs, Money tabs and Policy were each opened in the Orchard save.
- Nothing was measured; this is a reviewer's judgment of feel, to be weighed against the balance log and the earlier audits.
