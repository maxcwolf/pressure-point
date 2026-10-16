// Error reports and logs from the published game, sent to Sentry: the web version and the installed desktop app.
// The dev server, and the desktop app run from this folder or by its tests, send nothing.
import * as Sentry from '@sentry/browser';

import { desktop } from './desktop';

/** Where the game's reports go. A DSN only says where to send, so it is safe to publish. */
const DSN = 'https://447a312d7f3f9ceddd763bcd504e2ab8@o4511475793068032.ingest.us.sentry.io/4512262151405568';

/** Whether this is an installed desktop app, which loads the game from inside its packed app.asar archive. */
const installed = desktop !== undefined && location.pathname.includes('/app.asar/');

/** Which kind of copy is reporting, or null for one that should not. */
function environment(): string | null {
  if (!import.meta.env.PROD) return null;
  if (desktop) return installed ? 'desktop' : null;
  // the published game, or a build being tried out with `yarn preview`
  return location.hostname.endsWith('github.io') ? 'production' : 'preview';
}

const env = environment();
if (env) {
  Sentry.init({
    dsn: DSN,
    environment: env,
    // matches the release the build uploads its source maps to (vite.config.ts)
    release: `pressure-point@${__APP_VERSION__}`,
    // the game's own logs go through Sentry.logger; console warnings and errors become logs too
    integrations: [Sentry.browserTracingIntegration(), Sentry.consoleLoggingIntegration({ levels: ['warn', 'error'] })],
    // the page load is all there is to trace, so a tenth of them is plenty
    tracesSampleRate: 0.1,
  });
  if (desktop) Sentry.setTag('platform', desktop.platform);
}
