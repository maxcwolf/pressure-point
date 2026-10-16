// The changelog as the title screen's What's New panel reads it.
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { parseChangelog, releaseName, spans } from '../../src/ui/lib/changelog';

const SAMPLE = `# Changelog

Each release's notes are taken from its section here.

## Unreleased

## v0.2.0

- **Mishaps.** Something goes wrong:
  - **A power cut** at The Exchange.
  - **A storm** at The Boardwalk.
- Plain words, then **bold** ones.

## v0.1.0

- First release.
`;

describe('the changelog', () => {
  it('reads each version and its notes, newest first, with the notes indented under one kept with it', () => {
    const releases = parseChangelog(SAMPLE);
    expect(releases.map((r) => r.version)).toEqual(['v0.2.0', 'v0.1.0']);
    const [mishaps, plain] = releases[0]?.notes ?? [];
    expect(mishaps?.spans).toEqual([
      { text: 'Mishaps.', bold: true },
      { text: ' Something goes wrong:', bold: false },
    ]);
    expect(mishaps?.sub.map((s) => s[0]?.text)).toEqual(['A power cut', 'A storm']);
    expect(plain?.sub).toEqual([]);
    expect(releases[1]?.notes).toEqual([{ spans: [{ text: 'First release.', bold: false }], sub: [] }]);
  });

  it('shows changes not yet released only if there are any, as coming next', () => {
    expect(parseChangelog(SAMPLE.replace('## Unreleased\n', '## Unreleased\n\n- Soon.\n'))[0]?.version).toBe(
      'Unreleased',
    );
    expect(releaseName('Unreleased')).toBe('Coming next');
    expect(releaseName('v0.2.0')).toBe('v0.2.0');
  });

  it('reads the same with Windows line endings, as a Windows checkout has them', () => {
    expect(parseChangelog(SAMPLE.replaceAll('\n', '\r\n'))).toEqual(parseChangelog(SAMPLE));
  });

  it('splits a line into plain and bold runs', () => {
    expect(spans('**All** bold **and** not')).toEqual([
      { text: 'All', bold: true },
      { text: ' bold ', bold: false },
      { text: 'and', bold: true },
      { text: ' not', bold: false },
    ]);
  });

  it('has notes for every release in the real changelog, back to the first', () => {
    const releases = parseChangelog(readFileSync('CHANGELOG.md', 'utf8'));
    expect(releases.at(-1)?.version).toBe('v0.1.0');
    for (const r of releases) expect(r.notes.length, r.version).toBeGreaterThan(0);
  });
});
