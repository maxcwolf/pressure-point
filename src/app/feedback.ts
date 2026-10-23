// What players write in to say about the game, sent to Sentry's user feedback with the version and where they were.
// Like the error reports, only the published web game and the installed desktop app send it.
import { captureFeedback, flush } from '@sentry/browser';

import { environment } from './environment';

/** Milliseconds to wait for the feedback to go before saying it did not. */
const SEND_WAIT_MS = 8000;

/** Where the player was when they wrote: the title screen, or a game, with its center and day. */
export type FeedbackFrom = { screen: 'title' } | { screen: 'game'; center: string; day: number };

/** Whether this copy of the game sends feedback, which the dev server and a desktop app run from this folder do not. */
export const feedbackSends = environment() !== null;

/**
 * Send what the player wrote, with an email to answer them at if they gave one. True once it has gone, false if it
 * could not go in time or this copy sends nothing.
 */
export async function sendFeedback(message: string, email: string, from: FeedbackFrom): Promise<boolean> {
  if (!feedbackSends) return false;
  const tags = from.screen === 'game' ? { screen: 'game', center: from.center, day: from.day } : { screen: 'title' };
  captureFeedback({ message, ...(email ? { email } : {}), source: from.screen, tags });
  return flush(SEND_WAIT_MS);
}
