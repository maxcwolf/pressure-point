# Campaign: design draft

A plan for turning the game from one open-ended center into a campaign of centers, with the current game kept as a sandbox. Nothing here is built yet. The decisions that need making are at the end.

## What Two Point Hospital does

From memory, not checked against current sources:

- **A campaign of hospitals** across one fictional county. Each has its own map and building, a starting budget, and a twist: bad weather, a local quirk, a building to fix up. Its illnesses are a mix of ones you have seen and a few new ones.
- **Three stars per hospital.** Each star has its own objectives. One star opens the next hospital; the other two are optional and can be earned later by going back.
- **Unlocks that carry over.** A currency earned from achievements and challenges buys new items, which then stay unlocked in every hospital.
- **Challenges** pop up mid-level (cure a number of patients by a date, build something) with a reward.
- **A sandbox**, added after launch: any map, with settings for money, difficulty and how much is unlocked.

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
2. **The Exchange** (downtown, office workers). Desk Slump, Tension Headband and Crick of the Neck are common. Acupuncture opens at the first star. Twist: **rush hours**, when arrivals spike at the start and end of each day, and guests are less patient.
3. **Saltmarsh** (a seaside town). Twist: **seasons**, with a summer surge of visitors and a quiet winter that has to be budgeted for. The sea air wears equipment faster. A few new beach conditions.
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

## Decisions for Max

1. **How many centers in the first campaign release:** three (tutorial, downtown, seaside) or all five?
2. **Carry-over:** nothing but the stars on the map, or a currency that unlocks items for good?
3. **Disciplines:** opened one by one across the campaign (massage, then acupuncture, then reiki), or available in every center, opened by its own stars as today?
4. **Building shapes:** different-sized rectangles first (simpler), or real outlines such as L shapes and courtyards from the start?
5. **Names and places:** keep the working names, or a different setting altogether?
