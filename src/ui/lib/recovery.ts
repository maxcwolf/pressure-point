// What the Treatments menu says about a treatment that leaves guests needing a rest.

import type { IconLine } from './icon-line';

/** A note for a treatment that needs a rest after it, or null: fine with a Recovery Lounge, a warning without one. */
export function restNote(rest: boolean | undefined, lounge: boolean): (IconLine & { ok: boolean }) | null {
  if (!rest) return null;
  return lounge
    ? { ok: true, icon: 'room-recovery', text: 'Rest after, in the Recovery Lounge' }
    : { ok: false, icon: 'ui-warning', text: 'Rest after: needs a Recovery Lounge' };
}
