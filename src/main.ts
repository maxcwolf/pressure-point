// The entry point: load the fonts and styles, then start the app.
import '@fontsource/fredoka/latin-400.css';
import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-700.css';
import './ui/style.css';

import { boot } from './app/boot';

void boot();
