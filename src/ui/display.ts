// Putting the display settings on the page: how big the in-game interface is drawn. The style sheets read `--ui-scale`
// on the page's root.

import { loadDisplay } from '../storage/display';

/** Set the page to the display settings in use. Call again whenever they change. */
export function applyDisplay() {
  document.documentElement.style.setProperty('--ui-scale', String(loadDisplay().uiScale));
}
