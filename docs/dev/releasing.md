# Releasing

Add a short section for the new version to `CHANGELOG.md`, headed with its tag (`## v1.2.3`, usually by renaming `## Unreleased`); it becomes the release notes, which `scripts/release-notes.mjs` puts together with `.github/release-notes.md`. The game shows the same changelog in What's new on its title screen, with anything under `## Unreleased` as Coming next. Set `version` in `package.json` to the new version too. Then push a version tag, which builds the installers on GitHub Actions and publishes them as a GitHub release:

```bash
git tag v1.2.3
git push origin v1.2.3
```

The tag must match the `version` in `package.json` (`v1.2.3` for `1.2.3`), because the installers take their version from the tag and the game shows the one in `package.json`; the workflow stops before building if they differ.

Once the release is published, the same run publishes the browser build to [GitHub Pages](https://maxcwolf.github.io/pressure-point/), so the web version always matches the installers and never goes up for a release that failed. The **Deploy web version** workflow can be run by hand to publish any other branch or tag.

The release also carries the Apple silicon `.dmg` and the Windows `.exe` again under names without the version (`Pressure-Point-Institute-mac-arm64.dmg`, `Pressure-Point-Institute-win-x64.exe`), so the README's download links, to `releases/latest/download/...`, always fetch the newest. The tag sets the version number in the installers. Running the **Release** workflow by hand from the Actions tab builds the installers as downloadable artifacts without publishing a release.

Everything runs on GitHub-hosted machines, which are free for a public repository: `macos-latest` for the macOS `.dmg` files (Apple silicon and Intel), `windows-latest` for the Windows `.exe` installer, and `ubuntu-latest` for publishing and for CI on pushes to main and pull requests (whose desktop tests run on `windows-latest` as well). Each build runs the unit tests before it packages. Setting the repository variable `MAC_RUNNER` to `self-hosted` builds the macOS installers on the Mac mini instead.

## Signing

With no secrets set, the macOS build is signed ad hoc and the Windows installer is unsigned, so both operating systems warn on first launch. `.github/release-notes.md` tells players how to get past that.

To ship a macOS build that opens without a warning, add the same five secrets the other macOS release pipelines use. The workflow then signs with the Developer ID certificate and notarizes with Apple:

`DEVELOPER_ID_CERT_BASE64`, `DEVELOPER_ID_CERT_PASSWORD`, `NOTARIZE_APPLE_ID`, `NOTARIZE_PASSWORD`, `NOTARIZE_TEAM_ID`

All five are set, so macOS builds are signed and notarized; the Windows installer is still unsigned. The Developer ID Application certificate (team `A5QKST5K59`) expires on **1 February 2027**. Before then, make a new one, export it with its private key as a `.p12`, and replace `DEVELOPER_ID_CERT_BASE64` and `DEVELOPER_ID_CERT_PASSWORD`. Apps already released keep working, and installed ones still accept updates signed with the new certificate, since it is the same team.

## Updates

The desktop app updates itself with `electron-updater` (`electron/updates.ts`). Once installed, it looks for a newer GitHub release at launch, each time the player comes back to the title screen from a game, and every four hours, downloads it in the background, and the game offers to restart for it: a toast in a game, a button on the title screen. A player who ignores it gets the update the next time they quit.

It reads `latest.yml` (Windows) and `latest-mac.yml` (macOS) from the newest release, so the workflow uploads those along with the `.zip` the macOS app updates from and the blockmaps that let it download only what changed. A release missing them is invisible to installed apps. Builds from manual runs are never published, so they are never offered.

The workflow remakes the macOS zips with `ditto` once electron-builder is done (`scripts/rezip-mac.mjs`, which `yarn dist:mac` runs too), and with them their blockmaps and the size and hash `latest-mac.yml` gives for each, which an installed app checks before it will update. electron-builder zips with 7-Zip, which dates every file by the runner's clock, in UTC, in a form the updater's unzip reads as the player's local time, so west of UTC an updated app's files were all dated hours in the future. Setting the runner's time zone would only move the problem to everyone else; a zip `ditto` made comes out right everywhere.

The macOS app only accepts an update signed by the same team, so an ad hoc signed build can neither update nor be updated. Apps from 0.27.1 and earlier have no updater: those players download one new version by hand, and update automatically from then on.

## Error reports

The web version and the installed desktop app report their errors to the `pressure-point` project in Sentry, tagged with the version as `pressure-point@1.2.3`. The environment says which: `production` for the published web version, `preview` for `yarn preview`, and `desktop` for an installed app, which is also tagged with its `platform`. The dev server, and the desktop app run from this folder or by its tests, report nothing; the desktop tests set `PP_NO_REPORTS`, which keeps even a packaged app quiet.

Besides errors nobody caught, the game logs each game it opens and any saved game that will not open or could not be written. Once a game is open, every report is tagged with its `center`. Save names are the player's own, so they never go into a report.

The web version uses Sentry's browser SDK (`src/app/sentry.ts`), which only ever sees what goes wrong in the game's JavaScript. The desktop app uses its Electron SDK instead: the game's page hands its reports to the app's main process, which sends them on (`electron/reports.ts`) and reports what the page cannot see. A native crash of any of the app's processes comes with the crash dump Electron's crash reporter writes, and a renderer, GPU or other process that exits abnormally or is killed is reported as it goes. So is the main process hanging for five seconds (`ApplicationNotResponding`, with no stack trace), and the game's window not responding, as a warning with how long it hung, counted from when Electron notices, some fifteen seconds in. A run that ended without quitting counts as an abnormal session in Sentry's release health.

The desktop app also keeps a note beside its window settings while it runs (`heartbeat.json`, `electron/heartbeat.ts`), rewritten every ten seconds and deleted when it quits. If the next launch finds it, the app sends a warning, "Previous run did not quit cleanly", with how long that run had lasted and when it was last seen running. Its `machine_rebooted` tag says whether the whole computer went down, having started up since then, or the app alone died. A Windows shutdown or sign-out with the game open counts as quitting.

For the reports to show the real code rather than the minified bundle, add a Sentry organization auth token as the `SENTRY_AUTH_TOKEN` secret. The **Deploy web version** and **Release** workflows then upload the build's source maps to Sentry, the desktop app's main process's among them, and delete them before publishing. Without it both still work, and the web deploy warns that no source maps were uploaded.
