# Play statistics: done and to do

How the game counts what players do, sent to PostHog, and what is still to add so the numbers explain how the game is played. Crash reports and logs are separate and go to Sentry (`src/app/sentry.ts`).

Tick an item off when it is done, with the commit or release it landed in.

## How it works

- **Where they go.** PostHog's US cloud, the free tier, project "Default project" (id 672370). The project key is in `src/app/analytics.ts`. Like Sentry's DSN, it only says where to send, so it is safe to publish.
- **Which copies send.** Only the published web game (`production`) and the installed desktop app (`desktop`), as decided by `src/app/environment.ts`, which Sentry uses too. The dev server, `yarn preview`, the desktop app run from this folder and every test send nothing.
- **Tests and bots never send.** A browser driven by a program sets `navigator.webdriver`, and crawlers and headless browsers name themselves in their user agent; either keeps even a published copy from starting PostHog (`src/app/automation.ts`). That covers every Playwright test, in a browser or the desktop app, including a packaged app tested with `PP_APP`. Checked on 18 October 2026 with a build allowed to send: under Playwright PostHog never started, and in an ordinary browser it did. The balance bot (`yarn balance`) and the unit tests run the simulation in Node and never load the analytics at all.
- **Sharing is on until switched off.** Settings → Privacy → Share play statistics. Switching it off stores `off` under `pressure-point-analytics` (`src/storage/analytics.ts`) and stops PostHog capturing; switching it back on forgets the choice.
- **Only the events the game sends.** The SDK is the `posthog-js/dist/module.no-external` build, with autocapture, page views, session recording, surveys, feature flags, heatmaps and exception capture all off, and nothing loaded from elsewhere. Players are a random id kept in local storage, with no person profiles (`person_profiles: 'never'`). The save's name, which is the player's own, is never sent.
- **IP addresses are kept, for now.** Decided on 18 October 2026: the project stores them (`anonymize_ips` is off), which gives each event a country. To stop, turn on "Discard client IP data" under PostHog's Project settings; nothing in the game changes.
- **The page allows it.** `index.html`'s content security policy lets the game connect to `https://us.i.posthog.com` and `https://us-assets.i.posthog.com`.
- **Two kinds of event.** Most are found by comparing the game, once a second, with how it stood a second before (`src/app/play-events.ts`, run by `watchGame` in `src/app/analytics.ts`), so the game core knows nothing of them. Choices made only in the interface (offers, menus, overlays, settings) are counted where the player clicks.
- **Tests.** `tests/unit/play-events.test.ts` covers every event found by comparison and the sharing switch.

## What is counted

Every event also carries `app_version`, `platform` (`web`, `darwin` or `win32`) and `play_id`, a random id for the page it came from. Leaving a game reloads the page, so a `play_id` is one session of one game. Events from a game also carry `center`, `day`, `stars` and `cheated`. Cheated games are left out of every chart by the project's test account filter.

| Event                | When                                                                                                 | Says                                                                                                                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `game_opened`        | A game is started or loaded                                                                          | `kind` (`new` or `saved`), `difficulty`                                                                                                                                                |
| `play_summary`       | Every 5 minutes of play, and whenever the page is hidden                                             | The session so far: `minutes`, `days_played`, `money`, `seconds_at_speed` (seconds paused and at each speed while the page was showing). The latest for a `play_id` is the one to read |
| `game_left`          | The page closes, reloads or goes back to the title screen                                            | The same as `play_summary`. It can be lost as the page closes, which is why the summaries exist                                                                                        |
| `milestone_reached`  | A new player's firsts                                                                                | `milestone`: `first_item`, `first_hire`, `first_guest`, `first_heal`                                                                                                                   |
| `doors_opened`       | The center opens for the first time                                                                  |                                                                                                                                                                                        |
| `room_built`         | A room is finished                                                                                   | `room`, `rooms` (how many there are now)                                                                                                                                               |
| `item_first_placed`  | The first item of a kind goes down in a game                                                         | `item`                                                                                                                                                                                 |
| `staff_hired`        | Someone is hired                                                                                     | `role`                                                                                                                                                                                 |
| `staff_left`         | Someone quits or is let go                                                                           | `role`, `reason` (`quit` or `fired`; leaving for the rival counts as `quit`)                                                                                                           |
| `month_ended`        | Each month closes                                                                                    | `month`, `money`, `reputation`, `net`, `loan`, guests `arrived`, `healed`, `failed`, `stormed`, `priced`, `sent`, `worse`, `healed_by`, `wait`, `staff`, `rooms`, `price_level`        |
| `star_earned`        | A star is earned                                                                                     | `star`                                                                                                                                                                                 |
| `achievement_earned` | An achievement is earned                                                                             | `achievement`                                                                                                                                                                          |
| `in_the_red`         | Money drops below zero                                                                               | `money`, `loan`                                                                                                                                                                        |
| `loan_changed`       | The loan is taken out or paid back, a step at a time                                                 | `loan`, `change` (`borrowed` or `repaid`)                                                                                                                                              |
| `price_changed`      | A price is changed (one event a second at most, so a run of clicks is one event)                     | `technique` (`all` for the overall level), `level`                                                                                                                                     |
| `marketing_started`  | A marketing campaign is bought or extended                                                           | `kind`, `months`, `condition` for a condition campaign                                                                                                                                 |
| `offer_answered`     | The player accepts or declines an emergency, a stress outbreak or a house call                       | `offer` (`emergency`, `outbreak`, `house_call`), `answer` (`accepted` or `declined`)                                                                                                   |
| `menu_opened`        | A build menu is opened                                                                               | `menu`                                                                                                                                                                                 |
| `overlay_shown`      | A floor overlay is picked                                                                            | `overlay`                                                                                                                                                                              |
| `setting_changed`    | A switch in Settings is flipped, on the title screen or in a game (the key bindings are not counted) | `setting`, `value`                                                                                                                                                                     |

Checked end to end on 18 October 2026: a local production build, briefly allowed to send, delivered `game_opened`, `play_summary` and `game_left` with every property. Those events (sandbox games, days 46 to 53) are the only test data in the project.

## In PostHog

- **The dashboard:** [How players play](https://us.posthog.com/project/672370/dashboard/2226587), pinned. It has the new-player funnel, players who come back, players per day, how long sessions last, time at each speed, how games go month by month, why guests leave unhealed, staff who quit, games that went into the red, offers taken up, menus opened and items used.
- **Test account filters** leave out events with `cheated` true, as well as PostHog's own internal users, and new insights use them by default. The SQL tiles filter cheated games themselves.

## To do

### In PostHog

- [x] **A new-player funnel:** started a new game → placed an item → hired someone → opened the doors → healed a guest → earned the first star. On the dashboard, 18 October 2026.
- [x] **Retention:** players who open a game again in the weeks after their first. On the dashboard, 18 October 2026.
- [x] **A dashboard of how games go:** month by month, guests lost by cause, staff quits by role, games in the red by center. [How players play](https://us.posthog.com/project/672370/dashboard/2226587), 18 October 2026.
- [x] **What gets used:** items by how many players use them, menus opened, offers taken up. On the dashboard, 18 October 2026. Overlays and rooms are not charted yet.
- [x] **Filter out cheated games** in the project's test account filters. 18 October 2026. The few test events are still in; they will not matter once there is real traffic.
- [ ] **Read the funnel and the month-by-month chart after a week or two of real play**, then decide which of the events below are worth adding.
- [ ] **Watch the free tier.** A million events a month. A typical session is a few dozen events; check the usage page once there is real traffic.

### Events still missing

- [ ] **Offers that lapse unanswered.** Only accepting and declining are counted. An emergency, outbreak or house call left to run out says the player missed it or did not care; compare `offer`, `outbreakOffer` and `callOffer` from one look to the next.
- [ ] **How visits, emergencies and outbreaks end:** inspection grades and fines, VIP verdicts, emergencies and outbreaks won or lost (`visitReport`, `stats.emergencies`).
- [ ] **Mishaps, challenges and the rival:** each mishap and how long it lasted, staff challenges set and met or missed, the rival opening and the staff and guests it takes.
- [ ] **Staff careers:** courses started, finished and cancelled; promotions; raises asked for and given.
- [ ] **Building in more detail:** rooms resized, moved, copied and demolished; templates saved and used; land bought; room upgrades ordered; decor changed.
- [ ] **Policy changes** (diagnosis certainty, breaks, emergencies first) and treatments switched off.
- [ ] **Guests by condition:** which conditions arrive, which are healed and which leave unhealed, from `casebook`. Monthly totals cannot show that one condition is always failed.
- [ ] **The campaign:** centers opened, karma earned and what it is spent on. This lives outside any one game (`src/storage/campaign.ts`).
- [ ] **The title screen and setup:** sandbox options chosen, saves loaded, exported and deleted, the update offer taken up or ignored on the desktop.
- [ ] **Tool use:** the build tools picked, items rotated, the camera turned. Only worth it if menus and overlays turn out not to explain where players struggle.

### More to learn from what the game already knows

Found by looking at what the simulation tracks but does not send yet. Each is cheap, as the numbers already exist.

- [ ] **Refused actions, with the reason.** Every time the game says no (an item that will not fit, too little money, nobody qualified, a room missing what it needs) is a moment of friction. Counting them by reason shows which rules players do not understand. They are the places the tools play the `error` sound.
- [ ] **The center's bottleneck each month.** `src/core/sim/bottleneck.ts` and the advisor already work out what is holding the center back; adding it, and the advice showing, to `month_ended` shows what players most often fail to fix.
- [ ] **Where the money comes from and goes.** The month's whole ledger (fees, treatments, classes, shop, salaries, building, marketing, fines) in `month_ended`, not just the net. It shows which income streams carry a game and which costs sink it.
- [ ] **How staff and guests feel.** The month's average staff morale and energy, the share of time staff stood idle, and guests' lowest patience (`patienceTotal`). Unhappy staff come before quits; impatient guests come before lost ones.
- [ ] **Which goal holds up each star.** When the last of a star's objectives is met, and how long each took. The goal that is always last is the one to look at.
- [ ] **Frame rate and device.** The median and slowest frame rates for a session, the screen size and the graphics card (from WebGL), in `play_summary`. A player on a slow machine who quits after five minutes is a performance problem, not a design one.
- [ ] **Tips and advice acted on.** Which advisor messages and first-time tips are shown, and whether the player did what they suggested soon after.
- [ ] **Trying balance changes on some players.** PostHog's feature flags could give half the players a gentler first month and compare the funnel. The game turns flags off today (`advanced_disable_flags`); turning them on adds a request at start-up.

### Reliability

- [x] **`game_left` can be lost.** It goes out as a beacon while the page closes, and quitting the desktop app or a phone closing a hidden tab can drop it. Now a `play_summary` with the whole session so far goes out every 5 minutes of play and whenever the page is hidden, so at most a few minutes are ever lost.
- [ ] **Ad blockers stop many web players' events.** PostHog's domain is on the common block lists. GitHub Pages cannot proxy requests, so this needs a small proxy elsewhere, such as a Cloudflare Worker on a domain of the game's own, with `api_host` and the content security policy pointed at it.
- [ ] **Players who switch sharing off are not counted at all**, by design. Counting how many switch it off would need a count with no player id, which PostHog does not offer; leave it.

### Asking players why

The numbers show where players stop, not why.

- [ ] **A feedback button**, in the pause menu, sending a message to Sentry's User Feedback with the game's version and center, and optionally the save file attached, so a report can be loaded and reproduced.
- [ ] **A short survey** after the first star, or when a player leaves early. PostHog's surveys load a script from PostHog, which the content security policy and the no-external build rule out; a few questions drawn in the game's own style and sent as an event would do instead.
- [ ] **Watch people play.** Five people playing their first half hour without help will show more than any chart.

### Privacy and players

- [ ] **Tell new players.** Say once, on the title screen or the first game, that anonymous play statistics are shared and where to switch them off, rather than relying on them finding the setting.
- [ ] **A privacy note** in the README and beside the download buttons: what is sent (play statistics to PostHog, crash reports to Sentry), that neither has names or saves, that PostHog keeps IP addresses while they are kept, and how to stop it.
- [ ] **Session replay, if it is ever wanted.** It is off, and the content security policy and the no-external build would both have to change. Recordings of the canvas are of little use anyway: the game is drawn with WebGL, which replay does not capture well.
