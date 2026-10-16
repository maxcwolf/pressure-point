# Releasing

Add a short section for the new version to `CHANGELOG.md`; it becomes the release notes. Then push a version tag, which builds the installers on GitHub Actions and publishes them as a GitHub release:

```bash
git tag v1.2.3
git push origin v1.2.3
```

The same tag also publishes the browser build to [GitHub Pages](https://maxcwolf.github.io/pressure-point/), so the web version always matches the installers. The **Deploy web version** workflow can be run by hand to publish any other branch or tag.

The tag sets the version number in the installers. Running the **Release** workflow by hand from the Actions tab builds the installers as downloadable artifacts without publishing a release.

Everything runs on GitHub-hosted machines, which are free for a public repository: `macos-latest` for the macOS `.dmg` files (Apple silicon and Intel), `windows-latest` for the Windows `.exe` installer, and `ubuntu-latest` for publishing and for CI on pushes and pull requests.

## Signing

With no secrets set, the macOS build is signed ad hoc and the Windows installer is unsigned, so both operating systems warn on first launch. `.github/release-notes.md` tells players how to get past that.

To ship a macOS build that opens without a warning, add the same five secrets the other macOS release pipelines use. The workflow then signs with the Developer ID certificate and notarizes with Apple:

`DEVELOPER_ID_CERT_BASE64`, `DEVELOPER_ID_CERT_PASSWORD`, `NOTARIZE_APPLE_ID`, `NOTARIZE_PASSWORD`, `NOTARIZE_TEAM_ID`

All five are set, so macOS builds are signed and notarized; the Windows installer is still unsigned. The Developer ID Application certificate (team `A5QKST5K59`) expires on **1 February 2027**. Before then, make a new one, export it with its private key as a `.p12`, and replace `DEVELOPER_ID_CERT_BASE64` and `DEVELOPER_ID_CERT_PASSWORD`. Apps already released keep working, and installed ones still accept updates signed with the new certificate, since it is the same team.

## Updates

The desktop app updates itself with `electron-updater` (`electron/updates.ts`). Once installed, it looks for a newer GitHub release at launch and every four hours, downloads it in the background, and the game offers to restart for it: a toast in a game, a button on the title screen. A player who ignores it gets the update the next time they quit.

It reads `latest.yml` (Windows) and `latest-mac.yml` (macOS) from the newest release, so the workflow uploads those along with the `.zip` the macOS app updates from and the blockmaps that let it download only what changed. A release missing them is invisible to installed apps. Builds from manual runs are never published, so they are never offered.

The macOS app only accepts an update signed by the same team, so an ad hoc signed build can neither update nor be updated. Apps from 0.27.1 and earlier have no updater: those players download one new version by hand, and update automatically from then on.

## Error reports

The web version reports its errors, and logs each game it opens, to the `pressure-point` project in Sentry (`src/app/sentry.ts`), tagged with the version as `pressure-point@1.2.3`. The dev server and the desktop app report nothing.

For the reports to show the real code rather than the minified bundle, add a Sentry organization auth token as the `SENTRY_AUTH_TOKEN` secret. The **Deploy web version** workflow then uploads the build's source maps to Sentry and deletes them before publishing. Without it the deploy still works, and the workflow warns that no source maps were uploaded.
