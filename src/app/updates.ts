// A newer version of the desktop app, downloaded in the background by the app itself. A browser always loads the
// latest version, so there this is undefined.
import type { UpdateOffer } from '../ui/host';
import { desktop } from './desktop';

/** The version downloaded, once there is one. */
let ready: string | null = null;
const listeners = new Set<() => void>();

export const updates: UpdateOffer | undefined = desktop && {
  /** The version downloaded, if any. */
  ready: () => ready,
  /** Hear when one finishes downloading. */
  subscribe: (listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  install: desktop.installUpdate,
};

desktop?.onUpdateReady((version) => {
  if (version === ready) return;
  ready = version;
  for (const listener of listeners) listener();
});
