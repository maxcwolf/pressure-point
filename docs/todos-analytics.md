# Play statistics: done and to do

How the game counts what players do, sent to PostHog, and what is still to add so the numbers explain how the game is played. Crash reports and logs are separate and go to Sentry (`src/app/sentry.ts`).

Tick an item off when it is done, with the commit or release it landed in.

## How it works

- **Where they go.** PostHog's US cloud, the free tier, project "Default project" (id 672370). The project key is in `src/app/analytics.ts`. Like Sentry's DSN, it only says where to send, so it is safe to publish.
- **Which copies send.** Only the published web game (`production`) and the installed desktop app (`desktop`), as decided by `src/app/environment.ts`, which Sentry uses too. The dev server, `yarn preview`, the desktop app run from this folder and every test send nothing.
- **Sharing is on until switched off.** Settings → Privacy → Share play statistics. Switching it off stores `off` under `pressure-point-analytics` (`src/storage/analytics.ts`) and stops PostHog capturing; switching it back on forgets the choice.
- **Only the events the game sends.** The SDK is the `posthog-js/dist/module.no-external` build, with autocapture, page views, session recording, surveys, feature flags, heatmaps and exception capture all off, and nothing loaded from elsewhere. Players are a random id kept in local storage, with no person profiles (`person_profiles: 'never'`). The save's name, which is the player's own, is never sent.
- **The page allows it.** `index.html`'s content security policy lets the game connect to `https://us.i.posthog.com` and `https://us-assets.i.posthog.com`.
- **Two kinds of event.** Most are found by comparing the game, once a second, with how it stood a second before (`src/app/play-events.ts`, run by `watchGame` in `src/app/analytics.ts`), so the game core knows nothing of them. Choices made only in the interface (offers, menus, overlays, settings) are counted where the player clicks.
- **Tests.** `tests/unit/play-events.test.ts` covers every event found by comparison and the sharing switch.

## What is counted

Every event also carries `center`, `day`, `stars` and `cheated` (filter out cheated games when looking at balance), plus `app_version` and `platform` (`web`, `darwin` or `win32`).

| Event                | When                                                                                                 | Says                                                                                                                                                                            |
| -------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `game_opened`        | A game is started or loaded                                                                          | `kind` (`new` or `saved`), `difficulty`                                                                                                                                         |
| `game_left`          | The page closes, reloads or goes back to the title screen                                            | `minutes`, `days_played`, `money`, `seconds_at_speed` (seconds spent paused and at each speed while the page was showing)                                                       |
| `milestone_reached`  | A new player's firsts                                                                                | `milestone`: `first_item`, `first_hire`, `first_guest`, `first_heal`                                                                                                            |
| `doors_opened`       | The center opens for the first time                                                                  |                                                                                                                                                                                 |
| `room_built`         | A room is finished                                                                                   | `room`, `rooms` (how many there are now)                                                                                                                                        |
| `item_first_placed`  | The first item of a kind goes down in a game                                                         | `item`                                                                                                                                                                          |
| `staff_hired`        | Someone is hired                                                                                     | `role`                                                                                                                                                                          |
| `staff_left`         | Someone quits or is let go                                                                           | `role`, `reason` (`quit` or `fired`; leaving for the rival counts as `quit`)                                                                                                    |
| `month_ended`        | Each month closes                                                                                    | `month`, `money`, `reputation`, `net`, `loan`, guests `arrived`, `healed`, `failed`, `stormed`, `priced`, `sent`, `worse`, `healed_by`, `wait`, `staff`, `rooms`, `price_level` |
| `star_earned`        | A star is earned                                                                                     | `star`                                                                                                                                                                          |
| `achievement_earned` | An achievement is earned                                                                             | `achievement`                                                                                                                                                                   |
| `in_the_red`         | Money drops below zero                                                                               | `money`, `loan`                                                                                                                                                                 |
| `loan_changed`       | The loan is taken out or paid back, a step at a time                                                 | `loan`, `change` (`borrowed` or `repaid`)                                                                                                                                       |
| `price_changed`      | A price is changed (one event a second at most, so a run of clicks is one event)                     | `technique` (`all` for the overall level), `level`                                                                                                                              |
| `marketing_started`  | A marketing campaign is bought or extended                                                           | `kind`, `months`, `condition` for a condition campaign                                                                                                                          |
| `offer_answered`     | The player accepts or declines an emergency, a stress outbreak or a house call                       | `offer` (`emergency`, `outbreak`, `house_call`), `answer` (`accepted` or `declined`)                                                                                            |
| `menu_opened`        | A build menu is opened                                                                               | `menu`                                                                                                                                                                          |
| `overlay_shown`      | A floor overlay is picked                                                                            | `overlay`                                                                                                                                                                       |
| `setting_changed`    | A switch in Settings is flipped, on the title screen or in a game (the key bindings are not counted) | `setting`, `value`                                                                                                                                                              |

Checked end to end on 18 October 2026: a local production build, briefly allowed to send, delivered `game_opened` and `game_left` with every property. Those two events (a sandbox game, days 46 to 50) are the only test data in the project.

## To do

### In PostHog

- [ ] **Discard IP addresses.** The project keeps them (`anonymize_ips` is off). Turn on "Discard client IP data" under Project settings, so no player's IP address is stored.
- [ ] **A new-player funnel:** `game_opened` (new) → `milestone_reached` first_item → `doors_opened` → first_guest → first_heal → `star_earned` star 1. Where it drops is where new players get stuck.
- [ ] **Retention:** players who come back for another `game_opened` a day and a week later.
- [ ] **A dashboard of how games go:** money, reputation, guests lost by cause and wait times by month, broken down by center and difficulty; staff quits by role; who goes into the red, and when.
- [ ] **What gets used:** items and rooms never or rarely built, menus and overlays never opened, offers mostly turned down.
- [ ] **Filter out cheated games and test data** in the project's test account filters, so they stay out of every chart.
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

### Reliability

- [ ] **`game_left` can be lost.** It goes out as a beacon while the page closes. Quitting the desktop app, or a phone closing a hidden tab, can drop it. Sending a running summary every few minutes, or on `visibilitychange` to hidden, would make session length dependable.
- [ ] **Ad blockers stop many web players' events.** PostHog's domain is on the common block lists. GitHub Pages cannot proxy requests, so this needs a small proxy elsewhere, such as a Cloudflare Worker on a domain of the game's own, with `api_host` and the content security policy pointed at it.
- [ ] **Players who switch sharing off are not counted at all**, by design. Counting how many switch it off would need a count with no player id, which PostHog does not offer; leave it.

### Asking players why

The numbers show where players stop, not why.

- [ ] **A feedback button**, in the pause menu, sending a message to Sentry's User Feedback with the game's version and center, and optionally the save file attached, so a report can be loaded and reproduced.
- [ ] **A short survey** after the first star, or when a player leaves early. PostHog's surveys load a script from PostHog, which the content security policy and the no-external build rule out; a few questions drawn in the game's own style and sent as an event would do instead.
- [ ] **Watch people play.** Five people playing their first half hour without help will show more than any chart.

### Privacy and players

- [ ] **Tell new players.** Say once, on the title screen or the first game, that anonymous play statistics are shared and where to switch them off, rather than relying on them finding the setting.
- [ ] **A privacy note** in the README and beside the download buttons: what is sent (play statistics to PostHog, crash reports to Sentry), that neither has names or saves, and how to stop it.
- [ ] **Session replay, if it is ever wanted.** It is off, and the content security policy and the no-external build would both have to change. Recordings of the canvas are of little use anyway: the game is drawn with WebGL, which replay does not capture well.
