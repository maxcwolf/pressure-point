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
