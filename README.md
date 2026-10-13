# Pressure Point Institute

### ▶ [Play it now in your browser](https://maxcwolf.github.io/pressure-point/)

Or download the macOS or Windows app from the [latest release](https://github.com/maxcwolf/pressure-point/releases/latest).

A healing-center management sim, in the spirit of the classic hospital tycoon games. Build rooms, hire staff, and treat guests.

**Massage therapy** and **acupuncture** are in. Reiki is planned.

![A busy healing center](docs/screenshot.png)

## Play

```bash
yarn install
yarn dev        # in the browser at http://localhost:5183
yarn app        # as a desktop app (builds, then opens Electron)
```

Package installers into `release/`:

```bash
yarn dist:mac   # .dmg for Apple silicon and Intel
yarn dist:win   # .exe installer (x64)
```

## Testing

```bash
yarn test       # unit tests: grid, placement, pathfinding, saves and the whole simulation
yarn test:e2e   # end-to-end tests: the real game in a headless browser, driven by mouse and keyboard
```

The first end-to-end run needs a browser: `yarn playwright install chromium`.

The unit tests seed the game's random numbers, so a failing run can be repeated exactly. They include hour-long sessions that check nothing goes missing, gets stuck or turns into `NaN`. The end-to-end tests start the dev server themselves and use the `window.pp` handle that dev builds expose to read game state and skip ahead in time. Both suites run in CI on every push and pull request.

Every bug fix comes with a test that fails on the old code and passes on the fix, so the bug cannot quietly come back.

## Releasing

Pushing a version tag builds the installers on GitHub Actions and publishes them as a GitHub release:

```bash
git tag v1.2.3
git push origin v1.2.3
```

The same tag also publishes the browser build to GitHub Pages at https://maxcwolf.github.io/pressure-point/, so the web version always matches the installers. The **Deploy web version** workflow can be run by hand to publish any other branch or tag.

The tag sets the version number in the installers. Running the **Release** workflow by hand from the Actions tab builds the installers as downloadable artifacts without publishing a release.

Everything runs on GitHub-hosted machines, which are free for a public repository: `macos-latest` for the macOS `.dmg` files (Apple silicon and Intel), `windows-latest` for the Windows `.exe` installer, and `ubuntu-latest` for publishing and for CI on pushes and pull requests.

### Optional: build macOS on the Mac mini

Set the repository variable `MAC_RUNNER` to move the macOS build onto the self-hosted Mac mini, and delete it to go back:

```bash
gh variable set MAC_RUNNER --body self-hosted
```

Self-hosted runners on a personal account belong to one repository, so the Mac mini first needs a runner registered for this repo alongside its existing ones. On the Mac mini:

```bash
mkdir ~/actions-runner-pressure-point && cd ~/actions-runner-pressure-point
VERSION=$(gh api repos/actions/runner/releases/latest --jq .tag_name | sed 's/^v//')
curl -fsSL -o runner.tar.gz "https://github.com/actions/runner/releases/download/v${VERSION}/actions-runner-osx-arm64-${VERSION}.tar.gz"
tar xzf runner.tar.gz
./config.sh --unattended \
  --url https://github.com/maxcwolf/pressure-point \
  --token "$(gh api -X POST repos/maxcwolf/pressure-point/actions/runners/registration-token --jq .token)" \
  --name mac-arm64-runner-pressure-point --labels pressure-point
./svc.sh install && ./svc.sh start
```

While the variable is set, a release waits for the Mac mini and is not published until its build finishes.

### Signing

With no secrets set, the macOS build is signed ad hoc and the Windows installer is unsigned, so both operating systems warn on first launch. `.github/release-notes.md` tells players how to get past that.

To ship a macOS build that opens without a warning, add the same five secrets the other macOS release pipelines use. The workflow then signs with the Developer ID certificate and notarizes with Apple:

`DEVELOPER_ID_CERT_BASE64`, `DEVELOPER_ID_CERT_PASSWORD`, `NOTARIZE_APPLE_ID`, `NOTARIZE_PASSWORD`, `NOTARIZE_TEAM_ID`

## How it plays

1. Place a **Reception Desk** and hire a **Receptionist**.
2. Build a **Consultation Room** (drag the floor, click a wall for the door, place the furniture) and hire a **Wellness Consultant**.
3. Build a **Massage Suite** and hire a **Massage Therapist**. The center opens once all three exist.
4. Guests check in, get diagnosed, get treated, and pay. Keep them patient with benches, tea, snacks, plants and a restroom.
5. Staff members get tired. A **Staff Room** lets them recover; a **Janitor** clears litter, waters plants, and keeps the massage stones hot.
6. Salaries come out at the end of each month. Hit the objectives to earn stars.
7. Stars unlock new **massage modalities**. Build a **Training Room** and send therapists on courses to deliver them.
8. A **Posture Lab** settles diagnoses the Consultant was unsure about, so fewer guests need a second consultation.
9. **Decor** (salt lamps, statues, rugs, magazine racks) makes its surroundings nicer to wait in and raises a room's **prestige**, which lifts staff morale and results.
10. Staff have **morale**. Underpaid or overworked staff ask for a raise, and quit if ignored for long.
11. Equipment **wears out** with use. A Janitor services it; left alone it breaks down.
12. The **Money** menu offers loans and lets you set prices. **Emergencies** bring a batch of guests to heal against the clock for a bonus.
13. From the first star you can add **acupuncture**: build an **Acupuncture Clinic** and hire an **Acupuncturist**, and a second kind of guest starts arriving.

### Treatments

A diagnosis prescribes a treatment. It only works properly with someone qualified in it and, for some, equipment in the same room. An unqualified member of staff will still try, at about a third of the usual success rate. The **Treatments** menu shows what each one treats and whether you can deliver it. Any member of staff can also take a skill course.

**Massage**, delivered in a Massage Suite by Massage Therapists:

| Modality | Unlocks | Needs | Character |
| --- | --- | --- | --- |
| Swedish | Start | Nothing | Quick, cheap, reliable |
| Deep Tissue | Star 1 | Course | Tires the therapist fast |
| Sports | Star 1 | Course, Stretch Rack | Long and hard to get right |
| Hot Stone | Star 2 | Course, Stone Warmer | High fee; the warmer cools with use |
| Cranio-sacral | Star 2 | Course | Slow, expensive, needs high skill |

**Acupuncture**, delivered in an Acupuncture Clinic by Acupuncturists. The clinic unlocks at star 1, and its guests only start arriving once you have built one:

| Technique | Unlocks | Needs | Character |
| --- | --- | --- | --- |
| Classic Needling | Star 1 | Nothing | Every acupuncturist knows it |
| Cupping | Star 1 | Course, Cupping Cart | A step up in fee |
| Moxibustion | Star 2 | Course, Moxa Burner | Slow and well paid |
| Electroacupuncture | Star 2 | Course, Stim Unit | The best paid, and the hardest to get right |

![An acupuncturist cupping a guest, with a line of guests showing the acupuncture conditions](docs/acupuncture.png)

### Settings

**Settings**, on the title screen and in the pause menu (☰), switches optional treatments on and off. Acupuncture is the first; reiki will join it. Switching one off hides its room, staff and equipment and stops its guests arriving, while anything already built stays where it is. The choice on the title screen applies to new games, and each saved game remembers its own. Sound and music are there too.

### Controls

| Input | Action |
| --- | --- |
| Left click | Select, place, confirm |
| Drag, or W A S D | Move the camera |
| Scroll | Zoom |
| R | Rotate furniture |
| Esc / right click | Cancel; Esc with nothing in hand opens the pause menu |
| Space, 1 2 3 | Pause, game speed |

The pause menu (☰ or Esc) has **Main menu**, which saves and returns to the title screen, and in the desktop app **Exit game**, which saves and quits. The title screen has **Exit** there too. The browser version has no Exit, because a browser tab cannot close itself.

### Saved games

The game autosaves every few seconds, in the browser and in the desktop app alike. **Save or load** in the pause menu (☰) keeps up to 20 named saves, and the title screen can load any of them. Starting a new game or loading a different one never destroys the game you were in: it moves to a "Previous game" slot.

Saves live in the browser's storage, so the web version and the desktop app each have their own. **Export** writes a save to a file and **Import** reads one back, which is how to back a game up or move it from one to the other.

## Code map

| Path | What lives there |
| --- | --- |
| `src/data.ts` | All tunable content: rooms, items, staff roles, traits, conditions, objectives, flavor text |
| `src/state.ts` | The game state (plain JSON) and upgrades for older saves |
| `src/saves.ts` | Autosave, named save slots, export and import |
| `src/settings.ts` | Preferences that outlive a game, such as which treatments are on |
| `src/world.ts` | Tile grid, placement rules, pathfinding |
| `src/sim.ts` | Guests, staff, lines, money, reputation |
| `src/tools.ts` | Build tools: room drag, doors, furniture placement |
| `src/render/` | Three.js scene and the procedural models |
| `src/ui/` | The HTML heads-up display |
| `src/audio.ts` | Synthesized sound effects and music |
| `electron/main.cjs` | Desktop shell |

Disciplines, modalities, conditions, courses and equipment are all defined in `data.ts`. Adding a discipline such as reiki means an entry in `DISCIPLINES`, a room, its items and a staff role, its modalities and conditions, and a model per item in `render/models.ts`. The simulation, menus and Settings pick it up from the data.
