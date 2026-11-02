// What the profiles list on the title screen says: what each profile has, what deleting one loses, and why a name will
// not do.

import { loadCampaign } from '../../storage/campaign';
import { MAX_PROFILES, type ProfileRefusal } from '../../storage/profiles';
import { listSaves } from '../../storage/saves';
import { loadTemplates } from '../../storage/templates';

/** What a profile has, and would lose: its saved games, campaign stars, achievements, karma unlocks and templates. */
export interface ProfileContents {
  saves: number;
  stars: number;
  achievements: number;
  unlocks: number;
  templates: number;
}

/** What a profile has, read from its own storage. */
export function contentsOf(profile: string): ProfileContents {
  const campaign = loadCampaign(profile);
  return {
    saves: listSaves(profile).length,
    stars: Object.values(campaign.stars).reduce((n, s) => n + s, 0),
    achievements: campaign.achieved.length,
    unlocks: campaign.unlocked.length + campaign.decor.length,
    templates: loadTemplates(profile).length,
  };
}

/** A count with its noun: "1 saved game", "3 saved games". */
const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;

/** A list in words: "a", "a and b", "a, b and c". */
const inWords = (parts: readonly string[]) =>
  parts.length < 2 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1] ?? ''}`;

/** The line under a profile's name: how many saved games it has, and its stars. */
export function profileFacts(c: ProfileContents): string {
  const saves = c.saves ? count(c.saves, 'saved game') : 'No saved games';
  return c.stars ? `${saves} · ${c.stars} ★` : saves;
}

/** What deleting a profile loses, said under "Delete <name>?" before it is deleted. */
export function deleteWarning(c: ProfileContents): string {
  const parts = [
    c.saves && count(c.saves, 'saved game'),
    c.stars && count(c.stars, 'campaign star'),
    c.achievements && count(c.achievements, 'achievement'),
    c.unlocks && count(c.unlocks, 'karma unlock'),
    c.templates && count(c.templates, 'room template'),
  ].filter((p) => typeof p === 'string');
  if (!parts.length) return 'It has no saved games or campaign progress yet, so only its settings go.';
  return `This deletes its ${inWords(parts)}, and its settings. It cannot be undone.`;
}

/** Why a profile could not be added or renamed to a name. */
export function refusalNote(refusal: ProfileRefusal, name: string): string {
  switch (refusal) {
    case 'empty':
      return 'Type a name for the profile.';
    case 'taken':
      return `There is a profile called ${name} already.`;
    case 'full':
      return `There is room for ${MAX_PROFILES} profiles. Delete one to add another.`;
    case 'storage':
      return 'Could not keep the change: the browser’s storage is full. Delete or export some saved games first.';
  }
}
