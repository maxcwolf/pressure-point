// Reading the choice that starts a game: a new one in a center, or a save to load, and what a new one starts with.

import { CAMPAIGN, type CenterId, CENTERS } from '../core/data';
import { type LessonId, lessonTip } from '../core/sim/lessons';
import type { GameState } from '../core/state/types';

/** The center a choice starts a new game in ('new' is the sandbox, 'new:willow' a campaign center), or null for a save. */
export function newGameCenter(what: string): CenterId | null {
  if (what === 'new') return 'sandbox';
  const id = what.startsWith('new:') ? what.slice(4) : '';
  return Object.hasOwn(CENTERS, id) ? (id as CenterId) : null;
}

/** What the player's settings and the campaign say about the tutorial for a new game. */
export interface TutorialStart {
  /** Whether Willow Lane's opening is walked through. */
  steps: boolean;
  /** Whether each thing is explained the first time it happens. */
  lessons: boolean;
  /** The lessons the campaign has shown already, in any of its centers. */
  seen: readonly LessonId[];
}

/**
 * Switch the tutorial on in a new game in one of the campaign's centers: the walk-through in Willow Lane alone, and the
 * cards that explain things in any of them, less those the campaign has shown already. The sandbox has neither.
 */
export function startTutorial(s: GameState, start: TutorialStart) {
  if (!CAMPAIGN.includes(s.center)) return;
  if (start.steps && s.center === CAMPAIGN[0]) s.tutorial = true;
  if (start.lessons) s.lessons = true;
  // kept as seen whether the cards are on or not, so switching them on later in the game shows none of them again
  for (const id of start.seen) s.seenTips.push(lessonTip(id));
}
