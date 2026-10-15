// What the Treatments menu says about a psychedelic ceremony.

/** A note for a ceremony that depends on its room's set and setting, or null for any other treatment. */
export function tripNote(trip: boolean | undefined): string | null {
  return trip ? '🌀 Set and setting: needs a calm, clean, beautiful lodge' : null;
}
