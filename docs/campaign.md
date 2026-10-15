# Campaign: design draft

A plan for turning the game from one open-ended center into a campaign of centers, with the current game kept as a sandbox. The decisions made are at the end, and all four phases are built, along with High Pines and The Orchard Estate.

## What Two Point Hospital does

From memory, not checked against current sources:

- **A campaign of hospitals** across one fictional county. Each has its own map and building, a starting budget, and a twist: bad weather, a local quirk, a building to fix up. Its illnesses are a mix of ones you have seen and a few new ones.
- **Three stars per hospital.** Each star has its own objectives. One star opens the next hospital; the other two are optional and can be earned later by going back.
- **Unlocks that carry over.** A currency earned from achievements and challenges buys new items, which then stay unlocked in every hospital.
- **Challenges** pop up mid-level (cure a number of patients by a date, build something) with a reward.
- **A sandbox**, added after launch: any map, with settings for money, difficulty and how much is unlocked. The difficulty is done: Relaxed, Standard and Demanding presets, and eleven settings to change on their own.

## What this game has to build on

- **Content is already data.** Rooms, items, roles, techniques, conditions and disciplines are tables in `src/core/data/`, and Settings can already switch disciplines on and off per game. A center that offers only massage, or adds reiki early, is a matter of data.
- **Stars already gate content.** Rooms, items and techniques unlock at a star, within the one game. In a campaign that would happen within each center.
- **The map is fixed.** The plot size, building outline, entrance and road are constants in `src/core/data/map.ts`, used in about ten files (`world.ts`, `guests.ts`, `chars.ts`, the camera, floor and scenery). A center with its own plot means moving these into the game state. This is the biggest single piece of work.
- **The star goals are one fixed list** (`STAR_GOALS`: guests healed, reputation, bank balance), checked in `progress.ts`. A campaign needs goals per center and more kinds of goal.

## The shape of it

**Title screen.** New game becomes two choices: **Campaign**, which opens a map of the region with a pin per center and the stars earned there, and **Sandbox**, which opens a short settings screen and then starts today's game. Continue and Load work as now.

**A center** is a data entry (a `LevelDef`):

- name, place and a two-line blurb for the map
- the plot: building outline (a rectangle at first; L shapes and courtyards later), entrance, and the scenery around it (lawn, beach, snow, street)
- starting money and reputation
- which disciplines exist there, and at which star each opens
- the local mix of conditions: weights that make some common and others rare, plus any conditions found only there
- three star goals, each a short list of objectives
- its twist (below)

**Progress across the campaign** is kept apart from saved games: stars earned per center, and anything unlocked for good. A saved game records which center it is, so Continue and Load take you back into that center.

**Objectives** grow from three kinds to a handful, each a small function over the game state:

- heal a number of guests, in total or with one discipline
- reach a reputation
- have a bank balance, net of any loan
- keep the cure rate above a level over the last month
- keep the average wait under a number of days
- finish an emergency
- have a room at a prestige level
- go a month without anyone quitting

The Stats menu's monthly record already holds most of what these need.

## Five centers

Plain working names; all of them can change.

1. **Willow Lane** (the tutorial). A small high-street unit, massage only. The goals walk through the basics: reception, consultation, a suite, a staff room. No twist.
2. **The Exchange** (downtown, office workers). Desk Slump, Tension Headband and Crick of the Neck are common. Acupuncture opens at the first star. Twist: **rush hours**, when arrivals spike for a couple of days in every six, and guests are less patient. (First built as two windows within each day, which with days a few seconds long flickered past and chimed every few seconds; fixed in v0.12.0.)
3. **The Boardwalk** (a seaside town). Twist: **seasons**, with a summer surge of visitors and a quiet winter that has to be budgeted for. The sea air wears equipment faster. A few new beach conditions.
4. **High Pines** (a mountain lodge). Cold-weather conditions (Cold Shoulder, Cold Feet) are common, and Hot Stone is in demand, but Stone Warmers cool faster. Twist: **snowed-in days**, with no arrivals for a day or two. Reiki opens here.
5. **The Orchard Estate** (a wealthy resort). All three disciplines from the start. Twist: **picky guests**, who pay far more but judge the decor and prestige of each room, and an inspector who visits and rates the center.

A sixth, later: **an old wing to restore**, which starts with rooms already built but broken down, and a loan to repay.

## Twists as hooks

Each twist is a small modifier the simulation asks the center for, rather than code written per center:

- arrival rate over the day and over the year (rush hours, seasons, snowed-in days)
- patience drain, wear rate and stone cooling multipliers
- condition weights, and conditions only found there
- fee multiplier and how much decor and prestige matter
- scheduled events (an inspector, a festival bringing a crowd)

## Carry-over

Two options (a decision below):

- **Simple:** nothing carries over except the stars on the map. Each center unlocks content by its own stars, as today.
- **Two Point style:** stars, and a few one-off achievements, earn a currency spent on unlocking items for good, so later centers start with more choice.

## Sandbox

Today's game, plus a settings screen before it starts: starting money, which disciplines are on, and "everything unlocked from the start". Old saves load as sandbox games.

## Phases

1. **Foundations, nothing visible yet.** Move the map into the game state; give each game a center (sandbox for every existing save); turn star goals into per-center data with the new kinds of objective. The sandbox behaves exactly as today, and the tests prove it.
2. **The campaign, playable.** Campaign progress storage, the region map on the title screen, and the first two centers.
3. **Twists and the other centers.** The twist hooks, then centers 3 to 5, with their new conditions and scenery.
4. **Sandbox settings and carry-over**, whichever kind is chosen.

Each phase ships on its own.

## Decided (14 October 2026)

1. **Three centers in the first campaign release:** Willow Lane, The Exchange and The Boardwalk. High Pines and The Orchard Estate follow in a later release.
2. **Carry-over is an unlock currency,** Two Point style: stars and a few achievements earn it, and it buys items that stay unlocked in every center.
3. **Disciplines open along the way:** massage only at Willow Lane, acupuncture from The Exchange. With three centers, reiki opens at The Boardwalk for now; once High Pines exists it can move there.
4. **Rectangular buildings first,** in a different size and position on each plot. L shapes and courtyards come later.
5. **Names:** the working names stand until something better comes up.

That makes the phases:

1. **Foundations:** the map into the game state, a center per game, per-center goals. Nothing visible changes. _Done:_ every game has a center, the building's place comes from it, goals are per center with eight kinds of objective, and Willow Lane exists as data (not yet reachable from the title screen).
2. **The campaign, playable:** progress storage, the region map, Willow Lane and The Exchange with rush hours. _Done:_ Campaign and Sandbox on the title screen, a trail of centers with the stars earned (kept apart from saved games), Willow Lane (massage only) and The Exchange (acupuncture, office ailments, rush hours). The pause menu's New game restarts the same center.
3. **The Boardwalk:** the seasons twist, its conditions and seaside scenery, reiki in the campaign. _Done:_ seasons (summer about twice as busy, winter about half), announced as each starts and shown by the date; sea air wears equipment 40% faster; three seaside ailments found only there (Lobstered, Sea Legs, Gull Shock); sand, sea, beach huts and dune grass around the building; acupuncture and reiki.
4. **The unlock currency and sandbox settings.** _Done:_ karma (✨), 2 for each campaign star and 2 or 3 for each of eight achievements, 36 in all. It unlocks comfort and decor items early (arcade, bookcase, espresso machine, aquarium, pool table, trophy cabinet) and three karma-only items (Massage Chair, Bonsai, Koi Pond), 36 in all, so finishing everything unlocks everything. Treatment equipment stays tied to its treatment's star. Spent in the karma shop under Campaign, or by clicking a locked card in the Items menu. Achievements are earned only in campaign games. The sandbox has settings for starting money, treatments, and everything unlocked.

Then a later release adds High Pines and The Orchard Estate.

5. **High Pines** (after roadmap phase 7). _Done:_ a cold climate (about 26°F outside at the depth of winter), so a center there needs Radiators; snowed-in spells of two days, about three winter spells in ten, when no guests, emergencies or outbreaks arrive, announced as each starts and ends, shown in the bottom bar and with snow falling, and none in a game's first month; Stone Warmers cooling up to four times as fast in a cold room (anywhere, not only here); Cold Shoulder, Cold Feet and Stress Head common, and three mountain ailments found only there (Frozen Stiff, Wipeout, Cabin Fever); snowy ground and pines; acupuncture and reiki. Reiki stays at The Boardwalk too, since moving it would take it from The Boardwalk games and goals. The **Fireplace**, a karma-only item for 6 karma, matches the karma High Pines' stars add, so finishing everything still unlocks everything.

6. **The Orchard Estate** (after roadmap phase 8). _Done:_ picky guests, who pay half as much again for a treatment and expect two more stars of prestige of its room than the center's standing asks, so a plain room lets them down; the health inspector calls twice as often; what the first two stars bring is open from the start, so acupuncture and reiki are there on day one (sound and chakra healing still take three stars); three local ailments (Windfall, Croquet Back, Blossom Nose); rows of apple trees round the building; and each star asks for a grade of standing, Wellness Studio, Wellness Center, then Healing Center. The **Topiary**, a karma-only item for 6 karma, matches the karma its stars add.
