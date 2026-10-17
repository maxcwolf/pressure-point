// Whether the desktop app's window fills the screen. The app keeps the setting itself, so the window opens the same
// way next time; a browser has its own full screen and nothing to remember, so there this is undefined.
import type { DesktopApi } from '../../electron/api';
import type { FullScreenSwitch } from '../ui/host';
import { desktop } from './desktop';

/** Whether the window fills the screen, as the app last said or the player last chose. */
let on = false;
const listeners = new Set<() => void>();

/** Take note of whether the window fills the screen, and tell everyone listening if that has changed. */
function follow(now: boolean) {
  if (now === on) return;
  on = now;
  for (const listener of listeners) listener();
}

/** The switch for the desktop app's window. */
function switchFor(app: DesktopApi): FullScreenSwitch {
  app.onFullScreen(follow);
  return {
    /** Whether it fills the screen now. */
    on: () => on,
    /** Ask for it, and show the choice at once: the window takes a moment to get there, and says if it does not. */
    set: (now) => {
      app.setFullScreen(now);
      follow(now);
    },
    /** Hear when it fills the screen or leaves it. */
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export const fullScreen: FullScreenSwitch | undefined = desktop && switchFor(desktop);
