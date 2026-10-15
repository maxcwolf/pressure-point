// The changelog, read for the title screen's What's New panel: CHANGELOG.md's sections, each a version and its notes,
// newest first. Only what the changelog uses is understood: `## ` headings, `- ` notes, notes indented under them, and
// **bold** words.

/** A run of a note's text, bold or not. */
export interface Span {
  text: string;
  bold: boolean;
}

/** A note, and any notes indented under it. */
export interface Note {
  spans: Span[];
  sub: Span[][];
}

/** One version's section of the changelog. */
export interface Release {
  /** As the heading has it, such as v0.25.0, or Unreleased. */
  version: string;
  notes: Note[];
}

/** The heading for changes made since the last release. */
const UNRELEASED = 'Unreleased';

/** A line of a note split into its plain and bold runs, leaving out empty ones. */
export function spans(line: string): Span[] {
  return line
    .split('**')
    .map((text, i) => ({ text, bold: i % 2 === 1 }))
    .filter((s) => s.text);
}

/** The changelog's sections in the order written, newest first, leaving out an empty Unreleased one. */
export function parseChangelog(markdown: string): Release[] {
  const releases: Release[] = [];
  for (const line of markdown.split('\n')) {
    const heading = /^## (.+)$/.exec(line);
    if (heading?.[1]) releases.push({ version: heading[1].trim(), notes: [] });
    const notes = releases.at(-1)?.notes;
    if (!notes) continue;
    const note = /^(\s*)- (.+)$/.exec(line);
    if (!note?.[2]) continue;
    const under = notes.at(-1);
    if (note[1] && under) under.sub.push(spans(note[2]));
    else notes.push({ spans: spans(note[2]), sub: [] });
  }
  return releases.filter((r) => r.version !== UNRELEASED || r.notes.length > 0);
}

/** What a section is called in the panel: its version, or what is coming next. */
export const releaseName = (version: string) => (version === UNRELEASED ? 'Coming next' : version);
