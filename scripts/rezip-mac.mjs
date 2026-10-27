// Rebuilds the macOS update zips electron-builder left in release/ with ditto, then their blockmaps and the sizes and
// hashes in latest-mac.yml, so installed apps still accept them. Run it after electron-builder, before uploading.
//
// electron-builder zips the app with 7-Zip, which stamps each file with the time on the building machine's clock,
// UTC on GitHub's runners, and records no time zone that the updater's unzip (Squirrel.Mac runs ditto) reads. So
// ditto takes those times as the player's own local time, and west of UTC every file of an updated app is dated
// hours in the future. A zip ditto made itself carries times that come out right in any time zone.
//
//   node scripts/rezip-mac.mjs [release]
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

// these come with electron-builder, so the blockmap and the yml are made exactly as it makes them
const require = createRequire(import.meta.url);
const { buildBlockMap } = require('app-builder-lib/out/targets/blockmap/blockmap.js');
const { serializeToYaml } = require('builder-util');
const yaml = require('js-yaml');

const dir = process.argv[2] ?? 'release';
const ymlPath = path.join(dir, 'latest-mac.yml');
const info = yaml.load(readFileSync(ymlPath, 'utf8'));

const zips = info.files.filter((file) => file.url.endsWith('.zip'));
if (zips.length === 0) {
  console.error(`${ymlPath} lists no zips`);
  process.exit(1);
}

for (const file of zips) {
  // the zip's name ends in its architecture (artifactName in package.json), and electron-builder builds each
  // architecture's app in its own folder: mac for x64, mac-arm64 and so on for the others
  const arch = /-([^-]+)\.zip$/.exec(file.url)?.[1];
  const appDir = path.join(dir, arch === 'x64' ? 'mac' : `mac-${arch}`);
  const app = readdirSync(appDir).find((name) => name.endsWith('.app'));
  if (!app) {
    console.error(`No app in ${appDir} for ${file.url}`);
    process.exit(1);
  }

  const zip = path.join(dir, file.url);
  const tmp = `${zip}.ditto`;
  // The .app folder itself at the top, as 7-Zip had it. Without --norsrc ditto would also pack the building machine's
  // extended attributes, its file provenance among them, which 7-Zip never did; the dates are all that should change.
  execFileSync('ditto', ['-c', '-k', '--norsrc', '--keepParent', path.join(appDir, app), tmp]);
  renameSync(tmp, zip);

  const { sha512, size } = await buildBlockMap(zip, 'gzip', `${zip}.blockmap`);
  console.log(`${file.url}: ${file.size} -> ${size} bytes`);
  file.sha512 = sha512;
  file.size = size;
  // the old top-level path and sha512 name the first zip, for the oldest updaters
  if (info.path === file.url) info.sha512 = sha512;
}

writeFileSync(ymlPath, serializeToYaml(info, false, true));
