// A newer version of the desktop app, downloaded in the background by the app itself. A browser always loads the
// latest version, so there this is undefined.
import type { UpdateStatus } from '../../electron/api';
import type { UpdateOffer } from '../ui/host';
import { desktop } from './desktop';

/** How far the app's look for an update has got. */
let status: UpdateStatus = { state: 'idle' };
const listeners = new Set<() => void>();

export const updates: UpdateOffer | undefined = desktop && {
  /** How far the look has got. */
  status: () => status,
  /** The version downloaded, if any. */
  ready: () => (status.state === 'ready' ? status.version : null),
  /** Hear when the look gets further. */
  subscribe: (listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  check: desktop.checkForUpdate,
  install: desktop.installUpdate,
};

desktop?.onUpdateStatus((next) => {
  status = next;
  for (const listener of listeners) listener();
});
