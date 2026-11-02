// The town paper's page: its story cut into words and the names in it that can be clicked.

import type { PaperLink } from '../../core/state/types';

/** A run of a story's words, and the name it is, if it is one that can be clicked. */
export interface StoryPart {
  text: string;
  link?: PaperLink;
}

/**
 * A story cut at the first time each of its names appears, so each can be a link while `live` says whoever it names is
 * still there; the rest is plain words.
 */
export function storyParts(story: string, links: readonly PaperLink[], live: (l: PaperLink) => boolean): StoryPart[] {
  const found = links
    .filter(live)
    .map((link) => ({ link, at: story.indexOf(link.text) }))
    .filter((f) => f.at >= 0)
    .sort((a, b) => a.at - b.at);
  const parts: StoryPart[] = [];
  let from = 0;
  for (const { link, at } of found) {
    // a name inside one already linked stays words
    if (at < from) continue;
    if (at > from) parts.push({ text: story.slice(from, at) });
    parts.push({ text: link.text, link });
    from = at + link.text.length;
  }
  if (from < story.length) parts.push({ text: story.slice(from) });
  return parts;
}
