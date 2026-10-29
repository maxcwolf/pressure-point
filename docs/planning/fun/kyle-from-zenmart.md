# Kyle from ZenMart

Drafted 27 October 2026.

An idea, not a plan: nothing here is decided.

Moved to the bottom of [the ranked list](README.md) after Max's review on 27 October 2026. One piece stands without Kyle: ZenMart's sales and job offers come with no warning today, which breaks the warned-ahead rule. A toast a few days before each is now a quick win in the README. Revised later that day against [the review](review.md) into a one-page pitch: the notes and the countdown lead, as that fix; "See him out" is gone; and Kyle is a wellness man, not an office man.

## The pitch

**The moment.** Five days before ZenMart's sale, a note arrives with the rival's icon: "A note from Kyle: Sending light ahead of our sale on the 12th. Competition is just abundance with two doors." The Standing tab's "No sale on." now reads "Next sale in 5 days." On the day, Kyle crosses the street in a ZenMart polo and works along the waiting area, handing out leaflets with a small crystal taped to each. Then he goes home.

**The verb.** Get ready. The first slice adds no verb; it adds the warning the game owes. The second gives the floor something to watch and one more answer. Kyle can only leaflet guests who are waiting, so a short line during a sale is a defense, beside lower prices.

**The joke.** Kyle is relentlessly positive about taking your guests. He thanks you for your energy, holds space, sends light. He is funnier across the street from a wellness center than he would be in a cubicle, and the satire lands on the industry.

**The one rule.** First slice: none. Second: during a sale, Kyle is a visitor who hands a leaflet to each waiting guest in turn, and a guest who minds prices may get up and leave with it. That share comes out of the sale's arrival draw, so the pressure moves onto the floor instead of growing.

**The cost.** The notes are S: three toasts and a Standing tab line, from dates the rival already holds. Kyle on the floor is S to M: one ordinary visitor, a leaflet, a new guest outcome and a balance rerun.

## First slice: the notes

Today a sale starts with a toast on its first day, and a job offer arrives with no warning at all.

- **ZenMart opens** (day 45): Kyle's first note.
- **A sale**, 5 days ahead: a note and the Standing tab countdown. `r.nextSale` is set when the last sale ends, so the date is known.
- **A job offer**, 2 days ahead: a note naming whoever `poachTarget` would pick now. A raise or a break lifts them, as today. On the day the offer goes to whoever is unhappiest then, as today, so the note warns and does not promise.

The notes are toasts, so they may carry names:

- "A note from Kyle: Hi, neighbor! I have left a crystal on your step to hold space."
- "A note from Kyle: Sending light ahead of our sale on the 12th. Competition is just abundance with two doors."
- "A note from Kyle: Dana Ortiz and I are aligning over an oat latte in 2 days."

## Second slice: Kyle on the floor

1. **His visits.** A new `VisitorKind`, `'rival'`, from the storefront's end of the street. He comes on a sale's first day and once more partway through. He stands by the busiest bench, hands a leaflet every 1.5 seconds to up to 8 waiting guests, and leaves on his own. Nobody clicks him. He never judges, fines or reviews.
2. **The split.** The sale's draw on arrivals drops from 30% (`SALE_DRAW`) to 20%. Leaflets are tuned to take about the other 10 points at a typical line. A center with a short line loses less to a sale than today, and one with a long line loses more.
3. **Who takes the bait.** A leafleted guest leaves with chance 35% × `mindsPrice` × `saleDraw(price)` / `SALE_DRAW`. Lower prices work as now, and regulars and emergencies (`mindsPrice` 0) never go. A guest who goes has the new outcome `'lured'`: no reputation, no review, against no goal, and counted in the Standing tab as "Lost to ZenMart this month".
4. **Job offers.** On the day, Kyle walks to the person, hands them a paper cup, talks for 3 seconds and leaves. The offer is then made as today.

Lines:

- PA, as approved in the review: "Would the gentleman from ZenMart please stop handing out leaflets in the waiting area. Thank you, Kyle." Kyle is a fixed name, so the recording always matches its banner.
- His badge: "KYLE. Ask me about inner peace."
- The leaflet, in his hand and on a guest's tooltip: "ZenMart: Enlightenment in Aisle 4. Now 25% Off."

## Fair play

- **Warned of.** Every sale 5 days ahead, every job offer 2 days ahead. Today neither is.
- **Counterplay.** Prices, a raise or a break, word of mouth, as now. Kyle adds one more: keep the line short while he is in.
- **Not easier.** The sale's pressure is moved, not cut. The bot checks that: the good bot's stars-at-month and guests lost to ZenMart within 5% of main.

## Where it plugs in

Each checked in the code on 27 October 2026.

- `src/core/sim/rival.ts`: `openUp`, `updateSale`, `updatePoaching`, `poachTarget`, `saleDraw` and `rivalDraw`; `r.nextSale` and `nextPoach`. Toasts carry the `ui-rival` icon.
- `src/core/data/standing.ts`: `RIVAL_OPENS` (45 at every center), `SALE_GAP_DAYS`, `SALE_DAYS`, `SALE_DISCOUNT` (25%), `SALE_DRAW`, `POACH_GAP_DAYS`, `POACH_MORALE` (35), `POACH_DAYS`.
- `src/ui/components/menus/StandingTab.tsx`: the countdown.
- `arrivalParts` in `src/core/sim/twists.ts` applies `1 - rivalDraw` to arrivals. That is the only place a sale bites today, and its guests never enter the building, hence the split.
- `src/core/sim/visits.ts`: `arrive` builds a visitor at `streetTile`, and `nextRoom` walks them out. `updateVisits` waits while any visitor is inside, so Kyle must be left out of that check or he holds up the VIP and the inspector.
- `goForTreatment` in `src/core/sim/stations.ts` and `mindsPrice` in `src/core/sim/regulars.ts`.
- `VISITOR_CLOTHES` and the inspector's clipboard in `src/render/models/character.ts`, the models for his polo and leaflets; `storefrontSpot` in `src/render/storefront.ts`, where he walks from.

## Later, if it lands

- **The spy**, from The Boardwalk: a stranger among the guests for up to 5 days, with tells (no ailment at check-in, pacing a room out, a clipboard). Click a suspect to escort him out: free if right, 2 reputation if a real guest. Ignored, ZenMart copies your best room for 5% standing. Warned a week ahead. If [ZenMart Express](zenmart-express.md) is built, the spy is how it picks what to copy: catch him, and the next copy is of something else.
- **The mascot chase**, from High Pines: ZenMart's foam lotus in the lobby, and a Mascot Costume item that puts a member of staff in a foam hand to chase it out. They end stuck together in a doorway. PA: "Would the large lotus please leave the lobby. It is not a guest."
- **His career.** Promoted at every center whether he wins or loses. An awards speech: "Congratulations to everyone who took part, which is mostly us." Beat ZenMart at all five centers and his CV joins the Receptionist applicants, as Amanda Jablonsky does.
- **The build work, after the pick:** a save bump from 40 for his visit and `'lured'`, the visit end [ZenMart Express](zenmart-express.md) uses too, so whichever comes first adds it, a `kyle` bot flag and report lines, and his place under the sandbox's existing rival switch.
- **Cut:** "See him out", the Float Pod week, Reply on the PA, and every per-my-last-email line.
