// Which copy of the game is running, for the services that hear from published copies only.
import { desktop } from './desktop';

/** Whether this is an installed desktop app, which loads the game from inside its packed app.asar archive. */
const installed = desktop !== undefined && location.pathname.includes('/app.asar/');

/**
 * Which kind of copy this is: 'production' for the published web game, 'preview' for a build being tried out with
 * `yarn preview`, 'desktop' for an installed desktop app. Null for the dev server, and for the desktop app run from
 * this folder or by its tests, which report nothing.
 */
export function environment(): 'production' | 'preview' | 'desktop' | null {
  if (!import.meta.env.PROD) return null;
  if (desktop) return installed ? 'desktop' : null;
  return location.hostname.endsWith('github.io') ? 'production' : 'preview';
}
