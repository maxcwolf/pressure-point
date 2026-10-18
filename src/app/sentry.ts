// Error reports and logs from the published game, sent to Sentry: the web version and the installed desktop app.
// The dev server, and the desktop app run from this folder or by its tests, send nothing.
import * as Sentry from '@sentry/browser';

import { desktop } from './desktop';
import { environment } from './environment';

/** Where the game's reports go. A DSN only says where to send, so it is safe to publish. */
const DSN = 'https://447a312d7f3f9ceddd763bcd504e2ab8@o4511475793068032.ingest.us.sentry.io/4512262151405568';

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
