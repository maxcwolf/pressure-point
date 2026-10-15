// What the Treatments menu says about a treatment that leaves guests needing a rest.

/** A note for a treatment that needs a rest after it, or null: fine with a Recovery Lounge, a warning without one. */
export function restNote(rest: boolean | undefined, lounge: boolean): { ok: boolean; text: string } | null {
  if (!rest) return null;
  return lounge
    ? { ok: true, text: '🛌 Rest after, in the Recovery Lounge' }
    : { ok: false, text: '⚠️ Rest after: needs a Recovery Lounge' };
}
