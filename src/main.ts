// The entry point: start error reporting, load the fonts and styles, then start the app.
// error reporting comes first, so it catches anything that goes wrong after
import './app/sentry';
import '@fontsource/fredoka/latin-400.css';
import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-700.css';
import './ui/theme/tokens.css';
import './ui/theme/global.css';
import './ui/theme/buttons.css';

import { boot } from './app/boot';

void boot();
