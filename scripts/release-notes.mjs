// Prints the notes for a release: that version's section of CHANGELOG.md,
// followed by how to play and install from .github/release-notes.md.
//
//   node scripts/release-notes.mjs v0.2.0
import { readFileSync } from 'node:fs';

const tag = process.argv[2];
if (!tag) {
  console.error('usage: node scripts/release-notes.mjs <tag>');
  process.exit(2);
}

const lines = readFileSync('CHANGELOG.md', 'utf8').split('\n');
const start = lines.findIndex((line) => line.trim() === `## ${tag}`);
let section = '';
if (start >= 0) {
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith('## '));
  section = (end >= 0 ? rest.slice(0, end) : rest).join('\n').trim();
}
if (!section) {
  // a release still goes out, but say so loudly in the workflow log
  console.error(`::warning::CHANGELOG.md has no notes for ${tag}`);
  section = 'No notes were written for this version.';
}

console.log(`${section}\n\n${readFileSync('.github/release-notes.md', 'utf8').trim()}`);
