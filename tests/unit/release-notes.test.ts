import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const notes = (tag: string) =>
  execFileSync('node', ['scripts/release-notes.mjs', tag], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const version = JSON.parse(readFileSync('package.json', 'utf8')).version as string;

describe('release notes', () => {
  it('are the changelog section for the version, then how to play and install', () => {
    const text = notes('v0.2.0');
    expect(text).toContain('**Acupuncture:**');
    expect(text).not.toContain('Saved games');
    expect(text).not.toContain('## v0.');
    expect(text).toContain('https://maxcwolf.github.io/pressure-point/');
    expect(text.indexOf('Acupuncture')).toBeLessThan(text.indexOf('Play in your browser'));
  });

  it('exist for the version in package.json, and are short', () => {
    const text = notes(`v${version}`);
    expect(text).not.toContain('No notes were written');
    // short and to the point: a handful of bullets plus the three lines about playing it
    expect(text.split('\n').filter((line) => line.trim()).length).toBeLessThanOrEqual(10);
  });

  it('pick out a section in the middle and the last one alike', () => {
    expect(notes('v0.1.2')).toContain('Saved games');
    expect(notes('v0.1.2')).not.toContain('Acupuncture');
    expect(notes('v0.1.0')).toContain('First release');
  });

  it('warn, but still produce notes, for a version with no section', () => {
    const run = spawnSync('node', ['scripts/release-notes.mjs', 'v9.9.9'], { encoding: 'utf8' });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('No notes were written for this version.');
    expect(run.stderr).toContain('::warning::');
  });
});
